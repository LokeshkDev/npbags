const { query } = require('../config/db');

async function migrate() {
  console.log('[Migration] Adding gender column to categories and products...');
  try {
    // 1. Check categories table
    const catCols = await query(`DESCRIBE categories`);
    const hasCatGender = catCols.some(c => c.Field === 'gender');
    if (!hasCatGender) {
      await query(`ALTER TABLE categories ADD COLUMN gender VARCHAR(32) NOT NULL DEFAULT 'all' AFTER display_order`);
      console.log('[Migration] Added column `gender` to categories table.');
    } else {
      console.log('[Migration] `gender` column already exists in categories table.');
    }

    // 2. Check products table
    const prodCols = await query(`DESCRIBE products`);
    const hasProdGender = prodCols.some(c => c.Field === 'gender');
    if (!hasProdGender) {
      await query(`ALTER TABLE products ADD COLUMN gender VARCHAR(32) NOT NULL DEFAULT 'all' AFTER category_id`);
      console.log('[Migration] Added column `gender` to products table.');
    } else {
      console.log('[Migration] `gender` column already exists in products table.');
    }

    // 3. Smart backfill based on category names / keywords
    await query(`UPDATE categories SET gender = 'women' WHERE LOWER(name) LIKE '%women%' OR LOWER(slug) LIKE '%women%' OR LOWER(name) LIKE '%handbag%' OR LOWER(slug) LIKE '%handbag%'`);
    await query(`UPDATE categories SET gender = 'men' WHERE LOWER(name) LIKE '%men%' AND LOWER(name) NOT LIKE '%women%' OR LOWER(slug) LIKE '%men%' AND LOWER(slug) NOT LIKE '%women%'`);
    await query(`UPDATE categories SET gender = 'kids' WHERE LOWER(name) LIKE '%kid%' OR LOWER(slug) LIKE '%kid%'`);

    // Backfill products based on category gender or name
    await query(`UPDATE products SET gender = 'women' WHERE LOWER(name) LIKE '%women%' OR category_id IN (SELECT id FROM categories WHERE gender = 'women')`);
    await query(`UPDATE products SET gender = 'men' WHERE (LOWER(name) LIKE '%men%' AND LOWER(name) NOT LIKE '%women%') OR category_id IN (SELECT id FROM categories WHERE gender = 'men')`);

    console.log('[Migration] Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Migration Error]', err);
    process.exit(1);
  }
}

migrate();

