import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_PRODUCTS = {
  '1': { title: 'Keyboard', price: '$199', proPrice: '$179' },
  '2': { title: 'Mouse', price: '$89', proPrice: '$79' },
  '3': { title: 'Monitor', price: '$499', proPrice: '$459' },
  '4': { title: 'USB-C Dock', price: '$229', proPrice: '$209' },
};

const DEFAULT_SPEC = {
  fallbackHeading: 'Loading product...',
  unavailableHeading: 'Product unavailable',
  edgePendingText: 'edge A/B segment: waiting for edge cache',
  originPendingText: 'origin user-only data: waiting for private origin',
  titleField: 'title',
  priceField: 'price',
  products: DEFAULT_PRODUCTS,
};

const toJson = (value) => JSON.stringify(value, null, 2);

const segmentServerFile = () => `// GENERATED FILE. Source: ../component.js
export const SegmentModel = async ({ segment }) => {
  return {
    plan: segment === 'pro' ? 'pro' : 'free',
  };
};
`;

const productServerFile = (spec) => `// GENERATED FILE. Source: ../component.js
const PRODUCTS = ${toJson(spec.products)};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const ProductModel = async ({ productId }, context) => {
  await sleep(context.delayForProduct(productId));

  const product = PRODUCTS[productId] ?? {
    title: \`Product \${productId}\`,
    price: '$42',
    proPrice: '$39',
  };
  const segment = context.segment === 'pro' ? 'pro' : 'free';

  return {
    id: productId,
    title: product.title,
    price: segment === 'pro' ? product.proPrice : product.price,
    segment,
    loadedAt: new Date().toISOString(),
  };
};
`;

const modelFile = () => `// GENERATED FILE. Source: ../component.js
// This file keeps the simple "component_model.js" entrypoint while the server
// functions are physically split into separate files.
export { SegmentModel } from './server_segment.js';
export { ProductModel } from './server_product.js';
`;

const controllerFile = () => `// GENERATED FILE. Source: ../component.js
// The controller is the generated async edge from component props to server data.
// It is the readable generated edge for a resource-binding asyncResource call.
export const ProductCardController = (props, runtime) => {
  return runtime.loadResourceState('ProductModel', {
    productId: props.productId,
  });
};
`;

