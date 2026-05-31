# App Layer

This folder contains the demo-facing app contract shared by the Node and browser
adapters.

## Files

```txt
cache-config.server.js
  Server-only cache policy and store configuration used by the runtime.

examples/
  Small demo apps plus their readable generated output.

generate.js
  Optimizer CLI that rebuilds generated files for every example.

registry.js
  Ordered list of demo apps used by the gallery and route handlers.

routes.js
  Canonical route constants and browser base-path helpers.
```

Add new demo scenarios under `examples/`. Keep routing constants in `routes.js`
so `src/server/` and `src/browser/` do not drift.

Examples may use the original `component.js` concept source or the markerless
JSX convention:

```txt
component.tsx
component.config.js
closure-boundaries.json
generated/
```

The JSX source is parser input only. Generation validates the closure manifest
through `src/compiler/` before emitting runtime JavaScript.
