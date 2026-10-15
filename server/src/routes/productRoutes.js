const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/', productController.getAllProducts);
router.get('/:identifier', productController.getProductBySlugOrId);

module.exports = router;

