'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Icon } from '../common/Icons';

export function HeroBanner({ data }) {
  const slides = (data && data.slides && data.slides.length)
    ? data.slides
    : [
        {
          eyebrow: 'Made for your everyday',
          title: 'Your everyday.<br><em>Elevated.</em>',
          text: 'Thoughtfully chosen essentials that bring a little more style, comfort and confidence to every day.',
          image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1800&q=85',
          ctaPrimary: { text: 'Shop the collection', link: '/shop' },
          ctaSecondary: { text: 'Discover our story', link: '#story' },
          note: 'Considered design. Everyday quality.'
        },
        {
          eyebrow: 'New Season Arrival',
          title: 'Crafted for motion.<br><em>Built for living.</em>',
          text: 'Lightweight, versatile silhouettes tailored for seamless transit between workdays and weekends.',
          image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=85',
          ctaPrimary: { text: 'Explore New Arrivals', link: '/shop?filter=new' },
          ctaSecondary: { text: 'Browse Collections', link: '/shop' },
          note: '100% Sustainable finishes. Water-resistant.'
        },
        {
          eyebrow: 'Curated Travel Edit',
          title: 'The Weekend<br><em>Getaway Capsule.</em>',
          text: 'Spacious compartments, durable brass hardware, and minimalist luxury that travels effortlessly with you.',
          image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1800&q=85',
          ctaPrimary: { text: 'Shop Travel Edit', link: '/shop?category=Travel+edit' },
          ctaSecondary: { text: 'Why Shop With Us', link: '#benefits' },
          note: 'Complimentary shipping on orders over ₹499.'
        }
      ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef(0);

  const nextSlide = () => {
    setCurrentIndex(prev => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentIndex(prev => (prev - 1 + slides.length) % slides.length);
  };

  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const timer = setInterval(nextSlide, 5200);
    return () => clearInterval(timer);
  }, [isPaused, slides.length]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - endX;
    if (diff > 45) {
      nextSlide();
    } else if (diff < -45) {
      prevSlide();
    }
    setIsPaused(false);
  };

  return (
    <section
      className="hero hero--carousel"
      aria-label="Featured Highlights"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="hero__track">
        {slides.map((s, idx) => {
          const isActive = idx === currentIndex;

          // Normalize fields between Admin CMS schema and theme demo schema
          const eyebrow = s.eyebrow || s.kicker || '';
          const title = s.title || s.heading || '';
          const text = s.text || s.lead || '';
          const primaryText = s.ctaPrimary?.text || s.primaryText || '';
          const primaryLink = s.ctaPrimary?.link || s.primaryUrl || s.target_link || s.link || s.link_url || '';
          const secondaryText = s.ctaSecondary?.text || s.secondaryText || '';
          const secondaryLink = s.ctaSecondary?.link || s.secondaryUrl || '';
          const note = s.note || '';

          // If no title, description, or action buttons are provided:
          // Display the pure original image with NO color overlay and wrap in target link if available
          const isPureImageBanner = !title.trim() && !text.trim() && !primaryText.trim() && !secondaryText.trim() && !eyebrow.trim();
          const targetUrl = primaryLink || '/shop';

          return (
            <div
              key={idx}
              className={`hero__slide ${isActive ? 'is-active' : ''}`}
              aria-hidden={!isActive}
            >
              {isPureImageBanner ? (
                /* Pure clean image banner with target link and no color overlay */
                <Link
                  href={targetUrl}
                  className="hero__media"
                  style={{ display: 'block', width: '100%', height: '100%', textDecoration: 'none' }}
                  aria-label="Promotional banner link"
                >
                  <img
                    src={s.image}
                    alt={title || eyebrow || 'Hero banner'}
                    loading={idx === 0 ? 'eager' : 'lazy'}
                  />
                </Link>
              ) : (
                /* Standard rich carousel banner with theme typography & overlay */
                <>
                  <div className="hero__media">
                    <img
                      src={s.image}
                      alt={eyebrow || title}
                      loading={idx === 0 ? 'eager' : 'lazy'}
                    />
                  </div>
                  <div className="hero__overlay" />
                  <div className="hero__content">
                    <div className={`hero__copy ${isActive ? 'hero__copy--flow' : ''}`}>
                      {eyebrow && <div className="eyebrow hero__anim hero__anim--1">{eyebrow}</div>}
                      {title && (
                        <h1
                          className="hero__anim hero__anim--2"
                          dangerouslySetInnerHTML={{ __html: title }}
                        />
                      )}
                      {text && <p className="hero__anim hero__anim--3">{text}</p>}
                      {(primaryText || secondaryText) && (
                        <div className="hero__actions hero__anim hero__anim--4">
                          {primaryText && (
                            <Link className="btn" href={primaryLink || '/shop'}>
                              {primaryText} <span aria-hidden="true">→</span>
                            </Link>
                          )}
                          {secondaryText && (
                            <Link className="btn btn--outline" href={secondaryLink || '#story'}>
                              {secondaryText}
                            </Link>
                          )}
                        </div>
                      )}
                      {note && (
                        <div className="hero__note hero__anim hero__anim--5">
                          <span className="hero__note-dot" /> {note}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            className="hero__control hero__control--prev"
            aria-label="Previous slide"
            onClick={prevSlide}
          >
            <Icon name="chevronLeft" size={20} />
          </button>

          <button
            type="button"
            className="hero__control hero__control--next"
            aria-label="Next slide"
            onClick={nextSlide}
          >
            <Icon name="chevronRight" size={20} />
          </button>

          <div className="hero__dots" role="tablist" aria-label="Slide indicators">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`hero__dot ${idx === currentIndex ? 'is-active' : ''}`}
                role="tab"
                aria-selected={idx === currentIndex}
                aria-label={`Slide ${idx + 1}`}
                onClick={() => setCurrentIndex(idx)}
              >
                <span className="hero__dot-fill" />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="hero__peek-indicator">
        <span>Scroll to explore</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M7 10l5 5 5-5" />
        </svg>
      </div>
    </section>
  );
}
