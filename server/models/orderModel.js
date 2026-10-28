const { pool, isPostgresConnected } = require('../config/db');

// In-memory fallback if PostgreSQL is offline
const mockOrders = new Map();

const OrderModel = {
  async findByTrackingId(trackingId) {
    if (isPostgresConnected() && pool) {
      try {
        const res = await pool.query(
          'SELECT id, tracking_id, user_id, product_id, status, confirmed_at, failure_reason FROM orders WHERE tracking_id = $1',
          [trackingId]
        );
        if (res.rows.length > 0) return res.rows[0];
      } catch (err) {
        // fallback
      }
    }
    return mockOrders.get(trackingId) || null;
  },

  async findByIdempotencyKey(key) {
    if (isPostgresConnected() && pool) {
      try {
        const res = await pool.query(
          'SELECT id, tracking_id, status FROM orders WHERE idempotency_key = $1',
          [key]
        );
        if (res.rows.length > 0) return res.rows[0];
      } catch (err) {
        // fallback
      }
    }
    return mockOrders.get(key) || null;
  },

  async create(order) {
    if (isPostgresConnected() && pool) {
      try {
        const res = await pool.query(
          `INSERT INTO orders (tracking_id, user_id, product_id, status, idempotency_key, confirmed_at, failure_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, tracking_id, status`,
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
      } catch (err) {
        console.warn(`[OrderModel] Create order error: ${err.message}`);
      }
    }

    const mockOrder = {
      id: `ord_${Math.random().toString(36).substring(2, 9)}`,
      tracking_id: order.trackingId,
      status: order.status,
      confirmed_at: order.confirmedAt,
    };
    mockOrders.set(order.trackingId, mockOrder);
    if (order.idempotencyKey) mockOrders.set(order.idempotencyKey, mockOrder);
    return mockOrder;
  },
};

module.exports = OrderModel;
