const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis = null;
let isConnected = false;

const memoryInventory = new Map();
const memoryTracking = new Map();

try {
  redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) return null;
      return Math.min(times * 200, 1000);
    },
    lazyConnect: true,
  });

  redis.connect().then(() => {
    isConnected = true;
  }).catch(() => {
    isConnected = false;
  });

  redis.on('error', () => {
    isConnected = false;
  });
} catch (e) {
  isConnected = false;
}

const LUA_RESERVE = `
  local current = redis.call('GET', KEYS[1])
  if not current then
    return -1
  end
  local stock = tonumber(current)
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

const setStock = async (productId, count) => {
  const key = `inventory:${productId}`;
  memoryInventory.set(key, count);

  if (isConnected && redis) {
    try {
      await redis.set(key, count);
    } catch (e) {}
  }
};

const getStock = async (productId) => {
  const key = `inventory:${productId}`;
  if (isConnected && redis) {
    try {
      const val = await redis.get(key);
      if (val !== null) return parseInt(val, 10);
    } catch (e) {}
  }
  return memoryInventory.has(key) ? memoryInventory.get(key) : null;
};

const reserveStock = async (productId, userId) => {
  const key = `inventory:${productId}`;

  if (isConnected && redis) {
    try {
      const res = await redis.eval(LUA_RESERVE, 1, key, userId || 'anon');
      return Number(res);
    } catch (e) {}
  }

  if (!memoryInventory.has(key)) return -1;
  const current = memoryInventory.get(key);
  if (current > 0) {
    memoryInventory.set(key, current - 1);
    return 1;
  }
  return 0;
};

const releaseStock = async (productId, userId) => {
  const key = `inventory:${productId}`;
  if (isConnected && redis) {
    try {
      await redis.incr(key);
      if (userId) await redis.srem(`reserved:${key}`, userId);
      return;
    } catch (e) {}
  }

  if (memoryInventory.has(key)) {
    memoryInventory.set(key, memoryInventory.get(key) + 1);
  }
};

const setTrackingStatus = async (trackingId, status, details = {}) => {
  memoryTracking.set(trackingId, { status, ...details, updatedAt: new Date() });

  if (isConnected && redis) {
    try {
      await redis.set(`track:${trackingId}`, JSON.stringify({ status, ...details }), 'EX', 3600);
    } catch (e) {}
  }
};

const getTrackingStatus = async (trackingId) => {
  if (isConnected && redis) {
    try {
      const cached = await redis.get(`track:${trackingId}`);
      if (cached) return JSON.parse(cached);
    } catch (e) {}
  }
  return memoryTracking.get(trackingId) || null;
};

module.exports = {
  redis,
  isRedisConnected: () => isConnected,
  setStock,
  getStock,
  reserveStock,
  releaseStock,
  setTrackingStatus,
  getTrackingStatus,
};
