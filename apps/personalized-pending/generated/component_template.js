// GENERATED FILE. Source: ../component.js
import { escapeHtml } from '../../../framework/html.mjs';
import { createEffect, createSignal, serializeSignalGraph } from '../../../framework/signals.mjs';

export const ProductCardTemplate = ({ props, resources, resumeContext }) => {
  const productSignal = createSignal(resources.product, {
    id: `${resumeContext.component}:product:${props.productId}`,
    name: 'product',
    source: 'resources.product',
  });
  const statusEffect = createEffect('read product status', () => productSignal.value.status);
  const titleEffect = createEffect('read product title', () => {
    const state = productSignal.value;
    return state.status === 'resolved' ? state.value["title"] : null;
  });
  const priceEffect = createEffect('read product price', () => {
    const state = productSignal.value;
    return state.status === 'resolved' ? state.value["price"] : null;
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
      ? ` data-pending-id="${escapeHtml(resumeContext.boundary.id)}"`
      : '';
    const edgeSlot = resumeContext.boundary?.id
      ? `<small data-edge-slot="${escapeHtml(resumeContext.boundary.id)}">edge A/B segment: waiting for edge cache</small>`
      : '';
    const originSlot = resumeContext.boundary?.id
      ? `<small data-origin-slot="${escapeHtml(resumeContext.boundary.id)}">origin user-only data: waiting for private origin</small>`
      : '';

    return [
      `<article class="product-card skeleton" data-component-symbol="${escapeHtml(resumeContext.component)}" data-product-id="${escapeHtml(props.productId)}" data-async-state="pending"${pendingId}>`,
      '<h2>Loading private offer...</h2>',
      `<p class="bar"><span class="spinner" aria-hidden="true"></span> Waiting ${escapeHtml(productState.delayMs ?? 0)}ms on server resource data</p>`,
      edgeSlot,
      originSlot,
      `<small>segment key: ${escapeHtml(segment)}</small>`,
      `<small>pending state key: ${escapeHtml(productState.cacheKey)}</small>`,
      '</article>',
    ].join('');
  }

  if (productState.status === 'rejected') {
    return [
      `<article class="product-card error" data-component-symbol="${escapeHtml(resumeContext.component)}" data-product-id="${escapeHtml(props.productId)}" data-async-state="rejected">`,
      '<h2>Private offer unavailable</h2>',
      `<p>${escapeHtml(productState.error.message)}</p>`,
      `<small>segment key: ${escapeHtml(segment)}</small>`,
      `<small>safe error key: ${escapeHtml(productState.cacheKey)}</small>`,
      '</article>',
    ].join('');
  }

  const product = productState.value;
  const title = titleEffect.value;
  const price = priceEffect.value;

  return [
    `<article class="product-card" data-component-symbol="${escapeHtml(resumeContext.component)}" data-product-id="${escapeHtml(props.productId)}" data-async-state="resolved">`,
    `<h2>${escapeHtml(title)}</h2>`,
    `<p>${escapeHtml(price)}</p>`,
    `<small>segment key: ${escapeHtml(segment)}</small>`,
    `<small>server resource loaded: ${escapeHtml(product.loadedAt)}</small>`,
    `<small>template: ${escapeHtml(resumeContext.template)}</small>`,
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
    `<main class="shell" data-demo-app="${escapeHtml(app.slug)}" data-component-symbol="ProductListTemplate">`,
    '<header>',
    `<h1>${escapeHtml(app.title)}</h1>`,
    `<p>${escapeHtml(app.description)}</p>`,
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
