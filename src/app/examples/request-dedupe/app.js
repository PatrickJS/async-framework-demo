import { createProductApp } from '../create-product-app.js';

export default createProductApp({
  slug: 'request-dedupe',
  title: 'Request Dedupe',
  description: 'Renders duplicate product IDs so identical server resource calls share one in-flight promise.',
  why: 'Use this to verify the request-scoped cache layer before thinking about cross-request cache stores.',
  generatedBase: import.meta.url,
  defaults: {
    cache: 'request',
    renderMode: 'stream',
    asyncState: 'pending',
    ssrState: 'pending',
    delayMs: 900,
    ids: ['1', '1', '1', '2'],
  },
});
