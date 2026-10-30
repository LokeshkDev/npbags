const slugify = require('slugify');
const { query, withTransaction } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

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
    variant_info: variantInfo
  };
}

async function applyStockForBill(tx, bill, items, direction, userId) {
  for (const item of items) {
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const signedQty = qty * direction;

    if (!item.product_id) continue;

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
            `${direction > 0 ? 'Received' : 'Reversed'} ${qty} units against purchase bill ${bill.bill_number}`,
            variant.size_name || null,
            variant.color_name || null,
            before,
            userId || null
          ]
        );
        continue;
      }
    }

    const products = await tx.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
    if (products.length === 0) continue;
    const product = products[0];
    const before = parseInt(product.stock, 10) || 0;
    const after = direction > 0 ? before + qty : Math.max(0, before - qty);
    await tx.query('UPDATE products SET stock = ? WHERE id = ?', [after, product.id]);
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
        `${direction > 0 ? 'Received' : 'Reversed'} ${qty} units against purchase bill ${bill.bill_number}`,
        before,
        userId || null
      ]
    );
  }
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
      from_date,
      to_date,
      search,
      status,
      page = 1,
      limit = 50
    } = req.query;

    let where = ' WHERE 1=1';
    const params = [];

    if (vendor_id) {
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
    if (from_date) {
      where += ' AND pb.purchase_date >= ?';
      params.push(from_date);
    }
    if (to_date) {
      where += ' AND pb.purchase_date <= ?';
      params.push(to_date);
    }
    if (search && search.trim()) {
      where += ' AND (pb.bill_number LIKE ? OR v.name LIKE ? OR pb.notes LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
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
              (SELECT COUNT(*) FROM purchase_bill_items pbi WHERE pbi.purchase_bill_id = pb.id) AS item_count,
              (SELECT COALESCE(SUM(quantity), 0) FROM purchase_bill_items pbi WHERE pbi.purchase_bill_id = pb.id) AS total_quantity
       FROM purchase_bills pb
       JOIN vendors v ON pb.vendor_id = v.id
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
      where += ' AND (pb.bill_number LIKE ? OR v.name LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    const bills = await query(
      `SELECT pb.*, v.name AS vendor_name, v.company_name AS vendor_company,
              (SELECT COUNT(*) FROM purchase_bill_items pbi WHERE pbi.purchase_bill_id = pb.id) AS item_count
       FROM purchase_bills pb
       JOIN vendors v ON pb.vendor_id = v.id
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
        const totalAmount = toMoney(rateValue * quantity);
        normalizedItems.push({ ...resolved, quantity, purchase_rate: purchaseRate, rate_value: rateValue, total_amount: totalAmount });

        if (purchaseRate || rateValue) {
          await tx.query(
            `UPDATE products
             SET purchased_rate = COALESCE(?, purchased_rate),
                 purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END,
                 vendor_id = COALESCE(vendor_id, ?)
             WHERE id = ?`,
            [purchaseRate || null, rateValue, rateValue, vendor_id, resolved.product_id]
          );
        }
      }

      const subtotal = toMoney(normalizedItems.reduce((sum, item) => sum + item.total_amount, 0));
      const charges = toMoney(additional_charges);
      const grandTotal = toMoney(subtotal + charges);
      const paid = Math.min(grandTotal, Math.max(0, toMoney(amount_paid)));
      const paymentStatus = paymentStatusFor(grandTotal, paid);
      const outstanding = toMoney(grandTotal - paid);
      const status = confirm ? 'confirmed' : 'draft';

      const insertResult = await tx.query(
        `INSERT INTO purchase_bills (
          vendor_id, bill_number, purchase_date, subtotal, additional_charges, grand_total,
          payment_status, amount_paid, outstanding_amount, notes, status, stock_applied, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          vendor_id,
          billNo,
          formatDate(purchase_date),
          subtotal,
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
        grand_total: grandTotal
      };

      for (const item of normalizedItems) {
        await tx.query(
          `INSERT INTO purchase_bill_items (
            purchase_bill_id, product_id, variant_id, product_name, variant_info,
            quantity, purchase_rate, rate_value, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            billId,
            item.product_id,
            item.variant_id || null,
            item.product_name,
            item.variant_info || null,
            item.quantity,
            item.purchase_rate || null,
            item.rate_value || 0,
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

      if (confirm) {
        await applyStockForBill(tx, bill, normalizedItems, 1, userId);
        await tx.query('UPDATE purchase_bills SET stock_applied = 1 WHERE id = ?', [billId]);
      }

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
        const totalAmount = toMoney(rateValue * quantity);
        normalizedItems.push({ ...resolved, quantity, purchase_rate: purchaseRate, rate_value: rateValue, total_amount: totalAmount });

        if (purchaseRate || rateValue) {
          await tx.query(
            `UPDATE products
             SET purchased_rate = COALESCE(?, purchased_rate),
                 purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END
             WHERE id = ?`,
            [purchaseRate || null, rateValue, rateValue, resolved.product_id]
          );
        }
      }

      const subtotal = toMoney(normalizedItems.reduce((sum, item) => sum + item.total_amount, 0));
      const charges = toMoney(additional_charges);
      const grandTotal = toMoney(subtotal + charges);
      const shouldConfirm = confirm === undefined ? existing.status === 'confirmed' : Boolean(confirm);
      const targetPaid = amount_paid !== undefined
        ? Math.min(grandTotal, Math.max(0, toMoney(amount_paid)))
        : Math.min(grandTotal, Math.max(0, toMoney(existing.amount_paid)));
      const paymentStatus = paymentStatusFor(grandTotal, targetPaid);
      const outstanding = toMoney(grandTotal - targetPaid);
      const status = shouldConfirm ? 'confirmed' : 'draft';

      await tx.query(
        `UPDATE purchase_bills SET
           bill_number = ?, purchase_date = ?, subtotal = ?, additional_charges = ?, grand_total = ?,
           payment_status = ?, amount_paid = ?, outstanding_amount = ?, notes = ?, status = ?, stock_applied = 0
         WHERE id = ?`,
        [
          billNo,
          formatDate(purchase_date || existing.purchase_date),
          subtotal,
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
      const bill = { id: Number(id), bill_number: billNo, vendor_id: existing.vendor_id, grand_total: grandTotal };
      for (const item of normalizedItems) {
        await tx.query(
          `INSERT INTO purchase_bill_items (
            purchase_bill_id, product_id, variant_id, product_name, variant_info,
            quantity, purchase_rate, rate_value, total_amount
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            item.product_id,
            item.variant_id || null,
            item.product_name,
            item.variant_info || null,
            item.quantity,
            item.purchase_rate || null,
            item.rate_value || 0,
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

      if (shouldConfirm) {
        await applyStockForBill(tx, bill, normalizedItems, 1, userId);
        await tx.query('UPDATE purchase_bills SET stock_applied = 1 WHERE id = ?', [id]);
      }

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
      if (Number(bill.stock_applied) === 1) return;

      const items = await loadItems(tx, id);
      if (!items.length) throw httpError('Purchase bill has no items.', 400);

      await applyStockForBill(tx, bill, items, 1, userId);
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
  getSuggestedBillNumber
};
