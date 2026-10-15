'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../../components/Sidebar';
import { Topbar } from '../../../components/Topbar';
import { Icon } from '../../../components/Icons';
import { getAdminDeliverySettings, updateAdminDeliverySettings } from '../../../lib/api';

export default function AdminDeliverySettingsPage() {
  const [settings, setSettings] = useState({
    free_shipping_threshold: 499,
    standard_shipping_fee: 49,
    express_shipping_fee: 99,
    estimated_delivery_days: '2-4 business days',
    cod_available: true,
    return_window_days: 30
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    getAdminDeliverySettings()
      .then(data => {
        if (data) {
          setSettings({
            free_shipping_threshold: Number(data.free_shipping_threshold ?? 499),
            standard_shipping_fee: Number(data.standard_shipping_fee ?? 49),
            express_shipping_fee: Number(data.express_shipping_fee ?? 99),
            estimated_delivery_days: data.estimated_delivery_days || '2-4 business days',
            cod_available: Boolean(data.cod_available),
            return_window_days: Number(data.return_window_days ?? 30)
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage('');
    try {
      await updateAdminDeliverySettings({
        ...settings,
        free_shipping_threshold: Number(settings.free_shipping_threshold),
        standard_shipping_fee: Number(settings.standard_shipping_fee),
        express_shipping_fee: Number(settings.express_shipping_fee),
        return_window_days: Number(settings.return_window_days),
        cod_available: settings.cod_available ? 1 : 0
      });
      setSaveMessage('Delivery rules and shipping rates updated successfully!');
      setTimeout(() => setSaveMessage(''), 4000);
    } catch (err) {
      alert(err.message || 'Error saving delivery settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Delivery Rules & Logistics Engine" />

        <div className="admin-content" style={{ maxWidth: '840px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>Delivery & Shipping Rules</h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                Control live shipping fees, free shipping progress bar trigger, SLAs, and COD payment availability.
              </p>
            </div>
            {saveMessage && (
              <div style={{ background: '#ecfdf5', color: '#065f46', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}>
                ✓ {saveMessage}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="stat-card">
            {/* Free Shipping Configuration */}
            <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--line)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ padding: '6px', borderRadius: '6px', background: 'rgba(8, 166, 83, 0.1)', color: 'var(--brand-green)' }}>
                  <Icon name="delivery" size={18} />
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>Free Delivery Threshold</h3>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
                Storefront cart drawer dynamically shows a live progress bar toward this qualifying order threshold.
              </p>
              <div className="form-group" style={{ maxWidth: '320px' }}>
                <label className="form-label">Free Shipping Minimum Cart Value (₹)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '16px' }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="form-control"
                    value={settings.free_shipping_threshold}
                    onChange={(e) => setSettings({ ...settings, free_shipping_threshold: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Flat Shipping Rates */}
            <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--line)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ padding: '6px', borderRadius: '6px', background: 'rgba(237, 28, 42, 0.1)', color: 'var(--brand-red)' }}>
                  <Icon name="tag" size={18} />
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>Standard & Express Freight Rates</h3>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Standard Shipping Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="form-control"
                    value={settings.standard_shipping_fee}
                    onChange={(e) => setSettings({ ...settings, standard_shipping_fee: e.target.value })}
                    required
                  />
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Applied if order is below free shipping threshold</small>
                </div>
                <div className="form-group">
                  <label className="form-label">Express Shipping Upgrade (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="form-control"
                    value={settings.express_shipping_fee}
                    onChange={(e) => setSettings({ ...settings, express_shipping_fee: e.target.value })}
                    required
                  />
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Priority air dispatch fee</small>
                </div>
              </div>
            </div>

            {/* Delivery SLAs & Payment Policies */}
            <div style={{ paddingBottom: '20px', borderBottom: '1px solid var(--line)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ padding: '6px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                  <Icon name="shieldCheck" size={18} />
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>Service Level Agreement (SLA) & Policies</h3>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Estimated Delivery SLA Text</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 2-4 business days"
                    value={settings.estimated_delivery_days}
                    onChange={(e) => setSettings({ ...settings, estimated_delivery_days: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Exchange / Return Window (Days)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={settings.return_window_days}
                    onChange={(e) => setSettings({ ...settings, return_window_days: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Cash On Delivery Toggle */}
              <div style={{ marginTop: '16px', padding: '16px', background: '#fafbfc', borderRadius: '8px', border: '1px solid var(--line)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.cod_available}
                    onChange={(e) => setSettings({ ...settings, cod_available: e.target.checked })}
                    style={{ width: '20px', height: '20px', accentColor: 'var(--brand-green)' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>Allow Cash On Delivery (COD)</span>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                      When enabled, customers can select Cash on Delivery at checkout across serviceable pin codes.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={saving}
                style={{ padding: '10px 24px', fontSize: '14px' }}
              >
                <Icon name="check" size={16} />
                <span>{saving ? 'Saving Settings...' : 'Save Delivery Rules'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

