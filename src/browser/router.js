import { clearCaches, getCacheStats, normalizeCacheMode } from '../framework/cache-runtime.js';
import {
  controlsHtml,
  escapeHtml,
  galleryHtml,
  pageEndHtml,
  pageShell,
  pageStartHtml,
  streamedPartialsHtml,
} from '../framework/html.js';
import {
  renderProductCardPartials,
  renderProductsRoute,
} from '../framework/ssr.js';
import {
  ROUTES,
  appSlugFromPathname,
  getBrowserDemoRoute,
  isBrowserResetRoute,
  isBrowserStaticRoute,
} from '../app/routes.js';
import { defaultApp, demoApps, getDemoApp } from './registry.js';

export const DEMO_SW_VERSION = '2026-05-28-2';

const DEFAULT_DELAY_MS = 1000;
const PENDING_PRESET_DELAY_MS = 3000;
const EDGE_DELAY_MS = 100;
const ASYNC_STATES = new Set(['pending', 'resolved', 'error']);
const SSR_STATES = new Set(['auto', 'pending']);
const RENDER_MODES = new Set(['stream', 'wait', 'fetch']);
const STORE_NAMES = new Set(['memory', 'redis']);
const SEGMENTS = new Set(['free', 'pro']);
const MINIWEB_RUNTIME_MODES = new Set(['same-realm', 'iframe']);

const textEncoder = new TextEncoder();

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

const normalizeMiniWebRuntimeMode = (runtime, fallback = 'same-realm') => {
  return MINIWEB_RUNTIME_MODES.has(runtime) ? runtime : fallback;
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

const parseRequestOptions = (url, app, basePath) => {
  const defaults = app.defaults;
  const delay = Number(url.searchParams.get('delay') || defaults.delayMs || DEFAULT_DELAY_MS);
  const delayMs = Number.isFinite(delay) ? Math.max(0, Math.min(5000, delay)) : DEFAULT_DELAY_MS;
  const options = {
    app,
    basePath,
    cache: normalizeCacheMode(url.searchParams.get('cache') || defaults.cache),
    delayMs,
    delays: parseDelays(url.searchParams.get('delays'), defaults.delays),
    asyncState: normalizeAsyncState(url.searchParams.get('state') || defaults.asyncState, defaults.asyncState),
    ssrState: normalizeSsrState(url.searchParams.get('ssr') || defaults.ssrState, defaults.ssrState),
    renderMode: normalizeRenderMode(url.searchParams.get('mode') || defaults.renderMode, defaults.renderMode),
    storeName: normalizeStoreName(url.searchParams.get('store') || defaults.storeName, defaults.storeName),
    segment: normalizeSegment(url.searchParams.get('segment') || defaults.segment, defaults.segment),
    miniWebRuntimeMode: normalizeMiniWebRuntimeMode(url.searchParams.get('runtime')),
    ids: parseIds(url.searchParams.get('ids'), defaults.ids),
    clear: url.searchParams.get('clear') === '1',
    prime: false,
  };

  return applyRenderModeDefaults(withPreset(options, url.searchParams.get('preset') || ''));
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
    miniWebRuntimeMode: normalizeMiniWebRuntimeMode(url.searchParams.get('runtime')),
  };
};

const controlsFor = (options) => {
  return controlsHtml({
    app: options.app,
    basePath: options.basePath,
    cache: options.cache,
    delay: options.delayMs,
    delays: options.delays,
    asyncState: options.asyncState,
    ssrState: options.ssrState,
    renderMode: options.renderMode,
    storeName: options.storeName,
    segment: options.segment,
    miniWebRuntimeMode: options.miniWebRuntimeMode,
    ids: options.ids,
  });
};

const htmlResponse = (html, headers = {}) => {
  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-async-framework-demo-runtime': 'service-worker',
      ...headers,
    },
  });
};

const jsonResponse = (payload, headers = {}) => {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-async-framework-demo-runtime': 'service-worker',
      ...headers,
    },
  });
};

