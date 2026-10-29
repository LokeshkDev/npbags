/**
 * Database Migration Script: Barcode Management, Inventory Tracking & POS System
 * For NP Grand Shopping (https://www.npgrandshopping.com)
 */

const { query } = require('../config/db');

async function migrate() {
  console.log('[Migration] Starting Barcode & POS Database Migration...');

  try {
    // 1. Alter products table: add barcode and POS inventory columns if they don't exist
    console.log('[Migration] Updating products table columns...');
    const productCols = [
      { name: 'barcode_short_name', def: 'VARCHAR(150) NULL' },
      { name: 'purchase_price', def: 'DECIMAL(10,2) NULL DEFAULT 0.00' },
      { name: 'hsn_code', def: "VARCHAR(50) DEFAULT '4202'" },
      { name: 'stock', def: 'INT DEFAULT 50' },
      { name: 'low_stock_threshold', def: 'INT DEFAULT 5' },
      { name: 'is_online', def: 'TINYINT(1) DEFAULT 1' },
      { name: 'is_offline', def: 'TINYINT(1) DEFAULT 1' }
    ];

    for (const col of productCols) {
      try {
        await query(`ALTER TABLE products ADD COLUMN ${col.name} ${col.def}`);
        console.log(`[Migration] Added column ${col.name} to products table`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column name')) {
          console.log(`[Migration] Column ${col.name} already exists on products table`);
        } else {
          console.warn(`[Migration] Warning adding ${col.name}:`, err.message);
        }
      }
    }

    // 2. Alter orders table: add POS fields and GST breakdown
    console.log('[Migration] Updating orders table columns...');
    const orderCols = [
      { name: 'received_amount', def: 'DECIMAL(10,2) NULL' },
      { name: 'balance_amount', def: 'DECIMAL(10,2) NULL' },
      { name: 'gst_rate', def: 'DECIMAL(5,2) NULL' },
      { name: 'is_gst_inclusive', def: 'TINYINT(1) DEFAULT 1' },
      { name: 'taxable_amount', def: 'DECIMAL(10,2) NULL' },
      { name: 'cgst_amount', def: 'DECIMAL(10,2) NULL' },
      { name: 'sgst_amount', def: 'DECIMAL(10,2) NULL' },
      { name: 'igst_amount', def: 'DECIMAL(10,2) NULL' },
      { name: 'total_mrp', def: 'DECIMAL(10,2) NULL' },
      { name: 'order_type', def: "VARCHAR(20) DEFAULT 'online'" }
    ];

    for (const col of orderCols) {
      try {
        await query(`ALTER TABLE orders ADD COLUMN ${col.name} ${col.def}`);
        console.log(`[Migration] Added column ${col.name} to orders table`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column name')) {
          console.log(`[Migration] Column ${col.name} already exists on orders table`);
        } else {
          console.warn(`[Migration] Warning adding ${col.name}:`, err.message);
        }
      }
    }

    // 3. Alter order_items table: add variant details, HSN, tax, and returns
    console.log('[Migration] Updating order_items table columns...');
    const orderItemCols = [
      { name: 'sku', def: 'VARCHAR(100) NULL' },
      { name: 'hsn_code', def: "VARCHAR(50) DEFAULT '4202'" },
      { name: 'gst_rate', def: 'DECIMAL(5,2) DEFAULT 18.00' },
      { name: 'taxable_amount', def: 'DECIMAL(10,2) NULL' },
      { name: 'cgst_amount', def: 'DECIMAL(10,2) NULL' },
      { name: 'sgst_amount', def: 'DECIMAL(10,2) NULL' },
      { name: 'igst_amount', def: 'DECIMAL(10,2) NULL' },
      { name: 'total_tax', def: 'DECIMAL(10,2) NULL' },
      { name: 'returned_quantity', def: 'INT DEFAULT 0' }
    ];

    for (const col of orderItemCols) {
      try {
        await query(`ALTER TABLE order_items ADD COLUMN ${col.name} ${col.def}`);
        console.log(`[Migration] Added column ${col.name} to order_items table`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column name')) {
          console.log(`[Migration] Column ${col.name} already exists on order_items table`);
        } else {
          console.warn(`[Migration] Warning adding ${col.name}:`, err.message);
        }
      }
    }

    // 4. Create product_barcodes table
    console.log('[Migration] Creating product_barcodes table...');
    await query(`
      CREATE TABLE IF NOT EXISTS product_barcodes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id VARCHAR(128) NOT NULL,
        variant_id INT NULL,
        size VARCHAR(50) NULL,
        color VARCHAR(50) NULL,
        barcode VARCHAR(100) NOT NULL UNIQUE,
        is_primary TINYINT(1) DEFAULT 0,
        status ENUM('active', 'inactive') DEFAULT 'active',
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by INT NULL,
        INDEX idx_barcode (barcode),
        INDEX idx_product (product_id),
        CONSTRAINT fk_barcode_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        CONSTRAINT fk_barcode_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Create inventory_transactions table
    console.log('[Migration] Creating inventory_transactions table...');
    await query(`
      CREATE TABLE IF NOT EXISTS inventory_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id VARCHAR(128) NOT NULL,
        variant_sku VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        change_qty INT NOT NULL,
        balance_after INT NOT NULL,
        reference VARCHAR(100) NULL,
        notes VARCHAR(255) NULL,
        size VARCHAR(50) NULL,
        color VARCHAR(50) NULL,
        barcode VARCHAR(100) NULL,
        quantity_before INT NULL,
        source VARCHAR(50) DEFAULT 'system',
        user_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_prod_tx (product_id),
        INDEX idx_sku_tx (variant_sku),
        CONSTRAINT fk_inv_tx_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Create product_godown_stock table
    console.log('[Migration] Creating product_godown_stock table...');
    await query(`
      CREATE TABLE IF NOT EXISTS product_godown_stock (
        product_id VARCHAR(128) NOT NULL,
        godown_id INT NOT NULL,
        stock INT DEFAULT 0,
        PRIMARY KEY (product_id, godown_id),
        CONSTRAINT fk_godown_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Create order_returns table
    console.log('[Migration] Creating order_returns table...');
    await query(`
      CREATE TABLE IF NOT EXISTS order_returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        order_number VARCHAR(100) NOT NULL,
        return_type VARCHAR(20) NOT NULL DEFAULT 'return',
        returned_items JSON NOT NULL,
        replacement_items JSON NULL,
        total_refund_amount DECIMAL(10,2) DEFAULT 0.00,
        balance_collected DECIMAL(10,2) DEFAULT 0.00,
        reason VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_order_returns_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('[Migration] ✅ All Barcode & POS database tables and columns successfully migrated!');
    process.exit(0);
  } catch (error) {
    console.error('[Migration Error]', error);
    process.exit(1);
  }
}

migrate();

