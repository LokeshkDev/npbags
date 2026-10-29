'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icons';
import { useSidebar } from '../lib/sidebar-context';

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard', icon: 'home' },
    { label: 'Products', href: '/products', icon: 'bag' },
    { label: 'Categories', href: '/categories', icon: 'grid' },
    { label: 'Orders', href: '/orders', icon: 'order' },
    { title: 'POS & Inventory' },
    { label: 'POS Billing Counter', href: '/pos', icon: 'pos' },
    { label: 'Barcode Lookup', href: '/barcodes', icon: 'barcode' },
    { label: 'Stock & Inventory', href: '/inventory', icon: 'package' },
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
    <aside className={`admin-sidebar ${isCollapsed ? 'is-collapsed' : ''}`}>
      <div className="admin-sidebar__brand">
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <img src="/assets/brand-logo.png" alt="NP Grand Admin" className="admin-sidebar__logo" />
          {!isCollapsed && (
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', letterSpacing: '0.8px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Admin Panel
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggleSidebar}
          className="admin-sidebar__collapse-btn"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <Icon name={isCollapsed ? 'chevronRight' : 'chevronLeft'} size={14} />
        </button>
      </div>

      <nav className="admin-sidebar__nav">
        {navLinks.map((item, i) => {
          if (item.title) {
            if (isCollapsed) return <div key={i} className="admin-nav-divider" />;
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
              title={isCollapsed ? item.label : undefined}
            >
              <Icon name={item.icon} size={18} />
              {!isCollapsed && <span>{item.label}</span>}
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
            title={isCollapsed ? 'View Live Website' : undefined}
          >
            <Icon name="externalLink" size={16} />
            {!isCollapsed && <span>View Live Website</span>}
          </a>
        </div>
      </nav>
    </aside>
  );
}

export default Sidebar;
