'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Icon } from '../../components/Icons';
import { useAdminAuth } from '../../lib/auth';
import {
  getAdminVariantStock,
  getAdminInventoryTransactions,
  adjustAdminVariantStock,
  getAdminBranches,
  getAdminBranchStocks,
  updateAdminBranchProductStock,
  pushAdminStockToMainBranch,
  getAdminCategories,
  getAdminBrands,
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
  const [expandedProductIds, setExpandedProductIds] = useState(new Set());
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States matching Products page
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [badgeFilter, setBadgeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [categories, setCategories] = useState([]);
  const [brandsList, setBrandsList] = useState([]);

  // Category hierarchy options
  const categoryOptions = useMemo(() => {
    const options = [];
    const visited = new Set();
    const walk = (parentId, depth) => {
      categories
        .filter(c => (parentId === null ? !c.parent_id : String(c.parent_id) === String(parentId)))
        .forEach(cat => {
          if (visited.has(String(cat.id))) return;
          visited.add(String(cat.id));
          options.push({ cat, depth });
          walk(cat.id, depth + 1);
        });
    };
    walk(null, 0);
    categories.forEach(cat => {
      if (!visited.has(String(cat.id))) options.push({ cat, depth: 0 });
    });
    return options;
  }, [categories]);

  const getDescendantIds = (parentId) => {
    const ids = [];
    const walk = (pId) => {
      categories
        .filter(c => String(c.parent_id) === String(pId))
        .forEach(child => {
          ids.push(String(child.id));
          walk(child.id);
        });
    };
    walk(parentId);
    return ids;
  };

  // Group all variants by main product for accordion display
  const allGroupedProducts = useMemo(() => {
    const map = new Map();
    for (const v of variants) {
      const pId = v.product_id || `prod_${v.product_name}`;
      if (!map.has(pId)) {
        map.set(pId, {
          id: pId,
          name: v.product_name || 'Unnamed Product',
          slug: v.product_slug || '',
          category_id: v.category_id,
          category_name: v.category_name || '',
          brand: v.brand || '',
          badge: v.badge || '',
          is_active: v.is_active !== undefined ? v.is_active : 1,
          is_online: v.is_online !== undefined ? v.is_online : 1,
          is_featured: Boolean(v.is_featured),
          is_new_arrival: Boolean(v.is_new_arrival),
          is_best_selling: Boolean(v.is_best_selling),
          price: v.price || 0,
          sale_price: v.sale_price || null,
          barcode: v.barcode || '',
          image: v.product_image || '',
          created_at: v.product_created_at || v.created_at || '',
          variants: [],
          total_stock: 0,
          low_stock_count: 0
        });
      }
      const grp = map.get(pId);
      grp.variants.push(v);
      const qty = Number(v.stock_quantity) || 0;
      grp.total_stock += qty;
      if (qty <= (v.threshold || 5)) {
        grp.low_stock_count += 1;
      }
    }
    return Array.from(map.values());
  }, [variants]);

  // Brand dropdown options
  const brandOptions = useMemo(() => {
    const set = new Set();
    brandsList.forEach(b => {
      const name = String(b.name || '').trim();
      if (name) set.add(name);
    });
    allGroupedProducts.forEach(p => {
      const b = String(p.brand || '').trim();
      if (b) set.add(b);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [brandsList, allGroupedProducts]);

  const getCategoryProductCount = (catId) => {
    const cidStr = String(catId);
    const allIds = [cidStr, ...getDescendantIds(catId)];
    return allGroupedProducts.filter(p => allIds.includes(String(p.category_id || ''))).length;
  };

  const countInStock = useMemo(() => allGroupedProducts.filter(p => p.total_stock > 10).length, [allGroupedProducts]);
  const countLowStock = useMemo(() => allGroupedProducts.filter(p => p.total_stock > 0 && p.total_stock <= 10).length, [allGroupedProducts]);
  const countOutOfStock = useMemo(() => allGroupedProducts.filter(p => p.total_stock === 0).length, [allGroupedProducts]);
  const countActive = useMemo(() => allGroupedProducts.filter(p => Number(p.is_active) === 1 || p.is_active === true).length, [allGroupedProducts]);
  const countInactive = useMemo(() => allGroupedProducts.filter(p => Number(p.is_active) === 0 || p.is_active === false).length, [allGroupedProducts]);
  const countOnline = useMemo(() => allGroupedProducts.filter(p => Number(p.is_online) === 1 || p.is_online === true || p.is_online === null || p.is_online === undefined).length, [allGroupedProducts]);
  const countInStoreOnly = useMemo(() => allGroupedProducts.filter(p => Number(p.is_online) === 0 || p.is_online === false).length, [allGroupedProducts]);

  const hasActiveFilters = Boolean(
    search.trim() ||
    categoryFilter !== 'all' ||
    brandFilter !== 'all' ||
    stockFilter !== 'all' ||
    badgeFilter !== 'all' ||
    statusFilter !== 'all' ||
    channelFilter !== 'all' ||
    sortBy !== 'newest'
  );

  const handleClearAllFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setBrandFilter('all');
    setStockFilter('all');
    setBadgeFilter('all');
    setStatusFilter('all');
    setChannelFilter('all');
    setSortBy('newest');
  };

  // Filtered and Sorted grouped products
  const groupedProducts = useMemo(() => {
    return allGroupedProducts.filter(p => {
      // 1. Search text (matches product title, slug, barcode, brand, category, or child variants)
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = p.name && p.name.toLowerCase().includes(q);
        const matchesSlug = p.slug && p.slug.toLowerCase().includes(q);
        const matchesCat = p.category_name && p.category_name.toLowerCase().includes(q);
        const matchesBrand = p.brand && String(p.brand).toLowerCase().includes(q);
        const matchesBarcode = p.barcode && p.barcode.toLowerCase().includes(q);
        const matchesAnyVariant = p.variants.some(v =>
          (v.model_name && v.model_name.toLowerCase().includes(q)) ||
          (v.color_name && v.color_name.toLowerCase().includes(q)) ||
          (v.size_name && v.size_name.toLowerCase().includes(q)) ||
          (v.sku && v.sku.toLowerCase().includes(q)) ||
          (v.barcode && v.barcode.toLowerCase().includes(q))
        );
        if (!matchesName && !matchesSlug && !matchesCat && !matchesBrand && !matchesBarcode && !matchesAnyVariant) return false;
      }

      // 2. Category Filter (includes descendants)
      if (categoryFilter !== 'all') {
        const catIdStr = String(categoryFilter);
        const allowedCatIds = [catIdStr, ...getDescendantIds(categoryFilter)];
        if (!allowedCatIds.includes(String(p.category_id || ''))) return false;
      }

      // 3. Brand Filter
      if (brandFilter !== 'all') {
        const brandVal = String(p.brand || '').trim();
        if (brandFilter === '__none__') {
          if (brandVal) return false;
        } else if (brandVal.toLowerCase() !== brandFilter.toLowerCase()) {
          return false;
        }
      }

      // 4. Stock Level Filter
      if (stockFilter === 'in_stock' && p.total_stock <= 10) return false;
      if (stockFilter === 'low_stock' && (p.total_stock <= 0 || p.total_stock > 10)) return false;
      if (stockFilter === 'out_of_stock' && p.total_stock > 0) return false;

      // 5. Badge Filter
      if (badgeFilter === 'featured' && !p.is_featured) return false;
      if (badgeFilter === 'new_arrival' && !p.is_new_arrival) return false;
      if (badgeFilter === 'best_selling' && !p.is_best_selling) return false;
      if (badgeFilter === 'sale' && !(p.sale_price && Number(p.sale_price) < Number(p.price))) return false;

      // 6. Status Filter
      if (statusFilter === 'active' && !(Number(p.is_active) === 1 || p.is_active === true)) return false;
      if (statusFilter === 'inactive' && !(Number(p.is_active) === 0 || p.is_active === false)) return false;

      // 7. Channel Filter
      if (channelFilter === 'online' && (Number(p.is_online) === 0 || p.is_online === false)) return false;
      if (channelFilter === 'offline' && (Number(p.is_online) === 1 || p.is_online === true || p.is_online === null || p.is_online === undefined)) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
      if (sortBy === 'price_desc') return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
      if (sortBy === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'stock_asc') return a.total_stock - b.total_stock;
      if (sortBy === 'stock_desc') return b.total_stock - a.total_stock;
      // 'newest' default
      if (a.created_at && b.created_at) return new Date(b.created_at) - new Date(a.created_at);
      return String(b.id).localeCompare(String(a.id));
    });
  }, [allGroupedProducts, search, categoryFilter, brandFilter, stockFilter, badgeFilter, statusFilter, channelFilter, sortBy, categories]);

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
    setExpandedProductIds(new Set(groupedProducts.map(p => p.id)));
  };

  const collapseAllProducts = () => {
    setExpandedProductIds(new Set());
  };

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
    const params = {};
    if (overrides.barcode) params.barcode = overrides.barcode;
    setLoading(true);
    getAdminVariantStock(params)
      .then(res => {
        if (Array.isArray(res)) {
          setVariants(res);
          setExpandedProductIds(new Set(res.map(v => v.product_id || `prod_${v.product_name}`)));
        }
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

  // Load categories & brands
  useEffect(() => {
    getAdminCategories()
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.categories || []);
        setCategories(list);
      })
      .catch(err => console.warn('Failed to load categories:', err));

    getAdminBrands()
      .then(res => {
        const list = Array.isArray(res) ? res : (res?.brands || []);
        setBrandsList(list);
      })
      .catch(err => console.warn('Failed to load brands:', err));
  }, []);

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
  }, [activeTab, selectedBranchId]);

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
          {/* Filter Bar Matching Products Page */}
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: '1 1 auto' }}>
              {/* Search title, slug, SKU, category, barcode... */}
              <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 200px' }}>
                <input
                  type="text"
                  placeholder="Search title, slug, SKU, category..."
                  className="form-control"
                  style={{
                    paddingLeft: '34px',
                    fontSize: '13px',
                    height: '38px',
                    background: '#ffffff',
                    width: '100%',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1'
                  }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <Icon name="search" size={15} />
                </span>
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '13px' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* 📁 Filter by Category: All */}
              <div>
                <select
                  className="form-control"
                  style={{ fontSize: '13px', height: '38px', background: '#ffffff', cursor: 'pointer', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">📁 Filter by Category: All ({allGroupedProducts.length})</option>
                  {categoryOptions.map(({ cat, depth }) => (
                    <option
                      key={cat.id}
                      value={cat.id}
                      style={
                        depth === 0
                          ? { fontWeight: 700, background: '#f1f5f9' }
                          : depth === 1
                          ? { fontWeight: 400, background: '#e0f2fe' }
                          : { fontWeight: 400, fontStyle: 'italic', background: '#f3e8ff' }
                      }
                    >
                      {depth === 0 ? '📂 ' : `${'\u00A0\u00A0'.repeat(depth)}↳ `}{cat.name} ({getCategoryProductCount(cat.id)})
                    </option>
                  ))}
                </select>
              </div>

              {/* 🏷️ Filter by Brand: All */}
              <div>
                <select
                  className="form-control"
                  style={{ fontSize: '13px', height: '38px', background: '#ffffff', cursor: 'pointer', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                >
                  <option value="all">🏷️ Filter by Brand: All ({brandOptions.length})</option>
                  <option value="__none__">No Brand</option>
                  {brandOptions.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* 📦 Stock: All Statuses */}
              <div>
                <select
                  className="form-control"
                  style={{ fontSize: '13px', height: '38px', background: '#ffffff', cursor: 'pointer', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                >
                  <option value="all">📦 Stock: All Statuses</option>
                  <option value="in_stock">✅ In Stock &gt; 10 ({countInStock})</option>
                  <option value="low_stock">⚠️ Low Stock 1-10 ({countLowStock})</option>
                  <option value="out_of_stock">❌ Out of Stock ({countOutOfStock})</option>
                </select>
              </div>

              {/* 🏷️ Badge: All Items */}
              <div>
                <select
                  className="form-control"
                  style={{ fontSize: '13px', height: '38px', background: '#ffffff', cursor: 'pointer', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={badgeFilter}
                  onChange={(e) => setBadgeFilter(e.target.value)}
                >
                  <option value="all">🏷️ Badge: All Items</option>
                  <option value="featured">🌟 Featured Only</option>
                  <option value="new_arrival">✨ New Arrivals</option>
                  <option value="best_selling">🔥 Best Sellers</option>
                  <option value="sale">🏷️ On Sale (Discounted)</option>
                </select>
              </div>

              {/* Status: All */}
              <div>
                <select
                  className="form-control"
                  style={{ fontSize: '13px', height: '38px', background: '#ffffff', cursor: 'pointer', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">Status: All ({allGroupedProducts.length})</option>
                  <option value="active">● Active ({countActive})</option>
                  <option value="inactive">○ Inactive ({countInactive})</option>
                </select>
              </div>

              {/* Channel: All Channels */}
              <div>
                <select
                  className="form-control"
                  style={{ fontSize: '13px', height: '38px', background: '#ffffff', cursor: 'pointer', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                >
                  <option value="all">Channel: All Channels</option>
                  <option value="online">🌐 Online Store ({countOnline})</option>
                  <option value="offline">🔒 In-Store Only ({countInStoreOnly})</option>
                </select>
              </div>

              {/* ↕️ Sort: Newest Added */}
              <div>
                <select
                  className="form-control"
                  style={{ fontSize: '13px', height: '38px', background: '#ffffff', cursor: 'pointer', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="newest">↕️ Sort: Newest Added</option>
                  <option value="price_asc">Price: Low → High</option>
                  <option value="price_desc">Price: High → Low</option>
                  <option value="name_asc">Product Name: A → Z</option>
                  <option value="stock_asc">Stock: Low → High</option>
                  <option value="stock_desc">Stock: High → Low</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  style={{
                    height: '38px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #ef4444',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ✕ Clear Filters
                </button>
              )}
            </div>

            {/* Accordion Controls (Expand All / Collapse All) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={expandAllProducts}
                title="Expand all product variant accordions"
                style={{
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ▾ Expand All
              </button>
              <button
                type="button"
                onClick={collapseAllProducts}
                title="Collapse all product variant accordions"
                style={{
                  height: '38px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ▸ Collapse All
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>Loading variant stock levels...</div>
          ) : groupedProducts.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>No products match your current filters.</div>
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>Try selecting different filter options or clearing all filters.</div>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  style={{
                    background: '#065935',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', background: '#f8fafc' }}>
              {hasActiveFilters && (
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px' }}>
                  <span>Showing {groupedProducts.length} of {allGroupedProducts.length} products</span>
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', padding: 0 }}
                  >
                    Reset
                  </button>
                </div>
              )}
              {groupedProducts.map((product) => {
                const isExpanded = expandedProductIds.has(product.id);
                const hasLowStock = product.low_stock_count > 0;

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
                        {/* CHEVRON */}
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
                            style={{ width: '40px', height: '40px', borderRadius: '7px', objectFit: 'cover', border: '1px solid #cbd5e1', flexShrink: 0 }}
                          />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '7px', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
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
                            <span style={{ background: '#ecfdf5', color: '#065935', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                              {product.variants.length} model/variant(s)
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            Total Product Stock: <strong style={{ color: '#0f172a' }}>{product.total_stock} unit(s)</strong>
                            {hasLowStock && (
                              <span style={{ color: '#dc2626', fontWeight: 700, marginLeft: '10px' }}>
                                ⚠️ {product.low_stock_count} variant(s) low in stock
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* TOTAL STOCK BADGE */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          background: hasLowStock ? '#fef2f2' : '#f0fdf4',
                          border: `1px solid ${hasLowStock ? '#fecaca' : '#bbf7d0'}`,
                          borderRadius: '8px',
                          padding: '6px 14px',
                          textAlign: 'right'
                        }}>
                          <div style={{ fontSize: '10.5px', fontWeight: 800, color: hasLowStock ? '#991b1b' : '#166534', textTransform: 'uppercase' }}>
                            {hasLowStock ? 'Low Stock Alert' : 'Total on Hand'}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: 900, color: hasLowStock ? '#dc2626' : '#15803d' }}>
                            {product.total_stock} unit(s)
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* VARIANTS / MODELS ACCORDION BODY */}
                    {isExpanded && (
                      <div style={{ padding: '0', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                          <thead>
                            <tr style={{ background: '#ffffff', borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              <th style={{ padding: '10px 18px' }}>Model / Variant Name</th>
                              <th style={{ padding: '10px 14px' }}>Barcode</th>
                              <th style={{ padding: '10px 14px' }}>SKU</th>
                              <th style={{ padding: '10px 14px' }}>Rate Alias (Arrival Code)</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Price</th>
                              <th style={{ padding: '10px 18px', textAlign: 'center' }}>Stock on Hand</th>
                              <th style={{ padding: '10px 18px', textAlign: 'right' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.variants.map((v, vIdx) => {
                              const isLow = v.stock_quantity <= (v.threshold || 5);
                              return (
                                <tr key={v.id} style={{ borderTop: vIdx > 0 ? '1px solid #f8fafc' : 'none', background: vIdx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                                  <td style={{ padding: '12px 18px', fontWeight: 800, color: '#0f172a' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      {(v.effective_variant_image || v.image_url || product.image) ? (
                                        <img
                                          src={v.effective_variant_image || v.image_url || product.image}
                                          alt={v.model_name || v.color_name || 'Variant'}
                                          style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '6px',
                                            objectFit: 'cover',
                                            border: '1px solid #e2e8f0',
                                            flexShrink: 0
                                          }}
                                        />
                                      ) : (
                                        <div style={{
                                          width: '32px',
                                          height: '32px',
                                          borderRadius: '6px',
                                          background: '#f1f5f9',
                                          border: '1px solid #e2e8f0',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '11px',
                                          fontWeight: 800,
                                          color: '#64748b',
                                          flexShrink: 0
                                        }}>
                                          {(v.model_name || v.color_name || 'V')[0]?.toUpperCase()}
                                        </div>
                                      )}
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          {v.color_hex && (
                                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: v.color_hex, border: '1px solid #cbd5e1' }} />
                                          )}
                                          <span>{v.model_name || v.color_name || `Model #${vIdx + 1}`}</span>
                                        </div>
                                        {((v.model_name && v.color_name && v.color_name !== v.model_name) || (v.size_name && !/standard|one size/i.test(v.size_name))) && (
                                          <span style={{ background: '#e2e8f0', color: '#334155', padding: '1px 5px', borderRadius: '3px', fontSize: '10.5px', marginTop: '2px', display: 'inline-block' }}>
                                            {[v.model_name && v.color_name !== v.model_name ? v.color_name : null, v.size_name && !/standard|one size/i.test(v.size_name) ? `SZ: ${v.size_name}` : null].filter(Boolean).join(' · ')}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 800, color: '#065935' }}>
                                    {v.barcode || '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: '#64748b' }}>
                                    {v.sku || '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>
                                    {v.purchase_rate_alias || '—'}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                                    ₹{Number(v.sale_price > 0 ? v.sale_price : v.price).toLocaleString('en-IN')}
                                  </td>
                                  <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                                    <span
                                      style={{
                                        background: isLow ? '#fef2f2' : '#f0fdf4',
                                        color: isLow ? '#b91c1c' : '#15803d',
                                        padding: '3px 10px',
                                        borderRadius: '12px',
                                        fontWeight: 800,
                                        fontSize: '11.5px'
                                      }}
                                    >
                                      {v.stock_quantity} units {isLow ? '⚠️ LOW' : '✓ OK'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 18px', textAlign: 'right' }}>
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
              {adjustModalItem.product_name} ({adjustModalItem.model_name || adjustModalItem.color_name} {adjustModalItem.size_name || ''})
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

