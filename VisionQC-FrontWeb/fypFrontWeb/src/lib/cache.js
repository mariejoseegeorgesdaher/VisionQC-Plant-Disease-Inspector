const cacheStore = new Map();

export async function getCachedOrLoad(key, load, ttlMs = 30000) {
  const now = Date.now();
  const cached = cacheStore.get(key);

  if (cached?.value !== undefined && now - cached.timestamp < ttlMs) {
    return cached.value;
  }

  if (cached?.promise) {
    return cached.promise;
  }

  const promise = Promise.resolve()
    .then(load)
    .then((value) => {
      cacheStore.set(key, {
        value,
        timestamp: Date.now(),
      });
      return value;
    })
    .catch((error) => {
      cacheStore.delete(key);
      throw error;
    });

  cacheStore.set(key, {
    promise,
    timestamp: now,
  });

  return promise;
}

export function invalidateCache(key) {
  cacheStore.delete(key);
}

export function invalidateCachePrefix(prefix) {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}
