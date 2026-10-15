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

    if (!name || !email || !password) {
      return sendError(res, 'Name, email, and password are required.', 400);
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

module.exports = {
  register,
  login,
  adminLogin,
  getMe,
  updateProfile
};

