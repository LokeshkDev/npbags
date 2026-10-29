'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCart } from '../../lib/cart-context';
import { useWishlist } from '../../lib/wishlist-context';

const defaultNavItems = [
  {
    label: 'Women',
    url: '/womens',
    sub_items: [
      { label: 'All Women', url: '/womens' },
      { label: 'Handbags', url: '/womens?category=handbags' },
      { label: 'Tote Bags', url: '/womens?category=tote-bags' },
      { label: 'Shoulder Bags', url: '/womens?category=long-shoulder-bags' },
      { label: 'Evening Clutches', url: '/womens?category=clutches-evening-bags' },
      { label: 'Zip Purses', url: '/womens?category=womens-zip-purses' },
      { label: 'Casual Daypacks', url: '/womens?category=womens-casual-daypacks' },
      { label: 'Bag Charms & Scarves', url: '/womens?category=womens-bag-charms' }
    ]
  },
  {
    label: 'Men',
    url: '/mens',
    sub_items: [
      { label: 'All Men', url: '/mens' },
      { label: 'Bifold Wallets', url: '/mens?category=mens-bifold-wallets' },
      { label: 'Slim Cardholders', url: '/mens?category=mens-slim-cardholders' },
      { label: 'Work Backpacks', url: '/mens?category=mens-work-backpacks' },
      { label: 'Leather Belts', url: '/mens?category=mens-leather-belts' }
    ]
  },
  {
    label: 'Kids',
    url: '/kids',
    sub_items: [
      { label: 'All Kids', url: '/kids' },
      { label: 'Coin Pouches', url: '/kids?category=kids-coin-pouches' },
      { label: 'School Backpacks', url: '/kids?category=kids-school-backpacks' },
      { label: 'Cute Keychains', url: '/kids?category=kids-keychains' }
    ]
  },
  {
    label: 'Accessories',
    url: '/shop?category=accessories',
    sub_items: [
      { label: 'All Accessories', url: '/shop?category=accessories' },
      { label: 'Leather Belts', url: '/shop?category=mens-leather-belts' },
      { label: 'Keychains & Charms', url: '/shop?category=keychains' },
      { label: 'Scarves & Charms', url: '/shop?category=womens-bag-charms' }
    ]
  },
  {
    label: 'Bags & Handbags',
    url: '/shop?category=handbags',
    sub_items: [
      { label: 'All Bags', url: '/shop?category=handbags' },
      { label: 'Handbags', url: '/shop?category=handbags' },
      { label: 'Tote Bags', url: '/shop?category=tote-bags' },
      { label: 'Shoulder Bags', url: '/shop?category=long-shoulder-bags' },
      { label: 'Clutches', url: '/shop?category=clutches-evening-bags' },
      { label: 'Backpacks & Travel', url: '/shop?category=backpacks-travel' }
    ]
  },
  {
    label: 'Footwear',
    url: '/shop?category=footwear',
    sub_items: [
      { label: 'All Footwear', url: '/shop?category=footwear' },
      { label: 'Casual Footwear', url: '/shop?category=footwear' },
      { label: 'Sandals & Slides', url: '/shop?category=footwear' }
    ]
  },
  {
    label: 'Water Bottles',
    url: '/shop?category=water-bottles',
    sub_items: [
      { label: 'All Water Bottles', url: '/shop?category=water-bottles' },
      { label: 'Insulated Flasks', url: '/shop?category=water-bottles' },
      { label: 'Stainless Steel', url: '/shop?category=water-bottles' }
    ]
  },
  {
    label: 'Key Chains',
    url: '/shop?category=keychains',
    sub_items: [
      { label: 'All Key Chains', url: '/shop?category=keychains' },
      { label: 'Cute Keychains', url: '/shop?category=kids-keychains' },
      { label: 'Leather Key Rings', url: '/shop?category=keychains' }
    ]
  },
  {
    label: 'Offers',
    url: '/shop?filter=sale',
    sub_items: [
      { label: 'Special Clearance', url: '/shop?filter=sale' },
      { label: 'Under ₹499', url: '/shop?maxPrice=499' },
      { label: 'Under ₹999', url: '/shop?maxPrice=999' }
    ]
  },
  {
    label: 'New Arrivals',
    url: '/shop?filter=new',
    sub_items: [
      { label: 'This Week\'s Drops', url: '/shop?filter=new' },
      { label: 'New in Handbags', url: '/shop?category=handbags&filter=new' },
      { label: 'New in Wallets', url: '/shop?category=wallets-purses&filter=new' }
    ]
  }
];

