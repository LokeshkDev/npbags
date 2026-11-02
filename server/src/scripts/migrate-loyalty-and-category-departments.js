const { query } = require('../config/db');

async function migrate() {
  console.log('[Migration] Updating categories gender column and adding NPPoints columns...');
  try {
    const catCols = await query('SHOW COLUMNS FROM categories');
    const genderCol = catCols.find(c => c.Field === 'gender');
    if (genderCol) {
      await query("ALTER TABLE categories MODIFY COLUMN gender VARCHAR(255) NOT NULL DEFAULT 'all'");
      console.log('✓ categories.gender updated to VARCHAR(255)');
    }

    const userCols = await query('SHOW COLUMNS FROM users');
    if (!userCols.find(c => c.Field === 'np_points')) {
      await query('ALTER TABLE users ADD COLUMN np_points INT NOT NULL DEFAULT 0');
      console.log('✓ Added np_points column to users table');
    } else {
      console.log('✓ users.np_points already exists');
    }

    const orderCols = await query('SHOW COLUMNS FROM orders');
    if (!orderCols.find(c => c.Field === 'points_redeemed')) {
      await query('ALTER TABLE orders ADD COLUMN points_redeemed INT NOT NULL DEFAULT 0');
      console.log('✓ Added points_redeemed to orders table');
    }
    if (!orderCols.find(c => c.Field === 'points_discount')) {
      await query('ALTER TABLE orders ADD COLUMN points_discount DECIMAL(10,2) NOT NULL DEFAULT 0.00');
      console.log('✓ Added points_discount to orders table');
    }
    if (!orderCols.find(c => c.Field === 'points_earned')) {
      await query('ALTER TABLE orders ADD COLUMN points_earned INT NOT NULL DEFAULT 0');
      console.log('✓ Added points_earned to orders table');
    }

    console.log('[Migration] All migrations completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[Migration] Error:', err);
    process.exit(1);
  }
}

migrate();

