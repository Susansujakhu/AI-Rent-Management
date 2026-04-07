/**
 * Simple in-memory rate limiter.
 * Suitable for a single-process Node.js / Next.js app.
 * Resets on server restart (which is acceptable for a local app).
 */

interface Bucket {
  count:   number;
  resetAt: number;
}

// Persist across Next.js hot-reloads in development
const g = globalThis as typeof globalThis & { _rateLimitMap?: Map<string, Bucket> };
if (!g._rateLimitMap) g._rateLimitMap = new Map();
const buckets = g._rateLimitMap;

/**
 * Check if the given key is within the allowed rate.
 * Returns true (allowed) or false (blocked).
 *
 * @param key        Identifier — typically an IP address.
 * @param maxAttempts Max requests before blocking (default 10).
 * @param windowMs    Window duration in ms (default 15 minutes).
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 10,
  windowMs    = 15 * 60 * 1000,
): boolean {
  const now    = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= maxAttempts) return false;

  bucket.count++;
  return true;
}

/** Clear the rate-limit counter for a key (call on successful auth). */
export function clearRateLimit(key: string) {
  buckets.delete(key);
}
