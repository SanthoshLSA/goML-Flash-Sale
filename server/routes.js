const express = require('express');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { getProducts, getProductById, resetStock, getOrderByTrackingId } = require('./db');
const { getStock, setStock, reserveStock, getTrackingStatus } = require('./redis');
const { enqueueCheckout } = require('./queue');

const router = express.Router();

const checkoutLimiter = rateLimit({
  windowMs: 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please wait a second.' },
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

router.get('/api/products', async (req, res) => {
  try {
    const list = await getProducts();
    const enriched = await Promise.all(
      list.map(async (p) => {
        const live = await getStock(p.id);
        return {
          id: p.id,
          name: p.name,
          description: p.description,
          price: parseFloat(p.price),
          stock: live !== null ? live : parseInt(p.stock, 10),
          total_initial_stock: parseInt(p.total_initial_stock || p.stock, 10),
          is_active: p.is_active,
          image_url: p.image_url,
        };
      })
    );
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post('/api/checkout', checkoutLimiter, async (req, res) => {
  const { productId, userId } = req.body;
  const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey || null;

  if (!productId) {
    return res.status(400).json({ error: 'productId is required' });
  }

  const effectiveUserId = userId || `user_${Math.random().toString(36).substring(2, 9)}`;

  try {
    const reserved = await reserveStock(productId, effectiveUserId);

    if (reserved === 0) {
      return res.status(409).json({
        status: 'SOLD_OUT',
        message: 'Product is sold out.',
      });
    }

    const trackingId = uuidv4();

    await enqueueCheckout({
      trackingId,
      userId: effectiveUserId,
      productId,
      idempotencyKey,
    });

    return res.status(202).json({
      status: 'QUEUED',
      trackingId,
      trackingUrl: `/api/track/${trackingId}`,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Checkout failed' });
  }
});

router.get('/api/track/:trackingId', async (req, res) => {
  const { trackingId } = req.params;

  try {
    const fastStatus = await getTrackingStatus(trackingId);
    if (fastStatus) {
      return res.json({ trackingId, ...fastStatus });
    }

    const dbOrder = await getOrderByTrackingId(trackingId);
    if (dbOrder) {
      return res.json({
        trackingId,
        status: dbOrder.status,
        orderId: dbOrder.id,
        confirmedAt: dbOrder.confirmed_at,
      });
    }

    return res.status(404).json({ error: 'Order not found' });
  } catch (e) {
    return res.status(500).json({ error: 'Tracking failed' });
  }
});

router.get('/api/products/:id/stock/sse', async (req, res) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let lastStock = null;

  const pushUpdate = async () => {
    try {
      let current = await getStock(id);
      if (current === null) {
        const prod = await getProductById(id);
        current = prod ? parseInt(prod.stock, 10) : 500;
        await setStock(id, current);
      }

      if (current !== lastStock) {
        lastStock = current;
        res.write(`data: ${JSON.stringify({ productId: id, stock: current })}\n\n`);
      }
    } catch (e) {}
  };

  await pushUpdate();
  const interval = setInterval(pushUpdate, 1500);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

router.post('/api/products/:id/reset', async (req, res) => {
  const { id } = req.params;
  const count = parseInt(req.body.stock, 10) || 500;

  await setStock(id, count);
  await resetStock(id, count);

  res.json({ stock: count });
});

module.exports = router;
