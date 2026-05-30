import {
  clearAllStores,
  getPolicy,
  getStoreStats,
  resolveCacheRuntimeConfig,
} from './cache-policy.js';

const cacheModes = {
  none: { request: false, resource: false, component: false, page: false },
  request: { request: true, resource: false, component: false, page: false },
  resource: { request: true, resource: true, component: false, page: false },
  component: { request: true, resource: true, component: true, page: false },
  page: { request: true, resource: true, component: true, page: true },
};

export const normalizeCacheMode = (cache) => {
  return cacheModes[cache] ? cache : 'none';
};

export const getCacheFlags = (cache) => {
  return cacheModes[normalizeCacheMode(cache)];
};

export const clearCaches = () => {
  clearAllStores();
};

export const getCacheStats = () => getStoreStats();

const stableJson = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
};

const encodeCacheValue = (value) => JSON.stringify(value);
const decodeCacheValue = (record) => JSON.parse(String(record.value));

const loadSymbol = async (entry) => {
  const module = await entry.load();
  return module[entry.exportName];
};

const makeCacheKey = ({ manifestHash, namespace, symbol, payload }) => {
  return `${namespace}:${manifestHash}:${symbol}:${stableJson(payload)}`;
};

const getStore = (config, policy) => {
  const store = config.stores[policy.store];

  if (!store) {
    throw new Error(`Unknown cache store "${policy.store}"`);
  }

  return store;
};

const readStore = async ({ config, policy, key }) => {
  return getStore(config, policy).get(key);
};

const writeStore = async ({ config, policy, key, value, namespace, metrics }) => {
  await getStore(config, policy).set(key, encodeCacheValue(value), {
    ttlMs: policy.ttlMs,
    staleWhileRevalidateMs: policy.staleWhileRevalidateMs,
    tags: policy.tags,
    namespace,
    scope: policy.scope,
  });
  metrics.storeCacheWrites += 1;
};

