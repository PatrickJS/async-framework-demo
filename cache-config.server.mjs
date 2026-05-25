import { createMemoryStore, createRedisLikeStore } from './framework/cache-stores.mjs';

// Simulates server-only user config. The generated manifest supplies safe
// defaults; this file overrides policies, stores, vary rules, and ssrState.
export const userCacheConfig = {
  stores: {
    memory: createMemoryStore('memory'),
    redis: createRedisLikeStore('redis'),
  },

  defaults: {
    resources: {
      store: 'redis',
      scope: 'private',
      ttlMs: 300_000,
    },

    components: {
      store: 'redis',
      scope: 'private',
      ttlMs: 300_000,
    },

    pages: {
      store: 'redis',
      scope: 'private',
      ttlMs: 120_000,
    },
  },

  policies: {
    defaultResource: {
      store: 'redis',
      scope: 'private',
      ttlMs: 300_000,
      tags: ['product-resource'],
    },

    defaultComponent: {
      store: 'redis',
      scope: 'private',
      ttlMs: 300_000,
      tags: ['product-component'],
    },

    defaultPage: {
      store: 'redis',
      scope: 'private',
      ttlMs: 120_000,
      tags: ['product-page'],
    },
  },

  optimize: {
    resources: {
      ProductModel: {
        policy: 'defaultResource',
        vary: ['SegmentModel'],
      },
    },

    components: {
      ProductCardTemplate: {
        policy: 'defaultComponent',
        vary: ['SegmentModel'],
        ssrState: 'auto',
      },
    },
  },
};
