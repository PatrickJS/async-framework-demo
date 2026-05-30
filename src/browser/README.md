# Browser Demo Host

This folder contains the static GitHub Pages version of the demo.

## Files

```txt
index.html
  Static bootstrap page that installs the service worker.

service-worker.js
  Fetch handler that delegates demo routes to MiniWeb.

miniweb.js
  MiniWeb app bridge for browser-local route handling.

router.js
  Browser-side route responses for pages, partials, debug, and reset.

registry.js
  Static generated-module registry for browser execution.

architecture.html
backend-emulation.md
  Browser-demo architecture notes.
```

The deployed public path is the site root, but the tracked source lives here.
Generated MiniWeb package assets under `assets/miniweb/` are ignored and should
be recreated with `npm run prepare:static` or `npm run build:pages`.
