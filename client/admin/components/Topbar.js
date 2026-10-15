'use client';

import React from 'react';
import { useAdminAuth } from '../lib/auth';
import { Icon } from './Icons';
import { useSidebar } from '../lib/sidebar-context';

export function Topbar({ title }) {
  const { adminUser, logout } = useAdminAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();

  return (
    <header className="admin-topbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button
          type="button"
          onClick={toggleSidebar}
          className="admin-sidebar-toggle-btn"
          title={isCollapsed ? 'Show Sidebar' : 'Collapse Sidebar'}
          aria-label={isCollapsed ? 'Show Sidebar' : 'Collapse Sidebar'}
        >
          <Icon name="menu" size={18} />
        </button>
        <div className="admin-topbar__title">{title}</div>
      </div>

      <div className="admin-topbar__actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-green)' }} />
          <Icon name="user" size={16} />
          <span style={{ fontWeight: 600 }}>{adminUser?.name || 'Administrator'}</span>
          <span className="badge badge-info" style={{ fontSize: '10px' }}>Admin</span>
        </div>

        <button
          type="button"
          className="admin-btn admin-btn-outline"
          onClick={logout}
          style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Icon name="logout" size={14} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

export default Topbar;
