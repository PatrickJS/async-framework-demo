import productCacheSource from '../apps/product-cache/app.mjs';
import * as productCacheSegment from '../apps/product-cache/generated/server_segment.js';
import * as productCacheProduct from '../apps/product-cache/generated/server_product.js';
import * as productCacheController from '../apps/product-cache/generated/component_controller.js';
import * as productCacheTemplate from '../apps/product-cache/generated/component_template.js';

import streamingSource from '../apps/streaming/app.mjs';
import * as streamingSegment from '../apps/streaming/generated/server_segment.js';
import * as streamingProduct from '../apps/streaming/generated/server_product.js';
import * as streamingController from '../apps/streaming/generated/component_controller.js';
import * as streamingTemplate from '../apps/streaming/generated/component_template.js';

import componentPartialsSource from '../apps/component-partials/app.mjs';
import * as componentPartialsSegment from '../apps/component-partials/generated/server_segment.js';
import * as componentPartialsProduct from '../apps/component-partials/generated/server_product.js';
import * as componentPartialsController from '../apps/component-partials/generated/component_controller.js';
import * as componentPartialsTemplate from '../apps/component-partials/generated/component_template.js';

import segmentVarySource from '../apps/segment-vary/app.mjs';
import * as segmentVarySegment from '../apps/segment-vary/generated/server_segment.js';
import * as segmentVaryProduct from '../apps/segment-vary/generated/server_product.js';
import * as segmentVaryController from '../apps/segment-vary/generated/component_controller.js';
import * as segmentVaryTemplate from '../apps/segment-vary/generated/component_template.js';

import requestDedupeSource from '../apps/request-dedupe/app.mjs';
import * as requestDedupeSegment from '../apps/request-dedupe/generated/server_segment.js';
import * as requestDedupeProduct from '../apps/request-dedupe/generated/server_product.js';
import * as requestDedupeController from '../apps/request-dedupe/generated/component_controller.js';
import * as requestDedupeTemplate from '../apps/request-dedupe/generated/component_template.js';

import personalizedPendingSource from '../apps/personalized-pending/app.mjs';
import * as personalizedPendingSegment from '../apps/personalized-pending/generated/server_segment.js';
import * as personalizedPendingProduct from '../apps/personalized-pending/generated/server_product.js';
import * as personalizedPendingController from '../apps/personalized-pending/generated/component_controller.js';
import * as personalizedPendingTemplate from '../apps/personalized-pending/generated/component_template.js';

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
