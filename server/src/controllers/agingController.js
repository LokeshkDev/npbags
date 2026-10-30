const { query } = require('../config/db');

// GET /api/dashboard/aging
async function getProductAgingAlerts(req, res) {
  try {
    const { minDays = 60 } = req.query;
    const thresholdDays = parseInt(minDays, 10) || 60;

    // Fetch products with stock > 0 and calculate days in inventory
    const products = await query(`
      SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.purchase_price, p.stock,
             p.created_at, p.updated_at,
             DATEDIFF(NOW(), p.created_at) AS days_in_stock,
             c.name AS category_name,
             v.name AS vendor_name,
             v.phone AS vendor_phone,
             (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = TRUE LIMIT 1) AS primary_image,
             (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.product_id = p.id) AS units_sold,
             (SELECT MAX(o.created_at) FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.product_id = p.id) AS last_sold_at
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN vendors v ON p.vendor_id = v.id
      WHERE p.is_active = TRUE AND p.stock > 0
      HAVING days_in_stock >= ?
      ORDER BY days_in_stock DESC
    `, [thresholdDays]);

    // Format metrics
    let slowMovingCount = 0; // 60 - 90 days
    let deadStockCount = 0;   // 90+ days
    let totalTiedCapital = 0;

    const formatted = products.map(p => {
      const days = parseInt(p.days_in_stock, 10) || 0;
      const unitCost = p.purchase_price ? parseFloat(p.purchase_price) : (parseFloat(p.price) * 0.55);
      const tiedCapital = Math.round((parseInt(p.stock, 10) || 0) * unitCost * 100) / 100;

      totalTiedCapital += tiedCapital;
      if (days >= 90) {
        deadStockCount++;
      } else {
        slowMovingCount++;
      }

      return {
        ...p,
        days_in_stock: days,
        tied_capital: tiedCapital,
        aging_status: days >= 90 ? 'critical_dead_stock' : 'slow_moving',
        aging_label: days >= 90 ? '90+ Days (Dead Stock)' : `${days} Days (Slow Moving)`
      };
    });

    res.json({
      summary: {
        total_aging_products: formatted.length,
        slow_moving_count: slowMovingCount,
        dead_stock_count: deadStockCount,
        total_tied_capital: Math.round(totalTiedCapital * 100) / 100
      },
      products: formatted
    });
  } catch (err) {
    console.error('Error fetching product aging alerts:', err);
    res.status(500).json({ error: 'Failed to fetch product aging alerts' });
  }
}

module.exports = {
  getProductAgingAlerts
};
