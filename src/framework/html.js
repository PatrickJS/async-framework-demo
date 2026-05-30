export const escapeHtml = (value) => {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

const normalizeBasePath = (basePath = '') => {
  if (!basePath || basePath === '/') return '';

  return `/${String(basePath).replace(/^\/+|\/+$/g, '')}`;
};

const demoPath = (basePath, path = '/') => {
  const prefix = normalizeBasePath(basePath);
  const suffix = path.startsWith('/') ? path : `/${path}`;

  return `${prefix}${suffix}` || '/';
};

const cacheStatsHtml = (cacheStats) => {
  return Object.entries(cacheStats)
    .map(([name, stats]) => (
      `<code>${escapeHtml(name)} (${escapeHtml(stats.kind)}): ${escapeHtml(stats.entries)} entries</code>`
    ))
    .join('');
};

const serverTimingHtml = (cacheStats) => {
  if (!cacheStats) {
    return [
      '<div id="server-timing" class="metrics">',
      '<div class="metric"><strong>server request total</strong><br>stream open</div>',
      '<div class="metric"><strong>SSR render time</strong><br>initial shell pending</div>',
      '</div>',
    ].join('');
  }

  return [
    '<div id="server-timing" class="metrics">',
    `<div class="metric"><strong>server request total</strong><br>${escapeHtml(cacheStats.serverRequestMs)}ms</div>`,
    `<div class="metric"><strong>SSR render time</strong><br>${escapeHtml(cacheStats.ssrMs)}ms</div>`,
    '</div>',
  ].join('');
};

export const clientSwapHtml = ({ replacements, delayMs }) => {
  if (replacements.length === 0) return '';

  const templates = replacements.map(({ id, html }) => (
    `<template id="resolved-${escapeHtml(id)}">${html}</template>`
  )).join('');
  const payload = JSON.stringify(replacements.map(({ id }) => id));

  return `${templates}<script>
(() => {
  const ids = ${payload};
  const delay = ${JSON.stringify(delayMs)};
  const started = performance.now();
  window.__asyncFrameworkDemo = window.__asyncFrameworkDemo || {};
  window.__asyncFrameworkDemo.swaps = window.__asyncFrameworkDemo.swaps || [];

  setTimeout(() => {
    for (const id of ids) {
      const pending = document.querySelector('[data-pending-id="' + CSS.escape(id) + '"]');
      const template = document.getElementById('resolved-' + id);

      if (pending && template) {
        pending.outerHTML = template.innerHTML;
        window.__asyncFrameworkDemo.swaps.push({
          id,
          delayMs: Math.round(performance.now() - started),
        });
      }
    }
  }, delay);
})();
</script>`;
};

export const streamedPartialsHtml = ({ partials }) => {
  if (partials.length === 0) return '';

  const templates = partials.map(({ id, html }) => (
    `<template id="streamed-${escapeHtml(id)}">${html}</template>`
  )).join('');
  const payload = JSON.stringify(partials.map(({ id }) => id));

  return `${templates}<script>
(() => {
  const ids = ${payload};
  window.__asyncFrameworkDemo = window.__asyncFrameworkDemo || {};
  window.__asyncFrameworkDemo.streamChunks = window.__asyncFrameworkDemo.streamChunks || [];

  for (const id of ids) {
    const pending = document.querySelector('[data-pending-id="' + CSS.escape(id) + '"]');
    const template = document.getElementById('streamed-' + id);

    if (pending && template) {
      pending.outerHTML = template.innerHTML;
      window.__asyncFrameworkDemo.streamChunks.push({
        id,
        arrivedAt: Math.round(performance.now()),
      });
    }
  }
})();
</script>`;
};

export const clientFetchPartialsHtml = ({ partials, urlForPartial }) => {
  if (partials.length === 0) return '';

  const payload = JSON.stringify(partials.map((partial) => {
    const urls = urlForPartial(partial);

    return {
      id: partial.id,
      edgeUrl: urls.edge,
      originUrl: urls.origin,
    };
  }));

  return `<script>
(() => {
  const partials = ${payload};
  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
  const edgeById = new Map();
  const renderClientTemplate = (payload) => {
    const edge = edgeById.get(payload.id);
    const product = payload.data.server.product;
    const props = payload.data.props;
    const segment = payload.data.segment;

    return [
      '<article class="product-card" data-component-symbol="' + escapeHtml(payload.template.symbol) + '" data-product-id="' + escapeHtml(props.productId) + '" data-async-state="resolved" data-client-template="true">',
      '<h2>' + escapeHtml(product.title) + '</h2>',
      '<p>' + escapeHtml(product.price) + '</p>',
      '<small>edge A/B segment: ' + escapeHtml(edge?.data?.experiment ?? 'not loaded') + ' from ' + escapeHtml(edge?.routing?.location ?? 'edge') + ' in ' + escapeHtml(edge?.durationMs ?? 0) + 'ms</small>',
      '<small>origin user-only data: ' + escapeHtml(payload.data.userOnly.message) + ' from ' + escapeHtml(payload.routing.location) + ' in ' + escapeHtml(payload.durationMs) + 'ms</small>',
      '<small>segment key: ' + escapeHtml(segment) + '</small>',
      '<small>client-rendered from template ref: ' + escapeHtml(payload.template.symbol) + '</small>',
      '</article>',
    ].join('');
  };
  window.__asyncFrameworkDemo = window.__asyncFrameworkDemo || {};
  window.__asyncFrameworkDemo.fetches = window.__asyncFrameworkDemo.fetches || [];

  for (const partial of partials) {
    fetch(partial.edgeUrl)
      .then((response) => response.json())
      .then((payload) => {
        const edgeSlot = document.querySelector('[data-edge-slot="' + CSS.escape(partial.id) + '"]');
        edgeById.set(partial.id, payload);

        if (edgeSlot) {
          edgeSlot.textContent = 'edge A/B segment: ' + payload.data.experiment + ' from ' + payload.routing.location + ' in ' + payload.durationMs + 'ms';
        }

        window.__asyncFrameworkDemo.fetches.push({
          id: partial.id,
          source: 'edge',
          durationMs: payload.durationMs,
          location: payload.routing.location,
        });
      });

    fetch(partial.originUrl)
      .then((response) => response.json())
      .then((payload) => {
        const pending = document.querySelector('[data-pending-id="' + CSS.escape(partial.id) + '"]');
        const originSlot = document.querySelector('[data-origin-slot="' + CSS.escape(partial.id) + '"]');

        if (originSlot) {
          originSlot.textContent = 'origin user-only data: resolved from ' + payload.routing.location + ' in ' + payload.durationMs + 'ms';
        }

        if (pending) {
          pending.outerHTML = renderClientTemplate(payload);
          window.__asyncFrameworkDemo.fetches.push({
            id: partial.id,
            source: 'origin',
            durationMs: payload.durationMs,
            location: payload.routing.location,
            template: payload.template.symbol,
            loadedAt: Math.round(performance.now()),
          });
        }
      });
  }
})();
</script>`;
};

export const pageStartHtml = ({ controls, cacheStats }) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="/favicon.ico">
    <title>Async Framework Demo</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f6f7f9; color: #172033; }
      .toolbar { position: sticky; top: 0; z-index: 2; display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); padding: 16px; background: #ffffff; border-bottom: 1px solid #d9dee8; }
      label { display: grid; gap: 4px; font-size: 13px; font-weight: 650; }
      input, select, button { font: inherit; padding: 8px 10px; border: 1px solid #b8c0cc; border-radius: 6px; background: #fff; }
      button { cursor: pointer; background: #162033; color: white; border-color: #162033; }
      button.secondary { background: #ffffff; color: #162033; border-color: #8b96a8; }
      details.advanced { grid-column: 1 / -1; border: 1px solid #d9dee8; border-radius: 8px; padding: 10px; background: #f9fafc; }
      details.advanced summary { cursor: pointer; font-weight: 750; }
      .advanced-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-top: 12px; }
      .preset-row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .shell { max-width: 980px; margin: 0 auto; padding: 18px 24px; }
      header { margin-bottom: 14px; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      .metrics, .cache-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin: 16px 0; }
      .metric, .cache-stats code { padding: 10px; border: 1px solid #d9dee8; border-radius: 6px; background: white; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
      .product-card { background: white; border: 1px solid #d9dee8; border-radius: 8px; padding: 16px; box-shadow: 0 1px 2px rgb(15 23 42 / 0.04); }
      .product-card.skeleton { background: #f9fafc; border-style: dashed; }
      .product-card.error { background: #fff7f7; border-color: #f2b8b8; }
      .product-card h2 { margin: 0 0 8px; font-size: 18px; }
      .product-card p { margin: 0 0 12px; font-size: 16px; font-weight: 700; }
      .product-card .bar { color: #667085; font-weight: 600; }
      .spinner { display: inline-block; width: 0.8em; height: 0.8em; margin-right: 6px; border: 2px solid #c7ceda; border-top-color: #162033; border-radius: 999px; animation: spin 0.8s linear infinite; vertical-align: -0.1em; }
      .product-card small { color: #697386; display: block; margin-top: 4px; overflow-wrap: anywhere; }
      .context-panel { margin: 16px 0; padding: 12px; border: 1px solid #d9dee8; border-radius: 8px; background: #ffffff; }
      .context-panel summary { cursor: pointer; font-weight: 750; }
      .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-top: 16px; }
      .demo-card { padding: 16px; border: 1px solid #d9dee8; border-radius: 8px; background: #ffffff; }
      .demo-card h2 { margin-top: 0; }
      .demo-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .demo-links a { color: #162033; border: 1px solid #b8c0cc; border-radius: 6px; padding: 7px 9px; text-decoration: none; font-weight: 700; }
      pre { overflow: auto; padding: 12px; border-radius: 6px; background: #101827; color: #d7e2f0; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
  </head>
  <body>
    ${controls}
    <section class="shell">
      <h2>Server timing</h2>
      ${serverTimingHtml(cacheStats)}
    </section>
`;

export const pageEndHtml = ({ cacheStats, updateServerTiming = false }) => `
    ${updateServerTiming ? `<script>
(() => {
  const timing = document.getElementById('server-timing');
  if (timing) timing.outerHTML = ${JSON.stringify(serverTimingHtml(cacheStats))};
})();
</script>` : ''}
    <section class="shell">
      <h2>Current in-memory cache sizes</h2>
      <div class="cache-stats">
        ${cacheStatsHtml(cacheStats.stores)}
      </div>
    </section>
  </body>
</html>`;

export const pageShell = ({ body, controls, cacheStats }) => (
  `${pageStartHtml({ controls, cacheStats })}${body}${pageEndHtml({ cacheStats })}`
);

export const controlsHtml = ({ app, basePath = '', cache, delay, delays, asyncState, ssrState, renderMode, storeName, segment, ids, miniWebRuntimeMode }) => {
  const rootPath = demoPath(basePath, '/');
  const appPath = demoPath(basePath, `/${app.slug}`);
  const resetPath = `${rootPath}?nosw=1`;

  return `
<form class="toolbar" method="get" action="${escapeHtml(appPath)}">
  <div class="preset-row">
    <a href="${escapeHtml(rootPath)}" class="demo-links">All demos</a>
    ${basePath ? `<a href="${escapeHtml(resetPath)}" class="demo-links">Reset service worker</a>` : ''}
    <button type="submit" name="preset" value="client-fetch">Show delays</button>
    <button class="secondary" type="submit" name="preset" value="server-cache">Show cached</button>
  </div>
  <details class="advanced">
    <summary>Advanced configuration</summary>
    <div class="advanced-grid">
      <label>
        Cache level
        <select name="cache">
          ${['none', 'request', 'resource', 'component', 'page'].map((level) => (
            `<option value="${level}"${level === cache ? ' selected' : ''}>${level}</option>`
          )).join('')}
        </select>
      </label>
      <label>
        Store adapter
        <select name="store">
          ${['memory', 'redis'].map((store) => (
            `<option value="${store}"${store === storeName ? ' selected' : ''}>${store}</option>`
          )).join('')}
        </select>
      </label>
      <label>
        Segment vary key
        <select name="segment">
          ${['free', 'pro'].map((value) => (
            `<option value="${value}"${value === segment ? ' selected' : ''}>${value}</option>`
          )).join('')}
        </select>
      </label>
      <label>
        Component ssrState
        <select name="ssr">
          ${['auto', 'pending'].map((state) => (
            `<option value="${state}"${state === ssrState ? ' selected' : ''}>${state}</option>`
          )).join('')}
        </select>
      </label>
      <label>
        Render mode
        <select name="mode">
          ${['stream', 'wait', 'fetch'].map((mode) => (
            `<option value="${mode}"${mode === renderMode ? ' selected' : ''}>${mode}</option>`
          )).join('')}
        </select>
      </label>
      <label>
        Async state
        <select name="state">
          ${['resolved', 'pending', 'error'].map((state) => (
            `<option value="${state}"${state === asyncState ? ' selected' : ''}>${state}</option>`
          )).join('')}
        </select>
      </label>
      <label>
        Mock server resource delay
        <input name="delay" type="number" min="0" max="5000" step="50" value="${escapeHtml(delay)}">
      </label>
      <label>
        Product IDs
        <input name="ids" value="${escapeHtml(ids.join(','))}">
      </label>
      <label>
        Per-product delays
        <input name="delays" placeholder="1:1200,2:250" value="${escapeHtml(Object.entries(delays ?? {}).map(([id, ms]) => `${id}:${ms}`).join(','))}">
      </label>
      ${basePath ? `<label>
        MiniWeb runtime
        <select name="runtime">
          ${['same-realm', 'iframe'].map((runtime) => (
            `<option value="${runtime}"${runtime === miniWebRuntimeMode ? ' selected' : ''}>${runtime}</option>`
          )).join('')}
        </select>
      </label>` : ''}
      <label>
        Actions
        <span>
          <button type="submit">Render custom</button>
          <button type="submit" name="clear" value="1">Clear caches</button>
          <button class="secondary" type="submit" name="preset" value="uncached-pending">Embedded pending 3s</button>
          <button class="secondary" type="submit" name="preset" value="stream-oob">Stream chunks 3s</button>
          <button class="secondary" type="submit" name="preset" value="client-fetch">Fetch partials 3s</button>
          <button class="secondary" type="submit" name="preset" value="slow-ssr">Slow uncached SSR 1s</button>
        </span>
      </label>
    </div>
  </details>
</form>`;
};

export const galleryHtml = ({ apps, basePath = '' }) => {
  const cards = apps.map((app) => {
    const base = demoPath(basePath, `/${app.slug}`);

    return [
      '<article class="demo-card">',
      `<h2>${escapeHtml(app.title)}</h2>`,
      `<p>${escapeHtml(app.description)}</p>`,
      `<small>${escapeHtml(app.why)}</small>`,
      '<div class="demo-links">',
      `<a href="${base}">View demo</a>`,
      `<a href="${base}?preset=client-fetch">Mock loading</a>`,
      `<a href="${base}?preset=server-cache">Cached</a>`,
      `<a href="${base}?mode=stream&state=pending&ssr=pending&clear=1">Streaming</a>`,
      `<a href="${base}?mode=wait&clear=1">Wait</a>`,
      '</div>',
      '</article>',
    ].join('');
  }).join('');

  return pageShell({
    controls: '',
    body: [
      '<main class="shell">',
      '<header>',
      '<h1>Async Framework Demo Gallery</h1>',
      '<p>Each demo uses the same mini framework and keeps author source beside readable generated files.</p>',
      basePath ? `<p><a href="${escapeHtml(demoPath(basePath, '/architecture.html'))}">Architecture diagram</a> · <a href="${escapeHtml(demoPath(basePath, '/backend-emulation.md'))}">Markdown diagram</a> · <a href="${escapeHtml(demoPath(basePath, '/debug'))}">Debug harness</a> · <a href="${escapeHtml(`${demoPath(basePath, '/')}?nosw=1`)}">Reset service worker</a></p>` : '',
      '</header>',
      `<section class="gallery">${cards}</section>`,
      '</main>',
    ].join(''),
    cacheStats: {
      stores: {},
      ssrMs: 0,
      serverRequestMs: 0,
    },
  });
};
