import { createProductApp } from '../create-product-app.js';

export default createProductApp({
  slug: 'segment-vary',
  title: 'Segment Vary Cache Keys',
  description: 'Shows that free and pro segments produce separate resource and component cache entries.',
  why: 'Use this to inspect why a component cache key must include declared server vary output.',
  generatedBase: import.meta.url,
  defaults: {
    cache: 'component',
    renderMode: 'stream',
    asyncState: 'pending',
    ssrState: 'pending',
    segment: 'pro',
    delayMs: 300,
  },
});
