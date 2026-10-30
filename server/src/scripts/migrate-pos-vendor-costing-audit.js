const { query } = require('../config/db');

async function migrate() {
  console.log('--- Starting POS, Vendor, Costing, Aging & Audit Logs Migration ---');

  // 1. Create Vendors Table
  console.log('1. Ensuring vendors table exists...');
  await query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      company_name VARCHAR(255) NULL,
      contact_person VARCHAR(255) NULL,
      phone VARCHAR(50) NULL,
      email VARCHAR(255) NULL,
      gstin VARCHAR(50) NULL,
      address TEXT NULL,
      city VARCHAR(100) NULL,
      state VARCHAR(100) NULL,
      pincode VARCHAR(20) NULL,
      bank_details TEXT NULL,
      notes TEXT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Create Sales Persons Table
  console.log('2. Ensuring sales_persons table exists...');
  await query(`
    CREATE TABLE IF NOT EXISTS sales_persons (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      code VARCHAR(50) UNIQUE NULL,
      phone VARCHAR(50) NULL,
      commission_percent DECIMAL(5,2) DEFAULT 0.00,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Create Audit Logs Table
  console.log('3. Ensuring audit_logs table exists...');
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NULL,
      action VARCHAR(50) NOT NULL,
      summary TEXT NOT NULL,
      old_values JSON NULL,
      new_values JSON NULL,
      product_id VARCHAR(100) NULL,
      product_name VARCHAR(255) NULL,
      product_image VARCHAR(500) NULL,
      performed_by VARCHAR(100) DEFAULT 'Admin Staff',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_entity (entity_type, entity_id),
      INDEX idx_audit_action (action),
      INDEX idx_audit_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4. Alter products table: add vendor_id, mrp, gst_type, gst_rate, landing_cost, purchase_margin, landing_margin
  console.log('4. Checking products table columns...');
  const prodCols = await query('DESCRIBE products');
  const prodColNames = prodCols.map(c => c.Field);

  const productColsToAdd = [
    { name: 'vendor_id', def: 'INT NULL' },
    { name: 'mrp', def: 'DECIMAL(10,2) NULL' },
    { name: 'gst_type', def: "ENUM('inclusive', 'exclusive') DEFAULT 'inclusive'" },
    { name: 'gst_rate', def: 'DECIMAL(5,2) DEFAULT 18.00' },
    { name: 'landing_cost', def: 'DECIMAL(10,2) NULL' },
    { name: 'purchase_margin', def: 'DECIMAL(5,2) NULL' },
    { name: 'landing_margin', def: 'DECIMAL(5,2) NULL' }
  ];

  for (const col of productColsToAdd) {
    if (!prodColNames.includes(col.name)) {
      console.log(`Adding ${col.name} to products...`);
      await query(`ALTER TABLE products ADD COLUMN ${col.name} ${col.def}`);
    }
  }

  // 5. Alter orders table: add sales_person_id, sales_person_name, discount_type, discount_value
  console.log('5. Checking orders table columns...');
  const orderCols = await query('DESCRIBE orders');
  const orderColNames = orderCols.map(c => c.Field);

  const orderColsToAdd = [
    { name: 'sales_person_id', def: 'INT NULL' },
    { name: 'sales_person_name', def: 'VARCHAR(150) NULL' },
    { name: 'discount_type', def: "ENUM('flat', 'percentage') DEFAULT 'flat'" },
    { name: 'discount_value', def: 'DECIMAL(10,2) DEFAULT 0.00' }
  ];

  for (const col of orderColsToAdd) {
    if (!orderColNames.includes(col.name)) {
      console.log(`Adding ${col.name} to orders...`);
      await query(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.def}`);
    }
  }

  // 6. Alter order_items table: add sales_person_id, sales_person_name
  console.log('6. Checking order_items table columns...');
  const itemCols = await query('DESCRIBE order_items');
  const itemColNames = itemCols.map(c => c.Field);

  const itemColsToAdd = [
    { name: 'sales_person_id', def: 'INT NULL' },
    { name: 'sales_person_name', def: 'VARCHAR(150) NULL' }
  ];

  for (const col of itemColsToAdd) {
    if (!itemColNames.includes(col.name)) {
      console.log(`Adding ${col.name} to order_items...`);
      await query(`ALTER TABLE order_items ADD COLUMN ${col.name} ${col.def}`);
    }
  }

  // 7. Seed sample vendors if empty
  const vendors = await query('SELECT COUNT(*) AS count FROM vendors');
  if (vendors[0].count === 0) {
    console.log('Seeding initial vendors...');
    await query(`
      INSERT INTO vendors (name, company_name, contact_person, phone, email, gstin, city, state)
      VALUES 
      ('Madras Leather Works', 'Madras Leather Co.', 'K. Ramanathan', '+91 98401 22334', 'sales@madrasleather.com', '33AAACM1234F1Z5', 'Chennai', 'Tamil Nadu'),
      ('Royal Handbags & Accessories', 'Royal Crafts Pvt Ltd', 'Anita Sharma', '+91 98112 55667', 'contact@royalcrafts.in', '27AABCR5678P1ZQ', 'Mumbai', 'Maharashtra'),
      ('Zenith Lifestyle Supply', 'Zenith Retail Solutions', 'S. Vignesh', '+91 97909 88990', 'vignesh@zenithsupply.com', '33BBBPZ9012K1Z9', 'Coimbatore', 'Tamil Nadu')
    `);
  }

  // 8. Seed sample sales persons if empty
  const salesPersons = await query('SELECT COUNT(*) AS count FROM sales_persons');
  if (salesPersons[0].count === 0) {
    console.log('Seeding initial sales persons...');
    await query(`
      INSERT INTO sales_persons (name, code, phone, commission_percent)
      VALUES 
      ('Priya S.', 'SP-01', '+91 98765 43210', 2.0),
      ('Karthik R.', 'SP-02', '+91 98765 43211', 2.0),
      ('Deepa M.', 'SP-03', '+91 98765 43212', 2.5),
      ('Suresh Kumar', 'SP-04', '+91 98765 43213', 1.5)
    `);
  }

  // 9. Seed initial audit log if empty
  const audits = await query('SELECT COUNT(*) AS count FROM audit_logs');
  if (audits[0].count === 0) {
    console.log('Seeding initial audit logs...');
    await query(`
      INSERT INTO audit_logs (entity_type, entity_id, action, summary, product_name, product_image, performed_by)
      VALUES 
      ('system', 'init', 'system_init', 'System initialized with POS, Vendor Management & Costing Modules', 'NP Grand Storefront', '/assets/brand-logo.png', 'Admin System')
    `);
  }

  console.log('--- Migration Completed Successfully! ---');
}

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });

