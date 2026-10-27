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

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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

        {/* Pure Department / Category Banner: NO OVERLAY, NO TEXT ON IMAGE, 100% CLEAN & OPTIMIZED */}
        <section
          className="department-pure-banner"
          aria-label="Department Page Banner"
          style={{
            position: 'relative',
            borderRadius: '16px',
            overflow: 'hidden',
            marginBottom: '32px',
            maxHeight: '260px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
          }}
        >
          <img
            src={activeCategory?.banner_image || activeCategory?.image || heroImage}
            alt={selectedCategorySlug && activeCategory ? `${activeCategory.name} — ${title}` : title}
            style={{
              width: '100%',
              height: '100%',
              maxHeight: '260px',
              objectFit: 'cover',
              display: 'block'
            }}
            loading="eager"
          />
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
              STATE B: AJIO DESKTOP DEPARTMENT LANDING PAGE
              ============================================================= */
          <div className="department-categories-hub">
            {/* 1. AJIO STYLE: "SHOP BY CATEGORY" CIRCLES CAROUSEL / ROW */}
            <section style={{ marginBottom: '44px' }}>
              <div style={{ textAlign: 'center', marginBottom: '26px' }}>
                <div style={{ fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', color: genderThemeColor, marginBottom: '4px' }}>
                  CATEGORIES AT A GLANCE
                </div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                  Shop By Category
                </h2>
                <div style={{ width: '42px', height: '3px', background: genderThemeColor, margin: '0 auto', borderRadius: '2px' }} />
              </div>

              {/* Circular Category Bubbles Row */}
              <div
                style={{
                  display: 'flex',
                  gap: '24px',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  padding: '10px 0'
                }}
              >
                {filteredCategoryCards.map(cat => {
                  const coverImg = cat.image || departmentDefaultImg;
                  return (
                    <div
                      key={cat.id}
                      onClick={() => handleSelectCategory(cat.slug)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        cursor: 'pointer',
                        width: '120px',
                        transition: 'transform 0.25s ease'
                      }}
                      onMouseEnter={(e) => {
                        const avatar = e.currentTarget.querySelector('.ajio-cat-avatar');
                        if (avatar) {
                          avatar.style.transform = 'scale(1.08)';
                          avatar.style.borderColor = genderThemeColor;
                          avatar.style.boxShadow = `0 8px 24px ${genderThemeColor}33`;
                        }
                      }}
                      onMouseLeave={(e) => {
                        const avatar = e.currentTarget.querySelector('.ajio-cat-avatar');
                        if (avatar) {
                          avatar.style.transform = 'none';
                          avatar.style.borderColor = '#e2e8f0';
                          avatar.style.boxShadow = '0 4px 14px rgba(0,0,0,0.06)';
                        }
                      }}
                    >
                      <div
                        className="ajio-cat-avatar"
                        style={{
                          width: '104px',
                          height: '104px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '2.5px solid #e2e8f0',
                          background: '#f8fafc',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          marginBottom: '10px'
                        }}
                      >
                        <img
                          src={coverImg}
                          alt={cat.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                        />
                      </div>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 700,
                          color: '#0f172a',
                          textAlign: 'center',
                          lineHeight: 1.3,
                          maxWidth: '110px'
                        }}
                      >
                        {cat.name}
                      </span>
                      {cat.product_count !== undefined && (
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {cat.product_count} {cat.product_count === 1 ? 'item' : 'items'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 2. AJIO STYLE: "CURATED CAPSULES & COLLECTIONS" GRID */}
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
                  paddingTop: '20px',
                  borderTop: '1px solid #f1f5f9'
                }}
              >
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    The Curated Edit ({filteredCategoryCards.length} Categories)
                  </h3>
                  <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    Select any collection to view the assigned products
                  </p>
                </div>

                {/* Instant Category Search Filter */}
                <div style={{ maxWidth: '300px', width: '100%' }}>
                  <input
                    type="text"
                    placeholder={`Filter ${title.toLowerCase()} categories...`}
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 15px',
                      borderRadius: '8px',
                      border: '1.5px solid #dcd7ce',
                      fontSize: '13px',
                      background: '#ffffff'
                    }}
                  />
                </div>
              </div>

              {/* Showcase Grid */}
              {loadingCats ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '28px' }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ height: '340px', background: '#f5f5f5', borderRadius: '16px' }} />
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '28px' }}>
                  {filteredCategoryCards.map(cat => {
                    const subcats = cat.subcategories || [];
                    const coverImg = cat.image || departmentDefaultImg;

                    return (
                      <article
                        key={cat.id}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                          transition: 'transform 0.25s ease, box-shadow 0.25s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.08)';
                          const img = e.currentTarget.querySelector('.ajio-card-img');
                          if (img) img.style.transform = 'scale(1.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'none';
                          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.04)';
                          const img = e.currentTarget.querySelector('.ajio-card-img');
                          if (img) img.style.transform = 'none';
                        }}
                      >
                        {/* Category Cover Media */}
                        <div
                          onClick={() => handleSelectCategory(cat.slug)}
                          style={{
                            position: 'relative',
                            width: '100%',
                            height: '220px',
                            overflow: 'hidden',
                            background: '#f8fafc',
                            cursor: 'pointer'
                          }}
                        >
                          <img
                            src={coverImg}
                            alt={cat.name}
                            className="ajio-card-img"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              transition: 'transform 0.5s ease'
                            }}
                            loading="lazy"
                          />
                          <div
                            style={{
                              position: 'absolute',
                              top: '14px',
                              left: '14px',
                              background: genderThemeColor,
                              color: '#ffffff',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 800,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                            }}
                          >
                            {gender.toUpperCase()}
                          </div>
                          <div
                            style={{
                              position: 'absolute',
                              top: '14px',
                              right: '14px',
                              background: 'rgba(255, 255, 255, 0.95)',
                              color: '#111827',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                            }}
                          >
                            {cat.product_count || 0} Products
                          </div>
                        </div>

                        {/* Category Card Body */}
                        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                          <div style={{ marginBottom: '12px' }}>
                            <h3
                              onClick={() => handleSelectCategory(cat.slug)}
                              style={{
                                fontSize: '20px',
                                fontWeight: 800,
                                color: '#111827',
                                cursor: 'pointer',
                                margin: '0 0 6px 0',
                                letterSpacing: '-0.01em'
                              }}
                            >
                              {cat.name}
                            </h3>
                            {cat.description && (
                              <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: 1.5 }}>
                                {cat.description}
                              </p>
                            )}
                          </div>

                          {/* Subcategories Chips if any */}
                          {subcats.length > 0 && (
                            <div
                              style={{
                                marginTop: 'auto',
                                marginBottom: '16px',
                                paddingTop: '12px',
                                borderTop: '1px solid #f1f5f9'
                              }}
                            >
                              <div style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748b', marginBottom: '8px' }}>
                                Popular Styles:
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {subcats.map(sub => (
                                  <button
                                    key={sub.id}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectCategory(sub.slug);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '5px 10px',
                                      borderRadius: '6px',
                                      background: '#f8fafc',
                                      border: '1px solid #e2e8f0',
                                      fontSize: '12px',
                                      fontWeight: 600,
                                      color: '#334155',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#e2e8f0';
                                      e.currentTarget.style.color = '#0f172a';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#f8fafc';
                                      e.currentTarget.style.color = '#334155';
                                    }}
                                  >
                                    <span>{sub.name}</span>
                                    {sub.product_count > 0 && (
                                      <span style={{ fontSize: '10px', color: '#64748b' }}>({sub.product_count})</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action CTA Button */}
                          <button
                            type="button"
                            onClick={() => handleSelectCategory(cat.slug)}
                            style={{
                              width: '100%',
                              padding: '11px 16px',
                              background: '#111827',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '13.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px',
                              marginTop: subcats.length === 0 ? 'auto' : '0',
                              transition: 'background 0.2s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--brand-red, #c8102e)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#111827'; }}
                          >
                            <span>Explore {cat.name}</span>
                            <span>→</span>
                          </button>
                        </div>
                      </article>
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
