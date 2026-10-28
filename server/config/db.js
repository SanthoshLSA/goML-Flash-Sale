const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  'postgres://postgres:postgres@localhost:5432/flashsale';

let pool = null;
let isConnected = false;

try {
  pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 2000,
    idleTimeoutMillis: 10000,
    max: 20, // Max clients in pool
    ssl: connectionString.includes('sslmode=require') || connectionString.includes('neon.tech') || connectionString.includes('supabase')
      ? { rejectUnauthorized: false }
      : false,
  });

  pool.on('error', (err) => {
    isConnected = false;
    console.warn(`[PostgreSQL Pool Error]: ${err.message}`);
  });
} catch (e) {
  isConnected = false;
  console.warn(`[PostgreSQL Init Note]: ${e.message}`);
}

/**
 * Initialize PostgreSQL Schema DDL
 * Creates products and orders tables with strict CHECK (stock >= 0) constraint
 */
const initDB = async () => {
  if (!pool) return false;

  try {
    const client = await pool.connect();
    isConnected = true;
    console.log('[PostgreSQL] Connected to database successfully.');

    // 1. Products Table with strict CHECK (stock >= 0) constraint
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL,
        stock INT NOT NULL CHECK (stock >= 0),
        total_initial_stock INT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        image_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. Orders Table with unique tracking_id & idempotency_key
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        tracking_id VARCHAR(64) UNIQUE NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) REFERENCES products(id),
        status VARCHAR(32) NOT NULL,
        idempotency_key VARCHAR(128) UNIQUE,
        confirmed_at TIMESTAMP WITH TIME ZONE,
        failure_reason TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_orders_tracking ON orders(tracking_id);
      CREATE INDEX IF NOT EXISTS idx_orders_user_prod ON orders(user_id, product_id, status);
    `);

    client.release();
    console.log('[PostgreSQL] Database tables & constraints initialized.');
    return true;
  } catch (err) {
    isConnected = false;
    console.warn(`[PostgreSQL] Connection warning: ${err.message}`);
    console.warn(`[PostgreSQL] Set DATABASE_URL in .env if using a live PostgreSQL instance (e.g. Neon, Supabase, local).`);
    return false;
  }
};

module.exports = {
  pool,
  initDB,
  isPostgresConnected: () => isConnected,
};
