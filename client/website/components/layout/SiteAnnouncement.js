'use client';

import React from 'react';
import Link from 'next/link';

export function SiteAnnouncement({ data }) {
  if (data && data.is_active === false) return null;

  const shippingText = data?.shipping_text || 'Free Shipping on Orders Above ₹999';

  return (
    <aside className="site-announcement" aria-label="Announcement and services">
      <div className="container site-announcement__inner">
        {/* Left Highlights */}
        <div className="site-announcement__left">
          <span className="announcement-item">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 3h15v13H1z" />
              <path d="M16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            <span>{shippingText}</span>
          </span>

          <span className="announcement-pipe">|</span>

          <span className="announcement-item">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            <span>Easy Returns</span>
          </span>

          <span className="announcement-pipe">|</span>

          <span className="announcement-item">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span>Secure Payments</span>
          </span>
        </div>

        {/* Right Quick Support */}
        <div className="site-announcement__right">
          <Link href="/account" className="announcement-link">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Track Order</span>
          </Link>

          <span className="announcement-pipe">|</span>

          <Link href="/contact" className="announcement-link">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
            <span>Help & Support</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}

export default SiteAnnouncement;
