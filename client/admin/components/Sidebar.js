'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from './Icons';
import { useSidebar } from '../lib/sidebar-context';
import { useAdminAuth } from '../lib/auth';

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { adminUser } = useAdminAuth();
  const [isHovered, setIsHovered] = React.useState(false);

  // Default collapsed; expands smoothly on hover when collapsed
  const effectiveCollapsed = isCollapsed && !isHovered;
  const isHoverExpanded = isCollapsed && isHovered;

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: 'home' },
    { key: 'products', label: 'Products', href: '/products', icon: 'bag' },
    { key: 'categories', label: 'Categories', href: '/categories', icon: 'grid' },
    { key: 'orders', label: 'Orders', href: '/orders', icon: 'order' },
    { title: 'POS & Inventory', sectionKey: 'pos_inventory' },
    { key: 'pos', label: 'POS Billing Counter', href: '/pos', icon: 'pos' },
    { key: 'barcodes', label: 'Barcode Lookup', href: '/barcodes', icon: 'barcode' },
    { key: 'inventory', label: 'Stock & Inventory', href: '/inventory', icon: 'package' },
    { key: 'salespersons', label: 'Sales Staff & Reports', href: '/salespersons', icon: 'user' },
    { key: 'vendors', label: 'Vendors & Suppliers', href: '/vendors', icon: 'vendor' },
    { key: 'audit_logs', label: 'Audit & Activity Logs', href: '/audit-logs', icon: 'history' },
    { title: 'CMS & Storefront', sectionKey: 'cms' },
    { key: 'cms', label: 'Homepage Sections', href: '/cms/sections', icon: 'cms' },
    { key: 'cms_nav', label: 'Header Navigation', href: '/cms/sections?tab=main_navigation', icon: 'menu' },
    { key: 'delivery', label: 'Delivery Rules', href: '/cms/delivery', icon: 'delivery' },
    { key: 'banners', label: 'Category Page Banners', href: '/banners', icon: 'banner' },
    { key: 'coupons', label: 'Coupons', href: '/coupons', icon: 'coupon' },
    { key: 'blogs', label: 'Articles & Blogs', href: '/blogs', icon: 'blog' },
    { title: 'Customers & CRM', sectionKey: 'crm' },
    { key: 'customers', label: 'Customers', href: '/customers', icon: 'user' },
    { key: 'messages', label: 'Inquiries & Forms', href: '/messages', icon: 'mail' },
    { title: 'Multi-Branch & System', sectionKey: 'system' },
    { key: 'branches', label: 'Branches & Access', href: '/branches', icon: 'settings', superAdminOnly: true },
    { key: 'settings', label: 'Store Settings', href: '/settings', icon: 'settings', superAdminOnly: true }
  ];

  // Role and allowed menu filtering for restricted branch staff
  const isSuperAdmin = Boolean(adminUser && adminUser.role === 'admin' && (!adminUser.branch_id || Number(adminUser.branch_id) <= 1));
  const allowedSet = new Set(Array.isArray(adminUser?.allowed_menus) ? adminUser.allowed_menus : []);

  const visibleNavLinks = navItems.filter(item => {
    if (item.title) return true;
    if (isSuperAdmin) return true;
    if (item.superAdminOnly) return false;
    return allowedSet.has(item.key);
  });

  // Strip empty section headers
  const finalNavLinks = visibleNavLinks.filter((item, idx, arr) => {
    if (!item.title) return true;
    for (let i = idx + 1; i < arr.length; i++) {
      if (arr[i].title) break;
      if (!arr[i].title) return true;
    }
    return false;
  });

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
              <div>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff', letterSpacing: '0.8px', textTransform: 'uppercase', whiteSpace: 'nowrap', display: 'block' }}>
                  Admin Panel
                </span>
                {adminUser?.branch_name && (
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#34d399', whiteSpace: 'nowrap', display: 'block' }}>
                    🏢 {adminUser.branch_name}
                  </span>
                )}
              </div>
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
          {finalNavLinks.map((item, i) => {
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
