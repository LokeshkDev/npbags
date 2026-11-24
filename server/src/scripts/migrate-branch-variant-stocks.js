const { query } = require('../config/db');

async function migrateBranchVariantStocks() {
  console.log('Running migration: branch_variant_stocks...');
  await query(`
    CREATE TABLE IF NOT EXISTS branch_variant_stocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      branch_id INT NOT NULL,
      product_id VARCHAR(128) NOT NULL,
      variant_id INT NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      low_stock_threshold INT NOT NULL DEFAULT 5,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_branch_variant (branch_id, variant_id),
      KEY idx_branch_prod (branch_id, product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('✓ branch_variant_stocks table created or already exists.');
}

if (require.main === module) {
  migrateBranchVariantStocks()
    .then(() => {
      console.log('Migration finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { migrateBranchVariantStocks };
