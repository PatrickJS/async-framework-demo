#!/usr/bin/env node
import assert from 'node:assert/strict';

import { handleMiniWebDemoRequest } from '../sw-demo/miniweb.mjs';

const request = (path) => new Request(`http://127.0.0.1:4328${path}`);

const readText = async (path) => {
  const response = await handleMiniWebDemoRequest(request(path));

  assert(response, `expected ${path} to be handled by the MiniWeb service-worker router`);
  assert.equal(response.status, 200, `expected ${path} to return 200`);
  assert.equal(response.headers.get('x-async-framework-demo-runtime'), 'miniweb-service-worker');

  return response.text();
};

const gallery = await readText('/sw-demo/');
assert.match(gallery, /Async Framework Demo Gallery/);
assert.match(gallery, /href="\/sw-demo\/product-cache"/);
assert.match(gallery, /Reset service worker/);

const projectGallery = await readText('/async-framework-demo/sw-demo/');
assert.match(projectGallery, /Async Framework Demo Gallery/);
assert.match(projectGallery, /href="\/async-framework-demo\/sw-demo\/product-cache"/);

const debug = await readText('/sw-demo/debug');
assert.match(debug, /Service Worker Debug Harness/);
assert.match(debug, /id="run-debug"/);
assert.match(debug, /\/sw-demo\/_async\/partial\/ProductCard/);
assert.match(debug, /async-framework-demo:version/);

const projectDebug = await readText('/async-framework-demo/sw-demo/debug');
assert.match(projectDebug, /\/async-framework-demo\/sw-demo\/_async\/partial\/ProductCard/);

const page = await readText('/sw-demo/product-cache?mode=wait&cache=component&delay=0&clear=1');
assert.match(page, /data-demo-app="product-cache"/);
assert.match(page, /cache level<\/strong><br>component/);
assert.match(page, /Current in-memory cache sizes/);

const iframePage = await readText('/sw-demo/product-cache?runtime=iframe&mode=wait&cache=component&delay=0&clear=1');
assert.match(iframePage, /MiniWeb runtime<\/strong><br>iframe/);

const projectPage = await readText('/async-framework-demo/sw-demo/product-cache?runtime=iframe&mode=wait&cache=component&delay=0&clear=1');
assert.match(projectPage, /MiniWeb runtime<\/strong><br>iframe/);
assert.match(projectPage, /action="\/async-framework-demo\/sw-demo\/product-cache"/);

const projectFetchPage = await readText('/async-framework-demo/sw-demo/product-cache?runtime=iframe&mode=fetch&cache=component&delay=0&clear=1');
assert.match(projectFetchPage, /\/async-framework-demo\/sw-demo\/_async\/partial\/ProductCard/);

const partialResponse = await handleMiniWebDemoRequest(request(
  '/sw-demo/_async/partial/ProductCard?app=component-partials&id=pending-ProductCardTemplate-1&productId=1&cache=request&store=memory&segment=free&delay=0',
));
assert(partialResponse, 'expected ProductCard partial to be handled');
assert.equal(partialResponse.headers.get('content-type'), 'application/json; charset=utf-8');
assert.equal(partialResponse.headers.get('x-async-framework-demo-miniweb-runtime'), 'same-realm');

const partial = await partialResponse.json();
assert.equal(partial.type, 'component-partial');
assert.match(partial.html, /product-card/);
assert.equal(partial.context.component, 'ProductCardTemplate');
assert.equal(partial.template.kind, 'component-render-symbol');

const iframePartialResponse = await handleMiniWebDemoRequest(request(
  '/sw-demo/_async/partial/ProductCard?runtime=iframe&app=component-partials&id=pending-ProductCardTemplate-1&productId=1&cache=request&store=memory&segment=free&delay=0',
));
assert(iframePartialResponse, 'expected iframe ProductCard partial to be handled');
assert.equal(iframePartialResponse.headers.get('x-async-framework-demo-miniweb-runtime'), 'iframe');

const edgeResponse = await handleMiniWebDemoRequest(request(
  '/sw-demo/_async/partial/edge-segment?app=segment-vary&id=pending-ProductCardTemplate-1&productId=1&cache=request&store=memory&segment=pro&delay=0',
));
assert(edgeResponse, 'expected edge-segment partial to be handled');
assert.equal(edgeResponse.headers.get('x-async-framework-demo-location'), 'service-worker-edge');

const edge = await edgeResponse.json();
assert.equal(edge.source, 'edge-segment');
assert.equal(edge.routing.location, 'service-worker-edge');
assert.equal(edge.data.experiment, 'pricing-b-pro');

const stream = await readText(
  '/sw-demo/streaming?mode=stream&cache=request&state=pending&ssr=pending&delay=0&ids=1,2&delays=1:0,2:0&clear=1',
);
assert.match(stream, /initial pending shell flushed/);
assert.match(stream, /streamed-pending-ProductCardTemplate/);
assert.match(stream, /Current in-memory cache sizes/);

const reset = await readText('/sw-demo/?nosw=1');
assert.match(reset, /Resetting service worker demo/);
assert.match(reset, /navigator\.serviceWorker/);

console.log('MiniWeb service-worker smoke checks passed');
