'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { getAdminVariantStock, getAdminInventoryTransactions, adjustAdminVariantStock } from '../../lib/api';

export default function AdminInventoryPage() {
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' | 'audit'
  const [variants, setVariants] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Stock Adjust Modal
  const [adjustModalItem, setAdjustModalItem] = useState(null);
  const [newStockVal, setNewStockVal] = useState('');
  const [adjustReason, setAdjustReason] = useState('Stock Count Correction');
  const [adjusting, setAdjusting] = useState(false);

  // Load variant stock
  const loadStock = () => {
    setLoading(true);
    getAdminVariantStock({ search, low_stock_only: lowStockOnly })
      .then(res => {
        if (Array.isArray(res)) setVariants(res);
      })
      .catch(err => console.error('Failed to load stock:', err))
      .finally(() => setLoading(false));
  };

  // Load audit transactions
  const loadTransactions = () => {
    setLoading(true);
    getAdminInventoryTransactions({ limit: 100 })
      .then(res => {
        const list = res?.transactions || res || [];
        if (Array.isArray(list)) setTransactions(list);
      })
      .catch(err => console.error('Failed to load audit transactions:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'stock') {
      loadStock();
    } else {
      loadTransactions();
    }
  }, [activeTab, lowStockOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (activeTab === 'stock') loadStock();
  };

  // Adjust stock handler
  const handleSaveStockAdjustment = async () => {
    if (!adjustModalItem) return;
    setAdjusting(true);
    try {
      await adjustAdminVariantStock({
        variant_id: adjustModalItem.id,
        new_stock: parseInt(newStockVal, 10),
        reason: adjustReason.trim() || 'Manual Adjustment'
      });
      setAdjustModalItem(null);
      loadStock();
      alert('✓ Stock quantity updated and recorded in audit log!');
    } catch (err) {
      alert(`Error updating stock: ${err.message}`);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Stock & Inventory Control" />
        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                Inventory Tracking & Audit Trail
              </h1>
              <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
                Real-time stock across product variants and immutable transaction history for POS and online sales.
              </p>
            </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('stock')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'stock' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'stock' ? 800 : 600,
              color: activeTab === 'stock' ? '#065935' : '#64748b',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            📦 Variant Stock Levels
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'audit' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'audit' ? 800 : 600,
              color: activeTab === 'audit' ? '#065935' : '#64748b',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            📋 Audit Log History
          </button>
        </div>
      </div>

      {/* TAB 1: Live Variant Stock */}
      {activeTab === 'stock' && (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          {/* Filter Bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Filter by product, SKU, or color..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '280px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
              <button
                type="submit"
                style={{ background: '#065935', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
              >
                Search
              </button>
            </form>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
              />
              <span>⚠️ Show Low Stock Only (≤ Threshold)</span>
            </label>
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Loading variant stock levels...</div>
          ) : variants.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>No product variants found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px 18px' }}>Product</th>
                  <th style={{ padding: '12px 14px' }}>Color / Size</th>
                  <th style={{ padding: '12px 14px' }}>SKU</th>
                  <th style={{ padding: '12px 14px' }}>Barcode</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Price</th>
                  <th style={{ padding: '12px 18px', textAlign: 'center' }}>Stock Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const isLow = v.stock_quantity <= (v.threshold || 5);
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 18px', fontWeight: 700, color: '#0f172a' }}>
                        {v.product_name}
                      </td>
                      <td style={{ padding: '14px 14px', color: '#334155' }}>
                        <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: v.color_hex || '#000', marginRight: '6px' }} />
                        {v.color_name} {v.size_name ? `· ${v.size_name}` : ''}
                      </td>
                      <td style={{ padding: '14px 14px', fontFamily: 'monospace', color: '#64748b', fontSize: '12px' }}>
                        {v.sku || '—'}
                      </td>
                      <td style={{ padding: '14px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#065935' }}>
                        {v.barcode || '—'}
                      </td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 600 }}>
                        ₹{Number(v.sale_price > 0 ? v.sale_price : v.price).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <span
                          style={{
                            background: isLow ? '#fef2f2' : '#f0fdf4',
                            color: isLow ? '#b91c1c' : '#15803d',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '12px'
                          }}
                        >
                          {v.stock_quantity} units {isLow ? '⚠️ LOW' : '✓ OK'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustModalItem(v);
                            setNewStockVal(String(v.stock_quantity));
                          }}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 2: Immutable Inventory Audit Log */}
      {activeTab === 'audit' && (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#334155' }}>
              RECENT STOCK MOVEMENT AUDIT TRAIL ({transactions.length})
            </span>
            <button
              type="button"
              onClick={loadTransactions}
              style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              🔄 Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Loading audit transactions...</div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
              No inventory transactions recorded yet. Stock movements from POS or online orders will be logged here.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '10px 18px' }}>Date / Time</th>
                  <th style={{ padding: '10px 14px' }}>Product & Variant</th>
                  <th style={{ padding: '10px 14px' }}>Type</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Change</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Balance After</th>
                  <th style={{ padding: '10px 18px' }}>Reference & Notes</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isNegative = tx.change_qty < 0;
                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 18px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(tx.created_at).toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{tx.product_name || tx.product_id}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          SKU: {tx.variant_sku} {tx.color ? `· ${tx.color}` : ''} {tx.size ? `· ${tx.size}` : ''}
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: isNegative ? '#b91c1c' : '#15803d' }}>
                        {isNegative ? tx.change_qty : `+${tx.change_qty}`}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>
                        {tx.balance_after}
                      </td>
                      <td style={{ padding: '12px 18px', color: '#475569', fontSize: '12px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{tx.reference || '—'}</span>
                        {tx.notes && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{tx.notes}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustModalItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: '#ffffff', borderRadius: '14px', maxWidth: '420px', width: '100%', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>
              Adjust Stock Quantity
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
              {adjustModalItem.product_name} ({adjustModalItem.color_name} {adjustModalItem.size_name || ''})
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                New Stock Quantity:
              </label>
              <input
                type="number"
                min="0"
                value={newStockVal}
                onChange={(e) => setNewStockVal(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 700 }}
              />
              <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                Current stock: {adjustModalItem.stock_quantity} units
              </span>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
                Audit Reason / Reference:
              </label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g. Stock Count Correction"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setAdjustModalItem(null)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={adjusting}
                onClick={handleSaveStockAdjustment}
                style={{ background: '#065935', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 16px', fontSize: '13px', fontWeight: 700, cursor: adjusting ? 'not-allowed' : 'pointer' }}
              >
                {adjusting ? 'Saving...' : 'Save & Log Audit'}
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

