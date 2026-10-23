'use client';

import React from 'react';
import Link from 'next/link';

const defaultJewelleryItems = [
  // Row 1
  { name: 'Necklaces', image: '/assets/jewellery/jewel-necklaces.png', link: '/shop?category=Accessories&tag=necklaces' },
  { name: 'Earrings', image: '/assets/jewellery/jewel-earrings.png', link: '/shop?category=Accessories&tag=earrings' },
  { name: 'Bangles', image: '/assets/jewellery/jewel-bangles.png', link: '/shop?category=Accessories&tag=bangles' },
  { name: 'Kadas', image: '/assets/jewellery/jewel-kadas.png', link: '/shop?category=Accessories&tag=kadas' },
  { name: 'Tikkas', image: '/assets/jewellery/jewel-tikkas.png', link: '/shop?category=Accessories&tag=tikkas' },
  { name: 'Ear Chains', image: '/assets/jewellery/jewel-earchains.png', link: '/shop?category=Accessories&tag=earchains' },
  // Row 2
  { name: 'Malas', image: '/assets/jewellery/jewel-malas.png', link: '/shop?category=Accessories&tag=malas' },
  { name: 'Chains', image: '/assets/jewellery/jewel-chains.png', link: '/shop?category=Accessories&tag=chains' },
  { name: 'Nose Pins', image: '/assets/jewellery/jewel-nosepins.png', link: '/shop?category=Accessories&tag=nosepins' },
  { name: 'Payals', image: '/assets/jewellery/jewel-payals.png', link: '/shop?category=Accessories&tag=payals' },
  { name: 'Haath Panjas', image: '/assets/jewellery/jewel-haathpanjas.png', link: '/shop?category=Accessories&tag=haathpanjas' },
  { name: 'Crowns', image: '/assets/jewellery/jewel-crowns.png', link: '/shop?category=Accessories&tag=crowns' }
];

export function JewelleryGallery({ data }) {
  if (data && data.is_visible === false) return null;

  const sectionTitle = data?.title || 'Jewellery Collections';
  const sectionSubtitle = data?.subtitle || 'Timeless pieces for every occasion';
  const viewAllUrl = data?.view_all_url || '/shop?category=Accessories';
  const jewelleryItems = (data?.items && Array.isArray(data.items) && data.items.length > 0)
    ? data.items
    : defaultJewelleryItems;

  // Split into 2 rows for clean dual-row gallery
  const mid = Math.ceil(jewelleryItems.length / 2);
  const row1Items = jewelleryItems.slice(0, mid);
  const row2Items = jewelleryItems.slice(mid);

  return (
    <section className="jewellery-section" aria-label="Jewellery Collections">
      <div className="container-full">
        <div className="jewellery-banner">
          {/* Corner Decorative Organic Shapes */}
          <svg className="jewellery-decor-tl" width="130" height="150" viewBox="0 0 130 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M0 0 H105 C85 45 45 75 70 115 C85 140 40 150 0 150 V0 Z" fill="#4a8b69" opacity="0.95" />
            <path d="M0 0 H75 C55 35 25 65 48 100 C58 120 25 135 0 135 V0 Z" fill="#065935" />
          </svg>

          <svg className="jewellery-decor-bl" width="90" height="120" viewBox="0 0 90 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M0 120 V35 C35 45 70 70 55 100 C48 115 25 120 0 120 Z" fill="#c8102e" />
          </svg>

          <svg className="jewellery-decor-br" width="110" height="110" viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M110 110 C85 90 65 70 45 45" stroke="#4a8b69" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M45 45 C40 30 55 20 65 30 C70 40 55 48 45 45 Z" fill="#528f6f" />
            <path d="M60 58 C50 50 45 35 57 35 C67 35 65 52 60 58 Z" fill="#065935" />
            <path d="M73 72 C60 70 57 55 70 52 C80 50 83 68 73 72 Z" fill="#528f6f" />
            <path d="M85 85 C73 85 71 70 83 68 C93 66 95 82 85 85 Z" fill="#065935" />
            <path d="M97 98 C87 100 83 88 93 84 C101 82 105 95 97 98 Z" fill="#528f6f" />
          </svg>

          {/* Centered Header */}
          <div className="jewellery-header">
            <h2 className="jewellery-title">
              {sectionTitle === 'Jewellery Collections' ? (
                <>
                  <span className="title-green">Jewellery</span>{' '}
                  <span className="title-red">Collections</span>
                </>
              ) : (
                sectionTitle
              )}
            </h2>
            <p className="jewellery-sub">{sectionSubtitle}</p>
            <Link href={viewAllUrl} className="jewellery-view-btn">
              <span>View All</span>
              <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>

          {/* Two-Row Auto Carousel: Row 1 Left-to-Right, Row 2 Right-to-Left */}
          <div className="jewellery-carousel-wrapper">
            {/* Row 1: Left to Right Carousel */}
            <div className="jewellery-carousel-row" role="region" aria-label="Jewellery Row 1">
              <div className="jewellery-carousel-track jewellery-carousel-track--ltr" role="list">
                {row1Items.map((item, idx) => (
                  <Link key={`r1-${idx}`} href={item.link || '/shop'} className="jewellery-item" role="listitem">
                    <div className="jewellery-circle">
                      <img src={item.image} alt={item.name || 'Jewellery'} loading="lazy" />
                    </div>
                    <span className="jewellery-label">{item.name}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Row 2: Right to Left Carousel */}
            <div className="jewellery-carousel-row" role="region" aria-label="Jewellery Row 2">
              <div className="jewellery-carousel-track jewellery-carousel-track--rtl" role="list">
                {row2Items.map((item, idx) => (
                  <Link key={`r2-${idx}`} href={item.link || '/shop'} className="jewellery-item" role="listitem">
                    <div className="jewellery-circle">
                      <img src={item.image} alt={item.name || 'Jewellery'} loading="lazy" />
                    </div>
                    <span className="jewellery-label">{item.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default JewelleryGallery;
