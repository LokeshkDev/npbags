const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/role');
const { upload } = require('../middleware/upload');

const productController = require('../controllers/productController');
const categoryController = require('../controllers/categoryController');
const orderController = require('../controllers/orderController');
const cmsController = require('../controllers/cmsController');
const bannerController = require('../controllers/bannerController');
const blogController = require('../controllers/blogController');
const contactController = require('../controllers/contactController');
const settingsController = require('../controllers/settingsController');
const customerController = require('../controllers/customerController');

// All admin routes require authentication and admin role
router.use(authenticate, requireAdmin);

// Analytics / Stats
router.get('/stats', settingsController.getAdminStats);

// Products
router.post('/products', upload.array('images', 8), productController.createProduct);
router.put('/products/:id', upload.array('images', 8), productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);
router.post('/products/:id/duplicate', productController.duplicateProduct);
router.delete('/products/:id/images/:imageId', productController.deleteProductImage);
router.put('/products/:id/images/:imageId/replace', upload.single('image'), productController.replaceProductImage);
router.put('/products/:id/images/:imageId/primary', productController.setPrimaryProductImage);
router.post('/products/:id/images', upload.single('image'), productController.uploadProductGalleryImage);

// Categories
router.post('/categories', upload.single('image'), categoryController.createCategory);
router.put('/categories/:id', upload.single('image'), categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// Orders
router.get('/orders', orderController.getAllOrdersAdmin);
router.put('/orders/:id/status', orderController.updateOrderStatus);

// CMS & Homepage Sections
router.get('/cms/sections', cmsController.getAdminCMSSections);
router.put('/cms/sections-reorder', cmsController.reorderCMSSections);
router.put('/cms/sections/:section_key', cmsController.updateCMSSection);
router.post('/cms/upload', upload.single('image'), cmsController.uploadCMSImage);

// Delivery Settings
router.get('/cms/delivery-settings', cmsController.getDeliverySettings);
router.put('/cms/delivery-settings', cmsController.updateDeliverySettings);

// Banners
router.get('/banners', bannerController.getAllBannersAdmin);
router.post('/banners', upload.single('image'), bannerController.createBanner);
router.put('/banners/:id', upload.single('image'), bannerController.updateBanner);
router.delete('/banners/:id', bannerController.deleteBanner);

// Coupons
router.get('/coupons', settingsController.getCoupons);
router.post('/coupons', settingsController.createCoupon);
router.delete('/coupons/:id', settingsController.deleteCoupon);

// Blogs
router.get('/blogs', blogController.getAllBlogsAdmin);
router.post('/blogs', upload.single('cover_image'), blogController.createBlog);
router.put('/blogs/:id', upload.single('cover_image'), blogController.updateBlog);
router.delete('/blogs/:id', blogController.deleteBlog);

// Contact & Newsletter
router.get('/messages', contactController.getContactMessagesAdmin);
router.get('/subscribers', contactController.getSubscribersAdmin);

// Store Settings
router.get('/settings', settingsController.getStoreSettings);
router.put('/settings', upload.single('logo'), settingsController.updateStoreSettings);

// Customers & Registered Users CRUD + Reset Password
router.get('/customers', customerController.getAllCustomersAdmin);
router.get('/customers/:id', customerController.getCustomerByIdAdmin);
router.post('/customers', customerController.createCustomerAdmin);
router.put('/customers/:id', customerController.updateCustomerAdmin);
router.delete('/customers/:id', customerController.deleteCustomerAdmin);
router.post('/customers/:id/reset-password', customerController.resetCustomerPasswordAdmin);

module.exports = router;

