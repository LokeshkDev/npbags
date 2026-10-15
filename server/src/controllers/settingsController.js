const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

async function getStoreSettings(req, res, next) {
  try {
    const rows = await query(`SELECT * FROM store_settings WHERE id = 1`);
    const settings = rows[0] || {
      store_name: 'Your Brand',
      logo_url: '/assets/brand-logo.png',
      email: 'support@npgrand.com',
      phone: '+91 98765 43210',
      currency: '₹',
      announcement_text: 'Complimentary delivery on qualifying orders over ₹499'
    };
    return sendSuccess(res, settings);
  } catch (error) {
    next(error);
  }
}

async function updateStoreSettings(req, res, next) {
  try {
    const { store_name, email, phone, address, currency, announcement_text } = req.body;
    let logo_url = req.body.logo_url;
    if (req.file) {
      logo_url = `/uploads/cms/${req.file.filename}`;
    }

    await query(
      `INSERT INTO store_settings (id, store_name, logo_url, email, phone, address, currency, announcement_text)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         store_name = COALESCE(?, store_name),
         logo_url = COALESCE(?, logo_url),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         address = COALESCE(?, address),
         currency = COALESCE(?, currency),
         announcement_text = COALESCE(?, announcement_text)`,
      [
        store_name || 'Your Brand',
        logo_url || '/assets/brand-logo.png',
        email || 'support@npgrand.com',
        phone || '+91 98765 43210',
        address || '',
        currency || '₹',
        announcement_text || 'Complimentary delivery on qualifying orders over ₹499',
        store_name || null,
        logo_url || null,
        email || null,
        phone || null,
        address || null,
        currency || null,
        announcement_text || null
      ]
    );

    const updated = await query(`SELECT * FROM store_settings WHERE id = 1`);
    return sendSuccess(res, updated[0], 'Store settings updated successfully');
  } catch (error) {
    next(error);
  }
}

// Coupons Admin
async function getCoupons(req, res, next) {
  try {
    const coupons = await query(`SELECT * FROM coupons ORDER BY created_at DESC`);
    return sendSuccess(res, coupons);
  } catch (error) {
    next(error);
  }
}

async function createCoupon(req, res, next) {
  try {
    const { code, discount_type, discount_value, min_order_amount, max_discount, expiry_date } = req.body;
    if (!code || !discount_value) return sendError(res, 'Code and discount value are required.', 400);

    const result = await query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount, expiry_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?, TRUE)`,
      [
        code.toUpperCase().trim(),
        discount_type || 'percentage',
        parseFloat(discount_value),
        min_order_amount ? parseFloat(min_order_amount) : 0,
        max_discount ? parseFloat(max_discount) : null,
        expiry_date || null
      ]
    );

    return sendSuccess(res, { id: result.insertId }, 'Coupon created successfully', 201);
  } catch (error) {
    next(error);
  }
}

async function deleteCoupon(req, res, next) {
  try {
    const { id } = req.params;
    await query(`DELETE FROM coupons WHERE id = ?`, [id]);
    return sendSuccess(res, null, 'Coupon deleted successfully');
  } catch (error) {
    next(error);
  }
}

// Admin Stats
async function getAdminStats(req, res, next) {
  try {
    // 1. Total revenue & orders
    const revenueRows = await query(
      `SELECT
         COUNT(id) AS total_orders,
         COALESCE(SUM(total_amount), 0) AS total_revenue,
         COALESCE(SUM(CASE WHEN order_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_orders
       FROM orders`
    );

    // 2. Total products & low stock (stock < 20)
    const productRows = await query(`SELECT COUNT(id) AS total_products FROM products WHERE is_active = TRUE`);
    const lowStockRows = await query(
      `SELECT COUNT(DISTINCT product_id) AS low_stock_count FROM product_variants WHERE stock_quantity < 20`
    );

    // 3. Total customers
    const customerRows = await query(`SELECT COUNT(id) AS total_customers FROM users WHERE role = 'customer'`);

    // 4. Recent orders
    const recentOrders = await query(
      `SELECT id, order_number, customer_name, total_amount, order_status, created_at
       FROM orders
       ORDER BY created_at DESC
       LIMIT 6`
    );

    // 5. Low stock items detail
    const lowStockItems = await query(
      `SELECT p.id, p.name, v.color_name, v.size_name, v.stock_quantity
       FROM product_variants v
       JOIN products p ON v.product_id = p.id
       WHERE v.stock_quantity < 20
       LIMIT 5`
    );

    return sendSuccess(res, {
      kpi: {
        total_revenue: parseFloat(revenueRows[0].total_revenue),
        total_orders: parseInt(revenueRows[0].total_orders, 10),
        pending_orders: parseInt(revenueRows[0].pending_orders, 10),
        total_products: parseInt(productRows[0].total_products, 10),
        low_stock_count: parseInt(lowStockRows[0].low_stock_count, 10),
        total_customers: parseInt(customerRows[0].total_customers, 10)
      },
      recent_orders: recentOrders,
      low_stock_items: lowStockItems
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStoreSettings,
  updateStoreSettings,
  getCoupons,
  createCoupon,
  deleteCoupon,
  getAdminStats
};

