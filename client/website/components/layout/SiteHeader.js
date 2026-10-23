'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '../../lib/cart-context';
import { useWishlist } from '../../lib/wishlist-context';

const defaultNavItems = [
  { label: 'Home', url: '/' },
  { label: 'Women', url: '/shop?category=Womens' },
  { label: 'Men', url: '/shop?category=Mens' },
  { label: 'Kids', url: '/shop?category=Kids' },
  { label: 'Accessories', url: '/shop?category=Accessories' },
  { label: 'Bags & Handbags', url: '/shop?category=Everyday+essentials' },
  { label: 'Footwear', url: '/shop?category=Footwear' },
  { label: 'Water Bottles', url: '/shop?category=Water+Bottles' },
  { label: 'Key Chains', url: '/shop?category=Key+Chains' },
  { label: 'Offers', url: '/shop?filter=sale' },
  { label: 'New Arrivals', url: '/shop?filter=new' }
];

export function SiteHeader({ categories: initialCategories = [], navigationData = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { count: cartCount, openCart } = useCart();
  const { wishlistCount } = useWishlist();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close drawers on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const primaryNavItems = (navigationData?.items && Array.isArray(navigationData.items) && navigationData.items.length > 0)
    ? navigationData.items
    : defaultNavItems;

  const brandLogoUrl = navigationData?.logo_url || '/assets/brand-logo.png';
  const searchPlaceholder = navigationData?.search_placeholder || 'Search for bags, jewellery, shoes, water bottles...';

  return (
    <>
      <header className="site-header">
        <div className="container header-row">
          {/* Left: Brand Logo */}
          <div className="brand-wrap">
            <button
              type="button"
              className="mobile-menu-btn"
              aria-label="Open mobile navigation"
              onClick={() => setMobileDrawerOpen(prev => !prev)}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            <Link href="/" className="brand-link" aria-label="NP Grand Shopping Home">
              <img src={brandLogoUrl} alt="NP GRAND SHOPPING" className="brand-logo-img" />
            </Link>
          </div>

          {/* Center: Wide Search Bar Pill */}
          <form className="header-search" role="search" onSubmit={handleSearchSubmit}>
            <div className="header-search__box">
              <span className="header-search__icon-left" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="search"
                className="header-search__input"
                placeholder={searchPlaceholder}
                aria-label="Search catalog"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="header-search__submit" aria-label="Search">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                  <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                </svg>
              </button>
            </div>
          </form>

          {/* Right: Action Utilities */}
          <div className="header-utilities">
            <Link href="/account" className="header-util-btn" title="My Account">
              <div className="header-util-icon-wrap">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <span className="header-util-label">My Account</span>
            </Link>

            <Link href="/wishlist" className="header-util-btn" title="Wishlist">
              <div className="header-util-icon-wrap">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {mounted && wishlistCount > 0 && (
                  <span className="cart-count-badge" suppressHydrationWarning>{wishlistCount}</span>
                )}
              </div>
              <span className="header-util-label">Wishlist</span>
            </Link>

            <button
              type="button"
              className="header-util-btn"
              title="Cart"
              onClick={openCart}
              style={{ background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <div className="header-util-icon-wrap">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
                <span className="cart-count-badge" suppressHydrationWarning>{mounted ? (cartCount || 0) : 0}</span>
              </div>
              <span className="header-util-label">Cart</span>
            </button>
          </div>
        </div>

        {/* Primary Navigation Strip */}
        <nav className="primary-nav" aria-label="Primary product categories">
          <div className="container primary-nav__inner">
            <ul className="primary-nav__list">
              {primaryNavItems.map((item, idx) => {
                const isActive = item.url === '/' ? pathname === '/' : pathname.startsWith(item.url);
                return (
                  <li key={idx}>
                    <Link
                      href={item.url}
                      className={`nav-link ${isActive ? 'is-active' : ''}`}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      </header>

      {/* Mobile Side Popover Drawer */}
      <div
        className={`mobile-side-backdrop ${mobileDrawerOpen ? 'is-open' : ''}`}
        onClick={() => setMobileDrawerOpen(false)}
      />
      <div className={`mobile-side-drawer ${mobileDrawerOpen ? 'is-open' : ''}`} aria-hidden={!mobileDrawerOpen}>
        <div className="mobile-drawer-header">
          <Link href="/" className="mobile-drawer-brand" onClick={() => setMobileDrawerOpen(false)}>
            <img src="/assets/brand-logo.png" alt="NP GRAND SHOPPING" className="brand-logo-img" style={{ height: '42px' }} />
          </Link>
          <button
            type="button"
            className="mobile-drawer-close"
            aria-label="Close menu"
            onClick={() => setMobileDrawerOpen(false)}
          >
            ✕
          </button>
        </div>

        <nav className="mobile-drawer-nav">
          <ul className="mobile-drawer-list">
            {primaryNavItems.map((item, idx) => {
              const isActive = item.url === '/' ? pathname === '/' : pathname.startsWith(item.url);
              return (
                <li key={idx}>
                  <Link
                    href={item.url}
                    className={`mobile-drawer-link ${isActive ? 'is-active' : ''}`}
                    onClick={() => setMobileDrawerOpen(false)}
                  >
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}

export default SiteHeader;
