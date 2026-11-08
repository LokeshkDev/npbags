'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icons';
import { useAdminAuth } from '../../lib/auth';
import useScannerInput from '../../hooks/useScannerInput';
import {
  getAdminVendors,
  createAdminVendor,
  updateAdminVendor,
  deleteAdminVendor,
  getAdminVendorPurchaseHistory,
  getAdminPurchaseBills,
  getAdminOutstandingPurchaseBills,
  getAdminPurchaseBillById,
  getNextPurchaseBillNumber,
  createAdminPurchaseBill,
  updateAdminPurchaseBill,
  confirmAdminPurchaseBill,
  addAdminPurchaseBillPayment,
  deleteAdminPurchaseBill,
  getAdminProducts,
  getAdminBranches,
  scanPurchaseBarcode,
  createProductFromScan,
  applyScannedStock
} from '../../lib/api';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const today = () => new Date().toISOString().slice(0, 10);
const toDateInput = (value) => {
  if (!value) return '';
  const formatLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  if (value instanceof Date) return formatLocal(value);
  const str = String(value);
  if (str.includes('T')) {
    const date = new Date(str);
    if (!Number.isNaN(date.getTime())) return formatLocal(date);
  }
  return str.slice(0, 10);
};

const emptyVendorForm = {
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
  is_active: true,
  branch_id: 1
};

let billItemKey = 1;
const newBillItem = () => ({
  key: `item-${billItemKey++}`,
  product_id: '',
  product_name: '',
  variant_id: '',
  variant_info: '',
  quantity: 1,
  purchase_rate: '',
  mrp: '',
  gst_type: 'exclusive',
  gst_rate: '18',
  discount_type: 'flat',
  discount_value: '',
  manufacturing_date: '',
  expiry_date: ''
});

const parseAmount = (value) => {
  const num = parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(num) ? num : 0;
};

const computeBillItemCosting = (item, product) => {
  const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
  const rate = parseAmount(item.purchase_rate);
  const gstPct = Math.max(0, parseFloat(item.gst_rate) || 0);
  const gstType = item.gst_type === 'inclusive' ? 'inclusive' : 'exclusive';
  const landingUnit = gstType === 'exclusive' && gstPct > 0 && rate > 0
    ? Math.round(rate * (1 + gstPct / 100) * 100) / 100
    : rate;

  const gross = Math.round(rate * qty * 100) / 100;
  const discountType = item.discount_type === 'percent' ? 'percent' : 'flat';
  const rawDiscount = Math.max(0, parseAmount(item.discount_value));
  const discountAmount = discountType === 'percent'
    ? Math.round((gross * Math.min(100, rawDiscount)) / 100 * 100) / 100
    : Math.min(gross, Math.round(rawDiscount * 100) / 100);
  const netAmount = Math.round((gross - discountAmount) * 100) / 100;

  const mrpValue = parseAmount(item.mrp);
  const sellValue = parseAmount(product?.sale_price || product?.price);
  const marginBase = mrpValue > 0 ? mrpValue : sellValue;
  const purchaseMargin = marginBase > 0 && landingUnit > 0
    ? Math.round(((marginBase - landingUnit) / marginBase) * 1000) / 10
    : 0;
  const landingMargin = sellValue > 0 && landingUnit > 0
    ? Math.round(((sellValue - landingUnit) / sellValue) * 1000) / 10
    : 0;
  const netProfitUnit = sellValue > 0 ? Math.round((sellValue - landingUnit) * 100) / 100 : 0;

  return {
    qty,
    rate,
    gross,
    discountType,
    discountAmount,
    netAmount,
    landingUnit,
    purchaseMargin,
    landingMargin,
    sellValue,
    netProfitUnit,
    mrpValue
  };
};

const emptyBillForm = {
  vendor_id: '',
  branch_id: 1,
  bill_number: '',
  purchase_date: today(),
  additional_charges: '',
  amount_paid: '',
  payment_method: 'Cash',
  notes: '',
  confirm: true,
  items: [newBillItem()]
};

