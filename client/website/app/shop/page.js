'use client';

import React, { useState, useMemo, useEffect, useDeferredValue, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ProductCard } from '../../components/product/ProductCard';
import { Icon } from '../../components/common/Icons';
import { useCart } from '../../lib/cart-context';
import { useQuickView } from '../../lib/quickview-context';

const DEFAULT_BANNER_IMG = 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1800&q=85';

function ShopSkeletonGrid({ count = 8, gridLevel = '4' }) {
  const items = Array.from({ length: count });
  return (
    <div
      className={`shop-grid grid-cols-${gridLevel}`}
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
  const [gridLevel, setGridLevel] = useState('4'); // '3', '4', '6', 'table'
  const [search, setSearch] = useState(initialSearch);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // useDeferredValue optimizes INP / TBT by preventing filter freezes during rapid typing
  const deferredSearch = useDeferredValue(search);

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
    if (activeCategoryObj?.image) return activeCategoryObj.image;
    if (parentCategoryObj?.image) return parentCategoryObj.image;
    const firstActive = banners.find(b => b.is_active !== 0 && b.image);
    if (firstActive?.image) return firstActive.image;
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
        {/* Compact Shop Header Banner (Title + Breadcrumbs + BG Image) */}
        {loading ? (
          <section className="shop-compact-banner is-loading" aria-label="Loading banner">
            <div className="shop-compact-banner__overlay" />
            <div className="shop-compact-banner__content">
              <div className="shop-compact-banner__skeleton-line" style={{ width: 140, height: 14 }} />
              <div className="shop-compact-banner__skeleton-line" style={{ width: 220, height: 28, marginTop: 4 }} />
            </div>
          </section>
        ) : (
          <section className="shop-compact-banner" aria-label="Page Header">
            <img
              key={activeBannerImage}
              className="shop-compact-banner__bg"
              src={activeBannerImage}
              alt={bannerTitle}
              fetchPriority="high"
              decoding="async"
              loading="eager"
            />
            <div className="shop-compact-banner__overlay" />
            <div className="shop-compact-banner__content">
              {/* Breadcrumbs inside banner with WCAG & Schema */}
              <nav className="shop-compact-banner__breadcrumbs" aria-label="Breadcrumb">
                <ol itemScope itemType="https://schema.org/BreadcrumbList">
                  <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                    <Link href="/" itemProp="item">
                      <span itemProp="name">Home</span>
                    </Link>
                    <meta itemProp="position" content="1" />
                  </li>
                  <span className="breadcrumbs-sep" aria-hidden="true">/</span>
                  <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                    <Link
                      href="/shop"
                      itemProp="item"
                      className={selectedCategory === 'all' && !search ? 'breadcrumbs-current' : ''}
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
                      <span className="breadcrumbs-sep" aria-hidden="true">/</span>
                      <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                        <button
                          type="button"
                          className="breadcrumb-btn-link"
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
                      <span className="breadcrumbs-sep" aria-hidden="true">/</span>
                      <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem" aria-current="page">
                        <span className="breadcrumbs-current" itemProp="name">{activeCategoryObj.name}</span>
                        <meta itemProp="position" content={parentCategoryObj ? "4" : "3"} />
                      </li>
                    </>
                  )}
                  {deferredSearch && (
                    <>
                      <span className="breadcrumbs-sep" aria-hidden="true">/</span>
                      <li aria-current="page">
                        <span className="breadcrumbs-current">Search: &quot;{deferredSearch}&quot;</span>
                      </li>
                    </>
                  )}
                </ol>
              </nav>

              {/* Compact Title */}
              <h1 className="shop-compact-banner__title">
                {deferredSearch ? (
                  <>Search: <em>&ldquo;{deferredSearch}&rdquo;</em></>
                ) : (
                  bannerTitle
                )}
              </h1>
            </div>
          </section>
        )}

        {/* Mobile Filter Trigger Button */}
        <div className="mobile-filter-bar">
          <button
            type="button"
            className="btn-open-mobile-filter"
            id="btn-open-mobile-filter"
            onClick={() => setMobileFilterOpen(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="21" x2="4" y2="14"/>
              <line x1="4" y1="10" x2="4" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12" y2="3"/>
              <line x1="20" y1="21" x2="20" y2="16"/>
              <line x1="20" y1="12" x2="20" y2="3"/>
              <line x1="1" y1="14" x2="7" y2="14"/>
              <line x1="9" y1="8" x2="15" y2="8"/>
              <line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
            <span>Filter & Sort</span>
          </button>
        </div>

        {/* Main Shop 2-Column Layout */}
        <div className="shop-layout">
          {/* Mobile backdrop */}
          {mobileFilterOpen && (
            <div
              className="sidebar-backdrop is-open"
              id="sidebar-backdrop"
              onClick={() => setMobileFilterOpen(false)}
            />
          )}

          {/* Left Column: Filter Sidebar */}
          <aside
            className={`shop-sidebar ${mobileFilterOpen ? 'is-open' : ''}`}
            id="shop-sidebar"
            aria-label="Product filters"
          >
            <div className="sidebar-handle" aria-hidden="true" />
            <div className="shop-sidebar__head">
              <h2>Filter & Sort</h2>
              <button
                type="button"
                className="btn-reset-filters"
                id="btn-reset-filters"
                onClick={clearAllFilters}
              >
                Clear all
              </button>
            </div>

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
                      onClick={() => {
                        setSelectedColor(selectedColor.toLowerCase() === c.name.toLowerCase() ? 'all' : c.name);
                        setMobileFilterOpen(false);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn"
              id="btn-close-mobile-filter"
              style={{ width: '100%', display: mobileFilterOpen ? 'block' : 'none', marginTop: '10px' }}
              onClick={() => setMobileFilterOpen(false)}
            >
              Apply Filters
            </button>
          </aside>

          {/* Right Column: Toolbar, Active Filter Tags, Products Grid */}
          <div className="shop-content">
            {/* Toolbar with Results Count and Grid Level Options */}
            <div className="shop-toolbar">
              <div className="shop-results-count">
                Showing <strong id="product-count">{loading ? '...' : filteredProducts.length}</strong> products
              </div>

              {/* Grid Level Switcher Options: 3, 4, 6, table */}
              <div className="grid-level-switcher" role="group" aria-label="Product display layout">
                <span className="grid-switcher-label">View:</span>

                {/* 3 Columns Grid Icon */}
                <button
                  type="button"
                  className={`btn-grid-opt ${gridLevel === '3' ? 'is-active' : ''}`}
                  onClick={() => setGridLevel('3')}
                  aria-label="3 columns grid"
                  title="3 Columns Grid"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="2" y="3.5" width="5.3" height="17" rx="1.2"/>
                    <rect x="9.35" y="3.5" width="5.3" height="17" rx="1.2"/>
                    <rect x="16.7" y="3.5" width="5.3" height="17" rx="1.2"/>
                  </svg>
                </button>

                {/* 4 Columns Grid Icon */}
                <button
                  type="button"
                  className={`btn-grid-opt ${gridLevel === '4' ? 'is-active' : ''}`}
                  onClick={() => setGridLevel('4')}
                  aria-label="4 columns grid"
                  title="4 Columns Grid"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="2" y="3.5" width="3.7" height="17" rx="0.9"/>
                    <rect x="7.5" y="3.5" width="3.7" height="17" rx="0.9"/>
                    <rect x="12.9" y="3.5" width="3.7" height="17" rx="0.9"/>
                    <rect x="18.3" y="3.5" width="3.7" height="17" rx="0.9"/>
                  </svg>
                </button>

                {/* 6 Columns Grid Icon */}
                <button
                  type="button"
                  className={`btn-grid-opt ${gridLevel === '6' ? 'is-active' : ''}`}
                  onClick={() => setGridLevel('6')}
                  aria-label="6 columns grid"
                  title="6 Columns Grid"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="2" y="3.5" width="2.2" height="17" rx="0.6"/>
                    <rect x="5.6" y="3.5" width="2.2" height="17" rx="0.6"/>
                    <rect x="9.2" y="3.5" width="2.2" height="17" rx="0.6"/>
                    <rect x="12.8" y="3.5" width="2.2" height="17" rx="0.6"/>
                    <rect x="16.4" y="3.5" width="2.2" height="17" rx="0.6"/>
                    <rect x="20" y="3.5" width="2.2" height="17" rx="0.6"/>
                  </svg>
                </button>

                {/* Table Format Icon */}
                <button
                  type="button"
                  className={`btn-grid-opt ${gridLevel === 'table' ? 'is-active' : ''}`}
                  onClick={() => setGridLevel('table')}
                  aria-label="Table list view"
                  title="Table Format View"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="3.5" rx="1"/>
                    <rect x="3" y="10.25" width="18" height="3.5" rx="1"/>
                    <rect x="3" y="16.5" width="18" height="3.5" rx="1"/>
                  </svg>
                </button>
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
              <ShopSkeletonGrid count={8} gridLevel={gridLevel} />
            ) : filteredProducts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>No matching products</h3>
                <p style={{ color: 'var(--muted)', marginBottom: '16px' }}>Try loosening your filter selections or explore our complete catalog.</p>
                <button className="btn" type="button" onClick={clearAllFilters}>Reset All Filters</button>
              </div>
            ) : gridLevel === 'table' ? (
              /* 1:1 Table Layout with theme shop.css */
              <div className="shop-grid grid-table" id="shop-products-grid">
                <div className="table-head-row">
                  <span>Product</span>
                  <span>Details</span>
                  <span>Rating</span>
                  <span>Price</span>
                  <span className="table-col-stock">Status</span>
                  <span style={{ textAlign: 'right' }}>Action</span>
                </div>

                {filteredProducts.map(p => {
                  const img = p.primary_image || (p.gallery && p.gallery[0]) || (p.images && p.images[0]) || '';
                  const priceVal = typeof p.price === 'number' ? p.price : parseFloat(p.price || 0);
                  const saleVal = typeof p.sale_price === 'number' ? p.sale_price : parseFloat(p.sale_price || 0);
                  const isSale = saleVal > 0 && saleVal < priceVal;

                  return (
                    <article key={p.id} className="product-table-row" data-product-id={p.id}>
                      <div className="table-col-img">
                        <Link href={`/product/${p.slug || p.id}`} aria-label={`View ${p.name}`}>
                          <img src={img} alt={p.name} loading="lazy" />
                        </Link>
                      </div>
                      <div className="table-col-info">
                        <div className="table-col-cat">{p.category_name || p.cat || 'NP Grand'}</div>
                        <h3>
                          <Link href={`/product/${p.slug || p.id}`}>{p.name}</Link>
                        </h3>
                      </div>
                      <div className="table-col-rating">
                        <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        <span>{p.rating || '4.9'}</span>
                      </div>
                      <div className="table-col-price">
                        <span>₹{(isSale ? saleVal : priceVal).toFixed(2)}</span>
                        {isSale && <del>₹{priceVal.toFixed(2)}</del>}
                      </div>
                      <div className="table-col-stock">
                        <span className="dot"></span>
                        <span>In stock</span>
                      </div>
                      <div className="table-col-actions">
                        <button
                          type="button"
                          className="btn-qv"
                          aria-label={`Quick view ${p.name}`}
                          onClick={() => openQuickView(p)}
                          title="Quick view"
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                            <circle cx="12" cy="12" r="3"/>
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="btn btn-add"
                          onClick={() => addToCart(p, { qty: 1, size: 'Standard', image: img })}
                        >
                          Add to bag +
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              /* Grid Layout (cols-3, cols-4, cols-6) */
              <div
                className={`shop-grid grid-cols-${gridLevel}`}
                id="shop-products-grid"
              >
                {filteredProducts.map((p, idx) => (
                  <ProductCard product={p} index={idx} key={p.id} />
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
            <ShopSkeletonGrid count={8} gridLevel="4" />
          </div>
        </div>
      }
    >
      <ShopContent />
    </Suspense>
  );
}
