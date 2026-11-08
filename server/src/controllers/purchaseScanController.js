const { query, withTransaction } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { applyStockForBill } = require('./purchaseBillController');
const {
  normalizeScanCode,
  resolveProductByScan,
  createProductFromScan
} = require('../utils/purchaseScan');

async function applyBranchStock(result, branchId) {
  if (!branchId || !result || !result.product_id) return;
  try {
    const rows = await query(
      'SELECT stock, is_active FROM branch_stocks WHERE branch_id = ? AND product_id = ? LIMIT 1',
      [branchId, result.product_id]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      result.branch_stock = parseInt(rows[0].stock, 10) || 0;
      result.branch_stock_active = Number(rows[0].is_active) === 1;
    }
  } catch (_) {
    result.branch_stock = null;
  }
}

async function scanPurchaseItem(req, res, next) {
  try {
    const body = req.body || {};
    const queryParams = req.query || {};
    const rawCode = queryParams.code ?? body.code ?? body.scanned_code;
    if (!normalizeScanCode(rawCode)) {
      return sendError(res, 'Scan a barcode or QR code first.', 400);
    }

    const result = await resolveProductByScan(query, rawCode);

    if (result.found) {
      const userBranchId = req.user && req.user.role !== 'admin' ? req.user.branch_id : null;
      const branchId = queryParams.branch_id || body.branch_id || userBranchId || null;
      await applyBranchStock(result, branchId);
      return sendSuccess(res, result, 'Product found');
    }

    return sendSuccess(
      res,
      result,
      'No matching product found. Capture the product details to add it to the catalog.'
    );
  } catch (error) {
    next(error);
  }
}

async function createPurchaseScanProduct(req, res, next) {
  try {
    const body = req.body || {};
    const vendorId = body.vendor_id ? parseInt(body.vendor_id, 10) || null : null;
    const userId = req.user ? req.user.id : null;

    const result = await withTransaction((tx) => createProductFromScan(
      (sql, params) => tx.query(sql, params),
      body,
      { vendorId, userId }
    ));

    return sendSuccess(res, result, 'Scanned product added to the catalog.', 201);
  } catch (error) {
    if (error.statusCode) return sendError(res, error.message, error.statusCode);
    next(error);
  }
}

async function applyScanStock(req, res, next) {
  try {
    const body = req.body || {};
    const productId = String(body.product_id || '').trim();
    if (!productId) return sendError(res, 'Product is required.', 400);

    const quantity = Math.max(1, parseInt(body.quantity, 10) || 1);
    const direction = Number(body.direction) === -1 ? -1 : 1;
    const variantId = body.variant_id ? parseInt(body.variant_id, 10) || null : null;
    const branchId = body.branch_id
      ? parseInt(body.branch_id, 10) || null
      : (req.user && req.user.branch_id ? req.user.branch_id : null);
    const userId = req.user ? req.user.id : null;
    const code = normalizeScanCode(body.scanned_code || body.code || '');
    const reference = code ? `SCAN-${code}` : 'SCAN-STOCK';

    await withTransaction(async (tx) => {
      const products = await tx.query('SELECT id FROM products WHERE id = ? LIMIT 1', [productId]);
      if (products.length === 0) {
        const notFound = new Error('Product not found.');
        notFound.statusCode = 404;
        throw notFound;
      }

      await applyStockForBill(
        tx,
        { bill_number: reference, branch_id: branchId },
        [{
          product_id: productId,
          variant_id: variantId,
          quantity,
          stock_applied_qty: direction < 0 ? quantity : 0
        }],
        direction,
        userId
      );
    });

    const stockRows = variantId
      ? await query('SELECT stock_quantity AS stock FROM product_variants WHERE id = ? LIMIT 1', [variantId])
      : await query('SELECT stock FROM products WHERE id = ? LIMIT 1', [productId]);

    const result = {
      product_id: productId,
      variant_id: variantId,
      quantity,
      direction,
      stock: parseInt(stockRows?.[0]?.stock, 10) || 0
    };

    if (branchId) {
      const branchRows = await query(
        'SELECT stock FROM branch_stocks WHERE branch_id = ? AND product_id = ? LIMIT 1',
        [branchId, productId]
      );
      result.branch_stock = branchRows.length > 0 ? parseInt(branchRows[0].stock, 10) || 0 : null;
    }

    return sendSuccess(res, result, direction < 0 ? 'Scanned stock reverted' : 'Stock updated from scan');
  } catch (error) {
    if (error.statusCode) return sendError(res, error.message, error.statusCode);
    next(error);
  }
}

module.exports = {
  scanPurchaseItem,
  createPurchaseScanProduct,
  applyScanStock
};
