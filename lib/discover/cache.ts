/**
 * External API response caching.
 * Uses Upstash Redis when configured, falls back to in-memory Map for dev.
 */

const inMemoryCache = new Map<string, { value: string; expiresAt: number }>();

/**
 * Get a cached value by key.
 * Returns parsed JSON or null if miss / expired.
 */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      const res = await fetch(
        `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          },
        }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { result: string | null };
      if (!data.result) return null;
      return JSON.parse(data.result) as T;
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  const entry = inMemoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    inMemoryCache.delete(key);
    return null;
  }
  return JSON.parse(entry.value) as T;
}

/**
 * Set a cached value with TTL in seconds.
 */
export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const serialized = JSON.stringify(value);

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      await fetch(
        `${process.env.UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(serialized)}/ex/${ttlSeconds}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          },
        }
      );
      return;
    } catch {
      // Fall through to in-memory
    }
  }

  // In-memory fallback
  inMemoryCache.set(key, {
    value: serialized,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}
