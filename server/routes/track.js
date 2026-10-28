const express = require('express');
const { getOrderStatus } = require('../services/queueService');
const OrderModel = require('../models/orderModel');

const router = express.Router();

/**
 * GET /api/track/:trackingId
 * Fast polling endpoint returning current status of order
 */
router.get('/:trackingId', async (req, res) => {
  const { trackingId } = req.params;

  try {
    // 1. Check in-memory / Redis status cache (sub-millisecond latency)
    const cachedStatus = await getOrderStatus(trackingId);
    if (cachedStatus) {
      return res.json({
        trackingId,
        ...cachedStatus,
      });
    }

    // 2. Fallback to PostgreSQL if not present in fast cache
    const dbOrder = await OrderModel.findByTrackingId(trackingId);
    if (dbOrder) {
      return res.json({
        trackingId,
        status: dbOrder.status,
        orderId: dbOrder.id,
        confirmedAt: dbOrder.confirmed_at,
      });
    }

    return res.status(404).json({
      trackingId,
      status: 'NOT_FOUND',
      message: 'Tracking identifier not found or expired.',
    });
  } catch (error) {
    console.error(`[API Track] Error checking status for ${trackingId}:`, error);
    return res.status(500).json({ error: 'Failed to retrieve order status' });
  }
});

module.exports = router;
