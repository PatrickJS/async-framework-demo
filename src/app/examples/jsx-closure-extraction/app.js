import { createProductApp } from '../create-product-app.js';

export default createProductApp({
  slug: 'jsx-closure-extraction',
  title: 'JSX Closure Extraction',
  description: 'Parses normal JSX author source, infers callback intent through evidence paths, and emits the same cacheable runtime files.',
  why: 'Use this to inspect markerless closure extraction without framework-specific callback suffixes in the author source.',
  generatedBase: import.meta.url,
  defaults: {
    cache: 'component',
    renderMode: 'stream',
    asyncState: 'pending',
    ssrState: 'pending',
    delayMs: 650,
  },
});
