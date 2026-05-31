# Mini Framework

This folder contains the reusable runtime used by every demo app.

The framework is intentionally small and dependency-free. It loads a demo app registry, runs the generated model/controller/template files, applies cache policy, tracks request dedupe, and renders either blocking HTML, client-fetched partials, or out-of-order streaming.

The framework is here so the app folders can stay focused on the concept they demonstrate instead of repeating server and cache plumbing.

## Files

```txt
cache-policy.js
  Merges generated cache hints with server-only user cache config.

cache-runtime.js
  Request runtime, cache flags, resource state, dedupe, and cache statistics.

cache-stores.js
  In-memory and Redis-like demo store implementations.

html.js
  HTML shell, controls, gallery, client swap, and streamed partial helpers.

signals.js
  Tiny signal/effect runtime used by generated templates.

ssr.js
  Renders app routes, component partials, timing metrics, and resume context.
```

Keep this layer adapter-neutral. Node-specific behavior belongs in
`src/server/`, service-worker/MiniWeb behavior belongs in `src/browser/`, and
source parsing/generation belongs in `src/compiler/`.
