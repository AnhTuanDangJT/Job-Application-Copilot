import { NextRequest, NextResponse } from "next/server";
import { getRedisPublisher } from "./redis";

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
}

/**
 * Get client IP address from request headers
 */
function getClientIp(req: NextRequest): string {
  // Try x-forwarded-for first (for proxied requests)
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }
  
  // Try x-real-ip as fallback
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }
  
  // Fallback to unknown
  return "unknown";
}

/**
 * Simple Redis-based rate limiting middleware
 */
export async function rateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<{ success: true } | { success: false; response: NextResponse }> {
  const redis = getRedisPublisher();
  
  // If Redis is not available, allow the request (graceful degradation)
  if (!redis) {
    return { success: true };
  }

  const { windowMs, maxRequests, keyGenerator } = options;
  
  // Generate rate limit key
  const key = keyGenerator
    ? keyGenerator(req)
    : `rate_limit:${getClientIp(req)}:${req.nextUrl.pathname}`;

  try {
    // Get current count (lazyConnect will attempt connection if needed)
    const count = await redis.get(key);
    const currentCount = count ? parseInt(count, 10) : 0;

    if (currentCount >= maxRequests) {
      const ttl = await redis.ttl(key);
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Please try again in ${Math.ceil(ttl / 60)} minutes.`,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil(ttl)),
              "X-RateLimit-Limit": String(maxRequests),
              "X-RateLimit-Remaining": "0",
            },
          }
        ),
      };
    }

    // Increment counter
    const newCount = currentCount + 1;
    if (currentCount === 0) {
      // First request in window, set with expiration
      await redis.setex(key, Math.ceil(windowMs / 1000), String(newCount));
    } else {
      // Increment existing counter
      await redis.incr(key);
    }

    const remaining = maxRequests - newCount;
    const ttl = await redis.ttl(key);

    // Return success (headers can't be set in API routes this way, 
    // but rate limiting still works)
    return { success: true };
  } catch (error) {
    // On any Redis error (connection refused, operation failure, etc.), 
    // allow request (graceful degradation)
    // This ensures the app works even if Redis is completely unavailable
    console.warn("[RateLimit] Redis operation failed, allowing request:", error instanceof Error ? error.message : "Unknown error");
    return { success: true };
  }
}

/**
 * Pre-configured rate limiters for different endpoints
 */
export const rateLimiters = {
  // Auth endpoints - stricter limits
  auth: (req: NextRequest) =>
    rateLimit(req, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 requests per 15 minutes
      keyGenerator: (r) => `rate_limit:auth:${getClientIp(r)}`,
    }),

  // General API endpoints
  api: (req: NextRequest) =>
    rateLimit(req, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 60 requests per minute
      keyGenerator: (r) => `rate_limit:api:${getClientIp(r)}:${r.nextUrl.pathname}`,
    }),

  // Analysis endpoints - moderate limits (can be resource-intensive)
  analysis: (req: NextRequest) =>
    rateLimit(req, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 requests per minute
      keyGenerator: (r) => `rate_limit:analysis:${getClientIp(r)}`,
    }),

  // AI endpoints - per-user rate limiting (more restrictive due to API costs)
  ai: (req: NextRequest, userId?: string) =>
    rateLimit(req, {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 5, // 5 requests per minute per user
      keyGenerator: (r) => 
        userId 
          ? `rate_limit:ai:user:${userId}`
          : `rate_limit:ai:ip:${getClientIp(r)}`,
    }),
};

