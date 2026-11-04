const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { optionalAuth, authenticate } = require('../middleware/auth');

router.post('/', optionalAuth, orderController.createOrder);
router.post('/razorpay/create', optionalAuth, orderController.createRazorpayPayment);
router.post('/razorpay/verify', optionalAuth, orderController.verifyRazorpayPayment);
router.post('/razorpay/cancel', optionalAuth, orderController.cancelRazorpayPayment);
router.post('/validate-coupon', orderController.validateCoupon);
router.get('/my-orders', authenticate, orderController.getMyOrders);
router.get('/:identifier', orderController.getOrderDetails);

module.exports = router;

