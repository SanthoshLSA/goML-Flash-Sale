require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initDB } = require('./config/db');
const { startCheckoutWorker } = require('./workers/checkoutWorker');
const ProductModel = require('./models/productModel');
const { initializeInventory } = require('./services/redisInventory');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  console.log('----------------------------------------------------');
  console.log('⚡ Starting Flash-Sale High-Concurrency Backend API');
  console.log('----------------------------------------------------');

  // 1. Initialize PostgreSQL Connection & DDL Schema
  await initDB();

  // 2. Initialize background workers for async checkout queue
  startCheckoutWorker();

  // 3. Pre-load inventory into Redis/Memory gate
  try {
    const products = await ProductModel.findActive();
    for (const prod of products) {
      await initializeInventory(prod.id, prod.stock);
    }
  } catch (err) {
    console.warn('[Server] Product inventory pre-sync note:', err.message);
  }

  // 4. Start HTTP Server
  const server = http.createServer(app);

  server.listen(PORT, () => {
    console.log(`[Server] Listening on http://localhost:${PORT}`);
    console.log(`[Server] Ready to ingest flash-sale traffic with zero overselling!`);
  });
};

startServer();
