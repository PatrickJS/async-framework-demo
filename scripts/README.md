# Scripts

This folder contains Node.js helper scripts used by `package.json`.

## Files

```txt
build-pages.js
  Builds the clean GitHub Pages artifact in dist-pages/.

copy-miniweb-assets.js
  Copies browser runtime files from the installed @async/miniweb package.

closure-poc.js
  Prints the parser-to-manifest-to-closure report for the JSX example.

closure-scenarios.js
  Runs deterministic markerless closure extraction scenarios.

closure-ollama.js
bench-ollama.js
  Optional local Ollama proposal and timing workflows.

closure-tests.js
  Focused deterministic assertions for the compiler contract.

smoke.js
  Runs Node-server smoke checks against src/server/node.js.

static-server.js
  Serves the static browser demo locally at /.

sw-smoke.js
  Exercises the MiniWeb-backed service-worker route handler without a browser.
```

Scripts should stay small and dependency-light. Shared runtime behavior belongs
in `src/framework/`; app and route contracts belong in `src/app/`; parser and
generation behavior belongs in `src/compiler/`.
