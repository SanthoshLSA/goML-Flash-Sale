const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient = null;
let isConnected = false;

// In-memory fallback if Redis is not running locally during development
const mockInventory = new Map();
const mockReserved = new Map();

try {
  redisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        // Stop retrying aggressively so local dev without Redis doesn't spam logs
        return null;
      }
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
  });

  redisClient.connect().then(() => {
    isConnected = true;
    console.log('[Redis] Connected successfully to Redis.');
  }).catch((err) => {
    isConnected = false;
    console.warn(`[Redis] Connection failed (${err.message}). Using resilient in-memory fallback for development.`);
  });

  redisClient.on('error', (err) => {
    isConnected = false;
  });
} catch (e) {
  isConnected = false;
  console.warn(`[Redis] Initialization note: ${e.message}`);
}

// Lua Script for Atomic Inventory Check & Decrement
const LUA_RESERVE_SCRIPT = `
  local currentStock = redis.call('GET', KEYS[1])
  if not currentStock then
    return -1
  end

  local stock = tonumber(currentStock)
  if stock > 0 then
    redis.call('DECR', KEYS[1])
    if ARGV[1] then
      redis.call('SADD', 'reserved:' .. KEYS[1], ARGV[1])
    end
    return 1
  else
    return 0
  end
`;

/**
 * Initialize stock token in Redis
 */
const initializeInventory = async (productId, stockCount) => {
  const key = `inventory:${productId}`;
  mockInventory.set(key, stockCount);

  if (isConnected && redisClient) {
    try {
      await redisClient.set(key, stockCount);
      console.log(`[Redis] Initialized ${key} = ${stockCount}`);
    } catch (err) {
      console.warn(`[Redis] Failed to initialize key ${key}: ${err.message}`);
    }
  }
};

/**
 * Atomically reserve 1 unit of stock
 * Returns:
 * 1: Successfully reserved
 * 0: Sold out
 * -1: Key not found / not initialized
 */
const reserveItem = async (productId, userId) => {
  const key = `inventory:${productId}`;

  if (isConnected && redisClient) {
    try {
      const res = await redisClient.eval(
        LUA_RESERVE_SCRIPT,
        1,
        key,
        userId || 'anonymous'
      );
      return Number(res);
    } catch (err) {
      console.warn(`[Redis] Lua script execution failed, falling back: ${err.message}`);
    }
  }

  // Resilient In-Memory atomic decrement (Single-threaded Node.js event-loop safe)
  if (!mockInventory.has(key)) {
    return -1;
  }
  const current = mockInventory.get(key);
  if (current > 0) {
    mockInventory.set(key, current - 1);
    if (!mockReserved.has(key)) mockReserved.set(key, new Set());
    mockReserved.get(key).add(userId);
    return 1;
  } else {
    return 0;
  }
};

/**
 * Increment stock back in case of cancellation or rollback
 */
const releaseItem = async (productId, userId) => {
  const key = `inventory:${productId}`;
  if (isConnected && redisClient) {
    try {
      await redisClient.incr(key);
      if (userId) {
        await redisClient.srem(`reserved:${key}`, userId);
      }
      return;
    } catch (err) {
      console.warn(`[Redis] Release failed: ${err.message}`);
    }
  }

  if (mockInventory.has(key)) {
    mockInventory.set(key, mockInventory.get(key) + 1);
  }
};

/**
 * Read current stock count
 */
const getStock = async (productId) => {
  const key = `inventory:${productId}`;
  if (isConnected && redisClient) {
    try {
      const val = await redisClient.get(key);
      if (val !== null) return parseInt(val, 10);
    } catch (err) {
      // fallback
    }
  }
  return mockInventory.get(key) ?? null;
};

module.exports = {
  redisClient,
  initializeInventory,
  reserveItem,
  releaseItem,
  getStock,
};
