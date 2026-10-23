const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const { sendSuccess, sendError } = require('../utils/response');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );
}

async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone || !phone.trim()) {
      return sendError(res, 'Name, email, phone number, and password are required.', 400);
    }

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return sendError(res, 'An account with this email already exists.', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
      [name, email.toLowerCase().trim(), hashedPassword, 'customer', phone || null]
    );

    const newUser = {
      id: result.insertId,
      name,
      email: email.toLowerCase().trim(),
      role: 'customer',
      phone: phone || null
    };

    const token = generateToken(newUser);
    return sendSuccess(res, { user: newUser, token }, 'Registration successful', 201);
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required.', 400);
    }

    const users = await query('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (users.length === 0) {
      return sendError(res, 'Invalid email or password.', 401);
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 'Invalid email or password.', 401);
    }

    const token = generateToken(user);
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    };

    return sendSuccess(res, { user: safeUser, token }, 'Login successful');
  } catch (error) {
    next(error);
  }
}

async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 'Email and password are required.', 400);
    }

    const users = await query('SELECT * FROM users WHERE email = ? AND role = "admin"', [email.toLowerCase().trim()]);
    if (users.length === 0) {
      return sendError(res, 'Invalid admin credentials.', 401);
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendError(res, 'Invalid admin credentials.', 401);
    }

    const token = generateToken(user);
    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    };

    return sendSuccess(res, { user: safeUser, token }, 'Admin login successful');
  } catch (error) {
    next(error);
  }
}

async function getMe(req, res, next) {
  try {
    return sendSuccess(res, { user: req.user }, 'User profile retrieved');
  } catch (error) {
    next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { name, phone } = req.body;
    await query('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?', [
      name || null,
      phone || null,
      req.user.id
    ]);

    const users = await query('SELECT id, name, email, role, phone FROM users WHERE id = ?', [req.user.id]);
    return sendSuccess(res, { user: users[0] }, 'Profile updated successfully');
  } catch (error) {
    next(error);
  }
}

async function getUserAddresses(req, res, next) {
  try {
    const userId = req.user.id;
    let addrs = await query('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [userId]);

    // If no addresses in addresses table yet, pull latest shipping address from orders table
    if (addrs.length === 0) {
      const orders = await query(
        'SELECT shipping_address, customer_name, customer_phone FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 5',
        [userId]
      );
      for (const ord of orders) {
        if (ord.shipping_address) {
          try {
            const parsed = typeof ord.shipping_address === 'string' ? JSON.parse(ord.shipping_address) : ord.shipping_address;
            if (parsed.line1 || parsed.address_line1) {
              const addrType = (parsed.address_type || 'home').toLowerCase();
              const insertRes = await query(
                `INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, city, state, postal_code, is_default, address_type)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  userId,
                  ord.customer_name || req.user.name || 'Default Name',
                  ord.customer_phone || req.user.phone || '',
                  parsed.line1 || parsed.address_line1,
                  parsed.line2 || parsed.address_line2 || '',
                  parsed.city || '',
                  parsed.state || '',
                  parsed.postal_code || '',
                  1,
                  addrType
                ]
              );
              addrs.push({
                id: insertRes.insertId,
                user_id: userId,
                full_name: ord.customer_name || req.user.name || 'Default Name',
                phone: ord.customer_phone || req.user.phone || '',
                address_line1: parsed.line1 || parsed.address_line1,
                address_line2: parsed.line2 || parsed.address_line2 || '',
                city: parsed.city || '',
                state: parsed.state || '',
                postal_code: parsed.postal_code || '',
                is_default: 1,
                address_type: addrType
              });
              break;
            }
          } catch (e) {}
        }
      }
    }

    return sendSuccess(res, addrs);
  } catch (error) {
    next(error);
  }
}

async function saveUserAddress(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      full_name,
      phone,
      address_line1,
      line1,
      address_line2,
      line2,
      city,
      state,
      postal_code,
      is_default = false,
      address_type = 'home'
    } = req.body;

    const finalLine1 = address_line1 || line1;
    const finalLine2 = address_line2 || line2 || '';
    if (!finalLine1 || !city || !state || !postal_code) {
      return sendError(res, 'Street address, city, state, and postal code are required.', 400);
    }

    const addrType = (address_type || 'home').toLowerCase();

    // Check if an address of this type already exists for this user
    const existing = await query(
      'SELECT id FROM addresses WHERE user_id = ? AND address_type = ?',
      [userId, addrType]
    );

    if (existing.length > 0) {
      await query(
        `UPDATE addresses SET
           full_name = COALESCE(?, full_name),
           phone = COALESCE(?, phone),
           address_line1 = ?,
           address_line2 = ?,
           city = ?,
           state = ?,
           postal_code = ?,
           is_default = ?
         WHERE id = ?`,
        [
          full_name || req.user.name || null,
          phone || req.user.phone || null,
          finalLine1,
          finalLine2,
          city,
          state,
          postal_code,
          is_default ? 1 : 0,
          existing[0].id
        ]
      );
    } else {
      await query(
        `INSERT INTO addresses (user_id, full_name, phone, address_line1, address_line2, city, state, postal_code, is_default, address_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          full_name || req.user.name || 'Default Name',
          phone || req.user.phone || '',
          finalLine1,
          finalLine2,
          city,
          state,
          postal_code,
          is_default ? 1 : 0,
          addrType
        ]
      );
    }

    const allAddrs = await query('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC', [userId]);
    return sendSuccess(res, allAddrs, 'Address saved successfully');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  register,
  login,
  adminLogin,
  getMe,
  updateProfile,
  getUserAddresses,
  saveUserAddress
};

