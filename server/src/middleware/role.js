const { sendError } = require('../utils/response');

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required.', 401);
    }
    if (req.user.role !== role) {
      return sendError(res, `Access denied. Requires ${role} role.`, 403);
    }
    next();
  };
}

// Allows Super Admin as well as Branch Admins / Staff for administration tasks
function requireAdmin(req, res, next) {
  if (!req.user) {
    return sendError(res, 'Authentication required.', 401);
  }
  const allowedRoles = ['admin', 'branch_admin', 'branch_staff'];
  if (!allowedRoles.includes(req.user.role)) {
    return sendError(res, 'Access denied. Requires administrative access.', 403);
  }
  next();
}

// Strictly requires Super Admin (e.g. for sensitive system settings, branch setup)
function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return sendError(res, 'Authentication required.', 401);
  }
  if (req.user.role !== 'admin') {
    return sendError(res, 'Access denied. Requires Super Administrator role.', 403);
  }
  next();
}

module.exports = {
  requireRole,
  requireAdmin,
  requireSuperAdmin
};

