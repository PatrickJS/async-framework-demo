import { createProductApp } from '../create-product-app.js';

export default createProductApp({
  slug: 'component-partials',
  title: 'Component Partial Payloads',
  description: 'Fetches partial component payloads that include HTML, data, template references, and resume context.',
  why: 'Use this to inspect the payload shape for future component registry or partial transport work.',
  generatedBase: import.meta.url,
  defaults: {
    cache: 'resource',
    renderMode: 'stream',
    asyncState: 'pending',
    ssrState: 'pending',
    delayMs: 1400,
  },
});
