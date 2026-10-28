const { Queue } = require('bullmq');
const { redisClient } = require('./redisInventory');

const QUEUE_NAME = 'checkout-queue';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let checkoutQueue = null;
const memoryQueue = [];
let isWorkerRunning = false;
let memoryWorkerHandler = null;

// Tracking status cache (Redis or in-memory)
const statusCache = new Map();

try {
  // Parse Redis URL for BullMQ connection options
  const url = new URL(REDIS_URL.startsWith('redis') ? REDIS_URL : `redis://${REDIS_URL}`);
  const connection = {
    host: url.hostname || 'localhost',
    port: parseInt(url.port, 10) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };

  checkoutQueue = new Queue(QUEUE_NAME, { connection });
} catch (err) {
  console.warn(`[BullMQ] Redis Queue initialization note: ${err.message}. Using in-memory job queue.`);
}

/**
 * Register a memory queue consumer (for development without Redis)
 */
const registerMemoryWorker = (handler) => {
  memoryWorkerHandler = handler;
  if (!isWorkerRunning) {
    isWorkerRunning = true;
    startMemoryQueueProcessor();
  }
};

const startMemoryQueueProcessor = async () => {
  while (true) {
    if (memoryQueue.length > 0 && memoryWorkerHandler) {
      const job = memoryQueue.shift();
      try {
        await memoryWorkerHandler(job);
      } catch (err) {
        console.error('[MemoryWorker] Job failed:', err);
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
};

/**
 * Enqueue a checkout task
 */
const enqueueCheckout = async (payload) => {
  const { trackingId } = payload;
  setOrderStatus(trackingId, 'QUEUED');

  if (checkoutQueue) {
    try {
      await checkoutQueue.add('process-checkout', payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
      });
      return;
    } catch (err) {
      console.warn(`[BullMQ] Enqueue failed via Redis: ${err.message}, falling back to memory queue.`);
    }
  }

  // Fallback to in-memory queue
  memoryQueue.push({ data: payload });
};

/**
 * Update tracking status (fast in-memory + Redis)
 */
const setOrderStatus = async (trackingId, status, details = {}) => {
  statusCache.set(trackingId, { status, ...details, updatedAt: new Date() });

  if (redisClient) {
    try {
      await redisClient.set(
        `track:${trackingId}`,
        JSON.stringify({ status, ...details }),
        'EX',
        3600 // Expire in 1 hour
      );
    } catch (err) {
      // Ignore cache write error
    }
  }
};

/**
 * Get tracking status for polling
 */
const getOrderStatus = async (trackingId) => {
  if (redisClient) {
    try {
      const cached = await redisClient.get(`track:${trackingId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      // Fallback
    }
  }

  return statusCache.get(trackingId) || null;
};

module.exports = {
  QUEUE_NAME,
  enqueueCheckout,
  registerMemoryWorker,
  setOrderStatus,
  getOrderStatus,
};
