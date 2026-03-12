/**
 * Simple in-memory rate limiter.
 * Acceptable for single-instance deployment (Docker on Linode).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Check and consume a rate limit token.
 * Returns { allowed: true } if under limit, or { allowed: false, retryAfter } if exceeded.
 */
export function checkRateLimit(
  identifier: string,
  action: string,
  maxAttempts: number,
  windowSeconds: number
): { allowed: boolean; retryAfter?: number } {
  const key = `${action}:${identifier}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true };
  }

  if (entry.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { allowed: true };
}
