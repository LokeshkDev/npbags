const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'npgrand_store'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'npgrand_super_secret_jwt_key_2026_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },
  cors: {
    clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
    adminUrl: process.env.ADMIN_URL || 'http://localhost:3001'
  },
  baseUrl: process.env.BASE_URL || 'http://localhost:5000'
};

