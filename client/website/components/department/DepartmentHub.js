'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProductCard } from '../product/ProductCard';

export function DepartmentHubContent({
  gender, // 'women', 'men', 'kids'
  title,
  eyebrow,
  tagline,
  heroImage
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCategorySlug = searchParams.get('category') || '';

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProds, setLoadingProds] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [sortBy, setSortBy] = useState('recommended');
  const [pageBannerData, setPageBannerData] = useState(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  // Fetch page banners from CMS
  useEffect(() => {
    let isMounted = true;
    fetch(`${apiBase}/cms/sections`)
      .then(res => res.json())
      .then(json => {
        if (!isMounted) return;
        const sections = json?.data || json;
        let pb = null;
        if (Array.isArray(sections)) {
          pb = sections.find(s => s.section_key === 'page_banners');
        } else if (sections && typeof sections === 'object') {
          pb = sections.page_banners || null;
        }

        if (pb) {
          const pbContent = pb.content || pb;
          const deptKey = gender === 'women' ? 'womens' : gender === 'men' ? 'mens' : 'kids';
          const currentDept = pbContent[deptKey];
          if (currentDept) {
            setPageBannerData(currentDept);
          }
        }
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, [gender, apiBase]);

  // 1. Fetch categories for this department
  useEffect(() => {
    let isMounted = true;
    setLoadingCats(true);
    fetch(`${apiBase}/categories?gender=${gender}`)
      .then(res => res.json())
      .then(json => {
        if (!isMounted) return;
        if (json && Array.isArray(json.data)) {
          setCategories(json.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingCats(false);
      });

    return () => { isMounted = false; };
  }, [gender, apiBase]);

  // 2. Fetch products if a category is selected
  useEffect(() => {
    if (!selectedCategorySlug) {
      setProducts([]);
      return;
    }
    let isMounted = true;
    setLoadingProds(true);
    fetch(`${apiBase}/products?category=${selectedCategorySlug}&gender=${gender}`)
      .then(res => res.json())
      .then(json => {
        if (!isMounted) return;
        if (json && json.data && Array.isArray(json.data.products)) {
          setProducts(json.data.products);
        } else {
          setProducts([]);
        }
      })
      .catch(() => {
        if (isMounted) setProducts([]);
      })
      .finally(() => {
        if (isMounted) setLoadingProds(false);
      });

    return () => { isMounted = false; };
  }, [selectedCategorySlug, gender, apiBase]);

  // Active Category details if one is selected
  const activeCategory = useMemo(() => {
    if (!selectedCategorySlug) return null;
    return categories.find(c =>
      (c.slug || '').toLowerCase() === selectedCategorySlug.toLowerCase() ||
      (c.name || '').toLowerCase() === selectedCategorySlug.toLowerCase()
    ) || null;
  }, [categories, selectedCategorySlug]);

  // Resolve categories specifically opted for this department
  // 1. Top-level categories explicitly marked for this gender
  // 2. Any subcategory explicitly marked for this gender whose parent is not this gender
  const departmentCategoryCards = useMemo(() => {
    const target = (gender || '').toLowerCase();
    const cards = [];
    const addedIds = new Set();

    // 1. Top-level categories explicitly marked for this gender
    categories
      .filter(c => !c.parent_id && (c.gender || '').toLowerCase() === target)
      .forEach(main => {
        const subcats = categories.filter(sub => sub.parent_id === main.id);
        cards.push({
          ...main,
          badgeGender: target,
          subcategories: subcats
        });
        addedIds.add(main.id);
      });

    // 2. Any category explicitly marked for this gender that is not already under a gender-specific parent
    categories
      .filter(c => (c.gender || '').toLowerCase() === target && !addedIds.has(c.id))
      .forEach(cat => {
        if (cat.parent_id && addedIds.has(cat.parent_id)) {
          return;
        }
        const subcats = categories.filter(sub => sub.parent_id === cat.id);
        cards.push({
          ...cat,
          badgeGender: target,
          subcategories: subcats
        });
        addedIds.add(cat.id);
      });

    return cards;
  }, [categories, gender]);

  // Filter department category cards by search query
  const filteredCategoryCards = useMemo(() => {
    if (!categorySearch.trim()) return departmentCategoryCards;
    const q = categorySearch.toLowerCase().trim();
    return departmentCategoryCards.filter(card => {
      const matchCard = card.name.toLowerCase().includes(q) || (card.slug && card.slug.toLowerCase().includes(q));
      const matchSub = (card.subcategories || []).some(s => s.name.toLowerCase().includes(q) || (s.slug && s.slug.toLowerCase().includes(q)));
      return matchCard || matchSub;
    });
  }, [departmentCategoryCards, categorySearch]);

  // Sort products
  const sortedProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    const list = [...products];
    if (sortBy === 'price_asc') {
      return list.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    }
    if (sortBy === 'price_desc') {
      return list.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    }
    if (sortBy === 'newest') {
      return list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }
    return list;
  }, [products, sortBy]);

  const departmentBasePath = `/${gender === 'women' ? 'womens' : gender === 'men' ? 'mens' : 'kids'}`;

  const handleSelectCategory = (slug) => {
    router.push(`${departmentBasePath}?category=${encodeURIComponent(slug)}`);
  };

  const handleClearCategory = () => {
    router.push(departmentBasePath);
  };

  // Department-specific fallback images
  const departmentDefaultImg = useMemo(() => {
    if (gender === 'kids') {
      return 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80';
    }
    if (gender === 'men') {
      return 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80';
    }
    return 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80';
  }, [gender]);

  const genderThemeColor = useMemo(() => {
    if (gender === 'women') return '#be185d';
    if (gender === 'men') return '#0369a1';
    return '#b45309';
  }, [gender]);

  const activeBannerImage = useMemo(() => {
    if (selectedCategorySlug && (activeCategory?.banner_image || activeCategory?.image)) {
      return activeCategory.banner_image || activeCategory.image;
    }
    const deptImg = typeof pageBannerData === 'object' ? pageBannerData?.image : pageBannerData;
    return deptImg || heroImage;
  }, [selectedCategorySlug, activeCategory, pageBannerData, heroImage]);

  const activeBannerLink = useMemo(() => {
    if (selectedCategorySlug && activeCategory?.banner_link) {
      return activeCategory.banner_link;
    }
    const deptLink = typeof pageBannerData === 'object' ? pageBannerData?.link : '';
    return deptLink || null;
  }, [selectedCategorySlug, activeCategory, pageBannerData]);

  return (
    <div className="categories-page department-page" style={{ paddingBlock: '20px 80px' }}>
      <div className="container">
        {/* AJIO Desktop Breadcrumb */}
        <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: '20px', fontSize: '13px' }}>
          <Link href="/">Home</Link>
          <span className="breadcrumbs-sep" aria-hidden="true">/</span>
          {selectedCategorySlug ? (
            <>
              <Link href={departmentBasePath}>{title}</Link>
              <span className="breadcrumbs-sep" aria-hidden="true">/</span>
              <span className="breadcrumbs-current">{activeCategory?.name || selectedCategorySlug}</span>
            </>
          ) : (
            <span className="breadcrumbs-current">{title}</span>
          )}
        </nav>

        {/* Pure Department / Category Banner: Responsive Dimensions for Desktop & Mobile with Click Redirect */}
        <section
          className="department-pure-banner"
          aria-label="Department Page Banner"
        >
          {activeBannerLink ? (
            <Link href={activeBannerLink} style={{ display: 'block', width: '100%', height: '100%', cursor: 'pointer' }} title="Click to explore banner collection">
              <img
                src={activeBannerImage}
                alt={selectedCategorySlug && activeCategory ? `${activeCategory.name} — ${title}` : title}
                className="department-pure-banner__img"
                loading="eager"
              />
            </Link>
          ) : (
            <img
              src={activeBannerImage}
              alt={selectedCategorySlug && activeCategory ? `${activeCategory.name} — ${title}` : title}
              className="department-pure-banner__img"
              loading="eager"
            />
          )}
        </section>

        {/* =============================================================
            STATE A: CATEGORY SELECTED -> SHOW PRODUCTS VIEW
            ============================================================= */}
        {selectedCategorySlug ? (
          <div className="department-products-view">
            {/* AJIO Desktop Top Toolbar: Back Button, Title, Sibling Pills, Sort */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                padding: '16px 22px',
                background: '#ffffff',
                borderRadius: '12px',
                marginBottom: '26px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleClearCategory}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1.5px solid #111827',
                    background: '#ffffff',
                    color: '#111827',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <span>← All {title} Categories</span>
                </button>
                <div style={{ fontSize: '14px', color: '#4b5563' }}>
                  Category: <strong style={{ color: '#111827', fontSize: '15px' }}>{activeCategory?.name || selectedCategorySlug}</strong>
                  <span style={{ marginLeft: '8px', fontSize: '12.5px', color: '#6b7280' }}>
                    ({sortedProducts.length} {sortedProducts.length === 1 ? 'Product' : 'Products'})
                  </span>
                </div>
              </div>

              {/* Sibling Category Quick Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {departmentCategoryCards.map(cat => {
                    const isSelected = activeCategory?.id === cat.id || activeCategory?.parent_id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectCategory(cat.slug)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: isSelected ? 700 : 500,
                          background: isSelected ? '#111827' : '#f3f4f6',
                          color: isSelected ? '#ffffff' : '#374151',
                          border: isSelected ? '1px solid #111827' : '1px solid #e5e7eb',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>

                {/* Sort Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label htmlFor="dept-sort" style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280' }}>
                    Sort by:
                  </label>
                  <select
                    id="dept-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #d1d5db',
                      background: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: '#111827',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="recommended">Recommended</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="newest">Newest Arrivals</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Products Grid: AJIO Desktop 4 Cards Per Row */}
            {loadingProds ? (
              <div className="shop-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="shop-skeleton-card" style={{ height: '380px', background: '#f5f5f5', borderRadius: '16px' }} />
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '70px 24px',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ fontSize: '42px', marginBottom: '14px' }}>🛍️</div>
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#111827' }}>
                  No products in &ldquo;{activeCategory?.name || selectedCategorySlug}&rdquo; yet
                </h3>
                <p style={{ color: '#6b7280', fontSize: '14px', maxWidth: '440px', margin: '0 auto 22px', lineHeight: 1.5 }}>
                  Products assigned from admin to this category will appear here. Try exploring other categories in our {title}.
                </p>
                <button
                  type="button"
                  className="btn"
                  onClick={handleClearCategory}
                  style={{
                    padding: '11px 26px',
                    background: 'var(--brand-red, #c8102e)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: 'pointer'
                  }}
                >
                  ← Back to All {title} Categories
                </button>
              </div>
            ) : (
              <div className="shop-grid" id="shop-products-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
                {sortedProducts.map((p, idx) => (
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
        ) : (
          /* =============================================================
              STATE B: AJIO DESKTOP & MOBILE DEPARTMENT LANDING PAGE
              ============================================================= */
          <div className="department-categories-hub">
            {/* AJIO STYLE: "BROWSE CATEGORIES" CURATED PROMO CARDS */}
            <section>
              {/* Header with Search and Overview */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  marginBottom: '26px',
                  paddingTop: '6px'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
                    Browse Categories
                  </h3>
                  <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0 }}>
                    Select a category to view the assigned products
                  </p>
                </div>

                {/* Instant Category Search Filter */}
                <div style={{ maxWidth: '320px', width: '100%' }}>
                  <input
                    type="text"
                    placeholder={`Search ${title.toLowerCase()}' collection categories...`}
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: '1.5px solid #dcd7ce',
                      fontSize: '13px',
                      background: '#ffffff',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                    }}
                  />
                </div>
              </div>

              {/* Showcase Grid */}
              {loadingCats ? (
                <div className="ajio-promo-grid">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ height: '420px', background: '#f5f5f5', borderRadius: '14px' }} />
                  ))}
                </div>
              ) : filteredCategoryCards.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e5e7eb' }}>
                  <h3>No {gender} categories found</h3>
                  <p style={{ color: 'var(--muted)', marginTop: '6px' }}>
                    Categories marked as &ldquo;{gender.toUpperCase()}&rdquo; in Admin will automatically appear here.
                  </p>
                </div>
              ) : (
                <div className="ajio-promo-grid">
                  {filteredCategoryCards.map((cat, idx) => {
                    const subcats = cat.subcategories || [];
                    const coverImg = cat.image || departmentDefaultImg;

                    // Curated tagline matching the Ajio screenshot aesthetic
                    const taglines = [
                      'Where Work Meets Wow',
                      'Where Every Piece Tells a Story',
                      'Fashion That Speaks Volumes',
                      'Crafted for Everyday Elegance',
                      'Iconic Styles for Every Journey'
                    ];
                    const taglineText = cat.tagline || taglines[idx % taglines.length];
                    const offers = ['MIN. 40% OFF*', 'MIN. 50% OFF*', 'MIN. 55% OFF*', 'MIN. 60% OFF*'];
                    const offerText = cat.offer_badge || offers[idx % offers.length];

                    return (
                      <div key={cat.id} className="ajio-promo-wrapper">
                        {/* 1. Tall Vertical Promo Card (Exact AJIO Screenshot Match) */}
                        <div
                          className="ajio-promo-card"
                          onClick={() => handleSelectCategory(cat.slug)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSelectCategory(cat.slug); }}
                          title={`Explore ${cat.name}`}
                        >
                          <img
                            src={coverImg}
                            alt={cat.name}
                            className="ajio-promo-card__bg"
                            loading="lazy"
                          />
                          <div className="ajio-promo-card__gradient" />

                          <div className="ajio-promo-card__badge-top">
                            {gender.toUpperCase()}
                          </div>

                          <div className="ajio-promo-card__content">
                            <span className="ajio-promo-card__tagline">{taglineText}</span>
                            <h3 className="ajio-promo-card__title">{cat.name}</h3>
                            <span className="ajio-promo-card__offer">{offerText}</span>
                          </div>
                        </div>

                        {/* 2. Subcategories Displayed Under Main Category (Only when subcategories exist) */}
                        {subcats.length > 0 && (
                          <div className="ajio-subcategories-block">
                            <div className="ajio-subcategories-label">
                              <span>SUBCATEGORIES:</span>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                {subcats.length} {subcats.length === 1 ? 'type' : 'types'}
                              </span>
                            </div>
                            <div className="ajio-subcategories-chips">
                              {subcats.map(sub => (
                                <button
                                  key={sub.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectCategory(sub.slug);
                                  }}
                                  className="ajio-subcat-chip"
                                  title={`View ${sub.name}`}
                                >
                                  <span>{sub.name}</span>
                                  {sub.product_count > 0 && (
                                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>({sub.product_count})</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

export function DepartmentHub(props) {
  return (
    <Suspense
      fallback={
        <div className="categories-page" style={{ paddingBlock: '40px' }}>
          <div className="container">
            <div style={{ height: '260px', background: '#f5f5f5', borderRadius: '16px', marginBottom: '32px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
              <div style={{ height: '320px', background: '#f5f5f5', borderRadius: '16px' }} />
              <div style={{ height: '320px', background: '#f5f5f5', borderRadius: '16px' }} />
              <div style={{ height: '320px', background: '#f5f5f5', borderRadius: '16px' }} />
              <div style={{ height: '320px', background: '#f5f5f5', borderRadius: '16px' }} />
            </div>
          </div>
        </div>
      }
    >
      <DepartmentHubContent {...props} />
    </Suspense>
  );
}
