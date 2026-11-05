'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icons';
import { useAdminAuth } from '../../lib/auth';
import {
  getAdminBranches,
  createAdminBranch,
  updateAdminBranch,
  deleteAdminBranch,
  getAdminBranchUsers,
  createAdminBranchUser,
  updateAdminBranchUser,
  deleteAdminBranchUser,
  getAdminCategories,
  getAdminProducts,
  getAdminBranchStocks,
  pushAdminBranchProducts,
  pushAdminBranchCategory,
  updateAdminBranchProductStock,
  pushAdminStockToMainBranch
} from '../../lib/api';

const AVAILABLE_MENUS = [
  { key: 'dashboard', label: 'Executive Dashboard', desc: 'Overview metrics & sales summary' },
  { key: 'pos', label: 'POS Billing Counter', desc: 'Full-screen billing, hold bills, receipt print' },
  { key: 'orders', label: 'Orders & Receipts', desc: 'Walk-in & online customer bills' },
  { key: 'inventory', label: 'Stock & Inventory', desc: 'Stock quantities & inventory balance' },
  { key: 'products', label: 'Products Catalog', desc: 'Product items, pricing & variants' },
  { key: 'categories', label: 'Categories & Departments', desc: 'Category hierarchy & department mappings' },
  { key: 'barcodes', label: 'Barcode Lookup', desc: 'Barcode search & scan registry' },
  { key: 'customers', label: 'Customers & CRM', desc: 'Customer phone, loyalty points & history' },
  { key: 'salespersons', label: 'Sales Staff & Reports', desc: 'Counter staff attribution' },
  { key: 'vendors', label: 'Vendors & Purchase Bills', desc: 'Supplier bills & stock inwards' },
  { key: 'audit_logs', label: 'Audit & Activity Logs', desc: 'System security & cashier activity logs' },
  { key: 'cms', label: 'CMS & Storefront Banners', desc: 'Website sections & banners' }
];

