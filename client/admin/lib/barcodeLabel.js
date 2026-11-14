function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
}

export function formatLabelMoney(value, fallback = '') {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return num.toLocaleString('en-IN');
}

export function getLabelDetails(item, options = {}) {
  const showPurchaseRate = options.showPurchaseRate !== false;
  const mrpValue = firstNonEmpty(item?.mrp, item?.price, item?.sale_price);
  const aliasValue = firstNonEmpty(
    item?.purchase_rate_alias,
    item?.rate_alias,
    item?.alias
  );
  const rateValue = firstNonEmpty(
    aliasValue,
    item?.purchased_rate,
    item?.purchase_rate,
    item?.purchase_price,
    item?.rate_value
  );
  const sequence = item?.barcode_sequence !== null && item?.barcode_sequence !== undefined
    ? String(item.barcode_sequence).padStart(6, '0')
    : '';

  let rate = '';
  if (aliasValue) {
    rate = String(aliasValue).trim();
  } else if (rateValue !== null && rateValue !== undefined && rateValue !== '') {
    rate = Number.isFinite(Number(rateValue)) ? `₹${formatLabelMoney(rateValue)}` : String(rateValue);
  }

  return {
    mrp: formatLabelMoney(mrpValue, '—'),
    rate: showPurchaseRate ? rate : '',
    sequence
  };
}

function renderSticker(item, options) {
  const label = getLabelDetails(item, options);
  const rateLabel = options.purchaseRateLabel ? `${options.purchaseRateLabel} ` : '';
  const rateHtml = label.rate
    ? `<span class="rate-text">${rateLabel}${label.rate}</span>`
    : '<span class="rate-text"></span>';
  const sequenceHtml = label.sequence ? ` <span class="seq-text">#${label.sequence}</span>` : '';

  return `
    <div class="barcode-sticker">
      <div class="store-name">${options.storeName || 'NP Grand'}</div>
      <div class="barcode-svg-container">${item.svg || ''}</div>
      <div class="info-row"><span class="code-text">${item.barcode || 'NO BARCODE'}${sequenceHtml}</span>${rateHtml}</div>
      <div class="mrp-text"><span class="mrp-label">MRP </span>₹${label.mrp}</div>
    </div>
  `;
}

export function buildStickerPrintHtml(items, copiesPerItem = 1, options = {}) {
  const list = Array.isArray(items) ? items.filter(Boolean) : (items ? [items] : []);
  const stickers = list.map(item => {
    const requested = parseInt(item?.copies ?? copiesPerItem, 10);
    const copies = Math.max(1, Number.isFinite(requested) ? requested : 1);
    return Array.from({ length: copies }).map(() => renderSticker(item, options)).join('');
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${options.title || 'Barcode Stickers'}</title>
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
    letter-spacing: 0.2px;
    color: #000000 !important;
  }
  .barcode-svg-container {
    width: 28mm;
    height: 9mm;
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
  .info-row {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1mm;
    padding: 0 0.5mm;
    line-height: 1;
    color: #000000 !important;
  }
  .code-text {
    font-size: 5.5pt;
    font-weight: 700;
    font-family: monospace;
    letter-spacing: 0.2px;
    max-width: 55%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #000000 !important;
  }
  .code-text .seq-text {
    font-size: 4.5pt;
    letter-spacing: 0;
  }
  .rate-text {
    font-size: 5.5pt;
    font-weight: 700;
    line-height: 1;
    max-width: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #000000 !important;
  }
  .mrp-text {
    font-size: 11pt;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.2px;
    white-space: nowrap;
    color: #000000 !important;
  }
  .mrp-text .mrp-label {
    font-size: 6.5pt;
    font-weight: 900;
    letter-spacing: 0;
  }
</style>
</head>
<body>
  <div class="sticker-grid">${stickers}</div>
</body>
</html>
  `;
}

export function printBarcodeLabels(items, copiesPerItem = 1, options = {}) {
  const list = Array.isArray(items) ? items.filter(Boolean) : (items ? [items] : []);
  if (list.length === 0) {
    if (typeof window !== 'undefined') window.alert('No barcodes to print.');
    return false;
  }
  if (typeof window === 'undefined') return false;

  const printWin = window.open('', '_blank', 'width=750,height=600');
  if (!printWin) {
    window.alert('Please allow pop-ups to print barcode labels.');
    return false;
  }

  const html = buildStickerPrintHtml(list, copiesPerItem, options);
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  setTimeout(() => {
    printWin.focus();
    printWin.print();
    printWin.close();
  }, 400);
  return true;
}
