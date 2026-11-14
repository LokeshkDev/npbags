// Canonical ISO/IEC 15417 Code 128 Symbol Widths (Indices 0 to 106)
const CODE128_WIDTHS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

const CODE128_PATTERNS = CODE128_WIDTHS.map((w) => {
  let res = '';
  let isBar = true;
  for (const digit of w) {
    res += (isBar ? '1' : '0').repeat(parseInt(digit, 10));
    isBar = !isBar;
  }
  return res;
});

/**
 * Generates an ISO/IEC 15417 compliant Code 128B SVG barcode.
 * Includes a pure white background and crispEdges styling for instant hardware scanner recognition.
 */
export function generateCode128SVG(text, options = {}) {
  if (!text) return '';
  const clean = String(text).trim();
  const START_B = 104;
  const STOP = 106;

  let checkDigit = START_B;
  let encoding = CODE128_PATTERNS[START_B];

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const value = charCode - 32;
    if (value < 0 || value > 95) continue;
    encoding += CODE128_PATTERNS[value];
    checkDigit = (checkDigit + (i + 1) * value) % 103;
  }

  encoding += CODE128_PATTERNS[checkDigit];
  encoding += CODE128_PATTERNS[STOP];

  const height = options.height || 50;
  const quietZone = options.quietZone !== undefined ? options.quietZone : 12;
  const totalModules = encoding.length + (quietZone * 2);

  let rects = `<rect width="100%" height="100%" fill="#ffffff" />`;
  let currentX = quietZone;
  let inBar = false;
  let barStart = 0;

  for (let i = 0; i < encoding.length; i++) {
    if (encoding[i] === '1') {
      if (!inBar) {
        inBar = true;
        barStart = currentX;
      }
    } else {
      if (inBar) {
        const barW = currentX - barStart;
        rects += `<rect x="${barStart}" y="0" width="${barW}" height="${height}" fill="#000000" stroke="none" shape-rendering="crispEdges" />`;
        inBar = false;
      }
    }
    currentX += 1;
  }
  if (inBar) {
    const barW = currentX - barStart;
    rects += `<rect x="${barStart}" y="0" width="${barW}" height="${height}" fill="#000000" stroke="none" shape-rendering="crispEdges" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${height}" width="100%" height="100%" preserveAspectRatio="none" shape-rendering="crispEdges">${rects}</svg>`;
}

export function getCleanBarcodeSVG(item, options = {}) {
  if (item?.barcode) {
    return generateCode128SVG(item.barcode, options);
  }
  return item?.svg || '';
}

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

  const productName = firstNonEmpty(
    item?.product_name,
    item?.name,
    item?.title,
    item?.item_name,
    ''
  );

  return {
    mrp: formatLabelMoney(mrpValue, '—'),
    rate: showPurchaseRate ? rate : '',
    sequence,
    productName: productName ? String(productName).trim() : ''
  };
}

export function renderNormalSticker(item, options = {}) {
  const label = getLabelDetails(item, options);
  const rateLabel = options.purchaseRateLabel ? `${options.purchaseRateLabel} ` : '';
  const rateHtml = label.rate
    ? `<span class="rate-text">${rateLabel}${label.rate}</span>`
    : '<span class="rate-text"></span>';
  const sequenceHtml = label.sequence ? ` <span class="seq-text">#${label.sequence}</span>` : '';
  const storeNameHtml = options.showStoreName ? `<div class="store-name">${options.storeName || 'NP Grand'}</div>` : '';
  const svgHtml = getCleanBarcodeSVG(item, { height: 50, quietZone: 12 });

  return `
    <div class="barcode-sticker">
      ${storeNameHtml}
      <div class="barcode-svg-container">${svgHtml}</div>
      <div class="info-row"><span class="code-text">${item.barcode || 'NO BARCODE'}${sequenceHtml}</span>${rateHtml}</div>
      <div class="mrp-text"><span class="mrp-label">MRP </span>₹${label.mrp}</div>
    </div>
  `;
}

export function renderJewellerySticker(item, options = {}) {
  const label = getLabelDetails(item, options);
  const storeName = options.storeName || 'NP Grand';
  const sequenceHtml = label.sequence ? ` <span class="jewel-seq">#${label.sequence}</span>` : '';
  const rateHtml = label.rate ? `<div class="jewel-rate-row">${label.rate}</div>` : '';
  const rawName = label.productName || item.barcode || 'JEWELLERY';
  const cleanName = rawName.length > 22 ? rawName.slice(0, 20) + '..' : rawName;
  const svgHtml = getCleanBarcodeSVG(item, { height: 42, quietZone: 10 });

  return `
    <div class="jewel-sticker-wrapper">
      <div class="jewel-sticker">
        <!-- LEFT FLAP (30mm x 12mm) - Front Face of Tag (Barcode) -->
        <div class="jewel-flap jewel-flap-left">
          <div class="jewel-store">${storeName}</div>
          <div class="jewel-barcode-svg">${svgHtml}</div>
          <div class="jewel-code">${item.barcode || 'NO BARCODE'}${sequenceHtml}</div>
        </div>

        <!-- CENTER TAIL (20mm x 3mm) - Narrow Bridge Loops through Jewellery -->
        <div class="jewel-tail-zone">
          <div class="jewel-tail-bridge"></div>
        </div>

        <!-- RIGHT FLAP (30mm x 12mm) - Reverse Face of Tag (Details & Price) -->
        <div class="jewel-flap jewel-flap-right">
          <div class="jewel-pname" title="${label.productName || ''}">${cleanName}</div>
          ${rateHtml ? rateHtml : '<div style="height:5.5pt;"></div>'}
          <div class="jewel-mrp"><span class="jewel-mrp-lbl">MRP </span>₹${label.mrp}</div>
        </div>
      </div>
    </div>
  `;
}

