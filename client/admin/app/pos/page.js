'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/Icons';
import { usePOSModal } from '../../lib/pos-modal-context';
import { getAdminOrders, getAdminStoreSettings } from '../../lib/api';

export default function POSBillingPage() {
  const { openPOS } = usePOSModal();
  const [walkinBills, setWalkinBills] = useState([]);
  const [storeSettings, setStoreSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState(null);

  // Auto-launch full-screen POS register once on page visit
  const hasAutoOpenedRef = React.useRef(false);
  useEffect(() => {
    if (!hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      openPOS();
    }
  }, [openPOS]);

  // Load store settings and Walk-in POS bills
  const loadPOSBills = () => {
    setLoading(true);
    Promise.all([
      getAdminStoreSettings().catch(() => null),
      getAdminOrders({ limit: 100 }).catch(() => ({ orders: [] }))
    ]).then(([settings, ordersRes]) => {
      if (settings) setStoreSettings(settings);
      const orders = ordersRes?.orders || ordersRes || [];
      if (Array.isArray(orders)) {
        const posOrders = orders.filter(o => (o.order_type || '').toLowerCase() === 'pos');
        setWalkinBills(posOrders);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    loadPOSBills();
    const handleOrderUpdated = () => {
      loadPOSBills();
    };
    window.addEventListener('np_order_updated', handleOrderUpdated);
    return () => window.removeEventListener('np_order_updated', handleOrderUpdated);
  }, []);

  // Calculate Walk-in Financial Statistics
  const posStats = useMemo(() => {
    const totalCount = walkinBills.length;
    const totalAmount = walkinBills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
    const cashCount = walkinBills.filter(b => (b.payment_method || '').toLowerCase() === 'cash').length;
    const upiCount = walkinBills.filter(b => (b.payment_method || '').toLowerCase() === 'upi').length;
    return {
      totalCount,
      totalAmount,
      cashCount,
      upiCount
    };
  }, [walkinBills]);

  // Print pure solid black thermal receipt
  const printThermalReceipt = (order) => {
    if (!order) return;
    const items = order.items || [];
    const dateStr = new Date(order.created_at || Date.now()).toLocaleString('en-IN');
    const orderNo = order.order_number || `POS-${order.id}`;

    // Read fixed thermal printer settings from localStorage
    let savedSettings = { paperWidth: '80mm', copies: 1, density: '300bol' };
    try {
      const stored = localStorage.getItem('np_thermal_settings');
      if (stored) savedSettings = { ...savedSettings, ...JSON.parse(stored) };
    } catch (e) {}

    const is58mm = savedSettings.paperWidth === '58mm';
    const bodyWidth = is58mm ? '52mm' : '72mm';
    const fontSize = is58mm ? '10px' : '11.5px';

    const printHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>POS Receipt - ${orderNo}</title>
<style>
  @page { size: ${is58mm ? '58mm' : '80mm'} auto; margin: 0; }
  * { color: #000000 !important; -webkit-text-fill-color: #000000 !important; border-color: #000000 !important; }
  body {
    width: ${bodyWidth}; margin: 0 auto; padding: 4mm 2mm;
    font-family: 'Courier New', Courier, monospace, 'Lucida Console';
    font-size: ${fontSize}; line-height: 1.35; color: #000000 !important;
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
    <div style="font-size: 15px; font-weight: 900;">${storeSettings?.store_name || 'NP GRAND SHOPPING'}</div>
    <div class="subtext">${storeSettings?.address || 'Madambakkam Main Road, Chennai 600073'}</div>
    <div class="subtext">Phone: ${storeSettings?.phone || '+91 97909 04504'}</div>
    <div class="divider"></div>
    <div class="bold" style="font-size: 12px;">TAX INVOICE / POS BILL</div>
  </div>

  <div class="divider"></div>
  <div class="flex-row"><span>Bill No:</span><span class="bold">${orderNo}</span></div>
  <div class="flex-row"><span>Date:</span><span>${dateStr}</span></div>
  <div class="flex-row"><span>Customer:</span><span class="bold">${order.customer_name}</span></div>
  ${order.customer_phone ? `<div class="flex-row"><span>Mobile:</span><span>${order.customer_phone}</span></div>` : ''}
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
  <div class="flex-row"><span>Gross Total:</span><span>Rs. ${(Number(order.subtotal || (Number(order.total_amount) + Number(order.discount || order.discount_amount || 0)))).toFixed(2)}</span></div>
  ${Number(order.discount || order.discount_amount || 0) > 0 ? `<div class="flex-row bold"><span>Discount:</span><span class="bold">- Rs. ${Number(order.discount || order.discount_amount).toFixed(2)}</span></div>` : ''}
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

    const printWin = window.open('', '_blank', `width=${is58mm ? 400 : 500},height=600`);
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

  // WhatsApp bill trigger
  const handleSendWhatsApp = (order) => {
    let phone = order.customer_phone || '';
    if (!phone || !phone.trim()) {
      const input = prompt(`Enter customer WhatsApp number for Bill #${order.order_number}:`, '');
      if (!input || !input.trim()) return;
      phone = input.trim();
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

    const itemsList = (order.items || []).map(i => `${i.quantity}x ${i.product_name}`).join(', ');
    const text =
      `*NP GRAND SHOPPING* - In-Store POS Bill\n\n` +
      `Hello ${order.customer_name || 'Valued Customer'},\n\n` +
      `*Bill No:* ${order.order_number}\n` +
      `*Amount Paid:* Rs. ${Number(order.total_amount).toFixed(2)} (${(order.payment_method || 'Cash').toUpperCase()})\n` +
      `*Items Billed:* ${itemsList || 'Handbag Collection'}\n\n` +
      `Thank you for shopping with us! Visit again:\nhttps://www.npgrandshopping.com\nPhone: +91 97909 04504`;

    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="POS Billing Counter" />

        <div className="admin-content">
          {/* Top Banner Card */}
          <div
            style={{
              background: '#065935',
              borderRadius: '14px',
              padding: '28px 32px',
              color: '#ffffff',
              marginBottom: '24px',
              boxShadow: '0 4px 20px rgba(6, 89, 53, 0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '20px'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.1em', opacity: 0.85, marginBottom: '6px' }}>
                RETAIL CASH REGISTER
              </div>
              <h1 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 6px', letterSpacing: '-0.01em' }}>
                Omnichannel POS Billing Counter
              </h1>
              <p style={{ fontSize: '13.5px', opacity: 0.9, margin: 0, maxWidth: '540px', lineHeight: 1.5 }}>
                Full-screen width billing popup with instant hardware barcode scanning, GST 18% calculation, cash change counter, and thermal receipt printing.
              </p>
            </div>

            {/* Launch Full-Screen Button */}
            <button
              type="button"
              onClick={openPOS}
              style={{
                background: '#ffffff',
                color: '#065935',
                border: 'none',
                borderRadius: '8px',
                padding: '13px 26px',
                fontSize: '14px',
                fontWeight: 900,
                cursor: 'pointer',
                letterSpacing: '0.03em',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                transition: 'transform 0.15s ease'
              }}
            >
              LAUNCH FULL-SCREEN REGISTER
            </button>
          </div>

          {/* Quick Info & Register Status Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', marginBottom: '6px' }}>
                TOTAL WALK-IN BILLS RECORDED
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#065935' }}>
                {posStats.totalCount}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Cash: <strong>{posStats.cashCount}</strong> &bull; UPI/Card: <strong>{posStats.upiCount}</strong>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', marginBottom: '6px' }}>
                TOTAL WALK-IN SALES AMOUNT
              </div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a' }}>
                ₹{posStats.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '12px', color: '#065935', fontWeight: 700, marginTop: '2px' }}>
                Active Register Revenue
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', marginBottom: '6px' }}>
                REGISTER LOCATION &amp; CONTACT
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                {storeSettings?.store_name || 'NP Grand Shopping'}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                {storeSettings?.address || 'Madambakkam Main Road, Chennai 600073'}
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.04em', marginBottom: '6px' }}>
                KEYBOARD SHORTCUTS
              </div>
              <div style={{ fontSize: '12px', color: '#1e293b', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <div><strong>[F2]</strong> Focus Scan</div>
                <div><strong>[F4]</strong> Complete Sale</div>
                <div><strong>[F9]</strong> Clear Cart</div>
                <div><strong>[ESC]</strong> Close Popup</div>
              </div>
            </div>
          </div>

          {/* SECTION: ALL WALK-IN & POS BILLS LIST */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 2px' }}>
                  RECENT WALK-IN &amp; POS BILLS ({walkinBills.length})
                </h2>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                  Active in-store sales billed through the POS counter register.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={loadPOSBills}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={openPOS}
                  style={{
                    background: '#065935',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '7px 16px',
                    fontSize: '12.5px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  + New Bill
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Loading walk-in bills...
              </div>
            ) : walkinBills.length === 0 ? (
              <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                  No Walk-in Bills Yet
                </div>
                <div style={{ fontSize: '13px', marginBottom: '14px' }}>
                  Click <strong>New Bill</strong> or <strong>Launch Full-Screen Register</strong> above to bill walk-in customers.
                </div>
                <button
                  type="button"
                  onClick={openPOS}
                  style={{
                    background: '#065935',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Start Billing
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 800, textAlign: 'left' }}>
                      <th style={{ padding: '12px 16px' }}>RECEIPT / BILL #</th>
                      <th style={{ padding: '12px 16px' }}>DATE &amp; TIME</th>
                      <th style={{ padding: '12px 16px' }}>CUSTOMER</th>
                      <th style={{ padding: '12px 16px' }}>ITEMS SUMMARY</th>
                      <th style={{ padding: '12px 16px' }}>PAYMENT</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>TOTAL (₹)</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walkinBills.map((b, idx) => (
                      <tr
                        key={b.id || idx}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: idx % 2 === 0 ? '#ffffff' : '#fcfcfc'
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#065935', fontSize: '13px' }}>
                            {b.order_number}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                          {new Date(b.created_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a' }}>{b.customer_name}</div>
                          {b.customer_phone && (
                            <div style={{ fontSize: '11px', color: '#065935', fontWeight: 700 }}>
                              {b.customer_phone}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: '12px', color: '#1e293b' }}>
                            <strong>{(b.items || []).length} item(s)</strong>
                            <div style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                              {(b.items || []).map(i => `${i.quantity}x ${i.product_name}`).join(', ')}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800, background: '#f1f5f9', color: '#1e293b' }}>
                            {(b.payment_method || 'Cash').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, fontSize: '13.5px', color: '#065935' }}>
                          ₹{Number(b.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              type="button"
                              onClick={() => openPOS(b)}
                              style={{
                                background: '#fffbeb',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                borderRadius: '6px',
                                padding: '6px 9px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                              }}
                              title="Edit Bill in POS Popup"
                            >
                              <Icon name="edit" size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => printThermalReceipt(b)}
                              style={{
                                background: '#ecfdf5',
                                color: '#065935',
                                border: '1px solid #a7f3d0',
                                borderRadius: '6px',
                                padding: '6px 9px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                              }}
                              title="Print Thermal Receipt"
                            >
                              <Icon name="printer" size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSendWhatsApp(b)}
                              style={{
                                background: '#f0fdf4',
                                color: '#16a34a',
                                border: '1px solid #bbf7d0',
                                borderRadius: '6px',
                                padding: '6px 9px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                              }}
                              title="Send Bill via WhatsApp"
                            >
                              <Icon name="whatsapp" size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedBill(b)}
                              style={{
                                background: '#f8fafc',
                                color: '#334155',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '6px 9px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                              }}
                              title="View Bill Details"
                            >
                              <Icon name="eye" size={14} />
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
        </div>
      </div>

      {/* Bill Details Modal */}
      <Modal
        isOpen={!!selectedBill}
        onClose={() => setSelectedBill(null)}
        title={`Walk-in Bill: ${selectedBill?.order_number}`}
        maxWidth="600px"
      >
        {selectedBill && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div>
                <span style={{ background: '#ecfdf5', color: '#065935', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>
                  WALK-IN POS BILL
                </span>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Date: {new Date(selectedBill.created_at).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#64748b' }}>TOTAL BILLED</div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: '#065935' }}>
                  ₹{Number(selectedBill.total_amount).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div>Customer: <strong>{selectedBill.customer_name}</strong></div>
              <div>Phone: <strong>{selectedBill.customer_phone || 'Walk-in'}</strong></div>
              <div>Payment Mode: <strong>{(selectedBill.payment_method || 'Cash').toUpperCase()}</strong></div>
            </div>

            <h4 style={{ fontSize: '13px', fontWeight: 800, margin: '0 0 10px' }}>Items</h4>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '16px', maxHeight: '200px', overflowY: 'auto' }}>
              {(selectedBill.items || []).map((it, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '12.5px' }}>{it.quantity}x {it.product_name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>Code: {it.sku || it.barcode || 'N/A'}</div>
                  </div>
                  <strong style={{ fontSize: '13px' }}>₹{Number(it.total || (it.quantity * it.price)).toFixed(2)}</strong>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={() => printThermalReceipt(selectedBill)}
                style={{ background: '#065935', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
              >
                Print Thermal Receipt
              </button>
              <button
                type="button"
                onClick={() => handleSendWhatsApp(selectedBill)}
                style={{ background: '#25D366', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '8px 14px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
              >
                Send WhatsApp Bill
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-outline"
                onClick={() => setSelectedBill(null)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
