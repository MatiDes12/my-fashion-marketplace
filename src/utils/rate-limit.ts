import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Upstash Redis-based distributed rate limiting
// Works across all serverless instances with shared state
// Falls back to a permissive no-op if Redis is not configured

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// Pre-built rate limiters for common use cases
const limiters = new Map<string, Ratelimit>();

function getOrCreateLimiter(prefix: string, requests: number, windowMs: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;

  const key = `${prefix}:${requests}:${windowMs}`;
  if (limiters.has(key)) return limiters.get(key)!;

  const window = `${Math.round(windowMs / 1000)} s` as `${number} s`;
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `rl:${prefix}`,
    analytics: false,
  });
  limiters.set(key, limiter);
  return limiter;
}

interface RateLimitOptions {
  uniqueTokenPerInterval?: number;
  interval?: number;
}

interface RateLimitResult {
  isRateLimited: boolean;
  currentUsage: number;
  remainingRequests: number;
}

/**
 * Distributed rate limiter using Upstash Redis.
 * Falls back to permissive (allows all) if UPSTASH_REDIS_REST_URL is not set.
 *
 * Usage (drop-in replacement for old LRU-based limiter):
 *   const limiter = rateLimit({ interval: 10_000 });
 *   await limiter.check(request, 5, 'some-token');
 */
export function rateLimit(options?: RateLimitOptions) {
  const intervalMs = options?.interval || 60_000;

  return {
    check: async (
      _request: Request,
      limit: number,
      token: string = 'anonymous'
    ): Promise<RateLimitResult> => {
      const limiter = getOrCreateLimiter('api', limit, intervalMs);

      // If Redis not configured, allow request (graceful degradation)
      if (!limiter) {
        return { isRateLimited: false, currentUsage: 0, remainingRequests: limit };
      }

      const { success, remaining } = await limiter.limit(token);

      if (!success) {
        throw new Error('Rate limit exceeded');
      }

      return {
        isRateLimited: false,
        currentUsage: limit - remaining,
        remainingRequests: remaining,
      };
    },
  };
}

/**
 * Quick rate limit check for payment/sensitive endpoints.
 * Returns true if allowed, false if rate limited.
 */
export async function checkPaymentRateLimit(userId: string): Promise<boolean> {
  const limiter = getOrCreateLimiter('payment', 10, 60_000);
  if (!limiter) return true;
  const { success } = await limiter.limit(userId);
  return success;
}

/**
 * Quick rate limit check for auth endpoints (login, register).
 * Stricter: 5 attempts per minute per IP.
 */
export async function checkAuthRateLimit(ip: string): Promise<boolean> {
  const limiter = getOrCreateLimiter('auth', 5, 60_000);
  if (!limiter) return true;
  const { success } = await limiter.limit(ip);
  return success;
}
