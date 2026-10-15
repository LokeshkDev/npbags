const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { optionalAuth, authenticate } = require('../middleware/auth');

router.post('/', optionalAuth, orderController.createOrder);
router.post('/validate-coupon', orderController.validateCoupon);
router.get('/my-orders', authenticate, orderController.getMyOrders);
router.get('/:identifier', orderController.getOrderDetails);

module.exports = router;

