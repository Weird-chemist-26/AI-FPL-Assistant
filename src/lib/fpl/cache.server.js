// Very small in-memory cache. Key -> { value, expiresAt }.
// Used so we don't hammer the official FPL API for data that barely changes.
const store = new Map();

/**
 * Returns the cached value for `key`, or calls `loader()` and caches the result.
 * @param {string} key
 * @param {number} ttlSeconds how long the value stays fresh
 * @param {() => Promise<any>} loader
 */
export async function cached(key, ttlSeconds, loader) {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.value;

  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
  return value;
}

export function clearCache() {
  store.clear();
}
