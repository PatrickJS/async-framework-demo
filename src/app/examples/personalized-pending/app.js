import { createProductApp } from '../create-product-app.js';

export default createProductApp({
  slug: 'personalized-pending',
  title: 'Personalized Pending Shell',
  description: 'Forces pending SSR output so private user-specific data can resolve after the initial shell.',
  why: 'Use this to see why some components should cache pending output instead of resolved personalized HTML.',
  generatedBase: import.meta.url,
  defaults: {
    cache: 'resource',
    renderMode: 'stream',
    asyncState: 'pending',
    ssrState: 'pending',
    delayMs: 1800,
  },
});
