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
      const tokenCount = (tokenCache.get(token) as number[]) || [0];
      if (tokenCount[0] === 0) {
        tokenCache.set(token, tokenCount);
      }
      tokenCount[0] += 1;

      const currentUsage = tokenCount[0];
      const isRateLimited = currentUsage >= limit;

      return new Promise((resolve, reject) => {
        if (isRateLimited) {
          reject(new Error('Rate limit exceeded'));
        } else {
          resolve({
            isRateLimited: false,
            currentUsage,
            remainingRequests: Math.max(0, limit - currentUsage),
          });
        }
      });
    },
  };
} 