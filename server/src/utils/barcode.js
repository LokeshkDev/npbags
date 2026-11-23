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
 * Encodes string to Code 128 Auto binary pattern (Set C for digits, Set B for text)
 */
function encodeCode128(text) {
  if (!text) return '';
  const clean = String(text).trim();
  const tokens = [];

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
  return encoding;
}

/**
 * Generates lightweight, high-contrast, laser-scannable Code 128B SVG barcode
 * Optimized for physical thermal label printers (TSC, Zebra, etc.)
 */
function generateBarcodeSVG(text, options = {}) {
  const {
    height = 50,
    moduleWidth = 1,
    quietZone = 12,
    barColor = '#000000',
    bgColor = '#FFFFFF'
  } = options;

  const encoding = encodeCode128(text);
  if (!encoding) return '';

  const totalModules = encoding.length + (quietZone * 2);
  const calculatedWidth = totalModules * moduleWidth;

  let rects = `<rect width="100%" height="100%" fill="${bgColor}" />`;
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
        rects += `<rect x="${barStart}" y="0" width="${barW}" height="${height}" fill="${barColor}" stroke="none" shape-rendering="crispEdges" />`;
        inBar = false;
      }
    }
    currentX += moduleWidth;
  }
  if (inBar) {
    const barW = currentX - barStart;
    rects += `<rect x="${barStart}" y="0" width="${barW}" height="${height}" fill="${barColor}" stroke="none" shape-rendering="crispEdges" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${calculatedWidth} ${height}" width="100%" height="100%" preserveAspectRatio="none" shape-rendering="crispEdges">${rects}</svg>`;
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
 * Returns the next sequential label number (1, 2, 3...) for printed barcodes.
 */
async function getNextBarcodeSequence(pool) {
  const rows = await pool.query('SELECT COALESCE(MAX(barcode_sequence), 0) AS max_sequence FROM product_barcodes');
  const max = Number((Array.isArray(rows) ? rows[0] : rows)?.max_sequence || 0);
  return max + 1;
}

async function insertBarcodeWithSequence(pool, fields, userId) {
  const {
    productId,
    variantId = null,
    size = null,
    color = null,
    isPrimary = 0
  } = fields;

  let lastError = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const barcode = await generateUniqueBarcodeNumber(pool);
    const sequence = await getNextBarcodeSequence(pool);
    try {
      const result = await pool.query(
        `INSERT INTO product_barcodes (product_id, variant_id, size, color, barcode, barcode_sequence, is_primary, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [productId, variantId, size, color, barcode, sequence, isPrimary, userId || null]
      );
      return { barcode, barcode_sequence: sequence, id: result.insertId };
    } catch (error) {
      lastError = error;
      if (error.code !== 'ER_DUP_ENTRY') throw error;
    }
  }

  throw lastError || new Error('Unable to allocate a unique barcode sequence');
}

/**
 * Generates Primary Barcode and per-variant barcodes for a product
 */
async function generateProductBarcodes(productId, variants = [], userId = null, pool, options = {}) {
  const generated = [];
  const regenerate = Boolean(options && (options.regenerate || options.force));
  const targetVariantId = options && options.variantId ? options.variantId : null;

  // If variants array is empty, attempt to load all variants from product_variants
  let variantList = Array.isArray(variants) ? [...variants] : [];
  if (variantList.length === 0) {
    try {
      const dbVariants = await pool.query('SELECT * FROM product_variants WHERE product_id = ?', [productId]);
      if (Array.isArray(dbVariants) && dbVariants.length > 0) {
        variantList = dbVariants;
      }
    } catch (e) {
      // ignore
    }
  }

  // If regenerate is requested, deactivate existing active barcodes
  if (regenerate) {
    if (targetVariantId) {
      await pool.query(
        'UPDATE product_barcodes SET status = "inactive" WHERE product_id = ? AND variant_id = ? AND status = "active"',
        [productId, targetVariantId]
      );
    } else {
      await pool.query(
        'UPDATE product_barcodes SET status = "inactive" WHERE product_id = ? AND status = "active"',
        [productId]
      );
    }
  }

  // 1. Check & generate Primary Barcode (only if not targeting a specific variant)
  if (!targetVariantId) {
    const primaryExist = await pool.query(
      'SELECT * FROM product_barcodes WHERE product_id = ? AND is_primary = 1 AND status = "active"',
      [productId]
    );

    if (Array.isArray(primaryExist) && primaryExist.length === 0) {
      const primary = await insertBarcodeWithSequence(pool, { productId, isPrimary: 1 }, userId);
      generated.push({ type: 'primary', barcode: primary.barcode, barcode_sequence: primary.barcode_sequence, id: primary.id });
    }
  }

  // 2. Check & generate Variant Barcodes
  for (const variant of variantList) {
    const variantId = variant.id || null;
    const size = variant.size_name || variant.size || null;
    const color = variant.color_name || variant.color || null;

    if (targetVariantId && String(variantId) !== String(targetVariantId)) {
      continue;
    }

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
      const variantBarcode = await insertBarcodeWithSequence(
        pool,
        { productId, variantId, size, color, isPrimary: 0 },
        userId
      );
      generated.push({
        type: 'variant',
        variant_id: variantId,
        size,
        color,
        barcode: variantBarcode.barcode,
        barcode_sequence: variantBarcode.barcode_sequence,
        id: variantBarcode.id
      });
    }
  }

  // If a specific variantId was requested but wasn't in variantList, ensure it gets generated
  if (targetVariantId && generated.length === 0) {
    const existing = await pool.query(
      'SELECT * FROM product_barcodes WHERE product_id = ? AND variant_id = ? AND status = "active"',
      [productId, targetVariantId]
    );
    if (Array.isArray(existing) && existing.length === 0) {
      const vBarcode = await insertBarcodeWithSequence(
        pool,
        { productId, variantId: targetVariantId, isPrimary: 0 },
        userId
      );
      generated.push({
        type: 'variant',
        variant_id: targetVariantId,
        barcode: vBarcode.barcode,
        barcode_sequence: vBarcode.barcode_sequence,
        id: vBarcode.id
      });
    }
  }

  return generated;
}

/**
 * Assigns a caller-supplied barcode to a specific product variant.
 * - Re-links an existing barcode row that already belongs to this product.
 * - Insert a new barcode row when the code is still free.
 * - Silently ignores codes that belong to a different product / are invalid.
 */
async function assignVariantBarcode(pool, productId, variantId, { size, color, barcode } = {}, userId = null) {
  const code = String(barcode || '').trim();
  if (!code) return null;

  const existing = await pool.query('SELECT id, product_id FROM product_barcodes WHERE barcode = ? LIMIT 1', [code]);
  if (Array.isArray(existing) && existing.length > 0) {
    const row = existing[0];
    if (String(row.product_id) !== String(productId)) return null;
    await pool.query(
      `UPDATE product_barcodes
       SET variant_id = ?, size = ?, color = ?, is_primary = 0, status = 'active'
       WHERE id = ?`,
      [variantId, size || null, color || null, row.id]
    );
    return { barcode: code, id: row.id };
  }

  const sequence = await getNextBarcodeSequence(pool);
  try {
    const result = await pool.query(
      `INSERT INTO product_barcodes
        (product_id, variant_id, size, color, barcode, barcode_sequence, is_primary, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 0, 'active', ?)`,
      [productId, variantId, size || null, color || null, code, sequence, userId || null]
    );
    return { barcode: code, id: result.insertId };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return null;
    throw error;
  }
}

module.exports = {
  encodeCode128,
  generateBarcodeSVG,
  generateUniqueBarcodeNumber,
  getNextBarcodeSequence,
  generateProductBarcodes,
  assignVariantBarcode
};
