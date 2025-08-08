import { LRUCache } from 'lru-cache';

interface RateLimitOptions {
  uniqueTokenPerInterval?: number;
  interval?: number;
}

export function rateLimit(options?: RateLimitOptions) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000,
  });

  return {
    check: (request: Request, limit: number, token: string = request.headers.get('x-forwarded-for') || 'anonymous') => {
      // Initialize counter for this token if needed
      let tokenCount = (tokenCache.get(token) as number[]) || [0];
      if (tokenCount[0] === 0) {
        tokenCache.set(token, tokenCount);
      }

      // Check before increment to allow exactly `limit` requests per interval
      const willBeUsage = tokenCount[0] + 1;
      const isRateLimited = willBeUsage > limit;

      return new Promise((resolve, reject) => {
        if (isRateLimited) {
          reject(new Error('Rate limit exceeded'));
          return;
        }

        // Safe to increment and resolve
        tokenCount[0] = willBeUsage;
        resolve({
          isRateLimited: false,
          currentUsage: tokenCount[0],
          remainingRequests: Math.max(0, limit - tokenCount[0]),
        });
      });
    },
  };
} 