export default function BranchesPage() {
  const { adminUser } = useAdminAuth();
  const isSuperAdmin = Boolean(adminUser && adminUser.role === 'admin' && (!adminUser.branch_id || Number(adminUser.branch_id) <= 1));
  const [activeTab, setActiveTab] = useState('branches'); // 'branches' | 'users'
  const [branches, setBranches] = useState([]);
  const [branchUsers, setBranchUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // Branch Modal State
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    phone: '',
    email: '',
    address: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '',
    is_active: true
  });

  // User Modal State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'branch_admin',
    branch_id: '',
    phone: '',
    allowed_menus: ['dashboard', 'pos', 'orders', 'inventory', 'products', 'customers']
  });

  // Tab 3: Product & Category Push Distribution State
  const [targetBranchId, setTargetBranchId] = useState('');
  const [categories, setCategories] = useState([]);
  const [branchStocks, setBranchStocks] = useState([]);
  const [loadingStocks, setLoadingStocks] = useState(false);
  const [stockSearchQuery, setStockSearchQuery] = useState('');

  // Category push state
  const [selectedCatId, setSelectedCatId] = useState('');
  const [catStock, setCatStock] = useState(20);
  const [catLowThreshold, setCatLowThreshold] = useState(5);
  const [pushingCat, setPushingCat] = useState(false);

  // Product push state
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [selectedProd, setSelectedProd] = useState(null);
  const [prodStock, setProdStock] = useState(15);
  const [prodLowThreshold, setProdLowThreshold] = useState(5);
  const [pushingProd, setPushingProd] = useState(false);

  // Inline editing state
  const [editingStockId, setEditingStockId] = useState(null);
  const [editingStockVal, setEditingStockVal] = useState('');

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadBranchStocks = async (bId) => {
    if (!bId) return;
    setLoadingStocks(true);
    try {
      const res = await getAdminBranchStocks(bId);
      setBranchStocks(res?.stocks || []);
    } catch (e) {
      console.warn('Could not load branch stocks:', e);
      setBranchStocks([]);
    } finally {
      setLoadingStocks(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [branchesRes, usersRes, catRes] = await Promise.all([
        getAdminBranches().catch(() => ({ branches: [] })),
        getAdminBranchUsers().catch(() => ({ users: [] })),
        getAdminCategories().catch(() => [])
      ]);
      const branchList = branchesRes?.branches || [];
      setBranches(branchList);
      setBranchUsers(usersRes?.users || []);
      const catList = Array.isArray(catRes) ? catRes : (catRes?.categories || []);
      setCategories(catList);

      if (branchList.length > 0 && !targetBranchId) {
        const defaultBranch = branchList.find(b => b.code !== 'MAIN') || branchList[0];
        setTargetBranchId(String(defaultBranch.id));
      }
    } catch (err) {
      showToast(err.message || 'Failed to load branch data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    if (targetBranchId) {
      loadBranchStocks(targetBranchId);
    }
  }, [targetBranchId]);

  // Product autocomplete debounced query
  useEffect(() => {
    const q = productSearch.trim();
    if (!q || q.length < 2) {
      setProductResults([]);
      return;
    }
    const timer = setTimeout(() => {
      getAdminProducts({ search: q, limit: 8 })
        .then(res => {
          const list = Array.isArray(res) ? res : (res?.products || []);
          setProductResults(list);
        })
        .catch(console.warn);
    }, 200);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const handlePushCategory = async (e) => {
    e.preventDefault();
    if (!targetBranchId || !selectedCatId) {
      alert('Please select both a target branch and a category.');
      return;
    }
    setPushingCat(true);
    try {
      const res = await pushAdminBranchCategory(targetBranchId, {
        category_id: selectedCatId,
        default_stock: catStock,
        low_stock_threshold: catLowThreshold
      });
      showToast(res?.message || 'Category products successfully pushed to branch!');
      loadBranchStocks(targetBranchId);
    } catch (err) {
      alert(`Category push failed: ${err.message || 'Server error'}`);
    } finally {
      setPushingCat(false);
    }
  };

  const handlePushProduct = async (e) => {
    e.preventDefault();
    if (!targetBranchId || !selectedProd) {
      alert('Please select a target branch and a product.');
      return;
    }
    setPushingProd(true);
    try {
      await pushAdminBranchProducts(targetBranchId, {
        products: [{
          product_id: selectedProd.id,
          stock: prodStock,
          low_stock_threshold: prodLowThreshold
        }]
      });
      showToast(`Product "${selectedProd.name}" pushed to branch with ${prodStock} units!`);
      setSelectedProd(null);
      setProductSearch('');
      loadBranchStocks(targetBranchId);
    } catch (err) {
      alert(`Product push failed: ${err.message || 'Server error'}`);
    } finally {
      setPushingProd(false);
    }
  };

  const handleSaveStockUpdate = async (productId) => {
    const newStock = parseInt(editingStockVal, 10);
    if (Number.isNaN(newStock) || newStock < 0) {
      alert('Please enter a valid non-negative number for stock.');
      return;
    }
    try {
      await updateAdminBranchProductStock(targetBranchId, productId, { stock: newStock });
      showToast('Branch stock updated successfully.');
      setEditingStockId(null);
      loadBranchStocks(targetBranchId);
    } catch (err) {
      alert(`Could not update stock: ${err.message || 'Server error'}`);
    }
  };

  const handleToggleVisibility = async (item) => {
    try {
      const newStatus = item.is_active === 0 ? 1 : 0;
      await updateAdminBranchProductStock(targetBranchId, item.product_id, { is_active: newStatus });
      showToast(`✓ "${item.product_name}" is now ${newStatus === 1 ? 'visible' : 'hidden'} in this branch.`);
      loadBranchStocks(targetBranchId);
    } catch (err) {
      alert(`Could not toggle visibility: ${err.message || 'Server error'}`);
    }
  };

  const handlePushToMain = async (item) => {
    const branchStock = parseInt(item.stock, 10) || 0;
    if (branchStock <= 0) {
      alert(`Branch has 0 units of "${item.product_name}". Nothing to push to Main Branch.`);
      return;
    }
    const input = window.prompt(
      `Push "${item.product_name}" to Main Branch (Head Warehouse).\n\nAvailable in Branch: ${branchStock} units\nMain Branch Stock: ${item.main_branch_stock ?? 0} units\n\nEnter number of units to transfer:`,
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
      const res = await pushAdminStockToMainBranch(targetBranchId, item.product_id, { quantity: qty });
      showToast(res?.message || `✓ Transferred ${qty} unit(s) of "${item.product_name}" to Main Branch!`);
      loadBranchStocks(targetBranchId);
    } catch (err) {
      alert(`Could not transfer stock: ${err.message || 'Server error'}`);
    }
  };

  // 1. Branch Form Handlers
  const openNewBranch = () => {
    setEditingBranch(null);
    setBranchForm({
      name: '',
      code: '',
      phone: '',
      email: '',
      address: '',
      city: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '',
      is_active: true
    });
    setIsBranchModalOpen(true);
  };

  const openEditBranch = (b) => {
    setEditingBranch(b);
    setBranchForm({
      name: b.name || '',
      code: b.code || '',
      phone: b.phone || '',
      email: b.email || '',
      address: b.address || '',
      city: b.city || 'Chennai',
      state: b.state || 'Tamil Nadu',
      pincode: b.pincode || '',
      is_active: b.is_active === 1 || b.is_active === true
    });
    setIsBranchModalOpen(true);
  };

  const handleSaveBranch = async (e) => {
    e.preventDefault();
    if (!branchForm.name.trim() || !branchForm.code.trim()) {
      alert('Please fill in Branch Name and unique Code.');
      return;
    }

    try {
      if (editingBranch) {
        await updateAdminBranch(editingBranch.id, branchForm);
        showToast(`Branch "${branchForm.name}" updated successfully.`);
      } else {
        await createAdminBranch(branchForm);
        showToast(`Branch "${branchForm.name}" created successfully.`);
      }
      setIsBranchModalOpen(false);
      loadData();
    } catch (err) {
      alert(`Error saving branch: ${err.message || 'Server error'}`);
    }
  };

  const handleDeleteBranch = async (b) => {
    if (b.id === 1) {
      alert('The Main Head Store branch cannot be deleted.');
      return;
    }
    if (!confirm(`Are you sure you want to delete branch "${b.name}"? Any staff will be reassigned to Main Store.`)) {
      return;
    }

    try {
      await deleteAdminBranch(b.id);
      showToast(`Branch "${b.name}" deleted.`);
      loadData();
    } catch (err) {
      alert(`Could not delete branch: ${err.message || 'Server error'}`);
    }
  };

  // 2. User Form Handlers
  const openNewUser = (defaultBranchId = null) => {
    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      password: '',
      role: 'branch_admin',
      branch_id: defaultBranchId || (branches[0]?.id ? String(branches[0].id) : '1'),
      phone: '',
      allowed_menus: ['dashboard', 'pos', 'orders', 'inventory', 'products', 'customers']
    });
    setIsUserModalOpen(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setUserForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'branch_admin',
      branch_id: u.branch_id ? String(u.branch_id) : '1',
      phone: u.phone || '',
      allowed_menus: Array.isArray(u.allowed_menus) ? u.allowed_menus : ['dashboard', 'pos', 'orders', 'inventory', 'products', 'customers']
    });
    setIsUserModalOpen(true);
  };

  const toggleMenuPermission = (menuKey) => {
    setUserForm(prev => {
      const exists = prev.allowed_menus.includes(menuKey);
      const next = exists
        ? prev.allowed_menus.filter(k => k !== menuKey)
        : [...prev.allowed_menus, menuKey];
      return { ...prev, allowed_menus: next };
    });
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.email.trim()) {
      alert('Please fill in user Name and Email.');
      return;
    }
    if (!editingUser && !userForm.password.trim()) {
      alert('Please enter a secure password for the new branch user.');
      return;
    }

    try {
      if (editingUser) {
        const updateRes = await updateAdminBranchUser(editingUser.id, userForm);
        showToast(`User "${userForm.name}" updated successfully.`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('np_user_updated', { detail: updateRes?.user || null }));
        }
      } else {
        await createAdminBranchUser(userForm);
        showToast(`Branch user "${userForm.name}" created with login access.`);
      }
      setIsUserModalOpen(false);
      loadData();
    } catch (err) {
      alert(`Error saving branch user: ${err.message || 'Server error'}`);
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.id === 1) {
      alert('Cannot delete the primary Store Administrator.');
      return;
    }
    if (!confirm(`Delete branch user account "${u.name}" (${u.email})?`)) return;

    try {
      await deleteAdminBranchUser(u.id);
      showToast(`User "${u.name}" deleted.`);
      loadData();
    } catch (err) {
      alert(`Could not delete user: ${err.message || 'Server error'}`);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="admin-layout">
        <Sidebar />
        <div className="admin-main">
          <Topbar title="Multi-Branch & Access Control" />
          <main className="admin-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div style={{ textAlign: 'center', maxWidth: '440px', padding: '36px 28px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🔒</span>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>Access Restricted</h2>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px', lineHeight: 1.5 }}>
                Multi-branch management and staff provisioning is reserved exclusively for the Super Administrator.
              </p>
              <Link href="/dashboard" className="admin-btn admin-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="home" size={16} />
                <span>Return to Dashboard</span>
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Multi-Branch & Access Control" />

        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 99999,
              background: toastMessage.type === 'error' ? '#991b1b' : '#065935',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              fontSize: '13px',
              fontWeight: 800
            }}
          >
            {toastMessage.text}
          </div>
        )}

        <main style={{ padding: '24px 32px', background: '#f8fafc', minHeight: 'calc(100vh - 64px)' }}>
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Store Branches &amp; Access Control
              </h1>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                Set up branch locations, assign branch credentials, and configure restricted menu access.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={openNewBranch}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#065935',
                  color: '#ffffff',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(6, 89, 53, 0.25)'
                }}
              >
                <Icon name="plus" size={16} />
                <span>+ New Branch</span>
              </button>
              <button
                type="button"
                onClick={() => openNewUser()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#1e293b',
                  color: '#ffffff',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                <Icon name="user" size={16} />
                <span>+ Add Branch User</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('branches')}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                background: activeTab === 'branches' ? '#065935' : '#ffffff',
                color: activeTab === 'branches' ? '#ffffff' : '#475569',
                border: activeTab === 'branches' ? 'none' : '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              🏢 Branches Directory ({branches.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                background: activeTab === 'users' ? '#065935' : '#ffffff',
                color: activeTab === 'users' ? '#ffffff' : '#475569',
                border: activeTab === 'users' ? 'none' : '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              👤 Branch User Accounts &amp; Permissions ({branchUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('push')}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                background: activeTab === 'push' ? '#065935' : '#ffffff',
                color: activeTab === 'push' ? '#ffffff' : '#475569',
                border: activeTab === 'push' ? 'none' : '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              🚀 Product &amp; Category Push Distribution
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
              Loading branches &amp; user access data...
            </div>
          ) : activeTab === 'branches' ? (
            /* TAB 1: BRANCHES DIRECTORY */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
              {branches.map(b => {
                const isMain = b.id === 1 || b.code === 'MAIN';
                return (
                  <div
                    key={b.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 900, color: '#0f172a' }}>{b.name}</h3>
                            {isMain && (
                              <span style={{ fontSize: '10px', fontWeight: 900, background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: '10px' }}>
                                HEADQUARTERS
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}>
                            CODE: {b.code}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: b.is_active ? '#dcfce7' : '#fee2e2',
                            color: b.is_active ? '#15803d' : '#b91c1c'
                          }}
                        >
                          {b.is_active ? '● Active' : '○ Inactive'}
                        </span>
                      </div>

                      <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.6, marginBottom: '14px' }}>
                        <div>📍 {b.address || 'Address not configured'}, {b.city || 'Chennai'} {b.pincode ? ` - ${b.pincode}` : ''}</div>
                        {b.phone && <div>📞 {b.phone}</div>}
                        {b.email && <div>✉️ {b.email}</div>}
                      </div>

                      <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>Active Logins:</span>
                        <strong style={{ color: '#065935', fontSize: '13px' }}>{b.staff_count || 0} user(s)</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
                      <button
                        type="button"
                        onClick={() => openNewUser(String(b.id))}
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#065935',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 800,
                          cursor: 'pointer'
                        }}
                      >
                        + Add Staff
                      </button>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openEditBranch(b)}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#0f172a',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Edit
                        </button>
                        {!isMain && (
                          <button
                            type="button"
                            onClick={() => handleDeleteBranch(b)}
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#dc2626',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'users' ? (
            /* TAB 2: BRANCH USERS & ACCESS CONTROL */
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 800 }}>
                    <th style={{ padding: '14px 18px' }}>USER &amp; USERNAME</th>
                    <th style={{ padding: '14px 18px' }}>ROLE</th>
                    <th style={{ padding: '14px 18px' }}>ASSIGNED BRANCH</th>
                    <th style={{ padding: '14px 18px' }}>RESTRICTED MENU ACCESS</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {branchUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                        No branch users found. Click <strong>+ Add Branch User</strong> to create credentials.
                      </td>
                    </tr>
                  ) : (
                    branchUsers.map(u => {
                      const isMainAdmin = u.id === 1 || u.role === 'admin';
                      const menus = Array.isArray(u.allowed_menus) ? u.allowed_menus : [];
                      return (
                        <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '14px 18px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{u.name}</div>
                            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                              ✉️ <code>{u.email}</code>
                            </div>
                            {u.phone && <div style={{ fontSize: '11px', color: '#64748b' }}>📞 {u.phone}</div>}
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '10px',
                                background: u.role === 'admin' ? '#fef3c7' : u.role === 'branch_admin' ? '#e0e7ff' : '#f1f5f9',
                                color: u.role === 'admin' ? '#92400e' : u.role === 'branch_admin' ? '#3730a3' : '#334155'
                              }}
                            >
                              {u.role === 'admin' ? 'Super Admin' : u.role === 'branch_admin' ? 'Branch Admin' : 'Branch Staff'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            <strong style={{ color: '#065935' }}>🏢 {u.branch_name || 'Main Store'}</strong>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>Code: {u.branch_code || 'MAIN'}</div>
                          </td>
                          <td style={{ padding: '14px 18px' }}>
                            {isMainAdmin ? (
                              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '3px 8px', borderRadius: '6px' }}>
                                ✓ Full Access (All 16+ Menus)
                              </span>
                            ) : menus.length === 0 ? (
                              <span style={{ fontSize: '11.5px', color: '#dc2626' }}>No menus assigned</span>
                            ) : (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '380px' }}>
                                {menus.map(mKey => {
                                  const label = AVAILABLE_MENUS.find(m => m.key === mKey)?.label || mKey;
                                  return (
                                    <span
                                      key={mKey}
                                      style={{
                                        fontSize: '10.5px',
                                        fontWeight: 700,
                                        background: '#f1f5f9',
                                        color: '#334155',
                                        border: '1px solid #e2e8f0',
                                        padding: '1px 6px',
                                        borderRadius: '4px'
                                      }}
                                    >
                                      {label}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => openEditUser(u)}
                                style={{
                                  padding: '5px 12px',
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '5px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Edit &amp; Access
                              </button>
                              {!isMainAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  style={{
                                    padding: '5px 10px',
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#dc2626',
                                    borderRadius: '5px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* TAB 3: PRODUCT & CATEGORY PUSH DISTRIBUTION */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Target Branch Selector Strip */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1.5px solid #065935',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px',
                  boxShadow: '0 2px 8px rgba(6, 89, 53, 0.08)'
                }}
              >
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                    🏢 Central Warehouse &rarr; Branch Stock Allocation
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                    Push products and whole categories from Central Store to regional branches with dedicated stock.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                    TARGET BRANCH:
                  </label>
                  <select
                    value={targetBranchId}
                    onChange={(e) => setTargetBranchId(e.target.value)}
                    style={{
                      padding: '9px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid #065935',
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#065935',
                      background: '#f0fdf4',
                      cursor: 'pointer',
                      outline: 'none'
                    }}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        🏢 {b.name} [{b.code}] {b.code === 'MAIN' ? '(Head Warehouse)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Two Push Action Cards: By Category & By Product */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
                {/* Panel A: Push by Category */}
                <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '18px' }}>🚀</span>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      Push Whole Category to Branch
                    </h3>
                  </div>
                  <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: '#64748b' }}>
                    Automatically allocates all products in the selected category to the target branch.
                  </p>

                  <form onSubmit={handlePushCategory} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                        SELECT CATEGORY *
                      </label>
                      <select
                        value={selectedCatId}
                        onChange={(e) => setSelectedCatId(e.target.value)}
                        required
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '7px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          fontWeight: 600,
                          background: '#fff',
                          outline: 'none'
                        }}
                      >
                        <option value="">-- Choose Category ({categories.length} available) --</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.product_count ? `(${c.product_count} items)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                          INITIAL STOCK PER ITEM
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={catStock}
                          onChange={(e) => setCatStock(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '7px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            fontWeight: 700
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                          LOW STOCK ALERT AT
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={catLowThreshold}
                          onChange={(e) => setCatLowThreshold(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '7px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            fontWeight: 700
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={pushingCat || !selectedCatId}
                      style={{
                        marginTop: '6px',
                        background: '#065935',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: '7px',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: pushingCat || !selectedCatId ? 'not-allowed' : 'pointer',
                        opacity: pushingCat || !selectedCatId ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {pushingCat ? 'Pushing Category...' : '🚀 Push Category Products'}
                    </button>
                  </form>
                </div>

                {/* Panel B: Push Individual Product */}
                <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '18px' }}>📦</span>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      Push Specific Product to Branch
                    </h3>
                  </div>
                  <p style={{ margin: '0 0 16px', fontSize: '12.5px', color: '#64748b' }}>
                    Select an individual item from catalog to allocate or transfer stock.
                  </p>

                  <form onSubmit={handlePushProduct} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ position: 'relative' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                        SEARCH PRODUCT *
                      </label>
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          if (selectedProd && e.target.value !== selectedProd.name) {
                            setSelectedProd(null);
                          }
                        }}
                        placeholder="Type product name or barcode..."
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '7px',
                          border: selectedProd ? '1.5px solid #065935' : '1px solid #cbd5e1',
                          background: selectedProd ? '#f0fdf4' : '#ffffff',
                          fontSize: '13px',
                          fontWeight: 600,
                          outline: 'none'
                        }}
                      />
                      {selectedProd && (
                        <div style={{ fontSize: '11px', color: '#065935', fontWeight: 800, marginTop: '3px' }}>
                          ✓ Selected: {selectedProd.name} (₹{selectedProd.price})
                        </div>
                      )}
                      {productResults.length > 0 && !selectedProd && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: '#ffffff',
                            border: '1.5px solid #065935',
                            borderRadius: '7px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                            maxHeight: '220px',
                            overflowY: 'auto',
                            zIndex: 100
                          }}
                        >
                          {productResults.map(p => (
                            <div
                              key={p.id}
                              onClick={() => {
                                setSelectedProd(p);
                                setProductSearch(p.name);
                                setProductResults([]);
                              }}
                              style={{
                                padding: '8px 12px',
                                borderBottom: '1px solid #f1f5f9',
                                cursor: 'pointer',
                                fontSize: '12.5px',
                                fontWeight: 700,
                                display: 'flex',
                                justifyContent: 'space-between'
                              }}
                            >
                              <span>{p.name}</span>
                              <span style={{ color: '#065935', fontWeight: 800 }}>₹{p.price}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                          ALLOCATED STOCK
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={prodStock}
                          onChange={(e) => setProdStock(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '7px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            fontWeight: 700
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#475569', marginBottom: '4px' }}>
                          LOW STOCK ALERT AT
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={prodLowThreshold}
                          onChange={(e) => setProdLowThreshold(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '7px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            fontWeight: 700
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={pushingProd || !selectedProd}
                      style={{
                        marginTop: '6px',
                        background: '#1e293b',
                        color: '#ffffff',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: '7px',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: pushingProd || !selectedProd ? 'not-allowed' : 'pointer',
                        opacity: pushingProd || !selectedProd ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      {pushingProd ? 'Pushing Product...' : '📦 Push Single Product'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Table of Live Products Allocated to Selected Branch */}
              <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      Allocated Branch Inventory ({branchStocks.length} items)
                    </h3>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Live stock balance tracked for <strong>{branches.find(b => String(b.id) === String(targetBranchId))?.name || 'Selected Branch'}</strong>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={stockSearchQuery}
                    onChange={(e) => setStockSearchQuery(e.target.value)}
                    placeholder="Search allocated products..."
                    style={{
                      padding: '7px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      width: '240px'
                    }}
                  />
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 800, color: '#475569' }}>
                      <th style={{ padding: '12px 18px' }}>#</th>
                      <th style={{ padding: '12px 18px' }}>PRODUCT NAME</th>
                      <th style={{ padding: '12px 18px' }}>CATEGORY</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>SELLING PRICE</th>
                      <th style={{ padding: '12px 18px', textAlign: 'center' }}>BRANCH STOCK</th>
                      <th style={{ padding: '12px 18px', textAlign: 'center' }}>VISIBILITY IN BRANCH</th>
                      <th style={{ padding: '12px 18px', textAlign: 'center' }}>MAIN STORE STOCK</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingStocks ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                          Loading branch inventory...
                        </td>
                      </tr>
                    ) : branchStocks.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                          No products allocated to this branch yet. Use the cards above to push categories or products.
                        </td>
                      </tr>
                    ) : (
                      branchStocks
                        .filter(it => !stockSearchQuery || it.product_name?.toLowerCase().includes(stockSearchQuery.toLowerCase()))
                        .map((item, idx) => {
                          const isEditing = editingStockId === item.product_id;
                          const isLow = item.stock <= item.low_stock_threshold;
                          const isBranchVisible = item.is_active !== 0;
                          const mainStock = item.main_branch_stock ?? 0;
                          const isMainZero = mainStock === 0;

                          return (
                            <tr key={item.id || item.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '12px 18px', color: '#94a3b8', fontWeight: 600 }}>{idx + 1}</td>
                              <td style={{ padding: '12px 18px' }}>
                                <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.product_name}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>ID: {item.product_id}</div>
                              </td>
                              <td style={{ padding: '12px 18px', color: '#64748b', fontWeight: 600 }}>
                                {item.category_name || 'General'}
                              </td>
                              <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                                ₹{item.sale_price > 0 ? item.sale_price : item.price}
                              </td>
                              {/* Branch Stock Column */}
                              <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                                {isEditing ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingStockVal}
                                    onChange={(e) => setEditingStockVal(e.target.value)}
                                    style={{
                                      width: '64px',
                                      padding: '4px 6px',
                                      textAlign: 'center',
                                      borderRadius: '4px',
                                      border: '1.5px solid #065935',
                                      fontWeight: 800
                                    }}
                                  />
                                ) : (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      padding: '3px 10px',
                                      borderRadius: '12px',
                                      fontWeight: 800,
                                      fontSize: '12px',
                                      background: item.stock === 0 ? '#fef2f2' : isLow ? '#fffbeb' : '#ecfdf5',
                                      color: item.stock === 0 ? '#dc2626' : isLow ? '#b45309' : '#065935'
                                    }}
                                  >
                                    {item.stock} units
                                  </span>
                                )}
                              </td>

                              {/* Visibility in Branch Column */}
                              <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleToggleVisibility(item)}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    border: isBranchVisible ? '1px solid #86efac' : '1px solid #cbd5e1',
                                    background: isBranchVisible ? '#f0fdf4' : '#f8fafc',
                                    color: isBranchVisible ? '#15803d' : '#64748b',
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                  }}
                                  title={isBranchVisible ? 'Product is visible in this branch POS. Click to hide.' : 'Product is hidden from branch POS. Click to make visible.'}
                                >
                                  <span>{isBranchVisible ? '🟢' : '⚪'}</span>
                                  <span>{isBranchVisible ? 'Visible in Branch' : 'Hidden'}</span>
                                </button>
                              </td>

                              {/* Main Store Stock Column */}
                              <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '3px 9px',
                                    borderRadius: '12px',
                                    fontWeight: 800,
                                    fontSize: '11.5px',
                                    background: isMainZero ? '#fef2f2' : '#f8fafc',
                                    color: isMainZero ? '#dc2626' : '#334155',
                                    border: isMainZero ? '1.5px solid #fca5a5' : '1px solid #e2e8f0'
                                  }}
                                >
                                  {isMainZero ? '⚠️ 0 in Main (Out of Stock)' : `${mainStock} in Main`}
                                </span>
                              </td>

                              {/* Actions Column */}
                              <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                  {isEditing ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveStockUpdate(item.product_id)}
                                        style={{
                                          padding: '4px 8px',
                                          background: '#065935',
                                          color: '#fff',
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: 800,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setEditingStockId(null)}
                                        style={{
                                          padding: '4px 8px',
                                          background: '#f1f5f9',
                                          color: '#334155',
                                          border: 'none',
                                          borderRadius: '4px',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingStockId(item.product_id);
                                          setEditingStockVal(item.stock);
                                        }}
                                        style={{
                                          padding: '4px 9px',
                                          background: '#ffffff',
                                          border: '1px solid #cbd5e1',
                                          borderRadius: '5px',
                                          fontSize: '11px',
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                        title="Quick update branch stock quantity"
                                      >
                                        ✎ Qty
                                      </button>

                                      {/* Push to Main Branch Button */}
                                      <button
                                        type="button"
                                        onClick={() => handlePushToMain(item)}
                                        style={{
                                          padding: '4px 10px',
                                          background: isMainZero ? '#dc2626' : '#0f172a',
                                          color: '#ffffff',
                                          border: 'none',
                                          borderRadius: '5px',
                                          fontSize: '11px',
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
                                    </>
                                  )}
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
          )}
        </main>
      </div>

      {/* MODAL 1: CREATE / EDIT BRANCH */}
      <Modal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        title={editingBranch ? `Edit Branch: ${editingBranch.name}` : 'Set Up New Store Branch'}
        maxWidth="580px"
      >
        <form onSubmit={handleSaveBranch} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                BRANCH NAME *
              </label>
              <input
                type="text"
                required
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                placeholder="e.g. manali Branch"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                BRANCH CODE *
              </label>
              <input
                type="text"
                required
                value={branchForm.code}
                onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g. manali"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 800 }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                CONTACT PHONE
              </label>
              <input
                type="tel"
                value={branchForm.phone}
                onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                placeholder="+91 98400 12345"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                OFFICIAL EMAIL
              </label>
              <input
                type="email"
                value={branchForm.email}
                onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                placeholder="manali@npgrand.com"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
              STREET ADDRESS
            </label>
            <textarea
              rows={2}
              value={branchForm.address}
              onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
              placeholder="e.g. No. 45, manali Street, George Town"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>CITY</label>
              <input
                type="text"
                value={branchForm.city}
                onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                placeholder="Chennai"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>STATE</label>
              <input
                type="text"
                value={branchForm.state}
                onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                placeholder="Tamil Nadu"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>PINCODE</label>
              <input
                type="text"
                value={branchForm.pincode}
                onChange={(e) => setBranchForm({ ...branchForm, pincode: e.target.value })}
                placeholder="600001"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
            <input
              type="checkbox"
              id="branch-active-check"
              checked={branchForm.is_active}
              onChange={(e) => setBranchForm({ ...branchForm, is_active: e.target.checked })}
              style={{ width: '16px', height: '16px', accentColor: '#065935' }}
            />
            <label htmlFor="branch-active-check" style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
              Branch is Active and Open for Billing
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
            <button
              type="button"
              onClick={() => setIsBranchModalOpen(false)}
              style={{ padding: '9px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '9px 20px', borderRadius: '6px', border: 'none', background: '#065935', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}
            >
              {editingBranch ? 'Update Branch' : 'Create Branch'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: CREATE / EDIT BRANCH USER & PERMISSIONS */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={editingUser ? `Manage Branch User: ${editingUser.name}` : 'Create New Branch User & Set Permissions'}
        maxWidth="680px"
      >
        <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                STAFF FULL NAME *
              </label>
              <input
                type="text"
                required
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                placeholder="e.g. manali Branch Admin"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                ASSIGNED BRANCH *
              </label>
              <select
                value={userForm.branch_id}
                onChange={(e) => setUserForm({ ...userForm, branch_id: e.target.value })}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, background: '#ffffff' }}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    🏢 {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                LOGIN USERNAME / EMAIL *
              </label>
              <input
                type="email"
                required
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="e.g. manali@npgrand.com"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                LOGIN PASSWORD {editingUser ? '(LEAVE BLANK TO KEEP)' : '*'}
              </label>
              <input
                type="password"
                required={!editingUser}
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                placeholder={editingUser ? '•••••••• (unchanged)' : 'Enter password'}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                STAFF ROLE
              </label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff' }}
              >
                <option value="branch_admin">Branch Admin (Manager)</option>
                <option value="branch_staff">Branch Staff (Cashier / Counter)</option>
                <option value="admin">Super Admin (Store Owner)</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '4px' }}>
                PHONE NUMBER
              </label>
              <input
                type="tel"
                value={userForm.phone}
                onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                placeholder="+91 98400 12345"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* PERMISSIONS / RESTRICTED MENU CHECKLIST */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px', marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 900, color: '#065935', display: 'block' }}>
                  RESTRICTED MENU ACCESS PERMISSIONS
                </label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Check only the dashboard modules this branch user is allowed to access:
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setUserForm({ ...userForm, allowed_menus: AVAILABLE_MENUS.map(m => m.key) })}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setUserForm({ ...userForm, allowed_menus: ['dashboard', 'pos', 'orders', 'inventory'] })}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Default POS
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '220px', overflowY: 'auto', padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {AVAILABLE_MENUS.map(menu => {
                const isChecked = userForm.allowed_menus.includes(menu.key);
                return (
                  <label
                    key={menu.key}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px',
                      borderRadius: '6px',
                      background: isChecked ? '#ecfdf5' : '#ffffff',
                      border: isChecked ? '1.5px solid #065935' : '1px solid #e2e8f0',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleMenuPermission(menu.key)}
                      style={{ marginTop: '2px', accentColor: '#065935', width: '15px', height: '15px' }}
                    />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: isChecked ? '#065935' : '#0f172a' }}>
                        {menu.label}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>
                        {menu.desc}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', borderTop: '1px solid #f1f5f9', paddingTop: '14px' }}>
            <button
              type="button"
              onClick={() => setIsUserModalOpen(false)}
              style={{ padding: '9px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{ padding: '9px 20px', borderRadius: '6px', border: 'none', background: '#065935', color: '#ffffff', fontWeight: 800, cursor: 'pointer' }}
            >
              {editingUser ? 'Save User & Access' : 'Create Branch User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

