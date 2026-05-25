# Product Cache Example

This folder is the main cache-registry example.

`component.js` is the author-facing source sketch. It shows the resource-binding code the demo is trying to preserve: a component, a server resource, an async resource binding, and a pending boundary.

`generated/` is the readable optimizer output. It splits the component into a model, controller, and template so the framework can cache server data and rendered HTML separately.

This example is here to show the default path: render product cards, cache server resource results, cache component HTML, and reuse duplicate product requests.
