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

The apps are intentionally small. They reuse the same framework runtime and mostly vary the defaults and the story they are trying to show: cache hits, out-of-order streaming, partial payloads, segment vary keys, request dedupe, and pending personalized UI.
