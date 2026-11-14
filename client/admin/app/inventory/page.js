'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { useAdminAuth } from '../../lib/auth';
import {
  getAdminVariantStock,
  getAdminInventoryTransactions,
  adjustAdminVariantStock,
  getAdminBranches,
  getAdminBranchStocks,
  updateAdminBranchProductStock,
  pushAdminStockToMainBranch,
  lookupBarcode
} from '../../lib/api';

export default function AdminInventoryPage() {
  const { adminUser } = useAdminAuth();
  const isSuperAdmin = !adminUser || adminUser.role === 'admin';
  const userBranchId = adminUser?.branch_id ? String(adminUser.branch_id) : '3';

  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'stock' : 'branch_stock'); // 'stock' | 'branch_stock' | 'audit'
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(userBranchId);
  const [branchStocks, setBranchStocks] = useState([]);
  const [loadingBranchStocks, setLoadingBranchStocks] = useState(false);
  const [editingBranchStockId, setEditingBranchStockId] = useState(null);
  const [editingBranchStockVal, setEditingBranchStockVal] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
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

  // Barcode scan lookup
  const [scanCode, setScanCode] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');

  // Load variant stock
  const loadStock = (overrides = {}) => {
    const params = {
      search: overrides.search !== undefined ? overrides.search : search,
      low_stock_only: lowStockOnly
    };
    if (overrides.barcode) params.barcode = overrides.barcode;
    setLoading(true);
    getAdminVariantStock(params)
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

  // Load available branches
  useEffect(() => {
    getAdminBranches()
      .then(res => {
        if (res && Array.isArray(res.branches)) {
          setBranches(res.branches);
          if (adminUser?.branch_id) {
            setSelectedBranchId(String(adminUser.branch_id));
          } else if (res.branches.length > 0) {
            const firstBranch = res.branches.find(b => b.code !== 'MAIN') || res.branches[0];
            setSelectedBranchId(String(firstBranch.id));
          }
        }
      })
      .catch(err => console.warn('Failed to load branches:', err));
  }, [adminUser]);

  // Load branch stocks
  const loadBranchStocksData = (bId) => {
    const targetId = bId || selectedBranchId;
    if (!targetId) return;
    setLoadingBranchStocks(true);
    getAdminBranchStocks(targetId)
      .then(res => {
        setBranchStocks(res?.stocks || []);
      })
      .catch(err => {
        console.warn('Failed to load branch stocks:', err);
        setBranchStocks([]);
      })
      .finally(() => setLoadingBranchStocks(false));
  };

  useEffect(() => {
    if (activeTab === 'stock') {
      loadStock();
    } else if (activeTab === 'audit') {
      loadTransactions();
    } else if (activeTab === 'branch_stock') {
      loadBranchStocksData(selectedBranchId);
    }
  }, [activeTab, lowStockOnly, selectedBranchId]);

  const handleSaveBranchStock = async (productId) => {
    const newStock = parseInt(editingBranchStockVal, 10);
    if (Number.isNaN(newStock) || newStock < 0) {
      alert('Please enter a valid non-negative number for stock.');
      return;
    }
    try {
      await updateAdminBranchProductStock(selectedBranchId, productId, { stock: newStock });
      alert('✅ Branch stock quantity updated successfully.');
      setEditingBranchStockId(null);
      loadBranchStocksData(selectedBranchId);
    } catch (err) {
      alert(`Could not update stock: ${err.message || 'Server error'}`);
    }
  };

  const handleToggleBranchVisibility = async (item) => {
    try {
      const newStatus = item.is_active === 0 ? 1 : 0;
      await updateAdminBranchProductStock(selectedBranchId, item.product_id, { is_active: newStatus });
      loadBranchStocksData(selectedBranchId);
    } catch (err) {
      alert(`Could not toggle visibility: ${err.message || 'Server error'}`);
    }
  };

  const handlePushStockToMain = async (item) => {
    const branchStock = parseInt(item.stock, 10) || 0;
    if (branchStock <= 0) {
      alert(`Branch has 0 units of "${item.product_name}". Nothing to push to Main Branch.`);
      return;
    }
    const input = window.prompt(
      `Push "${item.product_name}" to Main Branch (Head Warehouse).\n\nAvailable in Branch: ${branchStock} units\nMain Store Stock: ${item.main_branch_stock ?? 0} units\n\nEnter number of units to transfer:`,
      '1'
    );
    if (!input) return;
    const qty = parseInt(input, 10);
    if (!qty || qty <= 0) {
      alert('Please enter a valid positive quantity.');
      return;
    }
    if (qty > branchStock) {
      alert(`Cannot transfer ${qty} units. Branch only has ${branchStock} units.`);
      return;
    }
    try {
      const res = await pushAdminStockToMainBranch(selectedBranchId, item.product_id, { quantity: qty });
      alert(res?.message || `🚀 Transferred ${qty} unit(s) of "${item.product_name}" to Main Branch!`);
      loadBranchStocksData(selectedBranchId);
    } catch (err) {
      alert(`Could not transfer stock: ${err.message || 'Server error'}`);
    }
  };

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
            onClick={() => setActiveTab('branch_stock')}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: activeTab === 'branch_stock' ? '#ffffff' : 'transparent',
              fontWeight: activeTab === 'branch_stock' ? 800 : 600,
              color: activeTab === 'branch_stock' ? '#065935' : '#64748b',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            🏢 Regional Branch Stocks & Transfers
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

      {/* REGIONAL BRANCH STOCKS & TRANSFERS TAB */}
      {activeTab === 'branch_stock' && (
        <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {/* Top Branch Filter & Search Header */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#fafafb', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                Select Branch:
              </label>
              {isSuperAdmin ? (
                <select
                  value={selectedBranchId}
                  onChange={(e) => {
                    setSelectedBranchId(e.target.value);
                    loadBranchStocksData(e.target.value);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #065935',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#065935',
                    background: '#ffffff',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  {branches.filter(b => b.code !== 'MAIN').map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              ) : (
                <span style={{ padding: '6px 12px', borderRadius: '8px', background: '#e0f2fe', color: '#0369a1', fontWeight: 800, fontSize: '13px' }}>
                  {branches.find(b => String(b.id) === String(selectedBranchId))?.name || 'Regional Branch'}
                </span>
              )}
              <button
                type="button"
                onClick={() => loadBranchStocksData(selectedBranchId)}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                🔄 Refresh
              </button>
            </div>

            {/* Product search in branch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search products in branch..."
                value={branchSearch}
                onChange={(e) => setBranchSearch(e.target.value)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  width: '260px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Table */}
          {loadingBranchStocks ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
              Loading branch stock inventory...
            </div>
          ) : branchStocks.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              No products found in this branch inventory yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '12px 16px' }}>#</th>
                    <th style={{ padding: '12px 16px' }}>PRODUCT & IDENTIFIERS</th>
                    <th style={{ padding: '12px 16px' }}>CATEGORY</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>PRICE / MRP</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>BRANCH STOCK</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>BRANCH VISIBILITY</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>MAIN STORE STOCK</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {branchStocks
                    .filter(item => {
                      if (!branchSearch.trim()) return true;
                      const q = branchSearch.toLowerCase();
                      return (
                        (item.product_name && item.product_name.toLowerCase().includes(q)) ||
                        (item.sku && item.sku.toLowerCase().includes(q)) ||
                        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
                        (item.category_name && item.category_name.toLowerCase().includes(q))
                      );
                    })
                    .map((item, idx) => {
                      const isZeroBranch = parseInt(item.stock, 10) === 0;
                      const isMainZero = parseInt(item.main_branch_stock ?? 0, 10) === 0;
                      const isEditing = editingBranchStockId === item.product_id;

                      return (
                        <tr key={item.product_id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fbfcfd' }}>
                          <td style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.product_name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', display: 'flex', gap: '8px' }}>
                              <span>ID: #{item.product_id}</span>
                              {item.sku && <span>SKU: {item.sku}</span>}
                              {item.barcode && <span style={{ fontWeight: 700, color: '#065935' }}>🏷️ {item.barcode}</span>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>
                            {item.category_name || 'General'}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, color: '#065935' }}>
                              ₹{Number(item.price || 0).toLocaleString('en-IN')}
                            </div>
                            {item.mrp && Number(item.mrp) > Number(item.price) && (
                              <div style={{ fontSize: '11px', color: '#94a3b8', textDecoration: 'line-through' }}>
                                ₹{Number(item.mrp).toLocaleString('en-IN')}
                              </div>
                            )}
                          </td>
                          {/* Branch Stock */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {isEditing ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  value={editingBranchStockVal}
                                  onChange={(e) => setEditingBranchStockVal(e.target.value)}
                                  style={{
                                    width: '75px',
                                    padding: '4px 6px',
                                    borderRadius: '6px',
                                    border: '2px solid #065935',
                                    textAlign: 'center',
                                    fontWeight: 800,
                                    fontSize: '13px'
                                  }}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveBranchStock(item.product_id)}
                                  style={{ padding: '4px 8px', background: '#065935', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingBranchStockId(null)}
                                  style={{ padding: '4px 8px', background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 10px',
                                  borderRadius: '6px',
                                  fontWeight: 800,
                                  fontSize: '13px',
                                  background: isZeroBranch ? '#fef2f2' : '#f0fdf4',
                                  color: isZeroBranch ? '#dc2626' : '#16a34a',
                                  border: `1px solid ${isZeroBranch ? '#fecaca' : '#bbf7d0'}`
                                }}
                              >
                                {item.stock} units
                              </span>
                            )}
                          </td>
                          {/* Visibility in Branch Toggle */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleToggleBranchVisibility(item)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '14px',
                                border: 'none',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                background: item.is_active === 0 ? '#f1f5f9' : '#dcfce7',
                                color: item.is_active === 0 ? '#64748b' : '#15803d',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                              title="Click to toggle product visibility in this branch's POS & searches"
                            >
                              <span>{item.is_active === 0 ? '⚪ Hidden' : '🟢 Visible'}</span>
                            </button>
                          </td>
                          {/* Main Store Stock */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <span style={{ fontWeight: 800, color: isMainZero ? '#dc2626' : '#0f172a' }}>
                                {item.main_branch_stock ?? 0} units
                              </span>
                              {isMainZero && (
                                <span style={{ fontSize: '10px', fontWeight: 800, background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '4px', border: '1px solid #fca5a5' }}>
                                  ⚠️ 0 in Main
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Actions */}
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {!isEditing && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBranchStockId(item.product_id);
                                    setEditingBranchStockVal(String(item.stock));
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    background: '#f8fafc',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '5px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    color: '#1e293b',
                                    cursor: 'pointer'
                                  }}
                                  title="Edit branch stock directly"
                                >
                                  ✎ Qty
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePushStockToMain(item)}
                                  style={{
                                    padding: '4px 10px',
                                    background: isMainZero ? '#dc2626' : '#0f172a',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    fontSize: '11.5px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    boxShadow: isMainZero ? '0 1px 4px rgba(220, 38, 38, 0.3)' : 'none'
                                  }}
                                  title={isMainZero ? 'Main Store has 0 stock! Click to transfer quantity to Main Branch' : 'Transfer quantity from this branch to Main Store'}
                                >
                                  <span>🚀 Push to Main</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
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

