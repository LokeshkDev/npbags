'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icons';
import { getAdminCoupons, createAdminCoupon, deleteAdminCoupon } from '../../lib/api';

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_amount: 499,
    max_discount: null,
    expiry_date: ''
  });
  const [saving, setSaving] = useState(false);

  const loadCoupons = () => {
    getAdminCoupons()
      .then(data => {
        if (Array.isArray(data)) setCoupons(data);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createAdminCoupon({
        ...formData,
        code: formData.code.toUpperCase().trim(),
        discount_value: Number(formData.discount_value),
        min_order_amount: Number(formData.min_order_amount),
        max_discount: formData.max_discount ? Number(formData.max_discount) : null
      });
      setIsModalOpen(false);
      setFormData({ code: '', discount_type: 'percentage', discount_value: 10, min_order_amount: 499, max_discount: null, expiry_date: '' });
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Error creating coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await deleteAdminCoupon(id);
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Error deleting coupon');
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Coupons & Discount Promotions" />

        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>Promo Codes</h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                Manage checkout discount codes, cart thresholds, and seasonal promotional campaigns.
              </p>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => setIsModalOpen(true)}
            >
              <Icon name="plus" size={16} />
              <span>Create Coupon</span>
            </button>
          </div>

          <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Promo Code</th>
                  <th>Discount</th>
                  <th>Min Order</th>
                  <th>Max Cap</th>
                  <th>Expires On</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                      No active discount coupons found.
                    </td>
                  </tr>
                ) : (
                  coupons.map(cpn => (
                    <tr key={cpn.id}>
                      <td style={{ fontWeight: 700, color: 'var(--brand-red)' }}>
                        <span style={{ padding: '4px 8px', background: 'rgba(237, 28, 42, 0.08)', borderRadius: '6px', letterSpacing: '0.5px' }}>
                          {cpn.code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {cpn.discount_type === 'percentage' ? `${cpn.discount_value}% OFF` : `₹${cpn.discount_value} FLAT`}
                      </td>
                      <td>₹{cpn.min_order_amount ?? 0}</td>
                      <td>{cpn.max_discount ? `₹${cpn.max_discount}` : 'No limit'}</td>
                      <td style={{ color: 'var(--muted)', fontSize: '12px' }}>
                        {cpn.expiry_date ? new Date(cpn.expiry_date).toLocaleDateString() : 'Never'}
                      </td>
                      <td>
                        <span className="badge badge-success">Active</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-outline"
                          style={{ color: 'var(--brand-red)', borderColor: 'var(--brand-red)', padding: '4px 8px' }}
                          onClick={() => handleDelete(cpn.id)}
                          title="Delete Coupon"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Create Coupon Modal */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Create New Coupon"
          >
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Coupon Code (Uppercase)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. FESTIVE20"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Discount Type</label>
                  <select
                    className="form-control"
                    value={formData.discount_type}
                    onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Discount Value</label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Min Cart Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={formData.min_order_amount}
                    onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Discount Cap (₹)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="Optional limit"
                    value={formData.max_discount || ''}
                    onChange={(e) => setFormData({ ...formData, max_discount: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Expiry Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                />
              </div>

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
                  <span>{saving ? 'Creating...' : 'Save Coupon'}</span>
                </button>
              </div>
            </form>
          </Modal>
        </div>
      </div>
    </div>
  );
}

