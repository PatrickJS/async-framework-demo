import { performance } from 'node:perf_hooks';
import { lintRegistry } from '../registry.mjs';
import { createRequestRuntime } from './cache-runtime.mjs';
import {
  clientFetchPartialsHtml,
  clientSwapHtml,
  escapeHtml,
} from './html.mjs';

const loadSymbol = async (entry) => {
  const module = await entry.load();
  return module[entry.exportName];
};

const createMetrics = () => ({
  varyExecutions: 0,
  varyCacheHits: 0,
  resourceExecutions: 0,
  resourceCacheHits: 0,
  pendingStateExecutions: 0,
  requestDedupeHits: 0,
  asyncEdgeExecutions: 0,
  componentExecutions: 0,
  componentCacheHits: 0,
  pageCacheHits: 0,
  storeCacheWrites: 0,
  loadingResources: 0,
  uniqueLoadingResources: 0,
  loadingResourceKeys: new Set(),
  deferredTemplateResources: 0,
  deferredTemplateRenders: 0,
  blockingResources: 0,
});

export const finalizeMetrics = (metrics) => {
  metrics.uniqueLoadingResources = metrics.loadingResourceKeys?.size ?? metrics.uniqueLoadingResources;
  delete metrics.loadingResourceKeys;
};

const contextHtml = (contexts) => {
  if (contexts.length === 0) return '';

  return [
    '<details class="context-panel">',
    '<summary>Serialized render context: signals, closures, resources</summary>',
    `<pre>${escapeHtml(JSON.stringify(contexts.slice(0, 3), null, 2))}</pre>`,
    '</details>',
  ].join('');
};

const partialUrlFor = ({ app, cache, delayMs, storeName, segment }, partial) => {
  const baseParams = {
    app: app.slug,
    id: partial.id,
    productId: partial.props.productId,
    cache,
    store: storeName,
    segment,
  };
  const edgeParams = new URLSearchParams({
    ...baseParams,
    delay: '100',
  });
  const originParams = new URLSearchParams({
    ...baseParams,
    delay: String(delayMs),
    format: 'template-data',
  });

  return {
    edge: `/_async/partial/edge-segment?${edgeParams.toString()}`,
    origin: `/_async/partial/ProductCard?${originParams.toString()}`,
  };
};

const partialPayload = ({ app, partial, result, segment }) => {
  const resourceName = app.page.resourceName;
  const productState = result.resources?.[resourceName];
  const product = productState?.value ?? null;

  return {
    id: partial.id,
    type: 'component-partial',
    html: result.html,
    context: result.context,
    component: result.componentSymbol,
    resource: 'ProductModel',
    routing: {
      location: 'origin-private',
      cache: 'private no-store',
      reason: 'user-only data must not be shared through CDN cache',
    },
    template: {
      kind: 'component-render-symbol',
      symbol: result.componentSymbol,
      module: `./apps/${app.slug}/generated/component_template.js`,
    },
    data: {
      props: result.props,
      segment,
      state: productState?.status ?? 'resolved',
      userOnly: {
        message: `private offer for user-${partial.props.productId}`,
      },
      server: {
        product,
      },
    },
  };
};

const timingHtml = ({
  app,
  cache,
  delayMs,
  delays,
  asyncState,
  ssrState,
  renderMode,
  storeName,
  segment,
  ids,
  manifestHash,
  metrics,
  durationMs,
  warnings,
  pageCacheHit,
}) => {
  const rows = [
    ['app', app.slug],
    ['cache level', cache],
    ['store adapter', storeName],
    ['async state', asyncState],
    ['component ssrState', ssrState],
    ['render mode', renderMode],
    ['segment vary key', segment],
    ['cache manifest', manifestHash],
    ['mock server resource delay', `${delayMs}ms`],
    ['per-product delays', Object.keys(delays).length > 0 ? JSON.stringify(delays) : 'none'],
    ['ids', ids.join(', ')],
    ['SSR render time', `${durationMs.toFixed(1)}ms`],
    ['client swap delay', metrics.loadingResources > 0 ? `${delayMs}ms` : '0ms'],
    ['page cache hit', String(pageCacheHit)],
    ['resources loading', metrics.loadingResources],
    ['unique resources loading', metrics.uniqueLoadingResources],
    ['blocking server resources', metrics.blockingResources],
    ['vary server resource executions', metrics.varyExecutions],
    ['vary cache hits', metrics.varyCacheHits],
    ['server resource executions', metrics.resourceExecutions],
    ['server resource cache hits', metrics.resourceCacheHits],
    ['pending state renders', metrics.pendingStateExecutions],
    ['request dedupe hits', metrics.requestDedupeHits],
    ['async edge executions', metrics.asyncEdgeExecutions],
    ['component render executions', metrics.componentExecutions],
    ['component HTML cache hits', metrics.componentCacheHits],
    ['store writes', metrics.storeCacheWrites],
  ];

  return [
    '<section class="metrics">',
    ...rows.map(([label, value]) => `<div class="metric"><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value)}</div>`),
    '</section>',
    warnings.length > 0 ? `<pre>${escapeHtml(warnings.join('\n'))}</pre>` : '',
  ].join('');
};

