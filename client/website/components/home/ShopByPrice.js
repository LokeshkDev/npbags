'use client';

import React from 'react';
import Link from 'next/link';

const defaultPriceTiers = [
  {
    prefix: 'Under',
    amount: '₹499',
    image: '/assets/price/price-handbag.png',
    alt: 'Under ₹499 Handbag',
    themeClass: 'price-card--blush',
    link: '/shop?max_price=499'
  },
  {
    prefix: '₹500 -',
    amount: '₹999',
    image: '/assets/price/price-wallet.png',
    alt: '₹500 - ₹999 Wallet',
    themeClass: 'price-card--sage',
    link: '/shop?min_price=500&max_price=999'
  },
  {
    prefix: '₹1,000 -',
    amount: '₹1,999',
    image: '/assets/price/price-sneakers.png',
    alt: '₹1,000 - ₹1,999 Sneakers',
    themeClass: 'price-card--peach',
    link: '/shop?min_price=1000&max_price=1999'
  },
  {
    prefix: '₹2,000 -',
    amount: '₹4,999',
    image: '/assets/price/price-watch.png',
    alt: '₹2,000 - ₹4,999 Smart Watch',
    themeClass: 'price-card--blush',
    link: '/shop?min_price=2000&max_price=4999'
  },
  {
    prefix: 'Above',
    amount: '₹5,000',
    image: '/assets/price/price-bottle.png',
    alt: 'Above ₹5,000 Bottle',
    themeClass: 'price-card--sage',
    link: '/shop?min_price=5000'
  }
];

export function ShopByPrice({ data }) {
  if (data && data.is_visible === false) return null;

  const sectionTitle = data?.title || 'Shop by Price';
  const sectionSubtitle = data?.subtitle || 'Great products at every budget';
  const priceTiers = (data?.tiers && Array.isArray(data.tiers) && data.tiers.length > 0)
    ? data.tiers
    : defaultPriceTiers;

  const formatPriceTier = (tier) => {
    const p = (tier.prefix || '').trim();
    const a = (tier.amount || '').trim();
    if (!p) return { kicker: null, main: a };
    if (p.toLowerCase() === 'under' || p.toLowerCase() === 'above') {
      return { kicker: p, main: a };
    }
    const cleanPrefix = p.replace(/-$/, '').trim();
    return { kicker: null, main: `${cleanPrefix} – ${a}` };
  };

  return (
    <section className="price-section" aria-label="Shop by Price">
      <div className="container-full">
        <div className="price-banner price-banner--compact">
          {/* Corner Decorative Organic Shapes */}
          <svg className="price-decor-tl" width="130" height="95" viewBox="0 0 130 95" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M0 0 H105 C85 28 42 45 48 72 C50 82 25 95 0 95 V0 Z" fill="#c8102e" />
          </svg>

          <svg className="price-decor-tr" width="135" height="105" viewBox="0 0 135 105" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M135 0 H35 C58 26 100 48 95 78 C92 92 115 105 135 105 V0 Z" fill="#065935" />
          </svg>

          <svg className="price-decor-br" width="105" height="95" viewBox="0 0 105 95" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M105 95 H20 C42 80 80 58 70 30 C65 15 85 0 105 0 V95 Z" fill="#c8102e" />
          </svg>

          {/* Header */}
          <div className="price-header price-header--compact">
            <h2 className="price-title">
              <span className="title-green">Shop by</span> <span className="title-red">Price</span>
            </h2>
            <p className="price-sub">{sectionSubtitle}</p>
          </div>

          {/* 5 Compact Price Tier Cards - No Images, Premium Typography */}
          <div className="price-grid price-grid--compact" role="list">
            {priceTiers.map((tier, idx) => {
              const { kicker, main } = formatPriceTier(tier);
              return (
                <Link
                  key={idx}
                  href={tier.link || '/shop'}
                  className={`price-card price-card--compact ${tier.themeClass || 'price-card--sage'}`}
                  role="listitem"
                >
                  <div className="price-card__content">
                    {kicker && <span className="price-card__kicker">{kicker}</span>}
                    <span className={`price-card__amount price-card__amount--premium ${kicker ? 'price-card__amount--kicker' : 'price-card__amount--range'}`}>
                      {main}
                    </span>
                  </div>
                  <span className="price-card__btn">Shop Now &rarr;</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ShopByPrice;
