const express = require('express');
const ProductModel = require('../models/productModel');
const { getStock, initializeInventory } = require('../services/redisInventory');

const router = express.Router();

/**
 * GET /api/products
 * Fetch active flash-sale products from PostgreSQL
 */
router.get('/', async (req, res) => {
  try {
    const products = await ProductModel.findActive();

    // Attach real-time stock and compatibility fields
    const enriched = await Promise.all(
      products.map(async (p) => {
        const liveStock = await getStock(p.id);
        const currentStock = liveStock !== null ? liveStock : parseInt(p.stock, 10);
        return {
          _id: p.id,
          id: p.id,
          name: p.name,
          description: p.description,
          price: parseFloat(p.price),
          stock: currentStock,
          totalInitialStock: parseInt(p.total_initial_stock || p.stock, 10),
          isActive: p.is_active,
          imageUrl: p.image_url,
        };
      })
    );

    return res.json(enriched);
  } catch (error) {
    console.warn('[API Products] Error querying products:', error.message);
    return res.json([]);
  }
});

/**
 * GET /api/products/:id/stock/sse
 * Server-Sent Events stream for real-time live stock countdown updates
 */
router.get('/:id/stock/sse', async (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let lastSentStock = null;

  const sendStockUpdate = async () => {
    try {
      let currentStock = await getStock(id);
      if (currentStock === null) {
        const prod = await ProductModel.findById(id);
        currentStock = prod ? parseInt(prod.stock, 10) : 500;
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

  await sendStockUpdate();
  const intervalId = setInterval(sendStockUpdate, 1500);

  req.on('close', () => {
    clearInterval(intervalId);
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
  await ProductModel.resetStock(id, count);

  res.json({ message: `Inventory for product ${id} reset to ${count}`, stock: count });
});

module.exports = router;
