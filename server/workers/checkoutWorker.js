const { Worker } = require('bullmq');
const { pool, isPostgresConnected } = require('../config/db');
const OrderModel = require('../models/orderModel');
const { releaseItem } = require('../services/redisInventory');
const { QUEUE_NAME, registerMemoryWorker, setOrderStatus } = require('../services/queueService');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// In-memory fallback tracking when PostgreSQL is not connected locally
let mockStock = 500;

/**
 * Core business logic: Process checkout job with atomic PostgreSQL conditional transaction
 * Follows Phase C of reference solution:
 * BEGIN;
 * UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0 RETURNING stock;
 * INSERT INTO orders ...;
 * COMMIT;
 */
const processCheckoutJob = async (job) => {
  const { trackingId, userId, productId, idempotencyKey } = job.data;
  console.log(`[Worker] Processing checkout job ${trackingId} for user ${userId}, product ${productId}`);

  try {
    // 1. Idempotency Check: Avoid processing duplicate orders
    if (idempotencyKey) {
      const existingOrder = await OrderModel.findByIdempotencyKey(idempotencyKey);
      if (existingOrder) {
        console.log(`[Worker] Idempotency match found for key ${idempotencyKey}. Reusing order status.`);
        await setOrderStatus(trackingId, existingOrder.status, {
          orderId: existingOrder.id,
        });
        return;
      }
    }

    // 2. ATOMIC POSTGRESQL CONDITIONAL DECREMENT TRANSACTION
    if (isPostgresConnected() && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Conditional SQL update: strictly guarantees stock never goes below zero
        const updateRes = await client.query(
          `UPDATE products
           SET stock = stock - 1
           WHERE id = $1 AND stock > 0
           RETURNING stock`,
          [productId]
        );

        if (updateRes.rowCount > 0) {
          const remainingStock = updateRes.rows[0].stock;

          const orderRes = await client.query(
            `INSERT INTO orders (tracking_id, user_id, product_id, status, idempotency_key, confirmed_at)
             VALUES ($1, $2, $3, 'CONFIRMED', $4, NOW())
             RETURNING id`,
            [trackingId, userId, productId, idempotencyKey || null]
          );

          await client.query('COMMIT');

          const orderId = orderRes.rows[0].id;
          console.log(`[Worker] PostgreSQL Order CONFIRMED: ${orderId}. Remaining stock: ${remainingStock}`);

          await setOrderStatus(trackingId, 'CONFIRMED', {
            orderId,
            remainingStock,
          });
          return;
        } else {
          // Stock was already 0 when this transaction ran
          await client.query('ROLLBACK');
          console.warn(`[Worker] Stock depleted in PostgreSQL for product ${productId}. Marking order as SOLD_OUT.`);

          await OrderModel.create({
            trackingId,
            userId,
            productId,
            status: 'SOLD_OUT',
            idempotencyKey,
            failureReason: 'Stock depleted at PostgreSQL conditional check',
          });

          await setOrderStatus(trackingId, 'SOLD_OUT', {
            reason: 'Item sold out during processing',
          });

          // Sync Redis token count
          await releaseItem(productId, userId);
          return;
        }
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    }

    // Fallback: In-memory atomic decrement (single-threaded Node event-loop safe)
    if (mockStock > 0) {
      mockStock -= 1;
      const order = await OrderModel.create({
        trackingId,
        userId,
        productId,
        status: 'CONFIRMED',
        idempotencyKey,
        confirmedAt: new Date(),
      });

      console.log(`[Worker] Order CONFIRMED: ${order.id}. Remaining stock: ${mockStock}`);
      await setOrderStatus(trackingId, 'CONFIRMED', {
        orderId: order.id,
        remainingStock: mockStock,
      });
    } else {
      await OrderModel.create({
        trackingId,
        userId,
        productId,
        status: 'SOLD_OUT',
        idempotencyKey,
        failureReason: 'Inventory depleted',
      });

      await setOrderStatus(trackingId, 'SOLD_OUT', {
        reason: 'Item sold out during processing',
      });
      await releaseItem(productId, userId);
    }
  } catch (error) {
    console.error(`[Worker] Exception while processing checkout job ${trackingId}:`, error);
    await setOrderStatus(trackingId, 'FAILED', {
      error: error.message,
    });
    throw error;
  }
};

/**
 * Initialize BullMQ Worker and register fallback memory processor
 */
const startCheckoutWorker = () => {
  registerMemoryWorker(processCheckoutJob);

  try {
    const url = new URL(REDIS_URL.startsWith('redis') ? REDIS_URL : `redis://${REDIS_URL}`);
    const connection = {
      host: url.hostname || 'localhost',
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };

    const worker = new Worker(QUEUE_NAME, processCheckoutJob, {
      connection,
      concurrency: 5,
    });

    worker.on('completed', (job) => {
      console.log(`[BullMQ Worker] Completed job ${job.id}`);
    });

    worker.on('failed', (job, err) => {
      console.error(`[BullMQ Worker] Job ${job?.id} failed with error:`, err);
    });

    console.log('[Worker] Checkout worker initialized and listening for jobs.');
    return worker;
  } catch (err) {
    console.warn(`[Worker] BullMQ worker startup warning: ${err.message}. Running in memory queue mode.`);
    return null;
  }
};

module.exports = {
  startCheckoutWorker,
  processCheckoutJob,
};