const resetPageHtml = (basePath) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Resetting service worker demo</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f6f7f9; color: #172033; }
      main { max-width: 760px; margin: 0 auto; padding: 40px 24px; }
      button, a { font: inherit; display: inline-block; padding: 8px 10px; border: 1px solid #162033; border-radius: 6px; background: #162033; color: #fff; text-decoration: none; }
      code { background: #fff; border: 1px solid #d9dee8; border-radius: 4px; padding: 2px 4px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Resetting service worker demo</h1>
      <p id="status">Removing the worker and demo caches...</p>
      <p><a href="${basePath}/">Start demo again</a></p>
    </main>
    <script type="module">
      const status = document.getElementById('status');
      const clearDemoCaches = async () => {
        if (!('caches' in window)) return;

        for (const key of await caches.keys()) {
          if (key.startsWith('async-framework-demo-')) {
            await caches.delete(key);
          }
        }
      };

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations
          .filter((registration) => registration.scope.includes('${basePath}/'))
          .map((registration) => registration.unregister()));
      }

      await clearDemoCaches();
      status.textContent = 'Service worker removed. The next visit will install a fresh demo worker.';
    </script>
  </body>
</html>`;

const debugPageHtml = (basePath) => {
  const productUrl = `${basePath}/_async/partial/ProductCard?app=component-partials&id=pending-ProductCardTemplate-1&productId=1&cache=request&store=memory&segment=free&delay=0`;
  const edgeUrl = `${basePath}/_async/partial/edge-segment?app=segment-vary&id=pending-ProductCardTemplate-1&productId=1&cache=request&store=memory&segment=pro&delay=0`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Service Worker Debug Harness</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f6f7f9; color: #172033; }
      main { max-width: 900px; margin: 0 auto; padding: 32px 24px; }
      nav { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
      button, a { font: inherit; display: inline-block; padding: 8px 10px; border: 1px solid #162033; border-radius: 6px; background: #162033; color: #fff; text-decoration: none; cursor: pointer; }
      a.secondary { background: #fff; color: #162033; border-color: #8b96a8; }
      .panel { border: 1px solid #d9dee8; border-radius: 8px; background: #fff; padding: 16px; }
      .checks { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin: 16px 0; }
      .check { border: 1px solid #d9dee8; border-radius: 6px; padding: 10px; background: #fff; }
      pre { overflow: auto; padding: 12px; border-radius: 6px; background: #101827; color: #d7e2f0; }
      code { overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <main>
      <nav>
        <a class="secondary" href="${basePath}/">All demos</a>
        <a class="secondary" href="${basePath}/?nosw=1">Reset service worker</a>
      </nav>
      <section class="panel">
        <h1>Service Worker Debug Harness</h1>
        <p>This page runs inside the worker scope and asks the configured worker to handle the same partial routes the demo uses.</p>
        <p><button id="run-debug" type="button">Run service worker checks</button></p>
        <p data-debug-status>Not run yet.</p>
        <div class="checks">
          <div class="check"><strong>Controller</strong><br><code data-check="controller">pending</code></div>
          <div class="check"><strong>Worker version</strong><br><code data-check="version">pending</code></div>
          <div class="check"><strong>Product partial</strong><br><code data-check="product">pending</code></div>
          <div class="check"><strong>Edge partial</strong><br><code data-check="edge">pending</code></div>
        </div>
        <pre id="debug-output">{}</pre>
      </section>
    </main>
    <script type="module">
      const productUrl = ${JSON.stringify(productUrl)};
      const edgeUrl = ${JSON.stringify(edgeUrl)};
      const status = document.querySelector('[data-debug-status]');
      const output = document.getElementById('debug-output');
      const setCheck = (name, value) => {
        document.querySelector('[data-check="' + name + '"]').textContent = value;
      };
      const workerVersion = async () => {
        if (!navigator.serviceWorker?.controller) return 'no-controller';

        return new Promise((resolve) => {
          const timer = setTimeout(() => resolve('timeout'), 1000);
          const onMessage = (event) => {
            if (event.data?.type === 'async-framework-demo:version') {
              clearTimeout(timer);
              navigator.serviceWorker.removeEventListener('message', onMessage);
              resolve(event.data.version);
            }
          };

          navigator.serviceWorker.addEventListener('message', onMessage);
          navigator.serviceWorker.controller.postMessage({
            type: 'async-framework-demo:version',
          });
        });
      };
      const readJson = async (url) => {
        const response = await fetch(url);
        const payload = await response.json();

        return {
          ok: response.ok,
          status: response.status,
          runtime: response.headers.get('x-async-framework-demo-runtime'),
          location: response.headers.get('x-async-framework-demo-location'),
          payload,
        };
      };
      const run = async () => {
        status.textContent = 'Running service worker checks...';
        setCheck('controller', navigator.serviceWorker?.controller ? 'controlled' : 'missing');

        const registration = await navigator.serviceWorker?.getRegistration('${basePath}/');
        const version = await workerVersion();
        const product = await readJson(productUrl);
        const edge = await readJson(edgeUrl);
        const result = {
          controlled: Boolean(navigator.serviceWorker?.controller),
          controllerScript: navigator.serviceWorker?.controller?.scriptURL ?? null,
          registrationScope: registration?.scope ?? null,
          version,
          productUrl,
          productRuntime: product.runtime,
          productType: product.payload.type,
          productComponent: product.payload.context?.component,
          productTitle: product.payload.data?.server?.product?.title,
          edgeUrl,
          edgeRuntime: edge.runtime,
          edgeHeader: edge.location,
          edgeLocation: edge.payload.routing?.location,
          edgeExperiment: edge.payload.data?.experiment,
        };

        setCheck('version', result.version);
        setCheck('product', result.productRuntime + ' / ' + result.productTitle);
        setCheck('edge', result.edgeHeader + ' / ' + result.edgeExperiment);
        output.textContent = JSON.stringify(result, null, 2);
        status.textContent = 'Service worker checks complete.';
      };

      document.getElementById('run-debug').addEventListener('click', run);
      run().catch((error) => {
        status.textContent = 'Service worker checks failed.';
        output.textContent = error?.stack || String(error);
      });
    </script>
  </body>
</html>`;
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

