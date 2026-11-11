const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/db');
const barcodeUtil = require('../src/utils/barcode');

let activeDb = null;
const generateCalls = [];

db.query = (sql, params) => activeDb.query(sql, params);
db.withTransaction = (handler) => handler({ query: (sql, params) => activeDb.query(sql, params) });

barcodeUtil.generateProductBarcodes = async (...args) => {
  generateCalls.push(args);
  return [{ type: 'primary', barcode: 'NP-GENERATED', barcode_sequence: 1 }];
};

const { createProduct } = require('../src/controllers/productController');

function createFakeDb(config = {}) {
  const state = {
    calls: [],
    productInsert: null,
    stockUpdates: [],
    variantInserts: [],
    barcodeInserts: [],
    branchStockInserts: [],
    rateHistoryInserts: [],
    auditInserts: []
  };

  async function query(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    state.calls.push({ sql: normalized, params });

    if (normalized.includes('SELECT id FROM products WHERE slug = ?')) {
      return config.slugRows || [];
    }
    if (normalized.includes('SELECT gender FROM categories WHERE id = ?')) {
      return config.categoryRows || [];
    }
    if (normalized.includes('INSERT INTO products (')) {
      state.productInsert = params;
      return { insertId: 1 };
    }
    if (normalized.includes('UPDATE products SET stock = 0 WHERE id = ?')) {
      state.stockUpdates.push(params);
      return { affectedRows: 1 };
    }
    if (normalized.includes('INSERT INTO product_purchase_rate_history')) {
      state.rateHistoryInserts.push(params);
      return { insertId: 1 };
    }
    if (normalized.includes('SELECT id FROM product_images')) {
      return config.existingImageRows || [];
    }
    if (normalized.includes('SELECT MAX(display_order)')) {
      return [{ max_order: null }];
    }
    if (normalized.includes('INSERT INTO product_images')) {
      return { insertId: 1 };
    }
    if (normalized.includes('INSERT INTO product_variants')) {
      state.variantInserts.push(params);
      return { insertId: state.variantInserts.length };
    }
    if (normalized.includes('FROM product_barcodes WHERE barcode = ?')) {
      return config.existingBarcodeRows || [];
    }
    if (normalized.includes('COALESCE(MAX(barcode_sequence)')) {
      return config.sequenceRows || [{ max_sequence: 0 }];
    }
    if (normalized.includes('INSERT INTO product_barcodes')) {
      if (config.barcodeInsertError) throw config.barcodeInsertError;
      state.barcodeInserts.push(params);
      return { insertId: 1 };
    }
    if (normalized.includes('INSERT INTO branch_stocks')) {
      state.branchStockInserts.push(params);
      return { affectedRows: 1 };
    }
    if (normalized.includes('SELECT image_url FROM product_images')) {
      return [];
    }
    if (normalized.includes('INSERT INTO audit_logs')) {
      state.auditInserts.push(params);
      return { insertId: 1 };
    }

    return [];
  }

  return { query, state };
}

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

function baseBody(overrides = {}) {
  return {
    name: 'Canvas Tote',
    price: '1499',
    sale_price: '1299',
    mrp: '1999',
    gst_type: 'exclusive',
    gst_rate: '18',
    ...overrides
  };
}

async function runCreate(body, options = {}) {
  activeDb = createFakeDb(options.db || {});
  generateCalls.length = 0;

  const res = createRes();
  await createProduct(
    { body, user: { id: 7 }, files: [] },
    res,
    (error) => { throw error; }
  );

  return { res, db: activeDb };
}

