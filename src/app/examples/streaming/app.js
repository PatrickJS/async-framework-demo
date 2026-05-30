import { createProductApp } from '../create-product-app.js';

export default createProductApp({
  slug: 'streaming',
  title: 'Out-of-Order Streaming',
  description: 'Flushes pending component HTML first, then streams resolved component chunks as server resources finish.',
  why: 'Use this to compare out-of-order streaming against blocking SSR and see why queued async resources should not hold the whole route hostage.',
  generatedBase: import.meta.url,
  defaults: {
    cache: 'request',
    renderMode: 'stream',
    asyncState: 'pending',
    ssrState: 'pending',
    delayMs: 1200,
    delays: {
      '1': 1200,
      '2': 250,
      '3': 700,
    },
  },
});
