'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icons';
import {
  getAdminSalespersonReport,
  createAdminSalesperson,
  updateAdminSalesperson,
  deleteAdminSalesperson
} from '../../lib/api';

export default function AdminSalespersonsPage() {
  const [report, setReport] = useState({
    summary: {
      total_staff: 0,
      active_staff: 0,
      total_bills: 0,
      total_sales_volume: 0,
      total_commission_due: 0,
      average_order_value: 0
    },
    staff: [],
    recent_sales: []
  });
  const [loading, setLoading] = useState(true);

  // Timeframe filter state: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  const [period, setPeriod] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Add & Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    phone: '',
    commission_percent: 2.0,
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const params = { period };
      if (period === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      const data = await getAdminSalespersonReport(params);
      if (data) {
        setReport({
          summary: data.summary || {
            total_staff: 0,
            active_staff: 0,
            total_bills: 0,
            total_sales_volume: 0,
            total_commission_due: 0,
            average_order_value: 0
          },
          staff: Array.isArray(data.staff) ? data.staff : [],
          recent_sales: Array.isArray(data.recent_sales) ? data.recent_sales : []
        });
      }
    } catch (err) {
      showToast(err.message || 'Failed to fetch sales staff report', 'error');
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const openAddModal = () => {
    setEditingStaff(null);
    setErrorMsg('');
    setFormData({
      name: '',
      code: '',
      phone: '',
      commission_percent: 2.0,
      is_active: true
    });
    setIsModalOpen(true);
  };

  const openEditModal = (staff) => {
    setEditingStaff(staff);
    setErrorMsg('');
    setFormData({
      name: staff.name || '',
      code: staff.code || '',
      phone: staff.phone || '',
      commission_percent: staff.commission_percent !== undefined ? staff.commission_percent : (staff.commission_rate || 0),
      is_active: staff.is_active !== undefined ? Boolean(staff.is_active) : true
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Salesperson name is required');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');

      if (editingStaff) {
        await updateAdminSalesperson(editingStaff.id, formData);
        showToast(`Staff "${formData.name}" updated successfully.`);
      } else {
        await createAdminSalesperson(formData);
        showToast(`Staff "${formData.name}" added successfully.`);
      }

      setIsModalOpen(false);
      fetchReport();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save salesperson.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (staff) => {
    if (!window.confirm(`Delete salesperson "${staff.name}"? Historical orders will retain their attribution records.`)) return;

    try {
      await deleteAdminSalesperson(staff.id);
      showToast(`Salesperson "${staff.name}" deleted.`);
      fetchReport();
    } catch (err) {
      showToast(err.message || 'Failed to delete staff member', 'error');
    }
  };

  // Filter staff by search text
  const safeStaffList = Array.isArray(report?.staff) ? report.staff : [];
  const filteredStaff = safeStaffList.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.phone && s.phone.toLowerCase().includes(q))
    );
  });

  const formatCurrency = (val) => {
    return `₹${Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

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
                gap: '8px'
              }}
            >
              <span>{toastMessage.type === 'error' ? '⚠️' : '✓'}</span>
              <span>{toastMessage.text}</span>
            </div>
          )}

          {/* Header Row */}
          <div className="admin-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div>
              <h1 className="admin-page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                Sales Persons &amp; Commission Reports
              </h1>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                Analyze staff sales volume, completed bills, commission earnings, and manage counter attribution.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Link
                href="/pos"
                className="admin-btn admin-btn--outline"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: '13px',
                  textDecoration: 'none'
                }}
              >
                <span>POS Billing Register &rarr;</span>
              </Link>
              <button
                type="button"
                onClick={openAddModal}
                className="admin-btn admin-btn--primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#065935',
                  color: '#fff',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  border: 'none'
                }}
              >
                <Icon name="plus" size={16} />
                <span>Add Salesperson</span>
              </button>
            </div>
          </div>

          {/* Timeframe & Date Filter Strip */}
          <div
            className="admin-card"
            style={{
              padding: '14px 20px',
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '22px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            {/* Filter Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569', marginRight: '6px' }}>REPORT PERIOD:</span>
              {[
                { id: 'daily', label: 'Daily (Today)' },
                { id: 'weekly', label: 'Weekly (Last 7 Days)' },
                { id: 'monthly', label: 'Monthly (Last 30 Days)' },
                { id: 'yearly', label: 'Yearly (1 Year)' },
                { id: 'custom', label: 'Custom Range' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    border: 'none',
                    background: period === tab.id ? '#065935' : '#f1f5f9',
                    color: period === tab.id ? '#ffffff' : '#475569',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '260px' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                <Icon name="search" size={14} />
              </span>
              <input
                type="text"
                placeholder="Search staff by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
              />
            </div>

            {/* Custom Date Pickers */}
            {period === 'custom' && (
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>From Date:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>To Date:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
                <button
                  type="button"
                  onClick={fetchReport}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    background: '#065935',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Apply Dates
                </button>
              </div>
            )}
          </div>

          {/* 5 KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                No. of Sales Done
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', marginTop: '4px' }}>
                {report.summary.total_bills}
              </div>
              <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, marginTop: '2px' }}>
                Bills &amp; orders attributed
              </div>
            </div>

            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Total Attributed Sales
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#065935', marginTop: '4px' }}>
                {formatCurrency(report.summary.total_sales_volume)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Revenue in selected period
              </div>
            </div>

            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Total Commission Amount
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0284c7', marginTop: '4px' }}>
                {formatCurrency(report.summary.total_commission_due)}
              </div>
              <div style={{ fontSize: '11px', color: '#0369a1', fontWeight: 700, marginTop: '2px' }}>
                Commission earned / payout due
              </div>
            </div>

            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Average Ticket (AOV)
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#d97706', marginTop: '4px' }}>
                {formatCurrency(report.summary.average_order_value)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Per attributed order
              </div>
            </div>

            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Sales Team Strength
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#7c3aed', marginTop: '4px' }}>
                {report.summary.active_staff} Active
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                {report.summary.total_staff} registered staff
              </div>
            </div>
          </div>

          {/* Sales Staff Performance & Commission Report Table */}
          <div className="admin-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '26px' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  Salesperson Performance Breakdown ({period.toUpperCase()})
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                  Commission amounts calculated based on individual commission % rates
                </p>
              </div>
              <button
                type="button"
                onClick={fetchReport}
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  color: '#334155'
                }}
              >
                ↻ Refresh Report
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #cbd5e1', borderTopColor: '#065935', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ marginTop: '10px', fontSize: '13px' }}>Computing commission reports...</p>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px' }}>👥</div>
                <h4 style={{ margin: '8px 0 4px', fontSize: '15px', color: '#0f172a' }}>No salespersons found</h4>
                <p style={{ color: '#64748b', fontSize: '12.5px', margin: '0 0 14px' }}>Add your first staff member to track sales commissions.</p>
                <button
                  type="button"
                  onClick={openAddModal}
                  style={{ padding: '8px 16px', borderRadius: '6px', background: '#065935', color: '#fff', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}
                >
                  + Add Salesperson
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '12px 18px' }}>SALESPERSON / CODE</th>
                      <th style={{ padding: '12px 18px' }}>CONTACT PHONE</th>
                      <th style={{ padding: '12px 18px', textAlign: 'center' }}>COMMISSION RATE</th>
                      <th style={{ padding: '12px 18px', textAlign: 'center' }}>NO. OF SALES DONE</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>SALES VOLUME (₹)</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>TOTAL COMMISSION (₹)</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>AOV (₹)</th>
                      <th style={{ padding: '12px 18px', textAlign: 'center' }}>STATUS</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((staff, idx) => (
                      <tr
                        key={staff.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: idx % 2 === 0 ? '#ffffff' : '#fafafa'
                        }}
                      >
                        {/* Name & Code */}
                        <td style={{ padding: '12px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#ecfdf5',
                                color: '#065935',
                                fontWeight: 900,
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid #a7f3d0'
                              }}
                            >
                              {staff.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                                {staff.name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                                {staff.code || `SP-${staff.id}`}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Phone */}
                        <td style={{ padding: '12px 18px', color: '#475569' }}>
                          {staff.phone ? (
                            <span style={{ fontWeight: 600 }}>📞 {staff.phone}</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>No phone recorded</span>
                          )}
                        </td>

                        {/* Commission Rate */}
                        <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: '#f0fdf4',
                              color: '#15803d',
                              fontWeight: 800,
                              fontSize: '12px',
                              border: '1px solid #bbf7d0'
                            }}
                          >
                            {staff.commission_percent}%
                          </span>
                        </td>

                        {/* No. of Sales Done */}
                        <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '4px 10px',
                              borderRadius: '12px',
                              background: staff.no_of_sales_done > 0 ? '#e0f2fe' : '#f1f5f9',
                              color: staff.no_of_sales_done > 0 ? '#0369a1' : '#64748b',
                              fontWeight: 800,
                              fontSize: '12.5px'
                            }}
                          >
                            {staff.no_of_sales_done} bills
                          </span>
                        </td>

                        {/* Sales Volume */}
                        <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 900, color: '#0f172a', fontSize: '13.5px' }}>
                          {formatCurrency(staff.total_sales_volume)}
                        </td>

                        {/* Total Commission Amount */}
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 900, color: '#065935', fontSize: '14px' }}>
                            {formatCurrency(staff.total_commission_amount)}
                          </span>
                        </td>

                        {/* AOV */}
                        <td style={{ padding: '12px 18px', textAlign: 'right', color: '#475569', fontWeight: 700 }}>
                          {formatCurrency(staff.aov)}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '3px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: staff.is_active ? '#dcfce7' : '#fee2e2',
                              color: staff.is_active ? '#15803d' : '#b91c1c'
                            }}
                          >
                            {staff.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => openEditModal(staff)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#0f172a',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
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
                              onClick={() => handleDelete(staff)}
                              style={{
                                padding: '5px 7px',
                                borderRadius: '6px',
                                border: '1px solid #fee2e2',
                                background: '#fef2f2',
                                color: '#dc2626',
                                fontSize: '11.5px',
                                cursor: 'pointer'
                              }}
                              title="Delete Salesperson"
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

          {/* Recent Attributed Orders Stream */}
          <div className="admin-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                Recent Attributed Sales &amp; Commission Activity
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                Transactions tagged to registered staff members in current timeframe
              </p>
            </div>

            {(!report.recent_sales || report.recent_sales.length === 0) ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                No attributed sales in this timeframe. Make sales via POS Billing and select a sales staff member.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 800 }}>
                      <th style={{ padding: '10px 18px' }}>DATE / TIME</th>
                      <th style={{ padding: '10px 18px' }}>BILL / ORDER #</th>
                      <th style={{ padding: '10px 18px' }}>SALESPERSON</th>
                      <th style={{ padding: '10px 18px' }}>CUSTOMER</th>
                      <th style={{ padding: '10px 18px' }}>PAYMENT</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right' }}>BILL AMOUNT</th>
                      <th style={{ padding: '10px 18px', textAlign: 'right' }}>COMMISSION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.recent_sales.map((order, oIdx) => (
                      <tr key={order.id || oIdx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 18px', color: '#64748b', fontSize: '12px' }}>
                          {formatDate(order.created_at)}
                        </td>
                        <td style={{ padding: '10px 18px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#065935' }}>
                            {order.order_number}
                          </span>
                        </td>
                        <td style={{ padding: '10px 18px', fontWeight: 700, color: '#0f172a' }}>
                          {order.sales_person_name}
                        </td>
                        <td style={{ padding: '10px 18px', color: '#334155' }}>
                          {order.customer_name || 'Walk-in'}
                        </td>
                        <td style={{ padding: '10px 18px', fontWeight: 600, color: '#64748b' }}>
                          {(order.payment_method || 'Cash').toUpperCase()}
                        </td>
                        <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                          {formatCurrency(order.total_amount)}
                        </td>
                        <td style={{ padding: '10px 18px', textAlign: 'right', fontWeight: 800, color: '#065935' }}>
                          +{formatCurrency(order.commission_earned)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ADD / EDIT SALESPERSON MODAL */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={editingStaff ? `Edit Salesperson: ${editingStaff.name}` : 'Add New Salesperson'}
          >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {errorMsg && (
                <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', fontSize: '12.5px', fontWeight: 600 }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Employee Code (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SP-05"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit mobile"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Commission Rate (%) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  placeholder="e.g. 2.0"
                  value={formData.commission_percent}
                  onChange={(e) => setFormData({ ...formData, commission_percent: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                  Commission amount is automatically calculated as ({formData.commission_percent || 0}% of each completed bill total).
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="staff_is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#065935' }}
                />
                <label htmlFor="staff_is_active" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
                  Active salesperson (Available in POS counter dropdowns)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ padding: '9px 24px', borderRadius: '8px', background: '#065935', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}
                >
                  {saving ? 'Saving...' : (editingStaff ? 'Update Salesperson' : 'Create Salesperson')}
                </button>
              </div>
            </form>
          </Modal>
        </main>
      </div>
    </div>
  );
}