export const createRequestRuntime = ({
  app,
  cache,
  delayMs,
  delays,
  asyncState,
  ssrState,
  renderMode,
  storeName,
  segment,
  metrics,
}) => {
  const registry = app.registry;
  const flags = getCacheFlags(cache);
  const config = resolveCacheRuntimeConfig({ app, storeName, ssrState });
  const requestInFlight = new Map();
  const context = {
    delayMs,
    delayForProduct: (productId) => delays?.[productId] ?? delayMs,
    segment,
  };
  let pendingIdCounter = 0;

  const loadVaryResource = async (resourceSymbol) => {
    const registryEntry = registry.resources[resourceSymbol];
    const manifestEntry = config.resources[resourceSymbol] ?? {};
    const entry = {
      ...registryEntry,
      ...manifestEntry,
      vary: manifestEntry.vary ?? registryEntry.vary ?? [],
    };
    const policy = getPolicy(config, entry, 'resources');
    const input = { segment };
    const key = makeCacheKey({
      manifestHash: config.manifestHash,
      namespace: 'vary',
      symbol: resourceSymbol,
      payload: {
        input,
        policy: entry.policy,
      },
    });

    if (flags.resource) {
      const cached = await readStore({ config, policy, key });

      if (cached) {
        metrics.varyCacheHits += 1;
        return decodeCacheValue(cached);
      }
    }

    metrics.varyExecutions += 1;
    const fn = await loadSymbol(registryEntry);
    const value = await fn(input, context);

    if (flags.resource) {
      await writeStore({
        config,
        policy,
        key,
        value,
        namespace: 'vary',
        metrics,
      });
    }

    return value;
  };

  const resolveVary = async (symbols = []) => {
    const entries = {};

    for (const symbol of symbols) {
      entries[symbol] = await loadVaryResource(symbol);
    }

    return entries;
  };

  const loadResourceState = async (resourceSymbol, input, options = {}) => {
    const state = options.asyncState ?? asyncState;
    const registryEntry = registry.resources[resourceSymbol];
    const manifestEntry = config.resources[resourceSymbol] ?? {};
    const entry = {
      ...registryEntry,
      ...manifestEntry,
      vary: manifestEntry.vary ?? registryEntry.vary ?? [],
    };
    const policy = getPolicy(config, entry, 'resources');
    const vary = await resolveVary(entry.vary);
    const key = makeCacheKey({
      manifestHash: config.manifestHash,
      namespace: 'resource',
      symbol: resourceSymbol,
      payload: {
        input,
        policy: entry.policy,
        state,
        vary,
      },
    });

    if (flags.resource) {
      const cached = await readStore({ config, policy, key });

      if (cached) {
        metrics.resourceCacheHits += 1;
        return decodeCacheValue(cached);
      }
    }

    if (state === 'resolved' && options.deferOnMiss) {
      metrics.loadingResources += 1;
      metrics.loadingResourceKeys.add(key);
      const pending = {
        status: 'pending',
        cacheKey: key,
        delayMs: context.delayMs,
        startedAt: Date.now(),
      };
      const fn = await loadSymbol(registryEntry);
      const result = await fn(input, {
        ...context,
        delayMs: 0,
        delayForProduct: () => 0,
      });
      const deferredFinal = {
        status: 'resolved',
        cacheKey: key,
        value: result,
      };

      metrics.deferredTemplateResources += 1;

      if (flags.resource) {
        await writeStore({
          config,
          policy,
          key,
          value: deferredFinal,
          namespace: 'resource',
          metrics,
        });
      }

      return {
        ...pending,
        __deferredFinal: deferredFinal,
      };
    }

    if (state === 'pending' && options.deferOnMiss) {
      metrics.loadingResources += 1;
      metrics.loadingResourceKeys.add(key);
      metrics.pendingStateExecutions += 1;
      const pending = {
        status: 'pending',
        cacheKey: key,
        delayMs: context.delayMs,
        startedAt: Date.now(),
      };
      const fn = await loadSymbol(registryEntry);
      const result = await fn(input, {
        ...context,
        delayMs: 0,
        delayForProduct: () => 0,
      });
      const deferredFinal = {
        status: 'resolved',
        cacheKey: key,
        value: result,
      };

      metrics.deferredTemplateResources += 1;

      if (flags.resource) {
        await writeStore({
          config,
          policy,
          key,
          value: pending,
          namespace: 'resource',
          metrics,
        });
      }

      return {
        ...pending,
        __deferredFinal: deferredFinal,
      };
    }

    if (state === 'pending' && options.streamOnMiss) {
      metrics.loadingResources += 1;
      metrics.loadingResourceKeys.add(key);
      metrics.pendingStateExecutions += 1;
      const pending = {
        status: 'pending',
        cacheKey: key,
        delayMs: context.delayForProduct(input.productId),
        startedAt: Date.now(),
      };

      let finalPromise;

      if (flags.request && requestInFlight.has(key)) {
        metrics.requestDedupeHits += 1;
        finalPromise = requestInFlight.get(key);
      } else {
        finalPromise = (async () => {
          metrics.resourceExecutions += 1;
          const fn = await loadSymbol(registryEntry);
          const result = await fn(input, context);
          const value = {
            status: 'resolved',
            cacheKey: key,
            value: result,
          };

          if (flags.resource) {
            await writeStore({
              config,
              policy,
              key,
              value,
              namespace: 'resource',
              metrics,
            });
          }

          return value;
        })();

        if (flags.request) {
          requestInFlight.set(key, finalPromise);
          finalPromise.finally(() => requestInFlight.delete(key));
        }
      }

      if (flags.resource) {
        await writeStore({
          config,
          policy,
          key,
          value: pending,
          namespace: 'resource',
          metrics,
        });
      }

      return {
        ...pending,
        __streamFinalPromise: finalPromise,
      };
    }

    if (state === 'pending') {
      if (options.markLoadingOnPending) {
        metrics.loadingResources += 1;
        metrics.loadingResourceKeys.add(key);
      }

      metrics.pendingStateExecutions += 1;
      const value = {
        status: 'pending',
        cacheKey: key,
        delayMs: context.delayMs,
        startedAt: Date.now(),
      };

      if (flags.resource) {
        await writeStore({
          config,
          policy,
          key,
          value,
          namespace: 'resource',
          metrics,
        });
      }

      return value;
    }

    if (flags.request && requestInFlight.has(key)) {
      metrics.requestDedupeHits += 1;
      return requestInFlight.get(key);
    }

    const promise = (async () => {
      metrics.resourceExecutions += 1;
      metrics.blockingResources += 1;
      const fn = await loadSymbol(registryEntry);
      const result = await fn(input, context);
      const value = state === 'error'
        ? {
            status: 'rejected',
            cacheKey: key,
            error: {
              message: `Mock safe error for product ${input.productId}`,
            },
          }
        : {
            status: 'resolved',
            cacheKey: key,
            value: result,
          };

      if (flags.resource) {
        await writeStore({
          config,
          policy,
          key,
          value,
          namespace: 'resource',
          metrics,
        });
      }

      return value;
    })();

    if (flags.request) {
      requestInFlight.set(key, promise);
    }

    try {
      return await promise;
    } finally {
      requestInFlight.delete(key);
    }
  };

  const renderComponent = async (componentSymbol, props) => {
    const registryEntry = registry.components[componentSymbol];
    const manifestEntry = config.components[componentSymbol] ?? {};
    const component = {
      ...registryEntry,
      ...manifestEntry,
      asyncEdges: registryEntry.asyncEdges,
      load: registryEntry.load,
      exportName: registryEntry.exportName,
      simple: registryEntry.simple,
      optimized: registryEntry.optimized,
      vary: manifestEntry.vary ?? registryEntry.vary ?? [],
    };
    const policy = getPolicy(config, component, 'components');
    const componentAsyncState = component.ssrState === 'pending' ? 'pending' : asyncState;
    const vary = await resolveVary(component.vary);
    const key = makeCacheKey({
      manifestHash: config.manifestHash,
      namespace: 'component',
      symbol: componentSymbol,
      payload: {
        props,
        policy: component.policy,
        state: componentAsyncState,
        vary,
      },
    });

    if (flags.component && component.optimized && component.simple) {
      const cached = await readStore({ config, policy, key });

      if (cached) {
        metrics.componentCacheHits += 1;
        const html = decodeCacheValue(cached);

        return {
          html,
          finalHtml: html,
          replacements: [],
          cacheHit: true,
        };
      }
    }

    const resources = {};
    const usesPartialTransport = renderMode === 'stream' || renderMode === 'fetch';

    await Promise.all(component.asyncEdges.map(async ({ name, edge }) => {
      const edgeEntry = registry.asyncEdges[edge];
      const edgeFn = await loadSymbol(edgeEntry);

      metrics.asyncEdgeExecutions += 1;
      resources[name] = await edgeFn(props, {
        loadResourceState: (resourceSymbol, input) => {
          return loadResourceState(resourceSymbol, input, {
            asyncState: componentAsyncState,
            deferOnMiss: renderMode === 'defer' && (
              componentAsyncState === 'resolved' || componentAsyncState === 'pending'
            ),
            streamOnMiss: renderMode === 'stream' && componentAsyncState === 'pending',
            markLoadingOnPending: usesPartialTransport,
          });
        },
      });
    }));

    metrics.componentExecutions += 1;
    const render = await loadSymbol(component);
    const deferredEntries = Object.entries(resources)
      .filter(([, resource]) => resource?.__deferredFinal);
    const streamEntries = Object.entries(resources)
      .filter(([, resource]) => resource?.__streamFinalPromise);
    const pendingEntries = Object.entries(resources)
      .filter(([, resource]) => resource?.status === 'pending');
    const pendingId = (deferredEntries.length > 0 || streamEntries.length > 0 || (usesPartialTransport && pendingEntries.length > 0))
      ? `pending-${componentSymbol}-${pendingIdCounter += 1}`
      : null;
    const createResumeContext = (currentResources, boundaryState) => ({
      component: component.symbol,
      template: component.symbol,
      controller: component.asyncEdges.map(({ edge }) => edge).join(', '),
      model: component.asyncEdges
        .map(({ edge }) => registry.asyncEdges[edge]?.resource)
        .filter(Boolean)
        .join(', '),
      props,
      resources: Object.fromEntries(
        Object.entries(currentResources).map(([name, resource]) => [
          name,
          {
            status: resource?.status,
            cacheKey: resource?.cacheKey,
            value: resource?.status === 'resolved' ? resource.value : undefined,
            error: resource?.status === 'rejected' ? resource.error : undefined,
          },
        ]),
      ),
      closures: component.asyncEdges.map(({ name, edge }) => ({
        name: `load ${name}`,
        controller: edge,
        captures: Object.keys(props).map((keyName) => `props.${keyName}`),
      })),
      reads: [
        'signals.product.value.status',
        'signals.product.value.value.title',
        'signals.product.value.value.price',
      ],
      signalGraph: null,
      boundary: pendingId
        ? {
            id: pendingId,
            state: boundaryState,
          }
        : null,
      vary,
      manifestHash: config.manifestHash,
    });
    const initialResumeContext = createResumeContext(resources, pendingEntries.length > 0 ? 'pending' : componentAsyncState);
    const html = render({
      props,
      resources,
      resumeContext: initialResumeContext,
    });
    let finalHtml = html;
    let finalContext = initialResumeContext;
    const replacements = [];

    if (deferredEntries.length > 0) {
      const finalResources = {
        ...resources,
      };

      for (const [name, resource] of deferredEntries) {
        finalResources[name] = resource.__deferredFinal;
      }

      finalHtml = render({
        props,
        resources: finalResources,
        resumeContext: createResumeContext(finalResources, 'resolved'),
      });
      finalContext = createResumeContext(finalResources, 'resolved');
      metrics.deferredTemplateRenders += 1;
      replacements.push({
        id: pendingId,
        html: finalHtml,
        context: finalContext,
        props,
        componentSymbol,
      });
    }

    if (streamEntries.length > 0) {
      const finalPromise = (async () => {
        const finalResources = {
          ...resources,
        };

        for (const [name, resource] of streamEntries) {
          finalResources[name] = await resource.__streamFinalPromise;
        }

        const resolvedContext = createResumeContext(finalResources, 'resolved');
        const resolvedHtml = render({
          props,
          resources: finalResources,
          resumeContext: resolvedContext,
        });

        return {
          id: pendingId,
          html: resolvedHtml,
          context: resolvedContext,
          props,
          componentSymbol,
        };
      })();

      replacements.push({
        id: pendingId,
        context: initialResumeContext,
        props,
        componentSymbol,
        finalPromise,
      });
    }

    if (renderMode === 'fetch' && pendingEntries.length > 0) {
      replacements.push({
        id: pendingId,
        context: initialResumeContext,
        props,
        componentSymbol,
      });
    }

    if (flags.component && component.optimized && component.simple && streamEntries.length === 0) {
      await writeStore({
        config,
        policy,
        key,
      value: finalHtml,
        namespace: 'component',
        metrics,
      });
    }

    return {
      html,
      finalHtml,
      replacements,
      resources,
      context: finalContext,
      props,
      componentSymbol,
      cacheHit: false,
    };
  };

  const getPageCache = async (pageId, payload) => {
    const page = config.pages[pageId];
    const policy = getPolicy(config, page, 'pages');
    const key = makeCacheKey({
      manifestHash: config.manifestHash,
      namespace: 'page',
      symbol: pageId,
      payload,
    });
    const cached = await readStore({ config, policy, key });

    return cached ? decodeCacheValue(cached) : null;
  };

  const setPageCache = async (pageId, payload, value) => {
    const page = config.pages[pageId];
    const policy = getPolicy(config, page, 'pages');
    const key = makeCacheKey({
      manifestHash: config.manifestHash,
      namespace: 'page',
      symbol: pageId,
      payload,
    });

    await writeStore({
      config,
      policy,
      key,
      value,
      namespace: 'page',
      metrics,
    });
  };

  return {
    config,
    flags,
    loadResourceState,
    renderComponent,
    getPageCache,
    setPageCache,
  };
};
