import productCacheSource from '../app/examples/product-cache/app.js';
import * as productCacheSegment from '../app/examples/product-cache/generated/server_segment.js';
import * as productCacheProduct from '../app/examples/product-cache/generated/server_product.js';
import * as productCacheController from '../app/examples/product-cache/generated/component_controller.js';
import * as productCacheTemplate from '../app/examples/product-cache/generated/component_template.js';

import jsxClosureExtractionSource from '../app/examples/jsx-closure-extraction/app.js';
import * as jsxClosureExtractionSegment from '../app/examples/jsx-closure-extraction/generated/server_segment.js';
import * as jsxClosureExtractionProduct from '../app/examples/jsx-closure-extraction/generated/server_product.js';
import * as jsxClosureExtractionController from '../app/examples/jsx-closure-extraction/generated/component_controller.js';
import * as jsxClosureExtractionTemplate from '../app/examples/jsx-closure-extraction/generated/component_template.js';

import streamingSource from '../app/examples/streaming/app.js';
import * as streamingSegment from '../app/examples/streaming/generated/server_segment.js';
import * as streamingProduct from '../app/examples/streaming/generated/server_product.js';
import * as streamingController from '../app/examples/streaming/generated/component_controller.js';
import * as streamingTemplate from '../app/examples/streaming/generated/component_template.js';

import componentPartialsSource from '../app/examples/component-partials/app.js';
import * as componentPartialsSegment from '../app/examples/component-partials/generated/server_segment.js';
import * as componentPartialsProduct from '../app/examples/component-partials/generated/server_product.js';
import * as componentPartialsController from '../app/examples/component-partials/generated/component_controller.js';
import * as componentPartialsTemplate from '../app/examples/component-partials/generated/component_template.js';

import segmentVarySource from '../app/examples/segment-vary/app.js';
import * as segmentVarySegment from '../app/examples/segment-vary/generated/server_segment.js';
import * as segmentVaryProduct from '../app/examples/segment-vary/generated/server_product.js';
import * as segmentVaryController from '../app/examples/segment-vary/generated/component_controller.js';
import * as segmentVaryTemplate from '../app/examples/segment-vary/generated/component_template.js';

import requestDedupeSource from '../app/examples/request-dedupe/app.js';
import * as requestDedupeSegment from '../app/examples/request-dedupe/generated/server_segment.js';
import * as requestDedupeProduct from '../app/examples/request-dedupe/generated/server_product.js';
import * as requestDedupeController from '../app/examples/request-dedupe/generated/component_controller.js';
import * as requestDedupeTemplate from '../app/examples/request-dedupe/generated/component_template.js';

import personalizedPendingSource from '../app/examples/personalized-pending/app.js';
import * as personalizedPendingSegment from '../app/examples/personalized-pending/generated/server_segment.js';
import * as personalizedPendingProduct from '../app/examples/personalized-pending/generated/server_product.js';
import * as personalizedPendingController from '../app/examples/personalized-pending/generated/component_controller.js';
import * as personalizedPendingTemplate from '../app/examples/personalized-pending/generated/component_template.js';

const withStaticGeneratedModules = (app, generated) => ({
  ...app,
  registry: {
    ...app.registry,
    resources: {
      SegmentModel: {
        ...app.registry.resources.SegmentModel,
        load: async () => generated.segment,
      },
      ProductModel: {
        ...app.registry.resources.ProductModel,
        load: async () => generated.product,
      },
    },
    asyncEdges: {
      ProductCardController: {
        ...app.registry.asyncEdges.ProductCardController,
        load: async () => generated.controller,
      },
    },
    components: {
      ProductCardTemplate: {
        ...app.registry.components.ProductCardTemplate,
        load: async () => generated.template,
      },
      ProductListTemplate: {
        ...app.registry.components.ProductListTemplate,
        load: async () => generated.template,
      },
    },
  },
});

const productCache = withStaticGeneratedModules(productCacheSource, {
  segment: productCacheSegment,
  product: productCacheProduct,
  controller: productCacheController,
  template: productCacheTemplate,
});

const jsxClosureExtraction = withStaticGeneratedModules(jsxClosureExtractionSource, {
  segment: jsxClosureExtractionSegment,
  product: jsxClosureExtractionProduct,
  controller: jsxClosureExtractionController,
  template: jsxClosureExtractionTemplate,
});

const streaming = withStaticGeneratedModules(streamingSource, {
  segment: streamingSegment,
  product: streamingProduct,
  controller: streamingController,
  template: streamingTemplate,
});

const componentPartials = withStaticGeneratedModules(componentPartialsSource, {
  segment: componentPartialsSegment,
  product: componentPartialsProduct,
  controller: componentPartialsController,
  template: componentPartialsTemplate,
});

const segmentVary = withStaticGeneratedModules(segmentVarySource, {
  segment: segmentVarySegment,
  product: segmentVaryProduct,
  controller: segmentVaryController,
  template: segmentVaryTemplate,
});

const requestDedupe = withStaticGeneratedModules(requestDedupeSource, {
  segment: requestDedupeSegment,
  product: requestDedupeProduct,
  controller: requestDedupeController,
  template: requestDedupeTemplate,
});

const personalizedPending = withStaticGeneratedModules(personalizedPendingSource, {
  segment: personalizedPendingSegment,
  product: personalizedPendingProduct,
  controller: personalizedPendingController,
  template: personalizedPendingTemplate,
});

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
