/**
 * Inventory Controller for NP Grand Shopping
 * Provides audit logging, stock adjustments, and live inventory summaries.
 */

const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

// Admin: Get paginated inventory transactions audit log
async function getInventoryTransactions(req, res, next) {
  try {
    const { product_id, type, page = 1, limit = 50 } = req.query;

    let sql = `
      SELECT it.*, p.name AS product_name, p.slug AS product_slug
      FROM inventory_transactions it
      LEFT JOIN products p ON it.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (product_id) {
      sql += ` AND it.product_id = ?`;
      params.push(product_id);
    }

    if (type) {
      sql += ` AND it.type = ?`;
      params.push(type);
    }

    const countSql = `SELECT COUNT(*) AS total FROM (${sql}) AS sub`;
    const totalResult = await query(countSql, params);
    const total = totalResult[0]?.total || 0;

    sql += ` ORDER BY it.created_at DESC, it.id DESC LIMIT ? OFFSET ?`;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    params.push(parseInt(limit, 10), offset);

    const rows = await query(sql, params);

    return sendSuccess(res, {
      transactions: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(total / parseInt(limit, 10))
      }
    });
  } catch (error) {
    next(error);
  }
}

// Admin: Get live variant stock summary across all products
async function getVariantStockSummary(req, res, next) {
  try {
    const { low_stock_only, search } = req.query;

    let sql = `
      SELECT pv.*, p.name AS product_name, p.slug AS product_slug, p.price, p.sale_price,
             COALESCE(p.low_stock_threshold, 5) AS threshold,
             (SELECT barcode FROM product_barcodes WHERE variant_id = pv.id AND status = 'active' LIMIT 1) AS barcode
      FROM product_variants pv
      JOIN products p ON pv.product_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (search && search.trim()) {
      sql += ` AND (p.name LIKE ? OR pv.sku LIKE ? OR pv.color_name LIKE ? OR pv.size_name LIKE ?)`;
      const q = `%${search.trim()}%`;
      params.push(q, q, q, q);
    }

    if (low_stock_only === 'true' || low_stock_only === '1') {
      sql += ` AND pv.stock_quantity <= COALESCE(p.low_stock_threshold, 5)`;
    }

    sql += ` ORDER BY pv.stock_quantity ASC, p.name ASC`;

    const rows = await query(sql, params);
    return sendSuccess(res, rows);
  } catch (error) {
    next(error);
  }
}

// Admin: Manually adjust variant stock with an audit trail entry
async function adjustVariantStock(req, res, next) {
  try {
    const { variant_id, new_stock, reason = 'Manual Adjustment' } = req.body;
    if (!variant_id || new_stock === undefined || new_stock === null) {
      return sendError(res, 'variant_id and new_stock are required', 400);
    }

    const variants = await query(
      `SELECT pv.*, p.name AS product_name FROM product_variants pv JOIN products p ON pv.product_id = p.id WHERE pv.id = ?`,
      [variant_id]
    );

    if (variants.length === 0) {
      return sendError(res, 'Variant not found', 404);
    }

    const v = variants[0];
    const oldStock = v.stock_quantity || 0;
    const targetStock = Math.max(0, parseInt(new_stock, 10));
    const diff = targetStock - oldStock;

    // Update variant
    await query(`UPDATE product_variants SET stock_quantity = ? WHERE id = ?`, [targetStock, variant_id]);

    // Update master product stock
    const [sumRow] = await query(
      `SELECT SUM(stock_quantity) AS total FROM product_variants WHERE product_id = ?`,
      [v.product_id]
    );
    const newTotal = sumRow[0]?.total || targetStock;
    await query(`UPDATE products SET stock = ? WHERE id = ?`, [newTotal, v.product_id]);

    // Insert audit log
    await query(
      `INSERT INTO inventory_transactions (product_id, variant_sku, type, change_qty, balance_after, reference, notes, size, color, quantity_before, source, user_id)
       VALUES (?, ?, 'Manual Adjustment', ?, ?, 'MANUAL-STOCK', ?, ?, ?, ?, 'admin', ?)`,
      [
        v.product_id,
        v.sku || `${v.size_name || 'Standard'}-${v.color_name || 'Standard'}`,
        diff,
        targetStock,
        reason,
        v.size_name,
        v.color_name,
        oldStock,
        req.user ? req.user.id : null
      ]
    );

    return sendSuccess(res, { variant_id, oldStock, newStock: targetStock, diff }, 'Stock adjusted successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getInventoryTransactions,
  getVariantStockSummary,
  adjustVariantStock
};

