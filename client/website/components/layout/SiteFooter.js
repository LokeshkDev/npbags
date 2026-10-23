'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export function SiteFooter({ data }) {
  const [openSections, setOpenSections] = useState({
    categories: false,
    care: false,
    contact: false
  });

  const toggleSection = (key) => {
    setOpenSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const currentYear = new Date().getFullYear();
  const logoUrl = data?.logo_url || '/assets/brand-logo.png';
  const aboutText = data?.about || 'Your one-stop destination for bags, accessories, footwear, water bottles and more for women, men and kids.';
  const contactPhone = data?.phone || '+91 98765 43210';
  const contactEmail = data?.email || 'support@npgrandshopping.com';
  const workingHours = data?.hours || 'Mon - Sat, 9:00 AM - 6:00 PM';
  const contactAddress = data?.address || 'Ambattur, Chennai - 600053, Tamil Nadu, India';

  return (
    <footer className="site-footer" id="footer" aria-label="Footer">
      <div className="container">
        <div className="footer-grid">
          {/* Col 1: Brand Info & Socials */}
          <div className="footer-brand">
            <Link href="/" aria-label="NP Grand Shopping Home">
              <img src={logoUrl} alt="NP GRAND SHOPPING" className="footer-logo" />
            </Link>
            <p className="footer-about">
              {aboutText}
            </p>
            <div className="footer-socials" aria-label="Social media">
              {/* Facebook */}
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="social-btn" aria-label="Facebook">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              {/* Instagram */}
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="social-btn" aria-label="Instagram">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689-.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              {/* YouTube */}
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="social-btn" aria-label="YouTube">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              {/* Pinterest */}
              <a href="https://pinterest.com" target="_blank" rel="noopener noreferrer" className="social-btn" aria-label="Pinterest">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
                </svg>
              </a>
              {/* WhatsApp */}
              <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" className="social-btn" aria-label="WhatsApp">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Col 2: Shop by Category */}
          <div className="footer-col footer-col--accordion">
            <button
              type="button"
              className={`footer-accordion-btn ${openSections.categories ? 'is-open' : ''}`}
              onClick={() => toggleSection('categories')}
              aria-expanded={openSections.categories}
            >
              <h4 className="footer-heading">Shop by Category</h4>
              <span className="footer-accordion-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            <div className={`footer-accordion-content ${openSections.categories ? 'is-open' : ''}`}>
              <ul className="footer-links">
                <li><Link href="/shop?category=Womens">Women</Link></li>
                <li><Link href="/shop?category=Mens">Men</Link></li>
                <li><Link href="/shop?category=Kids">Kids</Link></li>
                <li><Link href="/shop?category=Accessories">Accessories</Link></li>
                <li><Link href="/shop?category=Everyday+essentials">Bags &amp; Handbags</Link></li>
                <li><Link href="/shop?category=Footwear">Footwear</Link></li>
                <li><Link href="/shop?category=Water+Bottles">Water Bottles</Link></li>
                <li><Link href="/shop?category=Key+Chains">Key Chains</Link></li>
                <li><Link href="/shop?filter=sale">Offers</Link></li>
                <li><Link href="/shop?filter=new">New Arrivals</Link></li>
              </ul>
            </div>
          </div>

          {/* Col 3: Customer Care */}
          <div className="footer-col footer-col--accordion">
            <button
              type="button"
              className={`footer-accordion-btn ${openSections.care ? 'is-open' : ''}`}
              onClick={() => toggleSection('care')}
              aria-expanded={openSections.care}
            >
              <h4 className="footer-heading">Customer Care</h4>
              <span className="footer-accordion-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            <div className={`footer-accordion-content ${openSections.care ? 'is-open' : ''}`}>
              <ul className="footer-links">
                <li><Link href="/account">Track Order</Link></li>
                <li><Link href="/account">My Account</Link></li>
                <li><Link href="/wishlist">Wishlist</Link></li>
                <li><Link href="/contact">Shipping &amp; Delivery</Link></li>
                <li><Link href="/contact">Returns &amp; Refunds</Link></li>
                <li><Link href="/contact">FAQs</Link></li>
                <li><Link href="/contact">Terms &amp; Conditions</Link></li>
                <li><Link href="/contact">Privacy Policy</Link></li>
                <li><Link href="/contact">Contact Us</Link></li>
              </ul>
            </div>
          </div>

          {/* Col 4: Get in Touch */}
          <div className="footer-col footer-col--accordion">
            <button
              type="button"
              className={`footer-accordion-btn ${openSections.contact ? 'is-open' : ''}`}
              onClick={() => toggleSection('contact')}
              aria-expanded={openSections.contact}
            >
              <h4 className="footer-heading">Get in Touch</h4>
              <span className="footer-accordion-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            <div className={`footer-accordion-content ${openSections.contact ? 'is-open' : ''}`}>
              <div className="contact-entry">
                <span className="contact-lbl">Phone:</span>
                <span className="contact-val">{contactPhone}</span>
              </div>
              <div className="contact-entry">
                <span className="contact-lbl">Email:</span>
                <span className="contact-val">{contactEmail}</span>
              </div>
              <div className="contact-entry">
                <span className="contact-lbl">Working Hours:</span>
                <span className="contact-val">{workingHours}</span>
              </div>
              <div className="contact-entry">
                <span className="contact-lbl">Address:</span>
                <span className="contact-val">{contactAddress}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="footer-bottom">
          <p className="footer-copyright">© {currentYear} NP Grand Shopping. All Rights Reserved.</p>
          <div className="footer-payments" aria-label="Accepted payments">
            <span className="pay-badge">VISA</span>
            <span className="pay-badge">Mastercard</span>
            <span className="pay-badge">RuPay</span>
            <span className="pay-badge">UPI</span>
            <span className="pay-badge">Paytm</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
