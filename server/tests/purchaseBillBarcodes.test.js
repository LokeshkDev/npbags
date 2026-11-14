const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/config/db');
const barcodeUtil = require('../src/utils/barcode');

let activeQuery = async () => [];
const generateCalls = [];

db.query = (sql, params) => activeQuery(sql, params);
db.withTransaction = (handler) => handler({ query: (sql, params) => activeQuery(sql, params) });

barcodeUtil.generateProductBarcodes = async (...args) => {
  generateCalls.push(args);
  return [];
};

const controller = require('../src/controllers/purchaseBillController');

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

function billRow() {
  return { id: 42, bill_number: 'PB-0042', vendor_id: 3, vendor_name: 'Acme Supplies' };
}

function billItem(overrides = {}) {
  return {
    bill_item_id: 1,
    product_id: 'canvas-tote',
    variant_id: null,
    product_name: 'Canvas Tote',
    variant_info: null,
    quantity: 5,
    purchase_rate: '450.50',
    rate_value: 450.5,
    mrp: 999,
    catalog_name: 'Canvas Tote',
    price: 1499,
    sale_price: 1299,
    catalog_mrp: 999,
    purchase_price: 400,
    purchased_rate: '440',
    color_name: null,
    size_name: null,
    sku: null,
    ...overrides
  };
}

function barcodeRow(overrides = {}) {
  return {
    id: 1,
    product_id: 'canvas-tote',
    variant_id: null,
    barcode: 'NP-1001',
    barcode_sequence: 1,
    is_primary: 1,
    status: 'active',
    sku: null,
    color_name: null,
    size_name: null,
    ...overrides
  };
}

function installQuery({ bills = [billRow()], products = [{ product_id: 'canvas-tote' }], variants = [], items = [billItem()], barcodes = [barcodeRow()] } = {}) {
  activeQuery = async (sql) => {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    if (normalized.includes('FROM purchase_bills pb') && normalized.includes('JOIN vendors v')) return bills;
    if (normalized.includes('SELECT DISTINCT product_id')) return products;
    if (normalized.includes('SELECT * FROM product_variants WHERE product_id = ?')) return variants;
    if (normalized.includes('pbi.id AS bill_item_id')) return items;
    if (normalized.includes('FROM product_barcodes pb') && normalized.includes('pb.product_id IN')) return barcodes;
    return [];
  };
}

test('getPurchaseBillBarcodes maps bill items to their primary and variant barcodes', async () => {
  generateCalls.length = 0;
  installQuery({
    products: [{ product_id: 'canvas-tote' }],
    variants: [{ id: 7, product_id: 'canvas-tote', color_name: 'Red', size_name: 'M' }],
    items: [
      billItem({ bill_item_id: 1, quantity: 5 }),
      billItem({
        bill_item_id: 2,
        variant_id: 7,
        quantity: 2,
        purchase_rate: '460',
        rate_value: 460,
        color_name: 'Red',
        size_name: 'M',
        sku: 'CT-RED-M'
      })
    ],
    barcodes: [
      barcodeRow(),
      barcodeRow({ id: 2, variant_id: 7, barcode: 'NP-1002', barcode_sequence: 2, is_primary: 0 })
    ]
  });

  const res = createRes();
  await controller.getPurchaseBillBarcodes(
    { params: { id: '42' }, user: { id: 9 } },
    res,
    (error) => { throw error; }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.bill.bill_number, 'PB-0042');
  assert.equal(res.body.data.bill.vendor_name, 'Acme Supplies');
  assert.equal(res.body.data.items.length, 2);

  const [primaryItem, variantItem] = res.body.data.items;
  assert.equal(primaryItem.barcode, 'NP-1001');
  assert.equal(primaryItem.barcode_sequence, 1);
  assert.equal(primaryItem.purchase_rate, '450.50');
  assert.equal(primaryItem.purchased_rate, '450.50', 'label rate must come from the bill item');
  assert.equal(primaryItem.mrp, 999);
  assert.equal(primaryItem.quantity, 5);
  assert.match(primaryItem.svg, /<svg/);

  assert.equal(variantItem.barcode, 'NP-1002');
  assert.equal(variantItem.variant_info, 'Red / M');
  assert.equal(variantItem.purchase_rate, '460');
  assert.match(variantItem.svg, /<svg/);

  assert.equal(generateCalls.length, 1, 'barcodes are ensured once per unique product');
  assert.equal(generateCalls[0][0], 'canvas-tote');
  assert.equal(generateCalls[0][2], 9);
  assert.equal(typeof generateCalls[0][3].query, 'function');
});

test('getPurchaseBillBarcodes falls back to the primary barcode when a variant code is missing', async () => {
  generateCalls.length = 0;
  installQuery({
    items: [billItem({ variant_id: 7, color_name: 'Red', size_name: 'M' })],
    barcodes: [barcodeRow()]
  });

  const res = createRes();
  await controller.getPurchaseBillBarcodes(
    { params: { id: '42' }, user: { id: 9 } },
    res,
    (error) => { throw error; }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.items[0].barcode, 'NP-1001');
  assert.equal(res.body.data.items[0].variant_info, 'Red / M');
});

test('getPurchaseBillBarcodes returns null barcodes when none can be generated', async () => {
  generateCalls.length = 0;
  installQuery({ barcodes: [] });

  const res = createRes();
  await controller.getPurchaseBillBarcodes(
    { params: { id: '42' }, user: { id: 9 } },
    res,
    (error) => { throw error; }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.items[0].barcode, null);
  assert.equal(res.body.data.items[0].svg, '');
  assert.equal(generateCalls.length, 1);
});

test('getPurchaseBillBarcodes returns 404 for an unknown bill', async () => {
  installQuery({ bills: [] });

  const res = createRes();
  await controller.getPurchaseBillBarcodes(
    { params: { id: '999' }, user: { id: 9 } },
    res,
    (error) => { throw error; }
  );

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
});
