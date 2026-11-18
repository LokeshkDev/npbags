const { query } = require('../config/db');

async function migrateBrands() {
  console.log('--- Starting Brands Table Migration ---');
  try {
    // 1. Ensure brands table exists
    await query(`
      CREATE TABLE IF NOT EXISTS brands (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        logo_url VARCHAR(500) NULL DEFAULT '',
        sort_order INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Make logo_url nullable if table already existed
    await query(`ALTER TABLE brands MODIFY COLUMN logo_url VARCHAR(500) NULL DEFAULT ''`);

    // 3. Add unique index on name if not present
    try {
      const idxRows = await query(`
        SELECT COUNT(*) AS count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'brands' AND INDEX_NAME = 'uq_brand_name'
      `);
      if (Number(idxRows[0]?.count || 0) === 0) {
        await query(`ALTER TABLE brands ADD UNIQUE KEY uq_brand_name (name)`);
      }
    } catch (_) {}

    // 4. Sync existing distinct brands from products table
    const syncRes = await query(`
      INSERT IGNORE INTO brands (name, logo_url, is_active)
      SELECT DISTINCT TRIM(brand), '', 1
      FROM products
      WHERE brand IS NOT NULL AND TRIM(brand) != ''
    `);
    console.log(`Synced ${syncRes.affectedRows || 0} existing brands from products table.`);

    const allBrands = await query('SELECT id, name FROM brands ORDER BY name ASC');
    console.log(`Total brands now available: ${allBrands.length}`);
    console.log('Sample brands:', allBrands.slice(0, 10).map(b => b.name).join(', '));
    console.log('--- Brands Migration Completed Successfully ---');
  } catch (err) {
    console.error('Brands migration error:', err);
    throw err;
  }
}

if (require.main === module) {
  migrateBrands()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = migrateBrands;
