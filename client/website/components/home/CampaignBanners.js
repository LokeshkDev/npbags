'use client';

import React from 'react';
import Link from 'next/link';

const defaultBanners = [
  {
    id: 'new-arrivals',
    title: 'New Arrivals',
    subtitle: 'Fresh Styles Just for You',
    ctaText: 'Explore Now',
    link: '/shop?filter=new',
    image: '/assets/banners/banner-new-arrivals.png'
  },
  {
    id: 'special-offers',
    title: 'Special Offers',
    subtitle: 'Best Deals on Top Brands',
    ctaText: 'Shop Offers',
    link: '/shop?filter=sale',
    image: '/assets/banners/banner-special-offers.png'
  }
];

export function CampaignBanners({ data }) {
  if (data && data.is_visible === false) return null;

  const banners = (data?.banners && Array.isArray(data.banners) && data.banners.length > 0)
    ? data.banners
    : defaultBanners;

  return (
    <section className="campaign-section" aria-label="Special Campaigns">
      <div className="container campaign-grid">
        {banners.map((banner, idx) => {
          const isGreen = banner.id === 'new-arrivals' || idx === 0;
          const cardThemeClass = isGreen
            ? 'campaign-card--green campaign-card--new-arrivals'
            : 'campaign-card--red campaign-card--special-offers';
          const btnThemeClass = isGreen ? 'campaign-btn--green' : 'campaign-btn--red';
          const defaultCta = isGreen ? 'Explore Now' : 'Shop Offers';

          return (
            <article key={banner.id || idx} className={`campaign-card ${cardThemeClass}`}>
              <img
                src={banner.image || (isGreen ? '/assets/banners/banner-new-arrivals.png' : '/assets/banners/banner-special-offers.png')}
                alt={banner.title}
                className="campaign-card__bg-img"
                loading="lazy"
              />
              <div className="campaign-card__content">
                <h3 className="campaign-card__title" style={{ whiteSpace: 'pre-line' }}>
                  {banner.title}
                </h3>
                <p className="campaign-card__sub">{banner.subtitle}</p>
                <Link href={banner.link || '/shop'} className={`campaign-btn ${btnThemeClass}`}>
                  <span>{banner.ctaText || defaultCta}</span>
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default CampaignBanners;
