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
  updateBranchProductStock
} = require('../controllers/branchController');

// All branch management routes require authentication + administrative privileges
router.use(authenticate, requireAdmin);

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
router.put('/:id/stocks/:productId', requireSuperAdmin, updateBranchProductStock);

module.exports = router;

