import { createClient } from 'redis';

const g = globalThis;

export function getRedisClient() {
  if (!g._redisClient) {
    g._redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    });
    g._redisClient.on('error', (err) => {
      console.warn('Redis client error (falling back gracefully):', err.message);
    });
  }
  return g._redisClient;
}

export async function getRedis() {
  const client = getRedisClient();
  if (!client.isOpen) {
    try {
      await client.connect();
    } catch (err) {
      console.warn('Unable to connect to Redis (falling back to MySQL):', err.message);
      return null;
    }
  }
  return client;
}

export async function getCached(key) {
  try {
    const client = await getRedis();
    if (!client) return null;
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.warn('Redis get error:', err.message);
    return null;
  }
}

export async function setCached(key, value, ttlSeconds = 60) {
  try {
    const client = await getRedis();
    if (!client) return false;
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
    return true;
  } catch (err) {
    console.warn('Redis set error:', err.message);
    return false;
  }
}

export async function invalidatePattern(pattern) {
  try {
    const client = await getRedis();
    if (!client) return;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
      console.log(`Invalidated ${keys.length} Redis cache keys matching "${pattern}"`);
    }
  } catch (err) {
    console.warn('Redis invalidate error:', err.message);
  }
}
