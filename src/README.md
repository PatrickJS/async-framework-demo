# Source Layout

This folder contains the source for the proof-of-concept demo.

## Structure

```txt
app/
  Demo route table, app registry, cache config, optimizer CLI, and examples.

browser/
  Static bootstrap page, service worker, MiniWeb bridge, and browser docs.

framework/
  Shared runtime used by both Node and browser-hosted demos.

server/
  Local Node.js HTTP adapter.
```

The repo uses `"type": "module"` in `package.json`, so source files use ESM
syntax with `.js` extensions.
