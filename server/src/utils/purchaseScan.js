const slugify = require('slugify');

const DEFAULT_GST_RATE = 18;
const DEFAULT_GST_TYPE = 'exclusive';
const DEFAULT_HSN_CODE = '4202';
const DEFAULT_LOW_STOCK_THRESHOLD = 5;

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function toMoney(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = typeof value === 'number'
    ? value
    : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDateInput(value) {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function normalizeScanCode(raw) {
  let value = Array.isArray(raw) ? raw[0] : raw;
  if (value === null || value === undefined) return '';
  value = String(value).trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  return value;
}

function extractScanCode(raw) {
  const normalized = normalizeScanCode(raw);
  if (!normalized) return { code: '', source: 'empty', payload: null };

  const looksLikeJson = (normalized.startsWith('{') && normalized.endsWith('}'))
    || (normalized.startsWith('[') && normalized.endsWith(']'));

  if (looksLikeJson) {
    try {
      const parsed = JSON.parse(normalized);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      if (obj && typeof obj === 'object') {
        const keys = ['barcode', 'code', 'sku', 'product_id', 'productId', 'id'];
        for (const key of keys) {
          const candidate = obj[key];
          if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
            return { code: String(candidate).trim(), source: 'qr', payload: obj };
          }
        }
      }
    } catch (_) {
      // Not valid JSON, continue as a plain code
    }
  }

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      for (const key of ['barcode', 'code', 'sku', 'id']) {
        const candidate = url.searchParams.get(key);
        if (candidate && candidate.trim()) {
          return { code: candidate.trim(), source: 'qr', payload: normalized };
        }
      }
      const segments = url.pathname.split('/').filter(Boolean);
      if (segments.length > 0) {
        return { code: decodeURIComponent(segments[segments.length - 1]), source: 'qr', payload: normalized };
      }
    } catch (_) {
      // Malformed URL, fall back to plain handling
    }
  }

  return { code: normalized, source: 'plain', payload: null };
}

function normalizeNewProductPayload(input = {}) {
  const source = input || {};
  const name = String(source.name || source.product_name || '').trim();
  if (!name) {
    throw createHttpError('Product name is required to add a scanned product.', 400);
  }

  const codeInfo = extractScanCode(source.scanned_code || source.barcode || source.code || '');
  if (!codeInfo.code) {
    throw createHttpError('A scanned barcode or QR code is required.', 400);
  }

  const purchaseRate = toMoney(toNumber(source.purchase_rate ?? source.purchased_rate ?? source.purchase_price, 0));
  const mrp = toMoney(toNumber(source.mrp, 0));
  const salePrice = toMoney(toNumber(source.sale_price ?? source.price, 0));
  const price = salePrice > 0 ? salePrice : (mrp > 0 ? mrp : (purchaseRate > 0 ? purchaseRate : 1));
  const gstType = String(source.gst_type || DEFAULT_GST_TYPE).toLowerCase() === 'inclusive'
    ? 'inclusive'
    : 'exclusive';
  const stock = Math.max(0, parseInt(source.stock ?? source.stock_quantity ?? 0, 10) || 0);
  const lowStockThreshold = Math.max(
    0,
    parseInt(source.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD, 10) || DEFAULT_LOW_STOCK_THRESHOLD
  );
  const purchasedRateInput = source.purchased_rate;
  const purchasedRate = purchasedRateInput !== null && purchasedRateInput !== undefined && String(purchasedRateInput).trim() !== ''
    ? String(purchasedRateInput)
    : (purchaseRate > 0 ? String(purchaseRate) : null);
  const categoryId = source.category_id !== null && source.category_id !== undefined && source.category_id !== ''
    ? parseInt(source.category_id, 10) || null
    : null;
  const isOnline = source.is_online === undefined || source.is_online === null
    ? true
    : Boolean(source.is_online);

  return {
    name,
    scanned_code: codeInfo.code,
    barcode: codeInfo.code,
    source: codeInfo.source,
    qr_payload: codeInfo.payload,
    category_id: categoryId,
    price,
    sale_price: salePrice,
    mrp,
    purchase_price: purchaseRate,
    purchased_rate: purchasedRate,
    gst_type: gstType,
    gst_rate: toNumber(source.gst_rate, DEFAULT_GST_RATE),
    hsn_code: String(source.hsn_code || DEFAULT_HSN_CODE).trim() || DEFAULT_HSN_CODE,
    barcode_short_name: String(source.barcode_short_name || name).trim() || name,
    description: source.description ? String(source.description) : null,
    stock,
    low_stock_threshold: lowStockThreshold,
    is_online: isOnline
  };
}

