# Async Framework Demo Architecture

This document explains the three core mechanics in the demo framework:

1. out-of-order streaming
2. closure capturing
3. file splitting for component and server-resource functions

The goal is readability, not exact parity with a production framework.

## 1) Out-Of-Order Streaming

Out-of-order streaming in this demo means:

1. render pending HTML quickly
2. start server resource work in parallel
3. stream resolved component chunks as each resource promise settles
4. keep one HTTP response open until all pending boundaries are replaced

### Request Flow

`/streaming?mode=stream&state=pending&ssr=pending` enters the streaming path in [server.mjs](server.mjs).

1. `renderProductsRoute(...)` returns initial pending markup plus replacement descriptors.
2. The server writes shell + initial HTML first.
3. For each pending boundary, the runtime keeps a `finalPromise` that resolves to final HTML.
4. The server waits with `Promise.race` and streams whichever boundary resolves first.
5. Client script swaps the pending boundary with the streamed template chunk.

Code locations:

- response loop: [server.mjs](server.mjs)
- pending resource promises: [framework/cache-runtime.mjs](framework/cache-runtime.mjs)
- streamed template swap script: [framework/html.mjs](framework/html.mjs)

For non-streaming behavior, use `mode=wait`. That path waits for data to resolve before returning the page.

## 2) Closure Capturing

The demo captures closure intent in a readable resume context object, built per component render.

Each context stores:

- component/template identifiers
- props used by the component
- resource states and keys
- closure capture list
- read paths
- boundary state (`pending` or `resolved`)

The closure section looks like:

```js
closures: [
  {
    name: 'load product',
    controller: 'ProductCardController',
    captures: ['props.productId']
  }
]
```

That is generated at render time in `createResumeContext(...)`.

Code locations:

- context + closures: [framework/cache-runtime.mjs](framework/cache-runtime.mjs)
- context display in UI: [framework/ssr.mjs](framework/ssr.mjs)

`HTML` alone is not enough when a runtime needs async boundary replacement and resumable state.

## 3) File Splitting

Each app has one author file plus generated files:

```txt
apps/<app-name>/
  component.js
  generated/
    server_segment.js
    server_product.js
    component_model.js
    component_controller.js
    component_template.js
```

### Generated Files

1. `server_segment.js`
   `SegmentModel` resource for vary-key input.

2. `server_product.js`
   `ProductModel` resource for product data.

3. `component_model.js`
   compatibility entrypoint that re-exports the split server files.

4. `component_controller.js`
   async edge from props to resource call.

5. `component_template.js`
   HTML renderer for pending/resolved/rejected states.

The app registry loads those split files directly.

Code locations:

- registry resource loaders: [apps/create-product-app.mjs](apps/create-product-app.mjs)
- optimizer output generator: [framework/simple-optimizer.mjs](framework/simple-optimizer.mjs)
- optimizer CLI: [generate.mjs](generate.mjs)

## Rebuild Generated Files

Generate all apps:

```bash
npm run generate
```

Generate one app:

```bash
node generate.mjs --app=product-cache
```
