# Scripts

This folder contains Node.js helper scripts used by `package.json`.

## Files

```txt
build-pages.js
  Builds the clean GitHub Pages artifact in dist-pages/.

copy-miniweb-assets.js
  Copies browser runtime files from the installed @async/miniweb package.

smoke.js
  Runs Node-server smoke checks against src/server/node.js.

static-server.js
  Serves the static browser demo locally at /.

sw-smoke.js
  Exercises the MiniWeb-backed service-worker route handler without a browser.
```

Scripts should stay small and dependency-free. Shared runtime behavior belongs in
`src/framework/`; app and route contracts belong in `src/app/`.
