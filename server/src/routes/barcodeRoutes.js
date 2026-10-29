/**
 * Barcode Routes for NP Grand Shopping
 * Fast lookup used by POS scanner and storefront/admin.
 */

const express = require('express');
const router = express.Router();
const barcodeController = require('../controllers/barcodeController');

router.get('/lookup', barcodeController.lookupBarcode);
router.get('/svg/:code', barcodeController.getBarcodeSvg);

module.exports = router;

