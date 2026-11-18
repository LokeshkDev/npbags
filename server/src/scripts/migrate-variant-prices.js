const { query } = require('../config/db');

async function migrateVariantPrices() {
  try {
    const cols = await query('SHOW COLUMNS FROM product_variants');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('purchase_price')) {
      await query('ALTER TABLE product_variants ADD COLUMN purchase_price DECIMAL(10,2) NULL DEFAULT NULL AFTER stock_quantity');
      console.log('✅ Added purchase_price column to product_variants');
    }

    if (!colNames.includes('price')) {
      await query('ALTER TABLE product_variants ADD COLUMN price DECIMAL(10,2) NULL DEFAULT NULL AFTER purchase_price');
      console.log('✅ Added price column to product_variants');
    }

    if (!colNames.includes('sale_price')) {
      await query('ALTER TABLE product_variants ADD COLUMN sale_price DECIMAL(10,2) NULL DEFAULT NULL AFTER price');
      console.log('✅ Added sale_price column to product_variants');
    }

    if (!colNames.includes('mrp')) {
      await query('ALTER TABLE product_variants ADD COLUMN mrp DECIMAL(10,2) NULL DEFAULT NULL AFTER sale_price');
      console.log('✅ Added mrp column to product_variants');
    }

    // Backfill any variants missing price, mrp or purchase_price from parent product
    await query(`
      UPDATE product_variants pv
      JOIN products p ON pv.product_id = p.id
      SET 
        pv.purchase_price = COALESCE(
          pv.purchase_price,
          p.purchase_price,
          CASE WHEN p.purchased_rate REGEXP '^[0-9]+(\\.[0-9]+)?$' THEN CAST(p.purchased_rate AS DECIMAL(10,2)) ELSE NULL END
        ),
        pv.price = COALESCE(pv.price, p.price),
        pv.sale_price = COALESCE(pv.sale_price, p.sale_price),
        pv.mrp = COALESCE(pv.mrp, p.mrp, p.price)
      WHERE pv.price IS NULL OR pv.mrp IS NULL OR pv.purchase_price IS NULL
    `);
  } catch (err) {
    console.error('❌ Error migrating product_variants prices:', err.message);
  }
}

module.exports = { migrateVariantPrices };
