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
  const mrpValue = firstNonEmpty(item?.mrp, item?.variant_mrp, item?.catalog_mrp, item?.price, item?.sale_price);
  const sellingPriceValue = firstNonEmpty(item?.sale_price, item?.variant_sale_price, item?.price, item?.variant_price, item?.item_price);
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

  // Arrival code: strictly only if entered in the field
  const rawAlias = firstNonEmpty(
    item?.purchase_rate_alias,
    item?.rate_alias,
    item?.alias,
    options?.arrivalCode
  );
  const arrivalCode = rawAlias ? String(rawAlias).trim() : '';
  const hasArrivalCode = Boolean(arrivalCode);

  const categoryStr = [
    item?.category_name,
    item?.category_slug,
    item?.category,
    options?.category_name,
    options?.category_slug,
    options?.category
  ].filter(Boolean).join(' ');

  const isFootwear = /footwear|shoe|chappal|sandal|slipper|boot|croc|heel|flat|loafer|sneaker/i.test(categoryStr);

  const rawSize = firstNonEmpty(
    item?.size_name,
    item?.size,
    item?.variant_size,
    item?.chosen_size
  );

  let size = '';
  if (rawSize) {
    const sStr = String(rawSize).trim();
    if (!/^(standard|one\s*size|free\s*size|default|none|n\/?a)$/i.test(sStr)) {
      size = sStr;
    }
  }

  // Fallback: extract size from variant_info if footwear
  if (!size && item?.variant_info && isFootwear) {
    const parts = String(item.variant_info).split(/[\/,|]/);
    for (const p of parts) {
      const trimmed = p.trim();
      const m = trimmed.match(/(?:size[:\s]*|sz[:\s]*|^)([0-9]{1,2}(?:\.[0-9])?|[0-9]{1,2}\s*(?:uk|us|ind|eu)?|(?:uk|us|ind|eu)\s*[0-9]{1,2})/i);
      if (m && m[1]) {
        size = m[1].toUpperCase();
        break;
      }
    }
  }

  return {
    mrp: formatLabelMoney(mrpValue, '—'),
    sellingPrice: '',
    rate: showPurchaseRate ? rate : '',
    sequence,
    productName: productName ? String(productName).trim() : '',
    arrivalCode,
    hasArrivalCode,
    isFootwear,
    size
  };
}

export function renderNormalSticker(item, options = {}) {
  const label = getLabelDetails(item, options);
  // Only show arrival code if entered — never fall back to product name
  const arrivalHtml = label.hasArrivalCode
    ? `<span class="pname-text" title="${label.arrivalCode}">${label.arrivalCode.length > 24 ? label.arrivalCode.slice(0, 24) : label.arrivalCode}</span>`
    : '<span class="pname-text"></span>';
  const logoSpaceMm = options.topLogoOffsetMm !== undefined ? options.topLogoOffsetMm : 4.8;
  const logoSpaceHtml = logoSpaceMm > 0 ? `<div class="logo-space" style="height:${logoSpaceMm}mm;"></div>` : '';
  const storeNameHtml = options.showStoreName ? `<div class="store-name">${options.storeName || 'NP Grand'}</div>` : '';
  const svgHtml = getCleanBarcodeSVG(item, { height: 22, quietZone: 12 });

  const sizeBadgeHtml = (label.isFootwear && label.size)
    ? `<span class="size-badge">SZ: ${label.size}</span>`
    : '';
  const priceDisplayHtml = `<span class="mrp-label">MRP </span>₹${label.mrp}${sizeBadgeHtml}`;

  return `
    <div class="barcode-sticker">
      ${storeNameHtml || logoSpaceHtml}
      <div class="barcode-svg-container">${svgHtml}</div>
      <div class="info-row"><span class="code-text">${item.barcode || 'NO BARCODE'}</span>${arrivalHtml}</div>
      <div class="mrp-text">${priceDisplayHtml}</div>
    </div>
  `;
}

export function renderJewellerySticker(item, options = {}) {
  const label = getLabelDetails(item, options);
  const barcodeText = item.barcode || 'NO BARCODE';

  // Use Code 128 Barcode SVG (replaces QR code)
  const barcodeSvg = item._barcodeSvg || '';

  // Arrival code line (e.g. CW2) — strictly only if entered in field entry
  const arrivalHtml = label.hasArrivalCode
    ? `<div class="jewel-arrival">${label.arrivalCode}</div>`
    : '';

  // Footwear size badge (strictly only for footwear category)
  const sizeBadge = (label.isFootwear && label.size)
    ? ` • SZ: ${label.size}`
    : '';

  return `
    <div class="jewel-sticker-wrapper">
      <div class="jewel-sticker">
        <!-- FLAP 1: Front Face (~25mm x 12mm) — Arrival Code (if entered) + Centered Barcode -->
        <div class="jewel-flap jewel-flap-1">
          ${arrivalHtml}
          <div class="jewel-qr-box">${barcodeSvg}</div>
        </div>

        <!-- FLAP 2: Back Face (~25mm x 12mm) — Centered Fold Arrow + MRP + Barcode Number (with footwear size if applicable) -->
        <div class="jewel-flap jewel-flap-2">
          <div class="jewel-mrp-row">
            <span class="jewel-mrp-val">MRP:${label.mrp}</span>
          </div>
          <div class="jewel-barcode-num">${barcodeText}${sizeBadge}</div>
        </div>

        <!-- TAIL: 3mm Blank Stem (~30mm) -->
        <div class="jewel-tail-zone"></div>
      </div>
    </div>
  `;
}

