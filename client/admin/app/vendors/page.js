'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icons';
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
  getAdminProducts
} from '../../lib/api';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const today = () => new Date().toISOString().slice(0, 10);

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
  is_active: true
};

let billItemKey = 1;
const newBillItem = () => ({
  key: `item-${billItemKey++}`,
  product_id: '',
  product_name: '',
  variant_id: '',
  variant_info: '',
  quantity: 1,
  purchase_rate: ''
});

const emptyBillForm = {
  vendor_id: '',
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
  const [billFilters, setBillFilters] = useState({ search: '', payment_status: 'all', from_date: '', to_date: '', vendor_id: 'all' });

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

  const showToast = (text, type = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3200);
  };

  const loadVendors = async () => {
    try {
      setLoading(true);
      const data = await getAdminVendors();
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

  const loadPurchaseBills = async (filters = billFilters) => {
    try {
      setLoadingBills(true);
      const params = {};
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params[key] = value;
      });
      const data = await getAdminPurchaseBills(params);
      setBills(Array.isArray(data?.bills) ? data.bills : []);
      setBillSummary(data?.summary || {});
    } catch (err) {
      showToast(err.message || 'Failed to load purchase bills', 'error');
    } finally {
      setLoadingBills(false);
    }
  };

  const loadOutstanding = async () => {
    try {
      setLoadingOutstanding(true);
      const data = await getAdminOutstandingPurchaseBills();
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
    loadVendors();
    loadProducts();
    loadPurchaseBills();
    loadOutstanding();
  }, []);

  useEffect(() => {
    if (mainTab === 'purchase-bills') loadPurchaseBills();
    if (mainTab === 'outstanding') loadOutstanding();
  }, [mainTab]);

  const refreshAll = () => {
    loadVendors();
    loadPurchaseBills();
    loadOutstanding();
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
    setFormData(emptyVendorForm);
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
      is_active: vendor.is_active !== undefined ? Boolean(vendor.is_active) : true
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
      if (editingVendor) {
        await updateAdminVendor(editingVendor.id, formData);
        showToast(`Vendor "${formData.name}" updated successfully.`);
      } else {
        await createAdminVendor(formData);
        showToast(`Vendor "${formData.name}" added successfully.`);
      }
      setIsModalOpen(false);
      loadVendors();
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
    setBillForm({ ...emptyBillForm, vendor_id: vendorId ? String(vendorId) : '', bill_number: number, items: [newBillItem()] });
  };

  const openNewBill = async (vendorId = '') => {
    setEditingBill(null);
    setBillError('');
    await resetBillForm(vendorId);
    setIsBillModalOpen(true);
  };

  const openEditBill = async (billOrId) => {
    const id = typeof billOrId === 'object' ? billOrId.id : billOrId;
    if (!id) return;
    setBillError('');
    try {
      const detail = await getAdminPurchaseBillById(id);
      setEditingBill(detail);
      setBillForm({
        vendor_id: detail.vendor_id ? String(detail.vendor_id) : '',
        bill_number: detail.bill_number || '',
        purchase_date: detail.purchase_date ? String(detail.purchase_date).slice(0, 10) : today(),
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
          purchase_rate: item.purchase_rate || (item.purchased_rate || (item.rate_value !== null && item.rate_value !== undefined ? String(item.rate_value) : ''))
        }))
      });
      setIsBillModalOpen(true);
    } catch (err) {
      showToast(err.message || 'Failed to load purchase bill', 'error');
    }
  };

  const updateBillItem = (index, updates) => {
    setBillForm(prev => {
      const items = prev.items.map((item, idx) => idx === index ? { ...item, ...updates } : item);
      return { ...prev, items };
    });
  };

  const handleItemProductName = (index, value) => {
    const match = products.find(p => String(p.name || '').trim().toLowerCase() === value.trim().toLowerCase());
    if (match) {
      updateBillItem(index, {
        product_name: match.name,
        product_id: match.id,
        variant_id: '',
        variant_info: '',
        purchase_rate: match.purchased_rate !== null && match.purchased_rate !== undefined
          ? String(match.purchased_rate)
          : (match.purchase_price !== null && match.purchase_price !== undefined ? String(match.purchase_price) : '')
      });
    } else {
      updateBillItem(index, { product_name: value, product_id: '', variant_id: '', variant_info: '' });
    }
  };

  const addBillItem = () => setBillForm(prev => ({ ...prev, items: [...prev.items, newBillItem()] }));
  const removeBillItem = (index) => setBillForm(prev => {
    const items = prev.items.filter((_, idx) => idx !== index);
    return { ...prev, items: items.length > 0 ? items : [newBillItem()] };
  });

  const billSubtotal = useMemo(() => billForm.items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const rate = parseFloat(String(item.purchase_rate).replace(/[^0-9.-]/g, '')) || 0;
    return sum + qty * rate;
  }, 0), [billForm.items]);

  const billGrandTotal = useMemo(() => billSubtotal + (Number(billForm.additional_charges) || 0), [billSubtotal, billForm.additional_charges]);

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
      bill_number: billForm.bill_number.trim(),
      purchase_date: billForm.purchase_date,
      additional_charges: Number(billForm.additional_charges) || 0,
      amount_paid: Number(billForm.amount_paid) || 0,
      payment_method: billForm.payment_method,
      notes: billForm.notes,
      confirm: Boolean(billForm.confirm),
      items: validItems.map(item => ({
        product_id: item.product_id || null,
        product_name: item.product_name,
        variant_id: item.variant_id ? Number(item.variant_id) : null,
        variant_info: item.variant_info || null,
        quantity: Number(item.quantity) || 1,
        purchase_rate: item.purchase_rate !== '' ? String(item.purchase_rate) : null,
        rate_value: parseFloat(String(item.purchase_rate).replace(/[^0-9.-]/g, '')) || 0
      }))
    };

    try {
      setSavingBill(true);
      setBillError('');
      if (editingBill?.id) {
        await updateAdminPurchaseBill(editingBill.id, payload);
        showToast('Purchase bill updated successfully.');
      } else {
        await createAdminPurchaseBill(payload);
        showToast('Purchase bill created successfully.');
      }
      setIsBillModalOpen(false);
      refreshAll();
    } catch (err) {
      setBillError(err.message || 'Failed to save purchase bill');
    } finally {
      setSavingBill(false);
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

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
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
  }, [vendors, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const totalOutstanding = vendors.reduce((sum, v) => sum + (Number(v.total_outstanding) || 0), 0);
    const totalPurchase = vendors.reduce((sum, v) => sum + (Number(v.total_purchase_value) || 0), 0);
    return {
      total: vendors.length,
      active: vendors.filter(v => v.is_active).length,
      totalProducts: vendors.reduce((sum, v) => sum + (Number(v.products_count) || 0), 0),
      totalProductsLabel: vendors.reduce((sum, v) => sum + (Number(v.products_count) || 0), 0),
      totalOutstanding,
      totalPurchase
    };
  }, [vendors]);

  const renderBillTable = (list, opts = {}) => {
    if (list.length === 0) {
      return <div style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>{opts.empty || 'No purchase bills found.'}</div>;
    }
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', textAlign: 'left', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 14px' }}>Bill No.</th>
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
                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>{vendor.name}</div>
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
              <button type="button" onClick={() => openNewBill('')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#b45309', color: '#fff', padding: '10px 16px', borderRadius: '8px', fontWeight: 800, fontSize: '13px', cursor: 'pointer', border: 'none' }}>
                + New Purchase Bill
              </button>
              <button type="button" onClick={openAddModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#065935', color: '#fff', padding: '10px 18px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', border: 'none' }}>
                <Icon name="plus" size={16} />
                <span>Add Vendor</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
            {[
              { key: 'vendors', label: `Vendors (${vendors.length})` },
              { key: 'purchase-bills', label: `All Purchase Bills (${bills.length})` },
              { key: 'outstanding', label: `Outstanding Payables (${outstanding.bills.length})` }
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
                    <option value="all">All Vendors ({vendors.length})</option>
                    <option value="active">Active Only ({vendors.filter(v => v.is_active).length})</option>
                    <option value="inactive">Inactive ({vendors.filter(v => !v.is_active).length})</option>
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
                <div style={{ flex: '1 1 220px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>SEARCH</label>
                  <input type="text" placeholder="Bill number or vendor..." value={billFilters.search} onChange={(e) => setBillFilters(prev => ({ ...prev, search: e.target.value }))} style={{ width: '100%', padding: '8px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12.5px' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '4px' }}>VENDOR</label>
                  <select value={billFilters.vendor_id} onChange={(e) => setBillFilters(prev => ({ ...prev, vendor_id: e.target.value }))} style={{ padding: '8px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff', minWidth: '170px' }}>
                    <option value="all">All Vendors</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
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
                <StatCard label="Outstanding Bills" value={outstanding.summary.bill_count || 0} />
                <StatCard label="Bill Value" value={`₹${money(outstanding.summary.total_bill_amount)}`} />
                <StatCard label="Already Paid" value={`₹${money(outstanding.summary.total_paid)}`} color="#15803d" />
                <StatCard label="Payable Now" value={`₹${money(outstanding.summary.total_outstanding)}`} color="#b91c1c" />
              </div>

              <div className="admin-card" style={{ padding: '14px 18px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '10px' }}>Outstanding by Vendor</div>
                {outstanding.vendor_totals.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: '12.5px' }}>No outstanding vendor payables. Nice and clear.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                    {outstanding.vendor_totals.map(v => (
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
                {loadingOutstanding ? <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading outstanding payables...</div> : renderBillTable(outstanding.bills, { empty: 'No outstanding payables right now.' })}
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
          <Modal isOpen={isBillModalOpen} onClose={() => setIsBillModalOpen(false)} title={editingBill ? `Edit Purchase Bill: ${editingBill.bill_number}` : 'New Purchase Bill'} maxWidth="960px">
            <form onSubmit={handleSaveBill} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {billError && <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fee2e2', color: '#b91c1c', fontSize: '12.5px', fontWeight: 700 }}>{billError}</div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '5px' }}>VENDOR *</label>
                  <select required value={billForm.vendor_id} onChange={(e) => setBillForm(prev => ({ ...prev, vendor_id: e.target.value }))} style={{ width: '100%', padding: '9px 11px', borderRadius: '7px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}>
                    <option value="">Select vendor...</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}{v.company_name ? ` (${v.company_name})` : ''}</option>)}
                  </select>
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

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '9px 12px', background: '#0f172a', color: '#fff', fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>PRODUCT LINE ITEMS</span>
                  <button type="button" onClick={addBillItem} style={{ background: '#065935', color: '#fff', border: 'none', borderRadius: '5px', padding: '4px 10px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>+ ADD ITEM</button>
                </div>
                <div style={{ padding: '8px', background: '#f8fafc' }}>
                  <datalist id="purchase-product-options">
                    {products.map(p => <option key={p.id} value={p.name} />)}
                  </datalist>
                  {billForm.items.map((item, index) => {
                    const variantSource = products.find(p => p.id === item.product_id);
                    const variants = Array.isArray(variantSource?.variants) ? variantSource.variants : [];
                    const amount = (Number(item.quantity) || 0) * (parseFloat(String(item.purchase_rate).replace(/[^0-9.-]/g, '')) || 0);
                    return (
                      <div key={item.key} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '8px', marginBottom: '6px', display: 'grid', gridTemplateColumns: '2.2fr 1.4fr 0.65fr 1fr 0.9fr 0.35fr', gap: '7px', alignItems: 'center' }}>
                        <div>
                          <input list="purchase-product-options" value={item.product_name} onChange={(e) => handleItemProductName(index, e.target.value)} placeholder="Type product name (new items auto-create)" style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                          {item.product_id && <div style={{ fontSize: '9.5px', color: '#15803d', marginTop: '2px', fontWeight: 700 }}>Linked to catalog product</div>}
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
                              <option value="">Main product</option>
                              {variants.map(v => <option key={v.id} value={v.id}>{[v.color_name, v.size_name].filter(Boolean).join(' / ') || v.sku || `Variant ${v.id}`}</option>)}
                            </select>
                          ) : (
                            <input type="text" value={item.variant_info} onChange={(e) => updateBillItem(index, { variant_info: e.target.value })} placeholder="Variant/size (optional)" style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11.5px' }} />
                          )}
                        </div>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => updateBillItem(index, { quantity: e.target.value })} style={{ width: '100%', padding: '7px 6px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px', textAlign: 'center' }} title="Quantity" />
                        <input type="text" value={item.purchase_rate} onChange={(e) => updateBillItem(index, { purchase_rate: e.target.value })} placeholder="Rate" style={{ width: '100%', padding: '7px 9px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px' }} title="Purchased rate (numeric or alphanumeric)" />
                        <div style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '12px' }}>₹{money(amount)}</div>
                        <button type="button" onClick={() => removeBillItem(index)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '5px', padding: '5px', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}>X</button>
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', flexWrap: 'wrap', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
                  <input type="checkbox" checked={billForm.confirm} onChange={(e) => setBillForm(prev => ({ ...prev, confirm: e.target.checked }))} style={{ width: '16px', height: '16px', accentColor: '#065935' }} />
                  Confirm bill and add stock to inventory
                </label>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11.5px', color: '#64748b' }}>Subtotal ₹{money(billSubtotal)} + Charges ₹{money(billForm.additional_charges)}</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>Total ₹{money(billGrandTotal)}</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <button type="button" onClick={() => setIsBillModalOpen(false)} style={{ padding: '9px 18px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
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
                        <th style={{ padding: '9px 12px', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedBill.items || []).map(item => (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 700 }}>{item.product_name}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b' }}>{item.variant_info || '—'}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'center' }}>{item.quantity}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right' }}>{item.purchase_rate || `₹${money(item.rate_value)}`}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 800 }}>₹{money(item.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ minWidth: '240px', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span style={{ color: '#64748b' }}>Subtotal</span><span>₹{money(selectedBill.subtotal)}</span></div>
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
