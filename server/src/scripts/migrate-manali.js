const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

async function runMigration() {
  console.log('--- Step 1: Updating manali to Manali Branch ---');
  
  // 1. Update branch in branches table
  await query(
    `UPDATE branches 
     SET name = 'Manali Branch', code = 'MANALI', email = 'manali@npgrand.com', address = 'No. 12, Manali High Road, Chennai, Tamil Nadu - 600068'
     WHERE code = 'manali' OR name LIKE '%manali%'`
  );

  // 2. Update branch admin user
  const passHash = await bcrypt.hash('Manali@123', 10);
  await query(
    `UPDATE users
     SET name = 'Manali Branch Admin', email = 'manali@npgrand.com', password = ?
     WHERE email = 'manali@npgrand.com' OR name LIKE '%manali%'`,
    [passHash]
  );
  console.log('✓ Manali Branch and user credentials updated');

  // 3. Add branch_id to orders table if not exists
  const orderCols = await query('DESCRIBE orders');
  const hasBranch = orderCols.some(c => c.Field === 'branch_id');
  if (!hasBranch) {
    await query('ALTER TABLE orders ADD COLUMN branch_id INT NULL AFTER user_id');
    await query('ALTER TABLE orders ADD INDEX idx_orders_branch_id (branch_id)');
    console.log('✓ Added branch_id column to orders table');
  } else {
    console.log('✓ orders table already has branch_id');
  }

  // 4. Create branch_stocks table
  await query(`
    CREATE TABLE IF NOT EXISTS branch_stocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      branch_id INT NOT NULL,
      product_id VARCHAR(64) NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      low_stock_threshold INT NOT NULL DEFAULT 10,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_branch_product (branch_id, product_id),
      INDEX idx_branch (branch_id),
      INDEX idx_product (product_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ branch_stocks table verified/created');

  // Verify
  const branches = await query('SELECT id, name, code, email FROM branches');
  console.log('Current branches:', branches);
  const users = await query('SELECT id, name, email, role, branch_id FROM users WHERE role LIKE "%branch%"');
  console.log('Branch users:', users);
}

runMigration()
  .then(() => {
    console.log('--- Migration Finished Successfully ---');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