export async function buildStickerPrintHtml(items, copiesPerItem = 1, options = {}) {
  const list = Array.isArray(items) ? items.filter(Boolean) : (items ? [items] : []);
  const stickerType = options.stickerType || options.type || 'normal_35x25';
  const isJewellery = stickerType === 'jewellery_80x12' || stickerType === 'jewellery';

  // For jewellery tags, generate Code 128 Barcode SVGs and attach to items
  if (isJewellery) {
    for (const item of list) {
      const code = item.barcode || item.code || 'NP-0000';
      try {
        item._barcodeSvg = generateCode128SVG(code, {
          height: 8.8,
          quietZone: 1.5
        });
      } catch (e) {
        item._barcodeSvg = '';
      }
    }
  }

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
    margin: 0 !important;
  }
  * {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: 80mm !important;
    height: 12mm !important;
    overflow: hidden !important;
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
    break-inside: avoid;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    box-sizing: border-box;
    background: #ffffff;
    color: #000000 !important;
    margin: 0;
  }
  .jewel-sticker-wrapper:not(:last-child) {
    page-break-after: always;
    break-after: page;
  }
  .jewel-sticker {
    width: 80mm;
    height: 12mm;
    min-height: 12mm;
    max-height: 12mm;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-start;
    box-sizing: border-box;
    overflow: hidden;
    margin: 0;
  }
  /* FLAP 1: Front Face (~25mm x 12mm) — Arrival Code (if entered) + Centered QR Code */
  .jewel-flap-1 {
    width: 25mm;
    height: 12mm;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 0 1mm;
    gap: 1.2mm;
    overflow: hidden;
    text-align: center;
  }
  .jewel-arrival {
    font-size: 6.5pt;
    font-weight: 900;
    line-height: 1.1;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: clip;
    text-align: center;
  }
  .jewel-qr-box {
    width: 8.8mm;
    height: 8.8mm;
    min-width: 8.8mm;
    min-height: 8.8mm;
    max-width: 8.8mm;
    max-height: 8.8mm;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff !important;
    overflow: hidden;
    flex-shrink: 0;
  }
  .jewel-qr-box svg {
    width: 100% !important;
    height: 100% !important;
    display: block;
    background: #ffffff !important;
    shape-rendering: crispEdges;
  }
  .jewel-qr-box svg path {
    shape-rendering: crispEdges !important;
  }

  /* FLAP 2: Back Face (~25mm x 12mm) — Centered ◄ MRP:XXX + Barcode Number */
  .jewel-flap-2 {
    width: 25mm;
    height: 12mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    box-sizing: border-box;
    padding: 0 1mm;
    gap: 0.6mm;
    overflow: hidden;
    text-align: center;
  }
  .jewel-mrp-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.8mm;
    white-space: nowrap;
    line-height: 1;
  }
  .jewel-arrow {
    font-size: 6pt;
    font-weight: 900;
    line-height: 1;
  }
  .jewel-mrp-val {
    font-size: 8pt;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.2px;
  }
  .jewel-barcode-num {
    font-size: 6pt;
    font-weight: 800;
    font-family: Arial, sans-serif;
    letter-spacing: 0.2px;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: clip;
    text-align: center;
  }

  /* Rat-Tail Stem: ~30mm x 3mm (Blank) */
  .jewel-tail-zone {
    width: 30mm;
    height: 3mm;
    background: transparent;
    box-sizing: border-box;
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
    size: 110mm 25mm;
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
    width: 110mm;
  }
  .sticker-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm;
    padding: 0 0.5mm;
    margin: 0 auto;
    width: 110mm;
  }
  .barcode-sticker {
    width: 35mm;
    height: 25mm;
    border: none;
    padding: 0 1.2mm;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
    page-break-inside: avoid;
    overflow: hidden;
    color: #000000 !important;
    background: #ffffff !important;
  }
  .logo-space {
    width: 100%;
    height: 4.8mm;
    flex-shrink: 0;
    background: transparent !important;
  }
  .store-name {
    font-size: 7.5pt;
    font-weight: 900;
    letter-spacing: 0.3px;
    color: #000000 !important;
  }
  .barcode-svg-container {
    width: 32mm;
    height: 6.5mm;
    margin-top: 0.6mm;
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
    padding: 0 0.2mm;
    margin-top: 0.6mm;
    line-height: 1;
    color: #000000 !important;
  }
  .code-text {
    font-size: 5.5pt;
    font-weight: 700;
    font-family: monospace;
    letter-spacing: 0.2px;
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #000000 !important;
  }
  .pname-text {
    font-size: 5.8pt;
    font-weight: 700;
    font-family: Arial, Helvetica, sans-serif;
    letter-spacing: 0.1px;
    line-height: 1;
    max-width: 50%;
    text-align: right;
    overflow: hidden;
    text-overflow: clip;
    white-space: nowrap;
    color: #000000 !important;
  }
  .mrp-text {
    width: 100%;
    font-size: 10pt;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.2px;
    margin-top: 0.8mm;
    white-space: nowrap;
    color: #000000 !important;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2mm;
  }
  .mrp-text .mrp-label {
    font-size: 6.5pt;
    font-weight: 900;
    letter-spacing: 0;
  }
  .size-badge {
    font-size: 8pt;
    font-weight: 900;
    border: 0.8px solid #000000;
    padding: 0.2mm 1.2mm;
    border-radius: 0.5mm;
    letter-spacing: 0.2px;
    line-height: 1;
    display: inline-block;
  }
</style>
</head>
<body>
  <div class="sticker-grid">${stickers}</div>
</body>
</html>
  `;
}

export async function printBarcodeLabels(items, copiesPerItem = 1, options = {}) {
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

  const html = await buildStickerPrintHtml(list, copiesPerItem, options);
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
