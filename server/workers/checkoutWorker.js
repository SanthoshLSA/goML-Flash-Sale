const { Worker } = require('bullmq');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { releaseItem } = require('../services/redisInventory');
const { QUEUE_NAME, registerMemoryWorker, setOrderStatus } = require('../services/queueService');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Core business logic: Process checkout job with atomic MongoDB conditional write
 */
const processCheckoutJob = async (job) => {
  const { trackingId, userId, productId, idempotencyKey } = job.data;
  console.log(`[Worker] Processing checkout job ${trackingId} for user ${userId}, product ${productId}`);

  try {
    // 1. Idempotency Check: Avoid processing duplicate orders
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey });
      if (existingOrder) {
        console.log(`[Worker] Idempotency match found for key ${idempotencyKey}. Reusing order status.`);
        await setOrderStatus(trackingId, existingOrder.status, {
          orderId: existingOrder._id,
        });
        return;
      }
    }

    // 2. ATOMIC MONGODB CONDITIONAL DECREMENT (Document-level lock equivalent to WHERE stock > 0)
    // Guarantees zero overselling even if Redis layer ever drifted
    let updatedProduct = null;
    try {
      updatedProduct = await Product.findOneAndUpdate(
        { _id: productId, stock: { $gt: 0 } },
        { $inc: { stock: -1 } },
        { new: true }
      );
    } catch (dbErr) {
      console.warn(`[Worker] MongoDB update error: ${dbErr.message}`);
    }

    if (updatedProduct) {
      // Stock successfully decremented in MongoDB!
      const order = await Order.create({
        trackingId,
        userId,
        productId,
        status: 'CONFIRMED',
        idempotencyKey,
        confirmedAt: new Date(),
      });

      console.log(`[Worker] Order CONFIRMED: ${order._id}. Remaining MongoDB stock: ${updatedProduct.stock}`);

      await setOrderStatus(trackingId, 'CONFIRMED', {
        orderId: order._id,
        remainingStock: updatedProduct.stock,
      });
    } else {
      // Stock was 0 in MongoDB (or product not found)
      console.warn(`[Worker] Stock depleted in MongoDB for product ${productId}. Marking order as SOLD_OUT.`);

      await Order.create({
        trackingId,
        userId,
        productId,
        status: 'SOLD_OUT',
        idempotencyKey,
        failureReason: 'Inventory depleted at persistence check',
      }).catch(() => {});

      await setOrderStatus(trackingId, 'SOLD_OUT', {
        reason: 'Item sold out during processing',
      });

      // Synchronize Redis state in case Redis counter had an extra credit
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
  // Always register in-memory handler for seamless local execution
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
      concurrency: 5, // Safe concurrency limit for database pool
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
