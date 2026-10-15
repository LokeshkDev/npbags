const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

async function setup() {
  console.log(`[DB Setup] Connecting to MySQL server at ${env.db.host}:${env.db.port}...`);
  let connection;
  try {
    // Connect without specifying database first to create database if not exists
    connection = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      multipleStatements: true
    });

    console.log(`[DB Setup] Ensuring database \`${env.db.database}\` exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${env.db.database}\`;`);

    const schemaPath = path.resolve(__dirname, '../../db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('[DB Setup] Executing schema.sql...');
    await connection.query(schemaSql);
    console.log('[DB Setup] All tables created successfully!');

    await connection.end();
    console.log('[DB Setup] Done! You can now run `npm run db:seed` to insert demo data.');
  } catch (error) {
    console.error('[DB Setup Error]', error.message);
    if (connection) await connection.end().catch(() => {});
    process.exit(1);
  }
}

setup();

