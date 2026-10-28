require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { startCheckoutWorker } = require('./workers/checkoutWorker');
const Product = require('./models/Product');
const { initializeInventory } = require('./services/redisInventory');

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  console.log('----------------------------------------------------');
  console.log('⚡ Starting Flash-Sale High-Concurrency Backend API');
  console.log('----------------------------------------------------');

  // 1. Connect MongoDB
  const conn = await connectDB();

  // 2. Initialize background workers for async checkout queue
  startCheckoutWorker();

  // 3. Pre-load inventory into Redis/Memory gate
  try {
    if (conn) {
      const products = await Product.find({ isActive: true });
      for (const prod of products) {
        await initializeInventory(prod._id.toString(), prod.stock);
      }
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
