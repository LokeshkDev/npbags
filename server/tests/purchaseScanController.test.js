const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/db');

let activeQuery = async () => [];
let activeTransaction = async (handler) => handler({ query: (sql, params) => activeQuery(sql, params) });

db.query = (sql, params) => activeQuery(sql, params);
db.withTransaction = (handler) => activeTransaction(handler);

const controller = require('../src/controllers/purchaseScanController');

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

function productRow() {
  return {
    id: 'leather-tote',
    slug: 'leather-tote',
    name: 'Leather Tote',
    price: 2999,
    sale_price: 2499,
    mrp: 3499,
    purchase_price: 1800,
    purchased_rate: '1800',
    gst_type: 'exclusive',
    gst_rate: 18,
    hsn_code: '4202',
    stock: 12,
    matched_barcode: 'NP-1048',
    is_primary: 1,
    matched_variant_id: null,
    matched_variant_sku: null,
    matched_color_name: null,
    matched_size_name: null,
    matched_variant_stock: null
  };
}

test('scanPurchaseItem returns product details for a known barcode', async () => {
  activeQuery = async (sql) => {
    if (sql.includes('FROM product_barcodes pb')) return [productRow()];
    if (sql.includes('branch_stocks')) return [];
    return [];
  };

  const res = createRes();
  await controller.scanPurchaseItem(
    { query: { code: 'NP-1048' }, user: { id: 1, role: 'admin' } },
    res,
    (error) => { throw error; }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.found, true);
  assert.equal(res.body.data.product_name, 'Leather Tote');
  assert.equal(res.body.data.match_type, 'barcode');
  assert.equal(res.body.data.item.purchase_rate, '1800');
});

test('scanPurchaseItem returns a not-found payload that the UI can turn into a new product form', async () => {
  activeQuery = async () => [];

  const res = createRes();
  await controller.scanPurchaseItem(
    { query: { code: 'NP-NEW-CODE' }, body: {}, user: { id: 1, role: 'admin' } },
    res,
    (error) => { throw error; }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.found, false);
  assert.equal(res.body.data.scanned_code, 'NP-NEW-CODE');
});

