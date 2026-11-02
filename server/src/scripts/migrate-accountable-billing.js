const { query } = require('../config/db');

async function migrate() {
  console.log('--- Migrating Database for Pakka/Kaccha Billing ---');
  try {
    const columns = await query("SHOW COLUMNS FROM orders LIKE 'is_accountable'");
    if (columns.length === 0) {
      console.log('Adding is_accountable column to orders table...');
      await query(`
        ALTER TABLE orders 
        ADD COLUMN is_accountable TINYINT(1) NOT NULL DEFAULT 1 
        AFTER order_type
      `);
      console.log('is_accountable column added successfully.');
    } else {
      console.log('is_accountable column already exists.');
    }

    // Add index if not exists
    try {
      await query(`CREATE INDEX idx_orders_accountable ON orders (is_accountable, created_at)`);
      console.log('Index idx_orders_accountable created.');
    } catch (e) {
      console.log('Index notice:', e.message);
    }

    console.log('--- Migration Completed Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();

