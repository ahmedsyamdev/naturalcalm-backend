import { createClient, RedisClientType } from 'redis';
import { env } from './env';
import logger from './logger';

// Redis client instance
let redisClient: RedisClientType | null = null;

/**
 * Connect to Redis
 */
export const connectRedis = async (): Promise<RedisClientType> => {
  try {
    // Support both REDIS_URL and REDIS_HOST/REDIS_PORT configurations
    let clientConfig: Parameters<typeof createClient>[0];

    if (env.REDIS_URL) {
      // Use full URL if provided
      const redisUrl = env.REDIS_URL;
      const isTLS = redisUrl.startsWith('rediss://');

      clientConfig = {
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Too many Redis reconnection attempts, giving up');
              return new Error('Too many reconnection attempts');
            }
            return Math.min(retries * 100, 3000);
          },
          ...(isTLS && {
            tls: true,
            rejectUnauthorized: false,
          }),
        },
      };
    } else {
      // Use separate host/port/password (simpler for Coolify)
      const host = env.REDIS_HOST || 'localhost';
      const port = env.REDIS_PORT || 6379;

      clientConfig = {
        socket: {
          host,
          port,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Too many Redis reconnection attempts, giving up');
              return new Error('Too many reconnection attempts');
            }
            return Math.min(retries * 100, 3000);
          },
        },
        ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
      };

      logger.info(`Connecting to Redis at ${host}:${port}`);
    }

    // Create Redis client
    redisClient = createClient(clientConfig);

    // Handle connection events
    redisClient.on('connect', () => {
      logger.info('Redis client is connecting...');
    });

    redisClient.on('ready', () => {
      logger.info('✅ Redis client is ready');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', {
        message: err.message,
        code: (err as NodeJS.ErrnoException).code,
        stack: err.stack,
      });
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client is reconnecting...');
    });

    redisClient.on('end', () => {
      logger.warn('Redis client connection closed');
    });

    // Connect to Redis
    await redisClient.connect();

    logger.info('✅ Redis connected successfully');

    return redisClient;
  } catch (error) {
    logger.error('❌ Redis connection failed:', error);
    throw error;
  }
};

/**
 * Disconnect from Redis
 */
export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      await redisClient.quit();
      logger.info('Redis disconnected');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }
};

/**
 * Get Redis client instance
 */
export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

/**
 * Cache helper methods
 */

/**
 * Get value from cache
 */
export const cacheGet = async <T = unknown>(key: string): Promise<T | null> => {
  try {
    const client = getRedisClient();
    const value = await client.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value as string) as T;
  } catch (error) {
    logger.error(`Error getting cache key "${key}":`, error);
    return null;
  }
};

/**
 * Set value in cache with optional expiration (in seconds)
 */
export const cacheSet = async (
  key: string,
  value: unknown,
  expirationSeconds?: number
): Promise<boolean> => {
  try {
    const client = getRedisClient();
    const stringValue = JSON.stringify(value);

    if (expirationSeconds) {
      await client.setEx(key, expirationSeconds, stringValue);
    } else {
      await client.set(key, stringValue);
    }

    return true;
  } catch (error) {
    logger.error(`Error setting cache key "${key}":`, error);
    return false;
  }
};

/**
 * Delete key from cache
 */
export const cacheDel = async (key: string): Promise<boolean> => {
  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (error) {
    logger.error(`Error deleting cache key "${key}":`, error);
    return false;
  }
};

/**
 * Check if key exists in cache
 */
export const cacheExists = async (key: string): Promise<boolean> => {
  try {
    const client = getRedisClient();
    const exists = await client.exists(key);
    return exists === 1;
  } catch (error) {
    logger.error(`Error checking cache key "${key}":`, error);
    return false;
  }
};

/**
 * Set expiration on existing key (in seconds)
 */
export const cacheExpire = async (
  key: string,
  seconds: number
): Promise<boolean> => {
  try {
    const client = getRedisClient();
    await client.expire(key, seconds);
    return true;
  } catch (error) {
    logger.error(`Error setting expiration on cache key "${key}":`, error);
    return false;
  }
};

/**
 * Delete multiple keys matching a pattern
 */
export const cacheDelPattern = async (pattern: string): Promise<number> => {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    await client.del(keys);
    return keys.length;
  } catch (error) {
    logger.error(`Error deleting cache pattern "${pattern}":`, error);
    return 0;
  }
};

/**
 * Get time to live for a key (in seconds)
 */
export const cacheTTL = async (key: string): Promise<number> => {
  try {
    const client = getRedisClient();
    return await client.ttl(key);
  } catch (error) {
    logger.error(`Error getting TTL for cache key "${key}":`, error);
    return -1;
  }
};

/**
 * Flush all cache (use with caution!)
 */
export const cacheFlushAll = async (): Promise<boolean> => {
  try {
    const client = getRedisClient();
    await client.flushAll();
    logger.warn('All cache flushed');
    return true;
  } catch (error) {
    logger.error('Error flushing cache:', error);
    return false;
  }
};

// Export default
export default {
  connectRedis,
  disconnectRedis,
  getRedisClient,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheExists,
  cacheExpire,
  cacheDelPattern,
  cacheTTL,
  cacheFlushAll,
};
