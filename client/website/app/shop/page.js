'use client';

import React, { useState, useMemo, useEffect, useDeferredValue, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '../../components/product/ProductCard';
import { Icon } from '../../components/common/Icons';
import { useCart } from '../../lib/cart-context';
import { useQuickView } from '../../lib/quickview-context';

const DEFAULT_BANNER_IMG = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1800&q=85';

function ShopSkeletonGrid({ count = 8 }) {
  const items = Array.from({ length: count });
  return (
    <div
      className="shop-grid"
      role="status"
      aria-live="polite"
      aria-label="Loading catalog products"
    >
      {items.map((_, i) => (
        <div key={i} className="shop-skeleton-card" aria-hidden="true">
          <div className="shop-skeleton-card__img shop-skeleton-shimmer" />
          <div className="shop-skeleton-card__body">
            <div className="shop-skeleton-card__cat shop-skeleton-shimmer" />
            <div className="shop-skeleton-card__title shop-skeleton-shimmer" />
            <div className="shop-skeleton-card__meta">
              <div className="shop-skeleton-card__price shop-skeleton-shimmer" />
            </div>
            <div className="shop-skeleton-card__btn shop-skeleton-shimmer" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading products...</span>
    </div>
  );
}

function ShopContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category') || 'all';
  const initialFilter = searchParams.get('filter') || 'all';
  const initialSearch = searchParams.get('search') || '';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [priceRange, setPriceRange] = useState('all');
  const [availability, setAvailability] = useState(initialFilter === 'new' ? 'new' : 'all');
  const [selectedColor, setSelectedColor] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [search, setSearch] = useState(initialSearch);
  const [filterOpen, setFilterOpen] = useState(false);

  // useDeferredValue optimizes INP / TBT by preventing filter freezes during rapid typing
  const deferredSearch = useDeferredValue(search);

  // Prevent background scroll when filter drawer / popover is open & listen for Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setFilterOpen(false);
    };
    if (filterOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [filterOpen]);

  const { addToCart } = useCart();
  const { openQuickView } = useQuickView();

  // Fetch live products, categories, and active banners concurrently from backend API
  useEffect(() => {
    let isMounted = true;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    Promise.allSettled([
      fetch(`${apiBase}/products`).then(res => res.json()),
      fetch(`${apiBase}/categories`).then(res => res.json()),
      fetch(`${apiBase}/banners`).then(res => res.json())
    ]).then(([prodRes, catRes, banRes]) => {
      if (!isMounted) return;

      if (prodRes.status === 'fulfilled' && prodRes.value?.data?.products) {
        setProducts(prodRes.value.data.products);
      }
      if (catRes.status === 'fulfilled' && Array.isArray(catRes.value?.data)) {
        setCategories(catRes.value.data);
      }
      if (banRes.status === 'fulfilled' && Array.isArray(banRes.value?.data)) {
        setBanners(banRes.value.data);
      }
      setLoading(false);
    }).catch(() => {
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync params when URL changes
  useEffect(() => {
    if (searchParams.get('category')) setSelectedCategory(searchParams.get('category'));
    if (searchParams.get('filter')) setAvailability(searchParams.get('filter'));
    if (searchParams.get('search')) setSearch(searchParams.get('search'));
  }, [searchParams]);

  // Active Category resolution
  const activeCategoryObj = useMemo(() => {
    if (selectedCategory === 'all') return null;
    const s = selectedCategory.toLowerCase().trim();
    return categories.find(c => (c.slug || '').toLowerCase() === s || (c.name || '').toLowerCase() === s) || null;
  }, [selectedCategory, categories]);

  const parentCategoryObj = useMemo(() => {
    if (!activeCategoryObj || !activeCategoryObj.parent_id) return null;
    return categories.find(c => c.id === activeCategoryObj.parent_id) || null;
  }, [activeCategoryObj, categories]);

  // Dynamic Banner Background Image resolution (Category -> Parent -> CMS Banner -> Fallback)
  const activeBannerImage = useMemo(() => {
    if (activeCategoryObj?.banner_image) return activeCategoryObj.banner_image;
    if (activeCategoryObj?.image) return activeCategoryObj.image;
    if (parentCategoryObj?.banner_image) return parentCategoryObj.banner_image;
    if (parentCategoryObj?.image) return parentCategoryObj.image;
    const firstActive = banners.find(b => b.is_active !== 0 && (b.image_url || b.image));
    if (firstActive?.image_url || firstActive?.image) return firstActive.image_url || firstActive.image;
    return DEFAULT_BANNER_IMG;
  }, [activeCategoryObj, parentCategoryObj, banners]);

  // Dynamic Banner Title resolution
  const bannerTitle = useMemo(() => {
    if (deferredSearch.trim()) return `Search results for "${deferredSearch.trim()}"`;
    if (activeCategoryObj) return activeCategoryObj.name;
    if (selectedCategory !== 'all') {
      return selectedCategory.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return 'All Collections';
  }, [deferredSearch, activeCategoryObj, selectedCategory]);

  // Extract available colors dynamically from fetched products
  const availableColors = useMemo(() => {
    const map = new Map();
    products.forEach(p => {
      if (Array.isArray(p.colors)) {
        p.colors.forEach(c => {
          if (c && c.name && !map.has(c.name.toLowerCase())) {
            map.set(c.name.toLowerCase(), {
              name: c.name,
              hex: c.hex || (c.name.toLowerCase() === 'black' ? '#111111' : '#888888')
            });
          }
        });
      }
    });
    return Array.from(map.values());
  }, [products]);

  // Filtering and sorting with deferred search query
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search query
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase().trim();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.tagline && p.tagline.toLowerCase().includes(q)) ||
        (p.cat && p.cat.toLowerCase().includes(q)) ||
        (p.category_name && p.category_name.toLowerCase().includes(q))
      );
    }

    // Category
    if (selectedCategory !== 'all') {
      const selected = selectedCategory.toLowerCase().trim();
      result = result.filter(p => {
        const cat = (p.category_name || p.cat || '').toLowerCase();
        const catSlug = (p.category_slug || '').toLowerCase();
        const parentName = (p.parent_category_name || '').toLowerCase();
        const parentSlug = (p.parent_category_slug || '').toLowerCase();
        return cat === selected || catSlug === selected || parentName === selected || parentSlug === selected;
      });
    }

    // Price range
    if (priceRange === 'under-100') {
      result = result.filter(p => p.price < 100);
    } else if (priceRange === '100-500') {
      result = result.filter(p => p.price >= 100 && p.price <= 500);
    } else if (priceRange === 'over-500') {
      result = result.filter(p => p.price > 500);
    }

    // Availability / Badges
    if (availability === 'sale') {
      result = result.filter(p => p.sale_price && p.sale_price > 0 && p.sale_price < p.price);
    } else if (availability === 'bestseller') {
      result = result.filter(p => p.badge && p.badge.toLowerCase().includes('bestseller'));
    } else if (availability === 'new') {
      result = result.filter(p => p.badge && p.badge.toLowerCase().includes('new'));
    }

    // Color
    if (selectedColor !== 'all') {
      result = result.filter(p =>
        p.colors && p.colors.some(c => c.name.toLowerCase() === selectedColor.toLowerCase())
      );
    }

    // Sort
    if (sortBy === 'price-low') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => (b.rating || 5) - (a.rating || 5));
    } else if (sortBy === 'newest') {
      result.sort((a, b) => (b.badge === 'New' ? 1 : 0) - (a.badge === 'New' ? 1 : 0));
    }

    return result;
  }, [products, selectedCategory, priceRange, availability, selectedColor, sortBy, deferredSearch]);

  const clearAllFilters = () => {
    setSelectedCategory('all');
    setPriceRange('all');
    setAvailability('all');
    setSelectedColor('all');
    setSortBy('featured');
    setSearch('');
  };

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    priceRange !== 'all' ||
    availability !== 'all' ||
    selectedColor !== 'all' ||
    search !== '';

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategory !== 'all') count++;
    if (priceRange !== 'all') count++;
    if (availability !== 'all') count++;
    if (selectedColor !== 'all') count++;
    if (search.trim()) count++;
    return count;
  }, [selectedCategory, priceRange, availability, selectedColor, search]);

  return (
    <div className="shop-page">
      {/* Structured Data: BreadcrumbList and ItemList for E-Commerce SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Home',
                    item: 'https://npgrand.com/'
                  },
                  {
                    '@type': 'ListItem',
                    position: 2,
                    name: 'Shop',
                    item: 'https://npgrand.com/shop'
                  },
                  ...(activeCategoryObj
                    ? [
                        {
                          '@type': 'ListItem',
                          position: 3,
                          name: activeCategoryObj.name,
                          item: `https://npgrand.com/shop?category=${activeCategoryObj.slug}`
                        }
                      ]
                    : [])
                ]
              },
              {
                '@type': 'ItemList',
                name: bannerTitle,
                numberOfItems: filteredProducts.length,
                itemListElement: filteredProducts.slice(0, 12).map((p, idx) => ({
                  '@type': 'ListItem',
                  position: idx + 1,
                  item: {
                    '@type': 'Product',
                    name: p.name,
                    image: p.primary_image || (p.gallery && p.gallery[0]) || '',
                    description: p.tagline || p.name,
                    offers: {
                      '@type': 'Offer',
                      price: p.sale_price || p.price,
                      priceCurrency: 'INR',
                      availability: 'https://schema.org/InStock',
                      url: `https://npgrand.com/product/${p.slug || p.id}`
                    }
                  }
                }))
              }
            ]
          })
        }}
      />

      <div className="container">
        {/* Breadcrumb Navigation (Cleanly positioned above the banner) */}
        <nav className="breadcrumbs shop-breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: '16px', fontSize: '13px' }}>
          <ol itemScope itemType="https://schema.org/BreadcrumbList" style={{ listStyle: 'none', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', margin: 0, padding: 0 }}>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link href="/" itemProp="item" style={{ color: '#4b5563', textDecoration: 'none' }}>
                <span itemProp="name">Home</span>
              </Link>
              <meta itemProp="position" content="1" />
            </li>
            <span className="breadcrumbs-sep" aria-hidden="true" style={{ color: '#9ca3af' }}>/</span>
            <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <Link
                href="/shop"
                itemProp="item"
                style={{ color: selectedCategory === 'all' && !search ? '#111827' : '#4b5563', fontWeight: selectedCategory === 'all' && !search ? 700 : 500, textDecoration: 'none' }}
                onClick={() => {
                  if (selectedCategory !== 'all' || search) {
                    setSelectedCategory('all');
                    setSearch('');
                  }
                }}
              >
                <span itemProp="name">Shop</span>
              </Link>
              <meta itemProp="position" content="2" />
            </li>
            {parentCategoryObj && (
              <>
                <span className="breadcrumbs-sep" aria-hidden="true" style={{ color: '#9ca3af' }}>/</span>
                <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', padding: 0, color: '#4b5563', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                    onClick={() => setSelectedCategory(parentCategoryObj.slug || parentCategoryObj.name)}
                  >
                    <span itemProp="name">{parentCategoryObj.name}</span>
                  </button>
                  <meta itemProp="position" content="3" />
                </li>
              </>
            )}
            {activeCategoryObj && (
              <>
                <span className="breadcrumbs-sep" aria-hidden="true" style={{ color: '#9ca3af' }}>/</span>
                <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" aria-current="page">
                  <span style={{ color: '#111827', fontWeight: 700 }} itemProp="name">{activeCategoryObj.name}</span>
                  <meta itemProp="position" content={parentCategoryObj ? "4" : "3"} />
                </li>
              </>
            )}
            {deferredSearch && (
              <>
                <span className="breadcrumbs-sep" aria-hidden="true" style={{ color: '#9ca3af' }}>/</span>
                <li aria-current="page">
                  <span style={{ color: '#111827', fontWeight: 700 }}>Search: &quot;{deferredSearch}&quot;</span>
                </li>
              </>
            )}
          </ol>
        </nav>

        {/* Pure Category Shop Page Banner: NO OVERLAY, NO TEXT ON IMAGE, 100% CLEAN & OPTIMIZED */}
        {loading ? (
          <section className="shop-pure-banner is-loading" aria-label="Loading banner" style={{ width: '100%', height: '220px', borderRadius: '16px', background: '#f5f5f5', marginBottom: '24px' }} />
        ) : (
          <section
            className="shop-pure-banner"
            aria-label="Category Page Banner"
            style={{
              position: 'relative',
              borderRadius: '16px',
              overflow: 'hidden',
              marginBottom: '26px',
              maxHeight: '260px',
              width: '100%',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}
          >
            <img
              key={activeBannerImage}
              className="shop-pure-banner__img"
              src={activeBannerImage}
              alt={bannerTitle}
              fetchPriority="high"
              decoding="async"
              loading="eager"
              style={{
                width: '100%',
                height: '100%',
                maxHeight: '260px',
                objectFit: 'cover',
                display: 'block'
              }}
            />
          </section>
        )}

        {/* Clean Page Title Bar (Positioned outside/below the banner) */}
        <div className="shop-page-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#111827', margin: '0 0 2px', letterSpacing: '-0.01em' }}>
              {deferredSearch ? (
                <>Search: <em>&ldquo;{deferredSearch}&rdquo;</em></>
              ) : (
                bannerTitle
              )}
            </h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'Product' : 'Products'}
            </p>
          </div>
        </div>

        {/* Filter Drawer Backdrop Overlay */}
        <div
          className={`shop-drawer-backdrop ${filterOpen ? 'is-open' : ''}`}
          onClick={() => setFilterOpen(false)}
          aria-hidden="true"
        />

        {/* Side Popover Filter Drawer */}
        <aside
          className={`shop-sidebar-drawer ${filterOpen ? 'is-open' : ''}`}
          id="shop-sidebar-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Product filters and sorting"
        >
          <div className="drawer-header">
            <div className="drawer-title-group">
              <h2>Filter &amp; Sort</h2>
              {activeFilterCount > 0 && (
                <span className="drawer-count-badge">{activeFilterCount} active</span>
              )}
            </div>
            <button
              type="button"
              className="btn-drawer-close"
              onClick={() => setFilterOpen(false)}
              aria-label="Close filters"
            >
              ✕
            </button>
          </div>

          <div className="drawer-body">

            {/* Sort Select */}
            <div className="filter-group">
              <label className="filter-title" htmlFor="sort-by-select">Sort by</label>
              <select
                id="sort-by-select"
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="featured">Featured / Bestselling</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Highest Customer Rating</option>
                <option value="newest">Newest Arrivals</option>
              </select>
            </div>

            {/* Collections Filter */}
            <div className="filter-group">
              <span className="filter-title">Collections</span>
              <ul className="filter-list">
                <li>
                  <label className="filter-checkbox">
                    <input
                      type="radio"
                      name="category-filter"
                      value="all"
                      checked={selectedCategory === 'all'}
                      onChange={() => {
                        setSelectedCategory('all');
                        setMobileFilterOpen(false);
                      }}
                    />
                    <span style={{ fontWeight: 600 }}>All Collections</span>
                    <span className="count">({products.length})</span>
                  </label>
                </li>
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '6px 0' }}>
                    <div className="shop-skeleton-shimmer" style={{ height: 16, width: '75%', borderRadius: 4 }} />
                    <div className="shop-skeleton-shimmer" style={{ height: 16, width: '85%', borderRadius: 4 }} />
                    <div className="shop-skeleton-shimmer" style={{ height: 16, width: '60%', borderRadius: 4 }} />
                    <div className="shop-skeleton-shimmer" style={{ height: 16, width: '70%', borderRadius: 4 }} />
                  </div>
                ) : (
                  categories.filter(c => !c.parent_id).map(main => {
                    const subs = categories.filter(s => s.parent_id === main.id);
                    const isMainSelected = selectedCategory.toLowerCase() === (main.slug || '').toLowerCase() ||
                                           selectedCategory.toLowerCase() === (main.name || '').toLowerCase();
                    return (
                      <React.Fragment key={main.id}>
                        <li>
                          <label className="filter-checkbox">
                            <input
                              type="radio"
                              name="category-filter"
                              value={main.slug || main.name}
                              checked={isMainSelected}
                              onChange={() => {
                                setSelectedCategory(main.slug || main.name);
                                setMobileFilterOpen(false);
                              }}
                            />
                            <span style={{ fontWeight: 600 }}>{main.name}</span>
                            {main.product_count > 0 && <span className="count">({main.product_count})</span>}
                          </label>
                        </li>
                        {subs.map(sub => {
                          const isSubSelected = selectedCategory.toLowerCase() === (sub.slug || '').toLowerCase() ||
                                                selectedCategory.toLowerCase() === (sub.name || '').toLowerCase();
                          return (
                            <li key={sub.id} style={{ paddingLeft: '18px' }}>
                              <label className="filter-checkbox" style={{ fontSize: '13px' }}>
                                <input
                                  type="radio"
                                  name="category-filter"
                                  value={sub.slug || sub.name}
                                  checked={isSubSelected}
                                  onChange={() => {
                                    setSelectedCategory(sub.slug || sub.name);
                                    setMobileFilterOpen(false);
                                  }}
                                />
                                <span style={{ color: 'var(--muted)' }}>↳ {sub.name}</span>
                                {sub.product_count > 0 && <span className="count">({sub.product_count})</span>}
                              </label>
                            </li>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </ul>
            </div>

            {/* Price Range Filter */}
            <div className="filter-group">
              <span className="filter-title">Price Range</span>
              <div className="price-chips">
                {[
                  { value: 'all', label: 'All' },
                  { value: 'under-100', label: 'Under ₹100' },
                  { value: '100-500', label: '₹100 – ₹500' },
                  { value: 'over-500', label: 'Over ₹500' }
                ].map(chip => (
                  <button
                    key={chip.value}
                    type="button"
                    className={`price-chip ${priceRange === chip.value ? 'is-active' : ''}`}
                    onClick={() => {
                      setPriceRange(chip.value);
                      setMobileFilterOpen(false);
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Availability Filter */}
            <div className="filter-group">
              <span className="filter-title">Availability</span>
              <ul className="filter-list">
                {[
                  { value: 'all', label: 'All Items' },
                  { value: 'bestseller', label: 'Bestsellers' },
                  { value: 'new', label: 'New Arrivals' },
                  { value: 'sale', label: 'On Sale' }
                ].map(item => (
                  <li key={item.value}>
                    <label className="filter-checkbox">
                      <input
                        type="radio"
                        name="avail-filter"
                        value={item.value}
                        checked={availability === item.value}
                        onChange={() => {
                          setAvailability(item.value);
                          setMobileFilterOpen(false);
                        }}
                      />
                      <span>{item.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            {/* Color Swatch Filter (Dynamic from Products) */}
            {availableColors.length > 0 && (
              <div className="filter-group">
                <span className="filter-title">Colour Tone</span>
                <div className="color-swatches-filter">
                  {availableColors.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      className={`color-swatch-filter-btn ${selectedColor.toLowerCase() === c.name.toLowerCase() ? 'is-active' : ''}`}
                      style={{ background: c.hex }}
                      title={c.name}
                      aria-label={c.name}
                      onClick={() => setSelectedColor(selectedColor.toLowerCase() === c.name.toLowerCase() ? 'all' : c.name)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="drawer-footer">
            <button
              type="button"
              className="btn-drawer-reset"
              onClick={clearAllFilters}
              disabled={!hasActiveFilters}
            >
              Reset All
            </button>
            <button
              type="button"
              className="btn btn-drawer-apply"
              onClick={() => setFilterOpen(false)}
            >
              Apply Filters ({filteredProducts.length})
            </button>
          </div>
        </aside>

        {/* Main Shop Layout */}
        <div className="shop-layout">
          {/* Main Content Area */}
          <div className="shop-content">
            {/* Toolbar: Filters Trigger Button & Results Count on Left, Sort by on Right */}
            <div className="shop-toolbar">
              <div className="shop-toolbar-left">
                <button
                  type="button"
                  className="btn-filter-trigger"
                  onClick={() => setFilterOpen(true)}
                  id="btn-filter-trigger"
                  aria-expanded={filterOpen}
                  aria-label="Open filter options"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="4" y1="21" x2="4" y2="14" />
                    <line x1="4" y1="10" x2="4" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12" y2="3" />
                    <line x1="20" y1="21" x2="20" y2="16" />
                    <line x1="20" y1="12" x2="20" y2="3" />
                    <line x1="1" y1="14" x2="7" y2="14" />
                    <line x1="9" y1="8" x2="15" y2="8" />
                    <line x1="17" y1="16" x2="23" y2="16" />
                  </svg>
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="filter-badge">{activeFilterCount}</span>
                  )}
                </button>

                <div className="shop-results-count">
                  Showing <strong id="product-count">{loading ? '...' : filteredProducts.length}</strong> products
                </div>
              </div>

              <div className="shop-toolbar-right">
                <div className="shop-sort-box">
                  <label htmlFor="toolbar-sort-by">Sort by:</label>
                  <select
                    id="toolbar-sort-by"
                    className="shop-sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="featured">Featured / Bestselling</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="rating">Highest Rating</option>
                    <option value="newest">Newest Arrivals</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Active Filter Tags */}
            {hasActiveFilters && (
              <div className="active-filters-bar" id="active-filters-bar">
                {selectedCategory !== 'all' && (
                  <span className="active-filter-tag">
                    Category: {selectedCategory}
                    <button type="button" onClick={() => setSelectedCategory('all')} aria-label="Remove filter">✕</button>
                  </span>
                )}
                {priceRange !== 'all' && (
                  <span className="active-filter-tag">
                    Price: {priceRange}
                    <button type="button" onClick={() => setPriceRange('all')} aria-label="Remove filter">✕</button>
                  </span>
                )}
                {availability !== 'all' && (
                  <span className="active-filter-tag">
                    {availability === 'bestseller' ? 'Bestsellers' : availability === 'new' ? 'New Arrivals' : 'On Sale'}
                    <button type="button" onClick={() => setAvailability('all')} aria-label="Remove filter">✕</button>
                  </span>
                )}
                {selectedColor !== 'all' && (
                  <span className="active-filter-tag">
                    Colour: {selectedColor}
                    <button type="button" onClick={() => setSelectedColor('all')} aria-label="Remove filter">✕</button>
                  </span>
                )}
                {search && (
                  <span className="active-filter-tag">
                    &quot;{search}&quot;
                    <button type="button" onClick={() => setSearch('')} aria-label="Remove filter">✕</button>
                  </span>
                )}
                <button
                  type="button"
                  className="btn-reset-filters"
                  onClick={clearAllFilters}
                  style={{ marginLeft: '4px' }}
                >
                  Clear all
                </button>
              </div>
            )}

            {/* Performance-Optimized Skeleton Loader vs Empty State vs Catalog View */}
            {loading ? (
              <ShopSkeletonGrid count={8} />
            ) : filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>No matching products</h3>
                <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>Try loosening your filter selections or explore our complete catalog.</p>
                <button className="btn" type="button" onClick={clearAllFilters}>Reset All Filters</button>
              </div>
            ) : (
              /* Grid Layout (Exactly 4 cards per row on desktop) */
              <div
                className="shop-grid"
                id="shop-products-grid"
              >
                {filteredProducts.map((p, idx) => (
                  <ProductCard
                    product={p}
                    index={idx}
                    key={p.id}
                    showRating={false}
                    isShop={true}
                    fullImage={true}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <div className="shop-page">
          <div className="container">
            <div className="shop-compact-banner is-loading" style={{ minHeight: 140 }}>
              <div className="shop-compact-banner__content">
                <div className="shop-compact-banner__skeleton-line" style={{ width: 140, height: 14 }} />
                <div className="shop-compact-banner__skeleton-line" style={{ width: 220, height: 28, marginTop: 4 }} />
              </div>
            </div>
            <ShopSkeletonGrid count={8} />
          </div>
        </div>
      }
    >
      <ShopContent />
    </Suspense>
  );
}
