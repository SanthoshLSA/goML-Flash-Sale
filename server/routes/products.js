const express = require('express');
const Product = require('../models/Product');
const { getStock, initializeInventory } = require('../services/redisInventory');

const router = express.Router();

// Fallback in-memory product if database is not yet seeded
const DEFAULT_PRODUCT = {
  _id: 'flash_phone_500',
  name: 'FlashPhone Ultra 5G (Limited Edition)',
  description: 'Flagship high-demand festive smartphone. Batch of 500 units only.',
  price: 699,
  stock: 500,
  totalInitialStock: 500,
  isActive: true,
  imageUrl: 'https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800&auto=format&fit=crop&q=80',
};

/**
 * GET /api/products
 * Fetch active flash-sale products
 */
router.get('/', async (req, res) => {
  try {
    let products = await Product.find({ isActive: true });
    if (!products || products.length === 0) {
      // Initialize default product in Redis/memory
      await initializeInventory(DEFAULT_PRODUCT._id, DEFAULT_PRODUCT.stock);
      return res.json([DEFAULT_PRODUCT]);
    }

    // Attach latest real-time stock numbers
    const enriched = await Promise.all(
      products.map(async (p) => {
        const liveStock = await getStock(p._id.toString());
        return {
          ...p.toObject(),
          stock: liveStock !== null ? liveStock : p.stock,
        };
      })
    );

    return res.json(enriched);
  } catch (error) {
    console.warn('[API Products] Error querying MongoDB:', error.message);
    return res.json([DEFAULT_PRODUCT]);
  }
});

/**
 * GET /api/products/:id/stock/sse
 * Server-Sent Events stream for real-time live stock countdown updates
 */
router.get('/:id/stock/sse', async (req, res) => {
  const { id } = req.params;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  console.log(`[SSE] Client subscribed to stock stream for product ${id}`);

  let lastSentStock = null;

  const sendStockUpdate = async () => {
    try {
      let currentStock = await getStock(id);
      if (currentStock === null) {
        const prod = await Product.findById(id).catch(() => null);
        currentStock = prod ? prod.stock : 500;
        await initializeInventory(id, currentStock);
      }

      if (currentStock !== lastSentStock) {
        lastSentStock = currentStock;
        res.write(`data: ${JSON.stringify({ productId: id, stock: currentStock, timestamp: Date.now() })}\n\n`);
      }
    } catch (err) {
      console.warn(`[SSE] Error sending update:`, err.message);
    }
  };

  // Immediate initial send
  await sendStockUpdate();

  // Periodic heartbeat interval
  const intervalId = setInterval(sendStockUpdate, 1500);

  req.on('close', () => {
    clearInterval(intervalId);
    console.log(`[SSE] Client disconnected for product ${id}`);
    res.end();
  });
});

/**
 * POST /api/products/:id/reset
 * Testing endpoint to reset inventory count back to 500
 */
router.post('/:id/reset', async (req, res) => {
  const { id } = req.params;
  const count = parseInt(req.body.stock, 10) || 500;

  await initializeInventory(id, count);

  try {
    await Product.findByIdAndUpdate(id, { stock: count, totalInitialStock: count });
  } catch (e) {
    //
  }

  res.json({ message: `Inventory for product ${id} reset to ${count}`, stock: count });
});

module.exports = router;
