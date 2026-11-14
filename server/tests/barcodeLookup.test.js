const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/db');

let activeQuery = async () => [];
db.query = (sql, params) => activeQuery(sql, params);

const controller = require('../src/controllers/barcodeController');

function createRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
}

function primaryRow(overrides = {}) {
  return {
    id: 1,
    product_id: 'canvas-tote',
    variant_id: null,
    barcode: 'NP-1001',
    barcode_sequence: 1,
    is_primary: 1,
    status: 'active',
    product_name: 'Canvas Tote',
    slug: 'canvas-tote',
    price: 1499,
    sale_price: 0,
    hsn_code: '4202',
    barcode_short_name: 'Canvas Tote',
    mrp: 1999,
    purchase_price: 400,
    purchased_rate: '450',
    product_stock: 0,
    sku: null,
    color_name: null,
    color_hex: null,
    size_name: null,
    stock_quantity: null,
    variant_image: null,
    ...overrides
  };
}

function installQuery({ barcodeRows = [], imageRows = [] } = {}) {
  activeQuery = async (sql) => {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM product_barcodes pb') && normalized.includes('WHERE pb.barcode = ?')) return barcodeRows;
    if (normalized.includes('FROM product_images WHERE product_id = ?')) return imageRows;
    return [];
  };
}

test('lookupBarcode reports zero stock for a primary barcode when the product stock is zero', async () => {
  installQuery({ barcodeRows: [primaryRow()] });

  const res = createRes();
  await controller.lookupBarcode({ query: { code: 'NP-1001' }, user: null }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.found_by, 'barcode');
  assert.equal(res.body.data.barcode, 'NP-1001');
  assert.equal(res.body.data.stock_quantity, 0, 'must not fall back to the old default of 50');
});

test('lookupBarcode reports variant stock for a variant barcode', async () => {
  installQuery({
    barcodeRows: [primaryRow({
      variant_id: 7,
      is_primary: 0,
      sku: 'CT-RED-M',
      color_name: 'Red',
      size_name: 'M',
      stock_quantity: 6,
      product_stock: 99
    })]
  });

  const res = createRes();
  await controller.lookupBarcode({ query: { code: 'NP-1002' }, user: null }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.stock_quantity, 6);
  assert.equal(res.body.data.variant.stock, 6);
});

test('lookupBarcode reports zero stock when the product fallback matches a zero-stock product', async () => {
  activeQuery = async (sql) => {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM product_barcodes pb') && normalized.includes('WHERE pb.barcode = ?')) return [];
    if (normalized.includes('FROM product_variants pv') && normalized.includes('WHERE pv.sku = ?')) return [];
    if (normalized.includes('FROM products p') && normalized.includes('WHERE (p.id = ? OR p.slug = ?)')) {
      return [{
        id: 'canvas-tote',
        slug: 'canvas-tote',
        name: 'Canvas Tote',
        price: 1499,
        sale_price: 0,
        hsn_code: '4202',
        barcode_short_name: 'Canvas Tote',
        mrp: 1999,
        purchase_price: 400,
        purchased_rate: '450',
        stock: 0,
        primary_barcode: null
      }];
    }
    if (normalized.includes('FROM product_images WHERE product_id = ?')) return [];
    return [];
  };

  const res = createRes();
  await controller.lookupBarcode({ query: { code: 'canvas-tote' }, user: null }, res, (error) => { throw error; });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.found_by, 'product');
  assert.equal(res.body.data.stock_quantity, 0);
});
