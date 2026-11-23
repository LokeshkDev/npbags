const { query, pool } = require('../config/db');

async function migrateVariantModelName() {
  try {
    const cols = await query('SHOW COLUMNS FROM product_variants');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('model_name')) {
      await query('ALTER TABLE product_variants ADD COLUMN model_name VARCHAR(150) NULL AFTER color_hex');
      console.log('✅ Added model_name column to product_variants');
    }

    // Stock should no longer default to 50 on new variants
    const stockCol = cols.find(c => c.Field === 'stock_quantity');
    if (stockCol && String(stockCol.Default) === '50') {
      await query('ALTER TABLE product_variants ALTER COLUMN stock_quantity SET DEFAULT 0');
      console.log('✅ Changed stock_quantity default from 50 to 0');
    }
  } catch (err) {
    console.error('❌ Error migrating product_variants model_name:', err.message);
  }
}

module.exports = { migrateVariantModelName };

if (require.main === module) {
  migrateVariantModelName()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error('Migration failed:', error);
      try { await pool.end(); } catch (_) {}
      process.exit(1);
    });
}
