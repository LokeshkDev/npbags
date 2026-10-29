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
const barcodeRoutes = require('./src/routes/barcodeRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const { getStoreSettings } = require('./src/controllers/settingsController');

const app = express();

// CORS configuration - MUST run before other middlewares to guarantee preflight responses
const configuredOrigins = [
  env.cors.clientUrl,
  env.cors.adminUrl,
  ...(env.cors.allowedOrigins ? env.cors.allowedOrigins.split(',') : []),
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : []),
  'https://npbags.vercel.app',
  'https://npbags-admin.vercel.app',
  'https://npbags-backend.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
]
  .filter(Boolean)
  .map(o => o.trim().replace(/\/+$/, ''));

function isOriginAllowed(origin) {
  // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
  if (!origin) return true;

  const cleanOrigin = origin.trim().replace(/\/+$/, '');

  // 1. Matches configured or wildcard origins
  if (configuredOrigins.includes(cleanOrigin) || configuredOrigins.includes('*')) {
    return true;
  }

  // 2. Allow all Vercel deployments (production, branch preview URLs)
  if (/^https:\/\/([a-zA-Z0-9_-]+\.)*vercel\.app$/i.test(cleanOrigin)) {
    return true;
  }

  // 3. Allow all Render URLs
  if (/^https:\/\/([a-zA-Z0-9_-]+\.)*onrender\.com$/i.test(cleanOrigin)) {
    return true;
  }

  // 4. Allow any localhost or 127.0.0.1 on any port
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin)) {
    return true;
  }

  // 5. Permissive fallback for custom domains unless strict mode is enabled
  if (process.env.CORS_STRICT !== 'true') {
    return true;
  }

  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked unallowed origin: ${origin}`);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range', 'Authorization'],
  maxAge: 86400,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security and utility middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression());
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

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
app.use('/api/barcodes', barcodeRoutes);
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

