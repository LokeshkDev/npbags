const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get all customers with search and order statistics
 */
async function getAllCustomersAdmin(req, res, next) {
  try {
    const { search } = req.query;
    let sql = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.phone, 
        u.avatar, 
        u.created_at, 
        u.updated_at,
        COUNT(o.id) AS total_orders,
        COALESCE(SUM(o.total_amount), 0) AS total_spent,
        MAX(o.created_at) AS last_order_date
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id
    `;
    const params = [];

    if (search && search.trim()) {
      sql += ` WHERE u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` GROUP BY u.id, u.name, u.email, u.role, u.phone, u.avatar, u.created_at, u.updated_at ORDER BY u.created_at DESC`;

    const customers = await query(sql, params);
    return sendSuccess(res, customers, 'Customers retrieved successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * Get single customer details with order history
 */
async function getCustomerByIdAdmin(req, res, next) {
  try {
    const { id } = req.params;
    const users = await query(
      `SELECT id, name, email, role, phone, avatar, created_at, updated_at FROM users WHERE id = ?`,
      [id]
    );

    if (users.length === 0) {
      return sendError(res, 'Customer not found.', 404);
    }

    const customer = users[0];
    const orders = await query(
      `SELECT id, order_number, total_amount, order_status, payment_method, shipping_address, created_at 
       FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
      [id]
    );

    for (const ord of orders) {
      if (typeof ord.shipping_address === 'string') {
        try {
          ord.shipping_address = JSON.parse(ord.shipping_address);
        } catch (e) {}
      }
    }

    customer.orders = orders;
    return sendSuccess(res, customer, 'Customer profile retrieved');
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new customer from admin
 */
async function createCustomerAdmin(req, res, next) {
  try {
    const { name, email, password, phone, role = 'customer' } = req.body;

    if (!name || !email || !password || !phone || !phone.trim()) {
      return sendError(res, 'Name, email, phone number, and password are required.', 400);
    }

    if (password.trim().length < 6) {
      return sendError(res, 'Password must be at least 6 characters long.', 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      return sendError(res, 'A customer with this email already exists.', 400);
    }

    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    const result = await query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), cleanEmail, hashedPassword, role || 'customer', phone ? phone.trim() : null]
    );

    const newCustomer = {
      id: result.insertId,
      name: name.trim(),
      email: cleanEmail,
      role: role || 'customer',
      phone: phone ? phone.trim() : null,
      total_orders: 0,
      total_spent: 0,
      created_at: new Date()
    };

    return sendSuccess(res, newCustomer, 'Customer created successfully.', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing customer
 */
async function updateCustomerAdmin(req, res, next) {
  try {
    const { id } = req.params;
    const { name, email, phone, role } = req.body;

    if (!name || !email) {
      return sendError(res, 'Name and email are required.', 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await query('SELECT id FROM users WHERE email = ? AND id != ?', [cleanEmail, id]);
    if (existing.length > 0) {
      return sendError(res, 'This email is already in use by another user.', 400);
    }

    await query(
      'UPDATE users SET name = ?, email = ?, phone = ?, role = COALESCE(?, role) WHERE id = ?',
      [name.trim(), cleanEmail, phone ? phone.trim() : null, role || null, id]
    );

    const updated = await query(
      'SELECT id, name, email, role, phone, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    return sendSuccess(res, updated[0], 'Customer updated successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a customer
 */
async function deleteCustomerAdmin(req, res, next) {
  try {
    const { id } = req.params;

    if (req.user && String(req.user.id) === String(id)) {
      return sendError(res, 'You cannot delete your own logged-in admin account.', 400);
    }

    const user = await query('SELECT id, role FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
      return sendError(res, 'Customer not found.', 404);
    }

    // Preserve orders history by unlinking user_id rather than failing foreign key
    await query('UPDATE orders SET user_id = NULL WHERE user_id = ?', [id]);
    await query('DELETE FROM users WHERE id = ?', [id]);

    return sendSuccess(res, null, 'Customer deleted successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Reset customer's password from admin
 */
async function resetCustomerPasswordAdmin(req, res, next) {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.trim().length < 6) {
      return sendError(res, 'New password must be at least 6 characters long.', 400);
    }

    const user = await query('SELECT id, email, name FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
      return sendError(res, 'Customer not found.', 404);
    }

    const hashedPassword = await bcrypt.hash(new_password.trim(), 10);
    await query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);

    return sendSuccess(res, null, `Password for ${user[0].name} (${user[0].email}) has been reset successfully.`);
  } catch (error) {
    next(error);
  }
}

/**
 * Fast lookup customer by phone number for POS auto-population
 */
async function lookupCustomerByPhone(req, res, next) {
  try {
    const rawPhone = (req.query.phone || '').trim().replace(/\D/g, '');
    if (!rawPhone || rawPhone.length < 5) {
      return sendSuccess(res, null, 'Phone query too short');
    }

    const tenDigit = rawPhone.length >= 10 ? rawPhone.slice(-10) : rawPhone;

    // 1. Check registered users table
    const users = await query(
      `SELECT id, name, email, phone FROM users WHERE phone LIKE ? OR phone LIKE ? LIMIT 1`,
      [`%${rawPhone}%`, `%${tenDigit}%`]
    );

    if (users.length > 0) {
      return sendSuccess(res, users[0], 'Customer found in users');
    }

    // 2. Check orders table for past walk-in or POS billing
    const orderCustomer = await query(
      `SELECT customer_name AS name, customer_email AS email, customer_phone AS phone
       FROM orders
       WHERE customer_phone LIKE ? OR customer_phone LIKE ?
       ORDER BY id DESC LIMIT 1`,
      [`%${rawPhone}%`, `%${tenDigit}%`]
    );

    if (orderCustomer.length > 0) {
      return sendSuccess(res, orderCustomer[0], 'Customer found in orders');
    }

    return sendSuccess(res, null, 'No customer found');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllCustomersAdmin,
  getCustomerByIdAdmin,
  createCustomerAdmin,
  updateCustomerAdmin,
  deleteCustomerAdmin,
  resetCustomerPasswordAdmin,
  lookupCustomerByPhone
};

