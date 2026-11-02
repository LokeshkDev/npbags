'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icons';
import {
  getAdminCustomers,
  getAdminCustomerById,
  createAdminCustomer,
  updateAdminCustomer,
  deleteAdminCustomer,
  resetAdminCustomerPassword
} from '../../lib/api';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Active customer for edit / reset / detail
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [viewingBill, setViewingBill] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'customer',
    password: ''
  });
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'customer'
  });
  const [resetPassword, setResetPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status message
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  const showToast = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 4000);
  };

  // Fetch all customers
  const loadCustomers = async (searchTerm = '') => {
    setLoading(true);
    try {
      const data = await getAdminCustomers(searchTerm);
      if (Array.isArray(data)) {
        setCustomers(data);
      }
    } catch (err) {
      showToast('error', err.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers(search);
  }, []);

  // Search handler with debounce effect
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    loadCustomers(val);
  };

  // Filter customers by role
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      if (roleFilter === 'all') return true;
      return (c.role || 'customer') === roleFilter;
    });
  }, [customers, roleFilter]);

  // Total stats
  const totalOrdersSum = useMemo(() => {
    return customers.reduce((acc, c) => acc + (Number(c.total_orders) || 0), 0);
  }, [customers]);

  const totalRevenueSum = useMemo(() => {
    return customers.reduce((acc, c) => acc + (parseFloat(c.total_spent) || 0), 0);
  }, [customers]);

  // CREATE CUSTOMER
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name || !createForm.email || !createForm.phone || !createForm.phone.trim() || !createForm.password) {
      showToast('error', 'Name, email, phone number, and password are required.');
      return;
    }
    if (createForm.password.length < 6) {
      showToast('error', 'Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await createAdminCustomer(createForm);
      showToast('success', `Customer ${createForm.name} created successfully!`);
      setIsCreateOpen(false);
      setCreateForm({ name: '', email: '', phone: '', role: 'customer', password: '' });
      loadCustomers(search);
    } catch (err) {
      showToast('error', err.message || 'Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  // OPEN EDIT MODAL
  const openEditModal = (cust) => {
    setSelectedCustomer(cust);
    setEditForm({
      name: cust.name || '',
      email: cust.email || '',
      phone: cust.phone || '',
      role: cust.role || 'customer'
    });
    setIsEditOpen(true);
  };

  // EDIT SUBMIT
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    setSubmitting(true);
    try {
      await updateAdminCustomer(selectedCustomer.id, editForm);
      showToast('success', `Customer ${editForm.name} updated successfully!`);
      setIsEditOpen(false);
      setSelectedCustomer(null);
      loadCustomers(search);
    } catch (err) {
      showToast('error', err.message || 'Failed to update customer');
    } finally {
      setSubmitting(false);
    }
  };

  // OPEN RESET PASSWORD MODAL
  const openResetModal = (cust) => {
    setSelectedCustomer(cust);
    setResetPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setIsResetOpen(true);
  };

  // RESET PASSWORD SUBMIT
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    if (!resetPassword || resetPassword.length < 6) {
      showToast('error', 'Password must be at least 6 characters long.');
      return;
    }
    if (resetPassword !== confirmPassword) {
      showToast('error', 'Passwords do not match. Please retype carefully.');
      return;
    }

    setSubmitting(true);
    try {
      await resetAdminCustomerPassword(selectedCustomer.id, resetPassword);
      showToast('success', `Password for ${selectedCustomer.name} (${selectedCustomer.email}) has been reset!`);
      setIsResetOpen(false);
      setSelectedCustomer(null);
      setResetPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast('error', err.message || 'Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick generate random secure password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 10; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResetPassword(res);
    setConfirmPassword(res);
    setShowPassword(true);
  };

  // OPEN DETAILS MODAL
  const openDetailModal = async (cust) => {
    setSelectedCustomer(cust);
    setCustomerDetail(null);
    setIsDetailOpen(true);
    setLoadingDetail(true);

    try {
      const data = await getAdminCustomerById(cust.id);
      setCustomerDetail(data);
    } catch (err) {
      setCustomerDetail(cust);
    } finally {
      setLoadingDetail(false);
    }
  };

  // DELETE CUSTOMER
  const handleDeleteCustomer = async (cust) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete customer "${cust.name}" (${cust.email})? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      await deleteAdminCustomer(cust.id);
      showToast('success', `Customer ${cust.name} deleted successfully.`);
      loadCustomers(search);
    } catch (err) {
      showToast('error', err.message || 'Failed to delete customer');
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Registered Customers & User Directory" />

        <div className="admin-content">
          {/* Toast Notification */}
          {statusMsg.text && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: '8px',
                marginBottom: '20px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: statusMsg.type === 'success' ? '#edf7f0' : '#fdeced',
                color: statusMsg.type === 'success' ? '#065935' : '#c8102e',
                border: statusMsg.type === 'success' ? '1px solid #c9ebd4' : '1px solid #f8c9cd'
              }}
            >
              <Icon name={statusMsg.type === 'success' ? 'check' : 'close'} size={18} />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Page Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>Customer Accounts</h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                Manage registered customer records, inspect orders, edit details, and reset passwords.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => loadCustomers(search)}
                title="Refresh list"
              >
                Refresh
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={() => setIsCreateOpen(true)}
              >
                <Icon name="plus" size={16} />
                <span>Add Customer</span>
              </button>
            </div>
          </div>

          {/* KPI Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="stat-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                Registered Customers
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--ink)', marginTop: '6px' }}>
                {customers.length}
              </div>
              <div style={{ fontSize: '12px', color: '#065935', marginTop: '4px', fontWeight: 600 }}>
                {customers.filter(c => c.role === 'customer').length} Shoppers • {customers.filter(c => c.role === 'admin').length} Admins
              </div>
            </div>

            <div className="stat-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                Active Buyers
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#065935', marginTop: '6px' }}>
                {customers.filter(c => Number(c.total_orders) > 0).length}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                Customers who placed at least 1 order
              </div>
            </div>

            <div className="stat-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                Total Orders Placed
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--ink)', marginTop: '6px' }}>
                {totalOrdersSum}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                Linked to registered accounts
              </div>
            </div>

            <div className="stat-card" style={{ padding: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
                Customer Revenue
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--brand-red)', marginTop: '6px' }}>
                ₹{totalRevenueSum.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                Lifetime value from users
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div style={{
            background: '#ffffff',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid var(--border-light, #e5e0d8)',
            marginBottom: '20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '260px', maxWidth: '440px' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'grid' }}>
                <Icon name="search" size={16} />
              </span>
              <input
                type="text"
                placeholder="Search customers by name, email, or phone..."
                value={search}
                onChange={handleSearchChange}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px',
                  borderRadius: '8px',
                  border: '1px solid #dcd7ce',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); loadCustomers(''); }}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#999',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>Filter by Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #dcd7ce',
                  fontSize: '13px',
                  background: '#fff',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All Roles ({customers.length})</option>
                <option value="customer">Customers Only ({customers.filter(c => c.role === 'customer').length})</option>
                <option value="admin">Administrators ({customers.filter(c => c.role === 'admin').length})</option>
              </select>
            </div>
          </div>

          {/* Customers Data Table */}
          <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                    <th>Customer Name</th>
                    <th>Contact Details</th>
                    <th>NPPoints</th>
                    <th>Role</th>
                    <th>Orders Count</th>
                    <th>Total Spent</th>
                    <th>Registered Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ width: '32px', height: '32px', border: '3px solid #eee', borderTopColor: 'var(--brand-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                        <span style={{ color: 'var(--muted)', fontSize: '13.5px' }}>Loading registered customers...</span>
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '48px 20px' }}>
                        <div style={{ fontSize: '36px', marginBottom: '8px' }}>👥</div>
                        <div style={{ fontWeight: 600, fontSize: '16px', color: 'var(--ink)' }}>No customers found</div>
                        <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                          {search ? 'No registered users match your search query.' : 'There are currently no registered users.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((cust, idx) => {
                      const initials = (cust.name || 'U')
                        .split(' ')
                        .map(p => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      const ordersCount = Number(cust.total_orders) || 0;
                      const spent = parseFloat(cust.total_spent) || 0;

                      return (
                        <tr key={cust.id} style={{ borderBottom: '1px solid #f0ede8' }}>
                          <td style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                            {idx + 1}
                          </td>

                          {/* Customer Name & Avatar */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                background: cust.role === 'admin' ? '#ede9fe' : '#edf7f0',
                                color: cust.role === 'admin' ? '#6d28d9' : '#065935',
                                fontWeight: 700,
                                fontSize: '13px',
                                display: 'grid',
                                placeItems: 'center',
                                flexShrink: 0
                              }}>
                                {initials}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ink)' }}>
                                  {cust.name}
                                </div>
                                <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                                  User ID: #{cust.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Contact: Email & Phone + WhatsApp & Call */}
                          <td>
                            <div style={{ fontSize: '13.5px', color: 'var(--ink)' }}>
                              {cust.email}
                            </div>
                            {cust.phone ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', color: '#334155', fontWeight: 600 }}>
                                  📞 {cust.phone}
                                </span>
                                <a
                                  href={`https://wa.me/91${String(cust.phone).replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hello ${cust.name || 'Customer'}, greetings from NP Grand!`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Chat on WhatsApp"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    background: '#25D366',
                                    color: '#ffffff',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    textDecoration: 'none'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  💬 WhatsApp
                                </a>
                                <a
                                  href={`tel:${String(cust.phone).replace(/[^\d+]/g, '')}`}
                                  title="Call Customer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    background: '#0284c7',
                                    color: '#ffffff',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    textDecoration: 'none'
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  📞 Call
                                </a>
                              </div>
                            ) : (
                              <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '2px' }}>
                                No phone registered
                              </div>
                            )}
                          </td>

                          {/* NPPoints Badge */}
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', background: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: '11.5px' }}>
                              ⭐ {cust.np_points || 0} pts
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                              ₹{((Number(cust.np_points) || 0) * 0.25).toFixed(2)} value
                            </div>
                          </td>

                          {/* Role Badge */}
                          <td>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '3px 9px',
                              borderRadius: '12px',
                              background: cust.role === 'admin' ? '#ede9fe' : '#edf7f0',
                              color: cust.role === 'admin' ? '#6d28d9' : '#065935'
                            }}>
                              {cust.role || 'customer'}
                            </span>
                          </td>

                          {/* Orders Count */}
                          <td>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              padding: '3px 8px',
                              borderRadius: '8px',
                              background: ordersCount > 0 ? '#f0f9ff' : '#f4f4f5',
                              color: ordersCount > 0 ? '#0284c7' : '#71717a'
                            }}>
                              {ordersCount} {ordersCount === 1 ? 'order' : 'orders'}
                            </span>
                          </td>

                          {/* Total Spent */}
                          <td>
                            <span style={{ fontWeight: 700, fontSize: '14px', color: spent > 0 ? '#065935' : 'var(--muted)' }}>
                              ₹{spent.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                            </span>
                          </td>

                          {/* Joined Date */}
                          <td style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                            {cust.created_at ? new Date(cust.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>

                          {/* Action Buttons */}
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                              {/* View Details / Orders */}
                              <button
                                type="button"
                                onClick={() => openDetailModal(cust)}
                                className="admin-table-btn"
                                title="View Customer Profile & Orders"
                                aria-label="View Details"
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #dcd7ce',
                                  background: '#fff',
                                  cursor: 'pointer',
                                  color: '#065935'
                                }}
                              >
                                <Icon name="eye" size={15} />
                              </button>

                              {/* Edit Customer */}
                              <button
                                type="button"
                                onClick={() => openEditModal(cust)}
                                className="admin-table-btn"
                                title="Edit Customer Details"
                                aria-label="Edit Customer"
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #dcd7ce',
                                  background: '#fff',
                                  cursor: 'pointer',
                                  color: '#1d4ed8'
                                }}
                              >
                                <Icon name="edit" size={15} />
                              </button>

                              {/* Reset Password */}
                              <button
                                type="button"
                                onClick={() => openResetModal(cust)}
                                className="admin-table-btn"
                                title="Reset User Password"
                                aria-label="Reset Password"
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #dcd7ce',
                                  background: '#fff',
                                  cursor: 'pointer',
                                  color: '#b45309'
                                }}
                              >
                                <Icon name="key" size={15} />
                              </button>

                              {/* Delete Customer */}
                              <button
                                type="button"
                                onClick={() => handleDeleteCustomer(cust)}
                                className="admin-table-btn"
                                title="Delete Customer Account"
                                aria-label="Delete Customer"
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #dcd7ce',
                                  background: '#fff',
                                  cursor: 'pointer',
                                  color: 'var(--brand-red)'
                                }}
                              >
                                <Icon name="trash" size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          MODAL 1: CREATE CUSTOMER
          ======================================================== */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Customer"
        maxWidth="520px"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Anand Kumar"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="customer@domain.com"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="+91 98765 43210"
                value={createForm.phone}
                onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Account Role
              </label>
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box', background: '#fff' }}
              >
                <option value="customer">Customer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Temporary Initial Password * (min 6 characters)
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================
          MODAL 2: EDIT CUSTOMER DETAILS
          ======================================================== */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Edit Customer: ${selectedCustomer?.name || ''}`}
        maxWidth="520px"
      >
        <form onSubmit={handleEditSubmit} style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Full Name *
            </label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Email Address *
            </label>
            <input
              type="email"
              required
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Role
              </label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box', background: '#fff' }}
              >
                <option value="customer">Customer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => setIsEditOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================
          MODAL 3: RESET PASSWORD OF USER
          ======================================================== */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title="Reset Customer Password"
        maxWidth="480px"
      >
        <div style={{ background: '#fdfbf7', border: '1px solid #eee5d8', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ink)' }}>
            {selectedCustomer?.name}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px' }}>
            {selectedCustomer?.email}
          </div>
        </div>

        <form onSubmit={handleResetSubmit} style={{ display: 'grid', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600 }}>
                New Password *
              </label>
              <button
                type="button"
                onClick={generateRandomPassword}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#065935',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                🎲 Auto-Generate Password
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Confirm New Password *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #dcd7ce', fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="showPwd"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="showPwd" style={{ fontSize: '13px', color: 'var(--muted)', cursor: 'pointer' }}>
              Show password text
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => setIsResetOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={submitting}
              style={{ background: '#b45309', borderColor: '#b45309' }}
            >
              {submitting ? 'Resetting...' : 'Confirm Reset Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================
          MODAL 4: CUSTOMER DETAILS & ORDER HISTORY
          ======================================================== */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title="Customer Profile & Order History"
        maxWidth="740px"
      >
        {loadingDetail ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #eee', borderTopColor: 'var(--brand-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Loading customer profile...</span>
          </div>
        ) : (
          <div>
            {/* Customer Summary Card */}
            <div style={{
              background: '#faf8f5',
              border: '1px solid #ede8e0',
              borderRadius: '12px',
              padding: '18px 20px',
              marginBottom: '20px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                    {customerDetail?.name || selectedCustomer?.name}
                  </h3>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: '#edf7f0',
                    color: '#065935'
                  }}>
                    {customerDetail?.role || selectedCustomer?.role || 'customer'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px' }}>
                  ✉ {customerDetail?.email || selectedCustomer?.email}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>📞 {customerDetail?.phone || selectedCustomer?.phone || 'No phone provided'}</span>
                  {(customerDetail?.phone || selectedCustomer?.phone) && (
                    <>
                      <a
                        href={`https://wa.me/91${String(customerDetail?.phone || selectedCustomer?.phone).replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hello ${customerDetail?.name || selectedCustomer?.name || 'Customer'}, greetings from NP Grand!`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: '#25D366',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700,
                          textDecoration: 'none'
                        }}
                      >
                        💬 WhatsApp
                      </a>
                      <a
                        href={`tel:${String(customerDetail?.phone || selectedCustomer?.phone).replace(/[^\d+]/g, '')}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          background: '#0284c7',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700,
                          textDecoration: 'none'
                        }}
                      >
                        📞 Call
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ textAlign: 'right', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '6px 12px' }}>
                  <div style={{ fontSize: '10.5px', textTransform: 'uppercase', color: '#b45309', fontWeight: 800 }}>NPPoints Balance</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#b45309' }}>
                    ⭐ {customerDetail?.np_points !== undefined ? customerDetail.np_points : (selectedCustomer?.np_points || 0)} pts
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#78350f' }}>
                    Worth ₹{((Number(customerDetail?.np_points !== undefined ? customerDetail.np_points : (selectedCustomer?.np_points || 0))) * 0.25).toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Total Orders</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7' }}>
                    {customerDetail?.orders ? customerDetail.orders.length : selectedCustomer?.total_orders || 0}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Lifetime Spend</div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#065935' }}>
                    ₹{Number(selectedCustomer?.total_spent || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>

            {/* Orders Section */}
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px', color: 'var(--ink)' }}>
                Orders Placed ({customerDetail?.orders?.length || 0})
              </h4>

              {(!customerDetail?.orders || customerDetail.orders.length === 0) ? (
                <div style={{ background: '#fcfbf9', border: '1px dashed #dcd7ce', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
                    This customer has not placed any orders yet.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
                  {customerDetail.orders.map((ord) => (
                    <div
                      key={ord.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #ebe6df',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                              #{ord.order_number || ord.id}
                            </strong>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              background: ord.order_status === 'delivered' ? '#edf7f0' : '#fef8eb',
                              color: ord.order_status === 'delivered' ? '#065935' : '#b45309'
                            }}>
                              {ord.order_status || 'placed'}
                            </span>
                            {ord.order_type === 'pos' && (
                              <span style={{ fontSize: '10.5px', background: '#eaf4ee', color: '#065935', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                POS BILL
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                            Placed on {ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
                            {ord.payment_method && ` • ${ord.payment_method.toUpperCase()}`}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '16px', fontWeight: 800, color: '#065935' }}>
                              ₹{parseFloat(ord.total_amount || 0).toFixed(2)}
                            </div>
                            {Number(ord.points_earned) > 0 && (
                              <div style={{ fontSize: '10.5px', color: '#166534', fontWeight: 700 }}>
                                +{ord.points_earned} NPPoints
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewingBill(ord)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: '#065935',
                              color: '#ffffff',
                              border: 'none',
                              fontSize: '11.5px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              boxShadow: '0 1px 3px rgba(6, 89, 53, 0.2)'
                            }}
                          >
                            <span>📄</span>
                            <span>View Bill</span>
                          </button>
                        </div>
                      </div>

                      {/* Purchased Items List */}
                      {ord.items && ord.items.length > 0 && (
                        <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Purchased Items ({ord.items.reduce((s, it) => s + (Number(it.quantity) || 1), 0)}):</span>
                            <span>Rate / Amount</span>
                          </div>
                          <div style={{ display: 'grid', gap: '6px' }}>
                            {ord.items.map((item, itIdx) => (
                              <div
                                key={item.id || itIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: '#f8fafc',
                                  padding: '7px 10px',
                                  borderRadius: '6px',
                                  fontSize: '12px'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {item.image && (
                                    <img
                                      src={item.image}
                                      alt=""
                                      style={{ width: '28px', height: '34px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                  )}
                                  <div>
                                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.product_name}</div>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                                      Qty: <strong>{item.quantity}</strong> {item.selected_size ? `• Size: ${item.selected_size}` : ''} {item.selected_color ? `• Color: ${item.selected_color}` : ''}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontWeight: 800, color: '#0f172a' }}>
                                    ₹{Number(item.total_price || (item.price * (item.quantity || 1))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </div>
                                  <div style={{ fontSize: '10px', color: '#64748b' }}>
                                    @ ₹{Number(item.price).toFixed(2)} / ea
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setIsDetailOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================
          MODAL 5: DETAILED BILL RECEIPT / INVOICE VIEW
          ======================================================== */}
      <Modal
        isOpen={Boolean(viewingBill)}
        onClose={() => setViewingBill(null)}
        title={`Tax Invoice / Bill Receipt #${viewingBill?.order_number || viewingBill?.id}`}
        maxWidth="640px"
      >
        {viewingBill && (
          <div style={{ fontSize: '13px', color: '#0f172a' }}>
            {/* Header info */}
            <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#065935' }}>NP GRAND SHOPPING</h3>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>Omnichannel Fashion &amp; Retail Store</div>
                <div style={{ fontSize: '11.5px', color: '#64748b' }}>GSTIN: 33ABCDE1234F1Z5 • Chennai, TN</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                  Bill #{viewingBill.order_number || viewingBill.id}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                  Date: {new Date(viewingBill.created_at).toLocaleString('en-IN')}
                </div>
                <span style={{
                  display: 'inline-block',
                  marginTop: '4px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 800,
                  background: viewingBill.order_type === 'pos' ? '#ecfdf5' : '#f0f9ff',
                  color: viewingBill.order_type === 'pos' ? '#065935' : '#0369a1'
                }}>
                  {viewingBill.order_type === 'pos' ? 'POS RETAIL COUNTER' : 'ONLINE STORE ORDER'}
                </span>
              </div>
            </div>

            {/* Customer Details */}
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Billed To:</div>
                <div style={{ fontWeight: 800, fontSize: '13px', marginTop: '2px' }}>{customerDetail?.name || selectedCustomer?.name || 'Walk-in Customer'}</div>
                <div style={{ fontSize: '12px', color: '#475569' }}>Phone: {customerDetail?.phone || selectedCustomer?.phone || viewingBill.customer_phone || 'N/A'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Payment:</div>
                <div style={{ fontWeight: 800, fontSize: '13px', textTransform: 'uppercase', marginTop: '2px' }}>{viewingBill.payment_method || 'Cash'}</div>
                <div style={{ fontSize: '12px', color: '#065935', fontWeight: 700 }}>Status: {viewingBill.order_status ? viewingBill.order_status.toUpperCase() : 'DELIVERED'}</div>
              </div>
            </div>

            {/* Line items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', marginBottom: '16px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1.5px solid #cbd5e1', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: '#475569' }}>
                  <th style={{ padding: '8px 10px' }}>Item Description</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {(viewingBill.items || []).map((it, idx) => (
                  <tr key={it.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <strong style={{ color: '#0f172a' }}>{it.product_name}</strong>
                      {(it.selected_color || it.selected_size) && (
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {[it.selected_color, it.selected_size].filter(Boolean).join(' • ')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{it.quantity}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>₹{Number(it.price).toFixed(2)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800 }}>
                      ₹{Number(it.total_price || (it.price * it.quantity)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals Summary */}
            <div style={{ borderTop: '1.5px solid #0f172a', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '300px', marginLeft: 'auto', fontSize: '12.5px' }}>
              {Number(viewingBill.discount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                  <span>Discount Applied:</span>
                  <span style={{ fontWeight: 800 }}>-₹{Number(viewingBill.discount).toFixed(2)}</span>
                </div>
              )}
              {Number(viewingBill.points_discount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#15803d' }}>
                  <span>NPPoints Redeemed ({viewingBill.points_redeemed} pts):</span>
                  <span style={{ fontWeight: 800 }}>-₹{Number(viewingBill.points_discount).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '8px', fontSize: '15px', fontWeight: 900, color: '#065935' }}>
                <span>NET TOTAL:</span>
                <span>₹{Number(viewingBill.total_amount).toFixed(2)}</span>
              </div>
              {Number(viewingBill.points_earned) > 0 && (
                <div style={{ fontSize: '11px', color: '#166534', fontWeight: 800, textAlign: 'right', marginTop: '2px' }}>
                  ✨ NPPoints Earned on this Bill: +{viewingBill.points_earned} pts
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', marginTop: '20px', paddingTop: '14px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>GST Inclusive • Thank you for shopping with us!</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="admin-btn admin-btn-primary"
                  style={{ fontSize: '12px', padding: '7px 14px' }}
                >
                  🖨️ Print Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setViewingBill(null)}
                  className="admin-btn admin-btn-secondary"
                  style={{ fontSize: '12px', padding: '7px 14px' }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}

