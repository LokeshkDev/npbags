const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/', wishlistController.getWishlist);
router.post('/', wishlistController.addToWishlist);
router.delete('/:productId', wishlistController.removeFromWishlist);

module.exports = router;

