// Canonical ISO/IEC 15417 Code 128 Symbol Widths (Indices 0 to 106)
import { getLabelSettings } from './labelSettings.js';

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
 * Generates an ISO/IEC 15417 compliant Code 128 Auto SVG barcode.
 * Uses Code Set C for digits to compress bar density by up to 40% for laser/CCD scanners.
 * Includes a pure white quiet-zone background and crispEdges styling for instant hardware scanner recognition.
 */
export function generateCode128SVG(text, options = {}) {
  if (!text) return '';
  const clean = String(text).trim();
  const tokens = [];

  // Code 128 Auto: Start with Code C (105) if beginning with 4+ digits, else Code B (104)
  const startsWith4Digits = /^\d{4,}/.test(clean);
  let mode = startsWith4Digits ? 'C' : 'B';
  tokens.push(mode === 'C' ? 105 : 104);

  let i = 0;
  while (i < clean.length) {
    if (mode === 'B') {
      const remainingDigitsMatch = clean.slice(i).match(/^\d{4,}/);
      if (remainingDigitsMatch) {
        mode = 'C';
        tokens.push(99); // Switch to Code C
        continue;
      }
      const charCode = clean.charCodeAt(i);
      const val = charCode - 32;
      if (val >= 0 && val <= 95) {
        tokens.push(val);
      }
      i++;
    } else {
      // Mode C: encode pairs of digits
      if (i + 1 < clean.length && /^\d{2}$/.test(clean.slice(i, i + 2))) {
        const val = parseInt(clean.slice(i, i + 2), 10);
        tokens.push(val);
        i += 2;
      } else {
        mode = 'B';
        tokens.push(100); // Switch to Code B
      }
    }
  }

  // Check digit calculation
  let check = tokens[0];
  for (let idx = 1; idx < tokens.length; idx++) {
    check = (check + idx * tokens[idx]) % 103;
  }
  tokens.push(check);
  tokens.push(106); // STOP

  let encoding = '';
  for (const token of tokens) {
    encoding += CODE128_PATTERNS[token];
  }

  const height = options.height || 50;
  const quietZone = options.quietZone !== undefined ? options.quietZone : 12;
  const totalModules = encoding.length + (quietZone * 2);

  let rects = `<rect width="${totalModules}" height="${height}" fill="#ffffff" />`;
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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModules} ${height}" width="100%" height="100%" shape-rendering="crispEdges">${rects}</svg>`;
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
    rate = Number.isFinite(Number(rateValue)) ? `&#8377;${formatLabelMoney(rateValue)}` : String(rateValue);
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
    sequence: String(sequence || ''),
    productName: productName ? String(productName).trim() : '',
    arrivalCode: arrivalCode ? String(arrivalCode).trim() : '',
    hasArrivalCode,
    isFootwear,
    size
  };
}

export function renderToySticker(item, options = {}) {
  const label = getLabelDetails(item, options);
  const barcodeText = item.barcode || 'NO BARCODE';
  const svgHtml = getCleanBarcodeSVG(item, { height: 22, quietZone: 12 });

  // Arrival code line (if any)
  const arrivalHtml = label.hasArrivalCode
    ? `<span class="pname-text" title="${label.arrivalCode}">${label.arrivalCode.length > 24 ? label.arrivalCode.slice(0, 24) : label.arrivalCode}</span>`
    : '<span class="pname-text"></span>';

  const priceDisplayHtml = `<span class="mrp-label">MRP </span>&#8377;${label.mrp}`;

  return `
    <div class="barcode-sticker">
      ${svgHtml}
      <div class="info-row">
        <span class="code-text">${barcodeText}</span>${arrivalHtml}
      </div>
      <div class="product-name" style="font-size:6.5pt;opacity:0.85;">${label.productName}</div>
      <div class="mrp-text">${priceDisplayHtml}</div>
    </div>
  `;
}

