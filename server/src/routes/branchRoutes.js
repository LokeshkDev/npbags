const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../middleware/role');
const {
  getAllBranches,
  getBranchById,
  createBranch,
  updateBranch,
  deleteBranch,
  getAllBranchUsers,
  createBranchUser,
  updateBranchUser,
  deleteBranchUser,
  getBranchStocks,
  pushProductsToBranch,
  pushCategoryToBranch,
  updateBranchProductStock,
  pushStockToMainBranch
} = require('../controllers/branchController');

// All branch management routes require authentication + administrative privileges
router.use(authenticate, requireAdmin);

// Middleware: allow Super Admin OR Branch Admin assigned to the target branch
const allowSuperAdminOrBranchAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  const targetBranchId = parseInt(req.params.id, 10);
  if (req.user && req.user.branch_id && parseInt(req.user.branch_id, 10) === targetBranchId) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Access denied: You do not have permission to manage this branch inventory.' });
};

// Branch endpoints
router.get('/', getAllBranches);
router.get('/users', getAllBranchUsers);
router.get('/:id', getBranchById);
router.get('/:id/stocks', getBranchStocks);

// Creation and modification endpoints (Only Super Admin can create/edit branches and assign branch credentials)
router.post('/', requireSuperAdmin, createBranch);
router.put('/:id', requireSuperAdmin, updateBranch);
router.delete('/:id', requireSuperAdmin, deleteBranch);

router.post('/users', requireSuperAdmin, createBranchUser);
router.put('/users/:id', requireSuperAdmin, updateBranchUser);
router.delete('/users/:id', requireSuperAdmin, deleteBranchUser);

// Push Products and Categories to Branch (Super Admin)
router.post('/:id/push-products', requireSuperAdmin, pushProductsToBranch);
router.post('/:id/push-category', requireSuperAdmin, pushCategoryToBranch);

// Stock Maintenance & Visibility (Super Admin or Branch Admin of that branch)
router.put('/:id/stocks/:productId', allowSuperAdminOrBranchAdmin, updateBranchProductStock);

// Push / Transfer Branch Stock back to Main Branch (Super Admin or Branch Admin)
router.post('/:id/stocks/:productId/push-to-main', allowSuperAdminOrBranchAdmin, pushStockToMainBranch);

module.exports = router;

