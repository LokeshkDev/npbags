'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

const DEFAULT_HERO_IMAGE = '/assets/banners/hero-banner.svg';

export function HeroBanner({ data }) {
  if (data && data.is_visible === false) return null;

  // Extract up to 3 slides from CMS data
  const rawSlides = Array.isArray(data?.content?.slides) && data.content.slides.length > 0
    ? data.content.slides
    : Array.isArray(data?.slides) && data.slides.length > 0
      ? data.slides
      : null;

  const slides = rawSlides
    ? rawSlides.filter((s) => Boolean(s && (s.image || s.banner_image))).slice(0, 3)
    : [];

  // Fallback to single banner_image if no slides array
  const finalSlides = slides.length > 0
    ? slides.map((s, idx) => ({
        id: s.id || idx,
        image: s.image || s.banner_image,
        link: s.link || s.button_url || '/shop',
        title: s.title || `NP Grand Banner ${idx + 1}`
      }))
    : [
        {
          id: 1,
          image: data?.content?.banner_image || data?.banner_image || DEFAULT_HERO_IMAGE,
          link: data?.content?.button_url || data?.button_url || '/shop',
          title: 'NP Grand Shopping — Banner'
        }
      ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  // Drag state refs
  const dragStartXRef = useRef(0);
  const dragDeltaXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const wasDraggedRef = useRef(false);

  const totalSlides = finalSlides.length;

  // Auto-play timer for multi-slide carousel
  useEffect(() => {
    if (totalSlides <= 1 || isPaused) return;

    timerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [totalSlides, isPaused]);

  const goToSlide = (idx) => {
    setCurrentIndex(idx);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  };

  // Drag handlers for mouse (Desktop) and touch (Mobile / Tablet)
  const handleMouseDown = (e) => {
    if (totalSlides <= 1) return;
    isDraggingRef.current = true;
    wasDraggedRef.current = false;
    dragStartXRef.current = e.pageX;
    dragDeltaXRef.current = 0;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    dragDeltaXRef.current = e.pageX - dragStartXRef.current;
    if (Math.abs(dragDeltaXRef.current) > 8) {
      wasDraggedRef.current = true;
    }
  };

  const handleMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    if (dragDeltaXRef.current < -35) {
      nextSlide();
    } else if (dragDeltaXRef.current > 35) {
      prevSlide();
    }
    setTimeout(() => {
      wasDraggedRef.current = false;
    }, 50);
  };

  const handleTouchStart = (e) => {
    if (totalSlides <= 1) return;
    dragStartXRef.current = e.touches[0].pageX;
    dragDeltaXRef.current = 0;
    isDraggingRef.current = true;
    wasDraggedRef.current = false;
  };

  const handleTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    dragDeltaXRef.current = e.touches[0].pageX - dragStartXRef.current;
    if (Math.abs(dragDeltaXRef.current) > 8) {
      wasDraggedRef.current = true;
    }
  };

  const handleTouchEnd = () => {
    isDraggingRef.current = false;
    if (dragDeltaXRef.current < -35) {
      nextSlide();
    } else if (dragDeltaXRef.current > 35) {
      prevSlide();
    }
    setTimeout(() => {
      wasDraggedRef.current = false;
    }, 50);
  };

  const handleClickCapture = (e) => {
    if (wasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Single slide (no slider controls)
  if (totalSlides === 1) {
    const single = finalSlides[0];
    return (
      <section className="hero-banner" aria-label="Hero Banner">
        <Link href={single.link} className="hero-banner__link">
          <img
            src={single.image}
            alt={single.title}
            className="hero-banner__img"
          />
        </Link>
      </section>
    );
  }

  // Multi-slide slider (up to 3 slides with drag / swipe)
  return (
    <section
      className="hero-banner hero-slider"
      aria-label="Hero Slider"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        setIsPaused(false);
        isDraggingRef.current = false;
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClickCapture={handleClickCapture}
      onDragStart={(e) => e.preventDefault()}
      style={{ cursor: 'grab', userSelect: 'none' }}
    >
      <div className="hero-slider__track">
        {finalSlides.map((slide, idx) => {
          const isActive = idx === currentIndex;
          return (
            <div
              key={slide.id || idx}
              className={`hero-slider__slide ${isActive ? 'is-active' : ''}`}
              aria-hidden={!isActive}
            >
              <Link href={slide.link} className="hero-banner__link">
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="hero-banner__img"
                  loading={idx === 0 ? 'eager' : 'lazy'}
                />
              </Link>
            </div>
          );
        })}
      </div>

      {/* Pagination Indicator Dots in Theme Green & Red */}
      <div className="hero-slider__dots" role="tablist" aria-label="Hero slider pagination">
        {finalSlides.map((slide, idx) => (
          <button
            key={idx}
            type="button"
            className={`hero-slider__dot ${idx === currentIndex ? 'is-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              goToSlide(idx);
            }}
            aria-label={`Go to slide ${idx + 1}`}
            aria-selected={idx === currentIndex}
          />
        ))}
      </div>
    </section>
  );
}

export default HeroBanner;
