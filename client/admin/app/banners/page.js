'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { ImageUploader } from '../../components/ImageUploader';
import { Icon } from '../../components/Icons';
import { getAdminBanners, createAdminBanner, deleteAdminBanner } from '../../lib/api';

export default function AdminBannersPage() {
  const [banners, setBanners] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subtitle: '',
    link_url: '/shop',
    sort_order: 0,
    image: null
  });
  const [saving, setSaving] = useState(false);

  const loadBanners = () => {
    getAdminBanners()
      .then(data => {
        if (Array.isArray(data)) setBanners(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadBanners();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('subtitle', formData.subtitle);
      data.append('link_url', formData.link_url);
      data.append('sort_order', formData.sort_order);
      if (formData.image) {
        data.append('image', formData.image);
      }

      await createAdminBanner(data);
      setIsModalOpen(false);
      setFormData({ title: '', subtitle: '', link_url: '/shop', sort_order: 0, image: null });
      loadBanners();
    } catch (err) {
      alert(err.message || 'Error creating banner');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this promotional banner?')) return;
    try {
      await deleteAdminBanner(id);
      loadBanners();
    } catch (err) {
      alert(err.message || 'Error deleting banner');
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Hero Slides & Promotional Banners" />

        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>Store Banners</h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                Manage full-width promotional images, hero slides, and seasonal sale banners.
              </p>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => setIsModalOpen(true)}
            >
              <Icon name="plus" size={16} />
              <span>Add Banner</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {banners.length === 0 ? (
              <div className="stat-card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
                No promotional banners found. Add your first hero slide!
              </div>
            ) : (
              banners.map(b => (
                <div key={b.id} className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ height: '180px', background: '#f3f4f6', position: 'relative' }}>
                    {b.image_url ? (
                      <img src={b.image_url} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                        <Icon name="banner" size={40} />
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>{b.title || 'Untitled Banner'}</h3>
                      <button
                        type="button"
                        className="admin-btn admin-btn-outline"
                        style={{ color: 'var(--brand-red)', borderColor: 'var(--brand-red)', padding: '4px 8px' }}
                        onClick={() => handleDelete(b.id)}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                    {b.subtitle && <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>{b.subtitle}</p>}
                    <div style={{ fontSize: '12px', color: 'var(--brand-red)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="externalLink" size={12} />
                      <span>{b.link_url || '/shop'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Banner Modal */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Add Promotional Banner"
          >
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Banner Title</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Summer Handcrafted Essentials"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Subtitle / Description</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Thoughtfully designed bags ready for life on the move."
                  value={formData.subtitle}
                  onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">CTA Link URL</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.link_url}
                    onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sort Order</label>
                  <input
                    type="number"
                    className="form-control"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                  />
                </div>
              </div>

              <ImageUploader
                label="Banner Graphic Image"
                onFileSelect={(file) => setFormData({ ...formData, image: file })}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={saving}
                >
                  <Icon name="check" size={16} />
                  <span>{saving ? 'Uploading...' : 'Publish Banner'}</span>
                </button>
              </div>
            </form>
          </Modal>
        </div>
      </div>
    </div>
  );
}

