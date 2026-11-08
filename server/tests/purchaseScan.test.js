const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeScanCode,
  extractScanCode,
  normalizeNewProductPayload,
  buildPurchaseItemFromScan,
  resolveProductByScan,
  createProductFromScan
} = require('../src/utils/purchaseScan');

function createFakeDb(config = {}) {
  const state = {
    calls: [],
    inserts: { products: [], barcodes: [] }
  };

  async function query(sql, params = []) {
    state.calls.push({ sql, params });

    if (sql.includes('FROM product_barcodes pb') && sql.includes('pb.barcode = ?')) {
      return config.barcodeRows || [];
    }
    if (sql.includes('FROM product_variants pv') && sql.includes('pv.sku = ?')) {
      return config.skuRows || [];
    }
    if (sql.includes('WHERE (p.id = ? OR p.slug = ? OR p.barcode_short_name = ?)')) {
      return config.productRows || [];
    }
    if (sql.includes('SELECT product_id FROM product_barcodes WHERE barcode = ?')) {
      return config.existingBarcodeRows || [];
    }
    if (sql.includes('SELECT id FROM products WHERE slug = ?')) {
      return config.slugRows || [];
    }
    if (sql.includes('COALESCE(MAX(barcode_sequence)')) {
      return config.sequenceRows || [{ max_sequence: 4 }];
    }
    if (sql.includes('INSERT INTO products')) {
      state.inserts.products.push(params);
      return { insertId: 1 };
    }
    if (sql.includes('INSERT INTO product_barcodes')) {
      state.inserts.barcodes.push(params);
      return { insertId: 2 };
    }
    if (sql.includes('SELECT * FROM products WHERE id = ?')) {
      return config.createdProductRows || [];
    }
    return [];
  }

  return { query, state };
}

const productRow = {
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
  is_active: 1
};

test('normalizeScanCode trims input, strips quotes and handles empty values', () => {
  assert.equal(normalizeScanCode('  NP-1234  '), 'NP-1234');
  assert.equal(normalizeScanCode('"NP-1234"'), 'NP-1234');
  assert.equal(normalizeScanCode("'SKU-9'"), 'SKU-9');
  assert.equal(normalizeScanCode(''), '');
  assert.equal(normalizeScanCode(null), '');
  assert.equal(normalizeScanCode(undefined), '');
});

test('extractScanCode reads plain barcodes, QR JSON and QR URLs', () => {
  assert.deepEqual(
    extractScanCode('NP-1048'),
    { code: 'NP-1048', source: 'plain', payload: null }
  );

  assert.deepEqual(
    extractScanCode('{"barcode":"NP-7788","name":"Tote"}'),
    { code: 'NP-7788', source: 'qr', payload: { barcode: 'NP-7788', name: 'Tote' } }
  );

  assert.deepEqual(
    extractScanCode('{"sku":"SKU-55"}'),
    { code: 'SKU-55', source: 'qr', payload: { sku: 'SKU-55' } }
  );

  assert.equal(
    extractScanCode('https://www.npgrandshopping.com/products?barcode=NP-4321').code,
    'NP-4321'
  );

  assert.equal(
    extractScanCode('https://www.npgrandshopping.com/product/leather-tote').code,
    'leather-tote'
  );
});

test('normalizeNewProductPayload validates name and applies sensible defaults', () => {
  assert.throws(
    () => normalizeNewProductPayload({ scanned_code: 'NP-1000' }),
    /Product name is required/
  );

  assert.throws(
    () => normalizeNewProductPayload({ name: 'Tote' }),
    /scanned barcode or QR code is required/
  );

  const payload = normalizeNewProductPayload({
    name: 'Canvas Tote',
    scanned_code: 'NP-2000',
    mrp: '1499',
    purchase_rate: '600',
    gst_rate: '5',
    stock: '7'
  });

  assert.equal(payload.name, 'Canvas Tote');
  assert.equal(payload.scanned_code, 'NP-2000');
  assert.equal(payload.price, 1499);
  assert.equal(payload.mrp, 1499);
  assert.equal(payload.purchase_price, 600);
  assert.equal(payload.purchased_rate, '600');
  assert.equal(payload.gst_rate, 5);
  assert.equal(payload.gst_type, 'exclusive');
  assert.equal(payload.hsn_code, '4202');
  assert.equal(payload.stock, 7);
  assert.equal(payload.is_online, true);
});

test('buildPurchaseItemFromScan maps catalog values into a bill line', () => {
  const item = buildPurchaseItemFromScan(productRow, {
    id: 9,
    sku: 'LT-RED-M',
    color_name: 'Red',
    size_name: 'M',
    stock_quantity: 3
  }, 'NP-9999');

  assert.equal(item.product_id, 'leather-tote');
  assert.equal(item.product_name, 'Leather Tote');
  assert.equal(item.variant_id, '9');
  assert.equal(item.variant_info, 'Red / M');
  assert.equal(item.purchase_rate, '1800');
  assert.equal(item.mrp, '3499');
  assert.equal(item.gst_rate, '18');
  assert.equal(item.barcode, 'NP-9999');
  assert.equal(item.stock_quantity, 3);
});