export function renderNormalSticker(item, options = {}) {
  const label = getLabelDetails(item, options);

  // Arrival Code (Purchase rate alias / code) parallel to barcode number in right column
  const rawArrivalCode = firstNonEmpty(
    label.arrivalCode,
    item?.purchase_rate_alias,
    item?.rate_alias,
    item?.alias,
    options?.arrivalCode,
    ''
  );
  const arrivalCodeText = rawArrivalCode ? String(rawArrivalCode).trim() : '';

  const rightColHtml = arrivalCodeText
    ? `<span class="variant-text" title="${arrivalCodeText}">${arrivalCodeText.length > 20 ? arrivalCodeText.slice(0, 20) : arrivalCodeText}</span>`
    : '<span class="variant-text"></span>';

  const svgHtml = getCleanBarcodeSVG(item, { height: 20, quietZone: 0 });

  const sizeBadgeHtml = (label.isFootwear && label.size && !arrivalCodeText.includes(label.size))
    ? `<span class="size-badge">SZ: ${label.size}</span>`
    : '';
  const priceDisplayHtml = `<span class="mrp-label">MRP </span>&#8377;${label.mrp}${sizeBadgeHtml}`;

  const productNameHtml = label.productName
    ? `<div class="product-name">${label.productName}</div>`
    : '';

  return `
    <div class="barcode-sticker">
      ${productNameHtml}
      <div class="barcode-bars-block">
        <div class="barcode-svg-container">${svgHtml}</div>
        <div class="info-row">
          <span class="code-text">${item.barcode || 'NO BARCODE'}</span>
          ${rightColHtml}
        </div>
      </div>
      <div class="mrp-text">${priceDisplayHtml}</div>
    </div>
  `;
}

export function renderJewellerySticker(item, options = {}) {
  const label = getLabelDetails(item, options);

  // 1D Code-128 barcode SVG
  const svgHtml = getCleanBarcodeSVG(item, { height: 26, quietZone: 8 });

  // Arrival code — only if explicitly entered
  const arrivalHtml = label.hasArrivalCode
    ? `<span class="jewel-arrival">${label.arrivalCode}</span>`
    : '';

  // Product name (truncated to fit)
  const nameHtml = label.productName
    ? `<span class="jewel-name">${label.productName.length > 14 ? label.productName.slice(0, 14) : label.productName}</span>`
    : '';

  const index = Number.isFinite(Number(options.index)) ? Number(options.index) : 0;
  const pitch = Number.isFinite(Number(options.pitchMm)) ? Number(options.pitchMm) : 12;
  const continuous = Boolean(options.continuous);
  const offsetY = Number.isFinite(Number(options.offsetY)) ? Number(options.offsetY) : 0;
  const offsetX = Number.isFinite(Number(options.offsetX)) ? Number(options.offsetX) : 0;

  const wrapperClass = continuous ? 'jewel-sticker-wrapper jewel-continuous' : 'jewel-sticker-wrapper';
  const wrapperStyle = continuous
    ? ` style="position:absolute; top:${(index * pitch + offsetY).toFixed(3)}mm; left:${offsetX.toFixed(3)}mm;"`
    : (offsetY !== 0 || offsetX !== 0 ? ` style="transform:translate(${offsetX}mm, ${offsetY}mm);"` : '');

  return `
    <div class="${wrapperClass}"${wrapperStyle}>
      <div class="jewel-sticker">
        <!-- LEFT FLAP: barcode graphic -->
        <div class="jewel-flap jewel-flap-1">
          <div class="jewel-barcode-box">${svgHtml}</div>
        </div>

        <!-- RIGHT FLAP: MRP + product name + arrival code -->
        <div class="jewel-flap jewel-flap-2">
          <div class="jewel-mrp-row">MRP:&#8377;${label.mrp}</div>
          <div class="jewel-info-row">
            ${nameHtml}${arrivalHtml ? `<span class="jewel-sep">&nbsp;</span>${arrivalHtml}` : ''}
          </div>
        </div>

        <!-- TAIL: blank folding stem -->
        <div class="jewel-tail-zone"></div>
      </div>
    </div>
  `;
}

