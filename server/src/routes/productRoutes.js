const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, productController.getAllProducts);
router.get('/:identifier', optionalAuth, productController.getProductBySlugOrId);

module.exports = router;

