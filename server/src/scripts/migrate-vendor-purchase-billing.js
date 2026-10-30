const { query, pool } = require('../config/db');

async function columnExists(table, column) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function indexExists(table, indexName) {
  const rows = await query(
    `SELECT COUNT(*) AS count
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName]
  );
  return Number(rows[0]?.count || 0) > 0;
}

async function migrate() {
  console.log('--- Starting Vendor Purchase Bills, Billing Hold & Barcode Sequence Migration ---');

  if (!(await columnExists('products', 'purchased_rate'))) {
    console.log('Adding products.purchased_rate (alphanumeric)...');
    await query('ALTER TABLE products ADD COLUMN purchased_rate VARCHAR(64) NULL AFTER purchase_price');
  }

  if (!(await columnExists('product_barcodes', 'barcode_sequence'))) {
    console.log('Adding product_barcodes.barcode_sequence...');
    await query('ALTER TABLE product_barcodes ADD COLUMN barcode_sequence INT NULL AFTER barcode');
  }

  console.log('Backfilling barcode sequence numbers for existing barcodes...');
  await query('UPDATE product_barcodes SET barcode_sequence = id WHERE barcode_sequence IS NULL');

  if (!(await indexExists('product_barcodes', 'uk_barcode_sequence'))) {
    try {
      await query('ALTER TABLE product_barcodes ADD UNIQUE KEY uk_barcode_sequence (barcode_sequence)');
    } catch (error) {
      console.warn('Could not add unique barcode sequence index (existing data may need review):', error.message);
    }
  }

  console.log('Creating purchase_bills table...');
  await query(`
    CREATE TABLE IF NOT EXISTS purchase_bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      vendor_id INT NOT NULL,
      bill_number VARCHAR(100) NOT NULL UNIQUE,
      purchase_date DATE NOT NULL,
      subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      additional_charges DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      payment_status ENUM('Unpaid', 'Partially Paid', 'Paid') NOT NULL DEFAULT 'Unpaid',
      amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      outstanding_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      notes TEXT NULL,
      status ENUM('draft', 'confirmed', 'cancelled') NOT NULL DEFAULT 'draft',
      stock_applied TINYINT(1) NOT NULL DEFAULT 0,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_pb_vendor (vendor_id),
      INDEX idx_pb_status (payment_status),
      INDEX idx_pb_date (purchase_date),
      CONSTRAINT fk_purchase_bills_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('Creating purchase_bill_items table...');
  await query(`
    CREATE TABLE IF NOT EXISTS purchase_bill_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      purchase_bill_id INT NOT NULL,
      product_id VARCHAR(128) NULL,
      variant_id INT NULL,
      product_name VARCHAR(255) NOT NULL,
      variant_info VARCHAR(150) NULL,
      quantity INT NOT NULL DEFAULT 1,
      purchase_rate VARCHAR(64) NULL,
      rate_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pbi_bill (purchase_bill_id),
      CONSTRAINT fk_purchase_bill_items_bill FOREIGN KEY (purchase_bill_id) REFERENCES purchase_bills(id) ON DELETE CASCADE,
      CONSTRAINT fk_purchase_bill_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchase_bill_items_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('Creating purchase_bill_payments table...');
  await query(`
    CREATE TABLE IF NOT EXISTS purchase_bill_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      purchase_bill_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      payment_date DATE NOT NULL,
      payment_method VARCHAR(64) DEFAULT 'Cash',
      notes VARCHAR(255) NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pbp_bill (purchase_bill_id),
      CONSTRAINT fk_purchase_bill_payments_bill FOREIGN KEY (purchase_bill_id) REFERENCES purchase_bills(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('Creating held_bills table...');
  await query(`
    CREATE TABLE IF NOT EXISTS held_bills (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reference VARCHAR(64) NOT NULL UNIQUE,
      customer_name VARCHAR(128) DEFAULT 'Walk-in Customer',
      customer_phone VARCHAR(32) NULL,
      customer_email VARCHAR(191) NULL,
      items JSON NOT NULL,
      subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      discount_type ENUM('flat', 'percent', 'percentage') NOT NULL DEFAULT 'flat',
      discount_value DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      payment_method VARCHAR(64) DEFAULT 'Cash',
      sales_person_id INT NULL,
      sales_person_name VARCHAR(150) NULL,
      notes TEXT NULL,
      status ENUM('held', 'completed', 'cancelled') NOT NULL DEFAULT 'held',
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_held_status (status),
      INDEX idx_held_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log('--- Migration Completed Successfully ---');
}

module.exports = { ensureVendorBillingTables: migrate };

if (require.main === module) {
  migrate()
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
