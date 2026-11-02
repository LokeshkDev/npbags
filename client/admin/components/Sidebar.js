'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icons';
import { useSidebar } from '../lib/sidebar-context';

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const [isHovered, setIsHovered] = React.useState(false);

  // Default collapsed; expands smoothly on hover when collapsed
  const effectiveCollapsed = isCollapsed && !isHovered;
  const isHoverExpanded = isCollapsed && isHovered;

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard', icon: 'home' },
    { label: 'Products', href: '/products', icon: 'bag' },
    { label: 'Categories', href: '/categories', icon: 'grid' },
    { label: 'Orders', href: '/orders', icon: 'order' },
    { title: 'POS & Inventory' },
    { label: 'POS Billing Counter', href: '/pos', icon: 'pos' },
    { label: 'Barcode Lookup', href: '/barcodes', icon: 'barcode' },
    { label: 'Stock & Inventory', href: '/inventory', icon: 'package' },
    { label: 'Sales Staff & Reports', href: '/salespersons', icon: 'user' },
    { label: 'Vendors & Suppliers', href: '/vendors', icon: 'vendor' },
    { label: 'Audit & Activity Logs', href: '/audit-logs', icon: 'history' },
    { title: 'CMS & Storefront' },
    { label: 'Homepage Sections', href: '/cms/sections', icon: 'cms' },
    { label: 'Header Navigation', href: '/cms/sections?tab=main_navigation', icon: 'menu' },
    { label: 'Delivery Rules', href: '/cms/delivery', icon: 'delivery' },
    { label: 'Category Page Banners', href: '/banners', icon: 'banner' },
    { label: 'Coupons', href: '/coupons', icon: 'coupon' },
    { label: 'Articles & Blogs', href: '/blogs', icon: 'blog' },
    { title: 'Customers & CRM' },
    { label: 'Customers', href: '/customers', icon: 'user' },
    { label: 'Inquiries & Forms', href: '/messages', icon: 'mail' },
    { label: 'Store Settings', href: '/settings', icon: 'settings' }
  ];

  return (
    <div
      style={{
        position: 'relative',
        width: isCollapsed ? '72px' : '260px',
        flexShrink: 0,
        transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      <aside
        className={`admin-sidebar ${effectiveCollapsed ? 'is-collapsed' : ''} ${isHoverExpanded ? 'is-hover-expanded' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          height: '100%',
          ...(isHoverExpanded ? {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            width: '260px',
            zIndex: 1000,
            boxShadow: '8px 0 28px rgba(0, 0, 0, 0.45)'
          } : {})
        }}
      >
        <div className="admin-sidebar__brand">
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <img src="/assets/brand-logo.png" alt="NP Grand Admin" className="admin-sidebar__logo" />
            {!effectiveCollapsed && (
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', letterSpacing: '0.8px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Admin Panel
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            className="admin-sidebar__collapse-btn"
            title={effectiveCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={effectiveCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            style={effectiveCollapsed ? { display: 'none' } : {}}
          >
            <Icon name={effectiveCollapsed ? 'chevronRight' : 'chevronLeft'} size={14} />
          </button>
        </div>

        <nav className="admin-sidebar__nav">
          {navLinks.map((item, i) => {
            if (item.title) {
              if (effectiveCollapsed) return <div key={i} className="admin-nav-divider" />;
              return (
                <div key={i} className="admin-nav-section-title">
                  {item.title}
                </div>
              );
            }
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={i}
                href={item.href}
                className={`admin-nav-item ${isActive ? 'is-active' : ''}`}
                title={effectiveCollapsed ? item.label : undefined}
              >
                <Icon name={item.icon} size={18} />
                {!effectiveCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}

          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #28322e' }}>
            <a
              href={process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}
              target="_blank"
              rel="noopener noreferrer"
              className="admin-nav-item"
              style={{ color: 'var(--brand-green)' }}
              title={effectiveCollapsed ? 'View Live Website' : undefined}
            >
              <Icon name="externalLink" size={16} />
              {!effectiveCollapsed && <span>View Live Website</span>}
            </a>
          </div>
        </nav>
      </aside>
    </div>
  );
}

export default Sidebar;
