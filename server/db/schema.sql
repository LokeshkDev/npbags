-- Database schema for NPGrand Themed E-commerce Full-Stack

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  phone VARCHAR(32) NULL,
  avatar VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(128) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  description TEXT NULL,
  image VARCHAR(255) NULL,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(128) PRIMARY KEY,
  slug VARCHAR(191) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  category_id INT NULL,
  price DECIMAL(10,2) NOT NULL,
  sale_price DECIMAL(10,2) NULL DEFAULT 0.00,
  purchased_rate VARCHAR(64) NULL,
  badge VARCHAR(64) NULL,
  rating DECIMAL(3,2) DEFAULT 5.00,
  review_count INT DEFAULT 0,
  tagline TEXT NULL,
  description TEXT NULL,
  features JSON NULL,
  materials TEXT NULL,
  care_instructions TEXT NULL,
  dimensions VARCHAR(255) NULL,
  dimension_w DECIMAL(8,2) NULL,
  dimension_h DECIMAL(8,2) NULL,
  dimension_l DECIMAL(8,2) NULL,
  shipping_info TEXT NULL,
  seo_title VARCHAR(255) NULL,
  seo_description TEXT NULL,
  seo_keywords TEXT NULL,
  is_featured BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(128) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  color_name VARCHAR(64) NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INT DEFAULT 0,
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_variants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(128) NOT NULL,
  color_name VARCHAR(64) NOT NULL,
  color_hex VARCHAR(16) NOT NULL,
  size_name VARCHAR(64) NOT NULL,
  stock_quantity INT DEFAULT 50,
  sku VARCHAR(64) NULL,
  CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(128) NOT NULL,
  user_name VARCHAR(128) NOT NULL,
  rating DECIMAL(2,1) NOT NULL DEFAULT 5.0,
  title VARCHAR(255) NOT NULL,
  comment TEXT NOT NULL,
  date_label VARCHAR(64) DEFAULT 'Recently',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(64) NOT NULL UNIQUE,
  user_id INT NULL,
  customer_name VARCHAR(128) NOT NULL,
  customer_email VARCHAR(191) NOT NULL,
  customer_phone VARCHAR(32) NOT NULL,
  shipping_address JSON NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0.00,
  shipping_fee DECIMAL(10,2) DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(64) DEFAULT 'cod',
  payment_status ENUM('pending', 'paid', 'failed') DEFAULT 'pending',
  order_status ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id VARCHAR(128) NULL,
  product_name VARCHAR(255) NOT NULL,
  variant_info VARCHAR(128) NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  total DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(500) NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  full_name VARCHAR(128) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255) NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wishlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id VARCHAR(128) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_product (user_id, product_id),
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0.00,
  max_discount DECIMAL(10,2) NULL,
  expiry_date DATE NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  eyebrow VARCHAR(128) NULL,
  title VARCHAR(255) NOT NULL,
  text TEXT NULL,
  image VARCHAR(500) NOT NULL,
  cta_primary_text VARCHAR(64) DEFAULT 'Shop Now',
  cta_primary_link VARCHAR(255) DEFAULT '/shop',
  cta_secondary_text VARCHAR(64) DEFAULT 'Explore',
  cta_secondary_link VARCHAR(255) DEFAULT '#story',
  note VARCHAR(255) NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS testimonials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  role_or_title VARCHAR(128) NULL,
  quote TEXT NOT NULL,
  rating DECIMAL(2,1) DEFAULT 5.0,
  avatar VARCHAR(255) NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(191) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT NULL,
  content LONGTEXT NOT NULL,
  cover_image VARCHAR(500) NULL,
  author VARCHAR(128) DEFAULT 'Editorial Team',
  is_published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brands (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  logo_url VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(191) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(191) NOT NULL,
  subject VARCHAR(255) NULL,
  message TEXT NOT NULL,
  status ENUM('unread', 'read', 'replied') DEFAULT 'unread',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cms_sections (
  section_key VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NULL,
  subtitle VARCHAR(255) NULL,
  content JSON NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_settings (
  id INT PRIMARY KEY DEFAULT 1,
  free_delivery_threshold DECIMAL(10,2) DEFAULT 499.00,
  standard_shipping_fee DECIMAL(10,2) DEFAULT 49.00,
  express_shipping_fee DECIMAL(10,2) DEFAULT 99.00,
  estimated_delivery_days VARCHAR(64) DEFAULT '2-4 business days',
  cod_enabled BOOLEAN DEFAULT TRUE,
  return_window_days INT DEFAULT 30,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS store_settings (
  id INT PRIMARY KEY DEFAULT 1,
  store_name VARCHAR(128) DEFAULT 'Your Brand',
  logo_url VARCHAR(255) DEFAULT '/assets/brand-logo.png',
  email VARCHAR(128) DEFAULT 'support@npgrand.com',
  phone VARCHAR(32) DEFAULT '+91 98765 43210',
  address TEXT NULL,
  currency VARCHAR(10) DEFAULT '₹',
  announcement_text VARCHAR(255) DEFAULT 'Complimentary delivery on qualifying orders over ₹499',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_barcodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(128) NOT NULL,
  variant_id INT NULL,
  size VARCHAR(50) NULL,
  color VARCHAR(50) NULL,
  barcode VARCHAR(100) NOT NULL UNIQUE,
  barcode_sequence INT NULL,
  is_primary TINYINT(1) DEFAULT 0,
  status ENUM('active', 'inactive') DEFAULT 'active',
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT NULL,
  INDEX idx_barcode (barcode),
  UNIQUE KEY uk_barcode_sequence (barcode_sequence),
  INDEX idx_product (product_id),
  CONSTRAINT fk_barcode_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_barcode_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_purchase_rate_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id VARCHAR(128) NOT NULL,
  old_rate VARCHAR(64) NULL,
  new_rate VARCHAR(64) NULL,
  changed_by INT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pprh_product (product_id),
  CONSTRAINT fk_pprh_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

CREATE TABLE IF NOT EXISTS product_godown_stock (
  product_id VARCHAR(128) NOT NULL,
  godown_id INT NOT NULL,
  stock INT DEFAULT 0,
  PRIMARY KEY (product_id, godown_id),
  CONSTRAINT fk_godown_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

