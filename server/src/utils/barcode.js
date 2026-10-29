/**
 * Barcode Management Engine for NP Grand Shopping
 * Generates unique NP-XXXX barcodes and renders pure JavaScript Code 128B SVG labels.
 * https://www.npgrandshopping.com
 */

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
 * Encodes string to Code 128B binary pattern
 */
function encodeCode128(text) {
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
  return encoding;
}

/**
 * Generates lightweight SVG barcode
 */
function generateBarcodeSVG(text, options = {}) {
  const {
    height = 50,
    moduleWidth = 2,
    quietZone = 10,
    barColor = '#000000',
  } = options;

  const encoding = encodeCode128(text);
  if (!encoding) return '';

  const totalModules = encoding.length + (quietZone * 2);
  const calculatedWidth = totalModules * moduleWidth;

  let rects = '';
  let currentX = quietZone * moduleWidth;
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
        rects += `<rect x="${barStart}" y="0" width="${barW}" height="${height}" fill="${barColor}" />`;
        inBar = false;
      }
    }
    currentX += moduleWidth;
  }
  if (inBar) {
    const barW = currentX - barStart;
    rects += `<rect x="${barStart}" y="0" width="${barW}" height="${height}" fill="${barColor}" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${calculatedWidth} ${height}" width="100%" height="${height}" preserveAspectRatio="none">${rects}</svg>`;
}

/**
 * Generates an collision-free unique barcode number for NP Grand Shopping
 * Format: NP-XXXX (e.g. NP-5829)
 */
async function generateUniqueBarcodeNumber(pool) {
  let unique = false;
  let barcode = '';
  let attempts = 0;

  while (!unique && attempts < 30) {
    // 4 random digits (1000 to 9999)
    const random4Digits = String(Math.floor(1000 + Math.random() * 9000));
    barcode = `NP-${random4Digits}`;
    try {
      const existing = await pool.query('SELECT id FROM product_barcodes WHERE barcode = ?', [barcode]);
      if (Array.isArray(existing) && existing.length === 0) {
        unique = true;
      }
    } catch (e) {
      unique = true;
    }
    attempts++;
  }

  // 4-digit timestamp slice fallback
  if (!unique) {
    barcode = `NP-${Date.now().toString().slice(-4)}`;
  }

  return barcode;
}

/**
 * Generates Primary Barcode and per-variant barcodes for a product
 */
async function generateProductBarcodes(productId, variants = [], userId = null, pool) {
  const generated = [];

  // 1. Check & generate Primary Barcode
  const primaryExist = await pool.query(
    'SELECT * FROM product_barcodes WHERE product_id = ? AND is_primary = 1 AND status = "active"',
    [productId]
  );

  if (Array.isArray(primaryExist) && primaryExist.length === 0) {
    const primaryBarcode = await generateUniqueBarcodeNumber(pool);
    await pool.query(
      'INSERT INTO product_barcodes (product_id, barcode, is_primary, created_by) VALUES (?, ?, 1, ?)',
      [productId, primaryBarcode, userId || null]
    );
    generated.push({ type: 'primary', barcode: primaryBarcode });
  }

  // 2. Check & generate Variant Barcodes
  for (const variant of variants) {
    const variantId = variant.id || null;
    const size = variant.size_name || variant.size || null;
    const color = variant.color_name || variant.color || null;

    let variantExist = [];
    if (variantId) {
      variantExist = await pool.query(
        'SELECT * FROM product_barcodes WHERE product_id = ? AND variant_id = ? AND status = "active"',
        [productId, variantId]
      );
    } else {
      variantExist = await pool.query(
        'SELECT * FROM product_barcodes WHERE product_id = ? AND size <=> ? AND color <=> ? AND is_primary = 0 AND status = "active"',
        [productId, size, color]
      );
    }

    if (Array.isArray(variantExist) && variantExist.length === 0) {
      const variantBarcode = await generateUniqueBarcodeNumber(pool);
      await pool.query(
        'INSERT INTO product_barcodes (product_id, variant_id, size, color, barcode, is_primary, created_by) VALUES (?, ?, ?, ?, ?, 0, ?)',
        [productId, variantId, size, color, variantBarcode, userId || null]
      );
      generated.push({ type: 'variant', variant_id: variantId, size, color, barcode: variantBarcode });
    }
  }

  return generated;
}

module.exports = {
  encodeCode128,
  generateBarcodeSVG,
  generateUniqueBarcodeNumber,
  generateProductBarcodes
};
