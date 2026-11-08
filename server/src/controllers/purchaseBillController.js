const slugify = require('slugify');
const { query, withTransaction } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { normalizeScanCode } = require('../utils/purchaseScan');
const {
  isLegacyFullyAppliedBill,
  isBillFullyStockApplied,
  computeStockDelta,
  itemQuantity,
  itemAppliedQty
} = require('../utils/purchaseStock');

function toMoney(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

function parseRateValue(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function paymentStatusFor(grandTotal, paid) {
  const total = toMoney(grandTotal);
  const amountPaid = toMoney(paid);
  if (amountPaid <= 0) return 'Unpaid';
  if (amountPaid >= total) return 'Paid';
  return 'Partially Paid';
}

function normalizePurchaseRate(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeGstType(value) {
  return String(value || '').toLowerCase() === 'inclusive' ? 'inclusive' : 'exclusive';
}

function normalizeDiscountType(value) {
  return String(value || '').toLowerCase() === 'percent' ? 'percent' : 'flat';
}

function normalizeDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function computeLineCosting({
  rateValue,
  quantity,
  mrp,
  gstType,
  gstRate,
  discountType,
  discountValue,
  sellingPrice
}) {
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const rate = toMoney(rateValue);
  const gstPct = Math.max(0, Number.parseFloat(gstRate) || 0);
  const landingUnit = normalizeGstType(gstType) === 'exclusive' && gstPct > 0 && rate > 0
    ? toMoney(rate * (1 + gstPct / 100))
    : rate;

  const grossAmount = toMoney(rate * qty);
  const type = normalizeDiscountType(discountType);
  const value = Math.max(0, toMoney(discountValue));
  const discountAmount = type === 'percent'
    ? toMoney((grossAmount * Math.min(100, value)) / 100)
    : Math.min(grossAmount, toMoney(value));
  const totalAmount = toMoney(grossAmount - discountAmount);

  const mrpValue = toMoney(mrp);
  const sellValue = toMoney(sellingPrice);
  const marginBase = mrpValue > 0 ? mrpValue : sellValue;
  const purchaseMargin = marginBase > 0 && landingUnit > 0
    ? Math.round(((marginBase - landingUnit) / marginBase) * 1000) / 10
    : 0;
  const landingMargin = sellValue > 0 && landingUnit > 0
    ? Math.round(((sellValue - landingUnit) / sellValue) * 1000) / 10
    : 0;

  return {
    discount_type: type,
    discount_value: type === 'percent' ? Math.min(100, value) : value,
    discount_amount: discountAmount,
    gross_amount: grossAmount,
    total_amount: totalAmount,
    landing_cost: landingUnit,
    purchase_margin: purchaseMargin,
    landing_margin: landingMargin
  };
}

async function recordPurchaseRateHistory(tx, productId, oldRate, newRate, userId = null) {
  const previous = normalizePurchaseRate(oldRate);
  const next = normalizePurchaseRate(newRate);
  if (previous === next) return;
  try {
    await tx.query(
      `INSERT INTO product_purchase_rate_history (product_id, old_rate, new_rate, changed_by)
       VALUES (?, ?, ?, ?)`,
      [productId, previous, next, userId || null]
    );
  } catch (error) {
    console.error('Could not record purchase rate history:', error.message);
  }
}

function httpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function formatDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

async function generateBillNumber(tx) {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `PB-${datePart}-${suffix}`;
    const existing = await tx.query('SELECT id FROM purchase_bills WHERE bill_number = ? LIMIT 1', [candidate]);
    if (existing.length === 0) return candidate;
  }
  return `PB-${Date.now()}`;
}

async function resolveProductForItem(tx, item, vendorId, userId) {
  let productId = item.product_id || item.id || null;
  let product = null;
  const scannedBarcode = normalizeScanCode(item.scanned_barcode || item.barcode || '');

  if (productId) {
    const rows = await tx.query('SELECT * FROM products WHERE id = ? LIMIT 1', [productId]);
    if (rows.length > 0) product = rows[0];
  }

  if (!product && item.product_name) {
    const rows = await tx.query(
      'SELECT * FROM products WHERE LOWER(name) = LOWER(?) OR LOWER(slug) = LOWER(?) LIMIT 1',
      [String(item.product_name).trim(), slugify(String(item.product_name), { lower: true, strict: true })]
    );
    if (rows.length > 0) product = rows[0];
  }

  if (!product && scannedBarcode) {
    const rows = await tx.query(
      `SELECT p.* FROM product_barcodes pb
       JOIN products p ON pb.product_id = p.id
       WHERE pb.barcode = ? AND pb.status = 'active'
       LIMIT 1`,
      [scannedBarcode]
    );
    if (rows.length > 0) product = rows[0];
  }

  if (!product && !item.product_name && scannedBarcode) {
    item.product_name = `Scanned Product ${scannedBarcode}`;
  }

  if (!product) {
    const name = String(item.product_name || item.name || '').trim();
    if (!name) throw httpError('Each purchase bill item needs a product or product name');

    const rateValue = parseRateValue(item.rate_value !== undefined ? item.rate_value : item.purchase_rate);
    const price = toMoney(item.price || item.mrp || (rateValue > 0 ? rateValue : 1));

    let baseSlug = slugify(name, { lower: true, strict: true }) || `purchase-product-${Date.now()}`;
    const slugTaken = await tx.query('SELECT id FROM products WHERE slug = ? LIMIT 1', [baseSlug]);
    if (slugTaken.length > 0) baseSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

    const productIdToCreate = item.new_product_id || baseSlug;
    await tx.query(
      `INSERT INTO products (
        id, slug, name, category_id, price, sale_price, mrp, purchase_price, purchased_rate,
        vendor_id, stock, is_active, is_online, is_offline, is_featured
      ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0, 1, 1, 1, 0)`,
      [
        productIdToCreate,
        baseSlug,
        name,
        item.category_id || null,
        price,
        item.mrp ? toMoney(item.mrp) : price,
        rateValue,
        item.purchase_rate !== undefined ? String(item.purchase_rate) : (item.rate_value !== undefined ? String(item.rate_value) : null),
        vendorId || null
      ]
    );

    const rows = await tx.query('SELECT * FROM products WHERE id = ? LIMIT 1', [productIdToCreate]);
    product = rows[0];

    if (scannedBarcode) {
      try {
        const existingBarcode = await tx.query('SELECT id FROM product_barcodes WHERE barcode = ? LIMIT 1', [scannedBarcode]);
        if (existingBarcode.length === 0) {
          const sequenceRows = await tx.query('SELECT COALESCE(MAX(barcode_sequence), 0) AS max_sequence FROM product_barcodes');
          const nextSequence = (parseInt(sequenceRows[0]?.max_sequence, 10) || 0) + 1;
          await tx.query(
            `INSERT INTO product_barcodes (product_id, barcode, barcode_sequence, is_primary, status, created_by)
             VALUES (?, ?, ?, 1, 'active', ?)`,
            [productIdToCreate, scannedBarcode, nextSequence, userId || null]
          );
        }
      } catch (barcodeError) {
        console.warn('[PurchaseBill] Could not link scanned barcode:', barcodeError.message);
      }
    }
  }

  let variantId = item.variant_id ? parseInt(item.variant_id, 10) : null;
  let variantInfo = item.variant_info || null;

  if (variantId) {
    const variants = await tx.query(
      'SELECT * FROM product_variants WHERE id = ? AND product_id = ? LIMIT 1',
      [variantId, product.id]
    );
    if (variants.length === 0) throw httpError(`Selected variant does not belong to ${product.name}`, 400);
    const variant = variants[0];
    variantInfo = variantInfo || [variant.color_name, variant.size_name].filter(Boolean).join(' / ');
  }

  return {
    product_id: product.id,
    variant_id: variantId,
    product_name: product.name,
    variant_info: variantInfo,
    product_mrp: product.mrp,
    product_price: product.price,
    product_sale_price: product.sale_price,
    product_gst_type: product.gst_type,
    product_gst_rate: product.gst_rate
  };
}

async function applyStockForBill(tx, bill, items, direction, userId) {
  const legacyFull = isLegacyFullyAppliedBill(bill, items);

  for (const item of items) {
    if (!item.product_id) continue;

    const deltaQty = computeStockDelta(item, direction, { legacyFull });
    if (deltaQty <= 0) continue;
    const signedQty = direction > 0 ? deltaQty : -deltaQty;

    if (item.variant_id) {
      const variants = await tx.query(
        'SELECT * FROM product_variants WHERE id = ? AND product_id = ? FOR UPDATE',
        [item.variant_id, item.product_id]
      );
      if (variants.length > 0) {
        const variant = variants[0];
        const before = parseInt(variant.stock_quantity, 10) || 0;
        const after = Math.max(0, before + signedQty);
        await tx.query('UPDATE product_variants SET stock_quantity = ? WHERE id = ?', [after, variant.id]);
        const sumRows = await tx.query(
          'SELECT COALESCE(SUM(stock_quantity), 0) AS total FROM product_variants WHERE product_id = ?',
          [item.product_id]
        );
        await tx.query('UPDATE products SET stock = ? WHERE id = ?', [parseInt(sumRows[0]?.total || 0, 10), item.product_id]);
        await tx.query(
          `INSERT INTO inventory_transactions (
            product_id, variant_sku, type, change_qty, balance_after, reference, notes,
            size, color, quantity_before, source, user_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'purchase', ?)`,
          [
            item.product_id,
            variant.sku || `${variant.size_name || 'Standard'}-${variant.color_name || 'Standard'}`,
            direction > 0 ? 'Purchase Bill' : 'Purchase Bill Reversal',
            signedQty,
            after,
            bill.bill_number,
            `${direction > 0 ? 'Received' : 'Reversed'} ${deltaQty} units against purchase bill ${bill.bill_number}`,
            variant.size_name || null,
            variant.color_name || null,
            before,
            userId || null
          ]
        );
        continue;
      }
    }

    // Fallback if variant_id was not explicitly passed:
    // Check if the product has existing variants in product_variants
    const existingVariants = await tx.query(
      'SELECT * FROM product_variants WHERE product_id = ? ORDER BY id ASC FOR UPDATE',
      [item.product_id]
    );

    if (existingVariants.length > 0) {
      // Apply stock to the first/primary variant
      const primaryVariant = existingVariants[0];
      const beforeV = parseInt(primaryVariant.stock_quantity, 10) || 0;
      const afterV = Math.max(0, beforeV + signedQty);
      await tx.query('UPDATE product_variants SET stock_quantity = ? WHERE id = ?', [afterV, primaryVariant.id]);

      // Keep products.stock synchronized to the sum of all variants
      const sumRows = await tx.query(
        'SELECT COALESCE(SUM(stock_quantity), 0) AS total FROM product_variants WHERE product_id = ?',
        [item.product_id]
      );
      const totalStock = parseInt(sumRows[0]?.total || 0, 10);
      await tx.query('UPDATE products SET stock = ? WHERE id = ?', [totalStock, item.product_id]);

      await tx.query(
        `INSERT INTO inventory_transactions (
          product_id, variant_sku, type, change_qty, balance_after, reference, notes,
          size, color, quantity_before, source, user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'purchase', ?)`,
        [
          item.product_id,
          primaryVariant.sku || `${primaryVariant.size_name || 'Standard'}-${primaryVariant.color_name || 'Standard'}`,
          direction > 0 ? 'Purchase Bill' : 'Purchase Bill Reversal',
          signedQty,
          afterV,
          bill.bill_number,
          `${direction > 0 ? 'Received' : 'Reversed'} ${deltaQty} units against purchase bill ${bill.bill_number}`,
          primaryVariant.size_name || null,
          primaryVariant.color_name || null,
          beforeV,
          userId || null
        ]
      );
      continue;
    }

    const products = await tx.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
    if (products.length === 0) continue;
    const product = products[0];
    const before = parseInt(product.stock, 10) || 0;
    const after = direction > 0 ? before + deltaQty : Math.max(0, before - deltaQty);
    await tx.query('UPDATE products SET stock = ? WHERE id = ?', [after, product.id]);

    // Also ensure a default variant is recorded so catalog inventory functions see it
    await tx.query(
      `INSERT INTO product_variants (product_id, color_name, color_hex, size_name, stock_quantity, sku)
       VALUES (?, 'Standard', '#000000', 'Standard', ?, ?)`,
      [product.id, after, `NP-${product.id}-STD`]
    );

    await tx.query(
      `INSERT INTO inventory_transactions (
        product_id, variant_sku, type, change_qty, balance_after, reference, notes,
        quantity_before, source, user_id
      ) VALUES (?, 'DEFAULT', ?, ?, ?, ?, ?, ?, 'purchase', ?)`,
      [
        product.id,
        direction > 0 ? 'Purchase Bill' : 'Purchase Bill Reversal',
        signedQty,
        after,
        bill.bill_number,
        `${direction > 0 ? 'Received' : 'Reversed'} ${deltaQty} units against purchase bill ${bill.bill_number}`,
        before,
        userId || null
      ]
    );

    // If purchase bill belongs to a regional branch (e.g. Manali Branch), update branch_stocks
    const targetBranchId = bill.branch_id ? parseInt(bill.branch_id, 10) : 1;
    if (targetBranchId > 1) {
      try {
        await tx.query(
          `INSERT INTO branch_stocks (branch_id, product_id, stock, is_active)
           VALUES (?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE stock = GREATEST(0, stock + ?)`,
          [targetBranchId, item.product_id, Math.max(0, signedQty), signedQty]
        );
      } catch (bsErr) {
        console.warn('[PurchaseBill] branch_stocks sync warning:', bsErr.message);
      }
    }
  }
}

async function applyStockChanges(tx, bill, changes, userId) {
  const positive = [];
  const negative = [];
  for (const change of changes) {
    if (!change || !change.item || !change.item.product_id) continue;
    const delta = Math.trunc(Number(change.delta) || 0);
    if (delta > 0) positive.push({ ...change.item, quantity: delta, stock_applied_qty: 0 });
    else if (delta < 0) negative.push({ ...change.item, quantity: Math.abs(delta), stock_applied_qty: 0 });
  }
  if (positive.length > 0) await applyStockForBill(tx, bill, positive, 1, userId);
  if (negative.length > 0) await applyStockForBill(tx, bill, negative, -1, userId);
}

function scanAppliedForItem(item, defaultFromApplied = false) {
  const raw = item.stock_scan_applied;
  if (defaultFromApplied && (raw === undefined || raw === null)) return itemAppliedQty(item);
  return Math.min(itemQuantity(item), Math.max(0, parseInt(raw, 10) || 0));
}

function stockChangesForItems(items, confirm, defaultScanFromApplied = false) {
  return items.map(item => {
    const desired = confirm ? itemQuantity(item) : itemAppliedQty(item);
    return { item, delta: desired - scanAppliedForItem(item, defaultScanFromApplied) };
  });
}

async function loadItems(tx, billId) {
  return tx.query(
    `SELECT pbi.*, p.slug AS product_slug, p.mrp, p.purchase_price, p.purchased_rate,
            pv.color_name, pv.size_name, pv.sku
     FROM purchase_bill_items pbi
     LEFT JOIN products p ON pbi.product_id = p.id
     LEFT JOIN product_variants pv ON pbi.variant_id = pv.id
     WHERE pbi.purchase_bill_id = ?
     ORDER BY pbi.id ASC`,
    [billId]
  );
}

// GET /api/admin/purchase-bills
async function getAllPurchaseBills(req, res, next) {
  try {
    const {
      vendor_id,
      payment_status,
      bill_number,
      from_date,
      to_date,
      search,
      status,
      page = 1,
      limit = 50
    } = req.query;

    let where = ' WHERE 1=1';
    const params = [];

    // Branch scoping: Branch staff see only their branch bills; Super Admin can filter with ?branch_id=X or see all
    const effectiveBranchId = (req.user && req.user.role !== 'admin')
      ? req.user.branch_id
      : (req.query.branch_id && req.query.branch_id !== 'all' ? parseInt(req.query.branch_id, 10) : null);

    if (effectiveBranchId) {
      where += ' AND (pb.branch_id = ? OR (pb.branch_id IS NULL AND ? = 1))';
      params.push(effectiveBranchId, effectiveBranchId);
    }

    if (vendor_id && vendor_id !== 'all') {
      where += ' AND pb.vendor_id = ?';
      params.push(vendor_id);
    }
    if (payment_status && payment_status !== 'all') {
      where += ' AND pb.payment_status = ?';
      params.push(payment_status);
    }
    if (status && status !== 'all') {
      where += ' AND pb.status = ?';
      params.push(status);
    }
    if (bill_number && bill_number.trim()) {
      where += ' AND pb.bill_number LIKE ?';
      params.push(`%${bill_number.trim()}%`);
    }
    if (from_date) {
      where += ' AND pb.purchase_date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      where += ' AND pb.purchase_date <= ?';
      params.push(to_date);
    }
    if (search && search.trim()) {
      where += ` AND (pb.bill_number LIKE ? OR v.name LIKE ? OR v.company_name LIKE ?
                  OR v.phone LIKE ? OR pb.notes LIKE ?
                  OR EXISTS (
                    SELECT 1 FROM purchase_bill_items pbi
                    WHERE pbi.purchase_bill_id = pb.id AND pbi.product_name LIKE ?
                  ))`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term);
    }

    const totalRows = await query(
      `SELECT COUNT(*) AS total FROM purchase_bills pb JOIN vendors v ON pb.vendor_id = v.id ${where}`,
      params
    );
    const total = Number(totalRows[0]?.total || 0);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const bills = await query(
      `SELECT pb.*, v.name AS vendor_name, v.company_name AS vendor_company,
              b.name AS branch_name, b.code AS branch_code,
              (SELECT COUNT(*) FROM purchase_bill_items pbi WHERE pbi.purchase_bill_id = pb.id) AS item_count,
              (SELECT COALESCE(SUM(quantity), 0) FROM purchase_bill_items pbi WHERE pbi.purchase_bill_id = pb.id) AS total_quantity
       FROM purchase_bills pb
       JOIN vendors v ON pb.vendor_id = v.id
       LEFT JOIN branches b ON pb.branch_id = b.id
       ${where}
       ORDER BY pb.purchase_date DESC, pb.id DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    const summaryRows = await query(
      `SELECT
         COUNT(*) AS total_bills,
         COALESCE(SUM(pb.grand_total), 0) AS total_purchase_value,
         COALESCE(SUM(pb.amount_paid), 0) AS total_paid,
         COALESCE(SUM(pb.outstanding_amount), 0) AS total_outstanding
       FROM purchase_bills pb JOIN vendors v ON pb.vendor_id = v.id ${where}`,
      params
    );

    return sendSuccess(res, {
      bills,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      },
      summary: summaryRows[0] || {}
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/purchase-bills/outstanding
async function getOutstandingPurchaseBills(req, res, next) {
  try {
    const { vendor_id, from_date, to_date, payment_status, search } = req.query;

    let where = ` WHERE pb.status <> 'cancelled' AND pb.payment_status IN ('Unpaid', 'Partially Paid') AND pb.outstanding_amount > 0`;
    const params = [];

    const effectiveBranchId = (req.user && req.user.role !== 'admin')
      ? req.user.branch_id
      : (req.query.branch_id && req.query.branch_id !== 'all' ? parseInt(req.query.branch_id, 10) : null);

    if (effectiveBranchId) {
      where += ' AND (pb.branch_id = ? OR (pb.branch_id IS NULL AND ? = 1))';
      params.push(effectiveBranchId, effectiveBranchId);
    }

    if (vendor_id && vendor_id !== 'all') {
      where += ' AND pb.vendor_id = ?';
      params.push(vendor_id);
    }
    if (payment_status && payment_status !== 'all') {
      where += ' AND pb.payment_status = ?';
      params.push(payment_status);
    }
    if (from_date) {
      where += ' AND pb.purchase_date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      where += ' AND pb.purchase_date <= ?';
      params.push(to_date);
    }
    if (search && search.trim()) {
      where += ` AND (pb.bill_number LIKE ? OR v.name LIKE ? OR v.company_name LIKE ?
                  OR EXISTS (
                    SELECT 1 FROM purchase_bill_items pbi
                    WHERE pbi.purchase_bill_id = pb.id AND pbi.product_name LIKE ?
                  ))`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const bills = await query(
      `SELECT pb.*, v.name AS vendor_name, v.company_name AS vendor_company,
              b.name AS branch_name, b.code AS branch_code,
              (SELECT COUNT(*) FROM purchase_bill_items pbi WHERE pbi.purchase_bill_id = pb.id) AS item_count
       FROM purchase_bills pb
       JOIN vendors v ON pb.vendor_id = v.id
       LEFT JOIN branches b ON pb.branch_id = b.id
       ${where}
       ORDER BY pb.purchase_date ASC, pb.id ASC`,
      params
    );

    const vendorTotals = await query(
      `SELECT pb.vendor_id, v.name AS vendor_name, v.company_name AS vendor_company,
              COUNT(*) AS bill_count,
              COALESCE(SUM(pb.grand_total), 0) AS total_bill_amount,
              COALESCE(SUM(pb.amount_paid), 0) AS total_paid,
              COALESCE(SUM(pb.outstanding_amount), 0) AS total_outstanding
       FROM purchase_bills pb
       JOIN vendors v ON pb.vendor_id = v.id
       ${where}
       GROUP BY pb.vendor_id, v.name, v.company_name
       ORDER BY total_outstanding DESC`,
      params
    );

    return sendSuccess(res, {
      bills,
      vendor_totals: vendorTotals,
      summary: {
        bill_count: bills.length,
        total_bill_amount: toMoney(bills.reduce((sum, b) => sum + Number(b.grand_total || 0), 0)),
        total_paid: toMoney(bills.reduce((sum, b) => sum + Number(b.amount_paid || 0), 0)),
        total_outstanding: toMoney(bills.reduce((sum, b) => sum + Number(b.outstanding_amount || 0), 0))
      }
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/purchase-bills/:id
async function getPurchaseBillById(req, res, next) {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT pb.*, v.name AS vendor_name, v.company_name AS vendor_company, v.phone AS vendor_phone,
              v.email AS vendor_email, v.gstin AS vendor_gstin, v.address AS vendor_address
       FROM purchase_bills pb
       JOIN vendors v ON pb.vendor_id = v.id
       WHERE pb.id = ?`,
      [id]
    );
    if (rows.length === 0) return sendError(res, 'Purchase bill not found', 404);

    const items = await query(
      `SELECT pbi.*, p.slug AS product_slug, p.mrp, p.purchase_price, p.purchased_rate,
              pv.color_name, pv.size_name, pv.sku
       FROM purchase_bill_items pbi
       LEFT JOIN products p ON pbi.product_id = p.id
       LEFT JOIN product_variants pv ON pbi.variant_id = pv.id
       WHERE pbi.purchase_bill_id = ?
       ORDER BY pbi.id ASC`,
      [id]
    );
    const payments = await query(
      `SELECT * FROM purchase_bill_payments WHERE purchase_bill_id = ? ORDER BY payment_date DESC, id DESC`,
      [id]
    );

    return sendSuccess(res, { ...rows[0], items, payments });
  } catch (error) {
    next(error);
  }
}

// POST /api/admin/purchase-bills
async function createPurchaseBill(req, res, next) {
  try {
    const {
      vendor_id,
      bill_number,
      purchase_date,
      items = [],
      additional_charges = 0,
      amount_paid = 0,
      payment_method = 'Cash',
      notes = '',
      confirm = false
    } = req.body;

    if (!vendor_id) return sendError(res, 'Vendor is required.', 400);
    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 'Add at least one product to the purchase bill.', 400);
    }

    const userId = req.user ? req.user.id : null;

    const result = await withTransaction(async (tx) => {
      const vendors = await tx.query('SELECT * FROM vendors WHERE id = ?', [vendor_id]);
      if (vendors.length === 0) throw httpError('Vendor not found', 404);

      const billNo = (bill_number || '').trim() || await generateBillNumber(tx);
      const duplicate = await tx.query('SELECT id FROM purchase_bills WHERE bill_number = ? LIMIT 1', [billNo]);
      if (duplicate.length > 0) throw httpError(`Purchase bill number "${billNo}" already exists.`, 409);

      const normalizedItems = [];
      for (const item of items) {
        const resolved = await resolveProductForItem(tx, item, vendor_id, userId);
        const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
        const rateValue = parseRateValue(item.rate_value !== undefined ? item.rate_value : item.purchase_rate);
        const purchaseRate = item.purchase_rate !== undefined && item.purchase_rate !== null
          ? String(item.purchase_rate)
          : String(rateValue);
        const mrpValue = item.mrp !== undefined && item.mrp !== null && item.mrp !== ''
          ? toMoney(item.mrp)
          : toMoney(resolved.product_mrp);
        const gstType = normalizeGstType(item.gst_type || resolved.product_gst_type);
        const gstRate = item.gst_rate !== undefined && item.gst_rate !== null && item.gst_rate !== ''
          ? Math.max(0, Number.parseFloat(item.gst_rate) || 0)
          : Math.max(0, Number.parseFloat(resolved.product_gst_rate) || 0);
        const sellingPrice = toMoney(
          resolved.product_sale_price !== null && resolved.product_sale_price !== undefined && Number(resolved.product_sale_price) > 0
            ? resolved.product_sale_price
            : resolved.product_price
        );
        const lineCosting = computeLineCosting({
          rateValue,
          quantity,
          mrp: mrpValue,
          gstType,
          gstRate,
          discountType: item.discount_type,
          discountValue: item.discount_value,
          sellingPrice
        });
        const manufacturingDate = normalizeDate(item.manufacturing_date);
        const expiryDate = normalizeDate(item.expiry_date);
        const stockAppliedQty = Math.min(
          quantity,
          Math.max(0, parseInt(item.stock_applied_qty, 10) || 0)
        );
        normalizedItems.push({
          ...resolved,
          quantity,
          stock_applied_qty: stockAppliedQty,
          purchase_rate: purchaseRate,
          rate_value: rateValue,
          mrp: mrpValue,
          gst_type: gstType,
          gst_rate: gstRate,
          selling_price: sellingPrice,
          manufacturing_date: manufacturingDate,
          expiry_date: expiryDate,
          ...lineCosting
        });

        if (purchaseRate || rateValue) {
          const currentRateRows = await tx.query('SELECT purchased_rate FROM products WHERE id = ?', [resolved.product_id]);
          const oldRate = currentRateRows[0]?.purchased_rate ?? null;
          await tx.query(
            `UPDATE products
             SET purchased_rate = COALESCE(?, purchased_rate),
                 purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END,
                 vendor_id = COALESCE(vendor_id, ?)
             WHERE id = ?`,
            [purchaseRate || null, rateValue, rateValue, vendor_id, resolved.product_id]
          );
          await recordPurchaseRateHistory(tx, resolved.product_id, oldRate, purchaseRate || rateValue, userId);
        }

        if (manufacturingDate || expiryDate) {
          await tx.query(
            `UPDATE products
             SET manufacturing_date = COALESCE(?, manufacturing_date),
                 expiry_date = COALESCE(?, expiry_date)
             WHERE id = ?`,
            [manufacturingDate, expiryDate, resolved.product_id]
          );
        }
      }

      const subtotal = toMoney(normalizedItems.reduce((sum, item) => sum + item.total_amount, 0));
      const discountTotal = toMoney(normalizedItems.reduce((sum, item) => sum + item.discount_amount, 0));
      const charges = toMoney(additional_charges);
      const grandTotal = toMoney(subtotal + charges);
      const paid = Math.min(grandTotal, Math.max(0, toMoney(amount_paid)));
      const paymentStatus = paymentStatusFor(grandTotal, paid);
      const outstanding = toMoney(grandTotal - paid);
      const status = confirm ? 'confirmed' : 'draft';

      const assignedBranchId = (req.user && req.user.branch_id)
        ? req.user.branch_id
        : (req.body.branch_id ? parseInt(req.body.branch_id, 10) : 1);

      const insertResult = await tx.query(
        `INSERT INTO purchase_bills (
          branch_id, vendor_id, bill_number, purchase_date, subtotal, discount_total, additional_charges, grand_total,
          payment_status, amount_paid, outstanding_amount, notes, status, stock_applied, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          assignedBranchId,
          vendor_id,
          billNo,
          formatDate(purchase_date),
          subtotal,
          discountTotal,
          charges,
          grandTotal,
          paymentStatus,
          paid,
          outstanding,
          notes || null,
          status,
          userId
        ]
      );

      const billId = insertResult.insertId;
      const bill = {
        id: billId,
        bill_number: billNo,
        vendor_id,
        branch_id: assignedBranchId,
        grand_total: grandTotal
      };

      for (const item of normalizedItems) {
        await tx.query(
          `INSERT INTO purchase_bill_items (
            purchase_bill_id, product_id, variant_id, product_name, variant_info,
            quantity, purchase_rate, rate_value, mrp, gst_type, gst_rate,
            discount_type, discount_value, discount_amount,
            landing_cost, purchase_margin, landing_margin, manufacturing_date, expiry_date,
            stock_applied_qty, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            billId,
            item.product_id,
            item.variant_id || null,
            item.product_name,
            item.variant_info || null,
            item.quantity,
            item.purchase_rate || null,
            item.rate_value || 0,
            item.mrp || null,
            item.gst_type || null,
            item.gst_rate !== undefined ? item.gst_rate : null,
            item.discount_type || 'flat',
            item.discount_value || 0,
            item.discount_amount || 0,
            item.landing_cost || 0,
            item.purchase_margin || 0,
            item.landing_margin || 0,
            item.manufacturing_date || null,
            item.expiry_date || null,
            item.stock_applied_qty || 0,
            item.total_amount
          ]
        );
      }

      if (paid > 0) {
        await tx.query(
          `INSERT INTO purchase_bill_payments (purchase_bill_id, amount, payment_date, payment_method, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [billId, paid, formatDate(purchase_date), payment_method || 'Cash', 'Initial payment recorded with purchase bill', userId]
        );
      }

      const anyPreapplied = normalizedItems.some(item => (parseInt(item.stock_applied_qty, 10) || 0) > 0);

      await applyStockChanges(tx, bill, stockChangesForItems(normalizedItems, Boolean(confirm), true), userId);

      if (confirm) {
        await tx.query('UPDATE purchase_bill_items SET stock_applied_qty = quantity WHERE purchase_bill_id = ?', [billId]);
      }
      await tx.query(
        'UPDATE purchase_bills SET stock_applied = ? WHERE id = ?',
        [confirm || anyPreapplied ? 1 : 0, billId]
      );

      return { id: billId, bill_number: billNo, grand_total: grandTotal };
    });

    const created = await query('SELECT * FROM purchase_bills WHERE id = ?', [result.id]);
    return sendSuccess(res, created[0], 'Purchase bill created successfully', 201);
  } catch (error) {
    if (error.statusCode) return sendError(res, error.message, error.statusCode);
    next(error);
  }
}

// PUT /api/admin/purchase-bills/:id
async function updatePurchaseBill(req, res, next) {
  try {
    const { id } = req.params;
    const {
      bill_number,
      purchase_date,
      items = [],
      additional_charges = 0,
      amount_paid,
      payment_method = 'Cash',
      notes = '',
      branch_id,
      confirm
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 'Add at least one product to the purchase bill.', 400);
    }

    const userId = req.user ? req.user.id : null;

    const result = await withTransaction(async (tx) => {
      const bills = await tx.query('SELECT * FROM purchase_bills WHERE id = ? FOR UPDATE', [id]);
      if (bills.length === 0) throw httpError('Purchase bill not found', 404);
      const existing = bills[0];
      if (existing.status === 'cancelled') throw httpError('Cancelled purchase bills cannot be edited.', 400);

      const billNo = (bill_number || existing.bill_number).trim();
      const duplicate = await tx.query('SELECT id FROM purchase_bills WHERE bill_number = ? AND id <> ? LIMIT 1', [billNo, id]);
      if (duplicate.length > 0) throw httpError(`Purchase bill number "${billNo}" already exists.`, 409);

      const oldItems = await loadItems(tx, id);

      if (Number(existing.stock_applied) === 1) {
        await applyStockForBill(tx, existing, oldItems, -1, userId);
      }

      const normalizedItems = [];
      for (const item of items) {
        const resolved = await resolveProductForItem(tx, item, existing.vendor_id, userId);
        const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
        const rateValue = parseRateValue(item.rate_value !== undefined ? item.rate_value : item.purchase_rate);
        const purchaseRate = item.purchase_rate !== undefined && item.purchase_rate !== null
          ? String(item.purchase_rate)
          : String(rateValue);
        const mrpValue = item.mrp !== undefined && item.mrp !== null && item.mrp !== ''
          ? toMoney(item.mrp)
          : toMoney(resolved.product_mrp);
        const gstType = normalizeGstType(item.gst_type || resolved.product_gst_type);
        const gstRate = item.gst_rate !== undefined && item.gst_rate !== null && item.gst_rate !== ''
          ? Math.max(0, Number.parseFloat(item.gst_rate) || 0)
          : Math.max(0, Number.parseFloat(resolved.product_gst_rate) || 0);
        const sellingPrice = toMoney(
          resolved.product_sale_price !== null && resolved.product_sale_price !== undefined && Number(resolved.product_sale_price) > 0
            ? resolved.product_sale_price
            : resolved.product_price
        );
        const lineCosting = computeLineCosting({
          rateValue,
          quantity,
          mrp: mrpValue,
          gstType,
          gstRate,
          discountType: item.discount_type,
          discountValue: item.discount_value,
          sellingPrice
        });
        const manufacturingDate = normalizeDate(item.manufacturing_date);
        const expiryDate = normalizeDate(item.expiry_date);
        const stockAppliedQty = Math.min(
          quantity,
          Math.max(0, parseInt(item.stock_applied_qty, 10) || 0)
        );
        normalizedItems.push({
          ...resolved,
          quantity,
          stock_applied_qty: stockAppliedQty,
          purchase_rate: purchaseRate,
          rate_value: rateValue,
          mrp: mrpValue,
          gst_type: gstType,
          gst_rate: gstRate,
          selling_price: sellingPrice,
          manufacturing_date: manufacturingDate,
          expiry_date: expiryDate,
          ...lineCosting
        });

        if (purchaseRate || rateValue) {
          const currentRateRows = await tx.query('SELECT purchased_rate FROM products WHERE id = ?', [resolved.product_id]);
          const oldRate = currentRateRows[0]?.purchased_rate ?? null;
          await tx.query(
            `UPDATE products
             SET purchased_rate = COALESCE(?, purchased_rate),
                 purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END
             WHERE id = ?`,
            [purchaseRate || null, rateValue, rateValue, resolved.product_id]
          );
          await recordPurchaseRateHistory(tx, resolved.product_id, oldRate, purchaseRate || rateValue, userId);
        }

        if (manufacturingDate || expiryDate) {
          await tx.query(
            `UPDATE products
             SET manufacturing_date = COALESCE(?, manufacturing_date),
                 expiry_date = COALESCE(?, expiry_date)
             WHERE id = ?`,
            [manufacturingDate, expiryDate, resolved.product_id]
          );
        }
      }

      const subtotal = toMoney(normalizedItems.reduce((sum, item) => sum + item.total_amount, 0));
      const discountTotal = toMoney(normalizedItems.reduce((sum, item) => sum + item.discount_amount, 0));
      const charges = toMoney(additional_charges);
      const grandTotal = toMoney(subtotal + charges);
      const shouldConfirm = confirm === undefined ? existing.status === 'confirmed' : Boolean(confirm);
      const targetPaid = amount_paid !== undefined
        ? Math.min(grandTotal, Math.max(0, toMoney(amount_paid)))
        : Math.min(grandTotal, Math.max(0, toMoney(existing.amount_paid)));
      const paymentStatus = paymentStatusFor(grandTotal, targetPaid);
      const outstanding = toMoney(grandTotal - targetPaid);
      const status = shouldConfirm ? 'confirmed' : 'draft';
      const targetBranchId = branch_id ? (parseInt(branch_id, 10) || existing.branch_id) : existing.branch_id;

      await tx.query(
        `UPDATE purchase_bills SET
           branch_id = ?, bill_number = ?, purchase_date = ?, subtotal = ?, discount_total = ?, additional_charges = ?, grand_total = ?,
           payment_status = ?, amount_paid = ?, outstanding_amount = ?, notes = ?, status = ?, stock_applied = 0
         WHERE id = ?`,
        [
          targetBranchId,
          billNo,
          formatDate(purchase_date || existing.purchase_date),
          subtotal,
          discountTotal,
          charges,
          grandTotal,
          paymentStatus,
          targetPaid,
          outstanding,
          notes || null,
          status,
          id
        ]
      );

      await tx.query('DELETE FROM purchase_bill_items WHERE purchase_bill_id = ?', [id]);
      const bill = {
        id: Number(id),
        bill_number: billNo,
        vendor_id: existing.vendor_id,
        branch_id: targetBranchId,
        grand_total: grandTotal
      };
      for (const item of normalizedItems) {
        await tx.query(
          `INSERT INTO purchase_bill_items (
            purchase_bill_id, product_id, variant_id, product_name, variant_info,
            quantity, purchase_rate, rate_value, mrp, gst_type, gst_rate,
            discount_type, discount_value, discount_amount,
            landing_cost, purchase_margin, landing_margin, manufacturing_date, expiry_date,
            stock_applied_qty, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.product_id,
            item.variant_id || null,
            item.product_name,
            item.variant_info || null,
            item.quantity,
            item.purchase_rate || null,
            item.rate_value || 0,
            item.mrp || null,
            item.gst_type || null,
            item.gst_rate !== undefined ? item.gst_rate : null,
            item.discount_type || 'flat',
            item.discount_value || 0,
            item.discount_amount || 0,
            item.landing_cost || 0,
            item.purchase_margin || 0,
            item.landing_margin || 0,
            item.manufacturing_date || null,
            item.expiry_date || null,
            item.stock_applied_qty || 0,
            item.total_amount
          ]
        );
      }

      const paidDiff = toMoney(targetPaid - Number(existing.amount_paid || 0));
      if (Math.abs(paidDiff) >= 0.01) {
        await tx.query(
          `INSERT INTO purchase_bill_payments (purchase_bill_id, amount, payment_date, payment_method, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, paidDiff, formatDate(purchase_date), payment_method || 'Cash', 'Payment adjustment during bill edit', userId]
        );
      }

      const anyPreapplied = normalizedItems.some(item => (parseInt(item.stock_applied_qty, 10) || 0) > 0);

      await applyStockChanges(tx, bill, stockChangesForItems(normalizedItems, shouldConfirm), userId);

      if (shouldConfirm) {
        await tx.query('UPDATE purchase_bill_items SET stock_applied_qty = quantity WHERE purchase_bill_id = ?', [id]);
      }
      await tx.query(
        'UPDATE purchase_bills SET stock_applied = ? WHERE id = ?',
        [shouldConfirm || anyPreapplied ? 1 : 0, id]
      );

      return bill;
    });

    const updated = await query('SELECT * FROM purchase_bills WHERE id = ?', [result.id]);
    return sendSuccess(res, updated[0], 'Purchase bill updated successfully');
  } catch (error) {
    if (error.statusCode) return sendError(res, error.message, error.statusCode);
    next(error);
  }
}

// POST /api/admin/purchase-bills/:id/confirm
async function confirmPurchaseBill(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;

    await withTransaction(async (tx) => {
      const bills = await tx.query('SELECT * FROM purchase_bills WHERE id = ? FOR UPDATE', [id]);
      if (bills.length === 0) throw httpError('Purchase bill not found', 404);
      const bill = bills[0];
      if (bill.status === 'cancelled') throw httpError('Cancelled purchase bills cannot be confirmed.', 400);

      const items = await loadItems(tx, id);
      if (!items.length) throw httpError('Purchase bill has no items.', 400);

      if (isBillFullyStockApplied(bill, items)) {
        await tx.query("UPDATE purchase_bills SET status = 'confirmed' WHERE id = ?", [id]);
        return;
      }

      await applyStockForBill(tx, bill, items, 1, userId);
      await tx.query('UPDATE purchase_bill_items SET stock_applied_qty = quantity WHERE purchase_bill_id = ?', [id]);
      await tx.query(
        `UPDATE purchase_bills SET status = 'confirmed', stock_applied = 1 WHERE id = ?`,
        [id]
      );
    });

    const updated = await query('SELECT * FROM purchase_bills WHERE id = ?', [id]);
    return sendSuccess(res, updated[0], 'Purchase bill confirmed and stock updated');
  } catch (error) {
    if (error.statusCode) return sendError(res, error.message, error.statusCode);
    next(error);
  }
}

// POST /api/admin/purchase-bills/:id/payments
async function addPurchaseBillPayment(req, res, next) {
  try {
    const { id } = req.params;
    const { amount, payment_date, payment_method = 'Cash', notes = '' } = req.body;
    const paymentAmount = toMoney(amount);
    if (paymentAmount <= 0) return sendError(res, 'Payment amount must be greater than zero.', 400);

    const userId = req.user ? req.user.id : null;

    const result = await withTransaction(async (tx) => {
      const bills = await tx.query('SELECT * FROM purchase_bills WHERE id = ? FOR UPDATE', [id]);
      if (bills.length === 0) throw httpError('Purchase bill not found', 404);
      const bill = bills[0];
      if (bill.status === 'cancelled') throw httpError('Cannot record a payment against a cancelled bill.', 400);

      const outstanding = toMoney(bill.outstanding_amount);
      if (paymentAmount > outstanding + 0.009) {
        throw httpError(`Payment exceeds outstanding amount of ₹${outstanding.toFixed(2)}.`, 400);
      }

      await tx.query(
        `INSERT INTO purchase_bill_payments (purchase_bill_id, amount, payment_date, payment_method, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, paymentAmount, formatDate(payment_date), payment_method, notes || null, userId]
      );

      const newPaid = toMoney(Number(bill.amount_paid || 0) + paymentAmount);
      const newOutstanding = toMoney(Number(bill.grand_total || 0) - newPaid);
      const newStatus = paymentStatusFor(bill.grand_total, newPaid);

      await tx.query(
        `UPDATE purchase_bills SET amount_paid = ?, outstanding_amount = ?, payment_status = ? WHERE id = ?`,
        [newPaid, Math.max(0, newOutstanding), newStatus, id]
      );

      return { amount_paid: newPaid, outstanding_amount: Math.max(0, newOutstanding), payment_status: newStatus };
    });

    return sendSuccess(res, result, 'Payment recorded successfully', 201);
  } catch (error) {
    if (error.statusCode) return sendError(res, error.message, error.statusCode);
    next(error);
  }
}