test('scanPurchaseItem rejects an empty scan', async () => {
  const res = createRes();
  await controller.scanPurchaseItem(
    { query: { code: '   ' }, body: {}, user: { id: 1, role: 'admin' } },
    res,
    (error) => { throw error; }
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('createPurchaseScanProduct validates the product name', async () => {
  activeTransaction = async (handler) => handler({ query: (sql, params) => activeQuery(sql, params) });
  activeQuery = async () => [];

  const res = createRes();
  await controller.createPurchaseScanProduct(
    { body: { scanned_code: 'NP-2000' }, user: { id: 1, role: 'admin' } },
    res,
    (error) => { throw error; }
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Product name is required/);
});

test('createPurchaseScanProduct creates the product and returns bill-ready item defaults', async () => {
  activeTransaction = async (handler) => handler({ query: (sql, params) => activeQuery(sql, params) });
  activeQuery = async (sql) => {
    if (sql.includes('SELECT product_id FROM product_barcodes WHERE barcode = ?')) return [];
    if (sql.includes('SELECT id FROM products WHERE slug = ?')) return [];
    if (sql.includes('COALESCE(MAX(barcode_sequence)')) return [{ max_sequence: 2 }];
    if (sql.includes('INSERT INTO products')) return { insertId: 1 };
    if (sql.includes('INSERT INTO product_barcodes')) return { insertId: 2 };
    if (sql.includes('SELECT * FROM products WHERE id = ?')) {
      return [{
        id: 'canvas-tote',
        slug: 'canvas-tote',
        name: 'Canvas Tote',
        price: 1499,
        sale_price: 0,
        mrp: 1499,
        purchase_price: 600,
        purchased_rate: '600',
        gst_type: 'exclusive',
        gst_rate: 5,
        hsn_code: '4202',
        stock: 0
      }];
    }
    return [];
  };

  const res = createRes();
  await controller.createPurchaseScanProduct(
    {
      body: {
        name: 'Canvas Tote',
        scanned_code: 'NP-2000',
        mrp: 1499,
        purchase_rate: 600,
        gst_rate: 5
      },
      user: { id: 7, role: 'admin' }
    },
    res,
    (error) => { throw error; }
  );

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.product.id, 'canvas-tote');
  assert.equal(res.body.data.barcode, 'NP-2000');
  assert.equal(res.body.data.item.purchase_rate, '600');
  assert.equal(res.body.data.item.gst_rate, '5');
});

test('applyScanStock updates product stock immediately', async () => {
  const updates = [];
  activeTransaction = async (handler) => handler({ query: (sql, params) => activeQuery(sql, params) });
  activeQuery = async (sql, params) => {
    if (sql === 'SELECT id FROM products WHERE id = ? LIMIT 1') return [{ id: 'leather-tote' }];
    if (sql.includes('FROM product_variants WHERE product_id = ?')) return [];
    if (sql.includes('SELECT * FROM products WHERE id = ? FOR UPDATE')) {
      return [{ id: 'leather-tote', stock: 10 }];
    }
    if (sql.startsWith('UPDATE products SET stock = ?')) {
      updates.push(params);
      return { affectedRows: 1 };
    }
    if (sql.includes('INSERT INTO product_variants')) return { insertId: 3 };
    if (sql.includes('INSERT INTO inventory_transactions')) return { insertId: 4 };
    if (sql.includes('INSERT INTO branch_stocks')) return { affectedRows: 1 };
    if (sql.includes('SELECT stock FROM products')) return [{ stock: 11 }];
    if (sql.includes('SELECT stock FROM branch_stocks')) return [{ stock: 6 }];
    return [];
  };

  const res = createRes();
  await controller.applyScanStock(
    {
      body: {
        product_id: 'leather-tote',
        quantity: 1,
        direction: 1,
        branch_id: 2,
        scanned_code: 'NP-1048'
      },
      user: { id: 1, role: 'admin' }
    },
    res,
    (error) => { throw error; }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.stock, 11);
  assert.equal(res.body.data.branch_stock, 6);
  assert.deepEqual(updates[0], [11, 'leather-tote']);
});

test('applyScanStock reverts stock when asked to reverse a pre-applied scan', async () => {
  const updates = [];
  activeTransaction = async (handler) => handler({ query: (sql, params) => activeQuery(sql, params) });
  activeQuery = async (sql, params) => {
    if (sql === 'SELECT id FROM products WHERE id = ? LIMIT 1') return [{ id: 'leather-tote' }];
    if (sql.includes('FROM product_variants WHERE product_id = ?')) return [];
    if (sql.includes('SELECT * FROM products WHERE id = ? FOR UPDATE')) {
      return [{ id: 'leather-tote', stock: 11 }];
    }
    if (sql.startsWith('UPDATE products SET stock = ?')) {
      updates.push(params);
      return { affectedRows: 1 };
    }
    if (sql.includes('INSERT INTO product_variants')) return { insertId: 3 };
    if (sql.includes('INSERT INTO inventory_transactions')) return { insertId: 4 };
    if (sql.includes('INSERT INTO branch_stocks')) return { affectedRows: 1 };
    if (sql.includes('SELECT stock FROM products')) return [{ stock: 10 }];
    if (sql.includes('SELECT stock FROM branch_stocks')) return [{ stock: 0 }];
    return [];
  };

  const res = createRes();
  await controller.applyScanStock(
    {
      body: {
        product_id: 'leather-tote',
        quantity: 1,
        direction: -1,
        branch_id: 2,
        scanned_code: 'NP-1048'
      },
      user: { id: 1, role: 'admin' }
    },
    res,
    (error) => { throw error; }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.stock, 10);
  assert.deepEqual(updates[0], [10, 'leather-tote']);
});
