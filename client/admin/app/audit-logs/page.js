'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Icon } from '../../components/Icons';
import { getAdminAuditLogs } from '../../lib/api';

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateRangePreset, setDateRangePreset] = useState('all'); // 'all', 'today', '7days', '30days', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected details modal
  const [activeLogModal, setActiveLogModal] = useState(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 30
      };

      if (actionFilter !== 'all') params.action = actionFilter;
      if (entityFilter !== 'all') params.entity = entityFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      // Compute dates based on preset
      const now = new Date();
      if (dateRangePreset === 'today') {
        const todayStr = now.toISOString().split('T')[0];
        params.startDate = todayStr;
        params.endDate = todayStr;
      } else if (dateRangePreset === '7days') {
        const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.startDate = d.toISOString().split('T')[0];
        params.endDate = now.toISOString().split('T')[0];
      } else if (dateRangePreset === '30days') {
        const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.startDate = d.toISOString().split('T')[0];
        params.endDate = now.toISOString().split('T')[0];
      } else if (dateRangePreset === 'custom' && startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }

      const res = await getAdminAuditLogs(params);
      if (res && Array.isArray(res.logs)) {
        setLogs(res.logs);
        setTotalCount(res.total || 0);
        setTotalPages(res.totalPages || 1);
      } else if (Array.isArray(res)) {
        setLogs(res);
        setTotalCount(res.length);
        setTotalPages(1);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, entityFilter, dateRangePreset, startDate, endDate, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handlePresetChange = (preset) => {
    setDateRangePreset(preset);
    setPage(1);
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'pos_sale':
        return { label: 'POS Sale', bg: '#ecfdf5', color: '#065935', border: '#a7f3d0' };
      case 'price_change':
        return { label: 'Price Change', bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
      case 'stock_adjust':
        return { label: 'Stock Adjust', bg: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
      case 'product_create':
        return { label: 'Product Created', bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
      case 'product_update':
        return { label: 'Product Updated', bg: '#fffbeb', color: '#b45309', border: '#fde68a' };
      case 'vendor_created':
      case 'vendor_updated':
        return { label: 'Vendor Updated', bg: '#f8fafc', color: '#334155', border: '#cbd5e1' };
      default:
        return { label: (action || 'Action').replace(/_/g, ' '), bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
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
          {/* Header */}
          <div className="admin-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div>
              <h1 className="admin-page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                Activity &amp; Audit Logs History
              </h1>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                Complete visual audit trail of product edits, price revisions, stock adjustments, vendor orders, and counter sales.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchLogs}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#334155',
                cursor: 'pointer'
              }}
            >
              <Icon name="refresh" size={14} />
              <span>Refresh Trail</span>
            </button>
          </div>

          {/* Quick Stat Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '22px' }}>
            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Logged Events
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginTop: '4px' }}>
                {totalCount}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Audit history records
              </div>
            </div>

            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                POS Register Sales
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#065935', marginTop: '4px' }}>
                {logs.filter(l => l.action === 'pos_sale').length} In View
              </div>
              <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '2px' }}>
                Walk-in transactions logged
              </div>
            </div>

            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Product Updates
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#b45309', marginTop: '4px' }}>
                {logs.filter(l => l.action === 'product_update' || l.action === 'price_change').length} In View
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Price &amp; info changes
              </div>
            </div>

            <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Security &amp; Integrity
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
                100% Tracked
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                Full staff accountability
              </div>
            </div>
          </div>

          {/* Filter Bar with Date Range Selection & Action Filters */}
          <div
            className="admin-card"
            style={{
              padding: '16px 20px',
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {/* Top Row: Presets & Search */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px' }}>
              {/* Date Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginRight: '4px' }}>Date Range:</span>
                {[
                  { id: 'all', label: 'All History' },
                  { id: 'today', label: 'Today' },
                  { id: '7days', label: 'Last 7 Days' },
                  { id: '30days', label: 'This Month (30d)' },
                  { id: 'custom', label: 'Custom Range' }
                ].map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetChange(preset.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: 'none',
                      background: dateRangePreset === preset.id ? '#065935' : '#f1f5f9',
                      color: dateRangePreset === preset.id ? '#ffffff' : '#334155'
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Text Search Box */}
              <div style={{ position: 'relative', width: '280px' }}>
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <Icon name="search" size={14} />
                </span>
                <input
                  type="text"
                  placeholder="Search user, action, notes..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
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
            </div>

            {/* Custom Date Range Pickers (Visible when 'custom' selected) */}
            {dateRangePreset === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>From Date:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>To Date:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
              </div>
            )}

            {/* Bottom Row: Action Type and Entity Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Action Type:</label>
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    background: '#fff',
                    outline: 'none'
                  }}
                >
                  <option value="all">All Actions</option>
                  <option value="pos_sale">POS Sales &amp; Invoices</option>
                  <option value="price_change">Price Changes</option>
                  <option value="stock_adjust">Stock Adjustments</option>
                  <option value="product_create">Product Additions</option>
                  <option value="product_update">Product Updates</option>
                  <option value="vendor_created">Vendor Created</option>
                  <option value="vendor_updated">Vendor Updated</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Category / Module:</label>
                <select
                  value={entityFilter}
                  onChange={(e) => {
                    setEntityFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    background: '#fff',
                    outline: 'none'
                  }}
                >
                  <option value="all">All Modules</option>
                  <option value="product">Products &amp; Costing</option>
                  <option value="order">Orders &amp; Walk-in Bills</option>
                  <option value="vendor">Vendors &amp; Suppliers</option>
                  <option value="salesperson">Sales Staff Attribution</option>
                </select>
              </div>
            </div>
          </div>

          {/* Visual Audit Logs Table */}
          <div className="admin-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #cbd5e1', borderTopColor: '#065935', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ marginTop: '12px', fontSize: '13px' }}>Loading visual audit history...</p>
              </div>
            ) : logs.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>No activity records found</h3>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
                  No audit entries match the selected filters or timeframe.
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '12px 18px' }}>TIMESTAMP</th>
                      <th style={{ padding: '12px 18px' }}>ACTION</th>
                      <th style={{ padding: '12px 18px' }}>AFFECTED ITEM (WITH IMAGE)</th>
                      <th style={{ padding: '12px 18px' }}>STAFF / OPERATOR</th>
                      <th style={{ padding: '12px 18px' }}>SUMMARY &amp; DETAILS</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>DETAILS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, index) => {
                      const badge = getActionBadge(log.action);
                      const hasImage = Boolean(log.product_image);

                      return (
                        <tr
                          key={log.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: index % 2 === 0 ? '#ffffff' : '#fafafa',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {/* Timestamp */}
                          <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '12.5px' }}>
                              {formatDate(log.created_at)}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                              ID #{log.id}
                            </div>
                          </td>

                          {/* Action Badge */}
                          <td style={{ padding: '12px 18px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 800,
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em'
                              }}
                            >
                              {badge.label}
                            </span>
                          </td>

                          {/* Affected Product (with image thumbnail) */}
                          <td style={{ padding: '12px 18px' }}>
                            {log.product_name || log.product_image ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {hasImage ? (
                                  <img
                                    src={log.product_image}
                                    alt={log.product_name || 'Product'}
                                    style={{
                                      width: '38px',
                                      height: '38px',
                                      objectFit: 'cover',
                                      borderRadius: '6px',
                                      border: '1px solid #e2e8f0',
                                      flexShrink: 0
                                    }}
                                  />
                                ) : (
                                  <div
                                    style={{
                                      width: '38px',
                                      height: '38px',
                                      borderRadius: '6px',
                                      background: '#f1f5f9',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '14px',
                                      flexShrink: 0
                                    }}
                                  >
                                    👜
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13px' }}>
                                    {log.product_name || `Product #${log.entity_id}`}
                                  </div>
                                  {log.product_price ? (
                                    <div style={{ fontSize: '11px', color: '#065935', fontWeight: 600 }}>
                                      ₹{log.product_price}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ) : log.order_number ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '16px' }}>🧾</span>
                                <div>
                                  <div style={{ fontWeight: 800, color: '#065935', fontFamily: 'monospace' }}>
                                    {log.order_number}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>Order Bill</div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ color: '#64748b', fontSize: '12px' }}>
                                {log.entity.toUpperCase()} #{log.entity_id || '—'}
                              </div>
                            )}
                          </td>

                          {/* Staff / User */}
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>
                              {log.user_name || 'Admin'}
                            </div>
                            {log.ip_address && (
                              <div style={{ fontSize: '10.5px', color: '#94a3b8', fontFamily: 'monospace' }}>
                                IP: {log.ip_address}
                              </div>
                            )}
                          </td>

                          {/* Summary / Notes */}
                          <td style={{ padding: '12px 18px', maxWidth: '320px' }}>
                            <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.4 }}>
                              {typeof log.details === 'object' && log.details !== null ? (
                                <span>
                                  {log.details.notes ||
                                    log.details.description ||
                                    (log.action === 'price_change'
                                      ? `Price changed: ₹${log.details.old_price} → ₹${log.details.new_price}`
                                      : log.action === 'stock_adjust'
                                      ? `Stock updated: ${log.details.old_stock} → ${log.details.new_stock}`
                                      : JSON.stringify(log.details).slice(0, 70))}
                                </span>
                              ) : (
                                <span>{String(log.details || '—')}</span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => setActiveLogModal(log)}
                              style={{
                                padding: '5px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                color: '#0f172a',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Inspect
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total entries)
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: page <= 1 ? '#f1f5f9' : '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: page <= 1 ? '#94a3b8' : '#0f172a',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: page <= 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    &larr; Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: page >= totalPages ? '#f1f5f9' : '#ffffff',
                      border: '1px solid #cbd5e1',
                      color: page >= totalPages ? '#94a3b8' : '#0f172a',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: page >= totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* INSPECT LOG MODAL */}
          {activeLogModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.7)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 99999,
                padding: '20px'
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setActiveLogModal(null);
              }}
            >
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  maxWidth: '560px',
                  width: '100%',
                  boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '18px' }}>🔍</span>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                      Audit Log #{activeLogModal.id} Details
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveLogModal(null)}
                    style={{ background: 'none', border: 'none', fontSize: '18px', fontWeight: 700, color: '#64748b', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>

                <div style={{ padding: '20px 22px', maxHeight: '70vh', overflowY: 'auto' }}>
                  {activeLogModal.product_image && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px' }}>
                      <img
                        src={activeLogModal.product_image}
                        alt="Product"
                        style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e2e8f0' }}
                      />
                      <div>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '14px' }}>
                          {activeLogModal.product_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#065935', fontWeight: 700, marginTop: '2px' }}>
                          Catalog Product ID #{activeLogModal.entity_id}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>ACTION</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', marginTop: '2px' }}>
                        {activeLogModal.action}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>OPERATOR / USER</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        {activeLogModal.user_name || 'Admin'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>TIMESTAMP</div>
                      <div style={{ fontSize: '13px', color: '#334155', marginTop: '2px' }}>
                        {formatDate(activeLogModal.created_at)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>IP ADDRESS</div>
                      <div style={{ fontSize: '13px', color: '#334155', fontFamily: 'monospace', marginTop: '2px' }}>
                        {activeLogModal.ip_address || '—'}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                    JSON DETAILS PAYLOAD
                  </div>
                  <pre
                    style={{
                      background: '#0f172a',
                      color: '#38bdf8',
                      padding: '14px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      overflowX: 'auto',
                      margin: 0
                    }}
                  >
                    {typeof activeLogModal.details === 'object'
                      ? JSON.stringify(activeLogModal.details, null, 2)
                      : String(activeLogModal.details)}
                  </pre>
                </div>

                <div style={{ padding: '14px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#fafaf9' }}>
                  <button
                    type="button"
                    onClick={() => setActiveLogModal(null)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '6px',
                      background: '#0f172a',
                      color: '#fff',
                      border: 'none',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

