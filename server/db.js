const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/flashsale',
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 10000,
  max: 20,
  ssl: process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('sslmode=require') || process.env.DATABASE_URL.includes('neon.tech') || process.env.DATABASE_URL.includes('supabase'))
    ? { rejectUnauthorized: false }
    : false,
});

let isConnected = false;

pool.on('error', () => {
  isConnected = false;
});

const initDB = async () => {
  try {
    const client = await pool.connect();
    isConnected = true;

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
    return true;
  } catch (err) {
    isConnected = false;
    return false;
  }
};

let memoryProducts = [
  {
    id: 'phone_flash_01',
    name: 'FlashPhone Ultra 5G (Limited Edition)',
    description: 'Flagship festival edition smartphone. 500 units available.',
    price: 699,
    stock: 500,
    total_initial_stock: 500,
    is_active: true,
    image_url: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80',
  },
];

let memoryOrders = new Map();

const getProducts = async () => {
  if (isConnected) {
    try {
      const res = await pool.query('SELECT * FROM products WHERE is_active = TRUE');
      if (res.rows.length > 0) return res.rows;
    } catch (err) {}
  }
  return memoryProducts;
};

const getProductById = async (id) => {
  if (isConnected) {
    try {
      const res = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
      return res.rows[0] || null;
    } catch (err) {}
  }
  return memoryProducts.find((p) => p.id === id) || null;
};

const upsertProduct = async (product) => {
  if (isConnected) {
    try {
      await pool.query(
        `INSERT INTO products (id, name, description, price, stock, total_initial_stock, is_active, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           stock = EXCLUDED.stock,
           total_initial_stock = EXCLUDED.total_initial_stock`,
        [
          product.id,
          product.name,
          product.description || '',
          product.price,
          product.stock,
          product.total_initial_stock,
          product.is_active ?? true,
          product.image_url || '',
        ]
      );
      return;
    } catch (err) {}
  }

  const idx = memoryProducts.findIndex((p) => p.id === product.id);
  if (idx >= 0) memoryProducts[idx] = product;
  else memoryProducts.push(product);
};

const resetStock = async (id, count) => {
  if (isConnected) {
    try {
      await pool.query('UPDATE products SET stock = $1, total_initial_stock = $1 WHERE id = $2', [count, id]);
      return;
    } catch (err) {}
  }
  const item = memoryProducts.find((p) => p.id === id);
  if (item) item.stock = count;
};

const getOrderByTrackingId = async (trackingId) => {
  if (isConnected) {
    try {
      const res = await pool.query('SELECT * FROM orders WHERE tracking_id = $1', [trackingId]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {}
  }
  return memoryOrders.get(trackingId) || null;
};

const getOrderByIdempotencyKey = async (key) => {
  if (isConnected) {
    try {
      const res = await pool.query('SELECT * FROM orders WHERE idempotency_key = $1', [key]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {}
  }
  return memoryOrders.get(key) || null;
};

const saveOrder = async (order) => {
  if (isConnected) {
    try {
      const res = await pool.query(
        `INSERT INTO orders (tracking_id, user_id, product_id, status, idempotency_key, confirmed_at, failure_reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          order.trackingId,
          order.userId,
          order.productId,
          order.status,
          order.idempotencyKey || null,
          order.confirmedAt || null,
          order.failureReason || null,
        ]
      );
      return res.rows[0];
    } catch (err) {}
  }

  const saved = {
    id: `ord_${Math.random().toString(36).substring(2, 9)}`,
    tracking_id: order.trackingId,
    status: order.status,
    confirmed_at: order.confirmedAt,
  };
  memoryOrders.set(order.trackingId, saved);
  if (order.idempotencyKey) memoryOrders.set(order.idempotencyKey, saved);
  return saved;
};

module.exports = {
  pool,
  initDB,
  isPostgresConnected: () => isConnected,
  getProducts,
  getProductById,
  upsertProduct,
  resetStock,
  getOrderByTrackingId,
  getOrderByIdempotencyKey,
  saveOrder,
};
