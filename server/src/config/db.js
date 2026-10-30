const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  decimalNumbers: true
});

async function query(sql, params) {
  try {
    const [rows, fields] = await pool.execute(sql, params || []);
    return rows;
  } catch (error) {
    console.error(`[DB Query Error] ${error.message} - SQL: ${sql}`);
    throw error;
  }
}

async function withTransaction(handler) {
  const connection = await pool.getConnection();
  const tx = {
    raw: connection,
    query: async (sql, params) => {
      const [rows] = await connection.execute(sql, params || []);
      return rows;
    }
  };

  try {
    await connection.beginTransaction();
    const result = await handler(tx);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error('[DB Rollback Error]', rollbackError.message);
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[DB] Connected successfully to MySQL (${env.db.host}:${env.db.port}/${env.db.database})`);
    connection.release();
    return true;
  } catch (error) {
    console.error(`[DB Connection Warning] Could not connect to MySQL at ${env.db.host}:${env.db.port} - ${error.message}`);
    return false;
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
  testConnection
};