export function buildStickerPrintHtml(items, copiesPerItem = 1, options = {}) {
  const list = Array.isArray(items) ? items.filter(Boolean) : (items ? [items] : []);
  const stickerType = options.stickerType || options.type || 'normal_35x25';
  const isJewellery = stickerType === 'jewellery_80x12' || stickerType === 'jewellery';

  const stickers = list.map(item => {
    const requested = parseInt(item?.copies ?? copiesPerItem, 10);
    const copies = Math.max(1, Number.isFinite(requested) ? requested : 1);
    const renderFn = isJewellery ? renderJewellerySticker : renderNormalSticker;
    return Array.from({ length: copies }).map(() => renderFn(item, options)).join('');
  }).join('');

  if (isJewellery) {
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${options.title || 'Jewellery Barcode Tags (80x12mm)'}</title>
<style>
  @page {
    size: 80mm 12mm;
    margin: 0;
  }
  * {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
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
  .jewel-sticker-list {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0;
    margin: 0;
  }
  .jewel-sticker-wrapper {
    width: 80mm;
    height: 12mm;
    min-height: 12mm;
    max-height: 12mm;
    page-break-inside: avoid;
    page-break-after: always;
    break-inside: avoid;
    break-after: page;
    display: flex;
    align-items: center;
    justify-content: space-between;
    overflow: hidden;
    box-sizing: border-box;
    background: #ffffff;
    color: #000000 !important;
  }
  .jewel-sticker {
    width: 80mm;
    height: 12mm;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    box-sizing: border-box;
    overflow: hidden;
  }
  .jewel-flap {
    width: 30mm;
    height: 11.5mm;
    max-height: 11.5mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-sizing: border-box;
    overflow: hidden;
    padding: 0.6mm 0.8mm;
    color: #000000 !important;
  }
  .jewel-flap-left {
    text-align: center;
    align-items: center;
    border: 0.35px solid #000000;
    border-radius: 0.8mm;
  }
  .jewel-flap-right {
    text-align: right;
    align-items: flex-end;
    border: 0.35px solid #000000;
    border-radius: 0.8mm;
  }
  .jewel-store {
    font-size: 6pt;
    font-weight: 900;
    line-height: 1;
    letter-spacing: 0.2px;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .jewel-barcode-svg {
    width: 27mm;
    height: 5.2mm;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff !important;
    overflow: hidden;
  }
  .jewel-barcode-svg svg {
    width: 100% !important;
    height: 100% !important;
    display: block;
    background: #ffffff !important;
  }
  .jewel-barcode-svg svg rect {
    stroke: none !important;
    stroke-width: 0 !important;
    shape-rendering: crispEdges !important;
  }
  .jewel-code {
    font-size: 5pt;
    font-weight: 700;
    font-family: monospace;
    line-height: 1;
    letter-spacing: 0.1px;
    white-space: nowrap;
  }
  .jewel-code .jewel-seq {
    font-size: 4.2pt;
  }
  .jewel-tail-zone {
    width: 20mm;
    height: 12mm;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }
  .jewel-tail-bridge {
    width: 20mm;
    height: 3mm;
    border-top: 0.5px dashed #444444;
    border-bottom: 0.5px dashed #444444;
    background: transparent;
    box-sizing: border-box;
  }
  .jewel-pname {
    font-size: 5.5pt;
    font-weight: 800;
    line-height: 1.1;
    text-transform: uppercase;
    max-width: 28mm;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .jewel-rate-row {
    font-size: 5.5pt;
    font-weight: 800;
    line-height: 1;
    color: #000000 !important;
    max-width: 28mm;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .jewel-mrp {
    font-size: 8.5pt;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.2px;
    white-space: nowrap;
  }
  .jewel-mrp .jewel-mrp-lbl {
    font-size: 5.5pt;
    font-weight: 800;
  }
</style>
</head>
<body>
  <div class="jewel-sticker-list">${stickers}</div>
</body>
</html>
    `;
  }

  // Normal 35x25mm (3-in-a-row / 3-Up roll) — TSC thermal barcode printer
  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${options.title || 'Barcode Stickers (35x25mm)'}</title>
<style>
  @page {
    size: 105mm 25mm;
    margin: 0;
  }
  * {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
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
    width: 105mm;
  }
  .sticker-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    padding: 0;
    margin: 0;
    width: 105mm;
  }
  .barcode-sticker {
    width: 35mm;
    height: 25mm;
    border: none;
    padding: 1.2mm 1.5mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    page-break-inside: avoid;
    overflow: hidden;
    color: #000000 !important;
    background: #ffffff !important;
  }
  .store-name {
    font-size: 7.5pt;
    font-weight: 900;
    letter-spacing: 0.3px;
    color: #000000 !important;
  }
  .barcode-svg-container {
    width: 32mm;
    height: 13.5mm;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff !important;
  }
  .barcode-svg-container svg {
    width: 100% !important;
    height: 100% !important;
    display: block;
    background: #ffffff !important;
  }
  .barcode-svg-container svg rect {
    stroke: none !important;
    stroke-width: 0 !important;
    shape-rendering: crispEdges !important;
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

  const isJewellery = options.stickerType === 'jewellery_80x12' || options.stickerType === 'jewellery';
  const winWidth = isJewellery ? 700 : 750;
  const winHeight = isJewellery ? 500 : 600;

  const printWin = window.open('', '_blank', `width=${winWidth},height=${winHeight}`);
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
