'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { lookupBarcode, getAdminProducts, getProductBarcodes, generateProductBarcodes, getAdminAllBarcodes } from '../../lib/api';

export default function AdminBarcodesPage() {
  const [searchInput, setSearchInput] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Product selector for bulk barcode management
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productBarcodes, setProductBarcodes] = useState([]);
  const [loadingBarcodes, setLoadingBarcodes] = useState(false);
  const [generating, setGenerating] = useState(false);

  // All generated barcodes table state
  const [allGeneratedBarcodes, setAllGeneratedBarcodes] = useState([]);
  const [loadingAllBarcodes, setLoadingAllBarcodes] = useState(true);
  const [barcodesFilter, setBarcodesFilter] = useState('');

  // Multi-select for batch thermal printing
  const [selectedBarcodeIds, setSelectedBarcodeIds] = useState(new Set());
  const [batchCopiesModalOpen, setBatchCopiesModalOpen] = useState(false);
  const [batchCopiesInput, setBatchCopiesInput] = useState(3);

  // Sticker custom copies modal (single item)
  const [customPrintItem, setCustomPrintItem] = useState(null);
  const [customPrintCopies, setCustomPrintCopies] = useState(3);

  const searchInputRef = useRef(null);

  // Load products list for dropdown
  useEffect(() => {
    getAdminProducts({ limit: 100 })
      .then(res => {
        const list = res?.products || res || [];
        if (Array.isArray(list)) setProducts(list);
      })
      .catch(() => {});
  }, []);

  // Load all generated barcodes across all products
  const loadAllBarcodes = (search = '') => {
    setLoadingAllBarcodes(true);
    getAdminAllBarcodes({ search, limit: 150 })
      .then(res => {
        if (Array.isArray(res)) {
          setAllGeneratedBarcodes(res);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAllBarcodes(false));
  };

  useEffect(() => {
    loadAllBarcodes(barcodesFilter);
  }, [barcodesFilter]);

  // Barcode Lookup handler
  const handleLookup = async (codeToSearch) => {
    const code = (codeToSearch || searchInput).trim();
    if (!code) return;

    setLoadingLookup(true);
    setErrorMsg('');
    setLookupResult(null);

    try {
      const res = await lookupBarcode(code);
      if (res) {
        setLookupResult(res);
      } else {
        setErrorMsg(`No product or variant found matching barcode '${code}'`);
      }
    } catch (err) {
      setErrorMsg(err.message || `No item found matching barcode '${code}'`);
    } finally {
      setLoadingLookup(false);
    }
  };

  // When a product is selected in the dropdown
  useEffect(() => {
    if (!selectedProductId) {
      setProductBarcodes([]);
      return;
    }

    setLoadingBarcodes(true);
    getProductBarcodes(selectedProductId)
      .then(res => {
        if (Array.isArray(res)) setProductBarcodes(res);
      })
      .catch(err => alert(err.message || 'Error loading product barcodes'))
      .finally(() => setLoadingBarcodes(false));
  }, [selectedProductId]);

  // Generate barcodes for selected product
  const handleGenerate = async () => {
    if (!selectedProductId) return;
    setGenerating(true);
    try {
      const res = await generateProductBarcodes(selectedProductId);
      if (res && res.barcodes) {
        setProductBarcodes(res.barcodes);
      }
      loadAllBarcodes(barcodesFilter);
      alert('✓ Barcodes successfully generated and synchronized!');
    } catch (err) {
      alert(err.message || 'Error generating barcodes');
    } finally {
      setGenerating(false);
    }
  };

  // Toggle single barcode selection
  const toggleSelectBarcode = (id) => {
    setSelectedBarcodeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle select all barcodes in current table
  const toggleSelectAll = () => {
    if (selectedBarcodeIds.size === allGeneratedBarcodes.length && allGeneratedBarcodes.length > 0) {
      setSelectedBarcodeIds(new Set());
    } else {
      setSelectedBarcodeIds(new Set(allGeneratedBarcodes.map(b => b.id)));
    }
  };

  // Clear barcode selection
  const clearSelection = () => {
    setSelectedBarcodeIds(new Set());
  };

  // Open thermal sticker print dialog (Standard 33x24mm 3-up roll) - Full Solid Pure Black #000000
  const printStickers = (barcodeItem, copies = 3) => {
    const printHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Print Barcode Stickers - ${barcodeItem.barcode}</title>
<style>
  @page {
    size: 105mm 25mm;
    margin: 0;
  }
  * {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    box-sizing: border-box;
  }
  body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-weight: 700;
  }
  .sticker-row {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm;
    padding: 1mm 2mm;
  }
  .barcode-sticker {
    width: 32mm;
    height: 23mm;
    border: 0.5px solid #000000;
    padding: 1mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    page-break-inside: avoid;
    color: #000000 !important;
  }
  .store-name {
    font-size: 7.5pt;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.2px;
    color: #000000 !important;
  }
  .product-name {
    font-size: 6pt;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 30mm;
    color: #000000 !important;
  }
  .barcode-svg-container {
    width: 28mm;
    height: 10mm;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .barcode-svg-container svg {
    width: 100%;
    height: 100%;
    fill: #000000 !important;
    stroke: #000000 !important;
  }
  .code-text {
    font-size: 7.5pt;
    font-weight: 900;
    font-family: monospace;
    letter-spacing: 0.5px;
    color: #000000 !important;
  }
  .price-text {
    font-size: 7.5pt;
    font-weight: 900;
    color: #000000 !important;
  }
</style>
</head>
<body>
  <div class="sticker-row">
    ${Array.from({ length: copies }).map(() => `
      <div class="barcode-sticker">
        <div class="store-name">NP GRAND SHOPPING</div>
        <div class="product-name">${barcodeItem.product_name || barcodeItem.barcode_short_name || 'Handbag Collection'}</div>
        <div class="barcode-svg-container">${barcodeItem.svg || ''}</div>
        <div class="code-text">${barcodeItem.barcode}</div>
        <div class="price-text">MRP: ₹${Number(barcodeItem.price || barcodeItem.sale_price || 999).toLocaleString('en-IN')}</div>
      </div>
    `).join('')}
  </div>
</body>
</html>
    `;

    const printWin = window.open('', '_blank', 'width=600,height=400');
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

  // Batch Print Selected Barcode Stickers (Continuous Thermal Roll / 3-Up Sheet)
  const printBatchStickers = (itemsToPrint, copiesPerItem = 3) => {
    if (!itemsToPrint || itemsToPrint.length === 0) {
      alert('Please select at least one barcode sticker to print.');
      return;
    }

    const printHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Batch Barcode Print (${itemsToPrint.length} Items x ${copiesPerItem})</title>
<style>
  @page {
    size: 105mm auto;
    margin: 0;
  }
  * {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    box-sizing: border-box;
  }
  body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-weight: 700;
  }
  .sticker-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm;
    padding: 2mm;
  }
  .barcode-sticker {
    width: 32mm;
    height: 23mm;
    border: 0.5px solid #000000;
    padding: 1mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    page-break-inside: avoid;
    margin-bottom: 1.5mm;
    color: #000000 !important;
  }
  .store-name {
    font-size: 7.5pt;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.2px;
    color: #000000 !important;
  }
  .product-name {
    font-size: 6pt;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 30mm;
    color: #000000 !important;
  }
  .barcode-svg-container {
    width: 28mm;
    height: 10mm;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .barcode-svg-container svg {
    width: 100%;
    height: 100%;
    fill: #000000 !important;
    stroke: #000000 !important;
  }
  .code-text {
    font-size: 7.5pt;
    font-weight: 900;
    font-family: monospace;
    letter-spacing: 0.5px;
    color: #000000 !important;
  }
  .price-text {
    font-size: 7.5pt;
    font-weight: 900;
    color: #000000 !important;
  }
</style>
</head>
<body>
  <div class="sticker-grid">
    ${itemsToPrint.map(item =>
      Array.from({ length: copiesPerItem }).map(() => `
        <div class="barcode-sticker">
          <div class="store-name">NP GRAND SHOPPING</div>
          <div class="product-name">${item.product_name || item.barcode_short_name || 'Handbag Collection'}</div>
          <div class="barcode-svg-container">${item.svg || ''}</div>
          <div class="code-text">${item.barcode}</div>
          <div class="price-text">MRP: ₹${Number(item.price || item.sale_price || 999).toLocaleString('en-IN')}</div>
        </div>
      `).join('')
    ).join('')}
  </div>
</body>
</html>
    `;

    const printWin = window.open('', '_blank', 'width=750,height=600');
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

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Barcode Lookup & Labels" />
        <div className="admin-content">
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
              Barcode Lookup & Thermal Label Printing
            </h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
              Scan any <code style={{ color: '#065935', fontWeight: 700 }}>NP-XXXX</code> barcode, synchronize new barcodes, or print thermal stickers directly from the generated registry below.
            </p>
          </div>

          {/* Grid: 2 Columns (Left: Scanner Search / Right: Product Barcode Generator) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            {/* Card 1: Fast Scanner / Lookup Tool */}
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>QUICK BARCODE LOOKUP</span>
              </h2>

              <form
                onSubmit={(e) => { e.preventDefault(); handleLookup(); }}
                style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}
              >
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Scan or enter barcode (e.g. NP-1048)..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '14px',
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  type="submit"
                  disabled={loadingLookup}
                  style={{
                    background: '#065935',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    fontWeight: 700,
                    fontSize: '13.5px',
                    cursor: 'pointer'
                  }}
                >
                  {loadingLookup ? 'Searching...' : 'Lookup'}
                </button>
              </form>

              {errorMsg && (
                <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>
                  {errorMsg}
                </div>
              )}

              {/* Lookup Result Card */}
              {lookupResult && (
                <div style={{ background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '18px' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <img
                      src={lookupResult.image || '/assets/bestsellers/best-handbag.png'}
                      alt=""
                      style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', background: '#ffffff', border: '1px solid #e2e8f0' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>
                          {lookupResult.product_name}
                        </h3>
                        <span style={{ fontSize: '16px', fontWeight: 900, color: '#065935' }}>
                          ₹{lookupResult.price?.toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '8px 0' }}>
                        <span style={{ background: '#065935', color: '#ffffff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 700 }}>
                          {lookupResult.barcode}
                        </span>
                        <span style={{ background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                          HSN: {lookupResult.hsn_code}
                        </span>
                        {lookupResult.variant && (
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                            {lookupResult.variant.color || ''} {lookupResult.variant.size ? `· ${lookupResult.variant.size}` : ''}
                          </span>
                        )}
                        <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                          Stock: {lookupResult.stock_quantity} units
                        </span>
                      </div>

                      {/* Barcode Vector SVG Preview */}
                      {lookupResult.svg && (
                        <div style={{ margin: '10px 0 6px' }}>
                          <div
                            style={{ width: '140px', height: '42px', background: '#ffffff', padding: '4px 6px', borderRadius: '5px', border: '1px solid #cbd5e1' }}
                            dangerouslySetInnerHTML={{ __html: lookupResult.svg }}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <button
                          type="button"
                          onClick={() => printStickers(lookupResult, 3)}
                          style={{
                            background: '#065935',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Print 3x Stickers
                        </button>
                        <button
                          type="button"
                          onClick={() => printStickers(lookupResult, 1)}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Print 1x
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Product Barcode Sync & Single Generator */}
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b', margin: '0 0 16px' }}>
                SYNC PRODUCT BARCODES
              </h2>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '6px' }}>
                  Select a Product from Catalog:
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    background: '#ffffff',
                    color: '#0f172a'
                  }}
                >
                  <option value="">-- Choose a product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.id})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProductId && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                      Assigned Barcodes ({productBarcodes.length})
                    </span>
                    <button
                      type="button"
                      disabled={generating}
                      onClick={handleGenerate}
                      style={{
                        background: '#065935',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: generating ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {generating ? 'Generating...' : '+ Sync / Generate All Barcodes'}
                    </button>
                  </div>

                  {loadingBarcodes ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                      Loading product barcodes...
                    </div>
                  ) : productBarcodes.length === 0 ? (
                    <div style={{ padding: '30px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', color: '#94a3b8' }}>
                      <p style={{ margin: '0 0 10px', fontSize: '13px' }}>No barcodes generated yet for this product.</p>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        style={{ background: '#065935', color: '#ffffff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                      >
                        Generate Now (Primary + Variants)
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                      {productBarcodes.map((b) => (
                        <div
                          key={b.id}
                          style={{
                            padding: '10px 14px',
                            background: '#f8fafc',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '13px', color: '#065935' }}>
                                {b.barcode}
                              </span>
                              <span style={{ fontSize: '10px', background: b.is_primary ? '#eaf4ee' : '#e2e8f0', color: b.is_primary ? '#065935' : '#475569', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                {b.is_primary ? 'PRIMARY' : 'VARIANT'}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                              {b.color_name && <span style={{ marginRight: '6px' }}>{b.color_name}</span>}
                              {b.size_name && <span>{b.size_name}</span>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '90px', height: '32px' }} dangerouslySetInnerHTML={{ __html: b.svg }} />
                            <button
                              type="button"
                              onClick={() => {
                                const p = products.find(prod => prod.id === selectedProductId);
                                printStickers({
                                  ...b,
                                  product_name: p?.name,
                                  price: p?.sale_price || p?.price
                                }, 3);
                              }}
                              style={{
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Print
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SECTION: ALL GENERATED STORE BARCODES & PRINT COUNTER */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>
                  EXISTING GENERATED BARCODES ({allGeneratedBarcodes.length})
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Active Code 128 barcodes ready for thermal sticker printing.
                </p>
              </div>

              {/* Filter search bar & Select All Button */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Filter by product name, barcode, or SKU..."
                  value={barcodesFilter}
                  onChange={(e) => setBarcodesFilter(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1.5px solid #cbd5e1',
                    fontSize: '13px',
                    width: '280px'
                  }}
                />
                <button
                  type="button"
                  onClick={() => loadAllBarcodes(barcodesFilter)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: '#f1f5f9',
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
                  onClick={toggleSelectAll}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: selectedBarcodeIds.size === allGeneratedBarcodes.length && allGeneratedBarcodes.length > 0 ? '#065935' : '#ffffff',
                    color: selectedBarcodeIds.size === allGeneratedBarcodes.length && allGeneratedBarcodes.length > 0 ? '#ffffff' : '#0f172a',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {selectedBarcodeIds.size === allGeneratedBarcodes.length && allGeneratedBarcodes.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            {/* BATCH ACTION BAR (Visible when at least 1 barcode is selected) */}
            {selectedBarcodeIds.size > 0 && (
              <div
                style={{
                  background: '#f0fdf4',
                  borderBottom: '2px solid #86efac',
                  padding: '12px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      background: '#065935',
                      color: '#ffffff',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 800,
                      letterSpacing: '0.02em'
                    }}
                  >
                    {selectedBarcodeIds.size} SELECTED
                  </span>
                  <span style={{ fontSize: '13px', color: '#166534', fontWeight: 700 }}>
                    Ready for batch thermal printing
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const selectedItems = allGeneratedBarcodes.filter(b => selectedBarcodeIds.has(b.id));
                      printBatchStickers(selectedItems, 3);
                    }}
                    style={{
                      background: '#065935',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(6, 89, 53, 0.25)'
                    }}
                  >
                    PRINT SELECTED (3x EACH / 3-UP)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const selectedItems = allGeneratedBarcodes.filter(b => selectedBarcodeIds.has(b.id));
                      printBatchStickers(selectedItems, 1);
                    }}
                    style={{
                      background: '#ffffff',
                      color: '#0f172a',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    PRINT SELECTED (1x EACH)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBatchCopiesInput(3);
                      setBatchCopiesModalOpen(true);
                    }}
                    style={{
                      background: '#ffffff',
                      color: '#0f172a',
                      border: '1.5px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    CUSTOM COPIES BATCH...
                  </button>

                  <button
                    type="button"
                    onClick={clearSelection}
                    style={{
                      background: '#fee2e2',
                      color: '#991b1b',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer'
                    }}
                  >
                    CLEAR
                  </button>
                </div>
              </div>
            )}

            {loadingAllBarcodes ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Loading store barcodes...
              </div>
            ) : allGeneratedBarcodes.length === 0 ? (
              <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>No Barcodes Found</div>
                <div style={{ fontSize: '13px' }}>Select a product from above to generate primary and variant barcodes.</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '11px', fontWeight: 800, textAlign: 'left' }}>
                      <th style={{ padding: '12px 14px', width: '40px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={allGeneratedBarcodes.length > 0 && selectedBarcodeIds.size === allGeneratedBarcodes.length}
                          onChange={toggleSelectAll}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#065935' }}
                          title="Select all barcodes"
                        />
                      </th>
                      <th style={{ padding: '12px 18px' }}>BARCODE</th>
                      <th style={{ padding: '12px 18px' }}>PRODUCT NAME</th>
                      <th style={{ padding: '12px 18px' }}>TYPE &amp; SPECS</th>
                      <th style={{ padding: '12px 18px' }}>HSN</th>
                      <th style={{ padding: '12px 18px', textAlign: 'right' }}>PRICE</th>
                      <th style={{ padding: '12px 18px', textAlign: 'center' }}>LABEL PREVIEW</th>
                      <th style={{ padding: '12px 18px', textAlign: 'center' }}>PRINT ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allGeneratedBarcodes.map((b, idx) => {
                      const displayPrice = b.sale_price > 0 ? b.sale_price : b.price;
                      const isSelected = selectedBarcodeIds.has(b.id);
                      return (
                        <tr
                          key={b.id || idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isSelected ? '#f0fdf4' : idx % 2 === 0 ? '#ffffff' : '#fcfcfc'
                          }}
                        >
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectBarcode(b.id)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#065935' }}
                            />
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '14px', color: '#065935', letterSpacing: '0.04em' }}>
                              {b.barcode}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{b.product_name}</div>
                            {b.barcode_short_name && (
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                Short: {b.barcode_short_name}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span style={{ fontSize: '10.5px', background: b.is_primary ? '#ecfdf5' : '#e0f2fe', color: b.is_primary ? '#065935' : '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 800, display: 'inline-block', marginBottom: '4px' }}>
                              {b.is_primary ? 'PRIMARY' : 'VARIANT'}
                            </span>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                              {b.color_name && <span style={{ marginRight: '6px' }}>Color: {b.color_name}</span>}
                              {b.size_name && <span>Size: {b.size_name}</span>}
                              {b.sku && <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>SKU: {b.sku}</div>}
                            </div>
                          </td>
                          <td style={{ padding: '12px 18px', color: '#64748b', fontSize: '12px' }}>
                            {b.hsn_code || '4202'}
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                            ₹{Number(displayPrice).toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                            <div
                              style={{ width: '110px', height: '36px', margin: '0 auto' }}
                              dangerouslySetInnerHTML={{ __html: b.svg }}
                            />
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                onClick={() => printStickers(b, 3)}
                                style={{
                                  background: '#065935',
                                  color: '#ffffff',
                                  border: 'none',
                                  borderRadius: '5px',
                                  padding: '6px 12px',
                                  fontSize: '11.5px',
                                  fontWeight: 800,
                                  cursor: 'pointer'
                                }}
                                title="Print standard 3-up thermal label strip"
                              >
                                Print 3x
                              </button>
                              <button
                                type="button"
                                onClick={() => printStickers(b, 1)}
                                style={{
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  borderRadius: '5px',
                                  padding: '6px 10px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                                title="Print 1 sticker"
                              >
                                Print 1x
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomPrintItem(b);
                                  setCustomPrintCopies(6);
                                }}
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  color: '#475569',
                                  borderRadius: '5px',
                                  padding: '6px 10px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                                title="Choose custom number of copies"
                              >
                                Custom...
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Custom Copies Thermal Print Modal */}
      {customPrintItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)'
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
              Print Thermal Stickers
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
              {customPrintItem.product_name} <br />
              <strong style={{ color: '#065935' }}>{customPrintItem.barcode}</strong>
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                NUMBER OF STICKERS TO PRINT:
              </label>
              <input
                type="number"
                min="1"
                max="300"
                value={customPrintCopies}
                onChange={(e) => setCustomPrintCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '16px', fontWeight: 800 }}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {[3, 6, 9, 12, 24].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCustomPrintCopies(n)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: customPrintCopies === n ? '#065935' : '#f8fafc',
                      color: customPrintCopies === n ? '#ffffff' : '#334155',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setCustomPrintItem(null)}
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const it = customPrintItem;
                  const c = customPrintCopies;
                  setCustomPrintItem(null);
                  printStickers(it, c);
                }}
                style={{ padding: '8px 18px', borderRadius: '6px', background: '#065935', color: '#ffffff', border: 'none', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
              >
                Print {customPrintCopies} Stickers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Custom Copies Thermal Print Modal */}
      {batchCopiesModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)'
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
              Batch Thermal Sticker Printing
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px' }}>
              Printing for <strong style={{ color: '#065935' }}>{selectedBarcodeIds.size} selected items</strong>. Choose how many copies to print for each barcode on the continuous roll.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                COPIES PER SELECTED PRODUCT:
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={batchCopiesInput}
                onChange={(e) => setBatchCopiesInput(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1.5px solid #cbd5e1', fontSize: '16px', fontWeight: 800 }}
              />
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                {[1, 2, 3, 6, 9].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setBatchCopiesInput(n)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                      background: batchCopiesInput === n ? '#065935' : '#f8fafc',
                      color: batchCopiesInput === n ? '#ffffff' : '#334155',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {n}x each
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '8px' }}>
                Total labels generated: <strong>{selectedBarcodeIds.size * batchCopiesInput} stickers</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setBatchCopiesModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const selectedItems = allGeneratedBarcodes.filter(b => selectedBarcodeIds.has(b.id));
                  const copies = batchCopiesInput;
                  setBatchCopiesModalOpen(false);
                  printBatchStickers(selectedItems, copies);
                }}
                style={{ padding: '8px 18px', borderRadius: '6px', background: '#065935', color: '#ffffff', border: 'none', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}
              >
                Print {selectedBarcodeIds.size * batchCopiesInput} Total Stickers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
