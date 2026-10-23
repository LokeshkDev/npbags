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
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                        <div style={{ width: '32px', height: '32px', border: '3px solid #eee', borderTopColor: 'var(--brand-green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                        <span style={{ color: 'var(--muted)', fontSize: '13.5px' }}>Loading registered customers...</span>
                      </td>
                    </tr>
                  ) : filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '48px 20px' }}>
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

                          {/* Contact: Email & Phone */}
                          <td>
                            <div style={{ fontSize: '13.5px', color: 'var(--ink)' }}>
                              {cust.email}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                              {cust.phone ? `📞 ${cust.phone}` : 'No phone registered'}
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
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                  📞 {customerDetail?.phone || selectedCustomer?.phone || 'No phone provided'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Total Orders</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0284c7' }}>
                    {customerDetail?.orders ? customerDetail.orders.length : selectedCustomer?.total_orders || 0}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Lifetime Spend</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#065935' }}>
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
                <div style={{ display: 'grid', gap: '10px', maxHeight: '340px', overflowY: 'auto' }}>
                  {customerDetail.orders.map((ord) => (
                    <div
                      key={ord.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #ebe6df',
                        borderRadius: '10px',
                        padding: '14px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
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
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                          Placed on {ord.created_at ? new Date(ord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
                          {ord.payment_method && ` • ${ord.payment_method.toUpperCase()}`}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: 800, color: '#065935' }}>
                          ₹{parseFloat(ord.total_amount || 0).toFixed(2)}
                        </div>
                      </div>
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

    </div>
  );
}

