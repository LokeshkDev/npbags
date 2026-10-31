const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');
const { findOrCreateCustomer } = require('../utils/customerHelper');

function toMoney(value) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

function normalizeDiscountType(value) {
  if (value === 'percent' || value === 'percentage') return 'percentage';
  return 'flat';
}

function calculateTotals(items, discountType, discountValue) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const subtotal = toMoney(
    normalizedItems.reduce((sum, item) => {
      const price = Number(
        item.final_price !== undefined ? item.final_price :
        item.price !== undefined ? item.price :
        item.sale_price !== undefined ? item.sale_price : 0
      );
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      return sum + (Number.isFinite(price) ? price : 0) * qty;
    }, 0)
  );

  const type = normalizeDiscountType(discountType);
  const value = Math.max(0, toMoney(discountValue));
  const discountAmount = type === 'percentage'
    ? toMoney(subtotal * (value / 100))
    : Math.min(subtotal, value);

  return {
    subtotal,
    discount_type: type,
    discount_value: value,
    discount_amount: discountAmount,
    total_amount: toMoney(Math.max(0, subtotal - discountAmount))
  };
}

async function generateReference() {
  const existingActive = await query("SELECT reference FROM held_bills WHERE status = 'held'");
  const activeSlots = new Set();
  (existingActive || []).forEach(row => {
    const match = (row.reference || '').match(/HOLD-#?(\d+)/i);
    if (match) activeSlots.add(parseInt(match[1], 10));
  });

  // Assign lowest available slot 1..15
  let slotNum = 1;
  for (let s = 1; s <= 15; s++) {
    if (!activeSlots.has(s)) {
      slotNum = s;
      break;
    }
  }

  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `HOLD-#${slotNum}-${datePart}-${Math.floor(100 + Math.random() * 900)}`;
    const existing = await query('SELECT id FROM held_bills WHERE reference = ? LIMIT 1', [candidate]);
    if (existing.length === 0) return candidate;
  }
  return `HOLD-#${slotNum}-${Date.now()}`;
}

// GET /api/admin/held-bills
async function getHeldBills(req, res, next) {
  try {
    const status = req.query.status || 'held';
    let where = ' WHERE 1=1';
    const params = [];

    if (status !== 'all') {
      where += ' AND status = ?';
      params.push(status);
    }

    const rows = await query(
      `SELECT * FROM held_bills ${where} ORDER BY created_at DESC, id DESC`,
      params
    );

    const bills = rows.map((row) => {
      let items = [];
      if (typeof row.items === 'string') {
        try { items = JSON.parse(row.items); } catch (_) { items = []; }
      } else if (Array.isArray(row.items)) {
        items = row.items;
      }
      return { ...row, items };
    });

    return sendSuccess(res, bills);
  } catch (error) {
    next(error);
  }
}

