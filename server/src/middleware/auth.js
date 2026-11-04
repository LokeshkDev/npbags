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
    const users = await query(
      `SELECT u.id, u.name, u.email, u.role, u.branch_id, u.allowed_menus, u.phone,
              b.name AS branch_name, b.code AS branch_code
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       WHERE u.id = ?`,
      [decoded.id]
    );

    if (!users || users.length === 0) {
      return sendError(res, 'User no longer exists.', 401);
    }

    const u = users[0];
    if (u.allowed_menus && typeof u.allowed_menus === 'string') {
      try {
        u.allowed_menus = JSON.parse(u.allowed_menus);
      } catch (e) {
        u.allowed_menus = null;
      }
    }
    req.user = u;
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
      const users = await query(
        `SELECT u.id, u.name, u.email, u.role, u.branch_id, u.allowed_menus, u.phone,
                b.name AS branch_name, b.code AS branch_code
         FROM users u
         LEFT JOIN branches b ON u.branch_id = b.id
         WHERE u.id = ?`,
        [decoded.id]
      );
      if (users && users.length > 0) {
        const u = users[0];
        if (u.allowed_menus && typeof u.allowed_menus === 'string') {
          try {
            u.allowed_menus = JSON.parse(u.allowed_menus);
          } catch (e) {
            u.allowed_menus = null;
          }
        }
        req.user = u;
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

