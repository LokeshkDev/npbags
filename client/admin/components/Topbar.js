'use client';

import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../lib/auth';
import { Icon } from './Icons';
import { useSidebar } from '../lib/sidebar-context';
import { usePOSModal } from '../lib/pos-modal-context';

export function Topbar({ title }) {
  const { adminUser, logout } = useAdminAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();
  const { openPOS } = usePOSModal();

  // Thermal Print Settings Modal State
  const [isThermalSettingsOpen, setIsThermalSettingsOpen] = useState(false);
  const [thermalSettings, setThermalSettings] = useState({
    paperWidth: '80mm', // '80mm' | '58mm'
    copies: 1, // 1 | 2
    density: '300bol', // '300bol' | 'standard'
    autoPrint: false
  });

  // Load saved thermal settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('np_thermal_settings');
      if (saved) {
        setThermalSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch (e) {}
  }, []);

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('np_thermal_settings', JSON.stringify(thermalSettings));
      window.dispatchEvent(new Event('np_thermal_settings_updated'));
      setIsThermalSettingsOpen(false);
      alert('✓ Thermal printer settings saved and fixed! POS billing will now use these settings directly.');
    } catch (e) {
      alert('Could not save settings to localStorage');
    }
  };

  return (
    <>
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

        <div className="admin-topbar__actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Header POS Billing Action Button */}
          <button
            type="button"
            onClick={openPOS}
            style={{
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: 800,
              background: '#065935',
              border: 'none',
              color: '#ffffff',
              borderRadius: '6px',
              cursor: 'pointer',
              letterSpacing: '0.03em',
              boxShadow: '0 2px 6px rgba(6, 89, 53, 0.25)',
              transition: 'all 0.15s ease'
            }}
            title="Launch Full-Screen POS Billing Register"
          >
            POS Billing
          </button>

          {/* Thermal Print Settings Button (Right next to POS Billing) */}
          <button
            type="button"
            onClick={() => setIsThermalSettingsOpen(true)}
            style={{
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 800,
              background: '#ffffff',
              border: '1.5px solid #cbd5e1',
              color: '#1e293b',
              borderRadius: '6px',
              cursor: 'pointer',
              letterSpacing: '0.02em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            title="Configure Thermal Receipt Printer (80mm/58mm, 300 Bol, Copies)"
          >
            <span>Thermal Settings</span>
          </button>

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

      {/* Standalone Thermal Printer Settings Modal */}
      {isThermalSettingsOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '24px 28px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
              boxSizing: 'border-box'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: '0 0 2px' }}>
                  Thermal Printer Settings
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Settings saved here apply directly to all POS billing prints.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsThermalSettingsOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
              >
                &times;
              </button>
            </div>

            {/* Paper Roll Width */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                THERMAL ROLL WIDTH:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setThermalSettings(prev => ({ ...prev, paperWidth: '80mm' }))}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: thermalSettings.paperWidth === '80mm' ? '2px solid #065935' : '1.5px solid #cbd5e1',
                    background: thermalSettings.paperWidth === '80mm' ? '#ecfdf5' : '#ffffff',
                    color: thermalSettings.paperWidth === '80mm' ? '#065935' : '#475569',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  80mm (Standard POS)
                </button>
                <button
                  type="button"
                  onClick={() => setThermalSettings(prev => ({ ...prev, paperWidth: '58mm' }))}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: thermalSettings.paperWidth === '58mm' ? '2px solid #065935' : '1.5px solid #cbd5e1',
                    background: thermalSettings.paperWidth === '58mm' ? '#ecfdf5' : '#ffffff',
                    color: thermalSettings.paperWidth === '58mm' ? '#065935' : '#475569',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  58mm (Mini POS)
                </button>
              </div>
            </div>

            {/* Number of Copies */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                DEFAULT PRINT COPIES:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setThermalSettings(prev => ({ ...prev, copies: 1 }))}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: thermalSettings.copies === 1 ? '2px solid #065935' : '1.5px solid #cbd5e1',
                    background: thermalSettings.copies === 1 ? '#ecfdf5' : '#ffffff',
                    color: thermalSettings.copies === 1 ? '#065935' : '#475569',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  1 Copy (Customer)
                </button>
                <button
                  type="button"
                  onClick={() => setThermalSettings(prev => ({ ...prev, copies: 2 }))}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: thermalSettings.copies === 2 ? '2px solid #065935' : '1.5px solid #cbd5e1',
                    background: thermalSettings.copies === 2 ? '#ecfdf5' : '#ffffff',
                    color: thermalSettings.copies === 2 ? '#065935' : '#475569',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  2 Copies (Customer + Store)
                </button>
              </div>
            </div>

            {/* Thermal Burn Density (300 bol mode) */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                THERMAL DENSITY / CONTRAST:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setThermalSettings(prev => ({ ...prev, density: '300bol' }))}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: thermalSettings.density === '300bol' ? '2px solid #065935' : '1.5px solid #cbd5e1',
                    background: thermalSettings.density === '300bol' ? '#ecfdf5' : '#ffffff',
                    color: thermalSettings.density === '300bol' ? '#065935' : '#475569',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  300 Bol (Pure Solid Black)
                </button>
                <button
                  type="button"
                  onClick={() => setThermalSettings(prev => ({ ...prev, density: 'standard' }))}
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    border: thermalSettings.density === 'standard' ? '2px solid #065935' : '1.5px solid #cbd5e1',
                    background: thermalSettings.density === 'standard' ? '#ecfdf5' : '#ffffff',
                    color: thermalSettings.density === 'standard' ? '#065935' : '#475569',
                    fontWeight: 800,
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Standard Bold
                </button>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                {thermalSettings.density === '300bol'
                  ? '✓ Enforces solid #000000 pure black with 300 bold density for sharp thermal burns without faded halftones.'
                  : 'Standard thermal printhead density.'}
              </div>
            </div>

            {/* Auto-Print on Billing Complete Toggle */}
            <div style={{ marginBottom: '22px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>
                <input
                  type="checkbox"
                  checked={thermalSettings.autoPrint}
                  onChange={(e) => setThermalSettings(prev => ({ ...prev, autoPrint: e.target.checked }))}
                  style={{ width: '16px', height: '16px', accentColor: '#065935', cursor: 'pointer' }}
                />
                <span>Auto-Launch Print Dialog on Order Complete</span>
              </label>
              <div style={{ fontSize: '11px', color: '#64748b', marginLeft: '26px', marginTop: '3px' }}>
                When enabled, the thermal print window opens instantly when a sale is billed.
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setIsThermalSettingsOpen(false)}
                style={{ padding: '9px 16px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSettings}
                style={{ padding: '9px 20px', borderRadius: '6px', background: '#065935', color: '#ffffff', border: 'none', fontSize: '12.5px', fontWeight: 800, cursor: 'pointer' }}
              >
                Save &amp; Fix Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Topbar;
