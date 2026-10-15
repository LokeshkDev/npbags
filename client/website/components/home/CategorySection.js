import React from 'react';
import Link from 'next/link';

export function CategorySection({ data }) {
  const cards = (data && data.cards && data.cards.length)
    ? data.cards
    : [
        { name: 'Everyday bags', image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=85', link: '/shop?category=Everyday+essentials' },
        { name: 'Work & travel', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=85', link: '/shop?category=Work+%26+travel' },
        { name: 'Weekend edit', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=85', link: '/shop?category=Travel+edit' },
        { name: 'New season', image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=85', link: '/shop?filter=new' }
      ];

  if (data && data.is_visible === false) return null;

  return (
    <section className="section reveal-on-scroll is-revealed" id="categories">
      <div className="container">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{data?.eyebrow || 'Find your favourite'}</div>
            <h2>{data?.heading || 'Shop by collection'}</h2>
          </div>
          <Link className="text-link" href="/categories">
            {data?.ctaText || 'Explore all'} <span>→</span>
          </Link>
        </div>

        <div className="category-grid">
          {cards.map((cat, idx) => (
            <Link className="category-card stagger-item is-revealed" href={cat.link} key={idx}>
              <img src={cat.image} alt={cat.name} loading="lazy" />
              <span className="category-card__label">
                <strong>{cat.name}</strong>
                <span aria-hidden="true">↗</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

