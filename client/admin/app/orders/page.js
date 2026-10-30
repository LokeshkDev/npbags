'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icons';
import { usePOSModal } from '../../lib/pos-modal-context';
import {
  getAdminOrders,
  updateOrderStatus,
  processAdminOrderReturn,
  deleteAdminOrder,
  updateAdminPOSOrderItems,
  getAdminProducts
} from '../../lib/api';

export default function AdminOrdersPage() {
  const { openPOS } = usePOSModal();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeOrderTypeTab, setActiveOrderTypeTab] = useState('all'); // 'all' | 'online' | 'pos'

  // Order Details Modal State
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Edit POS Order Products Modal State (Only for POS billing)
  const [editPOSOrder, setEditPOSOrder] = useState(null);
  const [editPOSItems, setEditPOSItems] = useState([]);
  const [editPOSDiscount, setEditPOSDiscount] = useState(0);
  const [editPOSNotes, setEditPOSNotes] = useState('');
  const [savingEditPOS, setSavingEditPOS] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);

  // Return & Replacement Modal State
  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [returnType, setReturnType] = useState('return'); // 'return' | 'exchange'
  const [returnReason, setReturnReason] = useState('Size mismatch');
  const [returnItemsState, setReturnItemsState] = useState([]);
  const [exchangeItemName, setExchangeItemName] = useState('');
  const [exchangeItemPrice, setExchangeItemPrice] = useState(0);
  const [processingReturn, setProcessingReturn] = useState(false);

  // Load orders from API
  const loadOrders = () => {
    getAdminOrders({ status: statusFilter === 'all' ? '' : statusFilter, search, limit: 100 })
      .then(data => {
        if (data && data.orders) setOrders(data.orders);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadOrders();
    const handleOrderUpdated = () => {
      loadOrders();
    };
    window.addEventListener('np_order_updated', handleOrderUpdated);
    return () => window.removeEventListener('np_order_updated', handleOrderUpdated);
  }, [statusFilter, search]);

  // Load catalog products for POS item editing
  useEffect(() => {
    getAdminProducts({ limit: 150 })
      .then(res => {
        const list = res?.products || res || [];
        if (Array.isArray(list)) setCatalogProducts(list);
      })
      .catch(() => {});
  }, []);

  // Update order status handler
  const handleUpdateStatus = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, { order_status: status });
      loadOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, order_status: status });
      }
    } catch (err) {
      alert(err.message || 'Error updating status');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'delivered': return 'badge-success';
      case 'shipped': return 'badge-info';
      case 'paid': return 'badge-success';
      case 'cancelled': return 'badge-danger';
      default: return 'badge-warning';
    }
  };

  const onlineCount = orders.filter(o => (o.order_type || '').toLowerCase() !== 'pos').length;
  const posCount = orders.filter(o => (o.order_type || '').toLowerCase() === 'pos').length;

  const filteredOrders = orders.filter(o => {
    if (activeOrderTypeTab === 'online') {
      return (o.order_type || '').toLowerCase() !== 'pos';
    }
    if (activeOrderTypeTab === 'pos') {
      return (o.order_type || '').toLowerCase() === 'pos';
    }
    return true;
  });

  // ----------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------

  // 1. Delete Order (with auto-restock confirmation)
  const handleDeleteOrder = async (order) => {
    const isPOS = (order.order_type || '').toLowerCase() === 'pos';
    const confirmMsg = `Are you sure you want to delete ${isPOS ? 'Walk-in / POS Bill' : 'Online Order'} #${order.order_number}?\n\nThis will permanently remove the record and automatically restore all items back to store inventory.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteAdminOrder(order.id, true);
      alert(`✓ Order #${order.order_number} deleted and inventory restocked.`);
      loadOrders();
      if (selectedOrder && selectedOrder.id === order.id) {
        setSelectedOrder(null);
      }
    } catch (err) {
      alert(`Delete failed: ${err.message || 'Server error'}`);
    }
  };

  // 2. Send WhatsApp Invoice / Bill
  const handleSendWhatsApp = (order) => {
    let phone = order.customer_phone || '';
    if (!phone || !phone.trim()) {
      const input = prompt(`Enter customer WhatsApp number for Order #${order.order_number}:`, '');
      if (!input || !input.trim()) return;
      phone = input.trim();
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const isPOS = (order.order_type || '').toLowerCase() === 'pos';
    const itemsList = (order.items || []).map(i => `${i.quantity}x ${i.product_name}`).join(', ');

    const text =
      `*NP GRAND SHOPPING* - ${isPOS ? 'In-Store POS Bill' : 'Order Update'}\n\n` +
      `Hello ${order.customer_name || 'Valued Customer'},\n\n` +
      `*Bill / Order No:* ${order.order_number}\n` +
      `*Status:* ${(order.order_status || 'Paid').toUpperCase()}\n` +
      `*Total Amount:* Rs. ${Number(order.total_amount).toFixed(2)} (${(order.payment_method || 'Cash').toUpperCase()})\n` +
      `*Items:* ${itemsList || 'Handbag Collection'}\n\n` +
      `Thank you for shopping with us! Visit again:\nhttps://www.npgrandshopping.com\nPhone: +91 97909 04504`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // 3. Open Return & Replace Modal
  const handleOpenReturnModal = (order) => {
    setReturnModalOrder(order);
    setReturnType('return');
    setReturnReason('Size mismatch');
    setExchangeItemName('');
    setExchangeItemPrice(0);

    const itemsState = (order.items || []).map(it => ({
      item_id: it.id,
      product_id: it.product_id,
      product_name: it.product_name,
      price: Number(it.price) || 0,
      max_qty: Number(it.quantity) || 1,
      return_qty: 0,
      image_url: it.image_url || it.image,
      sku: it.sku
    }));
    setReturnItemsState(itemsState);
  };

  // Submit Return / Exchange
  const handleSubmitReturn = async () => {
    if (!returnModalOrder) return;
    const selectedReturns = returnItemsState.filter(i => i.return_qty > 0);

    if (selectedReturns.length === 0) {
      alert('Please select at least 1 item and quantity to return.');
      return;
    }

    const totalRefund = selectedReturns.reduce((sum, it) => sum + (it.price * it.return_qty), 0);

    setProcessingReturn(true);
    try {
      await processAdminOrderReturn(returnModalOrder.id, {
        return_type: returnType,
        returned_items: selectedReturns.map(r => ({
          item_id: r.item_id,
          product_id: r.product_id,
          product_name: r.product_name,
          price: r.price,
          quantity: r.return_qty,
          sku: r.sku
        })),
        replacement_items: returnType === 'exchange' && exchangeItemName.trim() ? [
          {
            product_name: exchangeItemName.trim(),
            quantity: 1,
            price: Number(exchangeItemPrice) || totalRefund
          }
        ] : [],
        refund_amount: returnType === 'return' ? totalRefund : 0,
        reason: returnReason
      });

      alert(`✓ ${returnType === 'return' ? 'Return & Refund' : 'Exchange / Replacement'} processed successfully. Restocked to store inventory.`);
      setReturnModalOrder(null);
      loadOrders();
      if (selectedOrder && selectedOrder.id === returnModalOrder.id) {
        setSelectedOrder(null);
      }
    } catch (err) {
      alert(`Return failed: ${err.message || 'Server error'}`);
    } finally {
      setProcessingReturn(false);
    }
  };

  // 4. Open Edit POS Order Modal (Directly opens full-screen POS Billing Popup in Edit Mode)
  const handleOpenEditPOS = (order) => {
    openPOS(order);
  };

  // Update item quantity in POS edit modal
  const updatePOSItemQty = (index, delta) => {
    setEditPOSItems(prev => {
      const copy = [...prev];
      const newQty = copy[index].quantity + delta;
      if (newQty <= 0) {
        copy.splice(index, 1);
      } else {
        copy[index].quantity = newQty;
      }
      return copy;
    });
  };

  // Update item price in POS edit modal
  const updatePOSItemPrice = (index, newPrice) => {
    setEditPOSItems(prev => {
      const copy = [...prev];
      copy[index].price = Math.max(0, Number(newPrice) || 0);
      return copy;
    });
  };

  // Add catalog product to POS edit modal
  const handleAddProductToPOS = (prod) => {
    const price = prod.sale_price > 0 ? prod.sale_price : prod.price;
    setEditPOSItems(prev => [
      ...prev,
      {
        product_id: prod.id,
        product_name: prod.name,
        barcode: prod.barcode || `NP-${prod.id}`,
        sku: prod.barcode || null,
        hsn_code: prod.hsn_code || '4202',
        price: Number(price) || 0,
        quantity: 1,
        image_url: prod.image,
        variant_info: null
      }
    ]);
    setProductSearchInput('');
    setShowCatalogDropdown(false);
  };

  // Add custom unlisted product to POS edit modal
  const handleAddCustomToPOS = () => {
    const name = prompt('Enter Custom Item Name:');
    if (!name || !name.trim()) return;
    const priceStr = prompt('Enter Unit Price (₹):', '999');
    const price = Number(priceStr);
    if (isNaN(price) || price <= 0) return;

    setEditPOSItems(prev => [
      ...prev,
      {
        product_id: `custom-${Date.now()}`,
        product_name: name.trim(),
        barcode: `CUSTOM-${Date.now().toString().slice(-4)}`,
        sku: null,
        hsn_code: '4202',
        price: price,
        quantity: 1,
        image_url: '/assets/bestsellers/best-handbag.png',
        variant_info: 'Custom Item'
      }
    ]);
  };

  // Calculated totals for POS editing
  const editFinancials = useMemo(() => {
    const rawSubtotal = editPOSItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const disc = Math.min(Number(editPOSDiscount) || 0, rawSubtotal);
    const grandTotal = Math.max(0, rawSubtotal - disc);

    const gstRate = 18;
    const taxableAmount = Math.round((grandTotal / (1 + (gstRate / 100))) * 100) / 100;
    const totalTax = Math.round((grandTotal - taxableAmount) * 100) / 100;
    const cgstAmount = Math.round((totalTax / 2) * 100) / 100;
    const sgstAmount = Math.round((totalTax - cgstAmount) * 100) / 100;

    return {
      rawSubtotal,
      discount: disc,
      grandTotal,
      taxableAmount,
      cgstAmount,
      sgstAmount
    };
  }, [editPOSItems, editPOSDiscount]);

  // Submit POS Order Item Changes
  const handleSavePOSOrder = async () => {
    if (!editPOSOrder) return;
    if (editPOSItems.length === 0) {
      alert('Order must have at least one product.');
      return;
    }

    setSavingEditPOS(true);
    try {
      await updateAdminPOSOrderItems(editPOSOrder.id, {
        items: editPOSItems,
        discount_amount: editFinancials.discount,
        notes: editPOSNotes
      });

      alert(`✓ POS Bill #${editPOSOrder.order_number} items updated successfully and inventory resynced!`);
      setEditPOSOrder(null);
      loadOrders();
      if (selectedOrder && selectedOrder.id === editPOSOrder.id) {
        setSelectedOrder(null);
      }
    } catch (err) {
      alert(`Save failed: ${err.message || 'Server error'}`);
    } finally {
      setSavingEditPOS(false);
    }
  };

  // 5. Thermal Receipt Printing (Standard ESC/POS pure solid black)
  const printThermalReceipt = (order) => {
    if (!order) return;
    const items = order.items || [];
    const dateStr = new Date(order.created_at || Date.now()).toLocaleString('en-IN');
    const orderNo = order.order_number || `POS-${order.id}`;

    const printHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>POS Receipt - ${orderNo}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { color: #000000 !important; -webkit-text-fill-color: #000000 !important; border-color: #000000 !important; }
  body {
    width: 72mm; margin: 0 auto; padding: 4mm 2mm;
    font-family: 'Courier New', Courier, monospace, 'Lucida Console';
    font-size: 11px; line-height: 1.35; color: #000000 !important;
    font-weight: 800; -webkit-print-color-adjust: exact !important;
    text-shadow: 0 0 0.4px #000000;
  }
  .center { text-align: center; }
  .bold { font-weight: 900 !important; }
  .divider { border-top: 1.5px dashed #000000 !important; margin: 5px 0; }
  .double-divider { border-top: 2.5px solid #000000 !important; margin: 5px 0; }
  .flex-row { display: flex; justify-content: space-between; margin: 2px 0; }
  .items-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 4px 0; }
  .items-table th { text-align: left; border-bottom: 1.5px dashed #000000; padding: 3px 0; font-weight: 900; }
  .items-table td { padding: 3px 0; vertical-align: top; }
  .right { text-align: right; }
  .subtext { font-size: 9px; font-weight: 700; }
</style>
</head>
<body>
  <div class="center">
    <div style="font-size: 16px; font-weight: 900;">NP GRAND SHOPPING</div>
    <div class="subtext">Madambakkam Main Road, Chennai 600073</div>
    <div class="subtext">Phone: +91 97909 04504 &bull; www.npgrandshopping.com</div>
    <div class="divider"></div>
    <div class="bold" style="font-size: 12px;">TAX INVOICE / POS RECEIPT</div>
  </div>

  <div class="divider"></div>
  <div class="flex-row"><span>Bill No:</span><span class="bold">${orderNo}</span></div>
  <div class="flex-row"><span>Date:</span><span>${dateStr}</span></div>
  <div class="flex-row"><span>Customer:</span><span class="bold">${order.customer_name}</span></div>
  ${order.customer_phone ? `<div class="flex-row"><span>Phone:</span><span>${order.customer_phone}</span></div>` : ''}
  <div class="flex-row"><span>Payment:</span><span class="bold">${(order.payment_method || 'Cash').toUpperCase()}</span></div>
  <div class="divider"></div>

  <table class="items-table">
    <thead>
      <tr><th style="width: 48%;">ITEM</th><th style="width: 14%;" class="right">QTY</th><th style="width: 18%;" class="right">PRICE</th><th style="width: 20%;" class="right">TOTAL</th></tr>
    </thead>
    <tbody>
      ${items.map(it => `
        <tr>
          <td><div class="bold">${it.product_name}</div><div class="subtext">[${it.sku || it.barcode || 'ITEM'}]</div></td>
          <td class="right bold">${it.quantity}</td>
          <td class="right">${Number(it.price).toFixed(2)}</td>
          <td class="right bold">${Number(it.total || (it.quantity * it.price)).toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="divider"></div>
  <div class="flex-row"><span>Items Count:</span><span class="bold">${items.reduce((s, i) => s + Number(i.quantity), 0)}</span></div>
  <div class="flex-row"><span>Gross Total:</span><span>Rs. ${Number(order.subtotal || order.total_amount).toFixed(2)}</span></div>
  ${Number(order.discount) > 0 ? `<div class="flex-row"><span>Discount:</span><span class="bold">- Rs. ${Number(order.discount).toFixed(2)}</span></div>` : ''}
  <div class="flex-row"><span>Taxable Value:</span><span>Rs. ${Number(order.taxable_amount || (order.total_amount * 0.8475)).toFixed(2)}</span></div>
  <div class="flex-row"><span>CGST (9%):</span><span>Rs. ${Number(order.cgst_amount || (order.total_amount * 0.07625)).toFixed(2)}</span></div>
  <div class="flex-row"><span>SGST (9%):</span><span>Rs. ${Number(order.sgst_amount || (order.total_amount * 0.07625)).toFixed(2)}</span></div>
  <div class="double-divider"></div>
  <div class="flex-row" style="font-size: 13.5px;"><span class="bold">NET PAYABLE:</span><span class="bold">Rs. ${Number(order.total_amount).toFixed(2)}</span></div>
  <div class="double-divider"></div>

  <div class="center" style="font-size: 9.5px; margin-top: 8px;">
    <div class="bold">GST INCLUSIVE. ALL TAXES ACCOUNTED FOR.</div>
    <div>Items exchangeable within 7 days with bill.</div>
    <div class="bold" style="margin-top: 4px;">*** THANK YOU FOR SHOPPING WITH US! ***</div>
  </div>
</body>
</html>
    `;

    const printWin = window.open('', '_blank', 'width=450,height=600');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      setTimeout(() => {
        printWin.focus();
        printWin.print();
        printWin.close();
      }, 350);
    }
  };

  // Product Autocomplete filter for POS edit modal
  const filteredCatalogSuggestions = useMemo(() => {
    if (!productSearchInput || productSearchInput.trim().length < 2) return [];
    const q = productSearchInput.trim().toLowerCase();
    return catalogProducts.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.barcode_short_name || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [catalogProducts, productSearchInput]);

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Customer Orders Management" />

        <div className="admin-content">
          {/* Order Type Tabs (Online vs Walk-in POS Billing) */}
          <div style={{ display: 'flex', gap: '8px', background: '#e2e8f0', padding: '4px', borderRadius: '8px', marginBottom: '20px', width: 'fit-content' }}>
            <button
              type="button"
              onClick={() => setActiveOrderTypeTab('all')}
              style={{
                padding: '8px 20px',
                borderRadius: '6px',
                border: 'none',
                background: activeOrderTypeTab === 'all' ? '#ffffff' : 'transparent',
                color: activeOrderTypeTab === 'all' ? '#0f172a' : '#64748b',
                fontWeight: activeOrderTypeTab === 'all' ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeOrderTypeTab === 'all' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              All Orders ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveOrderTypeTab('online')}
              style={{
                padding: '8px 20px',
                borderRadius: '6px',
                border: 'none',
                background: activeOrderTypeTab === 'online' ? '#ffffff' : 'transparent',
                color: activeOrderTypeTab === 'online' ? '#0369a1' : '#64748b',
                fontWeight: activeOrderTypeTab === 'online' ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeOrderTypeTab === 'online' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Online Orders ({onlineCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveOrderTypeTab('pos')}
              style={{
                padding: '8px 20px',
                borderRadius: '6px',
                border: 'none',
                background: activeOrderTypeTab === 'pos' ? '#ffffff' : 'transparent',
                color: activeOrderTypeTab === 'pos' ? '#065935' : '#64748b',
                fontWeight: activeOrderTypeTab === 'pos' ? 800 : 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeOrderTypeTab === 'pos' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Walk-in / POS Billing ({posCount})
            </button>
          </div>

          {/* Search & Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="search"
                placeholder="Search by order #, customer name, email..."
                className="form-control"
                style={{ width: '320px' }}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                className="form-control"
                style={{ width: '180px' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button
              type="button"
              className="admin-btn admin-btn-outline"
              onClick={loadOrders}
              style={{ fontSize: '12.5px', fontWeight: 700 }}
            >
              Refresh Orders
            </button>
          </div>

          {/* Orders Table */}
          <div className="admin-card">
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order / Bill #</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center', minWidth: '190px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                        {activeOrderTypeTab === 'online' ? 'No online orders found matching criteria.' : activeOrderTypeTab === 'pos' ? 'No walk-in / POS billing orders found.' : 'No orders recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(o => {
                      const isPOS = (o.order_type || '').toLowerCase() === 'pos';
                      return (
                        <tr key={o.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {o.items && o.items[0] && (
                                <img
                                  src={o.items[0].image_url || o.items[0].image || '/assets/bestsellers/best-handbag.png'}
                                  alt=""
                                  onError={(e) => { e.currentTarget.src = '/assets/bestsellers/best-handbag.png'; }}
                                  style={{ width: '38px', height: '46px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--line)', background: '#f5f5f5', flexShrink: 0 }}
                                />
                              )}
                              <div>
                                <strong>{o.order_number}</strong>
                                <span style={{ marginLeft: '6px', fontSize: '10px', background: isPOS ? '#eaf4ee' : '#e0f2fe', color: isPOS ? '#065935' : '#0369a1', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  {isPOS ? 'POS' : 'ONLINE'}
                                </span>
                                {o.items && o.items.length > 1 && (
                                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>+{o.items.length - 1} more items</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--muted)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                          <td>
                            <div><strong>{o.customer_name}</strong></div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{o.customer_email || o.customer_phone}</div>
                          </td>
                          <td>
                            <span style={{ textTransform: 'uppercase', fontSize: '12px', fontWeight: 600 }}>
                              {o.payment_method}
                            </span>
                          </td>
                          <td><strong>₹{Number(o.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
                          <td>
                            <select
                              className={`badge ${getStatusBadge(o.order_status)}`}
                              style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                              value={o.order_status}
                              onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                            >
                              <option value="pending">Pending</option>
                              <option value="paid">Paid</option>
                              <option value="shipped">Shipped</option>
                              <option value="delivered">Delivered</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>

                          {/* ACTION BUTTONS GROUP */}
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                              {/* 1. View Details Icon */}
                              <button
                                type="button"
                                className="admin-btn admin-btn-outline"
                                style={{ padding: '6px 8px', borderRadius: '6px' }}
                                title="View Full Order Details"
                                onClick={() => setSelectedOrder(o)}
                              >
                                <Icon name="eye" size={15} />
                              </button>

                              {/* 2. Edit POS Products Icon (ONLY FOR POS BILLING) */}
                              {isPOS && (
                                <button
                                  type="button"
                                  className="admin-btn admin-btn-outline"
                                  style={{ padding: '6px 8px', borderRadius: '6px', color: '#065935', borderColor: '#86efac', background: '#f0fdf4' }}
                                  title="Edit POS Products & Quantities"
                                  onClick={() => handleOpenEditPOS(o)}
                                >
                                  <Icon name="edit" size={15} />
                                </button>
                              )}

                              {/* 3. Return & Replace Icon */}
                              <button
                                type="button"
                                className="admin-btn admin-btn-outline"
                                style={{ padding: '6px 8px', borderRadius: '6px', color: '#b45309', borderColor: '#fde68a', background: '#fffbeb' }}
                                title="Process Return or Exchange"
                                onClick={() => handleOpenReturnModal(o)}
                              >
                                <Icon name="refresh" size={15} />
                              </button>

                              {/* 4. Send WhatsApp Icon */}
                              <button
                                type="button"
                                className="admin-btn admin-btn-outline"
                                style={{ padding: '6px 8px', borderRadius: '6px', color: '#15803d', borderColor: '#bbf7d0', background: '#f0fdf4' }}
                                title="Send WhatsApp Invoice / Tracking"
                                onClick={() => handleSendWhatsApp(o)}
                              >
                                <Icon name="whatsapp" size={15} />
                              </button>

                              {/* 5. Delete Icon */}
                              <button
                                type="button"
                                className="admin-btn admin-btn-outline"
                                style={{ padding: '6px 8px', borderRadius: '6px', color: '#dc2626', borderColor: '#fca5a5', background: '#fef2f2' }}
                                title="Delete Order (Restores Inventory)"
                                onClick={() => handleDeleteOrder(o)}
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

      {/* ======================================================== */}
      {/* 1. ORDER DETAILS MODAL (Both Online & POS Billing Orders) */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Order Details: ${selectedOrder?.order_number}`}
        maxWidth="680px"
      >
        {selectedOrder && (
          <div>
            {/* Top Badge & Order Metadata */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  background: (selectedOrder.order_type || '').toLowerCase() === 'pos' ? '#ecfdf5' : '#e0f2fe',
                  color: (selectedOrder.order_type || '').toLowerCase() === 'pos' ? '#065935' : '#0369a1',
                  letterSpacing: '0.04em'
                }}
              >
                {(selectedOrder.order_type || '').toLowerCase() === 'pos' ? 'WALK-IN POS BILLING' : 'ONLINE STORE ORDER'}
              </span>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Placed on: {new Date(selectedOrder.created_at).toLocaleString('en-IN')}
              </div>
            </div>

            {/* Customer & Delivery / Register Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', background: 'var(--surface-soft)', padding: '16px', borderRadius: '8px' }}>
              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>Customer Information</strong>
                <div style={{ fontSize: '13.5px', fontWeight: 700, marginTop: '4px' }}>{selectedOrder.customer_name}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>{selectedOrder.customer_email || 'No email registered'}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>Phone: {selectedOrder.customer_phone || 'Walk-in'}</div>
              </div>

              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                  {(selectedOrder.order_type || '').toLowerCase() === 'pos' ? 'POS Counter Register' : 'Shipping Address'}
                </strong>
                {(selectedOrder.order_type || '').toLowerCase() === 'pos' ? (
                  <div style={{ fontSize: '12.5px', marginTop: '4px', lineHeight: 1.5, color: '#334155' }}>
                    NP Grand Shopping Store Counter<br />
                    Madambakkam Main Road, Chennai 600073<br />
                    Payment Mode: <strong>{(selectedOrder.payment_method || 'Cash').toUpperCase()}</strong>
                  </div>
                ) : selectedOrder.shipping_address ? (
                  <div style={{ fontSize: '12.5px', marginTop: '4px', lineHeight: 1.5 }}>
                    {selectedOrder.shipping_address.line1}
                    {selectedOrder.shipping_address.line2 && `, ${selectedOrder.shipping_address.line2}`}<br />
                    {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state} — {selectedOrder.shipping_address.postal_code}
                  </div>
                ) : (
                  <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>No shipping address stored</div>
                )}
              </div>
            </div>

            {/* Line Items List */}
            <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
              Items Billed ({(selectedOrder.items || []).length})
            </h4>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '20px', maxHeight: '240px', overflowY: 'auto' }}>
              {selectedOrder.items?.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--line)', borderRadius: '8px', background: '#ffffff', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={item.image_url || item.image || '/assets/bestsellers/best-handbag.png'}
                      alt={item.product_name}
                      onError={(e) => { e.currentTarget.src = '/assets/bestsellers/best-handbag.png'; }}
                      style={{ width: '44px', height: '52px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--line)', background: '#f9f9f9', flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ink)' }}>
                        {item.quantity}x {item.product_name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        {item.sku ? `SKU: ${item.sku}` : ''}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--muted)' }}>
                        Unit Price: ₹{parseFloat(item.price || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <strong style={{ fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                    ₹{parseFloat(item.total || (item.quantity * item.price) || 0).toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', display: 'grid', gap: '6px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span>
                <span>₹{Number(selectedOrder.subtotal || selectedOrder.total_amount).toFixed(2)}</span>
              </div>
              {Number(selectedOrder.discount) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 600 }}>
                  <span>Discount:</span>
                  <span>−₹{Number(selectedOrder.discount).toFixed(2)}</span>
                </div>
              )}
              {selectedOrder.shipping_fee > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Shipping Fee:</span>
                  <span>₹{Number(selectedOrder.shipping_fee).toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '16px', borderTop: '1.5px solid var(--line)', paddingTop: '8px', color: '#065935' }}>
                <span>Net Total:</span>
                <span>₹{Number(selectedOrder.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="modal-footer" style={{ padding: '16px 0 0', marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* Print Receipt (For POS) */}
                {(selectedOrder.order_type || '').toLowerCase() === 'pos' && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-outline"
                    onClick={() => printThermalReceipt(selectedOrder)}
                    style={{ fontSize: '12px', fontWeight: 800, color: '#065935', borderColor: '#86efac' }}
                  >
                    🖨️ Re-Print Thermal Receipt
                  </button>
                )}

                {/* Edit POS Items */}
                {(selectedOrder.order_type || '').toLowerCase() === 'pos' && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-outline"
                    onClick={() => {
                      const ord = selectedOrder;
                      setSelectedOrder(null);
                      handleOpenEditPOS(ord);
                    }}
                    style={{ fontSize: '12px', fontWeight: 700 }}
                  >
                    ✏️ Edit Products
                  </button>
                )}

                {/* WhatsApp */}
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={() => handleSendWhatsApp(selectedOrder)}
                  style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', borderColor: '#bbf7d0' }}
                >
                  💬 WhatsApp
                </button>

                {/* Return */}
                <button
                  type="button"
                  className="admin-btn admin-btn-outline"
                  onClick={() => {
                    const ord = selectedOrder;
                    setSelectedOrder(null);
                    handleOpenReturnModal(ord);
                  }}
                  style={{ fontSize: '12px', fontWeight: 700, color: '#b45309', borderColor: '#fde68a' }}
                >
                  🔄 Return / Exchange
                </button>
              </div>

              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* 2. EDIT POS ORDER PRODUCTS MODAL (Only for POS billing) */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!editPOSOrder}
        onClose={() => setEditPOSOrder(null)}
        title={`Edit Products: POS Bill #${editPOSOrder?.order_number}`}
        maxWidth="740px"
      >
        {editPOSOrder && (
          <div>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
              Adjust quantities, update prices, remove items, or add new items from inventory. Totals and stock will adjust automatically upon saving.
            </p>

            {/* Current Line Items Table */}
            <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '14px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>
                  ORDER LINE ITEMS ({editPOSItems.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddCustomToPOS}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '5px',
                    background: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  + Add Custom Item
                </button>
              </div>

              {editPOSItems.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No items in this order. Add items below.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {editPOSItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#ffffff',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        gap: '12px'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {item.product_name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Code: {item.barcode || item.sku || 'N/A'}
                        </div>
                      </div>

                      {/* Unit Price input */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11.5px', color: '#64748b' }}>₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updatePOSItemPrice(idx, e.target.value)}
                          style={{
                            width: '80px',
                            padding: '6px 8px',
                            borderRadius: '5px',
                            border: '1.5px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: 700,
                            textAlign: 'right'
                          }}
                        />
                      </div>

                      {/* Quantity Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => updatePOSItemQty(idx, -1)}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '4px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer',
                            fontWeight: 800
                          }}
                        >
                          -
                        </button>
                        <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 800, fontSize: '13px' }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updatePOSItemQty(idx, 1)}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '4px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            cursor: 'pointer',
                            fontWeight: 800
                          }}
                        >
                          +
                        </button>
                      </div>

                      {/* Line Total */}
                      <div style={{ width: '85px', textAlign: 'right', fontWeight: 800, fontSize: '13px', color: '#065935' }}>
                        ₹{(item.quantity * item.price).toFixed(2)}
                      </div>

                      {/* Remove item */}
                      <button
                        type="button"
                        onClick={() => updatePOSItemQty(idx, -item.quantity)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Remove product from order"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Product from Catalog Autocomplete */}
            <div style={{ marginBottom: '18px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                ADD ANOTHER PRODUCT FROM CATALOG:
              </label>
              <input
                type="text"
                placeholder="Type product name or barcode (e.g. Handbag, NP-1048)..."
                value={productSearchInput}
                onChange={(e) => {
                  setProductSearchInput(e.target.value);
                  setShowCatalogDropdown(true);
                }}
                onFocus={() => {
                  if (filteredCatalogSuggestions.length > 0) setShowCatalogDropdown(true);
                }}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '6px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '13px'
                }}
              />

              {showCatalogDropdown && filteredCatalogSuggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}
                >
                  {filteredCatalogSuggestions.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleAddProductToPOS(p)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontSize: '12.5px'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                    >
                      <div>
                        <strong>{p.name}</strong>
                        <span style={{ marginLeft: '6px', color: '#065935', fontSize: '11px', fontWeight: 700 }}>
                          [{p.barcode || `NP-${p.id}`}]
                        </span>
                      </div>
                      <strong style={{ color: '#0f172a' }}>
                        ₹{p.sale_price > 0 ? p.sale_price : p.price}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Totals Recalculation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: '#f1f5f9', padding: '14px', borderRadius: '8px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '4px' }}>
                  DISCOUNT AMOUNT (₹):
                </label>
                <input
                  type="number"
                  min="0"
                  value={editPOSDiscount}
                  onChange={(e) => setEditPOSDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '5px', border: '1.5px solid #cbd5e1', fontSize: '13px', fontWeight: 700 }}
                />
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Subtotal: ₹{editFinancials.rawSubtotal.toFixed(2)}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  GST 18% (CGST: ₹{editFinancials.cgstAmount.toFixed(2)}, SGST: ₹{editFinancials.sgstAmount.toFixed(2)})
                </div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#065935', marginTop: '4px' }}>
                  NEW NET PAYABLE: ₹{editFinancials.grandTotal.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={() => setEditPOSOrder(null)}
                disabled={savingEditPOS}
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={handleSavePOSOrder}
                disabled={savingEditPOS}
                style={{ background: '#065935', borderColor: '#065935' }}
              >
                {savingEditPOS ? 'Saving Changes...' : 'Save & Update Stock'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* 3. RETURN & REPLACE MODAL */}
      {/* ======================================================== */}
      <Modal
        isOpen={!!returnModalOrder}
        onClose={() => setReturnModalOrder(null)}
        title={`Process Return / Replacement: #${returnModalOrder?.order_number}`}
        maxWidth="640px"
      >
        {returnModalOrder && (
          <div>
            {/* Return Type Segment Toggle */}
            <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setReturnType('return')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: returnType === 'return' ? '#ffffff' : 'transparent',
                  color: returnType === 'return' ? '#b45309' : '#64748b',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  boxShadow: returnType === 'return' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Return &amp; Refund
              </button>
              <button
                type="button"
                onClick={() => setReturnType('exchange')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  background: returnType === 'exchange' ? '#ffffff' : 'transparent',
                  color: returnType === 'exchange' ? '#065935' : '#64748b',
                  fontWeight: 800,
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  boxShadow: returnType === 'exchange' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                Product Replacement / Exchange
              </button>
            </div>

            {/* Select Items to Return */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                SELECT ITEM(S) AND QUANTITIES TO RETURN:
              </label>

              <div style={{ display: 'grid', gap: '8px' }}>
                {returnItemsState.map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: it.return_qty > 0 ? '#fffbeb' : '#ffffff'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>{it.product_name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Purchased: {it.max_qty} &bull; Unit Price: ₹{it.price.toFixed(2)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: 700 }}>Return Qty:</span>
                      <select
                        value={it.return_qty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setReturnItemsState(prev => {
                            const copy = [...prev];
                            copy[idx].return_qty = val;
                            return copy;
                          });
                        }}
                        style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700 }}
                      >
                        {Array.from({ length: it.max_qty + 1 }).map((_, n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* If Replacement: Replacement Details */}
            {returnType === 'exchange' && (
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
                  REPLACEMENT PRODUCT DETAILS:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder="Replacement item name / size..."
                    value={exchangeItemName}
                    onChange={(e) => setExchangeItemName(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '5px', border: '1.5px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                  <input
                    type="number"
                    placeholder="Price (₹)"
                    value={exchangeItemPrice}
                    onChange={(e) => setExchangeItemPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    style={{ padding: '8px 10px', borderRadius: '5px', border: '1.5px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>
              </div>
            )}

            {/* Return Reason */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                REASON FOR {returnType.toUpperCase()}:
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '13px' }}
              >
                <option value="Size mismatch">Size mismatch / Customer fit</option>
                <option value="Defective or damaged">Defective or damaged item</option>
                <option value="Customer change of mind">Customer change of mind</option>
                <option value="Incorrect item dispatched">Incorrect item delivered</option>
                <option value="Other">Other store adjustment</option>
              </select>
            </div>

            {/* Modal Footer */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={() => setReturnModalOrder(null)}
                disabled={processingReturn}
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={handleSubmitReturn}
                disabled={processingReturn}
                style={{ background: returnType === 'return' ? '#b45309' : '#065935', borderColor: returnType === 'return' ? '#b45309' : '#065935' }}
              >
                {processingReturn ? 'Processing...' : `Confirm & Process ${returnType === 'return' ? 'Refund' : 'Replacement'}`}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