export function SiteHeader({ categories: initialCategories = [], navigationData = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { count: cartCount, openCart } = useCart();
  const { wishlistCount } = useWishlist();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [expandedMobileItem, setExpandedMobileItem] = useState(null);
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

  // Dynamic CMS navigation items from database (only related data, no static forced Home link)
  const primaryNavItems = (navigationData?.items && Array.isArray(navigationData.items) && navigationData.items.length > 0)
    ? navigationData.items
    : defaultNavItems;

  const brandLogoUrl = navigationData?.logo_url || '/assets/brand-logo.png';
  const searchPlaceholder = navigationData?.search_placeholder || 'Search for bags, jewellery, shoes, water bottles...';

  return (
    <>
      <header className="site-header">
        <div className="container header-row">
          {/* Top Line for Mobile (Flex 3-Item Layout) */}
          <div className="header-top-bar">
            {/* Left: Hamburger Menu Button */}
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

            {/* Center: Brand Logo Lockup */}
            <div className="brand-wrap">
              <Link href="/" className="brand-link" aria-label="NP Grand Shopping Home">
                <img src={brandLogoUrl} alt="NP GRAND SHOPPING" className="brand-logo-img" />
                <span className="brand-title-wrap">
                  <span className="brand-title-grand">GRAND</span>
                  <span className="brand-title-shopping">SHOPPING</span>
                </span>
              </Link>
            </div>

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

          {/* Center / Row 2: Wide Search Bar Pill */}
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
        </div>

        {/* Primary Navigation Strip */}
        <nav className="primary-nav" aria-label="Primary product categories">
          <div className="container primary-nav__inner">
            <ul className="primary-nav__list">
              {primaryNavItems.map((item, idx) => {
                const isActive = item.url === '/' ? pathname === '/' : pathname.startsWith(item.url);
                const hasSub = Array.isArray(item.sub_items) && item.sub_items.length > 0;
                return (
                  <li key={idx} className={`nav-item-wrap ${hasSub ? 'nav-item-has-dropdown' : ''}`}>
                    <Link
                      href={item.url}
                      className={`nav-link ${isActive ? 'is-active' : ''}`}
                    >
                      <span>{item.label}</span>
                      {hasSub && (
                        <svg className="nav-dropdown-chevron" viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      )}
                    </Link>

                    {/* Submenu Dropdown Popover */}
                    {hasSub && (
                      <div className="nav-dropdown-menu" role="menu">
                        <ul className="nav-dropdown-list">
                          {item.sub_items.map((sub, sIdx) => (
                            <li key={sIdx} role="none">
                              <Link href={sub.url} className="nav-dropdown-link" role="menuitem">
                                <span>{sub.label}</span>
                                <span className="nav-dropdown-arrow" aria-hidden="true">&rarr;</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
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
            <img src={brandLogoUrl} alt="NP GRAND SHOPPING" className="brand-logo-img" style={{ height: '38px' }} />
            <span className="brand-title-wrap">
              <span className="brand-title-grand">GRAND</span>
              <span className="brand-title-shopping">SHOPPING</span>
            </span>
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
              const hasSub = Array.isArray(item.sub_items) && item.sub_items.length > 0;
              const isExpanded = expandedMobileItem === idx;

              return (
                <li key={idx} className="mobile-drawer-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Link
                      href={item.url}
                      className={`mobile-drawer-link ${isActive ? 'is-active' : ''}`}
                      onClick={() => setMobileDrawerOpen(false)}
                      style={{ flexGrow: 1 }}
                    >
                      <span>{item.label}</span>
                    </Link>
                    {hasSub ? (
                      <button
                        type="button"
                        aria-label={`Toggle ${item.label} submenu`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMobileItem(isExpanded ? null : idx);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '12px 16px',
                          cursor: 'pointer',
                          color: '#6b7280',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    ) : (
                      <span className="mobile-drawer-arrow" aria-hidden="true">&rarr;</span>
                    )}
                  </div>

                  {/* Mobile Submenu Accordion */}
                  {hasSub && isExpanded && (
                    <ul style={{ listStyle: 'none', padding: '6px 12px 10px 24px', margin: '4px 0 8px', background: '#f8fafc', borderRadius: '8px', borderLeft: '3px solid var(--np-green, #065935)' }}>
                      {item.sub_items.map((sub, sIdx) => (
                        <li key={sIdx} style={{ padding: '7px 0' }}>
                          <Link
                            href={sub.url}
                            onClick={() => setMobileDrawerOpen(false)}
                            style={{ fontSize: '13px', color: '#4b5563', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                          >
                            <span>{sub.label}</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>&rarr;</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mobile-drawer-footer">
          <Link href="/account" className="mobile-drawer-action-btn" onClick={() => setMobileDrawerOpen(false)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span>My Account</span>
          </Link>
          <Link href="/wishlist" className="mobile-drawer-action-btn" onClick={() => setMobileDrawerOpen(false)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <span>Wishlist</span>
          </Link>
        </div>
      </div>
    </>
  );
}

export default SiteHeader;