test('resolveProductByScan finds an existing product by barcode', async () => {
  const db = createFakeDb({
    barcodeRows: [{
      ...productRow,
      matched_barcode: 'NP-1048',
      is_primary: 1,
      matched_variant_id: 9,
      matched_variant_sku: 'LT-RED-M',
      matched_color_name: 'Red',
      matched_size_name: 'M',
      matched_variant_stock: 3
    }]
  });

  const result = await resolveProductByScan(db.query, 'NP-1048');

  assert.equal(result.found, true);
  assert.equal(result.match_type, 'barcode');
  assert.equal(result.product_id, 'leather-tote');
  assert.equal(result.product_name, 'Leather Tote');
  assert.equal(result.barcode, 'NP-1048');
  assert.equal(result.variant.sku, 'LT-RED-M');
  assert.equal(result.item.variant_info, 'Red / M');
  assert.equal(db.state.calls[0].params[0], 'NP-1048');
});

test('resolveProductByScan falls back to variant SKU and product identifiers', async () => {
  const skuDb = createFakeDb({
    barcodeRows: [],
    skuRows: [{
      ...productRow,
      matched_variant_id: 12,
      matched_variant_sku: 'LT-BLK-L',
      matched_color_name: 'Black',
      matched_size_name: 'L',
      matched_variant_stock: 8
    }]
  });

  const skuResult = await resolveProductByScan(skuDb.query, 'LT-BLK-L');
  assert.equal(skuResult.found, true);
  assert.equal(skuResult.match_type, 'sku');
  assert.equal(skuResult.variant.id, 12);

  const productDb = createFakeDb({
    barcodeRows: [],
    skuRows: [],
    productRows: [{
      ...productRow,
      matched_variant_id: null,
      matched_variant_sku: null,
      matched_color_name: null,
      matched_size_name: null,
      matched_variant_stock: null
    }]
  });

  const productResult = await resolveProductByScan(productDb.query, 'leather-tote');
  assert.equal(productResult.found, true);
  assert.equal(productResult.match_type, 'product');
  assert.equal(productResult.variant, null);
  assert.equal(productResult.item.product_id, 'leather-tote');
});

test('resolveProductByScan extracts QR payloads and reports unknown codes', async () => {
  const db = createFakeDb();

  const result = await resolveProductByScan(db.query, '{"barcode":"NP-5566"}');

  assert.equal(result.found, false);
  assert.equal(result.scanned_code, 'NP-5566');
  assert.equal(result.source, 'qr');
  assert.equal(result.payload.barcode, 'NP-5566');
  assert.equal(db.state.calls[0].params[0], 'NP-5566');
});

test('createProductFromScan creates the product and links the scanned barcode', async () => {
  const db = createFakeDb({
    existingBarcodeRows: [],
    slugRows: [],
    sequenceRows: [{ max_sequence: 4 }],
    createdProductRows: [{
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
    }]
  });

  const result = await createProductFromScan(db.query, {
    name: 'Canvas Tote',
    scanned_code: 'NP-2000',
    mrp: 1499,
    purchase_rate: 600,
    gst_rate: 5
  }, { vendorId: 3, userId: 7 });

  assert.equal(result.product.id, 'canvas-tote');
  assert.equal(result.barcode, 'NP-2000');
  assert.equal(result.barcode_sequence, 5);
  assert.equal(db.state.inserts.products.length, 1);
  const productParams = db.state.inserts.products[0];
  assert.equal(productParams[2], 'Canvas Tote');
  assert.equal(productParams[9], 3);
  assert.equal(db.state.inserts.barcodes.length, 1);
  assert.deepEqual(db.state.inserts.barcodes[0], ['canvas-tote', 'NP-2000', 5, 7]);
});

test('createProductFromScan rejects duplicate barcodes and resolves slug collisions', async () => {
  const duplicateDb = createFakeDb({
    existingBarcodeRows: [{ product_id: 'existing-product' }]
  });

  await assert.rejects(
    () => createProductFromScan(duplicateDb.query, { name: 'Tote', scanned_code: 'NP-2000' }),
    /already linked to another product/
  );

  const collisionDb = createFakeDb({
    existingBarcodeRows: [],
    slugRows: [{ id: 'canvas-tote' }],
    sequenceRows: [{ max_sequence: 0 }],
    createdProductRows: []
  });

  const result = await createProductFromScan(collisionDb.query, {
    name: 'Canvas Tote',
    scanned_code: 'NP-3000'
  });

  assert.notEqual(result.product.id, 'canvas-tote');
  assert.match(result.product.id, /^canvas-tote-\d{4}$/);
});
