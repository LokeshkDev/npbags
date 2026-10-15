'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Icon } from '../../components/Icons';
import { getAdminStoreSettings, updateAdminStoreSettings } from '../../lib/api';

export default function AdminSettingsPage() {
  const [formData, setFormData] = useState({
    store_name: 'Your Brand',
    email: 'support@npgrand.com',
    phone: '+91 98765 43210',
    address: 'Plot 42, Creative District, Indiranagar, Bengaluru, KA, India',
    currency: '₹',
    announcement_text: 'Complimentary delivery on qualifying orders over ₹499'
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getAdminStoreSettings()
      .then(data => {
        if (data) {
          setFormData({
            store_name: data.store_name || 'Your Brand',
            email: data.email || 'support@npgrand.com',
            phone: data.phone || '+91 98765 43210',
            address: data.address || '',
            currency: data.currency || '₹',
            announcement_text: data.announcement_text || ''
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const data = new FormData();
    Object.keys(formData).forEach(key => data.append(key, formData[key]));

    try {
      await updateAdminStoreSettings(data);
      setMessage('Store settings updated successfully!');
      setTimeout(() => setMessage(''), 3500);
    } catch (err) {
      alert(err.message || 'Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Store Identity & General Settings" />

        <div className="admin-content" style={{ maxWidth: '780px' }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>General Storefront Settings</h2>
            <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Configure store name, default currency, contact channels and legal address.</p>
          </div>

          {message && (
            <div style={{ background: 'rgba(8, 166, 83, 0.1)', color: 'var(--brand-green)', padding: '12px 18px', borderRadius: '8px', marginBottom: '20px', fontWeight: 600 }}>
              ✓ {message}
            </div>
          )}

          <div className="admin-card" style={{ padding: '28px' }}>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Brand Name</label>
                <input
                  type="text"
                  required
                  className="form-control"
                  value={formData.store_name}
                  onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Support Email</label>
                  <input
                    type="email"
                    required
                    className="form-control"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Support Hotline</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Currency Symbol</label>
                <input
                  type="text"
                  style={{ width: '120px' }}
                  className="form-control"
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Studio & Postal Address</label>
                <textarea
                  rows={3}
                  className="form-control"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div style={{ marginTop: '28px', borderTop: '1px solid var(--line)', paddingTop: '20px' }}>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={saving}
                  style={{ padding: '10px 24px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                >
                  <Icon name="check" size={16} />
                  <span>{saving ? 'Saving...' : 'Save Settings'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