export const renderProductsRoute = async ({
  app,
  ids,
  cache,
  delayMs,
  delays = {},
  asyncState,
  ssrState,
  renderMode,
  storeName,
  segment,
}) => {
  const start = performance.now();
  const lintWarnings = lintRegistry(app);
  const pagePayload = {
    app: app.slug,
    ids,
    asyncState,
    ssrState,
    renderMode,
    segment,
    delays,
  };
  const metrics = createMetrics();
  const runtime = createRequestRuntime({
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
  });

  if (runtime.flags.page) {
    const cached = await runtime.getPageCache(app.page.id, pagePayload);

    if (cached) {
      metrics.pageCacheHits += 1;
      const durationMs = performance.now() - start;
      const timing = timingHtml({
        app,
        cache,
        delayMs,
        delays,
        asyncState,
        ssrState,
        renderMode,
        storeName,
        segment,
        ids,
        manifestHash: runtime.config.manifestHash,
        metrics,
        durationMs,
        warnings: lintWarnings,
        pageCacheHit: true,
      });
      const productList = app.registry.components[app.page.listTemplate];
      const renderList = await loadSymbol(productList);
      const html = renderList({
        app,
        childHtml: cached.childHtml,
        timingHtml: timing,
        clientSwapHtml: '',
        contextHtml: contextHtml(cached.contexts ?? []),
      });
      finalizeMetrics(metrics);

      return {
        html,
        metrics,
        durationMs,
        warnings: lintWarnings,
        pageCacheHit: true,
        replacements: [],
      };
    }
  }

  const childResults = await Promise.all(ids.map((productId) => {
    return runtime.renderComponent(app.page.cardTemplate, { productId });
  }));
  const childHtml = childResults.map((result) => result.html).join('');
  const finalChildHtml = childResults.map((result) => result.finalHtml).join('');
  const contexts = childResults.map((result) => result.context).filter(Boolean);
  const replacements = childResults.flatMap((result) => result.replacements);
  finalizeMetrics(metrics);

  const durationMs = performance.now() - start;
  const timing = timingHtml({
    app,
    cache,
    delayMs,
    delays,
    asyncState,
    ssrState,
    renderMode,
    storeName,
    segment,
    ids,
    manifestHash: runtime.config.manifestHash,
    metrics,
    durationMs,
    warnings: lintWarnings,
    pageCacheHit: false,
  });

  const productList = app.registry.components[app.page.listTemplate];
  const renderList = await loadSymbol(productList);
  const swapHtml = renderMode === 'defer'
    ? clientSwapHtml({ replacements, delayMs })
    : renderMode === 'fetch'
      ? clientFetchPartialsHtml({
          partials: replacements,
          urlForPartial: (partial) => partialUrlFor({
            app,
            cache,
            delayMs,
            storeName,
            segment,
          }, partial),
        })
      : '';
  const html = renderList({
    app,
    childHtml,
    timingHtml: timing,
    clientSwapHtml: swapHtml,
    contextHtml: contextHtml(contexts),
  });

  if (runtime.flags.page) {
    await runtime.setPageCache(app.page.id, pagePayload, {
      childHtml: finalChildHtml,
      contexts,
      metrics,
    });
  }

  return {
    html,
    metrics,
    durationMs,
    warnings: lintWarnings,
    pageCacheHit: false,
    replacements,
  };
};

export const renderProductCardPartials = async ({
  app,
  partials,
  cache,
  delayMs,
  delays = {},
  storeName,
  segment,
}) => {
  const start = performance.now();
  const metrics = createMetrics();
  const runtime = createRequestRuntime({
    app,
    cache,
    delayMs,
    delays,
    asyncState: 'resolved',
    ssrState: 'auto',
    renderMode: 'block',
    storeName,
    segment,
    metrics,
  });

  const renderedPartials = await Promise.all(partials.map(async (partial) => {
    const result = await runtime.renderComponent(partial.componentSymbol ?? app.page.cardTemplate, partial.props);

    return partialPayload({
      app,
      partial,
      result,
      segment,
    });
  }));

  finalizeMetrics(metrics);

  return {
    partials: renderedPartials,
    metrics,
    durationMs: performance.now() - start,
  };
};
