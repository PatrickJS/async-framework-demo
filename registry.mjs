import productCache from './apps/product-cache/app.mjs';
import streaming from './apps/streaming/app.mjs';
import componentPartials from './apps/component-partials/app.mjs';
import segmentVary from './apps/segment-vary/app.mjs';
import requestDedupe from './apps/request-dedupe/app.mjs';
import personalizedPending from './apps/personalized-pending/app.mjs';

export const demoApps = [
  productCache,
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
