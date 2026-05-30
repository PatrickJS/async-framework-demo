import { userCacheConfig } from '../app/cache-config.server.js';

const merge = (...parts) => Object.assign({}, ...parts.filter(Boolean));

const mergeEntries = (generated = {}, override = {}) => {
  const result = {};
  const keys = new Set([...Object.keys(generated), ...Object.keys(override)]);

  for (const key of keys) {
    result[key] = merge(generated[key], override[key]);
  }

  return result;
};

const resolveDefaults = ({ manifest, storeName }) => {
  const defaults = {};

  for (const kind of ['resources', 'components', 'pages']) {
    defaults[kind] = merge(
      manifest.defaults[kind],
      userCacheConfig.defaults?.[kind],
      storeName ? { store: storeName } : null,
    );
  }

  return defaults;
};

const resolvePolicies = ({ manifest, defaults, storeName }) => {
  const policies = {};
  const keys = new Set([
    ...Object.keys(manifest.policies),
    ...Object.keys(userCacheConfig.policies ?? {}),
  ]);

  for (const key of keys) {
    const mergedPolicy = merge(
      manifest.policies[key],
      userCacheConfig.policies?.[key],
    );
    const kind = mergedPolicy.kind ?? 'resources';

    policies[key] = merge(
      defaults[kind],
      mergedPolicy,
      storeName ? { store: storeName } : null,
    );
  }

  return policies;
};

export const resolveCacheRuntimeConfig = ({ app, storeName, ssrState } = {}) => {
  const manifest = app.manifest;
  const defaults = resolveDefaults({ manifest, storeName });
  const policies = resolvePolicies({ manifest, defaults, storeName });
  const resources = mergeEntries(
    manifest.resources,
    userCacheConfig.optimize?.resources,
  );
  const components = mergeEntries(
    manifest.components,
    userCacheConfig.optimize?.components,
  );

  if (ssrState && ssrState !== 'auto') {
    for (const component of Object.values(components)) {
      component.ssrState = ssrState;
    }
  }

  return {
    manifestHash: manifest.manifestHash,
    stores: userCacheConfig.stores,
    defaults,
    policies,
    resources,
    components,
    pages: manifest.pages,
  };
};

export const getPolicy = (config, entry, fallbackKind) => {
  return config.policies[entry?.policy] ?? config.defaults[fallbackKind];
};

export const clearAllStores = () => {
  for (const store of Object.values(userCacheConfig.stores)) {
    store.clear?.();
  }
};

export const getStoreStats = () => {
  const stats = {};

  for (const [name, store] of Object.entries(userCacheConfig.stores)) {
    stats[name] = store.stats?.() ?? { kind: 'unknown', entries: 0 };
  }

  return stats;
};
