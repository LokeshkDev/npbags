'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';

const defaultCategories = [
  {
    id: 'handbags',
    name: 'Bags & Handbags',
    image: '/assets/categories/cat-handbag.png',
    link: '/shop?category=Everyday+essentials'
  },
  {
    id: 'wallets',
    name: 'Purse & Wallets',
    image: '/assets/categories/cat-wallet.png',
    link: '/shop?category=Accessories'
  },
  {
    id: 'jewellery',
    name: 'Jewellery',
    image: '/assets/categories/cat-earrings.png',
    link: '/shop?category=Accessories'
  },
  {
    id: 'footwear',
    name: 'Footwear',
    image: '/assets/categories/cat-footwear.png',
    link: '/shop?category=Footwear'
  },
  {
    id: 'bottles',
    name: 'Water Bottles',
    image: '/assets/categories/cat-bottle.png',
    link: '/shop?category=Water+Bottles'
  },
  {
    id: 'keychains',
    name: 'Key Chains',
    image: '/assets/categories/cat-keychain.png',
    link: '/shop?category=Key+Chains'
  },
  {
    id: 'gifting',
    name: 'Gifting Ideas',
    image: '/assets/categories/cat-gifting.png',
    link: '/shop?category=Everyday+essentials'
  }
];

export function CategoryShortcuts({ data }) {
  if (data && data.is_visible === false) return null;

  const categories = (data?.items && Array.isArray(data.items) && data.items.length > 0)
    ? data.items
    : defaultCategories;

  const scrollRef = useRef(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const isDraggingRef = useRef(false);

  const displayItems = categories;

  // Desktop Mouse Drag Handlers
  const handleMouseDown = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    isDownRef.current = true;
    isDraggingRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e) => {
    if (!isDownRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.4;
    if (Math.abs(walk) > 4) {
      isDraggingRef.current = true;
    }
    el.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUp = () => {
    isDownRef.current = false;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  // Mobile / Tablet Touch Handlers
  const handleTouchStart = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    isDownRef.current = true;
    isDraggingRef.current = false;
    startXRef.current = e.touches[0].pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleTouchMove = (e) => {
    if (!isDownRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const x = e.touches[0].pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.2;
    if (Math.abs(walk) > 4) {
      isDraggingRef.current = true;
    }
    el.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleTouchEnd = () => {
    isDownRef.current = false;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  const handleClickCapture = (e) => {
    if (isDraggingRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <section className="categories-strip" aria-label="Shop by Category">
      <div className="container" style={{ position: 'relative' }}>
        {/* Carousel Outer Wrapper with Desktop Mouse Drag & Mobile Touch Drag */}
        <div
          className="categories-carousel"
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            isDownRef.current = false;
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClickCapture={handleClickCapture}
          onDragStart={(e) => e.preventDefault()}
          style={{ userSelect: 'none', cursor: 'grab' }}
        >
          <div className="categories-carousel__track" role="list">
            {displayItems.map((cat, idx) => (
              <Link
                key={`${cat.id || idx}-${idx}`}
                href={cat.link || '/shop'}
                className="category-card"
                role="listitem"
              >
                {/* Natural unshaped image without circular framing */}
                <div className="category-card__thumb">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="category-card__img"
                    loading="lazy"
                  />
                </div>
                <span className="category-card__name">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CategoryShortcuts;