// GET /api/admin/held-bills/:id
async function getHeldBillById(req, res, next) {
  try {
    const rows = await query('SELECT * FROM held_bills WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return sendError(res, 'Held bill not found', 404);

    const bill = rows[0];
    if (typeof bill.items === 'string') {
      try { bill.items = JSON.parse(bill.items); } catch (_) { bill.items = []; }
    }
    return sendSuccess(res, bill);
  } catch (error) {
    next(error);
  }
}

// POST /api/admin/held-bills
async function holdBill(req, res, next) {
  try {
    const {
      customer_name = 'Walk-in Customer',
      customer_phone = '',
      customer_email = '',
      items,
      discount_type = 'flat',
      discount_value = 0,
      payment_method = 'Cash',
      sales_person_id = null,
      sales_person_name = '',
      notes = ''
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return sendError(res, 'Cannot hold an empty cart.', 400);
    }

    // Check maximum 15 active held bills limit
    const activeRows = await query("SELECT COUNT(*) AS count FROM held_bills WHERE status = 'held'");
    if (activeRows[0] && Number(activeRows[0].count) >= 15) {
      return sendError(res, 'Maximum limit of 15 held bills reached. Please resume or cancel an existing held bill before holding another.', 400);
    }

    const totals = calculateTotals(items, discount_type, discount_value);
    const reference = await generateReference();

    // Auto-save newly added customer into users table so customer info is recorded
    try {
      await findOrCreateCustomer({
        name: customer_name,
        phone: customer_phone,
        email: customer_email
      });
    } catch (custErr) {
      console.warn('[HoldBill] Could not auto-save customer info:', custErr.message);
    }

    const result = await query(
      `INSERT INTO held_bills (
        reference, customer_name, customer_phone, customer_email, items, subtotal,
        discount_type, discount_value, discount_amount, total_amount, payment_method,
        sales_person_id, sales_person_name, notes, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'held', ?)`,
      [
        reference,
        customer_name || 'Walk-in Customer',
        customer_phone || null,
        customer_email || null,
        JSON.stringify(items),
        totals.subtotal,
        totals.discount_type,
        totals.discount_value,
        totals.discount_amount,
        totals.total_amount,
        payment_method || 'Cash',
        sales_person_id || null,
        sales_person_name || null,
        notes || null,
        req.user ? req.user.id : null
      ]
    );

    const rows = await query('SELECT * FROM held_bills WHERE id = ?', [result.insertId]);
    const bill = rows[0];
    if (bill && typeof bill.items === 'string') {
      try { bill.items = JSON.parse(bill.items); } catch (_) { bill.items = []; }
    }
    return sendSuccess(res, bill, 'Bill held successfully', 201);
  } catch (error) {
    next(error);
  }
}

// PUT /api/admin/held-bills/:id
async function updateHeldBill(req, res, next) {
  try {
    const { id } = req.params;
    const existingRows = await query('SELECT * FROM held_bills WHERE id = ?', [id]);
    if (existingRows.length === 0) return sendError(res, 'Held bill not found', 404);
    const existing = existingRows[0];
    if (existing.status !== 'held') return sendError(res, 'Only held bills can be updated.', 400);

    const {
      customer_name = existing.customer_name,
      customer_phone = existing.customer_phone,
      customer_email = existing.customer_email,
      items,
      discount_type = existing.discount_type,
      discount_value = existing.discount_value,
      payment_method = existing.payment_method,
      sales_person_id = existing.sales_person_id,
      sales_person_name = existing.sales_person_name,
      notes = existing.notes
    } = req.body;

    let normalizedItems = items;
    if (typeof normalizedItems === 'string') {
      try { normalizedItems = JSON.parse(normalizedItems); } catch (_) { normalizedItems = null; }
    }
    if (!Array.isArray(normalizedItems) || normalizedItems.length === 0) {
      return sendError(res, 'Cannot hold an empty cart.', 400);
    }

    const totals = calculateTotals(normalizedItems, discount_type, discount_value);

    // Auto-save customer into users table on update as well
    try {
      await findOrCreateCustomer({
        name: customer_name,
        phone: customer_phone,
        email: customer_email
      });
    } catch (custErr) {
      console.warn('[HoldBill] Could not auto-save customer info:', custErr.message);
    }

    await query(
      `UPDATE held_bills SET
         customer_name = ?, customer_phone = ?, customer_email = ?, items = ?, subtotal = ?,
         discount_type = ?, discount_value = ?, discount_amount = ?, total_amount = ?, payment_method = ?,
         sales_person_id = ?, sales_person_name = ?, notes = ?
       WHERE id = ?`,
      [
        customer_name || 'Walk-in Customer',
        customer_phone || null,
        customer_email || null,
        JSON.stringify(normalizedItems),
        totals.subtotal,
        totals.discount_type,
        totals.discount_value,
        totals.discount_amount,
        totals.total_amount,
        payment_method || 'Cash',
        sales_person_id || null,
        sales_person_name || null,
        notes || null,
        id
      ]
    );

    const rows = await query('SELECT * FROM held_bills WHERE id = ?', [id]);
    const bill = rows[0];
    if (bill && typeof bill.items === 'string') {
      try { bill.items = JSON.parse(bill.items); } catch (_) { bill.items = []; }
    }
    return sendSuccess(res, bill, 'Held bill updated');
  } catch (error) {
    next(error);
  }
}

// POST /api/admin/held-bills/:id/complete
async function completeHeldBill(req, res, next) {
  try {
    const { id } = req.params;
    const { order_id, order_number } = req.body;
    const rows = await query('SELECT * FROM held_bills WHERE id = ?', [id]);
    if (rows.length === 0) return sendError(res, 'Held bill not found', 404);
    if (rows[0].status !== 'held') return sendError(res, 'This bill is no longer held.', 400);

    const notes = order_number
      ? `${rows[0].notes ? `${rows[0].notes}\n` : ''}Completed as order ${order_number}`
      : rows[0].notes;

    await query(
      `UPDATE held_bills SET status = 'completed', notes = ? WHERE id = ?`,
      [notes || null, id]
    );

    const updated = await query('SELECT * FROM held_bills WHERE id = ?', [id]);
    const bill = updated[0];
    if (bill && typeof bill.items === 'string') {
      try { bill.items = JSON.parse(bill.items); } catch (_) { bill.items = []; }
    }
    return sendSuccess(res, { ...bill, order_id: order_id || null }, 'Held bill completed');
  } catch (error) {
    next(error);
  }
}

// DELETE /api/admin/held-bills/:id
async function cancelHeldBill(req, res, next) {
  try {
    const { id } = req.params;
    const rows = await query('SELECT * FROM held_bills WHERE id = ?', [id]);
    if (rows.length === 0) return sendError(res, 'Held bill not found', 404);

    await query('DELETE FROM held_bills WHERE id = ?', [id]);
    return sendSuccess(res, { id }, 'Held bill cancelled');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHeldBills,
  getHeldBillById,
  holdBill,
  updateHeldBill,
  completeHeldBill,
  cancelHeldBill
};
