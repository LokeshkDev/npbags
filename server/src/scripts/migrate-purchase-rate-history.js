const { query, pool } = require('../config/db');

async function migrate() {
  console.log('--- Creating product_purchase_rate_history table ---');

  await query(`
    CREATE TABLE IF NOT EXISTS product_purchase_rate_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id VARCHAR(128) NOT NULL,
      old_rate VARCHAR(64) NULL,
      new_rate VARCHAR(64) NULL,
      changed_by INT NULL,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pprh_product (product_id),
      CONSTRAINT fk_pprh_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  console.log('product_purchase_rate_history is ready.');
}

migrate()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Migration failed:', error.message);
    try {
      await pool.end();
    } catch (_) {}
    process.exit(1);
  });
