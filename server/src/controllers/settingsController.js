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

// Comprehensive Executive Analytics with Filterable Timeframes & Online/POS Breakdown
async function getDashboardAnalytics(req, res, next) {
  try {
    const { period = 'monthly', startDate, endDate } = req.query;

    // 1. Determine Date Range Condition
    let dateCondition = '';
    const dateParams = [];

    if (period === 'today') {
      dateCondition = `o.created_at >= CURDATE() AND o.created_at < CURDATE() + INTERVAL 1 DAY`;
    } else if (period === 'daily') {
      dateCondition = `o.created_at >= CURDATE() - INTERVAL 1 DAY`;
    } else if (period === 'weekly') {
      dateCondition = `o.created_at >= CURDATE() - INTERVAL 7 DAY`;
    } else if (period === 'yearly') {
      dateCondition = `o.created_at >= MAKEDATE(YEAR(CURDATE()), 1)`;
    } else if (period === 'custom' && startDate && endDate) {
      dateCondition = `o.created_at >= ? AND o.created_at <= ?`;
      dateParams.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    } else {
      // Default: monthly (last 30 days)
      dateCondition = `o.created_at >= CURDATE() - INTERVAL 30 DAY`;
    }

    const whereClause = `WHERE o.order_status != 'cancelled' AND ${dateCondition}`;

    // 2. Today's Dedicated Sales & Register Metrics (Always Today 00:00 to 23:59)
    const todayRows = await query(`
      SELECT
        COUNT(id) AS today_orders_total,
        COALESCE(SUM(total_amount), 0) AS today_sales_total,
        COUNT(CASE WHEN LOWER(COALESCE(order_type, '')) = 'pos' THEN 1 END) AS today_pos_orders,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(order_type, '')) = 'pos' THEN total_amount ELSE 0 END), 0) AS today_pos_sales,
        COUNT(CASE WHEN LOWER(COALESCE(order_type, '')) != 'pos' THEN 1 END) AS today_online_orders,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(order_type, '')) != 'pos' THEN total_amount ELSE 0 END), 0) AS today_online_sales,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(order_type, '')) = 'pos' AND LOWER(COALESCE(payment_method, '')) = 'cash' THEN total_amount ELSE 0 END), 0) AS today_pos_cash,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(order_type, '')) = 'pos' AND LOWER(COALESCE(payment_method, '')) = 'upi' THEN total_amount ELSE 0 END), 0) AS today_pos_upi
      FROM orders
      WHERE order_status != 'cancelled' AND created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY
    `);
    const todayData = todayRows[0] || {};

    // 3. Period Total Metrics (Online vs Walk-in POS Breakdown)
    const periodTotalsRows = await query(`
      SELECT
        COUNT(o.id) AS total_orders,
        COALESCE(SUM(o.total_amount), 0) AS total_sales,
        COUNT(CASE WHEN LOWER(COALESCE(o.order_type, '')) = 'pos' THEN 1 END) AS pos_orders,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.order_type, '')) = 'pos' THEN o.total_amount ELSE 0 END), 0) AS pos_sales,
        COUNT(CASE WHEN LOWER(COALESCE(o.order_type, '')) != 'pos' THEN 1 END) AS online_orders,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.order_type, '')) != 'pos' THEN o.total_amount ELSE 0 END), 0) AS online_sales,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.order_type, '')) = 'pos' AND LOWER(COALESCE(o.payment_method, '')) = 'cash' THEN o.total_amount ELSE 0 END), 0) AS pos_cash_sales,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.order_type, '')) = 'pos' AND LOWER(COALESCE(o.payment_method, '')) = 'upi' THEN o.total_amount ELSE 0 END), 0) AS pos_upi_sales,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.order_type, '')) = 'pos' AND LOWER(COALESCE(o.payment_method, '')) = 'card' THEN o.total_amount ELSE 0 END), 0) AS pos_card_sales,
        COALESCE(SUM(o.taxable_amount), 0) AS total_taxable,
        COALESCE(SUM(o.cgst_amount + o.sgst_amount + o.igst_amount), 0) AS total_tax
      FROM orders o
      ${whereClause}
    `, dateParams);
    const periodTotals = periodTotalsRows[0] || {};

    // 4. Time Series Chart Data (Dynamic grouping based on period)
    let seriesSql = '';
    if (period === 'today' || period === 'daily') {
      seriesSql = `
        SELECT
          DATE_FORMAT(o.created_at, '%h %p') AS label,
          HOUR(o.created_at) AS sort_key,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.order_type, '')) != 'pos' THEN o.total_amount ELSE 0 END), 0) AS online_sales,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.order_type, '')) = 'pos' THEN o.total_amount ELSE 0 END), 0) AS pos_sales,
          COUNT(CASE WHEN LOWER(COALESCE(o.order_type, '')) != 'pos' THEN 1 END) AS online_orders,
          COUNT(CASE WHEN LOWER(COALESCE(o.order_type, '')) = 'pos' THEN 1 END) AS pos_orders
        FROM orders o
        ${whereClause}
        GROUP BY HOUR(o.created_at), DATE_FORMAT(o.created_at, '%h %p')
        ORDER BY sort_key ASC
      `;
    } else if (period === 'yearly') {
      seriesSql = `
        SELECT
          DATE_FORMAT(o.created_at, '%b') AS label,
          MONTH(o.created_at) AS sort_key,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.order_type, '')) != 'pos' THEN o.total_amount ELSE 0 END), 0) AS online_sales,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.order_type, '')) = 'pos' THEN o.total_amount ELSE 0 END), 0) AS pos_sales,
          COUNT(CASE WHEN LOWER(COALESCE(o.order_type, '')) != 'pos' THEN 1 END) AS online_orders,
          COUNT(CASE WHEN LOWER(COALESCE(o.order_type, '')) = 'pos' THEN 1 END) AS pos_orders
        FROM orders o
        ${whereClause}
        GROUP BY MONTH(o.created_at), DATE_FORMAT(o.created_at, '%b')
        ORDER BY sort_key ASC
      `;
    } else {
      // Weekly, Monthly, Custom: group by day
      seriesSql = `
        SELECT
          DATE_FORMAT(o.created_at, '%d %b') AS label,
          DATE(o.created_at) AS sort_key,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.order_type, '')) != 'pos' THEN o.total_amount ELSE 0 END), 0) AS online_sales,
          COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.order_type, '')) = 'pos' THEN o.total_amount ELSE 0 END), 0) AS pos_sales,
          COUNT(CASE WHEN LOWER(COALESCE(o.order_type, '')) != 'pos' THEN 1 END) AS online_orders,
          COUNT(CASE WHEN LOWER(COALESCE(o.order_type, '')) = 'pos' THEN 1 END) AS pos_orders
        FROM orders o
        ${whereClause}
        GROUP BY DATE(o.created_at), DATE_FORMAT(o.created_at, '%d %b')
        ORDER BY sort_key ASC
      `;
    }

    const seriesRows = await query(seriesSql, dateParams);
    const chartSeries = seriesRows.map(r => ({
      label: r.label,
      online_sales: parseFloat(r.online_sales) || 0,
      pos_sales: parseFloat(r.pos_sales) || 0,
      total_sales: (parseFloat(r.online_sales) || 0) + (parseFloat(r.pos_sales) || 0),
      online_orders: parseInt(r.online_orders, 10) || 0,
      pos_orders: parseInt(r.pos_orders, 10) || 0,
      total_orders: (parseInt(r.online_orders, 10) || 0) + (parseInt(r.pos_orders, 10) || 0)
    }));

    // 5. Payment Methods Breakdown in Selected Period
    const paymentRows = await query(`
      SELECT
        COALESCE(o.payment_method, 'Cash') AS method,
        COUNT(o.id) AS count,
        COALESCE(SUM(o.total_amount), 0) AS total_amount
      FROM orders o
      ${whereClause}
      GROUP BY COALESCE(o.payment_method, 'Cash')
      ORDER BY total_amount DESC
    `, dateParams);

    // 6. Top 5 Best-Selling Products in Selected Period
    const topProductsRows = await query(`
      SELECT
        oi.product_name,
        oi.product_id,
        COALESCE(SUM(oi.quantity), 0) AS units_sold,
        COALESCE(SUM(oi.total), 0) AS total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      ${whereClause}
      GROUP BY oi.product_name, oi.product_id
      ORDER BY total_revenue DESC
      LIMIT 5
    `, dateParams);

    // 7. Inventory Health Snapshot
    const activeProductsRes = await query(`SELECT COUNT(id) AS total_active FROM products WHERE is_active = TRUE`);
    const lowStockRes = await query(`SELECT COUNT(DISTINCT product_id) AS count FROM product_variants WHERE stock_quantity <= 10`);
    const outOfStockRes = await query(`SELECT COUNT(DISTINCT product_id) AS count FROM product_variants WHERE stock_quantity <= 0`);

    // 8. Recent Combined Feed (Online Orders & POS Bills)
    const recentFeed = await query(`
      SELECT id, order_number, customer_name, customer_phone, total_amount, payment_method, order_status, order_type, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 8
    `);

    return sendSuccess(res, {
      period,
      today: {
        total_sales: parseFloat(todayData.today_sales_total) || 0,
        total_orders: parseInt(todayData.today_orders_total, 10) || 0,
        online_sales: parseFloat(todayData.today_online_sales) || 0,
        online_orders: parseInt(todayData.today_online_orders, 10) || 0,
        pos_sales: parseFloat(todayData.today_pos_sales) || 0,
        pos_orders: parseInt(todayData.today_pos_orders, 10) || 0,
        pos_cash: parseFloat(todayData.today_pos_cash) || 0,
        pos_upi: parseFloat(todayData.today_pos_upi) || 0,
        aov: todayData.today_orders_total > 0
          ? Math.round(parseFloat(todayData.today_sales_total) / parseInt(todayData.today_orders_total, 10))
          : 0
      },
      period_totals: {
        total_sales: parseFloat(periodTotals.total_sales) || 0,
        total_orders: parseInt(periodTotals.total_orders, 10) || 0,
        online_sales: parseFloat(periodTotals.online_sales) || 0,
        online_orders: parseInt(periodTotals.online_orders, 10) || 0,
        pos_sales: parseFloat(periodTotals.pos_sales) || 0,
        pos_orders: parseInt(periodTotals.pos_orders, 10) || 0,
        pos_cash_sales: parseFloat(periodTotals.pos_cash_sales) || 0,
        pos_upi_sales: parseFloat(periodTotals.pos_upi_sales) || 0,
        pos_card_sales: parseFloat(periodTotals.pos_card_sales) || 0,
        total_tax: parseFloat(periodTotals.total_tax) || 0,
        total_taxable: parseFloat(periodTotals.total_taxable) || 0,
        aov: periodTotals.total_orders > 0
          ? Math.round(parseFloat(periodTotals.total_sales) / parseInt(periodTotals.total_orders, 10))
          : 0
      },
      chart_series: chartSeries,
      payment_methods: paymentRows.map(p => ({
        method: p.method,
        count: parseInt(p.count, 10),
        amount: parseFloat(p.total_amount)
      })),
      top_products: topProductsRows.map(p => ({
        name: p.product_name,
        units_sold: parseInt(p.units_sold, 10),
        revenue: parseFloat(p.total_revenue)
      })),
      inventory_health: {
        total_active_products: parseInt(activeProductsRes[0]?.total_active || 0, 10),
        low_stock_count: parseInt(lowStockRes[0]?.count || 0, 10),
        out_of_stock_count: parseInt(outOfStockRes[0]?.count || 0, 10)
      },
      recent_feed: recentFeed
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
  getAdminStats,
  getDashboardAnalytics
};

