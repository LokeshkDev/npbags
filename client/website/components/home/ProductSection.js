'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ProductCard } from '../product/ProductCard';

export function ProductSection({ data, products = [] }) {
  const trackRef = useRef(null);
  const [activeDot, setActiveDot] = useState(0);

  const displayProducts = products.slice(0, data?.maxProducts || 6);

  const scroll = (direction) => {
    if (!trackRef.current) return;
    const cardWidth = 320;
    const offset = direction === 'next' ? cardWidth * 2 : -cardWidth * 2;
    trackRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!trackRef.current) return;
    const maxScroll = trackRef.current.scrollWidth - trackRef.current.clientWidth;
    if (maxScroll <= 0) return;
    const ratio = trackRef.current.scrollLeft / maxScroll;
    setActiveDot(ratio > 0.4 ? 1 : 0);
  };

  if ((data && data.is_visible === false) || !displayProducts || displayProducts.length === 0) return null;

  return (
    <section className="section reveal-on-scroll is-revealed" id="new-arrivals">
      <div className="container">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{data?.eyebrow || 'Just landed'}</div>
            <h2>{data?.heading || 'New arrivals'}</h2>
            <p style={{ marginTop: '10px' }}>
              {data?.subtitle || 'The latest pieces to make your everyday a little more special.'}
            </p>
          </div>
          <div className="arrivals-actions">
            <div className="arrivals-carousel-controls" aria-label="New arrivals carousel navigation">
              <button
                type="button"
                className="arrivals-nav-btn arrivals-nav-btn--prev"
                onClick={() => scroll('prev')}
                aria-label="Previous products"
                title="Previous"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className="arrivals-nav-btn arrivals-nav-btn--next"
                onClick={() => scroll('next')}
                aria-label="Next products"
                title="Next"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
            <Link className="text-link" href="/shop">
              View all products <span>→</span>
            </Link>
          </div>
        </div>

        <div className="arrivals-carousel-container">
          <div
            className="product-grid arrivals-carousel-track"
            ref={trackRef}
            onScroll={handleScroll}
            style={{ overflowX: 'auto', scrollBehavior: 'smooth' }}
          >
            {displayProducts.map((p, idx) => (
              <ProductCard product={p} index={idx} key={p.id} />
            ))}
          </div>

          <div className="arrivals-carousel-dots" aria-label="Carousel pagination">
            <button
              type="button"
              className={`arrivals-dot ${activeDot === 0 ? 'is-active' : ''}`}
              onClick={() => trackRef.current?.scrollTo({ left: 0, behavior: 'smooth' })}
              aria-label="Slide 1"
            />
            <button
              type="button"
              className={`arrivals-dot ${activeDot === 1 ? 'is-active' : ''}`}
              onClick={() => {
                if (trackRef.current) {
                  trackRef.current.scrollTo({ left: trackRef.current.scrollWidth, behavior: 'smooth' });
                }
              }}
              aria-label="Slide 2"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