const renderStreamResponse = (options) => {
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (html) => controller.enqueue(textEncoder.encode(html));
      const requestStart = performance.now();

      try {
        if (options.clear) {
          clearCaches();
        }

        const initial = await renderProductsRoute(options);
        const controls = controlsFor(options);

        enqueue(pageStartHtml({ controls }));
        enqueue(initial.html);
        enqueue(`\n<!-- ${'initial pending shell flushed'.padEnd(2048, '.')} -->\n`);

        const pending = new Set(initial.replacements.filter((replacement) => replacement.finalPromise));

        while (pending.size > 0) {
          const resolved = await Promise.race([...pending].map((replacement) => {
            return replacement.finalPromise.then((payload) => ({
              replacement,
              payload,
            }));
          }));

          pending.delete(resolved.replacement);
          enqueue(streamedPartialsHtml({ partials: [resolved.payload] }));
        }

        if (pending.size === 0 && initial.replacements.length === 0) {
          await sleep(0);
        }

        enqueue(pageEndHtml({
          cacheStats: {
            stores: getCacheStats(),
            ssrMs: Number(initial.durationMs.toFixed(1)),
            serverRequestMs: Number((performance.now() - requestStart).toFixed(1)),
          },
          updateServerTiming: true,
        }));
      } catch (error) {
        enqueue(`<pre>${escapeHtml(error?.stack || String(error))}</pre>`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-async-framework-demo': 'service-worker-stream',
      'x-async-framework-demo-runtime': 'service-worker',
    },
  });
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
      location: 'service-worker-edge',
      cache: 'browser service-worker cache',
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
    miniWebRuntimeMode: options.miniWebRuntimeMode,
  });

  return {
    ...result.partials[0],
    metrics: result.metrics,
    durationMs: Number(result.durationMs.toFixed(1)),
  };
};

export const handleDemoRequest = async (request) => {
  if (request.method !== 'GET') return null;

  const url = new URL(request.url);
  const route = getBrowserDemoRoute(url.pathname);
  const localPath = route?.localPath;

  if (!localPath || isBrowserStaticRoute(localPath)) return null;

  if (isBrowserResetRoute(url, localPath)) {
    return htmlResponse(resetPageHtml(route.basePath));
  }

  if (localPath === ROUTES.browserDebug) {
    return htmlResponse(debugPageHtml(route.basePath));
  }

  if (localPath === ROUTES.gallery) {
    return htmlResponse(galleryHtml({
      apps: demoApps,
      basePath: route.basePath,
      showBrowserLinks: true,
    }));
  }

  if (localPath === ROUTES.productPartial) {
    const payload = await renderPartialResponse(url);

    return jsonResponse(payload);
  }

  if (localPath === ROUTES.edgeSegmentPartial) {
    const payload = await renderEdgeSegmentResponse(url);

    return jsonResponse(payload, {
      'cache-control': 'public, max-age=60',
      'x-async-framework-demo-location': 'service-worker-edge',
    });
  }

  const slug = appSlugFromPathname(localPath);
  const app = getDemoApp(slug);

  if (!app) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }

  const options = parseRequestOptions(url, app, route.basePath);

  if (options.renderMode === 'stream') {
    return renderStreamResponse(options);
  }

  return htmlResponse(await renderPage(options));
};