test('createProduct saves the scanned barcode when it is unique', async () => {
  const { res, db } = await runCreate(baseBody({
    barcode: 'NP-NEW-123',
    variants: JSON.stringify([
      { color_name: 'Red', color_hex: '#ff0000', size_name: 'M' }
    ])
  }), { db: { sequenceRows: [{ max_sequence: 4 }] } });

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.id, 'canvas-tote');

  assert.ok(db.state.productInsert, 'product insert should run');
  assert.equal(db.state.productInsert.length, 37);
  assert.equal(db.state.productInsert[0], 'canvas-tote');
  assert.equal(db.state.productInsert[2], 'Canvas Tote');

  assert.deepEqual(db.state.stockUpdates, [['canvas-tote']]);
  assert.equal(db.state.variantInserts.length, 1);
  assert.equal(db.state.variantInserts[0][4], 0, 'missing variant stock defaults to 0');

  assert.equal(db.state.barcodeInserts.length, 1);
  assert.deepEqual(db.state.barcodeInserts[0], ['canvas-tote', 'NP-NEW-123', 5, 7]);
  assert.equal(generateCalls.length, 0, 'no fresh barcode needed for a unique code');
});

test('createProduct preserves an explicitly supplied variant quantity', async () => {
  const { res, db } = await runCreate(baseBody({
    variants: JSON.stringify([
      { color_name: 'Blue', color_hex: '#0000ff', size_name: 'L', stock_quantity: '7' }
    ])
  }));

  assert.equal(res.statusCode, 201);
  assert.equal(db.state.variantInserts.length, 1);
  assert.equal(db.state.variantInserts[0][4], 7);
});

test('createProduct generates a fresh barcode when the scanned code already exists', async () => {
  const variants = [{ color_name: 'Black', color_hex: '#000000', size_name: 'S' }];
  const { res, db } = await runCreate(baseBody({
    barcode: 'NP-EXISTING',
    variants: JSON.stringify(variants)
  }), { db: { existingBarcodeRows: [{ id: 55 }] } });

  assert.equal(res.statusCode, 201);
  assert.equal(db.state.barcodeInserts.length, 0, 'existing barcode must not be inserted again');
  assert.equal(generateCalls.length, 1);
  assert.equal(generateCalls[0][0], 'canvas-tote');
  assert.deepEqual(generateCalls[0][1], variants);
  assert.equal(generateCalls[0][2], 7);
  assert.equal(typeof generateCalls[0][3].query, 'function');
});

test('createProduct falls back to generated barcodes on a duplicate insert race', async () => {
  const duplicateError = Object.assign(new Error('Duplicate entry'), { code: 'ER_DUP_ENTRY' });

  const { res, db } = await runCreate(baseBody({ barcode: 'NP-RACE' }), {
    db: { existingBarcodeRows: [], barcodeInsertError: duplicateError }
  });

  assert.equal(res.statusCode, 201);
  assert.equal(db.state.barcodeInserts.length, 0);
  assert.equal(generateCalls.length, 1);
  assert.equal(generateCalls[0][0], 'canvas-tote');
});

test('createProduct accepts scanned_code as a fallback field', async () => {
  const { res, db } = await runCreate(baseBody({ scanned_code: 'NP-FALLBACK' }));

  assert.equal(res.statusCode, 201);
  assert.equal(db.state.barcodeInserts.length, 1);
  assert.equal(db.state.barcodeInserts[0][1], 'NP-FALLBACK');
});

test('createProduct does not touch barcode tables when no code is supplied', async () => {
  const { res, db } = await runCreate(baseBody());

  assert.equal(res.statusCode, 201);  assert.deepEqual(db.state.stockUpdates, [['canvas-tote']]);
  assert.equal(db.state.barcodeInserts.length, 0);
  assert.equal(generateCalls.length, 0);
  assert.equal(
    db.state.calls.some((call) => call.sql.includes('product_barcodes')),
    false
  );
});

test('createProduct rejects missing name or price before writing anything', async () => {
  const missingPrice = await runCreate(baseBody({ price: '' }));
  assert.equal(missingPrice.res.statusCode, 400);
  assert.match(missingPrice.res.body.message, /name and price/i);
  assert.equal(missingPrice.db.state.productInsert, null);
  assert.equal(missingPrice.db.state.stockUpdates.length, 0);

  const missingName = await runCreate(baseBody({ name: '' }));
  assert.equal(missingName.res.statusCode, 400);
  assert.equal(missingName.db.state.productInsert, null);
});
