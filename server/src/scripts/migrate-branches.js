const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

async function migrateBranches() {
  console.log('--- Starting Branches & Role Migration ---');

  // 1. Create branches table
  await query(`
    CREATE TABLE IF NOT EXISTS branches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      code VARCHAR(32) NOT NULL UNIQUE,
      phone VARCHAR(32) NULL,
      email VARCHAR(128) NULL,
      address TEXT NULL,
      city VARCHAR(64) NULL,
      state VARCHAR(64) NULL,
      pincode VARCHAR(16) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ branches table verified');

  // 2. Check and add branch_id and allowed_menus columns to users
  const userCols = await query('DESCRIBE users');
  const colNames = userCols.map(c => c.Field);

  if (!colNames.includes('branch_id')) {
    await query('ALTER TABLE users ADD COLUMN branch_id INT NULL AFTER role');
    console.log('✓ Added branch_id to users');
  }

  if (!colNames.includes('allowed_menus')) {
    await query('ALTER TABLE users ADD COLUMN allowed_menus TEXT NULL AFTER branch_id');
    console.log('✓ Added allowed_menus to users');
  }

  // 3. Update role ENUM to include branch_admin and branch_staff
  await query(`
    ALTER TABLE users MODIFY COLUMN role ENUM('customer', 'admin', 'branch_admin', 'branch_staff') NOT NULL DEFAULT 'customer'
  `);
  console.log('✓ Updated users role enum');

  // 4. Seed default branches: Main Head Store and manali Branch
  const mainBranch = await query('SELECT id FROM branches WHERE code = ?', ['MAIN']);
  let mainBranchId = null;
  if (mainBranch.length === 0) {
    const res = await query(
      `INSERT INTO branches (name, code, phone, email, address, city, state, pincode, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      ['NP Grand Main Store', 'MAIN', '+91 98765 43210', 'admin@npgrand.com', 'Main Bazaar Road', 'Chennai', 'Tamil Nadu', '600001']
    );
    mainBranchId = res.insertId;
    console.log('✓ Created Main Head Store branch with ID:', mainBranchId);
  } else {
    mainBranchId = mainBranch[0].id;
    console.log('✓ Main branch already exists with ID:', mainBranchId);
  }

  // Seed manali Branch
  const manaliBranch = await query('SELECT id FROM branches WHERE code = ?', ['manali']);
  let manaliBranchId = null;
  if (manaliBranch.length === 0) {
    const res = await query(
      `INSERT INTO branches (name, code, phone, email, address, city, state, pincode, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      ['manali Branch', 'manali', '+91 98400 12345', 'manali@npgrand.com', 'No. 45, manali Street, George Town', 'Chennai', 'Tamil Nadu', '600001']
    );
    manaliBranchId = res.insertId;
    console.log('✓ Created manali Branch with ID:', manaliBranchId);
  } else {
    manaliBranchId = manaliBranch[0].id;
    console.log('✓ manali branch already exists with ID:', manaliBranchId);
  }

  // Link existing admin to main store
  await query('UPDATE users SET branch_id = ? WHERE role = "admin" AND branch_id IS NULL', [mainBranchId]);

  // 5. Create or update manali Branch user: manali@npgrand.com
  const existingUser = await query('SELECT id FROM users WHERE email = ?', ['manali@npgrand.com']);
  const defaultPasswordHash = await bcrypt.hash('manali@123', 10);
  const allowedMenus = JSON.stringify(['dashboard', 'pos', 'orders', 'inventory', 'products', 'customers']);

  if (existingUser.length === 0) {
    await query(
      `INSERT INTO users (name, email, password, role, branch_id, allowed_menus, phone)
       VALUES (?, ?, ?, 'branch_admin', ?, ?, ?)`,
      ['manali Branch Admin', 'manali@npgrand.com', defaultPasswordHash, manaliBranchId, allowedMenus, '+91 98400 12345']
    );
    console.log('✓ Created manali Branch user: manali@npgrand.com / manali@123');
  } else {
    await query(
      `UPDATE users
       SET role = 'branch_admin', branch_id = ?, allowed_menus = ?, password = ?
       WHERE email = 'manali@npgrand.com'`,
      [manaliBranchId, allowedMenus, defaultPasswordHash]
    );
    console.log('✓ Updated manali Branch user: manali@npgrand.com / manali@123');
  }

  console.log('--- Branches & Role Migration Complete ---');
  process.exit(0);
}

migrateBranches().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

