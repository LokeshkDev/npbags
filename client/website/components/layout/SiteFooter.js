'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export function SiteFooter({ data }) {
  const [openSections, setOpenSections] = useState({
    explore: false,
    help: false,
    stay: false
  });

  const toggleSection = (key) => {
    setOpenSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand-col">
            <Link href="/" aria-label="NP Grand home">
              <img className="brand-logo" src="/assets/brand-logo.png" alt="NP Grand logo" />
            </Link>
            <p style={{ maxWidth: '270px', marginTop: '18px' }}>
              Everyday essentials, thoughtfully chosen. A little more style for the moments that make up your day.
            </p>
          </div>

          {/* Explore Column Accordion */}
          <div className={`footer-accordion-col ${openSections.explore ? 'is-open' : ''}`}>
            <button
              type="button"
              className="footer-heading-btn"
              aria-expanded={openSections.explore}
              onClick={() => toggleSection('explore')}
            >
              <span>Explore</span>
              <span className="footer-chevron" aria-hidden="true">
                {openSections.explore ? '−' : '+'}
              </span>
            </button>
            <div className="footer-content">
              <div className="footer-links">
                <Link href="/shop">Collections</Link>
                <Link href="/categories">Category directory</Link>
                <Link href="/shop?filter=new">New arrivals</Link>
                <Link href="/about">Our story</Link>
                <Link href="/#benefits">Why us</Link>
                <Link href="/blog">Editorial</Link>
              </div>
            </div>
          </div>

          {/* Help & Support Column Accordion */}
          <div className={`footer-accordion-col ${openSections.help ? 'is-open' : ''}`}>
            <button
              type="button"
              className="footer-heading-btn"
              aria-expanded={openSections.help}
              onClick={() => toggleSection('help')}
            >
              <span>Help & support</span>
              <span className="footer-chevron" aria-hidden="true">
                {openSections.help ? '−' : '+'}
              </span>
            </button>
            <div className="footer-content">
              <div className="footer-links">
                <Link href="/contact">Contact us</Link>
                <Link href="/about">Shipping information</Link>
                <Link href="/about">Returns & exchanges</Link>
                <Link href="/contact">FAQs</Link>
              </div>
            </div>
          </div>

          {/* Stay Connected Column Accordion */}
          <div className={`footer-accordion-col ${openSections.stay ? 'is-open' : ''}`}>
            <button
              type="button"
              className="footer-heading-btn"
              aria-expanded={openSections.stay}
              onClick={() => toggleSection('stay')}
            >
              <span>Stay connected</span>
              <span className="footer-chevron" aria-hidden="true">
                {openSections.stay ? '−' : '+'}
              </span>
            </button>
            <div className="footer-content">
              <p>Follow along for new arrivals, ideas and everyday inspiration.</p>
              <div className="footer-links" style={{ marginTop: '14px' }}>
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">Instagram ↗</a>
                <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">Facebook ↗</a>
              </div>
            </div>
          </div>
        </div>

        <div className="footer-bottom" id="footer">
          <small>© {currentYear} NP Grand. All rights reserved.</small>
          <small>
            Privacy policy &nbsp; · &nbsp; Terms of service &nbsp;
            </small>
        </div>
      </div>
    </footer>
  );
}

