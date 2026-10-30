'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icons';
import {
  getAdminVendors,
  createAdminVendor,
  updateAdminVendor,
  deleteAdminVendor
} from '../../lib/api';

export default function AdminVendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    contact_person: '',
    phone: '',
    email: '',
    gstin: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    payment_terms: 'Net 30',
    notes: '',
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadVendors = async () => {
    try {
      setLoading(true);
      const data = await getAdminVendors();
      if (Array.isArray(data)) {
        setVendors(data);
      } else if (data && Array.isArray(data.vendors)) {
        setVendors(data.vendors);
      } else {
        setVendors([]);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load vendors', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const openAddModal = () => {
    setEditingVendor(null);
    setErrorMsg('');
    setFormData({
      name: '',
      company_name: '',
      contact_person: '',
      phone: '',
      email: '',
      gstin: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      payment_terms: 'Net 30',
      notes: '',
      is_active: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (vendor) => {
    setEditingVendor(vendor);
    setErrorMsg('');
    setFormData({
      name: vendor.name || '',
      company_name: vendor.company_name || '',
      contact_person: vendor.contact_person || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      gstin: vendor.gstin || '',
      address: vendor.address || '',
      city: vendor.city || '',
      state: vendor.state || '',
      pincode: vendor.pincode || '',
      payment_terms: vendor.payment_terms || 'Net 30',
      notes: vendor.notes || '',
      is_active: vendor.is_active !== undefined ? Boolean(vendor.is_active) : true
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Vendor Name is required.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');

      if (editingVendor) {
        await updateAdminVendor(editingVendor.id, formData);
        showToast(`Vendor "${formData.name}" updated successfully.`);
      } else {
        await createAdminVendor(formData);
        showToast(`Vendor "${formData.name}" added successfully.`);
      }

      setIsModalOpen(false);
      loadVendors();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save vendor details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vendor) => {
    const hasProducts = Number(vendor.product_count) > 0;
    const confirmPrompt = hasProducts
      ? `Warning: "${vendor.name}" currently has ${vendor.product_count} linked products.\nDeleting this vendor will detach them from these products. Continue?`
      : `Are you sure you want to delete vendor "${vendor.name}"?`;

    if (!window.confirm(confirmPrompt)) return;

    try {
      await deleteAdminVendor(vendor.id);
      showToast(`Vendor "${vendor.name}" deleted.`);
      loadVendors();
    } catch (err) {
      showToast(err.message || 'Failed to delete vendor', 'error');
    }
  };

  // Filter & Search
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      if (statusFilter === 'active' && !v.is_active) return false;
      if (statusFilter === 'inactive' && v.is_active) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        (v.name && v.name.toLowerCase().includes(q)) ||
        (v.company_name && v.company_name.toLowerCase().includes(q)) ||
        (v.contact_person && v.contact_person.toLowerCase().includes(q)) ||
        (v.phone && v.phone.toLowerCase().includes(q)) ||
        (v.gstin && v.gstin.toLowerCase().includes(q)) ||
        (v.city && v.city.toLowerCase().includes(q))
      );
    });
  }, [vendors, searchQuery, statusFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter(v => v.is_active).length;
    const totalProducts = vendors.reduce((sum, v) => sum + (Number(v.product_count) || 0), 0);
    const totalValuation = vendors.reduce((sum, v) => sum + (Number(v.total_stock_value) || 0), 0);

    return { total, active, totalProducts, totalValuation };
  }, [vendors]);

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar />
        <main className="admin-content">
          {/* Toast Notification */}
          {toastMessage && (
            <div
              style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 99999,
                padding: '12px 20px',
                borderRadius: '8px',
                backgroundColor: toastMessage.type === 'error' ? '#ef4444' : '#065935',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'fadeIn 0.2s ease-in-out'
              }}
            >
              <span>{toastMessage.type === 'error' ? '⚠️' : '✓'}</span>
              <span>{toastMessage.text}</span>
            </div>
          )}

          {/* Header Bar */}
          <div className="admin-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 className="admin-page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                Vendor & Supplier Management
              </h1>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                Manage wholesale suppliers, purchase order costing, GSTIN credentials, and catalog product links.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddModal}
              className="admin-btn admin-btn--primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#065935',
                color: '#fff',
                padding: '10px 18px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                border: 'none'
              }}
            >
              <Icon name="plus" size={16} />
              <span>Add New Vendor</span>
            </button>
          </div>

          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Total Vendors
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
                {stats.total}
              </div>
              <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600, marginTop: '4px' }}>
                {stats.active} Active Partners
              </div>
            </div>

            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Linked Catalog Items
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#065935', marginTop: '6px' }}>
                {stats.totalProducts}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Attributed to verified suppliers
              </div>
            </div>

            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Estimated Stock Value
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#0284c7', marginTop: '6px' }}>
                ₹{stats.totalValuation.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Wholesale inventory value
              </div>
            </div>

            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tax Compliance
              </div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#d97706', marginTop: '6px' }}>
                {vendors.filter(v => v.gstin && v.gstin.trim()).length} / {stats.total}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Registered GSTIN invoices
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div
            className="admin-card"
            style={{
              padding: '14px 18px',
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '20px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '14px',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 320px' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '420px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <Icon name="search" size={16} />
                </span>
                <input
                  type="text"
                  placeholder="Search by vendor name, company, GSTIN, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 38px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Status:</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  background: '#fff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Vendors ({vendors.length})</option>
                <option value="active">Active Only ({vendors.filter(v => v.is_active).length})</option>
                <option value="inactive">Inactive ({vendors.filter(v => !v.is_active).length})</option>
              </select>
            </div>
          </div>

          {/* Vendors Table */}
          <div className="admin-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #cbd5e1', borderTopColor: '#065935', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ marginTop: '12px', fontSize: '13px' }}>Loading vendor directory...</p>
              </div>
            ) : filteredVendors.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>No vendors found</h3>
                <p style={{ margin: '6px 0 16px', fontSize: '13px', color: '#64748b' }}>
                  {searchQuery ? 'Try adjusting your search query or filter.' : 'Add your first wholesale vendor to start managing purchase costing.'}
                </p>
                <button
                  type="button"
                  onClick={openAddModal}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: '#065935',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  + Add Vendor
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '14px 18px' }}>Vendor & Company</th>
                      <th style={{ padding: '14px 18px' }}>Contact & Phone</th>
                      <th style={{ padding: '14px 18px' }}>GSTIN & Terms</th>
                      <th style={{ padding: '14px 18px' }}>City / Location</th>
                      <th style={{ padding: '14px 18px', textAlign: 'center' }}>Products</th>
                      <th style={{ padding: '14px 18px', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVendors.map((vendor, index) => (
                      <tr
                        key={vendor.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: index % 2 === 0 ? '#ffffff' : '#fafafa',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {/* Name & Company */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                            {vendor.name}
                          </div>
                          {vendor.company_name && (
                            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                              🏢 {vendor.company_name}
                            </div>
                          )}
                        </td>

                        {/* Contact & Phone */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ color: '#0f172a', fontWeight: 600 }}>
                            {vendor.contact_person || '—'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#065935', fontWeight: 600, marginTop: '2px' }}>
                            {vendor.phone ? `📞 ${vendor.phone}` : ''}
                          </div>
                          {vendor.email && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              ✉️ {vendor.email}
                            </div>
                          )}
                        </td>

                        {/* GSTIN & Terms */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#334155', fontSize: '12px' }}>
                            {vendor.gstin || <span style={{ color: '#94a3b8' }}>Unregistered</span>}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Terms: <span style={{ fontWeight: 600, color: '#0f172a' }}>{vendor.payment_terms || 'Net 30'}</span>
                          </div>
                        </td>

                        {/* City / Location */}
                        <td style={{ padding: '14px 18px' }}>
                          <div style={{ color: '#334155' }}>
                            {vendor.city ? `${vendor.city}${vendor.state ? `, ${vendor.state}` : ''}` : '—'}
                          </div>
                          {vendor.pincode && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              PIN: {vendor.pincode}
                            </div>
                          )}
                        </td>

                        {/* Products Linked */}
                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              background: Number(vendor.product_count) > 0 ? '#e0f2fe' : '#f1f5f9',
                              color: Number(vendor.product_count) > 0 ? '#0369a1' : '#64748b',
                              fontWeight: 700,
                              fontSize: '12px'
                            }}
                          >
                            {vendor.product_count || 0} items
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              background: vendor.is_active ? '#dcfce7' : '#fee2e2',
                              color: vendor.is_active ? '#15803d' : '#b91c1c'
                            }}
                          >
                            {vendor.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => openEditModal(vendor)}
                              title="Edit Vendor"
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#0f172a',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Icon name="edit" size={13} />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(vendor)}
                              title="Delete Vendor"
                              style={{
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #fee2e2',
                                background: '#fef2f2',
                                color: '#ef4444',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              <Icon name="trash" size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ADD / EDIT VENDOR MODAL */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={editingVendor ? `Edit Vendor: ${editingVendor.name}` : 'Add New Vendor / Supplier'}
          >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {errorMsg && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', fontSize: '12.5px', fontWeight: 600 }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <div>
                  <label className="admin-form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Vendor / Brand Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Madras Leather Works"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label className="admin-form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Registered Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MLW Enterprises Pvt Ltd"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div>
                  <label className="admin-form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label className="admin-form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label className="admin-form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="orders@vendor.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px' }}>
                <div>
                  <label className="admin-form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    GSTIN / Tax ID
                  </label>
                  <input
                    type="text"
                    placeholder="15-character GST Number (e.g. 33AAAAA0000A1Z5)"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label className="admin-form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Payment Terms
                  </label>
                  <select
                    value={formData.payment_terms}
                    onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
                  >
                    <option value="Immediate">Immediate / Advance</option>
                    <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                    <option value="Net 7">Net 7 Days</option>
                    <option value="Net 15">Net 15 Days</option>
                    <option value="Net 30">Net 30 Days</option>
                    <option value="Net 60">Net 60 Days</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="admin-form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Billing Address
                </label>
                <textarea
                  rows={2}
                  placeholder="Street address, industrial area, warehouse number..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="admin-form-input"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div>
                  <label className="admin-form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    City
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Chennai"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label className="admin-form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    State
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tamil Nadu"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                <div>
                  <label className="admin-form-label" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    PIN Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 600001"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="admin-form-input"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="vendor_is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#065935' }}
                />
                <label htmlFor="vendor_is_active" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Vendor is active for purchase orders and catalog assignments
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '9px 24px',
                    borderRadius: '8px',
                    background: '#065935',
                    color: '#fff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {saving ? 'Saving Vendor...' : (editingVendor ? 'Update Vendor' : 'Create Vendor')}
                </button>
              </div>
            </form>
          </Modal>
        </main>
      </div>
    </div>
  );
}

