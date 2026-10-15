'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon } from '../common/Icons';
import { useCart } from '../../lib/cart-context';
import { useWishlist } from '../../lib/wishlist-context';

export function SiteHeader({ categories: initialCategories = [], navigationData = null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { count: cartCount, openCart } = useCart();
  const { wishlistCount } = useWishlist();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileAccordionOpen, setMobileAccordionOpen] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState(initialCategories);

  const extractItems = (nav) => {
    if (!nav) return null;
    if (Array.isArray(nav.items) && nav.items.length > 0) return nav.items;
    if (Array.isArray(nav.content?.items) && nav.content.items.length > 0) return nav.content.items;
    return null;
  };

  const [navItems, setNavItems] = useState(() => extractItems(navigationData));

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    fetch(`${apiBase}/categories`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.data)) {
          setCategories(data.data);
        }
      })
      .catch(() => {});

    fetch(`${apiBase}/cms/sections`)
      .then(res => res.json())
      .then(data => {
        const sectionsData = data?.data || data;
        const mainNav = sectionsData?.main_navigation;
        if (mainNav && mainNav.is_visible !== false) {
          const items = extractItems(mainNav);
          if (items && items.length > 0) {
            setNavItems(items);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Close drawers on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // Handle ESC key to close drawers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchOpen(false);
      router.push(`/shop?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const isShop = pathname.startsWith('/shop');

  return (
    <>
      <header className={`site-header ${mobileDrawerOpen ? 'drawer-active' : ''}`}>
        <div className="container header-inner">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            aria-expanded={mobileDrawerOpen}
            onClick={() => setMobileDrawerOpen(prev => !prev)}
          >
            <Icon name="menu" />
          </button>

          <Link href="/" className="brand" aria-label="NP Grand home">
            <img className="brand-logo" src="/assets/brand-logo.png" alt="NP Grand logo" />
          </Link>

          <nav className="nav" aria-label="Main navigation">
            {navItems && navItems.length > 0 ? (
              navItems.map((item, idx) => {
                if (item.has_submenu && Array.isArray(item.subitems) && item.subitems.length > 0) {
                  return (
                    <div key={item.id || idx} className="nav-dropdown">
                      <Link
                        href={item.url || '/shop'}
                        className={`nav-dropdown__trigger ${pathname.startsWith(item.url || '/shop') ? 'is-active' : ''}`}
                        aria-expanded="false"
                        aria-haspopup="true"
                      >
                        <span>{item.label}</span>
                        <Icon name="chevronDown" size={13} className="dropdown-chevron" />
                      </Link>

                      <div className="nav-dropdown__menu" role="menu">
                        <div className="nav-dropdown__inner">
                          <div className="nav-dropdown__col">
                            <span className="nav-dropdown__eyebrow">{item.label}</span>
                            <ul className="nav-dropdown__list">
                              {item.subitems.map((sub, sIdx) => (
                                <li key={sub.id || sIdx}>
                                  <Link href={sub.url} className="nav-dropdown__link">
                                    <span className="nav-dropdown__link-name">{sub.label}</span>
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="nav-dropdown__col nav-dropdown__col--featured">
                            <span className="nav-dropdown__eyebrow">Curated Highlight</span>
                            <Link href="/product/the-everyday-tote" className="nav-dropdown__card">
                              <div className="nav-dropdown__card-media">
                                <img src="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=85" alt="The Everyday Tote" loading="lazy" />
                                <span className="nav-dropdown__card-badge">Bestseller</span>
                              </div>
                              <div className="nav-dropdown__card-info">
                                <div className="nav-dropdown__card-title">The Everyday Tote</div>
                                <div className="nav-dropdown__card-meta">Organic Canvas • 18L Capacity</div>
                                <div className="nav-dropdown__card-footer">
                                  <span className="nav-dropdown__card-price">₹48.00</span>
                                  <span className="nav-dropdown__card-cta">Shop now ↗</span>
                                </div>
                              </div>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.id || idx}
                    href={item.url}
                    className={pathname === item.url ? 'is-active' : ''}
                  >
                    {item.label}
                  </Link>
                );
              })
            ) : (
              <>
                {/* Collections with Dropdown */}
                <div className="nav-dropdown">
                  <Link
                    href="/shop"
                    className={`nav-dropdown__trigger ${isShop ? 'is-active' : ''}`}
                    aria-expanded="false"
                    aria-haspopup="true"
                  >
                    <span>Collections</span>
                    <Icon name="chevronDown" size={13} className="dropdown-chevron" />
                  </Link>

                  <div className="nav-dropdown__menu" role="menu">
                    <div className="nav-dropdown__inner">
                      <div className="nav-dropdown__col">
                        <span className="nav-dropdown__eyebrow">Shop By Category</span>
                        <ul className="nav-dropdown__list">
                          <li>
                            <Link href="/shop" className="nav-dropdown__link">
                              <span className="nav-dropdown__link-name">All Collections</span>
                              <span className="nav-dropdown__badge">Explore</span>
                            </Link>
                          </li>
                          {categories.length > 0 ? (
                            categories.filter(c => !c.parent_id).map(main => {
                              const subs = categories.filter(s => s.parent_id === main.id);
                              return (
                                <React.Fragment key={main.id}>
                                  <li>
                                    <Link href={`/shop?category=${encodeURIComponent(main.slug || main.name)}`} className="nav-dropdown__link">
                                      <span className="nav-dropdown__link-name" style={{ fontWeight: 600 }}>{main.name}</span>
                                      {main.product_count > 0 && <span className="nav-dropdown__count">({main.product_count})</span>}
                                    </Link>
                                  </li>
                                  {subs.map(sub => (
                                    <li key={sub.id} style={{ paddingLeft: '14px' }}>
                                      <Link href={`/shop?category=${encodeURIComponent(sub.slug || sub.name)}`} className="nav-dropdown__link" style={{ fontSize: '12px' }}>
                                        <span className="nav-dropdown__link-name" style={{ color: 'var(--muted)' }}>↳ {sub.name}</span>
                                        {sub.product_count > 0 && <span className="nav-dropdown__count" style={{ fontSize: '11px' }}>({sub.product_count})</span>}
                                      </Link>
                                    </li>
                                  ))}
                                </React.Fragment>
                              );
                            })
                          ) : (
                            <>
                              <li>
                                <Link href="/shop?category=Everyday+essentials" className="nav-dropdown__link">
                                  <span className="nav-dropdown__link-name">Everyday Essentials</span>
                                  <span className="nav-dropdown__count">(2 items)</span>
                                </Link>
                              </li>
                              <li>
                                <Link href="/shop?category=On+the+go" className="nav-dropdown__link">
                                  <span className="nav-dropdown__link-name">On The Go</span>
                                  <span className="nav-dropdown__count">(2 items)</span>
                                </Link>
                              </li>
                              <li>
                                <Link href="/shop?category=Travel+edit" className="nav-dropdown__link">
                                  <span className="nav-dropdown__link-name">Travel Edit</span>
                                  <span className="nav-dropdown__count">(1 item)</span>
                                </Link>
                              </li>
                            </>
                          )}
                        </ul>
                      </div>

                      <div className="nav-dropdown__col nav-dropdown__col--featured">
                        <span className="nav-dropdown__eyebrow">Curated Highlight</span>
                        <Link href="/product/the-everyday-tote" className="nav-dropdown__card">
                          <div className="nav-dropdown__card-media">
                            <img src="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=85" alt="The Everyday Tote" loading="lazy" />
                            <span className="nav-dropdown__card-badge">Bestseller</span>
                          </div>
                          <div className="nav-dropdown__card-info">
                            <div className="nav-dropdown__card-title">The Everyday Tote</div>
                            <div className="nav-dropdown__card-meta">Organic Canvas • 18L Capacity</div>
                            <div className="nav-dropdown__card-footer">
                              <span className="nav-dropdown__card-price">₹48.00</span>
                              <span className="nav-dropdown__card-cta">Shop now ↗</span>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>

                <Link href="/shop?filter=new" className={pathname === '/shop' ? '' : ''}>New arrivals</Link>
                <Link href="/about">Our story</Link>
                <Link href="/#benefits">Why us</Link>
                <Link href="/blog">Editorial</Link>
                <Link href="/contact">Contact</Link>
              </>
            )}
          </nav>

          <div className="header-actions">
            <button
              className="icon-button"
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Icon name="search" />
            </button>

            <Link
              href="/wishlist"
              className="icon-button desktop-account"
              aria-label="Wishlist"
              title="Saved items"
            >
              <Icon name="heart" />
              {wishlistCount > 0 && <span className="cart-count">{wishlistCount}</span>}
            </Link>

            <Link
              href="/account"
              className="icon-button desktop-account"
              aria-label="Account"
            >
              <Icon name="user" />
            </Link>

            <button
              className="icon-button"
              aria-label="Shopping bag"
              onClick={openCart}
            >
              <Icon name="bag" />
              <span className="cart-count">{cartCount}</span>
            </button>
          </div>
        </div>

        {/* Mobile Side Popover Drawer */}
        <div
          className={`mobile-side-backdrop ${mobileDrawerOpen ? 'is-open' : ''}`}
          onClick={() => setMobileDrawerOpen(false)}
        />
        <aside
          className={`mobile-side-drawer ${mobileDrawerOpen ? 'is-open' : ''}`}
          id="mobile-side-drawer"
          aria-label="Mobile navigation"
          aria-hidden={!mobileDrawerOpen}
        >
          <div className="mobile-side-drawer__header">
            <Link href="/" className="brand" aria-label="NP Grand home">
              <img className="brand-logo" src="/assets/brand-logo.png" alt="NP Grand logo" />
            </Link>
            <button
              type="button"
              className="icon-button mobile-side-drawer__close"
              aria-label="Close navigation"
              onClick={() => setMobileDrawerOpen(false)}
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="mobile-side-drawer__body">
            <nav className="mobile-side-drawer__nav" aria-label="Mobile navigation links">
              {navItems && navItems.length > 0 ? (
                navItems.map((item, idx) => {
                  const itemId = item.id || `m_${idx}`;
                  const isItemOpen = mobileAccordionOpen === itemId;

                  if (item.has_submenu && Array.isArray(item.subitems) && item.subitems.length > 0) {
                    return (
                      <div key={itemId} className={`mobile-drawer-accordion ${isItemOpen ? 'is-open' : ''}`}>
                        <div className="mobile-drawer-accordion__row">
                          <Link
                            href={item.url || '/shop'}
                            className={`mobile-side-drawer__link ${pathname.startsWith(item.url || '/shop') ? 'is-active' : ''}`}
                            onClick={() => setMobileDrawerOpen(false)}
                          >
                            <span>{item.label}</span>
                          </Link>
                          <button
                            type="button"
                            className="mobile-drawer-accordion__toggle"
                            aria-expanded={isItemOpen}
                            aria-label={`Toggle ${item.label} submenu`}
                            onClick={() => setMobileAccordionOpen(prev => prev === itemId ? null : itemId)}
                          >
                            <Icon name="chevronDown" size={18} className="mobile-drawer-chevron" />
                          </button>
                        </div>

                        <div className="mobile-drawer-submenu" role="region" aria-label={`${item.label} subcategories`}>
                          {item.subitems.map((sub, sIdx) => (
                            <Link
                              key={sub.id || sIdx}
                              href={sub.url}
                              className="mobile-drawer-sublink"
                              onClick={() => setMobileDrawerOpen(false)}
                            >
                              <span>{sub.label}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <Link
                      key={itemId}
                      href={item.url}
                      className={`mobile-side-drawer__link ${pathname === item.url ? 'is-active' : ''}`}
                      onClick={() => setMobileDrawerOpen(false)}
                    >
                      {item.label}
                    </Link>
                  );
                })
              ) : (
                <>
                  {/* Collapsible Collections Submenu */}
                  <div className={`mobile-drawer-accordion ${mobileAccordionOpen === 'collections' ? 'is-open' : ''}`}>
                    <div className="mobile-drawer-accordion__row">
                      <Link href="/shop" className={`mobile-side-drawer__link ${isShop ? 'is-active' : ''}`} onClick={() => setMobileDrawerOpen(false)}>
                        <span>Collections</span>
                      </Link>
                      <button
                        type="button"
                        className="mobile-drawer-accordion__toggle"
                        aria-expanded={mobileAccordionOpen === 'collections'}
                        aria-label="Toggle Collections submenu"
                        onClick={() => setMobileAccordionOpen(prev => prev === 'collections' ? null : 'collections')}
                      >
                        <Icon name="chevronDown" size={18} className="mobile-drawer-chevron" />
                      </button>
                    </div>

                    <div className="mobile-drawer-submenu" role="region" aria-label="Collections subcategories">
                      <Link href="/shop" className="mobile-drawer-sublink" onClick={() => setMobileDrawerOpen(false)}>
                        <span>All Collections</span>
                        <span className="mobile-drawer-sublink__pill">All</span>
                      </Link>
                      {categories.length > 0 ? (
                        categories.filter(c => !c.parent_id).map(main => {
                          const subs = categories.filter(s => s.parent_id === main.id);
                          return (
                            <React.Fragment key={main.id}>
                              <Link href={`/shop?category=${encodeURIComponent(main.slug || main.name)}`} className="mobile-drawer-sublink" onClick={() => setMobileDrawerOpen(false)}>
                                <span style={{ fontWeight: 600 }}>{main.name}</span>
                                {main.product_count > 0 && <span className="mobile-drawer-sublink__count">({main.product_count})</span>}
                              </Link>
                              {subs.map(sub => (
                                <Link key={sub.id} href={`/shop?category=${encodeURIComponent(sub.slug || sub.name)}`} className="mobile-drawer-sublink" style={{ paddingLeft: '28px', fontSize: '13px' }} onClick={() => setMobileDrawerOpen(false)}>
                                  <span style={{ color: 'var(--muted)' }}>↳ {sub.name}</span>
                                  {sub.product_count > 0 && <span className="mobile-drawer-sublink__count" style={{ fontSize: '11px' }}>({sub.product_count})</span>}
                                </Link>
                              ))}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <>
                          <Link href="/shop?category=Everyday+essentials" className="mobile-drawer-sublink" onClick={() => setMobileDrawerOpen(false)}>
                            <span>Everyday Essentials</span>
                            <span className="mobile-drawer-sublink__count">(2)</span>
                          </Link>
                          <Link href="/shop?category=On+the+go" className="mobile-drawer-sublink" onClick={() => setMobileDrawerOpen(false)}>
                            <span>On The Go</span>
                            <span className="mobile-drawer-sublink__count">(2)</span>
                          </Link>
                          <Link href="/shop?category=Travel+edit" className="mobile-drawer-sublink" onClick={() => setMobileDrawerOpen(false)}>
                            <span>Travel Edit</span>
                            <span className="mobile-drawer-sublink__count">(1)</span>
                          </Link>
                        </>
                      )}
                    </div>
                  </div>

                  <Link href="/shop?filter=new" className="mobile-side-drawer__link" onClick={() => setMobileDrawerOpen(false)}>New arrivals</Link>
                  <Link href="/about" className="mobile-side-drawer__link" onClick={() => setMobileDrawerOpen(false)}>Our story</Link>
                  <Link href="/#benefits" className="mobile-side-drawer__link" onClick={() => setMobileDrawerOpen(false)}>Why us</Link>
                  <Link href="/blog" className="mobile-side-drawer__link" onClick={() => setMobileDrawerOpen(false)}>Editorial</Link>
                  <Link href="/contact" className="mobile-side-drawer__link" onClick={() => setMobileDrawerOpen(false)}>Contact</Link>
                </>
              )}
            </nav>

            <div className="mobile-side-drawer__shortcuts">
              <span className="mobile-side-drawer__shortcuts-title">Quick Actions</span>
              <div className="mobile-side-drawer__shortcuts-grid">
                <Link href="/wishlist" className="mobile-shortcut-btn">
                  <Icon name="heart" />
                  <span>Wishlist ({wishlistCount})</span>
                </Link>
                <Link href="/account" className="mobile-shortcut-btn">
                  <Icon name="user" />
                  <span>Account</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="mobile-side-drawer__footer">
            <div className="mobile-side-drawer__perk">
              <span className="perk-star">✦</span>
              <span>Free delivery on qualifying orders over <strong>₹499</strong></span>
            </div>
          </div>
        </aside>

        {/* Search Popover */}
        <div
          className={`search-popover-backdrop ${searchOpen ? 'is-open' : ''}`}
          onClick={() => setSearchOpen(false)}
        />
        <div
          className={`search-popover ${searchOpen ? 'is-open' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label="Search store"
        >
          <div className="container search-popover__inner">
            <form onSubmit={handleSearchSubmit} className="search-popover__bar">
              <span className="search-popover__icon">
                <Icon name="search" />
              </span>
              <input
                type="search"
                className="search-popover__input"
                placeholder="Search for everyday totes, crossbodies, backpacks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus={searchOpen}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-popover__clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                className="search-popover__close"
                onClick={() => setSearchOpen(false)}
                aria-label="Close search"
              >
                <Icon name="close" />
              </button>
            </form>

            <div className="search-popover__content">
              <div className="search-popover__suggestions">
                <div className="search-popover__label">Trending Searches</div>
                <div className="search-tags">
                  {['Tote', 'Crossbody', 'Weekender', 'Backpack', 'Satchel', 'Sling'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      className="search-tag"
                      onClick={() => {
                        setSearchOpen(false);
                        router.push(`/shop?search=${tag}`);
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

