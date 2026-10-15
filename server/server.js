const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const env = require('./src/config/env');
const { testConnection } = require('./src/config/db');
const { notFound, errorHandler } = require('./src/middleware/error');

// Import route modules
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const categoryRoutes = require('./src/routes/categoryRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const wishlistRoutes = require('./src/routes/wishlistRoutes');
const cmsRoutes = require('./src/routes/cmsRoutes');
const bannerRoutes = require('./src/routes/bannerRoutes');
const blogRoutes = require('./src/routes/blogRoutes');
const contactRoutes = require('./src/routes/contactRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const { getStoreSettings } = require('./src/controllers/settingsController');

const app = express();

// Security and utility middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

// CORS setup
const allowedOrigins = [
  env.cors.clientUrl,
  env.cors.adminUrl,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || env.nodeEnv === 'development') {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads serving
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'NPGrand E-Commerce API is running',
    timestamp: new Date().toISOString(),
    env: env.nodeEnv
  });
});

// Settings & public routes
app.get('/api/settings', getStoreSettings);

// API route registrations
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/cms', cmsRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

// Start server
async function startServer() {
  await testConnection();
  app.listen(env.port, () => {
    console.log(`🚀 [NPGrand API] Server running on http://localhost:${env.port}`);
    console.log(`📁 Static uploads served at http://localhost:${env.port}/uploads`);
  });
}

startServer();

module.exports = app;

