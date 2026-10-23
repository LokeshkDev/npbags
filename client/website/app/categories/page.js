'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from '../../lib/demo-data';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    Promise.all([
      fetch(`${apiBase}/categories`).then(r => r.json()).catch(() => null),
      fetch(`${apiBase}/products`).then(r => r.json()).catch(() => null)
    ]).then(([catsData, prodsData]) => {
      if (catsData && Array.isArray(catsData.data) && catsData.data.length > 0) {
        setCategories(catsData.data);
      }
      if (prodsData && prodsData.data && Array.isArray(prodsData.data.products)) {
        setProducts(prodsData.data.products);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }, []);

  // Compute live product counts per category and subcategory
  const categoryCounts = useMemo(() => {
    const counts = {};
    products.forEach(p => {
      const cId = p.category_id;
      const cName = (p.category_name || p.cat || '').toLowerCase();
      const cSlug = (p.category_slug || '').toLowerCase();
      const parentName = (p.parent_category_name || '').toLowerCase();
      const parentSlug = (p.parent_category_slug || '').toLowerCase();

      if (cId) counts[cId] = (counts[cId] || 0) + 1;
      if (cName) counts[cName] = (counts[cName] || 0) + 1;
      if (cSlug) counts[cSlug] = (counts[cSlug] || 0) + 1;
      if (parentName) counts[parentName] = (counts[parentName] || 0) + 1;
      if (parentSlug) counts[parentSlug] = (counts[parentSlug] || 0) + 1;
    });
    return counts;
  }, [products]);

  // Main parent categories
  const parentCategories = useMemo(() => {
    return categories.filter(c => !c.parent_id);
  }, [categories]);

  // Subcategories mapping
  const subCategoriesMap = useMemo(() => {
    const map = {};
    categories.forEach(c => {
      if (c.parent_id) {
        if (!map[c.parent_id]) map[c.parent_id] = [];
        map[c.parent_id].push(c);
      }
    });
    return map;
  }, [categories]);

  // Filtered categories
  const displayedCategories = useMemo(() => {
    if (activeFilter === 'all') return parentCategories;
    return parentCategories.filter(c => c.slug === activeFilter || c.id.toString() === activeFilter);
  }, [parentCategories, activeFilter]);

  const totalSubcategoriesCount = categories.filter(c => c.parent_id).length;

  return (
    <div className="categories-page">
      <div className="container">
        {/* Breadcrumb Navigation */}
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="breadcrumbs-sep" aria-hidden="true">/</span>
          <span className="breadcrumbs-current">Shop by Category</span>
        </nav>

        {/* Hero Section */}
        <section className="categories-hero" aria-label="Categories Directory">
          <img
            className="categories-hero__bg"
            src="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=85"
            alt="Handcrafted leather bags and everyday essentials"
            loading="eager"
          />
          <div className="categories-hero__overlay" />
          <div className="categories-hero__content">
            <div className="categories-hero__eyebrow">
              <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }} />
              Directory & Capsules
            </div>
            <h1 className="categories-hero__title">
              Shop by Category.<br /><em>Considered Design.</em>
            </h1>
            <p className="categories-hero__desc">
              Discover dedicated silhouettes, travel capsules, and specialized sub-collections crafted with heavyweight organic canvas and full-grain leather.
            </p>
            <div className="categories-hero__stats">
              <span className="categories-hero__stat-pill">
                ✦ {parentCategories.length} Main Categories
              </span>
              <span className="categories-hero__stat-pill">
                ↳ {totalSubcategoriesCount} Sub-Collections
              </span>
              <span className="categories-hero__stat-pill">
                ✓ {products.length} Handcrafted Pieces
              </span>
            </div>
          </div>
        </section>

        {/* Quick Jump / Capsule Shortcuts */}
        <div className="quick-edits-strip" aria-label="Quick capsule highlights">
          <Link href="/shop?filter=new" className="quick-edit-card">
            <div className="quick-edit-icon">✳</div>
            <div className="quick-edit-info">
              <strong>New Season Arrivals</strong>
              <span>Latest silhouettes & seasonal colorways</span>
            </div>
          </Link>
          <Link href="/shop?filter=bestseller" className="quick-edit-card">
            <div className="quick-edit-icon">★</div>
            <div className="quick-edit-info">
              <strong>Customer Bestsellers</strong>
              <span>Most-loved daily carry pieces</span>
            </div>
          </Link>
          <Link href="/shop" className="quick-edit-card">
            <div className="quick-edit-icon">↗</div>
            <div className="quick-edit-info">
              <strong>Complete Catalog</strong>
              <span>Browse full inventory ({products.length} products)</span>
            </div>
          </Link>
        </div>

        {/* Interactive Filter Pills */}
        <div className="categories-filter-strip">
          <div className="categories-filter-pills">
            <button
              type="button"
              className={`category-filter-btn ${activeFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All Categories ({parentCategories.length})
            </button>
            {parentCategories.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`category-filter-btn ${activeFilter === cat.slug ? 'is-active' : ''}`}
                onClick={() => setActiveFilter(cat.slug)}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <Link href="/shop" className="text-link" style={{ fontSize: '13px', fontWeight: 600 }}>
            Go straight to shop catalog →
          </Link>
        </div>

        {/* Categories Showcase Grid */}
        <div className="categories-grid">
          {displayedCategories.map((cat, idx) => {
            const subcats = subCategoriesMap[cat.id] || [];
            const count = categoryCounts[cat.id] || categoryCounts[cat.slug.toLowerCase()] || categoryCounts[cat.name.toLowerCase()] || cat.product_count || 0;
            const catImage = cat.image || cat.image_url || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85';

            return (
              <article key={cat.id} className="category-card-creative">
                <Link href={`/shop?category=${cat.slug}`} className="category-card-creative__media" aria-label={`Browse ${cat.name}`}>
                  <img
                    className="category-card-creative__img"
                    src={catImage}
                    alt={cat.name}
                    loading={idx < 2 ? 'eager' : 'lazy'}
                  />
                  <div className="category-card-creative__badges">
                    <span className="category-badge-pill">
                      0{idx + 1} / Collection
                    </span>
                    <span className="category-count-badge">
                      {count} {count === 1 ? 'Product' : 'Products'}
                    </span>
                  </div>
                </Link>

                <div className="category-card-creative__body">
                  <div className="category-card-creative__header">
                    <h2 className="category-card-creative__title">
                      <Link href={`/shop?category=${cat.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        {cat.name}
                      </Link>
                    </h2>
                  </div>

                  <p className="category-card-creative__desc">
                    {cat.description || `High-performance craftsmanship designed for versatile carry and daily resilience.`}
                  </p>

                  {/* Subcategories Block if subcategories exist */}
                  {subcats.length > 0 && (
                    <div className="category-subcats-box">
                      <div className="category-subcats-title">
                        <span>Sub-Categories & Capsules:</span>
                        <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>
                          {subcats.length} {subcats.length === 1 ? 'sub-category' : 'sub-categories'}
                        </span>
                      </div>
                      <div className="category-subcats-grid">
                        {subcats.map(sub => {
                          const subCount = categoryCounts[sub.id] || categoryCounts[sub.slug.toLowerCase()] || categoryCounts[sub.name.toLowerCase()] || sub.product_count || 0;
                          return (
                            <Link
                              key={sub.id}
                              href={`/shop?category=${sub.slug}`}
                              className="subcat-chip"
                              title={`View ${sub.name} products`}
                            >
                              <span>{sub.name}</span>
                              <span className="subcat-count">({subCount})</span>
                              <span className="subcat-arrow" aria-hidden="true">→</span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Primary CTA Action */}
                  <div className="category-card-creative__footer">
                    <Link href={`/shop?category=${cat.slug}`} className="category-btn-explore">
                      <span>Explore all {cat.name}</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      In stock & ready to ship
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Quality Guarantee Strip */}
        <section className="section" style={{ paddingBlock: '32px 0' }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--line)',
            borderRadius: '14px',
            padding: '28px 36px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px'
          }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--brand-green-dark)', fontWeight: 700 }}>
                Everyday Guarantee
              </div>
              <h3 style={{ fontSize: '20px', margin: '4px 0 6px' }}>Need help selecting the right silhouette?</h3>
              <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted)' }}>
                Compare sizes, capacities and materials across all collections.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Link href="/contact" className="btn btn--outline" style={{ fontSize: '13px', padding: '10px 18px' }}>
                Ask an Advisor
              </Link>
              <Link href="/shop" className="btn" style={{ fontSize: '13px', padding: '10px 20px' }}>
                Shop All Collections →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