// DELETE /api/admin/purchase-bills/:id
async function deletePurchaseBill(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;

    await withTransaction(async (tx) => {
      const bills = await tx.query('SELECT * FROM purchase_bills WHERE id = ? FOR UPDATE', [id]);
      if (bills.length === 0) throw httpError('Purchase bill not found', 404);
      const bill = bills[0];

      if (Number(bill.stock_applied) === 1) {
        const items = await loadItems(tx, id);
        await applyStockForBill(tx, bill, items, -1, userId);
      }

      await tx.query('DELETE FROM purchase_bills WHERE id = ?', [id]);
    });

    return sendSuccess(res, { id }, 'Purchase bill deleted and stock reversed');
  } catch (error) {
    if (error.statusCode) return sendError(res, error.message, error.statusCode);
    next(error);
  }
}

// GET /api/admin/vendors/:id/purchase-history
async function getVendorPurchaseHistory(req, res, next) {
  try {
    const { id } = req.params;

    const summaryRows = await query(
      `SELECT
         COUNT(*) AS total_bills,
         COUNT(CASE WHEN payment_status = 'Paid' THEN 1 END) AS paid_bills,
         COUNT(CASE WHEN payment_status = 'Partially Paid' THEN 1 END) AS partially_paid_bills,
         COUNT(CASE WHEN payment_status = 'Unpaid' THEN 1 END) AS unpaid_bills,
         COALESCE(SUM(grand_total), 0) AS total_purchase_value,
         COALESCE(SUM(amount_paid), 0) AS total_paid,
         COALESCE(SUM(outstanding_amount), 0) AS total_outstanding
       FROM purchase_bills
       WHERE vendor_id = ? AND status <> 'cancelled'`,
      [id]
    );

    const bills = await query(
      `SELECT pb.*,
              (SELECT COUNT(*) FROM purchase_bill_items pbi WHERE pbi.purchase_bill_id = pb.id) AS item_count,
              (SELECT COALESCE(SUM(quantity), 0) FROM purchase_bill_items pbi WHERE pbi.purchase_bill_id = pb.id) AS total_quantity
       FROM purchase_bills pb
       WHERE pb.vendor_id = ?
       ORDER BY pb.purchase_date DESC, pb.id DESC`,
      [id]
    );

    const payments = await query(
      `SELECT pbp.*, pb.bill_number
       FROM purchase_bill_payments pbp
       JOIN purchase_bills pb ON pbp.purchase_bill_id = pb.id
       WHERE pb.vendor_id = ?
       ORDER BY pbp.payment_date DESC, pbp.id DESC
       LIMIT 100`,
      [id]
    );

    return sendSuccess(res, {
      summary: summaryRows[0] || {},
      bills,
      payments
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/purchase-bills/next-number
async function getSuggestedBillNumber(req, res, next) {
  try {
    const number = await generateBillNumber({ query });
    return sendSuccess(res, { bill_number: number });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllPurchaseBills,
  getOutstandingPurchaseBills,
  getPurchaseBillById,
  createPurchaseBill,
  updatePurchaseBill,
  confirmPurchaseBill,
  addPurchaseBillPayment,
  deletePurchaseBill,
  getVendorPurchaseHistory,
  getSuggestedBillNumber,
  applyStockForBill,
  stockChangesForItems
};
