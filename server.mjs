#!/usr/bin/env node
import http from 'node:http';
import { performance } from 'node:perf_hooks';
import { URL } from 'node:url';
import { clearCaches, getCacheStats, normalizeCacheMode } from './framework/cache-runtime.mjs';
import {
  controlsHtml,
  galleryHtml,
  pageEndHtml,
  pageShell,
  pageStartHtml,
  streamedPartialsHtml,
} from './framework/html.mjs';
import {
  renderProductCardPartials,
  renderProductsRoute,
} from './framework/ssr.mjs';
import { defaultApp, demoApps, getDemoApp } from './registry.mjs';

const DEFAULT_PORT = 4317;
const DEFAULT_DELAY_MS = 1000;
const PENDING_PRESET_DELAY_MS = 3000;
const EDGE_DELAY_MS = 100;
const ASYNC_STATES = new Set(['pending', 'resolved', 'error']);
const SSR_STATES = new Set(['auto', 'pending']);
const RENDER_MODES = new Set(['stream', 'wait', 'fetch']);
const STORE_NAMES = new Set(['memory', 'redis']);
const SEGMENTS = new Set(['free', 'pro']);
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#162033"/>
  <path d="M18 44 31 14h7l13 30h-8l-2.5-6.5h-13L25 44h-7Zm12-13h8l-4-10-4 10Z" fill="#f6f7f9"/>
