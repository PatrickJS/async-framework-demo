import { createProductApp } from '../create-product-app.js';

export default createProductApp({
  slug: 'product-cache',
  title: 'Product Cache',
  description: 'Caches server data and rendered component HTML while preserving a normal component authoring model.',
  why: 'Use this when you want to see the basic server resource result cache, component HTML cache, and duplicate request dedupe story.',
  generatedBase: import.meta.url,
  defaults: {
    cache: 'component',
    renderMode: 'stream',
    asyncState: 'pending',
    ssrState: 'pending',
    delayMs: 700,
  },
});
