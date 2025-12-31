import Redis from "ioredis";

type GlobalWithRedis = typeof globalThis & {
  _redis: { pub?: Redis; sub?: Redis; pubDisabled?: boolean; subDisabled?: boolean; warned?: boolean };
};

const g = global as GlobalWithRedis;
g._redis ||= {};

/**
 * Check if Redis should be disabled in development
 */
function shouldDisableRedisInDev(url: string | undefined): boolean {
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  
  // In development, disable Redis if:
  // 1. REDIS_URL is not set, OR
  // 2. REDIS_URL points to localhost:6379 (common default that's often not running)
  if (!url) {
    return true;
  }
  
  // Check if URL points to localhost:6379
  const isLocalhost = url.includes("127.0.0.1:6379") || 
                      url.includes("localhost:6379") ||
                      url === "redis://localhost:6379" ||
                      url === "redis://127.0.0.1:6379";
  
  return isLocalhost;
}

/**
 * Safe Redis client getter for publisher (rate limiting, caching)
 * Returns null if Redis is unavailable or disabled
 */
export function getRedisPublisher(): Redis | null {
  // If Redis is already marked as disabled, return null immediately
  if (g._redis.pubDisabled) {
    return null;
  }

  // Check if REDIS_URL is set
  const url = process.env.REDIS_URL;
  
  // In development, disable Redis if pointing to localhost (often not running)
  if (shouldDisableRedisInDev(url)) {
    if (!g._redis.warned) {
      console.warn("[Redis] Development mode: Redis disabled (localhost not required). Rate limiting will be skipped.");
      g._redis.warned = true;
    }
    g._redis.pubDisabled = true;
    return null;
  }
  
  if (!url) {
    // Log warning only once
    if (!g._redis.warned) {
      console.warn("[Redis] REDIS_URL not set, Redis disabled. Rate limiting will be skipped.");
      g._redis.warned = true;
    }
    g._redis.pubDisabled = true;
    return null;
  }

  // Create client if it doesn't exist
  if (!g._redis.pub) {
    try {
      // Use lazyConnect to prevent immediate connection attempts
      g._redis.pub = new Redis(url, {
        lazyConnect: true,
        retryStrategy: () => null, // Disable automatic retries
        maxRetriesPerRequest: 0, // Don't retry failed requests
        enableOfflineQueue: false, // Don't queue commands when disconnected
      });

      // Handle connection errors - mark as disabled but don't throw
      g._redis.pub.on("error", (err: Error) => {
        // Only log if not already disabled (avoid spam)
        if (!g._redis.pubDisabled) {
          console.error("[Redis] Connection error, disabling Redis:", err.message);
          g._redis.pubDisabled = true;
        }
        // Don't rethrow - just mark as disabled
      });

      // Handle successful connection
      g._redis.pub.on("connect", () => {
        if (g._redis.pubDisabled) {
          console.log("[Redis] Reconnected, re-enabling Redis");
          g._redis.pubDisabled = false;
        }
      });
    } catch (error) {
      // If client creation fails, mark as disabled
      console.error("[Redis] Failed to create client:", error instanceof Error ? error.message : "Unknown error");
      g._redis.pubDisabled = true;
      return null;
    }
  }

  // Return null if disabled, otherwise return client
  return g._redis.pubDisabled ? null : g._redis.pub;
}

/**
 * Safe Redis client getter for subscriber (pub/sub for orchestration)
 * Returns null if Redis is unavailable or disabled
 */
export function getRedisSubscriber(): Redis | null {
  // If Redis is already marked as disabled, return null immediately
  if (g._redis.subDisabled) {
    return null;
  }

  // Check if REDIS_URL is set
  const url = process.env.REDIS_URL;
  
  // In development, disable Redis if pointing to localhost (often not running)
  if (shouldDisableRedisInDev(url)) {
    g._redis.subDisabled = true;
    return null;
  }
  
  if (!url) {
    g._redis.subDisabled = true;
    return null;
  }

  // Create client if it doesn't exist
  if (!g._redis.sub) {
    try {
      // Use lazyConnect to prevent immediate connection attempts
      g._redis.sub = new Redis(url, {
        lazyConnect: true,
        retryStrategy: () => null, // Disable automatic retries
        maxRetriesPerRequest: 0, // Don't retry failed requests
        enableOfflineQueue: false, // Don't queue commands when disconnected
      });

      // Handle connection errors - mark as disabled but don't throw
      g._redis.sub.on("error", (err: Error) => {
        // Only log if not already disabled (avoid spam)
        if (!g._redis.subDisabled) {
          console.error("[Redis] Subscriber connection error, disabling Redis:", err.message);
          g._redis.subDisabled = true;
        }
        // Don't rethrow - just mark as disabled
      });

      // Handle successful connection
      g._redis.sub.on("connect", () => {
        if (g._redis.subDisabled) {
          console.log("[Redis] Subscriber reconnected, re-enabling Redis");
          g._redis.subDisabled = false;
        }
      });
    } catch (error) {
      // If client creation fails, mark as disabled
      console.error("[Redis] Failed to create subscriber client:", error instanceof Error ? error.message : "Unknown error");
      g._redis.subDisabled = true;
      return null;
    }
  }

  // Return null if disabled, otherwise return client
  return g._redis.subDisabled ? null : g._redis.sub;
}


