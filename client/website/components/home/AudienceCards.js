'use client';

import React from 'react';
import Link from 'next/link';

const defaultCards = [
  {
    id: 'women',
    tag: 'CURATED FOR HER',
    title: 'For Women',
    sub: 'Bags, Jewellery & Everyday Accessories',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85',
    btnClass: 'audience-btn--red',
    btnText: 'Shop Women',
    link: '/shop?category=Womens'
  },
  {
    id: 'men',
    tag: 'CURATED FOR HIM',
    title: 'For Men',
    sub: 'Stylish Footwear, Bags & Accessories',
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=85',
    btnClass: 'audience-btn--green',
    btnText: 'Shop Men',
    link: '/shop?category=Mens'
  },
  {
    id: 'kids',
    tag: 'CURATED FOR LITTLE ONES',
    title: 'For Kids',
    sub: 'Fun Accessories, Bottles & Playful Essentials',
    image: 'https://images.unsplash.com/photo-1519457431-44ccd64a579b?auto=format&fit=crop&w=900&q=85',
    btnClass: 'audience-btn--red',
    btnText: 'Shop Kids',
    link: '/shop?category=Kids'
  }
];

export function AudienceCards({ data }) {
  if (data && data.is_visible === false) return null;

  const cards = (data?.cards && Array.isArray(data.cards) && data.cards.length > 0)
    ? data.cards
    : defaultCards;

  return (
    <section className="audience-section" aria-label="Collections by Audience">
      <div className="container audience-grid">
        {cards.map((card) => (
          <article key={card.id} className={`audience-card audience-card--${card.id}`}>
            <img
              src={card.image}
              alt={`${card.title} Fashion`}
              className="audience-card__bg-img"
              loading="lazy"
            />
            <div className="audience-card__content">
              <span className="audience-card__tag">{card.tag}</span>
              <h2 className="audience-card__title">{card.title}</h2>
              <p className="audience-card__sub">{card.sub}</p>
              <Link href={card.link} className={`audience-btn ${card.btnClass}`}>
                <span>{card.btnText}</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default AudienceCards;