const templateFile = (spec) => `// GENERATED FILE. Source: ../component.js
import { escapeHtml } from '../../../framework/html.mjs';
import { createEffect, createSignal, serializeSignalGraph } from '../../../framework/signals.mjs';

export const ProductCardTemplate = ({ props, resources, resumeContext }) => {
  const productSignal = createSignal(resources.product, {
    id: \`\${resumeContext.component}:product:\${props.productId}\`,
    name: 'product',
    source: 'resources.product',
  });
  const statusEffect = createEffect('read product status', () => productSignal.value.status);
  const titleEffect = createEffect('read product title', () => {
    const state = productSignal.value;
    return state.status === 'resolved' ? state.value[${JSON.stringify(spec.titleField)}] : null;
  });
  const priceEffect = createEffect('read product price', () => {
    const state = productSignal.value;
    return state.status === 'resolved' ? state.value[${JSON.stringify(spec.priceField)}] : null;
  });
  resumeContext.signalGraph = serializeSignalGraph({
    signals: {
      product: productSignal,
    },
    effects: [statusEffect, titleEffect, priceEffect],
  });

  const productState = productSignal.value;
  const segment = resumeContext.vary?.SegmentModel?.plan ?? 'free';

  if (productState.status === 'pending') {
    const pendingId = resumeContext.boundary?.id
      ? \` data-pending-id="\${escapeHtml(resumeContext.boundary.id)}"\`
      : '';
    const edgeSlot = resumeContext.boundary?.id
      ? \`<small data-edge-slot="\${escapeHtml(resumeContext.boundary.id)}">${spec.edgePendingText}</small>\`
      : '';
    const originSlot = resumeContext.boundary?.id
      ? \`<small data-origin-slot="\${escapeHtml(resumeContext.boundary.id)}">${spec.originPendingText}</small>\`
      : '';

    return [
      \`<article class="product-card skeleton" data-component-symbol="\${escapeHtml(resumeContext.component)}" data-product-id="\${escapeHtml(props.productId)}" data-async-state="pending"\${pendingId}>\`,
      '<h2>${spec.fallbackHeading}</h2>',
      \`<p class="bar"><span class="spinner" aria-hidden="true"></span> Waiting \${escapeHtml(productState.delayMs ?? 0)}ms on server resource data</p>\`,
      edgeSlot,
      originSlot,
      \`<small>segment key: \${escapeHtml(segment)}</small>\`,
      \`<small>pending state key: \${escapeHtml(productState.cacheKey)}</small>\`,
      '</article>',
    ].join('');
  }

  if (productState.status === 'rejected') {
    return [
      \`<article class="product-card error" data-component-symbol="\${escapeHtml(resumeContext.component)}" data-product-id="\${escapeHtml(props.productId)}" data-async-state="rejected">\`,
      '<h2>${spec.unavailableHeading}</h2>',
      \`<p>\${escapeHtml(productState.error.message)}</p>\`,
      \`<small>segment key: \${escapeHtml(segment)}</small>\`,
      \`<small>safe error key: \${escapeHtml(productState.cacheKey)}</small>\`,
      '</article>',
    ].join('');
  }

  const product = productState.value;
  const title = titleEffect.value;
  const price = priceEffect.value;

  return [
    \`<article class="product-card" data-component-symbol="\${escapeHtml(resumeContext.component)}" data-product-id="\${escapeHtml(props.productId)}" data-async-state="resolved">\`,
    \`<h2>\${escapeHtml(title)}</h2>\`,
    \`<p>\${escapeHtml(price)}</p>\`,
    \`<small>segment key: \${escapeHtml(segment)}</small>\`,
    \`<small>server resource loaded: \${escapeHtml(product.loadedAt)}</small>\`,
    \`<small>template: \${escapeHtml(resumeContext.template)}</small>\`,
    '</article>',
  ].join('');
};

export const ProductListTemplate = ({
  app,
  childHtml,
  timingHtml,
  clientSwapHtml = '',
  contextHtml = '',
}) => {
  return [
    \`<main class="shell" data-demo-app="\${escapeHtml(app.slug)}" data-component-symbol="ProductListTemplate">\`,
    '<header>',
    \`<h1>\${escapeHtml(app.title)}</h1>\`,
    \`<p>\${escapeHtml(app.description)}</p>\`,
    '</header>',
    '<section class="grid">',
    childHtml,
    '</section>',
    '<h2>Execution graph metrics</h2>',
    timingHtml,
    contextHtml,
    clientSwapHtml,
    '</main>',
  ].join('');
};
`;

const loadGenerationSpec = async (componentPath) => {
  const moduleUrl = `${pathToFileURL(componentPath).href}?v=${Date.now()}`;
  const mod = await import(moduleUrl);
  return {
    ...DEFAULT_SPEC,
    ...(mod.generationSpec ?? {}),
    products: {
      ...DEFAULT_PRODUCTS,
      ...(mod.generationSpec?.products ?? {}),
    },
  };
};

export const optimizeApp = async (appDir) => {
  const componentPath = path.join(appDir, 'component.js');
  const generatedDir = path.join(appDir, 'generated');
  const spec = await loadGenerationSpec(componentPath);

  await fs.mkdir(generatedDir, { recursive: true });
  await fs.writeFile(path.join(generatedDir, 'server_segment.js'), segmentServerFile(), 'utf8');
  await fs.writeFile(path.join(generatedDir, 'server_product.js'), productServerFile(spec), 'utf8');
  await fs.writeFile(path.join(generatedDir, 'component_model.js'), modelFile(spec), 'utf8');
  await fs.writeFile(path.join(generatedDir, 'component_controller.js'), controllerFile(spec), 'utf8');
  await fs.writeFile(path.join(generatedDir, 'component_template.js'), templateFile(spec), 'utf8');

  return {
    appDir,
    spec,
  };
};
