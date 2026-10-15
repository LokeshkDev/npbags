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

const requireAdmin = requireRole('admin');

module.exports = {
  requireRole,
  requireAdmin
};

