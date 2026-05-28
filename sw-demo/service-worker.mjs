import { handleMiniWebDemoRequest } from './miniweb.mjs';
import { DEMO_SW_VERSION } from './router.mjs';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'async-framework-demo:version') {
    event.source?.postMessage({
      type: 'async-framework-demo:version',
      version: DEMO_SW_VERSION,
    });
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    const response = await handleMiniWebDemoRequest(event.request);

    return response ?? fetch(event.request);
  })());
});
