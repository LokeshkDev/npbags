const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const { sendError } = require('../utils/response');

async function authenticate(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return sendError(res, 'Authentication required. Please log in.', 401);
  }

  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    const users = await query('SELECT id, name, email, role, phone FROM users WHERE id = ?', [decoded.id]);

    if (!users || users.length === 0) {
      return sendError(res, 'User no longer exists.', 401);
    }

    req.user = users[0];
    next();
  } catch (error) {
    return sendError(res, 'Invalid or expired token.', 401);
  }
}

// Optional authentication: sets req.user if present, but doesn't reject if not
async function optionalAuth(req, res, next) {
  let token = null;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, env.jwt.secret);
      const users = await query('SELECT id, name, email, role, phone FROM users WHERE id = ?', [decoded.id]);
      if (users && users.length > 0) {
        req.user = users[0];
      }
    } catch (e) {
      // Ignore token decode failure on optional auth
    }
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuth
};