</svg>`;

const normalizeAsyncState = (state, fallback = 'resolved') => {
  return ASYNC_STATES.has(state) ? state : fallback;
};

const normalizeSsrState = (state, fallback = 'auto') => {
  return SSR_STATES.has(state) ? state : fallback;
};

const normalizeStoreName = (storeName, fallback = 'redis') => {
  return STORE_NAMES.has(storeName) ? storeName : fallback;
};

const normalizeRenderMode = (mode, fallback = 'stream') => {
  if (mode === 'defer') return 'stream';
  if (mode === 'block') return 'wait';
  return RENDER_MODES.has(mode) ? mode : fallback;
};

const applyRenderModeDefaults = (options) => {
  if (options.renderMode === 'wait') {
    return {
      ...options,
      asyncState: 'resolved',
      ssrState: 'auto',
    };
  }

  return options;
};

const normalizeSegment = (segment, fallback = 'free') => {
  return SEGMENTS.has(segment) ? segment : fallback;
};

const parseIds = (value, fallback = ['1', '2', '1', '3']) => {
  if (!value) return fallback;

  const ids = String(value)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  return ids.length > 0 ? ids : fallback;
};

const parseDelays = (value, fallback = {}) => {
  if (!value) return fallback;

  const delays = {};

  for (const part of String(value).split(',')) {
    const [id, ms] = part.split(':').map((item) => item.trim());
    const delay = Number(ms);

    if (id && Number.isFinite(delay)) {
      delays[id] = Math.max(0, Math.min(5000, delay));
    }
  }

  return delays;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withPreset = (options, preset) => {
  if (preset === 'uncached-pending') {
    return {
      ...options,
      cache: 'none',
      storeName: 'memory',
      asyncState: 'pending',
      ssrState: 'pending',
      renderMode: 'stream',
      delayMs: PENDING_PRESET_DELAY_MS,
      clear: true,
      prime: false,
    };
  }

  if (preset === 'slow-ssr') {
    return {
      ...options,
      cache: 'none',
      storeName: 'memory',
      asyncState: 'resolved',
      ssrState: 'auto',
      renderMode: 'wait',
      delayMs: DEFAULT_DELAY_MS,
      delays: {},
      clear: true,
      prime: false,
    };
  }

  if (preset === 'stream-oob') {
    return {
      ...options,
      cache: 'request',
      storeName: 'memory',
      asyncState: 'pending',
      ssrState: 'pending',
      renderMode: 'stream',
      delayMs: PENDING_PRESET_DELAY_MS,
      delays: {
        '1': 1200,
        '2': 250,
        '3': 700,
      },
      clear: true,
      prime: false,
    };
  }

  if (preset === 'client-fetch') {
    return {
      ...options,
      cache: 'none',
      storeName: 'memory',
      asyncState: 'pending',
      ssrState: 'pending',
      renderMode: 'fetch',
      delayMs: PENDING_PRESET_DELAY_MS,
      clear: true,
      prime: false,
    };
  }

  if (preset === 'server-cache') {
    return {
      ...options,
      cache: 'page',
      storeName: 'redis',
      asyncState: 'resolved',
      ssrState: 'auto',
      renderMode: 'wait',
      delayMs: DEFAULT_DELAY_MS,
      delays: {},
      clear: true,
      prime: true,
    };
  }

  return options;
};

const parseRequestOptions = (url, app) => {
  const defaults = app.defaults;
  const delay = Number(url.searchParams.get('delay') || defaults.delayMs || DEFAULT_DELAY_MS);
  const delayMs = Number.isFinite(delay) ? Math.max(0, Math.min(5000, delay)) : DEFAULT_DELAY_MS;
  const options = {
    app,
    cache: normalizeCacheMode(url.searchParams.get('cache') || defaults.cache),
    delayMs,
    delays: parseDelays(url.searchParams.get('delays'), defaults.delays),
    asyncState: normalizeAsyncState(url.searchParams.get('state') || defaults.asyncState, defaults.asyncState),
    ssrState: normalizeSsrState(url.searchParams.get('ssr') || defaults.ssrState, defaults.ssrState),
    renderMode: normalizeRenderMode(url.searchParams.get('mode') || defaults.renderMode, defaults.renderMode),
    storeName: normalizeStoreName(url.searchParams.get('store') || defaults.storeName, defaults.storeName),
    segment: normalizeSegment(url.searchParams.get('segment') || defaults.segment, defaults.segment),
    ids: parseIds(url.searchParams.get('ids'), defaults.ids),
    clear: url.searchParams.get('clear') === '1',
    prime: false,
  };

  return applyRenderModeDefaults(withPreset(options, url.searchParams.get('preset') || ''));
};

const parseCliOptions = () => {
  let app = defaultApp;
  const options = {
    once: false,
    app,
    cache: app.defaults.cache,
    delayMs: app.defaults.delayMs,
    delays: app.defaults.delays,
    asyncState: app.defaults.asyncState,
    ssrState: app.defaults.ssrState,
    renderMode: normalizeRenderMode(app.defaults.renderMode, 'stream'),
    storeName: app.defaults.storeName,
    segment: app.defaults.segment,
    ids: app.defaults.ids,
    runs: 1,
    port: Number(process.env.PORT || DEFAULT_PORT),
    clear: false,
    prime: false,
  };

  for (const arg of process.argv.slice(2)) {
    const [name, value] = arg.split('=');

    if (arg === '--once') {
      options.once = true;
      continue;
    }

    if (name === '--app') {
      app = getDemoApp(value) ?? app;
      options.app = app;
      continue;
    }

    if (name === '--cache') options.cache = normalizeCacheMode(value);
    if (name === '--delay') options.delayMs = Number(value);
    if (name === '--delays') options.delays = parseDelays(value, {});
    if (name === '--state') options.asyncState = normalizeAsyncState(value, options.asyncState);
    if (name === '--ssr') options.ssrState = normalizeSsrState(value, options.ssrState);
    if (name === '--mode') options.renderMode = normalizeRenderMode(value, options.renderMode);
    if (name === '--store') options.storeName = normalizeStoreName(value, options.storeName);
    if (name === '--segment') options.segment = normalizeSegment(value, options.segment);
    if (name === '--ids') options.ids = parseIds(value, options.ids);
    if (name === '--runs') options.runs = Math.max(1, Number(value) || 1);
    if (name === '--port') options.port = Number(value) || DEFAULT_PORT;
    if (name === '--clear') options.clear = value !== '0';
    if (name === '--prime') options.prime = value !== '0';
  }

  return applyRenderModeDefaults(options);
};

const renderPage = async (options) => {
  const requestStart = performance.now();

  if (options.clear) {
    clearCaches();
  }

  if (options.prime) {
    await renderProductsRoute({
      ...options,
      prime: false,
    });
  }

  const result = await renderProductsRoute(options);
  const controls = controlsFor(options);

  return pageShell({
    body: result.html,
    controls,
    cacheStats: {
      stores: getCacheStats(),
      ssrMs: Number(result.durationMs.toFixed(1)),
      serverRequestMs: Number((performance.now() - requestStart).toFixed(1)),
    },
  });
};

const controlsFor = (options) => {
  return controlsHtml({
    app: options.app,
    cache: options.cache,
    delay: options.delayMs,
    delays: options.delays,
    asyncState: options.asyncState,
    ssrState: options.ssrState,
    renderMode: options.renderMode,
    storeName: options.storeName,
    segment: options.segment,
    ids: options.ids,
  });
};

const renderStreamPage = async (options, res) => {
  const requestStart = performance.now();

  if (options.clear) {
    clearCaches();
  }

  const initial = await renderProductsRoute(options);
  const controls = controlsFor(options);

  res.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-async-framework-demo': 'stream',
  });
  res.write(pageStartHtml({ controls }));
  res.write(initial.html);
  res.write(`\n<!-- ${'initial pending shell flushed'.padEnd(2048, '.')} -->\n`);

  const pending = new Set(initial.replacements.filter((replacement) => replacement.finalPromise));

  while (pending.size > 0) {
    const resolved = await Promise.race([...pending].map((replacement) => {
      return replacement.finalPromise.then((payload) => ({
        replacement,
        payload,
      }));
    }));

    pending.delete(resolved.replacement);
    res.write(streamedPartialsHtml({ partials: [resolved.payload] }));
  }

  if (pending.size === 0 && initial.replacements.length === 0) {
    await sleep(0);
  }

  res.end(pageEndHtml({
    cacheStats: {
      stores: getCacheStats(),
      ssrMs: Number(initial.durationMs.toFixed(1)),
      serverRequestMs: Number((performance.now() - requestStart).toFixed(1)),
    },
    updateServerTiming: true,
  }));
};

const parsePartialOptions = (url) => {
  const app = getDemoApp(url.searchParams.get('app')) ?? defaultApp;
  const cache = normalizeCacheMode(url.searchParams.get('cache') || app.defaults.cache);
  const delay = Number(url.searchParams.get('delay') || app.defaults.delayMs || DEFAULT_DELAY_MS);
  const delayMs = Number.isFinite(delay) ? Math.max(0, Math.min(5000, delay)) : DEFAULT_DELAY_MS;
  const effectiveCache = cache === 'component' || cache === 'page' ? 'resource' : cache;

  return {
    app,
    id: url.searchParams.get('id') || 'pending-ProductCard',
    productId: url.searchParams.get('productId') || '1',
    cache: effectiveCache,
    delayMs,
    delays: parseDelays(url.searchParams.get('delays'), app.defaults.delays),
    storeName: normalizeStoreName(url.searchParams.get('store') || app.defaults.storeName, app.defaults.storeName),
    segment: normalizeSegment(url.searchParams.get('segment') || app.defaults.segment, app.defaults.segment),
  };
};

const renderEdgeSegmentResponse = async (url) => {
  const start = performance.now();
  const options = parsePartialOptions(url);
  const experiment = options.segment === 'pro' ? 'pricing-b-pro' : 'pricing-a-free';

  await sleep(Math.min(options.delayMs, EDGE_DELAY_MS));

  return {
    id: options.id,
    source: 'edge-segment',
    routing: {
      location: 'edge',
      cache: 'public edge cache',
      reason: 'A/B and segment data can vary by safe segment key',
    },
    data: {
      segment: options.segment,
      experiment,
      productId: options.productId,
    },
    durationMs: Number((performance.now() - start).toFixed(1)),
  };
};

const renderPartialResponse = async (url) => {
  const options = parsePartialOptions(url);
  const result = await renderProductCardPartials({
    app: options.app,
    partials: [
      {
        id: options.id,
        componentSymbol: options.app.page.cardTemplate,
        props: {
          productId: options.productId,
        },
      },
    ],
    cache: options.cache,
    delayMs: options.delayMs,
    delays: options.delays,
    storeName: options.storeName,
    segment: options.segment,
  });

  return {
    ...result.partials[0],
    metrics: result.metrics,
    durationMs: Number(result.durationMs.toFixed(1)),
  };
};

const runOnce = async (options) => {
  if (options.clear) {
    clearCaches();
  }

  if (options.prime) {
    await renderProductsRoute({
      ...options,
      prime: false,
    });
  }

  for (let index = 0; index < options.runs; index += 1) {
    const result = await renderProductsRoute(options);

    console.log(JSON.stringify({
      run: index + 1,
      app: options.app.slug,
      cache: options.cache,
      asyncState: options.asyncState,
      ssrState: options.ssrState,
      renderMode: options.renderMode,
      storeName: options.storeName,
      segment: options.segment,
      delayMs: options.delayMs,
      delays: options.delays,
      ids: options.ids,
      durationMs: Number(result.durationMs.toFixed(1)),
      serverRequestMs: Number(result.durationMs.toFixed(1)),
      pageCacheHit: result.pageCacheHit,
      metrics: result.metrics,
      cacheStats: getCacheStats(),
    }, null, 2));
  }
};

const startServer = (port) => {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`);

      if (url.pathname === '/favicon.ico') {
        res.writeHead(200, {
          'content-type': 'image/svg+xml; charset=utf-8',
          'cache-control': 'public, max-age=86400',
        });
        res.end(FAVICON_SVG);
        return;
      }

      if (url.pathname === '/_async/partial/ProductCard') {
        const payload = await renderPartialResponse(url);

        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        });
        res.end(JSON.stringify(payload));
        return;
      }

      if (url.pathname === '/_async/partial/edge-segment') {
        const payload = await renderEdgeSegmentResponse(url);

        res.writeHead(200, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'public, max-age=60',
          'x-async-framework-demo-location': 'edge',
        });
        res.end(JSON.stringify(payload));
        return;
      }

      if (url.pathname === '/') {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        });
        res.end(galleryHtml({ apps: demoApps }));
        return;
      }

      const slug = url.pathname.replace(/^\/+/, '').split('/')[0];
      const app = getDemoApp(slug);

      if (!app) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      const options = parseRequestOptions(url, app);

      if (options.renderMode === 'stream') {
        await renderStreamPage(options, res);
        return;
      }

      const html = await renderPage(options);

      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(error?.stack || String(error));
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`async framework demo running at http://127.0.0.1:${port}/`);
  });
};

const options = parseCliOptions();

if (options.once) {
  await runOnce(options);
} else {
  startServer(options.port);
}
