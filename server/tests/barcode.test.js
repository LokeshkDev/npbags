const test = require('node:test');
const assert = require('node:assert/strict');

const { generateProductBarcodes } = require('../src/utils/barcode');

function createFakePool(config = {}) {
  const inserts = [];
  const calls = [];

  async function query(sql, params = []) {
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    calls.push({ sql: normalized, params });

    if (normalized.includes('is_primary = 1 AND status')) {
      return config.primaryRows || [];
    }
    if (normalized.includes('variant_id = ? AND status')) {
      return config.variantIdRows || [];
    }
    if (normalized.includes('size <=> ? AND color <=> ?')) {
      return config.variantRows || [];
    }
    if (normalized.includes('SELECT id FROM product_barcodes WHERE barcode = ?')) {
      return config.barcodeRows || [];
    }
    if (normalized.includes('COALESCE(MAX(barcode_sequence)')) {
      return [{ max_sequence: inserts.length }];
    }
    if (normalized.includes('INSERT INTO product_barcodes')) {
      inserts.push({ sql: normalized, params });
      return { insertId: inserts.length };
    }

    return [];
  }

  return { pool: { query }, inserts, calls };
}

test('generateProductBarcodes creates a primary and per-variant barcode', async () => {
  const fake = createFakePool();

  const generated = await generateProductBarcodes(
    'canvas-tote',
    [{ color_name: 'Red', size_name: 'M' }],
    7,
    fake.pool
  );

  assert.equal(generated.length, 2);
  assert.equal(generated[0].type, 'primary');
  assert.match(generated[0].barcode, /^NP-\d{4}$/);
  assert.equal(generated[0].barcode_sequence, 1);

  assert.equal(generated[1].type, 'variant');
  assert.equal(generated[1].color, 'Red');
  assert.equal(generated[1].size, 'M');
  assert.equal(generated[1].barcode_sequence, 2);

  assert.equal(fake.inserts.length, 2);
  const primaryParams = fake.inserts[0].params;
  assert.deepEqual(primaryParams.slice(0, 1), ['canvas-tote']);
  assert.equal(primaryParams[1], null, 'primary barcode has no variant');
  assert.equal(primaryParams[6], 1, 'primary flag is set');
  assert.equal(primaryParams[7], 7, 'created_by is recorded');

  const variantParams = fake.inserts[1].params;
  assert.equal(variantParams[2], 'M');
  assert.equal(variantParams[3], 'Red');
  assert.equal(variantParams[6], 0, 'variant barcode is not primary');
  assert.equal(variantParams[7], 7);
});

test('generateProductBarcodes skips the primary barcode when one already exists', async () => {
  const fake = createFakePool({
    primaryRows: [{ id: 1, barcode: 'NP-1234', is_primary: 1 }]
  });

  const generated = await generateProductBarcodes(
    'canvas-tote',
    [{ color_name: 'Blue', size_name: 'L' }],
    null,
    fake.pool
  );

  assert.equal(generated.length, 1);
  assert.equal(generated[0].type, 'variant');
  assert.equal(fake.inserts.length, 1);
  assert.equal(fake.inserts[0].params[6], 0);
});

test('generateProductBarcodes skips variants that already have a barcode', async () => {
  const fake = createFakePool({
    primaryRows: [{ id: 1 }],
    variantIdRows: [{ id: 2, variant_id: 99 }]
  });

  const generated = await generateProductBarcodes(
    'canvas-tote',
    [{ id: 99, color_name: 'Black', size_name: 'S' }],
    null,
    fake.pool
  );

  assert.deepEqual(generated, []);
  assert.equal(fake.inserts.length, 0);
  assert.equal(
    fake.calls.some((call) => call.sql.includes('variant_id = ? AND status')),
    true
  );
});
