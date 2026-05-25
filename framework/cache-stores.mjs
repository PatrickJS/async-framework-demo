const now = () => Date.now();

const normalizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => typeof tag === 'string' && tag.length > 0);
};

export const createMapCacheStore = ({ name, kind }) => {
  const entries = new Map();

  const store = {
    name,
    kind,

    async get(key) {
      const entry = entries.get(key);

      if (!entry) return null;

      if (entry.expiresAt && entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }

      return {
        value: entry.value,
        metadata: entry.metadata,
      };
    },

    async set(key, value, options = {}) {
      const tags = normalizeTags(options.tags);
      const ttlMs = Number(options.ttlMs);
      const expiresAt = Number.isFinite(ttlMs) && ttlMs > 0 ? now() + ttlMs : null;

      entries.set(key, {
        value,
        expiresAt,
        tags,
        metadata: {
          namespace: options.namespace ?? 'default',
          scope: options.scope ?? 'private',
          tags: tags.join(','),
          store: name,
        },
      });
    },

    async delete(key) {
      entries.delete(key);
    },

    async invalidateTag(tag) {
      for (const [key, entry] of entries) {
        if (entry.tags.includes(tag)) {
          entries.delete(key);
        }
      }
    },

    clear() {
      entries.clear();
    },

    stats() {
      return {
        kind,
        entries: entries.size,
      };
    },
  };

  return store;
};

export const createMemoryStore = (name = 'memory') => {
  return createMapCacheStore({ name, kind: 'memory' });
};

export const createRedisLikeStore = (name = 'redis') => {
  return createMapCacheStore({ name, kind: 'redis-like' });
};
