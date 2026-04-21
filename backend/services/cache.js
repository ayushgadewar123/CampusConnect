const store = new Map();

const setCache = (key, value, ttlMs = 5 * 60 * 1000) => {
  store.set(String(key), {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
};

const getCache = (key) => {
  const entry = store.get(String(key));
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(String(key));
    return null;
  }
  return entry.value;
};

const clearCache = (prefix = '') => {
  if (!prefix) {
    store.clear();
    return;
  }
  const needle = String(prefix);
  for (const key of store.keys()) {
    if (key.startsWith(needle)) store.delete(key);
  }
};

const getCacheStats = () => {
  const now = Date.now();
  const keys = Array.from(store.keys());
  const prefixes = {};
  let expired = 0;

  for (const key of keys) {
    const entry = store.get(key);
    if (!entry) continue;
    if (entry.expiresAt < now) expired += 1;
    const prefix = key.includes(':') ? key.split(':', 1)[0] : 'global';
    prefixes[prefix] = (prefixes[prefix] || 0) + 1;
  }

  return { size: store.size, expired, keys: keys.slice(0, 50), prefixes };
};

module.exports = { setCache, getCache, clearCache, getCacheStats };