function buildPurchaseItemFromScan(product = {}, variant = null, barcode = '') {
  const p = product || {};
  const v = variant || null;
  const rateSource = p.purchased_rate !== null && p.purchased_rate !== undefined && String(p.purchased_rate).trim() !== ''
    ? p.purchased_rate
    : (p.purchase_price !== null && p.purchase_price !== undefined ? p.purchase_price : '');

  return {
    product_id: p.id,
    product_name: p.name,
    variant_id: v && v.id ? String(v.id) : '',
    variant_info: v ? [v.color_name, v.size_name].filter(Boolean).join(' / ') : '',
    purchase_rate: rateSource !== '' && rateSource !== null && rateSource !== undefined ? String(rateSource) : '',
    mrp: p.mrp !== null && p.mrp !== undefined ? String(p.mrp) : '',
    gst_type: p.gst_type || DEFAULT_GST_TYPE,
    gst_rate: p.gst_rate !== null && p.gst_rate !== undefined ? String(p.gst_rate) : String(DEFAULT_GST_RATE),
    manufacturing_date: toDateInput(p.manufacturing_date),
    expiry_date: toDateInput(p.expiry_date),
    barcode: barcode || '',
    hsn_code: p.hsn_code || DEFAULT_HSN_CODE,
    stock_quantity: v ? parseInt(v.stock_quantity, 10) || 0 : parseInt(p.stock, 10) || 0,
    sale_price: p.sale_price !== null && p.sale_price !== undefined ? p.sale_price : null,
    price: p.price !== null && p.price !== undefined ? p.price : null
  };
}

function buildFoundResult(row, matchType, code, source, payload, barcode) {
  const variant = row.matched_variant_id
    ? {
      id: row.matched_variant_id,
      sku: row.matched_variant_sku || null,
      color_name: row.matched_color_name || null,
      size_name: row.matched_size_name || null,
      stock_quantity: parseInt(row.matched_variant_stock, 10) || 0
    }
    : null;

  const resolvedBarcode = barcode || row.matched_barcode || code;
  const item = buildPurchaseItemFromScan(row, variant, resolvedBarcode);

  return {
    found: true,
    code,
    scanned_code: code,
    source,
    payload,
    match_type: matchType,
    product_id: row.id,
    product_name: row.name,
    slug: row.slug || null,
    barcode: resolvedBarcode,
    is_primary: Boolean(row.is_primary),
    mrp: row.mrp ?? null,
    purchase_price: row.purchase_price ?? null,
    purchased_rate: row.purchased_rate ?? null,
    price: row.price ?? null,
    sale_price: row.sale_price ?? null,
    gst_type: row.gst_type || DEFAULT_GST_TYPE,
    gst_rate: row.gst_rate ?? DEFAULT_GST_RATE,
    hsn_code: row.hsn_code || DEFAULT_HSN_CODE,
    stock: parseInt(row.stock, 10) || 0,
    variant,
    item
  };
}

async function resolveProductByScan(queryFn, rawCode) {
  if (typeof queryFn !== 'function') {
    throw createHttpError('A database query function is required.', 500);
  }

  const { code, source, payload } = extractScanCode(rawCode);
  if (!code) {
    return {
      found: false,
      code: '',
      scanned_code: '',
      source,
      payload,
      match_type: null,
      item: null
    };
  }

  const barcodeRows = await queryFn(
    `SELECT p.*, pb.barcode AS matched_barcode, pb.is_primary,
            pv.id AS matched_variant_id, pv.sku AS matched_variant_sku,
            pv.color_name AS matched_color_name, pv.size_name AS matched_size_name,
            pv.stock_quantity AS matched_variant_stock
     FROM product_barcodes pb
     JOIN products p ON pb.product_id = p.id
     LEFT JOIN product_variants pv ON pb.variant_id = pv.id
     WHERE pb.barcode = ? AND pb.status = 'active'
     LIMIT 1`,
    [code]
  );

  if (Array.isArray(barcodeRows) && barcodeRows.length > 0) {
    return buildFoundResult(barcodeRows[0], 'barcode', code, source, payload, barcodeRows[0].matched_barcode);
  }

  const skuRows = await queryFn(
    `SELECT p.*, pv.id AS matched_variant_id, pv.sku AS matched_variant_sku,
            pv.color_name AS matched_color_name, pv.size_name AS matched_size_name,
            pv.stock_quantity AS matched_variant_stock
     FROM product_variants pv
     JOIN products p ON pv.product_id = p.id
     WHERE pv.sku = ?
     LIMIT 1`,
    [code]
  );

  if (Array.isArray(skuRows) && skuRows.length > 0) {
    return buildFoundResult(skuRows[0], 'sku', code, source, payload, code);
  }

  const productRows = await queryFn(
    `SELECT p.*, NULL AS matched_variant_id, NULL AS matched_variant_sku,
            NULL AS matched_color_name, NULL AS matched_size_name, NULL AS matched_variant_stock
     FROM products p
     WHERE (p.id = ? OR p.slug = ? OR p.barcode_short_name = ?)
     LIMIT 1`,
    [code, code, code]
  );

  if (Array.isArray(productRows) && productRows.length > 0) {
    return buildFoundResult(productRows[0], 'product', code, source, payload, code);
  }

  return {
    found: false,
    code,
    scanned_code: code,
    source,
    payload,
    match_type: null,
    item: null
  };
}

