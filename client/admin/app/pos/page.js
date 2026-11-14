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
    const orderNo = order.order_number || `POS-${order.id}`;

    // Read fixed thermal printer settings from localStorage
    let savedSettings = { paperWidth: '80mm', copies: 1, density: '300bol' };
    try {
      const stored = localStorage.getItem('np_thermal_settings');
      if (stored) savedSettings = { ...savedSettings, ...JSON.parse(stored) };
    } catch (e) {}

    const is58mm = savedSettings.paperWidth === '58mm';
    const bodyWidth = is58mm ? '52mm' : '72mm';
    const fontSize = is58mm ? '9.5px' : '11px';
    const is300Bol = savedSettings.density === '300bol';

    // Store details (Physical receipt sample exact details)
    const storeTitle = 'NP GRAND';
    const addrLine1 = 'Rajaji saalai,Opp to';
    const addrLine2 = 'kalaisangam,Theradi';
    const addrLine3 = 'Thiruvallur - 602001';
    const phoneStr = 'Mobile No : 9655858231';
    const gstStr = 'GST No : 33AJCPN5984H1ZZ';
    const webStr = 'Website : www.npgrandshopping.com';

    // Date & Time formatting (DD/MM/YY & hh:mm A)
    const orderDate = new Date(order.created_at || Date.now());
    const dd = String(orderDate.getDate()).padStart(2, '0');
    const mm = String(orderDate.getMonth() + 1).padStart(2, '0');
    const yy = String(orderDate.getFullYear()).slice(-2);
    const dateFormatted = `${dd}/${mm}/${yy}`;

    let hours = orderDate.getHours();
    const minutes = String(orderDate.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hh = String(hours).padStart(2, '0');
    const timeFormatted = `${hh}:${minutes} ${ampm}`;

    // Customer Name / Mobile
    const customerIdent = (order.customer_phone || order.customer_name || 'Walk-in').toUpperCase();

    // Line totals & Summary
    const totalQty = items.reduce((s, i) => s + Number(i.quantity || 1), 0);
    const totalItemsCount = items.length;
    const totalMrp = items.reduce((s, it) => s + (Number(it.mrp || it.regular_price || it.price || 0) * Number(it.quantity || 1)), 0);
    const totalGross = items.reduce((s, it) => s + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
    const billDiscount = Number(order.discount || order.discount_amount || 0);
    const netPayable = Math.max(0, Math.round(Number(order.total_amount || (totalGross - billDiscount))));
    const totalSavings = Math.max(0, totalMrp - netPayable);

    // GST Slabs breakdown (Dynamic slabs calculation)
    const gstMap = {};
    items.forEach(it => {
      let rate = 0;
      if (it.gst_rate !== undefined && it.gst_rate !== null && it.gst_rate !== '') {
        rate = Number(it.gst_rate);
      } else if (it.tax_rate !== undefined && it.tax_rate !== null && it.tax_rate !== '') {
        rate = Number(it.tax_rate);
      } else if (order.is_accountable === 0) {
        rate = 0;
      } else {
        rate = 18;
      }
      if (isNaN(rate)) rate = 0;
      const itQty = Number(it.quantity || 1);
      const itPrice = Number(it.price || 0);
      const itTotal = itQty * itPrice;

      if (!gstMap[rate]) {
        gstMap[rate] = { rate, gross: 0 };
      }
      gstMap[rate].gross += itTotal;
    });

    const slabRates = Object.keys(gstMap).map(Number).sort((a, b) => a - b);
    const slabBreakup = slabRates.length > 0 ? slabRates.map(rate => {
      const slab = gstMap[rate];
      const fraction = totalGross > 0 ? (slab.gross / totalGross) : 0;
      const slabDiscount = billDiscount * fraction;
      const slabNet = Math.max(0, slab.gross - slabDiscount);

      if (rate === 0) {
        return { rate: 0, sgst: 0, cgst: 0, taxable: slabNet };
      }
      const taxable = slabNet / (1 + (rate / 100));
      const totalTax = slabNet - taxable;
      const halfTax = totalTax / 2;
      return {
        rate,
        sgst: halfTax,
        cgst: halfTax,
        taxable
      };
    }) : [
      { rate: 0, sgst: 0, cgst: 0, taxable: netPayable }
    ];

    // Loyalty Points
    const loyaltyPts = order.customer_np_points !== undefined && order.customer_np_points !== null
      ? order.customer_np_points
      : (order.points_earned || '');

    const renderReceiptBody = (copyLabel) => `
      <div class="receipt-section">
        <div class="center">
          <div class="store-title">${storeTitle}</div>
          <div class="header-line">${addrLine1}</div>
          <div class="header-line">${addrLine2}</div>
          <div class="header-line">${addrLine3}</div>
          <div class="header-line">${phoneStr}</div>
          <div class="header-line">${gstStr}</div>
          <div class="header-line">${webStr}</div>
          <div class="divider"></div>
          <div class="doc-title">TAX INVOICE</div>
          ${copyLabel && savedSettings.copies === 2 ? `<div style="font-size: 9.5px; font-weight: 800; margin-top: 1px;">[ ${copyLabel} ]</div>` : ''}
        </div>

        <div class="divider"></div>
        <div class="meta-row">
          <div class="meta-left">NAME: ${customerIdent}</div>
          <div class="meta-right"><div>Bill No: ${orderNo}</div><div>Date   : ${dateFormatted}</div><div>Time   : ${timeFormatted}</div></div>
        </div>
        <div class="divider"></div>

        <table class="items-table">
          <thead>
            <tr>
              <th class="col-item">Particulars</th>
              <th class="col-qty">Qty</th>
              <th class="col-mrp">MRP</th>
              <th class="col-rate">Rate</th>
              <th class="col-amt">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(it => {
              const itName = (it.product_name || it.name || 'ITEM').toUpperCase();
              const itQty = Number(it.quantity || 1);
              const itMrp = Number(it.mrp || it.regular_price || it.price || 0);
              const itRate = Number(it.price || 0);
              const itAmount = itQty * itRate;
              return `
                <tr>
                  <td class="col-item">${itName}</td>
                  <td class="col-qty">${itQty}</td>
                  <td class="col-mrp">${itMrp.toFixed(2)}</td>
                  <td class="col-rate">${itRate.toFixed(2)}</td>
                  <td class="col-amt">${itAmount.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="divider"></div>
        <div class="summary-row">
          <div class="summary-left">
            <div>Tot Items: &nbsp;${totalItemsCount}</div>
            <div>Tot Qty: &nbsp;&nbsp;&nbsp;${totalQty}</div>
          </div>
          <div class="summary-right">
            <div class="flex-line"><span>Total MRP :</span><span>${totalMrp.toFixed(2)}</span></div>
            ${billDiscount > 0 ? `
              <div class="flex-line"><span>Bill Discount :</span><span>${billDiscount.toFixed(2)}</span></div>
            ` : ''}
            <div style="border-top: 1px dashed #000000; margin: 3px 0;"></div>
            <div class="flex-line net-amt"><span>Net Amt :</span><span>${netPayable.toFixed(2)}</span></div>
          </div>
        </div>

        <div class="divider"></div>
        <div class="savings-banner">
          YOU HAVE SAVED: &nbsp;${Math.max(0, Math.round(totalSavings))}
        </div>
        <div class="divider"></div>

        <table class="gst-table">
          <thead>
            <tr>
              <th class="gst-col-rate">GST %</th>
              <th class="gst-col-sgst">SGST AMT</th>
              <th class="gst-col-cgst">CGST AMT</th>
              <th class="gst-col-tax">TAXABLE AMT</th>
            </tr>
          </thead>
          <tbody>
            ${slabBreakup.map(s => `
              <tr>
                <td class="gst-col-rate">${s.rate}</td>
                <td class="gst-col-sgst">${s.sgst.toFixed(2)}</td>
                <td class="gst-col-cgst">${s.cgst.toFixed(2)}</td>
                <td class="gst-col-tax">${s.taxable.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="divider"></div>

        <div class="loyalty-row">
          Total Loyalty Points : ${loyaltyPts !== '' ? loyaltyPts : ''}
        </div>
        <div class="divider"></div>

        <div class="terms-footer">
          <div class="terms-title">TERMS & CONDITIONS</div>
          <div>Goods once sold can't be taken back</div>
          <div>***No Exchange***No Return***</div>
          <div class="divider"></div>
          <div class="thank-you">*** Thank for Shopping Visit Again ***</div>
        </div>
      </div>
    `;

    const printHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>POS Receipt - ${orderNo}</title>
<style>
  @page {
    size: ${is58mm ? '58mm' : '80mm'} auto;
    margin: 0;
  }
  * {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    border-color: #000000 !important;
    box-sizing: border-box;
  }
  body {
    width: ${bodyWidth};
    margin: 0 auto;
    padding: 3mm 2mm;
    font-family: 'Courier New', Courier, monospace, 'Lucida Console';
    font-size: ${fontSize};
    line-height: 1.3;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-weight: 800;
    ${is300Bol ? 'text-shadow: 0 0 0.35px #000000; -webkit-font-smoothing: none;' : ''}
  }
  .receipt-section {
    page-break-inside: avoid;
  }
  .center { text-align: center; }
  .bold { font-weight: 900 !important; color: #000000 !important; }
  .store-title {
    font-size: ${is58mm ? '13px' : '15px'};
    font-weight: 900;
    letter-spacing: 0.5px;
    margin-bottom: 2px;
  }
  .header-line {
    font-size: ${is58mm ? '9px' : '10.5px'};
    line-height: 1.25;
  }
  .doc-title {
    font-size: ${is58mm ? '11px' : '12px'};
    font-weight: 900;
    letter-spacing: 0.5px;
    margin: 2px 0;
  }
  .divider {
    border-top: 1px dashed #000000 !important;
    margin: 4px 0;
  }
  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    font-size: ${fontSize};
    line-height: 1.35;
    margin: 2px 0;
  }
  .meta-left {
    text-align: left;
    max-width: 48%;
    word-break: break-word;
  }
  .meta-right {
    text-align: right;
    white-space: pre;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: ${is58mm ? '9px' : '10.5px'};
    margin: 2px 0;
  }
  .items-table th {
    border-bottom: 1px dashed #000000;
    padding: 3px 0;
    font-weight: 800;
  }
  .items-table td {
    padding: 2px 0;
    vertical-align: top;
  }
  .col-item {
    text-align: left;
    width: 28%;
    padding-left: 0 !important;
    padding-right: 2px !important;
    word-break: break-word;
    overflow-wrap: break-word;
  }
  .col-qty {
    text-align: right;
    width: 11%;
    white-space: nowrap;
    padding-left: 2px !important;
    padding-right: 4px !important;
  }
  .col-mrp {
    text-align: right;
    width: 19%;
    white-space: nowrap;
    padding-left: 2px !important;
    padding-right: 4px !important;
  }
  .col-rate {
    text-align: right;
    width: 19%;
    white-space: nowrap;
    padding-left: 2px !important;
    padding-right: 4px !important;
  }
  .col-amt {
    text-align: right;
    width: 23%;
    white-space: nowrap;
    padding-left: 4px !important;
    padding-right: 0 !important;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    font-size: ${fontSize};
    margin: 2px 0;
  }
  .summary-left {
    text-align: left;
    line-height: 1.4;
  }
  .summary-right {
    text-align: right;
    min-width: 55%;
    line-height: 1.4;
  }
  .flex-line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .net-amt {
    font-size: ${is58mm ? '12px' : '13.5px'};
    font-weight: 900;
  }
  .savings-banner {
    font-size: ${is58mm ? '11px' : '12px'};
    font-weight: 900;
    letter-spacing: 0.5px;
    margin: 3px 0;
  }
  .gst-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: ${is58mm ? '8.5px' : '9.5px'};
    margin: 2px 0;
  }
  .gst-table th {
    padding: 2px 0;
    font-weight: 800;
  }
  .gst-table td {
    padding: 2px 0;
  }
  .gst-col-rate {
    text-align: left;
    width: 18%;
    padding-left: 0 !important;
    padding-right: 2px !important;
  }
  .gst-col-sgst {
    text-align: right;
    width: 26%;
    white-space: nowrap;
    padding-left: 2px !important;
    padding-right: 3px !important;
  }
  .gst-col-cgst {
    text-align: right;
    width: 26%;
    white-space: nowrap;
    padding-left: 2px !important;
    padding-right: 3px !important;
  }
  .gst-col-tax {
    text-align: right;
    width: 30%;
    white-space: nowrap;
    padding-left: 3px !important;
    padding-right: 0 !important;
  }
  .loyalty-row {
    font-size: ${fontSize};
    font-weight: 800;
    margin: 3px 0;
  }
  .terms-footer {
    text-align: center;
    font-size: ${is58mm ? '9px' : '10px'};
    line-height: 1.35;
    margin-top: 4px;
  }
  .terms-title {
    font-weight: 900;
    letter-spacing: 0.5px;
  }
  .thank-you {
    font-weight: 900;
    margin-top: 2px;
  }
  .cut-divider {
    border-top: 2px dashed #000000 !important;
    margin: 16px 0;
    text-align: center;
  }
  .cut-divider span {
    background: #ffffff;
    padding: 0 6px;
    font-size: 9px;
    font-weight: 900;
    position: relative;
    top: -7px;
  }
</style>
</head>
<body>
  ${renderReceiptBody('CUSTOMER COPY')}
  ${savedSettings.copies === 2 ? `
    <div class="cut-divider"><span>--- CUT HERE / STORE COPY ---</span></div>
    ${renderReceiptBody('MERCHANT / STORE COPY')}
  ` : ''}
</body>
</html>
    `;

    const printWin = window.open('', '_blank', `width=${is58mm ? 400 : 500},height=650`);
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
      setTimeout(() => {
        printWin.focus();
        printWin.print();
        printWin.close();
      }, 400);
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
                {storeSettings?.address || 'Thiruvallur & Manali'}
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
