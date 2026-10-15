const express = require('express');
const router = express.Router();
const cmsController = require('../controllers/cmsController');

// Public storefront endpoints
router.get('/sections', cmsController.getCMSSections);
router.get('/delivery-settings', cmsController.getDeliverySettings);

module.exports = router;

