# Demo Apps

This folder contains the small example apps that run on the shared mini framework.

Each app keeps the author-facing file next to the generated output so the split is easy to inspect:

```txt
component.js
generated/
  server_segment.js
  server_product.js
  component_controller.js
  component_template.js
  component_model.js
```

The JSX closure extraction app uses the newer convention:

```txt
component.tsx
component.config.js
closure-boundaries.json
generated/
```

`component.tsx` is normal author JSX with plain `useAsync(...)` and
`server(...)` calls. The compiler infers callback intent from prop-forwarding
evidence and validates `closure-boundaries.json` before generating runtime JS.

The apps are intentionally small. They reuse the same framework runtime and mostly vary the defaults and the story they are trying to show: cache hits, out-of-order streaming, partial payloads, segment vary keys, request dedupe, and pending personalized UI.
