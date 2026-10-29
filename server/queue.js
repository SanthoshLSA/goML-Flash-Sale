const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

const { Queue, Worker } = require('bullmq');
const { pool, isPostgresConnected, getOrderByIdempotencyKey, saveOrder } = require('./db');
const { isRedisConnected, releaseStock, setTrackingStatus } = require('./redis');

const QUEUE_NAME = 'checkout-queue';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const getConnectionOptions = () => {
  const url = new URL(REDIS_URL.startsWith('redis') ? REDIS_URL : `redis://${REDIS_URL}`);
  return {
    host: url.hostname || 'localhost',
    port: parseInt(url.port, 10) || 6379,
    password: url.password || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
};

let checkoutQueue = null;
const memoryQueue = [];
let memoryWorkerActive = false;
let memoryStock = 500;

try {
  checkoutQueue = new Queue(QUEUE_NAME, { connection: getConnectionOptions() });
} catch (e) {}

const processCheckout = async (data) => {
  const { trackingId, userId, productId, idempotencyKey } = data;

  if (idempotencyKey) {
    const existing = await getOrderByIdempotencyKey(idempotencyKey);
    if (existing) {
      await setTrackingStatus(trackingId, existing.status, { orderId: existing.id });
      return;
    }
  }

  if (isPostgresConnected() && pool) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateRes = await client.query(
        'UPDATE products SET stock = stock - 1 WHERE id = $1 AND stock > 0 RETURNING stock',
        [productId]
      );

      if (updateRes.rowCount > 0) {
        const remainingStock = updateRes.rows[0].stock;
        const orderRes = await client.query(
          'INSERT INTO orders (tracking_id, user_id, product_id, status, idempotency_key, confirmed_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
          [trackingId, userId, productId, 'CONFIRMED', idempotencyKey || null]
        );
        await client.query('COMMIT');

        await setTrackingStatus(trackingId, 'CONFIRMED', {
          orderId: orderRes.rows[0].id,
          remainingStock,
        });
        return;
      } else {
        await client.query('ROLLBACK');
        await saveOrder({
          trackingId,
          userId,
          productId,
          status: 'SOLD_OUT',
          idempotencyKey,
        });
        await setTrackingStatus(trackingId, 'SOLD_OUT');
        await releaseStock(productId, userId);
        return;
      }
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  if (memoryStock > 0) {
    memoryStock -= 1;
    const order = await saveOrder({
      trackingId,
      userId,
      productId,
      status: 'CONFIRMED',
      idempotencyKey,
      confirmedAt: new Date(),
    });
    await setTrackingStatus(trackingId, 'CONFIRMED', {
      orderId: order.id,
      remainingStock: memoryStock,
    });
  } else {
    await saveOrder({
      trackingId,
      userId,
      productId,
      status: 'SOLD_OUT',
      idempotencyKey,
    });
    await setTrackingStatus(trackingId, 'SOLD_OUT');
    await releaseStock(productId, userId);
  }
};

const startMemoryWorker = () => {
  if (memoryWorkerActive) return;
  memoryWorkerActive = true;

  const run = async () => {
    while (true) {
      if (memoryQueue.length > 0) {
        const item = memoryQueue.shift();
        try {
          await processCheckout(item);
        } catch (e) {}
      } else {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  };
  run();
};

const enqueueCheckout = async (data) => {
  await setTrackingStatus(data.trackingId, 'QUEUED');

  if (checkoutQueue && isRedisConnected()) {
    try {
      await checkoutQueue.add('order', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
      });
      return;
    } catch (e) {}
  }

  memoryQueue.push(data);
};

const startWorker = () => {
  startMemoryWorker();

  try {
    const worker = new Worker(QUEUE_NAME, async (job) => processCheckout(job.data), {
      connection: getConnectionOptions(),
      concurrency: 5,
    });

    return worker;
  } catch (e) {
    return null;
  }
};

module.exports = {
  enqueueCheckout,
  startWorker,
};