async function createProductFromScan(queryFn, payload, options = {}) {
  if (typeof queryFn !== 'function') {
    throw createHttpError('A database query function is required.', 500);
  }

  const normalized = normalizeNewProductPayload(payload);

  const existingBarcode = await queryFn(
    'SELECT product_id FROM product_barcodes WHERE barcode = ? LIMIT 1',
    [normalized.scanned_code]
  );
  if (Array.isArray(existingBarcode) && existingBarcode.length > 0) {
    throw createHttpError(`Barcode/QR code "${normalized.scanned_code}" is already linked to another product.`, 409);
  }

  let slug = slugify(normalized.name, { lower: true, strict: true }) || `scanned-product-${Date.now()}`;
  const slugTaken = await queryFn('SELECT id FROM products WHERE slug = ? LIMIT 1', [slug]);
  if (Array.isArray(slugTaken) && slugTaken.length > 0) {
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  const productId = slug;

  await queryFn(
    `INSERT INTO products (
       id, slug, name, category_id, price, sale_price, mrp, purchase_price, purchased_rate,
       vendor_id, stock, low_stock_threshold, gst_type, gst_rate, hsn_code, barcode_short_name,
       description, is_active, is_online, is_offline, is_featured
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 1, 0)`,
    [
      productId,
      slug,
      normalized.name,
      normalized.category_id,
      normalized.price,
      normalized.sale_price,
      normalized.mrp,
      normalized.purchase_price,
      normalized.purchased_rate,
      options.vendorId || null,
      normalized.stock,
      normalized.low_stock_threshold,
      normalized.gst_type,
      normalized.gst_rate,
      normalized.hsn_code,
      normalized.barcode_short_name,
      normalized.description,
      normalized.is_online ? 1 : 0
    ]
  );

  const sequenceRows = await queryFn('SELECT COALESCE(MAX(barcode_sequence), 0) AS max_sequence FROM product_barcodes');
  const nextSequence = (parseInt(sequenceRows?.[0]?.max_sequence, 10) || 0) + 1;

  await queryFn(
    `INSERT INTO product_barcodes (product_id, barcode, barcode_sequence, is_primary, status, created_by)
     VALUES (?, ?, ?, 1, 'active', ?)`,
    [productId, normalized.scanned_code, nextSequence, options.userId || null]
  );

  const rows = await queryFn('SELECT * FROM products WHERE id = ? LIMIT 1', [productId]);
  const product = (Array.isArray(rows) && rows[0]) || {
    id: productId,
    slug,
    name: normalized.name,
    price: normalized.price,
    sale_price: normalized.sale_price,
    mrp: normalized.mrp,
    purchase_price: normalized.purchase_price,
    purchased_rate: normalized.purchased_rate,
    gst_type: normalized.gst_type,
    gst_rate: normalized.gst_rate,
    hsn_code: normalized.hsn_code,
    stock: normalized.stock
  };

  return {
    product,
    item: buildPurchaseItemFromScan(product, null, normalized.scanned_code),
    barcode: normalized.scanned_code,
    barcode_sequence: nextSequence,
    normalized
  };
}

module.exports = {
  DEFAULT_GST_RATE,
  DEFAULT_GST_TYPE,
  DEFAULT_HSN_CODE,
  normalizeScanCode,
  extractScanCode,
  normalizeNewProductPayload,
  buildPurchaseItemFromScan,
  resolveProductByScan,
  createProductFromScan
};
