'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Icon } from '../../components/Icons';
import { useAdminAuth } from '../../lib/auth';
import {
  getAdminBranches,
  getAdminCategories,
  getAdminBranchTransferCatalog,
  transferAdminBranchStock
} from '../../lib/api';

export default function BranchPushPage() {
  const { adminUser } = useAdminAuth();
  const isSuperAdmin = !adminUser || adminUser.role === 'admin';

  // Branches
  const [branches, setBranches] = useState([]);
  const [regionalBranchId, setRegionalBranchId] = useState('3'); // Default: Manali Branch (ID 3)

  // Direction: 'main_to_branch' | 'branch_to_main'
  const [direction, setDirection] = useState('main_to_branch');

  // Filters
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'source_available' | 'branch_has_stock' | 'branch_low' | 'branch_out'

  // Catalog data
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedProductIds, setExpandedProductIds] = useState(new Set());

  // Transfer state
  const [transferInputs, setTransferInputs] = useState({}); // key: `${productId}-${variantId || 'main'}` -> quantity
  const [transferringKey, setTransferringKey] = useState(null);
  const [transferringProduct, setTransferringProduct] = useState(null);
  const [toast, setToast] = useState(null);

  // Load branches & categories
  useEffect(() => {
    getAdminBranches()
      .then(res => {
        if (res?.branches && Array.isArray(res.branches)) {
          setBranches(res.branches);
          const nonMain = res.branches.find(b => b.code !== 'MAIN' && b.id !== 1);
          if (nonMain) {
            setRegionalBranchId(String(nonMain.id));
          }
        }
      })
      .catch(err => console.warn('Failed to load branches:', err));

    getAdminCategories()
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.categories || []);
        setCategories(list);
      })
      .catch(err => console.warn('Failed to load categories:', err));
  }, []);

  // Show Toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Source & Destination Branch resolution
  const mainBranch = useMemo(() => {
    return branches.find(b => b.id === 1 || b.code === 'MAIN') || { id: 1, name: 'Main Store', code: 'MAIN' };
  }, [branches]);

  const regionalBranch = useMemo(() => {
    return branches.find(b => String(b.id) === String(regionalBranchId)) || { id: Number(regionalBranchId) || 3, name: 'Manali Branch', code: 'MANALI' };
  }, [branches, regionalBranchId]);

  const sourceBranch = direction === 'main_to_branch' ? mainBranch : regionalBranch;
  const targetBranch = direction === 'main_to_branch' ? regionalBranch : mainBranch;

  // Load catalog data
  const loadCatalog = useCallback(async () => {
    if (!regionalBranchId) return;
    setLoading(true);
    try {
      const res = await getAdminBranchTransferCatalog({
        branch_id: regionalBranchId,
        category_id: selectedCategory,
        stock_filter: stockFilter,
        search: search.trim()
      });
      const prods = Array.isArray(res?.products) ? res.products : [];
      setProducts(prods);
      setExpandedProductIds(new Set(prods.map(p => p.id)));
    } catch (err) {
      console.error('Failed to load branch transfer catalog:', err);
      showToast(err.message || 'Failed to load transfer catalog', 'error');
    } finally {
      setLoading(false);
    }
  }, [regionalBranchId, selectedCategory, stockFilter, search]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // Accordion toggle helpers
  const toggleProductAccordion = (productId) => {
    setExpandedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const expandAllProducts = () => {
    setExpandedProductIds(new Set(products.map(p => p.id)));
  };

  const collapseAllProducts = () => {
    setExpandedProductIds(new Set());
  };

  // Handle transfer quantity input change
  const handleQtyChange = (productId, variantId, value, maxAvailable) => {
    const key = `${productId}-${variantId || 'main'}`;
    const cleanVal = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
    const clampedVal = cleanVal === '' ? '' : Math.min(cleanVal, Math.max(0, maxAvailable));
    setTransferInputs(prev => ({ ...prev, [key]: clampedVal }));
  };

  // Perform single transfer (item or variant)
  const handleSingleTransfer = async (product, variant = null) => {
    const key = `${product.id}-${variant?.id || 'main'}`;
    const qty = parseInt(transferInputs[key], 10);
    const available = variant
      ? (direction === 'main_to_branch' ? variant.main_stock : variant.branch_stock)
      : (direction === 'main_to_branch' ? product.main_stock : product.branch_stock);

    if (!qty || qty <= 0) {
      showToast('Enter a transfer quantity of at least 1.', 'error');
      return;
    }
    if (qty > available) {
      showToast(`Cannot transfer ${qty} unit(s). Only ${available} available at ${sourceBranch.name}.`, 'error');
      return;
    }

    setTransferringKey(key);
    try {
      const payload = {
        from_branch_id: sourceBranch.id,
        to_branch_id: targetBranch.id,
        items: [{
          product_id: product.id,
          variant_id: variant?.id || null,
          quantity: qty
        }]
      };

      const res = await transferAdminBranchStock(payload);
      showToast(res.message || `Transferred ${qty} unit(s) successfully!`, 'success');

      // Optimistically update local state
      setProducts(prev => prev.map(p => {
        if (p.id !== product.id) return p;
        if (!variant) {
          const delta = direction === 'main_to_branch' ? -qty : qty;
          return {
            ...p,
            main_stock: Math.max(0, p.main_stock + delta),
            branch_stock: Math.max(0, p.branch_stock - delta)
          };
        }
        const updatedVariants = p.variants.map(v => {
          if (v.id !== variant.id) return v;
          const delta = direction === 'main_to_branch' ? -qty : qty;
          return {
            ...v,
            main_stock: Math.max(0, v.main_stock + delta),
            branch_stock: Math.max(0, v.branch_stock - delta)
          };
        });
        const mainTotal = updatedVariants.reduce((sum, v) => sum + (v.main_stock || 0), 0);
        const branchTotal = updatedVariants.reduce((sum, v) => sum + (v.branch_stock || 0), 0);
        return {
          ...p,
          variants: updatedVariants,
          main_stock: mainTotal,
          branch_stock: branchTotal
        };
      }));

      // Clear input
      setTransferInputs(prev => ({ ...prev, [key]: '' }));
    } catch (err) {
      showToast(err.message || 'Stock transfer failed', 'error');
    } finally {
      setTransferringKey(null);
    }
  };

  // Perform bulk transfer for all entered quantities across variants of a product
  const handleProductAllTransfer = async (product) => {
    const itemsToTransfer = [];
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      for (const v of product.variants) {
        const key = `${product.id}-${v.id}`;
        const qty = parseInt(transferInputs[key], 10);
        const available = direction === 'main_to_branch' ? v.main_stock : v.branch_stock;
        if (qty && qty > 0 && available > 0) {
          itemsToTransfer.push({
            product_id: product.id,
            variant_id: v.id,
            quantity: Math.min(qty, available)
          });
        }
      }
    } else {
      const key = `${product.id}-main`;
      const qty = parseInt(transferInputs[key], 10);
      const available = direction === 'main_to_branch' ? product.main_stock : product.branch_stock;
      if (qty && qty > 0 && available > 0) {
        itemsToTransfer.push({
          product_id: product.id,
          variant_id: null,
          quantity: Math.min(qty, available)
        });
      }
    }

    if (itemsToTransfer.length === 0) {
      showToast('Enter quantity for at least one model or variant before pushing.', 'error');
      return;
    }

    setTransferringProduct(product.id);
    try {
      const payload = {
        from_branch_id: sourceBranch.id,
        to_branch_id: targetBranch.id,
        items: itemsToTransfer
      };

      const res = await transferAdminBranchStock(payload);
      showToast(res.message || 'Transferred all entered variants successfully!', 'success');
      loadCatalog();

      // Clear inputs for this product
      setTransferInputs(prev => {
        const copy = { ...prev };
        itemsToTransfer.forEach(item => {
          delete copy[`${product.id}-${item.variant_id || 'main'}`];
        });
        return copy;
      });
    } catch (err) {
      showToast(err.message || 'Transfer failed', 'error');
    } finally {
      setTransferringProduct(null);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar />

        <main style={{ padding: '24px 28px', maxWidth: '1400px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          
          {/* TOAST ALERT */}
          {toast && (
            <div
              style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 9999,
                background: toast.type === 'error' ? '#dc2626' : '#15803d',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>{toast.type === 'error' ? '⚠️' : '✓'}</span>
              <span>{toast.message}</span>
            </div>
          )}

          {/* PAGE HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
                  Branch Push Products
                </h1>
                <span style={{ background: '#ecfdf5', color: '#065935', border: '1px solid #a7f3d0', padding: '2px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 800 }}>
                  Multi-Branch Stock Transfer
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Push and reallocate products &amp; specific model variants between Main Store and regional branches.
              </p>
            </div>

            {/* REGIONAL BRANCH SELECTOR (IF MULTIPLE) */}
            {branches.filter(b => b.id !== 1 && b.code !== 'MAIN').length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Regional Branch:</span>
                <select
                  value={regionalBranchId}
                  onChange={(e) => setRegionalBranchId(e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 800, color: '#0f172a', cursor: 'pointer' }}
                >
                  {branches.filter(b => b.id !== 1 && b.code !== 'MAIN').map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* DIRECTION TABS: MAIN TO BRANCH vs BRANCH TO MAIN */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '8px', marginBottom: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setDirection('main_to_branch')}
              style={{
                flex: 1,
                minWidth: '260px',
                padding: '12px 18px',
                borderRadius: '8px',
                border: direction === 'main_to_branch' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                background: direction === 'main_to_branch' ? '#f0fdf4' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 900, color: direction === 'main_to_branch' ? '#15803d' : '#0f172a' }}>
                    🏢 {mainBranch.name} ➔ 🏪 {regionalBranch.name}
                  </span>
                  {direction === 'main_to_branch' && (
                    <span style={{ background: '#16a34a', color: '#fff', fontSize: '10px', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                  Push stock from Central Warehouse into {regionalBranch.name}
                </div>
              </div>
              <span style={{ fontSize: '20px', color: direction === 'main_to_branch' ? '#16a34a' : '#cbd5e1' }}>➔</span>
            </button>

            <button
              type="button"
              onClick={() => setDirection('branch_to_main')}
              style={{
                flex: 1,
                minWidth: '260px',
                padding: '12px 18px',
                borderRadius: '8px',
                border: direction === 'branch_to_main' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                background: direction === 'branch_to_main' ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 900, color: direction === 'branch_to_main' ? '#1d4ed8' : '#0f172a' }}>
                    🏪 {regionalBranch.name} ➔ 🏢 {mainBranch.name}
                  </span>
                  {direction === 'branch_to_main' && (
                    <span style={{ background: '#2563eb', color: '#fff', fontSize: '10px', fontWeight: 900, padding: '2px 6px', borderRadius: '4px' }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '3px' }}>
                  Return / transfer stock from {regionalBranch.name} back to Central Store
                </div>
              </div>
              <span style={{ fontSize: '20px', color: direction === 'branch_to_main' ? '#2563eb' : '#cbd5e1' }}>➔</span>
            </button>
          </div>

          {/* FILTER BAR */}
          <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
              {/* Search input */}
              <div style={{ position: 'relative', width: '280px' }}>
                <input
                  type="text"
                  placeholder="Search product, model name, barcode, SKU..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px' }}>🔍</span>
              </div>

              {/* Category Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    background: '#fff',
                    fontWeight: 600,
                    color: '#1e293b'
                  }}
                >
                  <option value="all">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Stock Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Stock Status:</span>
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    background: '#fff',
                    fontWeight: 600,
                    color: '#1e293b'
                  }}
                >
                  <option value="all">All Stock Statuses</option>
                  <option value="source_available">Available at Source (&gt; 0)</option>
                  <option value="branch_has_stock">Stock at Destination (&gt; 0)</option>
                  <option value="branch_low">Low Stock at Destination (≤ 5)</option>
                  <option value="branch_out">Out of Stock at Destination (0)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={expandAllProducts}
                title="Expand all product variant accordions"
                style={{
                  padding: '7px 11px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ▾ Expand All
              </button>
              <button
                type="button"
                onClick={collapseAllProducts}
                title="Collapse all product variant accordions"
                style={{
                  padding: '7px 11px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ▸ Collapse All
              </button>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#475569', marginLeft: '4px' }}>
                {products.length} product(s) found
              </span>
              <button
                type="button"
                onClick={loadCatalog}
                style={{
                  padding: '7px 12px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Icon name="refresh" size={13} /> Refresh
              </button>
            </div>
          </div>

          {/* PRODUCTS LIST */}
          {loading ? (
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '18px', marginBottom: '8px' }}>⏳ Loading products and branch stock levels...</div>
              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>Please wait while we retrieve variant models and stock distributions.</p>
            </div>
          ) : products.length === 0 ? (
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📦</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>No products match your filter criteria</div>
              <p style={{ margin: 0, fontSize: '13px' }}>Try adjusting your search query, category selection, or stock status.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {products.map(product => {
                const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;
                const srcStock = direction === 'main_to_branch' ? product.main_stock : product.branch_stock;
                const dstStock = direction === 'main_to_branch' ? product.branch_stock : product.main_stock;
                const isExpanded = expandedProductIds.has(product.id);

                return (
                  <div
                    key={product.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* PRODUCT HEADER BAR (ACCORDION TOGGLE) */}
                    <div
                      onClick={() => toggleProductAccordion(product.id)}
                      style={{
                        padding: '14px 18px',
                        background: isExpanded ? '#f8fafc' : '#ffffff',
                        borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {/* ACCORDION CHEVRON */}
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: isExpanded ? '#065935' : '#f8fafc',
                            color: isExpanded ? '#ffffff' : '#475569',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 900,
                            flexShrink: 0,
                            transition: 'all 0.15s ease'
                          }}
                          title={isExpanded ? 'Collapse variants' : 'Expand variants'}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </div>

                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            style={{ width: '42px', height: '42px', borderRadius: '7px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                          />
                        ) : (
                          <div style={{ width: '42px', height: '42px', borderRadius: '7px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            🛍️
                          </div>
                        )}
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>{product.name}</span>
                            {product.category_name && (
                              <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                                {product.category_name}
                              </span>
                            )}
                            {product.barcode && (
                              <span style={{ fontFamily: 'monospace', fontSize: '11.5px', fontWeight: 800, color: '#065935', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' }}>
                                {product.barcode}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            MRP: ₹{Number(product.mrp || product.price || 0).toLocaleString('en-IN')} · Selling: ₹{Number(product.sale_price || product.price || 0).toLocaleString('en-IN')}
                            {hasVariants ? ` · ${product.variants.length} model/variant(s)` : ' · Single Item'}
                          </div>
                        </div>
                      </div>

                      {/* STOCK SUMMARY PILLS */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '7px', padding: '6px 12px', textAlign: 'right' }}>
                          <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                            {sourceBranch.name} (Source)
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 900, color: srcStock > 0 ? '#15803d' : '#dc2626' }}>
                            {srcStock} unit(s)
                          </div>
                        </div>

                        <span style={{ fontSize: '16px', color: '#94a3b8' }}>➔</span>

                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '6px 12px', textAlign: 'left' }}>
                          <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                            {targetBranch.name} (Dest)
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 900, color: dstStock > 0 ? '#0f172a' : '#b45309' }}>
                            {dstStock} unit(s)
                          </div>
                        </div>

                        {/* PUSH ALL VARIANTS BUTTON */}
                        <button
                          type="button"
                          disabled={transferringProduct === product.id || srcStock <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductAllTransfer(product);
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: '7px',
                            border: `1px solid ${srcStock <= 0 ? '#cbd5e1' : '#16a34a'}`,
                            background: srcStock <= 0 ? '#f1f5f9' : (transferringProduct === product.id ? '#f0fdf4' : '#16a34a'),
                            color: srcStock <= 0 ? '#94a3b8' : (transferringProduct === product.id ? '#15803d' : '#ffffff'),
                            fontSize: '12px',
                            fontWeight: 800,
                            cursor: (transferringProduct === product.id || srcStock <= 0) ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          {transferringProduct === product.id ? '⏳ Transferring...' : (srcStock <= 0 ? '🚫 0 Stock' : '🚀 Push Entered')}
                        </button>
                      </div>
                    </div>

                    {/* VARIANTS / MODELS TABLE (ACCORDION CONTENT) */}
                    {isExpanded && (
                      <div style={{ padding: '0', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            <th style={{ padding: '10px 18px' }}>Model / Variant Name</th>
                            <th style={{ padding: '10px 14px' }}>Barcode</th>
                            <th style={{ padding: '10px 14px' }}>Rate Alias (Arrival Code)</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>{sourceBranch.name} (Source)</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>{targetBranch.name} (Destination)</th>
                            <th style={{ padding: '10px 14px', textAlign: 'center' }}>Push Qty</th>
                            <th style={{ padding: '10px 18px', textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hasVariants ? (
                            product.variants.map((v, vIdx) => {
                              const vKey = `${product.id}-${v.id}`;
                              const vSrcStock = direction === 'main_to_branch' ? v.main_stock : v.branch_stock;
                              const vDstStock = direction === 'main_to_branch' ? v.branch_stock : v.main_stock;
                              const vInputVal = transferInputs[vKey] !== undefined ? transferInputs[vKey] : '';
                              const isTransferring = transferringKey === vKey;
                              const isLowDst = vDstStock <= 5;
                              const hasSourceStock = vSrcStock > 0;

                              return (
                                <tr key={v.id} style={{ borderTop: vIdx > 0 ? '1px solid #f8fafc' : 'none', background: vIdx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                  <td style={{ padding: '12px 18px', fontWeight: 800, color: '#0f172a' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {v.color_hex && (
                                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: v.color_hex, border: '1px solid #cbd5e1', display: 'inline-block' }} />
                                      )}
                                      <span>{v.model_name || v.color_name || `Model #${vIdx + 1}`}</span>
                                      {v.size_name && !/standard|one size/i.test(v.size_name) && (
                                        <span style={{ background: '#e2e8f0', color: '#334155', padding: '1px 5px', borderRadius: '3px', fontSize: '10.5px' }}>
                                          SZ: {v.size_name}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#065935' }}>
                                    {v.barcode || product.barcode || '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#475569' }}>
                                    {v.purchase_rate_alias || '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    <span style={{
                                      background: vSrcStock > 0 ? '#dcfce7' : '#fee2e2',
                                      color: vSrcStock > 0 ? '#15803d' : '#b91c1c',
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      fontWeight: 800,
                                      fontSize: '11.5px'
                                    }}>
                                      {vSrcStock} on hand
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    <span style={{
                                      background: isLowDst ? '#fef3c7' : '#f1f5f9',
                                      color: isLowDst ? '#b45309' : '#334155',
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      fontWeight: 800,
                                      fontSize: '11.5px'
                                    }}>
                                      {vDstStock} units {isLowDst ? '(LOW)' : ''}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <button
                                        type="button"
                                        disabled={!hasSourceStock || isTransferring}
                                        onClick={() => handleQtyChange(product.id, v.id, Math.max(0, (parseInt(vInputVal, 10) || 0) - 1), vSrcStock)}
                                        style={{
                                          width: '24px',
                                          height: '28px',
                                          border: '1px solid #cbd5e1',
                                          borderRadius: '4px',
                                          background: hasSourceStock ? '#f8fafc' : '#f1f5f9',
                                          color: hasSourceStock ? '#0f172a' : '#94a3b8',
                                          fontWeight: 800,
                                          cursor: (!hasSourceStock || isTransferring) ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        max={vSrcStock}
                                        placeholder={hasSourceStock ? '0' : '0'}
                                        disabled={!hasSourceStock || isTransferring}
                                        value={hasSourceStock ? vInputVal : ''}
                                        onChange={(e) => handleQtyChange(product.id, v.id, e.target.value, vSrcStock)}
                                        style={{
                                          width: '56px',
                                          height: '28px',
                                          textAlign: 'center',
                                          borderRadius: '4px',
                                          border: '1px solid #cbd5e1',
                                          fontSize: '12px',
                                          fontWeight: 800,
                                          background: hasSourceStock ? '#ffffff' : '#f1f5f9',
                                          color: hasSourceStock ? '#0f172a' : '#94a3b8',
                                          cursor: (!hasSourceStock || isTransferring) ? 'not-allowed' : 'text'
                                        }}
                                        title={hasSourceStock ? 'Enter transfer quantity' : 'Cannot transfer: 0 stock on hand'}
                                      />
                                      <button
                                        type="button"
                                        disabled={!hasSourceStock || isTransferring}
                                        onClick={() => handleQtyChange(product.id, v.id, Math.min(vSrcStock, (parseInt(vInputVal, 10) || 0) + 1), vSrcStock)}
                                        style={{
                                          width: '24px',
                                          height: '28px',
                                          border: '1px solid #cbd5e1',
                                          borderRadius: '4px',
                                          background: hasSourceStock ? '#f8fafc' : '#f1f5f9',
                                          color: hasSourceStock ? '#0f172a' : '#94a3b8',
                                          fontWeight: 800,
                                          cursor: (!hasSourceStock || isTransferring) ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      disabled={!hasSourceStock || isTransferring || !vInputVal || parseInt(vInputVal, 10) <= 0}
                                      onClick={() => handleSingleTransfer(product, v)}
                                      style={{
                                        padding: '5px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: (!hasSourceStock || !vInputVal || parseInt(vInputVal, 10) <= 0) ? '#f1f5f9' : '#065935',
                                        color: (!hasSourceStock || !vInputVal || parseInt(vInputVal, 10) <= 0) ? '#94a3b8' : '#ffffff',
                                        fontSize: '11.5px',
                                        fontWeight: 800,
                                        cursor: (!hasSourceStock || !vInputVal || parseInt(vInputVal, 10) <= 0 || isTransferring) ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                      {!hasSourceStock ? 'No Stock' : (isTransferring ? '⏳ Pushing...' : 'Push Stock ➔')}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            // Single item (no variants)
                            (() => {
                              const mKey = `${product.id}-main`;
                              const mInputVal = transferInputs[mKey] !== undefined ? transferInputs[mKey] : '';
                              const isTransferring = transferringKey === mKey;
                              const isLowDst = dstStock <= 5;
                              const hasSourceStock = srcStock > 0;

                              return (
                                <tr>
                                  <td style={{ padding: '12px 18px', fontWeight: 800, color: '#0f172a' }}>
                                    Standard / Single Product
                                  </td>
                                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#065935' }}>
                                    {product.barcode || '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', color: '#94a3b8' }}>—</td>
                                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    <span style={{
                                      background: srcStock > 0 ? '#dcfce7' : '#fee2e2',
                                      color: srcStock > 0 ? '#15803d' : '#b91c1c',
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      fontWeight: 800,
                                      fontSize: '11.5px'
                                    }}>
                                      {srcStock} on hand
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    <span style={{
                                      background: isLowDst ? '#fef3c7' : '#f1f5f9',
                                      color: isLowDst ? '#b45309' : '#334155',
                                      padding: '3px 8px',
                                      borderRadius: '12px',
                                      fontWeight: 800,
                                      fontSize: '11.5px'
                                    }}>
                                      {dstStock} units {isLowDst ? '(LOW)' : ''}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <button
                                        type="button"
                                        disabled={!hasSourceStock || isTransferring}
                                        onClick={() => handleQtyChange(product.id, null, Math.max(0, (parseInt(mInputVal, 10) || 0) - 1), srcStock)}
                                        style={{
                                          width: '24px',
                                          height: '28px',
                                          border: '1px solid #cbd5e1',
                                          borderRadius: '4px',
                                          background: hasSourceStock ? '#f8fafc' : '#f1f5f9',
                                          color: hasSourceStock ? '#0f172a' : '#94a3b8',
                                          fontWeight: 800,
                                          cursor: (!hasSourceStock || isTransferring) ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min="0"
                                        max={srcStock}
                                        placeholder={hasSourceStock ? '0' : '0'}
                                        disabled={!hasSourceStock || isTransferring}
                                        value={hasSourceStock ? mInputVal : ''}
                                        onChange={(e) => handleQtyChange(product.id, null, e.target.value, srcStock)}
                                        style={{
                                          width: '56px',
                                          height: '28px',
                                          textAlign: 'center',
                                          borderRadius: '4px',
                                          border: '1px solid #cbd5e1',
                                          fontSize: '12px',
                                          fontWeight: 800,
                                          background: hasSourceStock ? '#ffffff' : '#f1f5f9',
                                          color: hasSourceStock ? '#0f172a' : '#94a3b8',
                                          cursor: (!hasSourceStock || isTransferring) ? 'not-allowed' : 'text'
                                        }}
                                        title={hasSourceStock ? 'Enter transfer quantity' : 'Cannot transfer: 0 stock on hand'}
                                      />
                                      <button
                                        type="button"
                                        disabled={!hasSourceStock || isTransferring}
                                        onClick={() => handleQtyChange(product.id, null, Math.min(srcStock, (parseInt(mInputVal, 10) || 0) + 1), srcStock)}
                                        style={{
                                          width: '24px',
                                          height: '28px',
                                          border: '1px solid #cbd5e1',
                                          borderRadius: '4px',
                                          background: hasSourceStock ? '#f8fafc' : '#f1f5f9',
                                          color: hasSourceStock ? '#0f172a' : '#94a3b8',
                                          fontWeight: 800,
                                          cursor: (!hasSourceStock || isTransferring) ? 'not-allowed' : 'pointer'
                                        }}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                                    <button
                                      type="button"
                                      disabled={!hasSourceStock || isTransferring || !mInputVal || parseInt(mInputVal, 10) <= 0}
                                      onClick={() => handleSingleTransfer(product, null)}
                                      style={{
                                        padding: '5px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: (!hasSourceStock || !mInputVal || parseInt(mInputVal, 10) <= 0) ? '#f1f5f9' : '#065935',
                                        color: (!hasSourceStock || !mInputVal || parseInt(mInputVal, 10) <= 0) ? '#94a3b8' : '#ffffff',
                                        fontSize: '11.5px',
                                        fontWeight: 800,
                                        cursor: (!hasSourceStock || !mInputVal || parseInt(mInputVal, 10) <= 0 || isTransferring) ? 'not-allowed' : 'pointer'
                                      }}
                                    >
                                      {!hasSourceStock ? 'No Stock' : (isTransferring ? '⏳ Pushing...' : 'Push Stock ➔')}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })()
                          )}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
