'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useCart } from '../../lib/cart-context';
import { useQuickView } from '../../lib/quickview-context';

function BestsellerCard({ product, rank, isMobile = false }) {
  const { addToCart } = useCart();
  const { openQuickView } = useQuickView();

  const colors = Array.isArray(product.colors) ? product.colors : [];
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);

  const activeImg =
    colors[selectedColorIdx]?.img ||
    colors[selectedColorIdx]?.image_url ||
    product.primary_image ||
    (product.gallery && product.gallery[0]) ||
    (product.images && product.images[0]) ||
    '';

  const priceVal = typeof product.price === 'number' ? product.price : parseFloat(product.price || 0);
  const saleVal = typeof product.sale_price === 'number' ? product.sale_price : parseFloat(product.sale_price || 0);
  const isSale = saleVal > 0 && saleVal < priceVal;
  const discountVal = isSale ? (priceVal - saleVal).toFixed(0) : 0;

  return (
    <article className={`bestseller-compact-card ${isMobile ? 'bestseller-compact-card--mobile' : ''}`}>
      {/* Top Bar: Rank Badge */}
      <div className="bestseller-compact-card__top">
        <span className="bestseller-rank-pill">
          <span className="bestseller-rank-pill__num">#{rank}</span> Bestseller
        </span>
        {product.badge && product.badge.toLowerCase() !== 'bestseller' && (
          <span className="bestseller-aux-badge">{product.badge}</span>
        )}
      </div>

      {/* Image Container with compact height */}
      <div className="bestseller-compact-card__media">
        <Link
          href={`/product/${product.slug || product.id}`}
          className="bestseller-compact-card__img-link"
          aria-label={`View ${product.name}`}
        >
          <img
            src={activeImg}
            alt={product.name}
            loading="lazy"
            className="bestseller-compact-card__img"
          />
        </Link>

        <button
          type="button"
          className="bestseller-compact-card__qv-trigger"
          onClick={() => openQuickView(product)}
          aria-label={`Quick view ${product.name}`}
          title="Quick view"
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Quick View</span>
        </button>
      </div>

      {/* Content Body */}
      <div className="bestseller-compact-card__body">
        {/* Category & Rating */}
        <div className="bestseller-compact-card__meta">
          <span className="bestseller-compact-card__cat">
            {product.category_name || product.cat || 'Curated'}
          </span>
          <div className="bestseller-compact-card__rating">
            <span className="star-icon">★</span>
            <strong>{product.rating || '4.9'}</strong>
            <span className="review-num">({product.review_count || '120'})</span>
          </div>
        </div>

        {/* Product Title */}
        <h3 className="bestseller-compact-card__title">
          <Link href={`/product/${product.slug || product.id}`} title={product.name}>
            {product.name}
          </Link>
        </h3>

        {/* Interactive Color Swatches */}
        {colors.length > 0 && (
          <div className="bestseller-compact-card__swatches" aria-label="Available color variants">
            <div className="bestseller-swatches-list">
              {colors.slice(0, 5).map((c, i) => (
                <button
                  key={i}
                  type="button"
                  className={`bestseller-swatch-dot ${selectedColorIdx === i ? 'is-active' : ''}`}
                  style={{ backgroundColor: c.hex || '#111827' }}
                  title={c.name}
                  aria-label={`Select ${c.name}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedColorIdx(i);
                  }}
                />
              ))}
            </div>
            {colors[selectedColorIdx]?.name && (
              <span className="bestseller-swatch-label">{colors[selectedColorIdx].name}</span>
            )}
          </div>
        )}

        {/* Footer: Price & Add to Bag */}
        <div className="bestseller-compact-card__footer">
          <div className="bestseller-compact-card__pricing">
            <span className="bestseller-price">₹{(isSale ? saleVal : priceVal).toFixed(2)}</span>
            {isSale && (
              <div className="bestseller-sale-group">
                <del className="bestseller-old-price">₹{priceVal.toFixed(2)}</del>
                <span className="bestseller-save-pill">Save ₹{discountVal}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn bestseller-compact-card__btn-add"
            onClick={() =>
              addToCart(product, {
                qty: 1,
                size: 'Standard',
                color: colors[selectedColorIdx]?.name || 'Standard',
                image: activeImg
              })
            }
          >
            Add to Bag +
          </button>
        </div>
      </div>
    </article>
  );
}

export function BestSellingSection({ products = [] }) {
  const desktopTrackRef = useRef(null);
  const mobileTrackRef = useRef(null);
  const [activeMobileIdx, setActiveMobileIdx] = useState(0);

  if (!products || products.length === 0) return null;

  const scrollDesktop = (direction) => {
    if (!desktopTrackRef.current) return;
    const cardWidth = 270;
    const offset = direction === 'next' ? cardWidth * 2 : -cardWidth * 2;
    desktopTrackRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleMobileScroll = () => {
    if (!mobileTrackRef.current) return;
    const scrollLeft = mobileTrackRef.current.scrollLeft;
    const cardWidth = mobileTrackRef.current.clientWidth * 0.86;
    if (cardWidth <= 0) return;
    const index = Math.round(scrollLeft / cardWidth);
    setActiveMobileIdx(Math.min(Math.max(0, index), products.length - 1));
  };

  const scrollToMobileSlide = (idx) => {
    if (!mobileTrackRef.current) return;
    const cardWidth = mobileTrackRef.current.clientWidth * 0.86;
    mobileTrackRef.current.scrollTo({ left: idx * cardWidth, behavior: 'smooth' });
    setActiveMobileIdx(idx);
  };

  return (
    <section className="section best-selling-section reveal-on-scroll is-revealed" id="best-selling">
      <div className="container">
        {/* Section Header */}
        <div className="best-selling-header">
          <div className="best-selling-header__info">
            <div className="best-selling-badge">
              <span className="best-selling-badge__dot" />
              <span>Customer Favorites</span>
            </div>
            <h2 className="best-selling-title">
              Best Selling <em>Silhouettes</em>
            </h2>
            <p className="best-selling-desc">
              Proven everyday essentials with verified customer ratings, tailored for daily motion and effortless function.
            </p>
          </div>

          <div className="best-selling-header__actions">
            {products.length > 4 && (
              <div className="best-selling-controls" aria-label="Bestseller carousel controls">
                <button
                  type="button"
                  className="bestseller-nav-btn"
                  onClick={() => scrollDesktop('prev')}
                  aria-label="Previous bestsellers"
                  title="Previous"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="bestseller-nav-btn"
                  onClick={() => scrollDesktop('next')}
                  aria-label="Next bestsellers"
                  title="Next"
                >
                  ›
                </button>
              </div>
            )}
            <Link href="/shop?filter=bestseller" className="bestseller-view-all">
              View all bestsellers <span>→</span>
            </Link>
          </div>
        </div>

        {/* =========================================================
            DESKTOP VIEW: Compact, screen-fitted 4-column balanced grid
           ========================================================= */}
        <div className="bestseller-desktop-view">
          <div className="bestseller-desktop-track" ref={desktopTrackRef}>
            {products.map((p, idx) => (
              <BestsellerCard key={p.id} product={p} rank={idx + 1} isMobile={false} />
            ))}
          </div>
        </div>

        {/* =========================================================
            MOBILE VIEW: Creative Individual Product Highlight Swipe Deck
           ========================================================= */}
        <div className="bestseller-mobile-view">
          {/* Mobile Highlight Counter & Swipe Header */}
          <div className="bestseller-mobile-status-bar">
            <div className="bestseller-mobile-status-tag">
              <span className="pulse-dot" />
              <span>Highlight #{activeMobileIdx + 1} of {products.length}</span>
            </div>
            <div className="bestseller-mobile-arrows">
              <button
                type="button"
                className="btn-mobile-nav"
                onClick={() => scrollToMobileSlide(Math.max(0, activeMobileIdx - 1))}
                disabled={activeMobileIdx === 0}
                aria-label="Previous product"
              >
                ‹
              </button>
              <button
                type="button"
                className="btn-mobile-nav"
                onClick={() => scrollToMobileSlide(Math.min(products.length - 1, activeMobileIdx + 1))}
                disabled={activeMobileIdx === products.length - 1}
                aria-label="Next product"
              >
                ›
              </button>
            </div>
          </div>

          {/* Swipeable Track of Individual Highlight Cards */}
          <div
            className="bestseller-mobile-track"
            ref={mobileTrackRef}
            onScroll={handleMobileScroll}
          >
            {products.map((p, idx) => (
              <div key={p.id} className="bestseller-mobile-slide">
                <BestsellerCard product={p} rank={idx + 1} isMobile={true} />
              </div>
            ))}
          </div>

          {/* Interactive Mobile Step Dots */}
          <div className="bestseller-mobile-dots" aria-label="Bestseller slide indicators">
            {products.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`bestseller-step-dot ${activeMobileIdx === i ? 'is-active' : ''}`}
                onClick={() => scrollToMobileSlide(i)}
                aria-label={`Go to product ${i + 1}`}
              />
            ))}
          </div>

          {/* Swipe Hint */}
          <div className="bestseller-mobile-hint">
            <span>⇄ Swipe card to highlight next item</span>
          </div>
        </div>
      </div>
    </section>
  );
}
