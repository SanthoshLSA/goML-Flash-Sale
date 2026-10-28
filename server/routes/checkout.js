const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { reserveItem } = require('../services/redisInventory');
const { enqueueCheckout } = require('../services/queueService');
const { checkoutLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * POST /api/checkout
 * Core flash-sale checkout entry point.
 * Guarantees zero overselling via atomic Redis gate and offloads writes to queue.
 */
router.post('/', checkoutLimiter, async (req, res) => {
  const { productId, userId } = req.body;
  const idempotencyKey = req.headers['x-idempotency-key'] || req.body.idempotencyKey || null;

  if (!productId) {
    return res.status(400).json({ error: 'productId is required' });
  }

  const effectiveUserId = userId || `user_${Math.random().toString(36).substring(2, 9)}`;

  try {
    // STEP 1: Atomic In-Memory/Redis Reservation (Single-threaded gatekeeper)
    const reserveResult = await reserveItem(productId, effectiveUserId);

    if (reserveResult === 0) {
      // 0 means inventory count reached zero
      return res.status(409).json({
        status: 'SOLD_OUT',
        message: 'Sorry, this limited-edition product has completely sold out!',
      });
    }

    // STEP 2: Enqueue async processing job to decouple heavy database writes
    const trackingId = uuidv4();

    await enqueueCheckout({
      trackingId,
      userId: effectiveUserId,
      productId,
      idempotencyKey,
      enqueuedAt: new Date(),
    });

    // STEP 3: Return 202 Accepted immediately (< 30ms response time)
    return res.status(202).json({
      status: 'QUEUED',
      trackingId,
      trackingUrl: `/api/track/${trackingId}`,
      message: 'Your checkout reservation has been accepted and is processing in the queue.',
    });
  } catch (error) {
    console.error('[API Checkout] Error during checkout handling:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'An unexpected server error occurred during checkout. Please try again.',
    });
  }
});

module.exports = router;
