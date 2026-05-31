import productCache from './examples/product-cache/app.js';
import jsxClosureExtraction from './examples/jsx-closure-extraction/app.js';
import streaming from './examples/streaming/app.js';
import componentPartials from './examples/component-partials/app.js';
import segmentVary from './examples/segment-vary/app.js';
import requestDedupe from './examples/request-dedupe/app.js';
import personalizedPending from './examples/personalized-pending/app.js';

export const demoApps = [
  productCache,
  jsxClosureExtraction,
  streaming,
  componentPartials,
  segmentVary,
  requestDedupe,
  personalizedPending,
];

export const defaultApp = productCache;

export const getDemoApp = (slug) => {
  return demoApps.find((app) => app.slug === slug) ?? null;
};

export const lintRegistry = (app) => {
  const warnings = [];

  for (const component of Object.values(app.registry.components)) {
    if (component.optimized && !component.simple) {
      warnings.push(`${component.symbol} is listed for cache optimization but is not simple enough; normal SSR will be used.`);
    }
  }

  return warnings;
};