export async function buildStickerPrintHtml(items, copiesPerItem = 1, options = {}) {
  const list = Array.isArray(items) ? items.filter(Boolean) : (items ? [items] : []);
  const stickerType = options.stickerType || options.type || 'normal_35x25';
  const isJewellery = stickerType === 'jewellery_80x12' || stickerType === 'jewellery';
  const isToy = stickerType === 'toy';
  const settings = getLabelSettings();
  const rawOffsetY = options.jewelOffsetY !== undefined ? Number(options.jewelOffsetY) : settings.offsetY;
  const rawOffsetX = options.jewelOffsetX !== undefined ? Number(options.jewelOffsetX) : settings.offsetX;
  const offsetY = Number.isFinite(rawOffsetY) ? Math.max(-6, Math.min(6, rawOffsetY)) : 0;
  const offsetX = Number.isFinite(rawOffsetX) ? Math.max(-6, Math.min(6, rawOffsetX)) : 0;

  const normalOffsetY = options.normalOffsetY !== undefined
    ? Number(options.normalOffsetY)
    : (settings.normalOffsetY !== undefined ? Number(settings.normalOffsetY) : 7.0);
  const normalOffsetX = options.normalOffsetX !== undefined
    ? Number(options.normalOffsetX)
    : (settings.normalOffsetX !== undefined ? Number(settings.normalOffsetX) : 0);

  const rawPitch = options.jewelPitchMm !== undefined ? options.jewelPitchMm : settings.pitchMm;
  const parsedPitch = Number(rawPitch);
  const jewelleryPageHeightMm = Number.isFinite(parsedPitch) && parsedPitch >= 12 && parsedPitch <= 30
    ? parsedPitch
    : 12.4;
  const continuous = options.jewelContinuous !== undefined
    ? Boolean(options.jewelContinuous)
    : Boolean(settings.continuous);

  let stickerIndex = 0;
  let totalStickers = 0;
  const stickerCards = [];

  list.forEach(item => {
    const requested = parseInt(item?.copies ?? copiesPerItem, 10);
    const copies = Math.max(1, Number.isFinite(requested) ? requested : 1);
    totalStickers += copies;
    const renderFn = (() => {
      if (isToy) return renderToySticker;
      if (isJewellery) return renderJewellerySticker;
      return renderNormalSticker;
    })();
    for (let c = 0; c < copies; c++) {
      const html = renderFn(item, {
        ...options,
        continuous,
        index: stickerIndex,
        pitchMm: jewelleryPageHeightMm,
        offsetY,
        offsetX
      });
      stickerCards.push(html);
      stickerIndex += 1;
    }
  });

  if (isJewellery) {
    const stickers = stickerCards.join('');
    const totalContinuousHeightMm = (totalStickers * jewelleryPageHeightMm).toFixed(2);
    const jewelleryPageSize = continuous ? `77.5mm ${totalContinuousHeightMm}mm` : `77.5mm ${jewelleryPageHeightMm}mm`;
    const listHeight = continuous ? `height:${totalContinuousHeightMm}mm; position:relative;` : '';

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${options.title || 'Jewellery Barcode Tags'}</title>
<style>
  @page {
    size: ${jewelleryPageSize};
    margin: 0mm;
  }
  @media print {
    @page { size: ${jewelleryPageSize}; margin: 0mm; }
    html, body { margin:0 !important; padding:0 !important; width:77.5mm !important; }
  }
  * { color:#000 !important; -webkit-text-fill-color:#000 !important; box-sizing:border-box; margin:0; padding:0; }
  html, body {
    margin:0 !important; padding:0 !important;
    width:77.5mm;
    font-family:Arial,Helvetica,sans-serif;
    background:#ffffff;
    -webkit-print-color-adjust:exact !important;
    print-color-adjust:exact !important;
    font-weight:700;
  }
  .jewel-sticker-list { display: block; width: 77.5mm; padding: 0; margin: 0; ${listHeight} }
  .jewel-sticker-wrapper {
    display:block;
    width:77.5mm;
    height:${jewelleryPageHeightMm}mm;
    max-height:${jewelleryPageHeightMm}mm;
    overflow:hidden;
    background:#ffffff;
    margin:0; padding:0;
    ${continuous ? '' : 'page-break-before:auto; page-break-inside:avoid; break-inside:avoid; page-break-after:always; break-after:page;'}
  }
  .jewel-sticker-wrapper:last-child {
    page-break-after:avoid;
    break-after:avoid;
  }
  .jewel-sticker {
    display:flex; flex-direction:row; align-items:stretch;
    width:77.5mm; height:12mm; overflow:hidden; margin:0; padding:0;
  }
  .jewel-flap-1 {
    flex:0 0 30mm; width:30mm; height:12mm;
    display:flex; align-items:center; justify-content:center;
    overflow:hidden; background:#ffffff; border-right:0.3mm solid #ccc;
  }
  .jewel-barcode-box { width:28mm; height:10mm; display:flex; align-items:center; justify-content:center; }
  .jewel-barcode-box svg { width:100% !important; height:100% !important; display:block; }
  .jewel-barcode-box svg rect { stroke:none !important; shape-rendering:crispEdges !important; }
  .jewel-flap-2 {
    flex:0 0 30mm; width:30mm; height:12mm;
    display:flex; flex-direction:column; align-items:flex-start; justify-content:center;
    padding:0 1.5mm; overflow:hidden; background:#ffffff;
  }
  .jewel-mrp-row { font-size:9pt; font-weight:900; line-height:1.1; white-space:nowrap; letter-spacing:-0.3px; }
  .jewel-info-row {
    font-size:6pt; font-weight:700; line-height:1.2; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis; max-width:100%; margin-top:0.5mm;
    display:flex; align-items:center; gap:1mm;
  }
  .jewel-name   { font-size:6pt; font-weight:700; }
  .jewel-arrival{ font-size:5.5pt; font-weight:700; opacity:0.8; }
  .jewel-tail-zone { flex:1 1 auto; height:12mm; background:#ffffff; }
</style>
</head>
<body>
<div class="${continuous ? 'jewel-sticker-list' : '' }">${stickers}</div>
</body>
</html>
`;
  }

  // Normal 35x25mm (3-in-a-row / 3-Up roll: 110mm width x 25mm height)
  const rows = [];
  for (let i = 0; i < stickerCards.length; i += 3) {
    rows.push(stickerCards.slice(i, i + 3));
  }

  const normalRowsHtml = rows.map((row, rowIdx) => {
    const isLast = rowIdx === rows.length - 1;
    const cards = row.join('');
    let placeholders = '';
    for (let p = row.length; p < 3; p++) {
      placeholders += '<div class="barcode-sticker barcode-sticker-placeholder" style="visibility:hidden;border:none;"></div>';
    }
    return `<div class="sticker-row${isLast ? ' last-row' : ''}">${cards}${placeholders}</div>`;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${options.title || 'Barcode Stickers (35x25mm)'}</title>
<style>
  @page {
    size: 110mm 25mm;
    margin: 0mm;
  }
  @media print {
    @page {
      size: 110mm 25mm;
      margin: 0mm;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 110mm !important;
    }
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
    width: 110mm;
    font-family: Arial, Helvetica, sans-serif;
    background: #ffffff;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    font-weight: 700;
  }
  .sticker-grid {
    display: block;
    width: 110mm;
    margin: 0 auto;
    padding: 0;
  }
  .sticker-row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: flex-start;
    width: 110mm;
    height: 25mm;
    max-height: 25mm;
    padding: 0 1mm;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-after: always;
    break-after: page;
  }
  .sticker-row.last-row,
  .sticker-row:last-child {
    page-break-after: avoid;
    break-after: avoid;
  }
  .barcode-sticker {
    width: 34.5mm;
    height: 25mm;
    max-height: 25mm;
    border: none !important;
    padding-top: ${normalOffsetY.toFixed(2)}mm;
    padding-bottom: 0.6mm;
    padding-left: ${(1 + normalOffsetX).toFixed(2)}mm;
    padding-right: ${(1 - normalOffsetX).toFixed(2)}mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: hidden;
    background: #ffffff !important;
    box-sizing: border-box;
  }
  .product-name {
    width: 100%;
    font-size: 6.5pt;
    font-weight: 800;
    line-height: 1.1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #000000 !important;
    padding: 0 0.5mm;
    margin-bottom: 0.2mm;
  }
  .barcode-bars-block {
    width: 29mm;
    margin: 0 auto;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
  }
  .barcode-svg-container {
    width: 100%;
    height: 7.2mm;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff !important;
    overflow: hidden;
    margin: 0;
    padding: 0;
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
    padding: 0;
    line-height: 1;
    margin-top: 0.3mm;
    box-sizing: border-box;
  }
  .code-text {
    font-size: 5.8pt;
    font-weight: 700;
    font-family: monospace;
    letter-spacing: -0.1px;
    text-align: left;
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #000000 !important;
    padding: 0;
    margin: 0;
    line-height: 1;
  }
  .variant-text {
    font-size: 4.8pt;
    font-weight: 400;
    font-family: Arial, Helvetica, sans-serif;
    letter-spacing: 0;
    line-height: 1;
    max-width: 50%;
    text-align: right;
    overflow: hidden;
    text-overflow: clip;
    white-space: nowrap;
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    padding: 0;
    margin: 0;
  }
  .mrp-text {
    width: 100%;
    font-size: 9.5pt;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.2px;
    white-space: nowrap;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5mm;
    margin-top: 0.2mm;
  }
  .mrp-text .mrp-label {
    font-size: 6.8pt;
    font-weight: 900;
    letter-spacing: 0;
  }
  .size-badge {
    font-size: 7.5pt;
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
  <div class="sticker-grid">${normalRowsHtml}</div>
</body>
</html>
`;
}

function renderCalibrationSticker(index, options = {}) {
  const continuous = Boolean(options.continuous);
  const pitch = Number.isFinite(Number(options.pitchMm)) ? Number(options.pitchMm) : 12;
  const wrapperClass = continuous ? 'jewel-sticker-wrapper jewel-continuous' : 'jewel-sticker-wrapper';
  const wrapperStyle = continuous ? ` style="top:${(index * pitch).toFixed(3)}mm;"` : '';
  const num = index + 1;

  // Horizontal ruler every 10mm across the 77.5mm width — verifies the print is
  // not horizontally scaled (0mm must sit on the left edge, 77.5mm on the right).
  let xTicks = '';
  for (let mm = 0; mm <= 70; mm += 10) {
    xTicks += `<div class="calib-xtick" style="left:${mm}mm;"><span>${mm}</span></div>`;
  }
  // Vertical ruler every 3mm down the 12mm height — verifies the feed/length.
  let yTicks = '';
  for (let mm = 0; mm <= 9; mm += 3) {
    yTicks += `<div class="calib-ytick" style="top:${mm}mm;"><span>${mm}</span></div>`;
  }

  return `
    <div class="${wrapperClass}"${wrapperStyle}>
      <div class="calib-sticker">
        <div class="calib-frame"></div>
        <div class="calib-xruler">${xTicks}</div>
        <div class="calib-yruler">${yTicks}</div>
        <div class="calib-vline"></div>
        <div class="calib-center">
          <div class="calib-num">${num}</div>
          <div class="calib-sub">80Ã—12mm Â· PITCH ${pitch}mm</div>
        </div>
      </div>
    </div>
  `;
}

export function buildJewelleryCalibrationHtml(options = {}) {
  const settings = getLabelSettings();
  const count = Math.max(1, Math.min(30, parseInt(options.count ?? 10, 10) || 10));
  const rawPitch = options.pitchMm !== undefined ? options.pitchMm : settings.pitchMm;
  const parsedPitch = Number(rawPitch);
  const pitch = Number.isFinite(parsedPitch) && parsedPitch >= 12 && parsedPitch <= 30 ? parsedPitch : 12;
  const rawOffsetX = options.offsetX !== undefined ? options.offsetX : settings.offsetX;
  const rawOffsetY = options.offsetY !== undefined ? options.offsetY : settings.offsetY;
  const offsetX = Number.isFinite(Number(rawOffsetX)) ? Math.max(-6, Math.min(6, Number(rawOffsetX))) : 0;
  const offsetY = Number.isFinite(Number(rawOffsetY)) ? Math.max(-6, Math.min(6, Number(rawOffsetY))) : 0;
  const continuous = options.continuous !== undefined ? Boolean(options.continuous) : Boolean(settings.continuous);

  const stickers = Array.from({ length: count })
    .map((_, index) => renderCalibrationSticker(index, { continuous, pitchMm: pitch }))
    .join('');

  const pageSize = continuous ? `77.5mm ${count * pitch}mm` : `77.5mm ${pitch}mm`;
  const listClass = `jewel-sticker-list${continuous ? ' jewel-continuous-list' : ''}`;
  const listHeight = continuous ? `height:${count * pitch}mm;` : '';

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Jewellery Tag Calibration (77.5x12mm)</title>
<style>
  @page { size: ${pageSize}; margin: 0mm; }
  @media print { @page { size: ${pageSize}; margin: 0mm; } }
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
    width: 77.5mm;
    font-family: Arial, Helvetica, sans-serif;
    background: #ffffff;
  }
  .jewel-sticker-list { display: block; width: 77.5mm; padding: 0; margin: 0; ${listHeight} }
  .jewel-sticker-list.jewel-continuous-list { position: relative; }
  .jewel-sticker-wrapper {
    display: block;
    width: 77.5mm;
    height: ${pitch}mm;
    page-break-inside: avoid;
    break-inside: avoid;
    overflow: hidden;
    background: #ffffff;
  }
  /* Hard break per tag so browser rounding can never accumulate into drift. */
  .jewel-sticker-wrapper:not(.jewel-continuous) {
    page-break-after: always;
    break-after: page;
  }
  .jewel-sticker-wrapper:not(.jewel-continuous):last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .jewel-sticker-wrapper.jewel-continuous {
    position: absolute;
    left: 0;
    right: 0;
    page-break-inside: auto;
    break-inside: auto;
    page-break-after: auto;
    break-after: auto;
  }
  /* Exact-size 80Ã—12mm calibration tag. The outer frame IS the real die-cut
     edge — if it does not fill the physical tag, the printer scale is wrong.
     The rulers measure the print in millimetres on both axes. */
  .calib-sticker {
    position: relative;
    width: 77.5mm;
    height: 12mm;
    transform: translate(${offsetX}mm, ${offsetY}mm);
    transform-origin: top left;
    overflow: hidden;
    background: #ffffff;
  }
  .calib-frame {
    position: absolute;
    left: 0; top: 0; right: 0; bottom: 0;
    border: 0.25mm solid #000000;
    pointer-events: none;
  }
  .calib-xruler {
    position: absolute;
    left: 0; top: 0;
    width: 77.5mm; height: 4.4mm;
    border-bottom: 0.2mm solid #000000;
  }
  .calib-xtick {
    position: absolute;
    top: 0;
    height: 4.4mm;
    border-left: 0.2mm solid #000000;
  }
  .calib-xtick span {
    position: absolute;
    left: 0.4mm;
    bottom: 0.15mm;
    font-size: 4.6pt;
    font-weight: 900;
    line-height: 1;
    background: #ffffff;
    padding: 0 0.2mm;
  }
  .calib-yruler {
    position: absolute;
    left: 0; top: 0;
    width: 7mm; height: 12mm;
    border-right: 0.2mm solid #000000;
  }
  .calib-ytick {
    position: absolute;
    left: 0;
    width: 7mm;
    border-top: 0.2mm solid #000000;
  }
  .calib-ytick span {
    position: absolute;
    left: 1.1mm;
    top: 0.2mm;
    font-size: 4.6pt;
    font-weight: 900;
    line-height: 1;
    background: #ffffff;
    padding: 0 0.2mm;
  }
  .calib-center {
    position: absolute;
    left: 7mm; right: 0;
    top: 4.4mm; bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3mm;
    text-align: center;
  }
  .calib-num { font-size: 14pt; font-weight: 900; line-height: 1; }
  .calib-sub { font-size: 4.8pt; font-weight: 800; line-height: 1; letter-spacing: 0.2px; }
  .calib-vline {
    position: absolute;
    left: 40mm; top: 4.4mm; bottom: 0;
    border-left: 0.15mm dashed #000000;
    opacity: 0.5;
  }
</style>
</head>
<body>
  <div class="${listClass}">${stickers}</div>
</body>
</html>
  `;
}

function openAndPrintHtml(html, { width = 750, height = 600 } = {}) {
  if (typeof window === 'undefined') return false;
  const printWin = window.open('', '_blank', `width=${width},height=${height}`);
  if (!printWin) {
    window.alert('Please allow pop-ups to print labels.');
    return false;
  }
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

export function printJewelleryCalibration(options = {}) {
  if (typeof window === 'undefined') return false;
  return openAndPrintHtml(buildJewelleryCalibrationHtml(options), { width: 700, height: 500 });
}

export async function printBarcodeLabels(items, copiesPerItem = 1, options = {}) {
  const list = Array.isArray(items) ? items.filter(Boolean) : (items ? [items] : []);
  if (list.length === 0) {
    if (typeof window !== 'undefined') window.alert('No barcodes to print.');
    return false;
  }
  if (typeof window === 'undefined') return false;

  const isJewellery = options.stickerType === 'jewellery_80x12' || options.stickerType === 'jewellery';
  const html = await buildStickerPrintHtml(list, copiesPerItem, options);
  return openAndPrintHtml(html, {
    width: isJewellery ? 700 : 750,
    height: isJewellery ? 500 : 600
  });
}



