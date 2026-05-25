# Signals And Effects

This demo has a tiny signal runtime to explain how render state can be tracked and serialized.

The important shape is simple:

```js
const product = createSignal(resourceState);

product.value;
product.value = nextResourceState;
```

`value` is a getter and setter. Reading it inside an effect records the dependency. Writing it reruns subscribed effects.

## Runtime Pieces

The signal runtime lives in [framework/signals.mjs](framework/signals.mjs).

It exposes:

```js
createSignal(initialValue, metadata)
createEffect(name, fn)
serializeSignalGraph({ signals, effects })
```

`createSignal(...)` returns an object with a `.value` property.

`createEffect(...)` runs a function while dependency tracking is active. Any signal `.value` reads inside the function are added to the effect's `reads` set.

`serializeSignalGraph(...)` turns the current signal/effect graph into readable JSON for the resume context panel.

## Generated Template

The optimizer emits signal-aware template code into each app's `generated/component_template.js`.

The generated component wraps server resource state in a signal:

```js
const productSignal = createSignal(resources.product, {
  id: `${resumeContext.component}:product:${props.productId}`,
  name: 'product',
  source: 'resources.product',
});
```

Then it creates effects that read `.value`:

```js
const statusEffect = createEffect('read product status', () => {
  return productSignal.value.status;
});

const titleEffect = createEffect('read product title', () => {
  const state = productSignal.value;
  return state.status === 'resolved' ? state.value.title : null;
});
```

Those effects are serialized into `resumeContext.signalGraph`:

```js
resumeContext.signalGraph = serializeSignalGraph({
  signals: {
    product: productSignal,
  },
  effects: [statusEffect, titleEffect, priceEffect],
});
```

## Why Signals Matter

Rendered HTML is only the visible output. A resumable runtime also needs to know what state was read and which code should rerun when that state changes.

In this demo:

```txt
resource state -> signal.value
template/effect -> reads signal.value
resume context -> records signal + effect graph
cached/streamed HTML -> travels with enough metadata to explain resume
```

That is why the context panel includes more than HTML:

- `signals`: current signal values and identities
- `effects`: which effects ran and what signals they read
- `closures`: which generated controller captures props
- `resources`: async resource state and cache keys
- `boundary`: pending/resolved render boundary state

## What This Does Not Do

This is intentionally smaller than a production framework:

- it does not implement a full optimizer
- it does not serialize production lazy-symbol references
- it does not resume browser event handlers
- it does not diff DOM updates

The purpose is to make the data flow obvious:

```txt
server resource result
-> signal.value
-> effect reads
-> generated template
-> HTML + serialized render context
```
