/**
 * Backfill branch_stocks rows so every existing product is associated with
 * every regional branch (all branches except MAIN) as Hidden with 0 stock.
 * Existing rows are never overwritten.
 */

const { query, pool } = require('../config/db');

async function run() {
  console.log('--- Backfilling branch product associations ---');

  const branches = await query(
    "SELECT id, name, code FROM branches WHERE UPPER(CODE) <> 'MAIN' ORDER BY id ASC"
  );
  const products = await query('SELECT id, name FROM products ORDER BY id ASC');

  if (branches.length === 0) {
    console.log('No regional branches found. Nothing to do.');
    return;
  }
  if (products.length === 0) {
    console.log('No products found. Nothing to do.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const branch of branches) {
    for (const product of products) {
      const existing = await query(
        'SELECT id FROM branch_stocks WHERE branch_id = ? AND product_id = ? LIMIT 1',
        [branch.id, product.id]
      );
      if (existing.length > 0) {
        skipped += 1;
        continue;
      }
      await query(
        `INSERT INTO branch_stocks (branch_id, product_id, stock, low_stock_threshold, is_active)
         VALUES (?, ?, 0, 5, 0)`,
        [branch.id, product.id]
      );
      created += 1;
    }
  }

  console.log(`Regional branches: ${branches.length}`);
  console.log(`Products: ${products.length}`);
  console.log(`Hidden associations created: ${created}`);
  console.log(`Existing associations left untouched: ${skipped}`);
  console.log('--- Done ---');
}

run()
  .catch((error) => {
    console.error('Backfill failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await pool.end();
    } catch (_) {
      // ignore shutdown errors
    }
  });