function StatCard({ label, value, hint, color = '#0f172a' }) {
  return (
    <div className="admin-card" style={{ padding: '16px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '25px', fontWeight: 800, color, marginTop: '6px' }}>{value}</div>
      {hint && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>{hint}</div>}
    </div>
  );
}

function PaymentBadge({ status }) {
  const colors = {
    Paid: { background: '#dcfce7', color: '#15803d' },
    'Partially Paid': { background: '#fef3c7', color: '#b45309' },
    Unpaid: { background: '#fee2e2', color: '#b91c1c' }
  };
  const theme = colors[status] || { background: '#f1f5f9', color: '#475569' };
  return (
    <span style={{ ...theme, padding: '3px 9px', borderRadius: '12px', fontSize: '11px', fontWeight: 800, display: 'inline-block' }}>
      {status || 'Unpaid'}
    </span>
  );
}

export default function AdminVendorsPage() {
  const router = useRouter();
  const { adminUser } = useAdminAuth();
  const isSuperAdmin = !adminUser || adminUser.role === 'admin';
  const userBranchId = adminUser?.branch_id ? String(adminUser.branch_id) : '';

  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState(isSuperAdmin ? 'all' : (userBranchId || '1'));

  const [mainTab, setMainTab] = useState('vendors');
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedVendorId, setExpandedVendorId] = useState(null);
  const [expandedVendorTab, setExpandedVendorTab] = useState('bills');
  const [vendorHistory, setVendorHistory] = useState({});
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [bills, setBills] = useState([]);
  const [billSummary, setBillSummary] = useState({});
  const [loadingBills, setLoadingBills] = useState(false);
  const [billFilters, setBillFilters] = useState({ bill_number: '', search: '', status: 'all', payment_status: 'all', from_date: '', to_date: '', vendor_id: 'all' });

  const [outstanding, setOutstanding] = useState({ bills: [], vendor_totals: [], summary: {} });
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [formData, setFormData] = useState(emptyVendorForm);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  const [isBillModalOpen, setIsBillModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState(null);
  const [billForm, setBillForm] = useState(emptyBillForm);
  const [savingBill, setSavingBill] = useState(false);
  const [billError, setBillError] = useState('');

  const [selectedBill, setSelectedBill] = useState(null);
  const [loadingBillDetail, setLoadingBillDetail] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: today(), payment_method: 'Cash', notes: '' });
  const [recordingPayment, setRecordingPayment] = useState(false);

  const scanInputRef = useRef(null);
  const newProductNameRef = useRef(null);
  const scanStockRef = useRef([]);
  const billSavingRef = useRef(false);
  const [scanCode, setScanCode] = useState('');
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [pendingNewProduct, setPendingNewProduct] = useState(null);
  const [savingScannedProduct, setSavingScannedProduct] = useState(false);

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Load branches
  useEffect(() => {
    getAdminBranches()
      .then(res => {
        if (res && Array.isArray(res.branches)) {
          setBranches(res.branches);
        }
      })
      .catch(err => console.warn('Failed to load branches:', err));
  }, []);

  useEffect(() => {
    if (adminUser?.branch_id) {
      setSelectedBranchId(String(adminUser.branch_id));
    }
  }, [adminUser]);

  const loadVendors = async (branchId = selectedBranchId) => {
    try {
      setLoading(true);
      const params = {};
      if (branchId && branchId !== 'all') params.branch_id = branchId;
      const data = await getAdminVendors(params);
      setVendors(Array.isArray(data) ? data : (data && Array.isArray(data.vendors) ? data.vendors : []));
    } catch (err) {
      showToast(err.message || 'Failed to load vendors', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await getAdminProducts({ limit: 1000 });
      const list = res?.products || (Array.isArray(res) ? res : []);
      setProducts(Array.isArray(list) ? list : []);
    } catch (_) {
      setProducts([]);
    }
  };

  const loadPurchaseBills = async (filters = billFilters, branchId = selectedBranchId) => {
    try {
      setLoadingBills(true);
      const params = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params[key] = value;
      });
      if (branchId && branchId !== 'all') params.branch_id = branchId;
      const data = await getAdminPurchaseBills(params);
      setBills(Array.isArray(data?.bills) ? data.bills : []);
      setBillSummary(data?.summary || {});
    } catch (err) {
      showToast(err.message || 'Failed to load purchase bills', 'error');
    } finally {
      setLoadingBills(false);
    }
  };

  const resetBillFilters = () => {
    const next = { bill_number: '', search: '', status: 'all', payment_status: 'all', from_date: '', to_date: '', vendor_id: 'all' };
    setBillFilters(next);
    loadPurchaseBills(next, selectedBranchId);
  };

  const loadOutstanding = async (branchId = selectedBranchId) => {
    try {
      setLoadingOutstanding(true);
      const params = {};
      if (branchId && branchId !== 'all') params.branch_id = branchId;
      const data = await getAdminOutstandingPurchaseBills(params);
      setOutstanding({
        bills: Array.isArray(data?.bills) ? data.bills : [],
        vendor_totals: Array.isArray(data?.vendor_totals) ? data.vendor_totals : [],
        summary: data?.summary || {}
      });
    } catch (err) {
      showToast(err.message || 'Failed to load outstanding payables', 'error');
    } finally {
      setLoadingOutstanding(false);
    }
  };

  useEffect(() => {
    loadVendors(selectedBranchId);
    loadProducts();
    loadPurchaseBills(billFilters, selectedBranchId);
    loadOutstanding(selectedBranchId);
  }, [selectedBranchId]);

  useEffect(() => {
    // Check if returning from creating a product for a purchase bill
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('from_product_create') === '1') {
        try {
          const savedDraft = window.sessionStorage.getItem('vendor_purchase_bill_draft');
          const newlyCreatedRaw = window.sessionStorage.getItem('vendor_bill_new_product');
          let restoredForm = null;
          if (savedDraft) {
            restoredForm = JSON.parse(savedDraft);
          }

          const withStockApplied = (form) => ({
            ...form,
            items: (form.items || []).map(it => {
              const applied = Math.max(0, Number(it.stock_applied_qty) || 0);
              return { ...it, stock_applied_qty: applied, stock_scan_applied: applied };
            })
          });

          if (newlyCreatedRaw) {
            const newProd = JSON.parse(newlyCreatedRaw);
            const newItem = {
              key: `item-${billItemKey++}`,
              product_id: newProd.id,
              product_name: newProd.name,
              variant_id: '',
              variant_info: '',
              quantity: 1,
              purchase_rate: newProd.purchased_rate || newProd.purchase_price || '',
              mrp: newProd.mrp !== null && newProd.mrp !== undefined ? String(newProd.mrp) : '',
              gst_type: newProd.gst_type || 'exclusive',
              gst_rate: newProd.gst_rate !== null && newProd.gst_rate !== undefined ? String(newProd.gst_rate) : '18',
              discount_type: 'flat',
              discount_value: '',
              manufacturing_date: toDateInput(newProd.manufacturing_date),
              expiry_date: toDateInput(newProd.expiry_date)
            };

            if (restoredForm) {
              const cleanItems = (restoredForm.items || []).filter(it => it.product_name && it.product_name.trim());
              restoredForm.items = [...cleanItems, newItem];
              setBillForm(withStockApplied(restoredForm));
            } else {
              setBillForm(prev => ({
                ...prev,
                items: [...prev.items.filter(it => it.product_name), newItem]
              }));
            }
          } else if (restoredForm) {
            setBillForm(withStockApplied(restoredForm));
          }

          if (restoredForm) {
            const restoredBranch = Number(restoredForm.branch_id || 1);
            (restoredForm.items || []).forEach(item => {
              const applied = Number(item.stock_applied_qty) || 0;
              if (applied > 0) {
                scanStockRef.current.push({
                  key: item.key,
                  product_id: item.product_id,
                  variant_id: item.variant_id || null,
                  quantity: applied,
                  branch_id: restoredBranch,
                  scanned_code: item.barcode || '',
                  applied: true
                });
              }
            });
          }

          setIsBillModalOpen(true);
          window.sessionStorage.removeItem('vendor_purchase_bill_draft');
          window.sessionStorage.removeItem('vendor_bill_new_product');
          window.history.replaceState({}, '', '/vendors');
        } catch (err) {
          console.warn('Could not restore vendor bill draft:', err);
        }
      }
    }
  }, []);

  const handleRedirectNewProduct = (prefillName = '') => {
    try {
      window.sessionStorage.setItem('vendor_purchase_bill_draft', JSON.stringify(billForm));
    } catch (e) {
      console.warn('Could not save draft to sessionStorage', e);
    }
    const params = new URLSearchParams();
    params.set('from', 'vendor_bill');
    if (billForm.vendor_id) params.set('vendor_id', String(billForm.vendor_id));
    if (prefillName && typeof prefillName === 'string') params.set('product_name', prefillName.trim());
    router.push(`/products?${params.toString()}`);
  };

  useEffect(() => {
    if (mainTab === 'purchase-bills') loadPurchaseBills();
    if (mainTab === 'outstanding') loadOutstanding();
  }, [mainTab]);

  // Keyboard shortcut F2 or Alt+N to open New Purchase Bill
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.key === 'F2' || (e.altKey && (e.key === 'n' || e.key === 'N'))) && !isBillModalOpen) {
        e.preventDefault();
        openNewBill('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBillModalOpen]);

  const refreshAll = () => {
    loadVendors();
    loadPurchaseBills();
    loadOutstanding();
    loadProducts();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('np_inventory_updated'));
      window.dispatchEvent(new CustomEvent('np_product_updated'));
    }
    if (expandedVendorId) loadVendorHistory(expandedVendorId);
  };

  const loadVendorHistory = async (vendorId) => {
    setLoadingHistory(true);
    try {
      const data = await getAdminVendorPurchaseHistory(vendorId);
      setVendorHistory(prev => ({ ...prev, [vendorId]: data }));
    } catch (err) {
      showToast(err.message || 'Failed to load vendor history', 'error');
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleVendor = (vendor) => {
    if (expandedVendorId === vendor.id) {
      setExpandedVendorId(null);
      return;
    }
    setExpandedVendorId(vendor.id);
    setExpandedVendorTab('bills');
    if (!vendorHistory[vendor.id]) loadVendorHistory(vendor.id);
  };

  const openAddModal = () => {
    setEditingVendor(null);
    setErrorMsg('');
    const defaultBranch = isSuperAdmin ? (selectedBranchId !== 'all' ? Number(selectedBranchId) : 1) : (Number(userBranchId) || 1);
    setFormData({ ...emptyVendorForm, branch_id: defaultBranch });
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
      is_active: vendor.is_active !== undefined ? Boolean(vendor.is_active) : true,
      branch_id: vendor.branch_id || 1
    });
    setIsModalOpen(true);
  };

  const handleSubmitVendor = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Vendor Name is required.');
      return;
    }
    try {
      setSaving(true);
      setErrorMsg('');
      const submitData = {
        ...formData,
        branch_id: Number(formData.branch_id || (isSuperAdmin ? (selectedBranchId !== 'all' ? selectedBranchId : 1) : userBranchId) || 1)
      };
      if (editingVendor) {
        await updateAdminVendor(editingVendor.id, submitData);
        showToast(`Vendor "${formData.name}" updated successfully.`);
      } else {
        await createAdminVendor(submitData);
        showToast(`Vendor "${formData.name}" added successfully.`);
      }
      setIsModalOpen(false);
      loadVendors(selectedBranchId);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save vendor details.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVendor = async (vendor) => {
    const prompt = `Are you sure you want to delete vendor "${vendor.name}"? Linked purchase bills will also be removed.`;
    if (!window.confirm(prompt)) return;
    try {
      await deleteAdminVendor(vendor.id);
      showToast(`Vendor "${vendor.name}" deleted.`);
      refreshAll();
    } catch (err) {
      showToast(err.message || 'Failed to delete vendor', 'error');
    }
  };

  const resetBillForm = async (vendorId = '') => {
    let number = '';
    try {
      const res = await getNextPurchaseBillNumber();
      number = res?.bill_number || '';
    } catch (_) {}
    const defaultBranch = isSuperAdmin ? (selectedBranchId !== 'all' ? Number(selectedBranchId) : 1) : (Number(userBranchId) || 1);
    setBillForm({
      ...emptyBillForm,
      vendor_id: vendorId ? String(vendorId) : '',
      branch_id: defaultBranch,
      bill_number: number,
      items: [newBillItem()]
    });
  };

  const openNewBill = async (vendorId = '') => {
    setEditingBill(null);
    setBillError('');
    reverseScanStockAdjustments();
    resetScanState();
    await resetBillForm(vendorId);
    setIsBillModalOpen(true);
  };

  const openEditBill = async (billOrId) => {
    const id = typeof billOrId === 'object' ? billOrId.id : billOrId;
    if (!id) return;
    setBillError('');
    reverseScanStockAdjustments();
    resetScanState();
    try {
      const detail = await getAdminPurchaseBillById(id);
      setEditingBill(detail);
      setBillForm({
        vendor_id: detail.vendor_id ? String(detail.vendor_id) : '',
        branch_id: detail.branch_id || 1,
        bill_number: detail.bill_number || '',
        purchase_date: detail.purchase_date ? toDateInput(detail.purchase_date) : today(),
        additional_charges: detail.additional_charges !== null && detail.additional_charges !== undefined ? String(detail.additional_charges) : '',
        amount_paid: detail.amount_paid !== null && detail.amount_paid !== undefined ? String(detail.amount_paid) : '',
        payment_method: 'Cash',
        notes: detail.notes || '',
        confirm: detail.status === 'confirmed',
        items: (detail.items || []).map(item => ({
          key: `edit-${item.id}`,
          product_id: item.product_id || '',
          product_name: item.product_name || '',
          variant_id: item.variant_id ? String(item.variant_id) : '',
          variant_info: item.variant_info || '',
          quantity: Number(item.quantity) || 1,
          purchase_rate: item.purchase_rate || (item.purchased_rate || (item.rate_value !== null && item.rate_value !== undefined ? String(item.rate_value) : '')),
          mrp: item.mrp !== null && item.mrp !== undefined ? String(item.mrp) : '',
          gst_type: item.gst_type || 'exclusive',
          gst_rate: item.gst_rate !== null && item.gst_rate !== undefined ? String(item.gst_rate) : '18',
          discount_type: item.discount_type === 'percent' ? 'percent' : 'flat',
          discount_value: item.discount_value !== null && item.discount_value !== undefined && Number(item.discount_value) !== 0 ? String(item.discount_value) : '',
          manufacturing_date: toDateInput(item.manufacturing_date),
          expiry_date: toDateInput(item.expiry_date),
          barcode: item.barcode || '',
          stock_applied_qty: Math.max(0, Number(item.stock_applied_qty) || 0),
          stock_scan_applied: 0
        }))
      });
      setIsBillModalOpen(true);
    } catch (err) {
      showToast(err.message || 'Failed to load purchase bill', 'error');
    }
  };

  const billBranchId = () => Number(
    billForm.branch_id
    || (isSuperAdmin ? (selectedBranchId !== 'all' ? selectedBranchId : 1) : userBranchId)
    || 1
  );

  const bumpLocalProductStock = (productId, variantId, delta) => {
    if (!productId || !delta) return;
    setProducts(prev => prev.map(product => {
      if (String(product.id) !== String(productId)) return product;
      const variants = Array.isArray(product.variants) ? product.variants : [];
      if (variants.length === 0) {
        return { ...product, stock: Math.max(0, (Number(product.stock) || 0) + delta) };
      }
      const matched = variantId
        ? variants.find(v => String(v.id) === String(variantId))
        : null;
      const targetId = String((matched || variants[0]).id);
      const nextVariants = variants.map(v => String(v.id) === targetId
        ? { ...v, stock_quantity: Math.max(0, (Number(v.stock_quantity) || 0) + delta) }
        : v);
      const stock = nextVariants.reduce((sum, v) => sum + (Number(v.stock_quantity) || 0), 0);
      return { ...product, variants: nextVariants, stock };
    }));
  };

  const revertScanStock = async (entry) => {
    if (!entry || !entry.applied) return;
    try {
      await applyScannedStock({
        product_id: entry.product_id,
        variant_id: entry.variant_id || null,
        quantity: entry.quantity,
        direction: -1,
        branch_id: entry.branch_id,
        scanned_code: entry.scanned_code || ''
      });
      bumpLocalProductStock(entry.product_id, entry.variant_id, -entry.quantity);
    } catch (err) {
      console.warn('Could not revert scanned stock:', err);
    }
  };

  const reverseScanStockAdjustments = async () => {
    const entries = scanStockRef.current;
    scanStockRef.current = [];
    for (const entry of entries) {
      await revertScanStock(entry);
    }
  };

  const trackScanStock = (item, quantity, applied, scannedCode, branchId) => {
    if (!applied) return;
    scanStockRef.current.push({
      key: item.key,
      product_id: item.product_id,
      variant_id: item.variant_id || null,
      quantity,
      branch_id: branchId || billBranchId(),
      scanned_code: scannedCode || item.barcode || '',
      applied: true
    });
  };

  const releaseScanStockForItem = (item) => {
    if (!item || !item.key || Number(item.stock_applied_qty) <= 0) return;
    const entryIdx = scanStockRef.current.findIndex(entry => entry.key === item.key);
    if (entryIdx < 0) return;
    const [entry] = scanStockRef.current.splice(entryIdx, 1);
    revertScanStock(entry);
  };

  const closeBillModal = () => {
    if (!billSavingRef.current) reverseScanStockAdjustments();
    resetScanState();
    setIsBillModalOpen(false);
  };

  const handleBillBranchChange = (value) => {
    const nextBranch = Number(value) || 1;
    if (nextBranch === Number(billForm.branch_id)) return;
    reverseScanStockAdjustments();
    setBillForm(prev => ({
      ...prev,
      branch_id: nextBranch,
      items: prev.items.map(item => ({ ...item, stock_applied_qty: 0, stock_scan_applied: 0 }))
    }));
  };

  const handleConfirmToggle = (checked) => {
    if (!checked && billForm.confirm) reverseScanStockAdjustments();
    setBillForm(prev => ({
      ...prev,
      confirm: checked,
      items: checked
        ? prev.items
        : prev.items.map(item => ({ ...item, stock_applied_qty: 0, stock_scan_applied: 0 }))
    }));
  };

  const updateBillItem = (index, updates) => {
    const current = billForm.items[index];
    const productChanged =
      (updates.product_id !== undefined && String(updates.product_id) !== String(current?.product_id || '')) ||
      (updates.variant_id !== undefined && String(updates.variant_id) !== String(current?.variant_id || ''));

    let nextUpdates = updates;
    if (productChanged && current && (Number(current.stock_applied_qty) > 0 || Number(current.stock_scan_applied) > 0)) {
      releaseScanStockForItem(current);
      nextUpdates = { ...updates, stock_applied_qty: 0, stock_scan_applied: 0 };
    }

    setBillForm(prev => {
      const items = prev.items.map((item, idx) => idx === index ? { ...item, ...nextUpdates } : item);
      return { ...prev, items };
    });
  };

  const handleItemProductName = (index, value) => {
    const match = products.find(p => String(p.name || '').trim().toLowerCase() === value.trim().toLowerCase());
    if (match) {
      const vars = Array.isArray(match.variants) ? match.variants : [];
      const firstVar = vars.length > 0 ? vars[0] : null;
      updateBillItem(index, {
        product_name: match.name,
        product_id: match.id,
        variant_id: firstVar ? String(firstVar.id) : '',
        variant_info: firstVar ? [firstVar.color_name, firstVar.size_name].filter(Boolean).join(' / ') : '',
        purchase_rate: match.purchased_rate !== null && match.purchased_rate !== undefined
          ? String(match.purchased_rate)
          : (match.purchase_price !== null && match.purchase_price !== undefined ? String(match.purchase_price) : ''),
        mrp: match.mrp !== null && match.mrp !== undefined ? String(match.mrp) : '',
        gst_type: match.gst_type || 'exclusive',
        gst_rate: match.gst_rate !== null && match.gst_rate !== undefined ? String(match.gst_rate) : '18',
        manufacturing_date: toDateInput(match.manufacturing_date),
        expiry_date: toDateInput(match.expiry_date)
      });
    } else {
      updateBillItem(index, { product_name: value, product_id: '', variant_id: '', variant_info: '' });
    }
  };

  const addBillItem = () => setBillForm(prev => ({ ...prev, items: [...prev.items, newBillItem()] }));
  const removeBillItem = (index) => {
    const current = billForm.items[index];
    if (current) releaseScanStockForItem(current);
    setBillForm(prev => {
      const items = prev.items.filter((_, idx) => idx !== index);
      return { ...prev, items: items.length > 0 ? items : [newBillItem()] };
    });
  };

  const resetScanState = () => {
    setScanCode('');
    setScanResult(null);
    setScanError('');
    setPendingNewProduct(null);
    setScanLoading(false);
  };

  const performScan = async (rawCode) => {
    const code = String(rawCode || '').trim();
    if (!code) {
      setScanError('Enter or scan a barcode / QR code first.');
      return;
    }
    setScanLoading(true);
    setScanError('');
    try {
      const res = await scanPurchaseBarcode(code, adminUser?.branch_id || null);
      if (res && res.found) {
        setScanResult(res);
        setPendingNewProduct(null);
        showToast(`Found: ${res.product_name}`, 'success');
        setTimeout(() => scanInputRef.current?.focus(), 0);
      } else {
        setScanResult(null);
        setPendingNewProduct({
          scanned_code: res?.scanned_code || code,
          name: res?.payload?.name || '',
          purchase_rate: '',
          mrp: '',
          sale_price: '',
          gst_type: 'exclusive',
          gst_rate: '18',
          hsn_code: '4202',
          stock: 0,
          quantity: 1,
          description: ''
        });
        showToast('New product detected. Fill in details to add it to the catalog.', 'info');
        setTimeout(() => newProductNameRef.current?.focus(), 0);
      }
    } catch (err) {
      setScanResult(null);
      setScanError(err.message || 'Could not scan the product.');
      showToast(err.message || 'Could not scan the product', 'error');
    } finally {
      setScanLoading(false);
    }
  };

  const buildItemFromScanDefaults = (defaults) => ({
    key: `item-${billItemKey++}`,
    product_id: defaults?.product_id || '',
    product_name: defaults?.product_name || '',
    variant_id: defaults?.variant_id || '',
    variant_info: defaults?.variant_info || '',
    quantity: 1,
    purchase_rate: defaults?.purchase_rate || '',
    mrp: defaults?.mrp || '',
    gst_type: defaults?.gst_type || 'exclusive',
    gst_rate: defaults?.gst_rate || '18',
    discount_type: 'flat',
    discount_value: '',
    manufacturing_date: defaults?.manufacturing_date || '',
    expiry_date: defaults?.expiry_date || '',
    barcode: defaults?.barcode || '',
    stock_applied_qty: Number(defaults?.stock_applied_qty) || 0,
    stock_scan_applied: Number(defaults?.stock_scan_applied) || 0
  });

  const addScannedResultToBill = async () => {
    const result = scanResult;
    if (!result || !result.found || !result.item) return false;

    const newItem = buildItemFromScanDefaults(result.item);
    const branchId = billBranchId();
    const scannedCode = newItem.barcode || result.scanned_code || result.barcode || '';
    let appliedQty = 0;

    try {
      const stockRes = await applyScannedStock({
        product_id: newItem.product_id,
        variant_id: newItem.variant_id ? Number(newItem.variant_id) : null,
        quantity: newItem.quantity,
        direction: 1,
        branch_id: branchId,
        scanned_code: scannedCode
      });
      appliedQty = newItem.quantity;
      bumpLocalProductStock(newItem.product_id, newItem.variant_id, appliedQty);
      if (stockRes && typeof stockRes.stock === 'number') {
        setScanResult(prev => prev
          ? { ...prev, stock: stockRes.stock, branch_stock: stockRes.branch_stock ?? prev.branch_stock }
          : prev);
      }
    } catch (err) {
      console.warn('Could not update stock immediately:', err);
    }

    newItem.stock_applied_qty = appliedQty;
    newItem.stock_scan_applied = appliedQty;
    trackScanStock(newItem, newItem.quantity, appliedQty, scannedCode, branchId);

    setBillForm(prev => {
      const items = [...prev.items];
      const emptyIdx = items.findIndex(it => !it.product_name && !it.product_id);
      if (emptyIdx >= 0) items[emptyIdx] = newItem;
      else items.push(newItem);
      return { ...prev, items };
    });
    showToast(
      appliedQty > 0
        ? `Added ${result.product_name} to the bill. Stock updated.`
        : `Added ${result.product_name} to the bill. Stock will update when the bill is confirmed.`,
      appliedQty > 0 ? 'success' : 'info'
    );
    setScanResult(null);
    setScanCode('');
    setTimeout(() => scanInputRef.current?.focus(), 0);
    return true;
  };

  const handleScanKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    if (pendingNewProduct) {
      newProductNameRef.current?.focus();
      return;
    }
    if (scanResult && scanResult.found) {
      addScannedResultToBill();
      return;
    }
    performScan(scanCode);
  };

  const addScannedProductToBill = async (product, quantity = 1) => {
    const itemDefaults = {
      product_id: product.id,
      product_name: product.name,
      purchase_rate: product.purchased_rate !== null && product.purchased_rate !== undefined && String(product.purchased_rate).trim() !== ''
        ? String(product.purchased_rate)
        : (product.purchase_price !== null && product.purchase_price !== undefined ? String(product.purchase_price) : ''),
      mrp: product.mrp !== null && product.mrp !== undefined ? String(product.mrp) : '',
      gst_type: product.gst_type || 'exclusive',
      gst_rate: product.gst_rate !== null && product.gst_rate !== undefined ? String(product.gst_rate) : '18',
      manufacturing_date: toDateInput(product.manufacturing_date),
      expiry_date: toDateInput(product.expiry_date),
      barcode: product.barcode || ''
    };
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const newItem = { ...buildItemFromScanDefaults(itemDefaults), quantity: qty };
    const branchId = billBranchId();
    const scannedCode = product.barcode || '';
    let appliedQty = 0;

    try {
      await applyScannedStock({
        product_id: newItem.product_id,
        variant_id: newItem.variant_id ? Number(newItem.variant_id) : null,
        quantity: qty,
        direction: 1,
        branch_id: branchId,
        scanned_code: scannedCode
      });
      appliedQty = qty;
      bumpLocalProductStock(newItem.product_id, newItem.variant_id, appliedQty);
    } catch (err) {
      console.warn('Could not update stock immediately:', err);
    }

    newItem.stock_applied_qty = appliedQty;
    newItem.stock_scan_applied = appliedQty;
    trackScanStock(newItem, qty, appliedQty, scannedCode, branchId);

    setBillForm(prev => {
      const items = [...prev.items];
      const emptyIdx = items.findIndex(it => !it.product_name && !it.product_id);
      if (emptyIdx >= 0) items[emptyIdx] = newItem;
      else items.push(newItem);
      return { ...prev, items };
    });

    return appliedQty;
  };

  const handleCreateScannedProduct = async () => {
    if (!pendingNewProduct) return;
    if (!String(pendingNewProduct.name || '').trim()) {
      showToast('Product name is required.', 'error');
      return;
    }
    try {
      setSavingScannedProduct(true);
      const res = await createProductFromScan({
        ...pendingNewProduct,
        vendor_id: billForm.vendor_id || null
      });
      const product = res?.product || res;
      if (!product || !product.id) throw new Error('Product could not be created.');
      setProducts(prev => [product, ...prev.filter(p => String(p.id) !== String(product.id))]);
      const appliedQty = await addScannedProductToBill(
        { ...product, barcode: res?.barcode || pendingNewProduct.scanned_code },
        pendingNewProduct.quantity
      );
      showToast(
        appliedQty > 0
          ? `"${product.name}" added to catalog and bill. Stock updated.`
          : `"${product.name}" added to catalog and bill.`,
        appliedQty > 0 ? 'success' : 'info'
      );
      resetScanState();
      setTimeout(() => scanInputRef.current?.focus(), 0);
    } catch (err) {
      showToast(err.message || 'Failed to add scanned product', 'error');
    } finally {
      setSavingScannedProduct(false);
    }
  };

  const handleHardwareScan = useCallback((code) => {
    if (!isBillModalOpen) return;
    if (pendingNewProduct) return;
    performScan(code);
  }, [isBillModalOpen, pendingNewProduct, performScan]);

  useScannerInput(handleHardwareScan, { enabled: isBillModalOpen, maxLength: 512 });

  useEffect(() => {
    return () => {
      if (!billSavingRef.current) reverseScanStockAdjustments();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const billTotals = useMemo(() => {
    return billForm.items.reduce((acc, item) => {
      const product = products.find(p => String(p.id) === String(item.product_id));
      const costing = computeBillItemCosting(item, product);
      acc.gross += costing.gross;
      acc.discount += costing.discountAmount;
      acc.net += costing.netAmount;
      acc.landing += costing.landingUnit * costing.qty;
      acc.selling += costing.sellValue * costing.qty;
      acc.mrp += (costing.mrpValue > 0 ? costing.mrpValue : costing.sellValue) * costing.qty;
      return acc;
    }, { gross: 0, discount: 0, net: 0, landing: 0, selling: 0, mrp: 0 });
  }, [billForm.items, products]);

  const billSubtotal = useMemo(() => Math.round(billTotals.net * 100) / 100, [billTotals.net]);
  const billGrandTotal = useMemo(() => Math.round((billSubtotal + (Number(billForm.additional_charges) || 0)) * 100) / 100, [billSubtotal, billForm.additional_charges]);
  const billCostingSummary = useMemo(() => {
    const landing = Math.round(billTotals.landing * 100) / 100;
    const selling = Math.round(billTotals.selling * 100) / 100;
    const mrp = Math.round(billTotals.mrp * 100) / 100;
    return {
      landing,
      selling,
      purchaseMargin: mrp > 0 ? Math.round(((mrp - landing) / mrp) * 1000) / 10 : 0,
      landingMargin: selling > 0 ? Math.round(((selling - landing) / selling) * 1000) / 10 : 0,
      netProfit: Math.round((selling - landing) * 100) / 100
    };
  }, [billTotals]);

  const handleSaveBill = async (e) => {
    e.preventDefault();
    if (!billForm.vendor_id) {
      setBillError('Select a vendor for this purchase bill.');
      return;
    }
    const validItems = billForm.items.filter(item => item.product_name && item.product_name.trim());
    if (validItems.length === 0) {
      setBillError('Add at least one product line to the purchase bill.');
      return;
    }
    const payload = {
      vendor_id: Number(billForm.vendor_id),
      branch_id: Number(billForm.branch_id || (isSuperAdmin ? (selectedBranchId !== 'all' ? selectedBranchId : 1) : userBranchId) || 1),
      bill_number: billForm.bill_number.trim(),
      purchase_date: billForm.purchase_date,
      additional_charges: Number(billForm.additional_charges) || 0,
      amount_paid: Number(billForm.amount_paid) || 0,
      payment_method: billForm.payment_method,
      notes: billForm.notes,
      confirm: Boolean(billForm.confirm),
      items: validItems.map(item => {
        const product = products.find(p => String(p.id) === String(item.product_id));
        const costing = computeBillItemCosting(item, product);
        return {
          product_id: item.product_id || null,
          product_name: item.product_name,
          variant_id: item.variant_id ? Number(item.variant_id) : null,
          variant_info: item.variant_info || null,
          scanned_barcode: item.barcode || null,
          stock_applied_qty: Math.max(0, Number(item.stock_applied_qty) || 0),
          stock_scan_applied: Math.max(0, Number(item.stock_scan_applied) || 0),
          quantity: Number(item.quantity) || 1,
          purchase_rate: item.purchase_rate !== '' ? String(item.purchase_rate) : null,
          rate_value: parseFloat(String(item.purchase_rate).replace(/[^0-9.-]/g, '')) || 0,
          mrp: costing.mrpValue || null,
          gst_type: item.gst_type || 'exclusive',
          gst_rate: parseFloat(item.gst_rate) || 0,
          discount_type: costing.discountType,
          discount_value: costing.discountType === 'percent'
            ? Math.min(100, Math.max(0, parseAmount(item.discount_value)))
            : Math.max(0, parseAmount(item.discount_value)),
          discount_amount: costing.discountAmount,
          landing_cost: costing.landingUnit,
          purchase_margin: costing.purchaseMargin,
          landing_margin: costing.landingMargin,
          manufacturing_date: item.manufacturing_date || null,
          expiry_date: item.expiry_date || null
        };
      })
    };

    try {
      setSavingBill(true);
      billSavingRef.current = true;
      setBillError('');
      if (editingBill?.id) {
        await updateAdminPurchaseBill(editingBill.id, payload);
        showToast('Purchase bill updated successfully.');
      } else {
        await createAdminPurchaseBill(payload);
        showToast('Purchase bill created successfully.');
      }
      scanStockRef.current = [];
      setIsBillModalOpen(false);
      refreshAll();
    } catch (err) {
      setBillError(err.message || 'Failed to save purchase bill');
    } finally {
      setSavingBill(false);
      billSavingRef.current = false;
    }
  };

  const openBillDetail = async (billOrId) => {
    const id = typeof billOrId === 'object' ? billOrId.id : billOrId;
    if (!id) return;
    setLoadingBillDetail(true);
    try {
      const detail = await getAdminPurchaseBillById(id);
      setSelectedBill(detail);
      setPaymentForm({
        amount: detail.outstanding_amount ? String(detail.outstanding_amount) : '',
        payment_date: today(),
        payment_method: 'Cash',
        notes: ''
      });
    } catch (err) {
      showToast(err.message || 'Failed to load bill details', 'error');
    } finally {
      setLoadingBillDetail(false);
    }
  };

  const handleConfirmBill = async (bill) => {
    if (!bill?.id) return;
    if (!window.confirm(`Confirm purchase bill ${bill.bill_number}? Stock will be added to inventory.`)) return;
    try {
      const updated = await confirmAdminPurchaseBill(bill.id);
      showToast('Purchase bill confirmed and stock updated.');
      setSelectedBill(prev => prev && prev.id === bill.id ? { ...prev, ...updated } : prev);
      refreshAll();
    } catch (err) {
      showToast(err.message || 'Failed to confirm purchase bill', 'error');
    }
  };

  const handleDeleteBill = async (bill) => {
    if (!bill?.id) return;
    if (!window.confirm(`Delete purchase bill ${bill.bill_number}? Any applied stock will be reversed.`)) return;
    try {
      await deleteAdminPurchaseBill(bill.id);
      showToast('Purchase bill deleted.');
      if (selectedBill?.id === bill.id) setSelectedBill(null);
      refreshAll();
    } catch (err) {
      showToast(err.message || 'Failed to delete purchase bill', 'error');
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedBill?.id) return;
    const amount = Number(paymentForm.amount) || 0;
    if (amount <= 0) {
      showToast('Enter a payment amount greater than zero.', 'error');
      return;
    }
    try {
      setRecordingPayment(true);
      await addAdminPurchaseBillPayment(selectedBill.id, {
        amount,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        notes: paymentForm.notes
      });
      showToast('Payment recorded successfully.');
      const detail = await getAdminPurchaseBillById(selectedBill.id);
      setSelectedBill(detail);
      setPaymentForm(prev => ({ ...prev, amount: '', notes: '' }));
      refreshAll();
    } catch (err) {
      showToast(err.message || 'Failed to record payment', 'error');
    } finally {
      setRecordingPayment(false);
    }
  };

  const safeVendors = useMemo(() => Array.isArray(vendors) ? vendors : [], [vendors]);
  const safeBills = useMemo(() => Array.isArray(bills) ? bills : [], [bills]);
  const safeOutstandingBills = useMemo(() => Array.isArray(outstanding?.bills) ? outstanding.bills : [], [outstanding?.bills]);
  const safeOutstandingVendors = useMemo(() => Array.isArray(outstanding?.vendor_totals) ? outstanding.vendor_totals : [], [outstanding?.vendor_totals]);
  const safeOutstandingSummary = useMemo(() => outstanding?.summary || {}, [outstanding?.summary]);

  const filteredVendors = useMemo(() => {
    return safeVendors.filter(v => {
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
  }, [safeVendors, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const totalOutstanding = safeVendors.reduce((sum, v) => sum + (Number(v.total_outstanding) || 0), 0);
    const totalPurchase = safeVendors.reduce((sum, v) => sum + (Number(v.total_purchase_value) || 0), 0);
    return {
      total: safeVendors.length,
      active: safeVendors.filter(v => v.is_active).length,
      totalProducts: safeVendors.reduce((sum, v) => sum + (Number(v.products_count) || 0), 0),
      totalProductsLabel: safeVendors.reduce((sum, v) => sum + (Number(v.products_count) || 0), 0),
      totalOutstanding,
      totalPurchase
    };
  }, [safeVendors]);

  const renderBillTable = (list, opts = {}) => {
    const safeList = Array.isArray(list) ? list : [];
    if (safeList.length === 0) {
      return <div style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>{opts.empty || 'No purchase bills found.'}</div>;
    }
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textAlign: 'left', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Bill No.</th>
              <th style={{ padding: '10px 14px' }}>Branch</th>
              {!opts.hideVendor && <th style={{ padding: '10px 14px' }}>Vendor</th>}
              <th style={{ padding: '10px 14px' }}>Date</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>Items</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Total</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Paid</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Outstanding</th>
              <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(bill => (
              <tr key={bill.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>
                  {bill.bill_number}
                  {bill.status === 'draft' && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '8px' }}>DRAFT</span>}
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: bill.branch_id > 1 ? '#eff6ff' : '#f8fafc',
                    color: bill.branch_id > 1 ? '#1d4ed8' : '#475569',
                    border: `1px solid ${bill.branch_id > 1 ? '#bfdbfe' : '#e2e8f0'}`
                  }}>
                    🏢 {bill.branch_name || (bill.branch_id === 3 ? 'Manali Branch' : 'Main Store')}
                  </span>
                </td>
                {!opts.hideVendor && <td style={{ padding: '10px 14px', color: '#334155' }}>{bill.vendor_name || '—'}</td>}
                <td style={{ padding: '10px 14px', color: '#475569' }}>{shortDate(bill.purchase_date)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}>{bill.item_count || 0}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800 }}>₹{money(bill.grand_total)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: '#15803d' }}>₹{money(bill.amount_paid)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', color: Number(bill.outstanding_amount) > 0 ? '#b91c1c' : '#64748b', fontWeight: 800 }}>₹{money(bill.outstanding_amount)}</td>
                <td style={{ padding: '10px 14px', textAlign: 'center' }}><PaymentBadge status={bill.payment_status} /></td>
                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => openBillDetail(bill)} style={{ padding: '4px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>View</button>
                    {bill.status === 'draft' && (
                      <button type="button" onClick={() => handleConfirmBill(bill)} style={{ padding: '4px 9px', borderRadius: '5px', border: '1px solid #86efac', background: '#f0fdf4', color: '#15803d', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>Confirm</button>
                    )}
                    <button type="button" onClick={() => openEditBill(bill)} style={{ padding: '4px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                    <button type="button" onClick={() => handleDeleteBill(bill)} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderVendorRow = (vendor) => {
    const isExpanded = expandedVendorId === vendor.id;
    const history = vendorHistory[vendor.id] || {};
    const historySummary = history.summary || {};
    const historyBills = Array.isArray(history.bills) ? history.bills : [];
    const historyPayments = Array.isArray(history.payments) ? history.payments : [];
    const outstandingBills = historyBills.filter(b => Number(b.outstanding_amount) > 0 && b.status !== 'cancelled');

    return (
      <React.Fragment key={vendor.id}>
        <tr
          style={{ borderBottom: '1px solid #f1f5f9', background: isExpanded ? '#f0fdf4' : '#ffffff', cursor: 'pointer' }}
          onClick={() => toggleVendor(vendor)}
        >
          <td style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#065935', fontWeight: 900 }}>{isExpanded ? '▾' : '▸'}</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>{vendor.name}</span>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: vendor.branch_id > 1 ? '#eff6ff' : '#f8fafc',
                    color: vendor.branch_id > 1 ? '#1d4ed8' : '#475569',
                    border: `1px solid ${vendor.branch_id > 1 ? '#bfdbfe' : '#e2e8f0'}`
                  }}>
                    🏢 {vendor.branch_name || (vendor.branch_id === 3 ? 'Manali Branch' : 'Main Store')}
                  </span>
                </div>
                {vendor.company_name && <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>{vendor.company_name}</div>}
              </div>
            </div>
          </td>
          <td style={{ padding: '14px 18px' }}>
            <div style={{ color: '#0f172a', fontWeight: 600 }}>{vendor.contact_person || '—'}</div>
            <div style={{ fontSize: '12px', color: '#065935', fontWeight: 600 }}>{vendor.phone || ''}</div>
          </td>
          <td style={{ padding: '14px 18px' }}>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#334155', fontSize: '12px' }}>{vendor.gstin || 'Unregistered'}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>{vendor.payment_terms || 'Net 30'}</div>
          </td>
          <td style={{ padding: '14px 18px', color: '#334155' }}>
            {vendor.city ? `${vendor.city}${vendor.state ? `, ${vendor.state}` : ''}` : '—'}
          </td>
          <td style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 700 }}>{vendor.products_count || 0}</td>
          <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>₹{money(vendor.total_purchase_value)}</td>
          <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, color: Number(vendor.total_outstanding) > 0 ? '#b91c1c' : '#15803d' }}>₹{money(vendor.total_outstanding)}</td>
          <td style={{ padding: '14px 18px', textAlign: 'center' }}>
            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 700, background: vendor.is_active ? '#dcfce7' : '#fee2e2', color: vendor.is_active ? '#15803d' : '#b91c1c' }}>
              {vendor.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td style={{ padding: '14px 18px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <button type="button" onClick={() => openNewBill(vendor.id)} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #86efac', background: '#f0fdf4', color: '#065935', cursor: 'pointer', fontSize: '12px', fontWeight: 800 }}>+ Bill</button>
              <button type="button" onClick={() => openEditModal(vendor)} title="Edit Vendor" style={{ padding: '6px 9px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}><Icon name="edit" size={13} /></button>
              <button type="button" onClick={() => handleDeleteVendor(vendor)} title="Delete Vendor" style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #fee2e2', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}><Icon name="trash" size={13} /></button>
            </div>
          </td>
        </tr>

        {isExpanded && (
          <tr>
            <td colSpan={9} style={{ padding: 0, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ padding: '14px 18px 18px' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  {[
                    { key: 'bills', label: `Purchase Bills (${historyBills.length})` },
                    { key: 'outstanding', label: `Outstanding (${outstandingBills.length})` },
                    { key: 'payments', label: `Payment History (${historyPayments.length})` }
                  ].map(t => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setExpandedVendorTab(t.key)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: expandedVendorTab === t.key ? '1px solid #065935' : '1px solid #cbd5e1',
                        background: expandedVendorTab === t.key ? '#065935' : '#ffffff',
                        color: expandedVendorTab === t.key ? '#ffffff' : '#334155',
                        fontSize: '11.5px',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                  <button type="button" onClick={() => openNewBill(vendor.id)} style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#065935', color: '#fff', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}>+ New Purchase Bill</button>
                </div>

                {loadingHistory && !historySummary.total_bills && (
                  <div style={{ padding: '18px', color: '#64748b', fontSize: '12.5px' }}>Loading vendor ledger...</div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700 }}>TOTAL PURCHASES</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>₹{money(historySummary.total_purchase_value)}</div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700 }}>TOTAL PAID</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#15803d' }}>₹{money(historySummary.total_paid)}</div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700 }}>OUTSTANDING</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: Number(historySummary.total_outstanding) > 0 ? '#b91c1c' : '#15803d' }}>₹{money(historySummary.total_outstanding)}</div>
                  </div>
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 700 }}>BILLS</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>{historySummary.total_bills || 0}</div>
                  </div>
                </div>

                {expandedVendorTab === 'bills' && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    {renderBillTable(historyBills, { hideVendor: true, empty: 'No purchase bills for this vendor yet.' })}
                  </div>
                )}

                {expandedVendorTab === 'outstanding' && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    {renderBillTable(outstandingBills, { hideVendor: true, empty: 'No outstanding payables for this vendor.' })}
                  </div>
                )}

                {expandedVendorTab === 'payments' && (
                  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                    {historyPayments.length === 0 ? (
                      <div style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No payments recorded for this vendor yet.</div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textAlign: 'left', textTransform: 'uppercase' }}>
                            <th style={{ padding: '10px 14px' }}>Date</th>
                            <th style={{ padding: '10px 14px' }}>Bill</th>
                            <th style={{ padding: '10px 14px' }}>Method</th>
                            <th style={{ padding: '10px 14px' }}>Notes</th>
                            <th style={{ padding: '10px 14px', textAlign: 'right' }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historyPayments.map(payment => (
                            <tr key={payment.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 14px' }}>{shortDate(payment.payment_date)}</td>
                              <td style={{ padding: '10px 14px', fontWeight: 700 }}>{payment.bill_number}</td>
                              <td style={{ padding: '10px 14px' }}>{payment.payment_method || 'Cash'}</td>
                              <td style={{ padding: '10px 14px', color: '#64748b' }}>{payment.notes || '—'}</td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#15803d' }}>₹{money(payment.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar />
        <main className="admin-content">
          {toastMessage && (
            <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 99999, padding: '12px 20px', borderRadius: '8px', backgroundColor: toastMessage.type === 'error' ? '#ef4444' : '#065935', color: '#fff', fontSize: '13px', fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{toastMessage.type === 'error' ? '!' : '✓'}</span>
              <span>{toastMessage.text}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 className="admin-page-title" style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Vendor Management &amp; Purchases</h1>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>Manage suppliers, purchase bills, payments and outstanding payables.</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => openNewBill('')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#b45309', color: '#fff', padding: '10px 16px', borderRadius: '8px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', border: 'none' }} title="Create new vendor purchase bill [Shortcut: F2 or Alt+N]">
                + New Purchase Bill [F2]
              </button>
              <button type="button" onClick={openAddModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#065935', color: '#fff', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', border: 'none' }}>
                <Icon name="plus" size={16} />
                <span>Add Vendor</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { key: 'vendors', label: `Vendors (${safeVendors.length})` },
                { key: 'purchase-bills', label: `All Purchase Bills (${safeBills.length})` },
                { key: 'outstanding', label: `Outstanding Payables (${safeOutstandingBills.length})` }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setMainTab(tab.key)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: mainTab === tab.key ? '1px solid #065935' : '1px solid #cbd5e1',
                    background: mainTab === tab.key ? '#065935' : '#ffffff',
                    color: mainTab === tab.key ? '#ffffff' : '#334155',
                    fontWeight: 800,
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Branch Selector Filter */}
            {isSuperAdmin ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Filter Branch:</span>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #0ea5e9',
                    fontSize: '13px',
                    fontWeight: 800,
                    background: '#fff',
                    color: '#0369a1',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">🏢 All Branches</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e0f2fe', color: '#0369a1', padding: '6px 14px', borderRadius: '8px', fontWeight: 800, fontSize: '12.5px', border: '1px solid #bae6fd' }}>
                <span>🏢</span>
                <span>{branches.find(b => String(b.id) === String(selectedBranchId))?.name || 'Regional Branch'}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <StatCard label="Total Vendors" value={stats.total} hint={`${stats.active} active partners`} />
            <StatCard label="Linked Products" value={stats.totalProducts} hint="Catalog items from suppliers" color="#065935" />
            <StatCard label="Total Purchases" value={`₹${money(stats.totalPurchase)}`} hint="Confirmed and draft bills" color="#0284c7" />
            <StatCard label="Outstanding Payables" value={`₹${money(stats.totalOutstanding)}`} hint="Pending vendor payments" color={stats.totalOutstanding > 0 ? '#b91c1c' : '#15803d'} />
          </div>

          {mainTab === 'vendors' && (
            <>
              <div className="admin-card" style={{ padding: '14px 18px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 320px' }}>
                  <div style={{ position: 'relative', width: '100%', maxWidth: '420px' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}><Icon name="search" size={16} /></span>
                    <input type="text" placeholder="Search vendor, company, GSTIN, phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>Status:</label>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', cursor: 'pointer' }}>
                    <option value="all">All Vendors ({safeVendors.length})</option>
                    <option value="active">Active Only ({safeVendors.filter(v => v.is_active).length})</option>
                    <option value="inactive">Inactive ({safeVendors.filter(v => !v.is_active).length})</option>
                  </select>
                </div>
              </div>

              <div className="admin-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {loading ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading vendor directory...</div>
                ) : filteredVendors.length === 0 ? (
                  <div style={{ padding: '60px', textAlign: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>No vendors found</h3>
                    <p style={{ margin: '6px 0 16px', fontSize: '13px', color: '#64748b' }}>{searchQuery ? 'Try adjusting your search query or filter.' : 'Add your first supplier to start recording purchase bills.'}</p>
                    <button type="button" onClick={openAddModal} style={{ padding: '8px 16px', borderRadius: '8px', background: '#065935', color: '#fff', border: 'none', fontWeight: 700, fontSize: '12.5px', cursor: 'pointer' }}>+ Add Vendor</button>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          <th style={{ padding: '14px 18px' }}>Vendor &amp; Company</th>
                          <th style={{ padding: '14px 18px' }}>Contact</th>
                          <th style={{ padding: '14px 18px' }}>GSTIN &amp; Terms</th>
                          <th style={{ padding: '14px 18px' }}>Location</th>
                          <th style={{ padding: '14px 18px', textAlign: 'center' }}>Products</th>
                          <th style={{ padding: '14px 18px', textAlign: 'right' }}>Purchases</th>
                          <th style={{ padding: '14px 18px', textAlign: 'right' }}>Outstanding</th>
                          <th style={{ padding: '14px 18px', textAlign: 'center' }}>Status</th>
                          <th style={{ padding: '14px 18px', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>{filteredVendors.map(renderVendorRow)}</tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {mainTab === 'purchase-bills' && (
            <>
              <div className="admin-card" style={{ padding: '14px 18px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'end' }}>
                <div style={{ flex: '0 1 190px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>BILL NO.</label>
                  <input type="text" placeholder="e.g. PB-0001" value={billFilters.bill_number} onChange={(e) => setBillFilters(prev => ({ ...prev, bill_number: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); loadPurchaseBills(); } }} style={{ width: '100%', padding: '8px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12.5px', fontFamily: 'monospace' }} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>SEARCH</label>
                  <input type="text" placeholder="Vendor, product or notes..." value={billFilters.search} onChange={(e) => setBillFilters(prev => ({ ...prev, search: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); loadPurchaseBills(); } }} style={{ width: '100%', padding: '8px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12.5px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>VENDOR</label>
                  <select value={billFilters.vendor_id} onChange={(e) => setBillFilters(prev => ({ ...prev, vendor_id: e.target.value }))} style={{ padding: '8px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff', minWidth: '170px' }}>
                    <option value="all">All Vendors</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>BILL STATUS</label>
                  <select value={billFilters.status} onChange={(e) => setBillFilters(prev => ({ ...prev, status: e.target.value }))} style={{ padding: '8px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' }}>
                    <option value="all">All</option>
                    <option value="draft">Draft</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>PAYMENT</label>
                  <select value={billFilters.payment_status} onChange={(e) => setBillFilters(prev => ({ ...prev, payment_status: e.target.value }))} style={{ padding: '8px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' }}>
                    <option value="all">All</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Partially Paid">Partially Paid</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>FROM</label>
                  <input type="date" value={billFilters.from_date} onChange={(e) => setBillFilters(prev => ({ ...prev, from_date: e.target.value }))} style={{ padding: '8px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12.5px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>TO</label>
                  <input type="date" value={billFilters.to_date} onChange={(e) => setBillFilters(prev => ({ ...prev, to_date: e.target.value }))} style={{ padding: '8px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12.5px' }} />
                </div>
                <button type="button" onClick={() => loadPurchaseBills()} style={{ padding: '8px 16px', borderRadius: '7px', border: 'none', background: '#065935', color: '#fff', fontWeight: 800, fontSize: '12.5px', cursor: 'pointer' }}>APPLY FILTERS</button>
                <button type="button" onClick={resetBillFilters} style={{ padding: '8px 14px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 800, fontSize: '12.5px', cursor: 'pointer' }}>RESET</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                <StatCard label="Bills" value={billSummary.total_bills || 0} />
                <StatCard label="Purchase Value" value={`₹${money(billSummary.total_purchase_value)}`} />
                <StatCard label="Paid" value={`₹${money(billSummary.total_paid)}`} color="#15803d" />
                <StatCard label="Outstanding" value={`₹${money(billSummary.total_outstanding)}`} color="#b91c1c" />
              </div>

              <div className="admin-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {loadingBills ? <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading purchase bills...</div> : renderBillTable(bills)}
              </div>
            </>
          )}

          {mainTab === 'outstanding' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <StatCard label="Outstanding Bills" value={safeOutstandingSummary.bill_count || 0} />
                <StatCard label="Bill Value" value={`₹${money(safeOutstandingSummary.total_bill_amount)}`} />
                <StatCard label="Already Paid" value={`₹${money(safeOutstandingSummary.total_paid)}`} color="#15803d" />
                <StatCard label="Payable Now" value={`₹${money(safeOutstandingSummary.total_outstanding)}`} color="#b91c1c" />
              </div>

              <div className="admin-card" style={{ padding: '14px 18px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>Outstanding by Vendor</div>
                {safeOutstandingVendors.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '12.5px' }}>No outstanding vendor payables. Nice and clear.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    {safeOutstandingVendors.map(v => (
                      <button key={v.vendor_id} type="button" onClick={() => { setMainTab('vendors'); setExpandedVendorId(v.vendor_id); setExpandedVendorTab('outstanding'); if (!vendorHistory[v.vendor_id]) loadVendorHistory(v.vendor_id); }} style={{ textAlign: 'left', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '12.5px' }}>{v.vendor_name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{v.bill_count} unpaid bill(s)</div>
                        <div style={{ fontSize: '16px', fontWeight: 900, color: '#b91c1c', marginTop: '4px' }}>₹{money(v.total_outstanding)}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="admin-card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {loadingOutstanding ? <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading outstanding payables...</div> : renderBillTable(safeOutstandingBills, { empty: 'No outstanding payables right now.' })}
              </div>
            </>
          )}

          {/* ADD / EDIT VENDOR MODAL */}
          <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingVendor ? `Edit Vendor: ${editingVendor.name}` : 'Add New Vendor / Supplier'}>
            <form onSubmit={handleSubmitVendor} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {errorMsg && <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', fontSize: '12.5px', fontWeight: 600 }}>{errorMsg}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Vendor / Brand Name *</label>
                  <input type="text" required placeholder="e.g. Madras Leather Works" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Registered Company Name</label>
                  <input type="text" placeholder="e.g. MLW Enterprises Pvt Ltd" value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Contact Person</label>
                  <input type="text" placeholder="e.g. Ramesh Kumar" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Phone Number</label>
                  <input type="tel" placeholder="10-digit mobile" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Email Address</label>
                  <input type="email" placeholder="orders@vendor.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>GSTIN / Tax ID</label>
                  <input type="text" placeholder="15-character GST Number" value={formData.gstin} onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'monospace' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Payment Terms</label>
                  <select value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}>
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
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Billing Address</label>
                <textarea rows={2} placeholder="Street address, warehouse number..." value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>City</label>
                  <input type="text" placeholder="e.g. Chennai" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>State</label>
                  <input type="text" placeholder="e.g. Tamil Nadu" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>PIN Code</label>
                  <input type="text" placeholder="e.g. 600001" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Assigned Branch *</label>
                {isSuperAdmin ? (
                  <select
                    value={formData.branch_id || 1}
                    onChange={(e) => setFormData({ ...formData, branch_id: Number(e.target.value) })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1.5px solid #0ea5e9', fontSize: '13px', background: '#fff', fontWeight: 700 }}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ padding: '9px 12px', borderRadius: '8px', background: '#e0f2fe', color: '#0369a1', fontSize: '13px', fontWeight: 800 }}>
                    🏢 {branches.find(b => String(b.id) === String(userBranchId))?.name || 'Regional Branch'}
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>Notes</label>
                <textarea rows={2} placeholder="Internal notes about this vendor..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="vendor_is_active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: '#065935' }} />
                <label htmlFor="vendor_is_active" style={{ fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>Vendor is active for purchase bills and catalog assignments</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '9px 18px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '9px 24px', borderRadius: '8px', background: '#065935', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : (editingVendor ? 'Update Vendor' : 'Create Vendor')}</button>
              </div>
            </form>
          </Modal>

          {/* PURCHASE BILL CREATE / EDIT MODAL */}
          <Modal isOpen={isBillModalOpen} onClose={closeBillModal} title={editingBill ? `Edit Purchase Bill: ${editingBill.bill_number}` : 'New Purchase Bill'} maxWidth="95vw" maxHeight="95vh" height="95vh">
            <form onSubmit={handleSaveBill} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {billError && <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', fontSize: '12.5px', fontWeight: 700 }}>{billError}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '5px' }}>VENDOR *</label>
                  <select required value={billForm.vendor_id} onChange={(e) => setBillForm(prev => ({ ...prev, vendor_id: e.target.value }))} style={{ width: '100%', padding: '9px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}>
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.company_name ? ` (${v.company_name})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '5px' }}>BRANCH *</label>
                  {isSuperAdmin ? (
                    <select
                      value={billForm.branch_id || 1}
                      onChange={(e) => handleBillBranchChange(e.target.value)}
                      style={{ width: '100%', padding: '9px 11px', borderRadius: '7px', border: '1.5px solid #0ea5e9', fontSize: '13px', background: '#fff', fontWeight: 700 }}
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ padding: '9px 11px', borderRadius: '7px', background: '#e0f2fe', color: '#0369a1', fontSize: '12.5px', fontWeight: 800 }}>
                      🏢 {branches.find(b => String(b.id) === String(userBranchId))?.name || 'Regional Branch'}
                    </div>
                  )}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '5px' }}>BILL NUMBER</label>
                  <input type="text" value={billForm.bill_number} onChange={(e) => setBillForm(prev => ({ ...prev, bill_number: e.target.value }))} placeholder="Auto-generated" style={{ width: '100%', padding: '9px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'monospace' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '5px' }}>PURCHASE DATE</label>
                  <input type="date" value={billForm.purchase_date} onChange={(e) => setBillForm(prev => ({ ...prev, purchase_date: e.target.value }))} style={{ width: '100%', padding: '9px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
              </div>

              <div style={{ border: '1px solid #fde68a', background: '#fffbeb', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '16px' }}>📷</span>
                  <span style={{ fontSize: '11.5px', fontWeight: 900, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Scan Product Barcode / QR</span>
                  <span style={{ fontSize: '10.5px', color: '#a16207' }}>Scan or type the code, press Enter — added items update stock immediately</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    ref={scanInputRef}
                    id="vendor-bill-scan-input"
                    data-scan-capture="true"
                    type="text"
                    value={scanCode}
                    onChange={(e) => { setScanCode(e.target.value); if (scanResult) setScanResult(null); }}
                    onKeyDown={handleScanKeyDown}
                    placeholder="Scan or type barcode / QR code..."
                    style={{ flex: '1 1 280px', padding: '9px 11px', borderRadius: '7px', border: '1.5px solid #fbbf24', fontSize: '13px', fontFamily: 'monospace', background: '#fff' }}
                  />
                  <button type="button" onClick={() => performScan(scanCode)} disabled={scanLoading} style={{ padding: '9px 16px', borderRadius: '7px', border: 'none', background: '#b45309', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: scanLoading ? 'not-allowed' : 'pointer' }}>
                    {scanLoading ? 'Scanning...' : 'Scan / Find'}
                  </button>
                  {(scanCode || scanResult || pendingNewProduct) && (
                    <button type="button" onClick={resetScanState} style={{ padding: '9px 12px', borderRadius: '7px', border: '1px solid #fcd34d', background: '#fff', color: '#92400e', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>Clear</button>
                  )}
                </div>
                {scanError && (
                  <div style={{ padding: '7px 10px', borderRadius: '6px', background: '#fee2e2', color: '#b91c1c', fontSize: '11.5px', fontWeight: 700 }}>{scanError}</div>
                )}
                {scanResult && scanResult.found && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '7px', padding: '8px 10px' }}>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#14532d' }}>{scanResult.product_name}</div>
                      <div style={{ fontSize: '10.5px', color: '#475569', marginTop: '2px' }}>
                        {scanResult.barcode ? `Barcode: ${scanResult.barcode} • ` : ''}
                        {scanResult.variant && scanResult.variant.sku ? `SKU: ${scanResult.variant.sku} • ` : ''}
                        {scanResult.variant ? `${[scanResult.variant.color_name, scanResult.variant.size_name].filter(Boolean).join(' / ')} • ` : ''}
                        Current stock: {scanResult.branch_stock !== undefined && scanResult.branch_stock !== null ? scanResult.branch_stock : scanResult.stock}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                        MRP: {scanResult.mrp !== null && scanResult.mrp !== undefined && Number(scanResult.mrp) > 0 ? `₹${money(scanResult.mrp)}` : '—'}
                        {' • '}Purchase: {scanResult.purchased_rate !== null && scanResult.purchased_rate !== undefined && String(scanResult.purchased_rate).trim() !== '' ? `₹${scanResult.purchased_rate}` : (scanResult.purchase_price !== null && scanResult.purchase_price !== undefined ? `₹${money(scanResult.purchase_price)}` : '—')}
                        {' • '}Selling: {scanResult.sale_price !== null && scanResult.sale_price !== undefined && Number(scanResult.sale_price) > 0 ? `₹${money(scanResult.sale_price)}` : (scanResult.price !== null && scanResult.price !== undefined ? `₹${money(scanResult.price)}` : '—')}
                        {' • '}GST: {Number(scanResult.gst_rate || 0)}% ({scanResult.gst_type || 'exclusive'})
                      </div>
                    </div>
                    <button type="button" onClick={addScannedResultToBill} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#065935', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
                      Add to Bill (Enter)
                    </button>
                  </div>
                )}
                {pendingNewProduct && (
                  <div
                    style={{ border: '1px solid #fcd34d', background: '#fff', borderRadius: '7px', padding: '10px' }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 900, color: '#92400e' }}>New product detected — capture details to add it to the catalog</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#b45309', background: '#fef3c7', borderRadius: '4px', padding: '2px 7px' }}>{pendingNewProduct.scanned_code}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>Product Name *</label>
                        <input type="text" value={pendingNewProduct.name} onChange={(e) => setPendingNewProduct(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Leather Tote Bag" ref={newProductNameRef} style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>Purchase Rate</label>
                        <input type="number" min="0" step="0.01" value={pendingNewProduct.purchase_rate} onChange={(e) => setPendingNewProduct(prev => ({ ...prev, purchase_rate: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>MRP (₹)</label>
                        <input type="number" min="0" step="0.01" value={pendingNewProduct.mrp} onChange={(e) => setPendingNewProduct(prev => ({ ...prev, mrp: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>Selling Price</label>
                        <input type="number" min="0" step="0.01" value={pendingNewProduct.sale_price} onChange={(e) => setPendingNewProduct(prev => ({ ...prev, sale_price: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 0.8fr 1fr 0.7fr 0.8fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>GST Mode</label>
                        <select value={pendingNewProduct.gst_type} onChange={(e) => setPendingNewProduct(prev => ({ ...prev, gst_type: e.target.value }))} style={{ width: '100%', padding: '7px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#fff' }}>
                          <option value="exclusive">Exclusive</option>
                          <option value="inclusive">Inclusive</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>GST %</label>
                        <select value={String(pendingNewProduct.gst_rate)} onChange={(e) => setPendingNewProduct(prev => ({ ...prev, gst_rate: e.target.value }))} style={{ width: '100%', padding: '7px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#fff' }}>
                          <option value="0">0%</option>
                          <option value="3">3%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>HSN Code</label>
                        <input type="text" value={pendingNewProduct.hsn_code} onChange={(e) => setPendingNewProduct(prev => ({ ...prev, hsn_code: e.target.value }))} placeholder="4202" style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'monospace' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>Qty</label>
                        <input type="number" min="1" value={pendingNewProduct.quantity} onChange={(e) => setPendingNewProduct(prev => ({ ...prev, quantity: e.target.value }))} style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px', textAlign: 'center', fontWeight: 800 }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>Opening Stock</label>
                        <input type="number" min="0" value={pendingNewProduct.stock} onChange={(e) => setPendingNewProduct(prev => ({ ...prev, stock: e.target.value }))} style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px', textAlign: 'center' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button type="button" onClick={resetScanState} style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}>Cancel</button>
                      <button type="button" onClick={handleCreateScannedProduct} disabled={savingScannedProduct} style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: '#065935', color: '#fff', fontSize: '11.5px', fontWeight: 800, cursor: savingScannedProduct ? 'not-allowed' : 'pointer' }}>
                        {savingScannedProduct ? 'Adding...' : 'Add Product & Bill'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '9px 12px', background: '#0f172a', color: '#fff', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>PRODUCT LINE ITEMS</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={() => handleRedirectNewProduct('')} style={{ background: '#b45309', color: '#fff', border: 'none', borderRadius: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                      + NEW PRODUCT
                    </button>
                    <button type="button" onClick={addBillItem} style={{ background: '#065935', color: '#fff', border: 'none', borderRadius: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>
                      + ADD ITEM
                    </button>
                  </div>
                </div>
                <div style={{ padding: '8px', background: '#f8fafc' }}>
                  <datalist id="purchase-product-options">
                    {products.map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
                  {billForm.items.map((item, index) => {
                    const variantSource = products.find(p => String(p.id) === String(item.product_id));
                    const variants = Array.isArray(variantSource?.variants) ? variantSource.variants : [];

                    // Stock calculation for this item
                    let currentStock = 0;
                    if (item.variant_id) {
                      const vObj = variants.find(v => String(v.id) === String(item.variant_id));
                      currentStock = vObj ? (Number(vObj.stock_quantity) || 0) : 0;
                    } else if (variantSource) {
                      currentStock = variants.length > 0
                        ? variants.reduce((sum, v) => sum + (Number(v.stock_quantity) || 0), 0)
                        : (Number(variantSource.stock) || 0);
                    }
                    const addQty = parseInt(item.quantity, 10) || 0;
                    const appliedQty = Math.min(addQty, Math.max(0, Number(item.stock_applied_qty) || 0));
                    const pendingAddQty = Math.max(0, addQty - appliedQty);
                    const newTotalStock = currentStock + pendingAddQty;
                    const itemCosting = computeBillItemCosting(item, variantSource);

                    return (
                      <div key={item.key} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '10px 10px', marginBottom: '8px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2.1fr 1.2fr 0.7fr 0.9fr 1.3fr 0.9fr 0.32fr', gap: '8px', alignItems: 'center' }}>
                          <div>
                            <input list="purchase-product-options" value={item.product_name} onChange={(e) => handleItemProductName(index, e.target.value)} placeholder="Type product name or select from catalog" style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                            {item.product_id ? (
                              <div style={{ fontSize: '9.5px', color: '#15803d', marginTop: '2px', fontWeight: 700 }}>✓ Linked to catalog product</div>
                            ) : (
                              item.product_name && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                                  <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 700 }}>Not in catalog:</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRedirectNewProduct(item.product_name)}
                                    style={{ background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: 800, cursor: 'pointer' }}
                                  >
                                    + Add New Product to Catalog
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                          <div>
                            {variants.length > 0 ? (
                              <select value={item.variant_id} onChange={(e) => {
                                const variant = variants.find(v => String(v.id) === e.target.value);
                                updateBillItem(index, {
                                  variant_id: e.target.value,
                                  variant_info: variant ? [variant.color_name, variant.size_name].filter(Boolean).join(' / ') : ''
                                });
                              }} style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11.5px', background: '#fff' }}>
                                <option value="">Main product (all variants)</option>
                                {variants.map(v => <option key={v.id} value={v.id}>{[v.color_name, v.size_name].filter(Boolean).join(' / ') || v.sku || `Variant ${v.id}`} (Stock: {v.stock_quantity ?? 0})</option>)}
                              </select>
                            ) : (
                              <input type="text" value={item.variant_info} onChange={(e) => updateBillItem(index, { variant_info: e.target.value })} placeholder="Variant/size (optional)" style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11.5px' }} />
                            )}
                          </div>
                          <div>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateBillItem(index, { quantity: e.target.value })}
                              style={{ width: '100%', padding: '7px 6px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px', textAlign: 'center', fontWeight: 800 }}
                              title={`Current stock is ${currentStock}. Adding ${addQty} will make new stock ${newTotalStock}.`}
                            />
                          </div>
                          <input type="text" value={item.purchase_rate} onChange={(e) => updateBillItem(index, { purchase_rate: e.target.value })} placeholder="Rate" style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }} title="Purchased rate" />
                          <div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <select
                                value={item.discount_type}
                                onChange={(e) => updateBillItem(index, { discount_type: e.target.value })}
                                style={{ width: '58px', padding: '7px 4px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', background: '#fff', fontWeight: 700 }}
                                title="Discount type"
                              >
                                <option value="flat">₹ Flat</option>
                                <option value="percent">% Off</option>
                              </select>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.discount_value}
                                onChange={(e) => updateBillItem(index, { discount_value: e.target.value })}
                                placeholder={item.discount_type === 'percent' ? '%' : 'Disc'}
                                style={{ width: '100%', minWidth: 0, padding: '7px 6px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px', textAlign: 'right' }}
                                title="Discount value"
                              />
                            </div>
                            {itemCosting.discountAmount > 0 && (
                              <div style={{ fontSize: '9.5px', color: '#b91c1c', fontWeight: 700, marginTop: '2px', textAlign: 'right' }}>
                                −₹{money(itemCosting.discountAmount)}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '12px' }}>
                            ₹{money(itemCosting.netAmount)}
                            {itemCosting.discountAmount > 0 && (
                              <div style={{ fontSize: '9.5px', color: '#94a3b8', fontWeight: 600, textDecoration: 'line-through' }}>₹{money(itemCosting.gross)}</div>
                            )}
                          </div>
                          <button type="button" onClick={() => removeBillItem(index)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '5px', padding: '5px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>X</button>
                        </div>

                        {/* Purchase Order Costing & Margins */}
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 900, color: '#0f172a' }}>📦 Purchase Order Costing &amp; Margins</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>Auto-calculated from rate, MRP and GST</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', alignItems: 'end' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>MRP (₹)</label>
                              <input type="number" min="0" step="0.01" value={item.mrp} onChange={(e) => updateBillItem(index, { mrp: e.target.value })} placeholder="0.00" style={{ width: '100%', padding: '6px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11.5px' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>GST Mode</label>
                              <select value={item.gst_type} onChange={(e) => updateBillItem(index, { gst_type: e.target.value })} style={{ width: '100%', padding: '6px 5px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', background: '#fff' }}>
                                <option value="exclusive">Exclusive</option>
                                <option value="inclusive">Inclusive</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>GST Slab</label>
                              <select value={String(item.gst_rate)} onChange={(e) => updateBillItem(index, { gst_rate: e.target.value })} style={{ width: '100%', padding: '6px 5px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', background: '#fff' }}>
                                <option value="0">0%</option>
                                <option value="3">3%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>Landing Cost (₹)</label>
                              <div style={{ padding: '6px 7px', borderRadius: '5px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>₹{money(itemCosting.landingUnit)}</div>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>Purchase Margin</label>
                              <div style={{ padding: '6px 7px', borderRadius: '5px', background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '11.5px', fontWeight: 800, color: itemCosting.purchaseMargin > 0 ? '#15803d' : '#0f172a' }}>{itemCosting.purchaseMargin.toFixed(1)}%</div>
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>Landing Margin</label>
                              <div style={{ padding: '6px 7px', borderRadius: '5px', background: itemCosting.landingMargin < 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${itemCosting.landingMargin < 0 ? '#fecaca' : '#bbf7d0'}`, fontSize: '11.5px', fontWeight: 800, color: itemCosting.landingMargin < 0 ? '#b91c1c' : '#15803d' }}>{itemCosting.landingMargin.toFixed(1)}%</div>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 4fr', gap: '8px', alignItems: 'end', marginTop: '8px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>Manufacturing Date</label>
                              <input type="date" value={item.manufacturing_date || ''} onChange={(e) => updateBillItem(index, { manufacturing_date: e.target.value })} style={{ width: '100%', padding: '6px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11.5px' }} />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '9.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px', textTransform: 'uppercase' }}>Expiry Date</label>
                              <input type="date" value={item.expiry_date || ''} onChange={(e) => updateBillItem(index, { expiry_date: e.target.value })} style={{ width: '100%', padding: '6px 7px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11.5px' }} />
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b', paddingBottom: '7px' }}>
                              Saved on the purchase bill and synced to the linked product record.
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '5px', fontSize: '10.5px', color: '#475569' }}>
                            <span>Selling Price: <strong style={{ color: '#0f172a' }}>{itemCosting.sellValue > 0 ? `₹${money(itemCosting.sellValue)}` : '—'}</strong></span>
                            <span>Net Profit / Unit: <strong style={{ color: itemCosting.netProfitUnit < 0 ? '#b91c1c' : '#0284c7' }}>₹{money(itemCosting.netProfitUnit)}</strong></span>
                            <span>Total Net Profit: <strong style={{ color: itemCosting.netProfitUnit < 0 ? '#b91c1c' : '#0284c7' }}>₹{money(itemCosting.netProfitUnit * itemCosting.qty)}</strong></span>
                          </div>
                        </div>

                        {/* Stock Value & Quantity to Add Display */}
                        {item.product_id && (
                          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', fontSize: '11px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ color: '#475569', fontWeight: 600 }}>
                                Current Stock: <strong style={{ color: '#0f172a', fontSize: '12px' }}>{currentStock}</strong>
                              </span>
                              <span style={{ color: '#b45309', fontWeight: 700 }}>
                                {appliedQty > 0 ? 'Applied on scan: ' : '+ Adding: '}
                                <strong style={{ fontSize: '12px' }}>{appliedQty > 0 ? appliedQty : addQty}</strong>
                              </span>
                              {appliedQty > 0 && pendingAddQty > 0 && (
                                <span style={{ color: '#0369a1', fontWeight: 700 }}>
                                  + On confirm: <strong style={{ fontSize: '12px' }}>{pendingAddQty}</strong>
                                </span>
                              )}
                              <span style={{ padding: '2px 8px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', fontWeight: 800 }}>
                                ➔ New Total Stock: {newTotalStock} units
                              </span>
                            </div>
                            <span style={{ color: '#64748b', fontSize: '10.5px' }}>
                              {appliedQty > 0
                                ? `Stock already updated for ${appliedQty} scanned unit(s)${pendingAddQty > 0 ? `; the remaining ${pendingAddQty} will be applied on confirmation` : ''}.`
                                : `(Stock will increase from ${currentStock} to ${newTotalStock} upon bill confirmation)`}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '5px' }}>ADDITIONAL CHARGES (₹)</label>
                  <input type="number" min="0" step="0.01" value={billForm.additional_charges} onChange={(e) => setBillForm(prev => ({ ...prev, additional_charges: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '9px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '5px' }}>AMOUNT PAID (₹)</label>
                  <input type="number" min="0" step="0.01" value={billForm.amount_paid} onChange={(e) => setBillForm(prev => ({ ...prev, amount_paid: e.target.value }))} placeholder="0.00" style={{ width: '100%', padding: '9px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '5px' }}>PAYMENT METHOD</label>
                  <select value={billForm.payment_method} onChange={(e) => setBillForm(prev => ({ ...prev, payment_method: e.target.value }))} style={{ width: '100%', padding: '9px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}>
                    <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option><option>Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '5px' }}>NOTES</label>
                <textarea rows={2} value={billForm.notes} onChange={(e) => setBillForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Invoice notes, transport details..." style={{ width: '100%', padding: '9px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical' }} />
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 900, color: '#0f172a' }}>📦 Purchase Order Costing &amp; Margins</span>
                  <span style={{ fontSize: '10.5px', color: '#64748b' }}>Aggregated across all bill items</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Landing Cost</div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>₹{money(billCostingSummary.landing)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Purchase Margin (Incl. GST)</div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: billCostingSummary.purchaseMargin > 0 ? '#15803d' : '#0f172a', marginTop: '2px' }}>{billCostingSummary.purchaseMargin.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Landing Margin (Net Profit %)</div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: billCostingSummary.landingMargin < 0 ? '#b91c1c' : '#065935', marginTop: '2px' }}>{billCostingSummary.landingMargin.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Projected Net Profit</div>
                    <div style={{ fontSize: '15px', fontWeight: 900, color: billCostingSummary.netProfit < 0 ? '#b91c1c' : '#0284c7', marginTop: '2px' }}>₹{money(billCostingSummary.netProfit)}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', flexWrap: 'wrap', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={billForm.confirm} onChange={(e) => setBillForm(prev => ({ ...prev, confirm: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: '#065935' }} />
                  Confirm bill and add stock to inventory
                </label>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                    Gross ₹{money(billTotals.gross)} − Discount ₹{money(billTotals.discount)} + Charges ₹{money(billForm.additional_charges)}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>Total ₹{money(billGrandTotal)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <button type="button" onClick={closeBillModal} style={{ padding: '9px 18px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingBill} style={{ padding: '9px 24px', borderRadius: '8px', background: '#b45309', color: '#fff', border: 'none', fontSize: '13px', fontWeight: 800, cursor: savingBill ? 'not-allowed' : 'pointer' }}>{savingBill ? 'Saving Bill...' : (editingBill ? 'Update Purchase Bill' : 'Create Purchase Bill')}</button>
              </div>
            </form>
          </Modal>

          {/* PURCHASE BILL DETAIL / PAYMENT MODAL */}
          <Modal isOpen={Boolean(selectedBill) || loadingBillDetail} onClose={() => setSelectedBill(null)} title={selectedBill ? `Purchase Bill ${selectedBill.bill_number}` : 'Loading Purchase Bill...'} maxWidth="920px">
            {loadingBillDetail || !selectedBill ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading bill...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 14px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>VENDOR</div>
                    <div style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a' }}>{selectedBill.vendor_name}</div>
                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>{selectedBill.vendor_company || ''} {selectedBill.vendor_phone ? `• ${selectedBill.vendor_phone}` : ''}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>BILL DATE</div>
                    <div style={{ fontSize: '13px', fontWeight: 800 }}>{shortDate(selectedBill.purchase_date)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>PAYMENT STATUS</div>
                    <PaymentBadge status={selectedBill.payment_status} />
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>TOTAL / OUTSTANDING</div>
                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a' }}>₹{money(selectedBill.grand_total)}</div>
                    <div style={{ fontSize: '12px', color: Number(selectedBill.outstanding_amount) > 0 ? '#b91c1c' : '#15803d', fontWeight: 800 }}>Due ₹{money(selectedBill.outstanding_amount)}</div>
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: '11px', color: '#475569', textAlign: 'left', textTransform: 'uppercase' }}>
                        <th style={{ padding: '9px 12px' }}>Product</th>
                        <th style={{ padding: '9px 12px' }}>Variant</th>
                        <th style={{ padding: '9px 12px', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>Rate</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>Discount</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>Landing / Unit</th>
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedBill.items || []).map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 700 }}>
                            {item.product_name}
                            {(Number(item.purchase_margin) || Number(item.landing_margin)) ? (
                              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                                Purchase Margin {Number(item.purchase_margin || 0).toFixed(1)}% • Landing Margin {Number(item.landing_margin || 0).toFixed(1)}%
                              </div>
                            ) : null}
                            {(item.manufacturing_date || item.expiry_date) ? (
                              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginTop: '2px' }}>
                                {item.manufacturing_date ? `Mfg: ${shortDate(item.manufacturing_date)}` : ''}
                                {item.manufacturing_date && item.expiry_date ? ' • ' : ''}
                                {item.expiry_date ? `Exp: ${shortDate(item.expiry_date)}` : ''}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: '9px 12px', color: '#64748b' }}>{item.variant_info || '—'}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right' }}>{item.purchase_rate || `₹${money(item.rate_value)}`}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: Number(item.discount_amount) > 0 ? '#b91c1c' : '#64748b' }}>
                            {Number(item.discount_amount) > 0
                              ? `−₹${money(item.discount_amount)}${item.discount_type === 'percent' ? ` (${Number(item.discount_value)}%)` : ''}`
                              : '—'}
                          </td>
                          <td style={{ padding: '9px 12px', textAlign: 'right' }}>₹{money(item.landing_cost)}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800 }}>₹{money(item.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ minWidth: '240px', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: '#64748b' }}>Subtotal (after discount)</span><span>₹{money(selectedBill.subtotal)}</span></div>
                    {Number(selectedBill.discount_total) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#b91c1c' }}><span>Discount applied</span><span>−₹{money(selectedBill.discount_total)}</span></div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: '#64748b' }}>Additional charges</span><span>₹{money(selectedBill.additional_charges)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: '1px solid #e2e8f0', fontWeight: 900 }}><span>Grand total</span><span>₹{money(selectedBill.grand_total)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#15803d' }}><span>Paid</span><span>₹{money(selectedBill.amount_paid)}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#b91c1c', fontWeight: 800 }}><span>Outstanding</span><span>₹{money(selectedBill.outstanding_amount)}</span></div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 900, color: '#475569', textTransform: 'uppercase', marginBottom: '8px' }}>Payments</div>
                  {(!selectedBill.payments || selectedBill.payments.length === 0) ? (
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '10px' }}>No payments recorded yet.</div>
                  ) : (
                    <div style={{ marginBottom: '10px' }}>
                      {selectedBill.payments.map(payment => (
                        <div key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '5px 0', borderBottom: '1px solid #f1f5f9', fontSize: '12px' }}>
                          <span>{shortDate(payment.payment_date)} • {payment.payment_method || 'Cash'} {payment.notes ? `• ${payment.notes}` : ''}</span>
                          <span style={{ fontWeight: 800, color: Number(payment.amount) < 0 ? '#b91c1c' : '#15803d' }}>₹{money(payment.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {Number(selectedBill.outstanding_amount) > 0 && selectedBill.status !== 'cancelled' && (
                    <form onSubmit={handleRecordPayment} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.4fr auto', gap: '8px', alignItems: 'end', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px' }}>AMOUNT</label>
                        <input type="number" min="0" step="0.01" required value={paymentForm.amount} onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))} style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px' }}>DATE</label>
                        <input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))} style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px' }}>METHOD</label>
                        <select value={paymentForm.payment_method} onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_method: e.target.value }))} style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}>
                          <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option><option>Card</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 800, color: '#64748b', marginBottom: '3px' }}>NOTES</label>
                        <input type="text" value={paymentForm.notes} onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))} placeholder="Reference / remarks" style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                      </div>
                      <button type="submit" disabled={recordingPayment} style={{ padding: '8px 12px', borderRadius: '5px', border: 'none', background: '#065935', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: recordingPayment ? 'not-allowed' : 'pointer' }}>{recordingPayment ? 'Saving...' : 'RECORD PAYMENT'}</button>
                    </form>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid #e2e8f0', paddingTop: '12px', flexWrap: 'wrap' }}>
                  {selectedBill.status === 'draft' && (
                    <button type="button" onClick={() => handleConfirmBill(selectedBill)} style={{ padding: '8px 14px', borderRadius: '7px', border: '1px solid #86efac', background: '#f0fdf4', color: '#15803d', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>CONFIRM &amp; ADD STOCK</button>
                  )}
                  <button type="button" onClick={() => { setSelectedBill(null); openEditBill(selectedBill); }} style={{ padding: '8px 14px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>EDIT BILL</button>
                  <button type="button" onClick={() => handleDeleteBill(selectedBill)} style={{ padding: '8px 14px', borderRadius: '7px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>DELETE</button>
                  <button type="button" onClick={() => setSelectedBill(null)} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', background: '#0f172a', color: '#fff', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>CLOSE</button>
                </div>
              </div>
            )}
          </Modal>
        </main>
      </div>
    </div>
  );
}
