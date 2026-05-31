# Async Framework Demo

A small Node.js demo for async rendering ideas: cacheable server resources, generated component output, request dedupe, partial payloads, streaming, resume metadata, and markerless JSX closure extraction.

The code is intentionally small and readable. It is not a production framework. It shows how source components can be split into generated model/controller/template files so data, render code, and final HTML can be cached independently. The JSX closure example keeps normal `useAsync(...)`, `server(...)`, and JSX callback props in author source; a deterministic compiler pass infers boundary intent from prop-forwarding evidence.

## Quick Start

```bash
npm start
```

Open:

```txt
http://127.0.0.1:4317/
```

The root page is a gallery of all examples.

To test the GitHub Pages-style service-worker demo locally:

```bash
npm run start:static
```

Open:

```txt
http://127.0.0.1:4328/
```

The first load installs the deployed `service-worker.js`, then the worker sends
site-root demo routes through static MiniWeb assets generated from the
installed `@async/miniweb` package. Use the **Reset service worker** link or
visit `/?nosw=1` to unregister the worker and clear demo caches before
debugging stale behavior.
Add `runtime=iframe` to any demo URL to route the MiniWeb app through
its iframe runtime boundary instead of the default same-realm runtime.

## Scripts

```bash
npm run generate
npm run prepare:static
npm run build:pages
npm run check
npm run closure:poc
npm run closure:scenarios
npm run smoke
npm run smoke:sw
npm run verify
```

`generate` rebuilds every app's readable generated output. `prepare:static`
creates ignored local MiniWeb browser assets from the installed
`@async/miniweb` package. `build:pages` creates the clean `dist-pages/` artifact
for GitHub Pages, including those generated assets. `check` syntax-checks all
JavaScript files. `closure:poc` prints the parser-to-manifest-to-closure report
for the JSX example. `closure:scenarios` runs deterministic parser-backed
boundary scenarios. `smoke` runs stream, wait, JSX, and component-partial CLI
checks. `smoke:sw` checks the MiniWeb-backed service-worker route handler
without opening a browser. `closure:ollama` and `bench:ollama` are optional
local-model workflows and are not part of normal verification.

## GitHub Pages

The Pages workflow builds from `package-lock.json`, runs the smoke checks, then
copies the installed MiniWeb browser assets into `dist-pages/assets/miniweb`
for deployment. The generated asset directory is ignored locally and is not
committed. In the repository settings, set Pages to deploy from **GitHub
Actions**.

## File Map

```txt
src/app/
  route table, app registry, cache config, optimizer CLI, and examples

src/compiler/
  parser-first closure extraction, manifest validation, optimizer output, and optional Ollama workflow

src/server/
  local Node adapter

src/browser/
  static bootstrap page, service worker, MiniWeb bridge, and browser docs

src/framework/
  shared demo runtime
```

Each app keeps author source beside readable generated output:

```txt
src/app/examples/product-cache/
  component.js
  generated/
    server_segment.js
    server_product.js
    component_controller.js
    component_template.js
    component_model.js
```

`component.js` is the code authors conceptually write. The demo server does not execute it directly. The generated files are readable optimizer-style output:

- `server_segment.js`: split server resource for vary-key data
- `server_product.js`: split server resource for product data
- `component_model.js`: entrypoint that re-exports split server files
- `component_controller.js`: async edge from props to the resource
- `component_template.js`: deterministic HTML rendering from props, resource state, and resume context

The JSX closure example uses the newer source convention:

```txt
src/app/examples/jsx-closure-extraction/
  component.tsx
  component.config.js
  closure-boundaries.json
  generated/
    server_segment.js
    server_product.js
    component_controller.js
    component_template.js
    component_model.js
```

`component.tsx` is parser-only author source. `closure-boundaries.json` stores
accepted event boundaries plus compiler-derived evidence paths. Generation
validates that manifest before emitting runtime files.

## Examples

```txt
/product-cache
  server resource cache + component HTML cache

/jsx-closure-extraction
  normal JSX source + markerless closure manifest + generated runtime files

/streaming
  pending shell first, resolved chunks later in one response

/component-partials
  client-fetched component partial payloads

/segment-vary
  separate cache entries for free/pro segment output

/request-dedupe
  duplicate resource inputs share one in-flight promise

/personalized-pending
  private data starts as pending output
```

## Useful URLs

```txt
http://127.0.0.1:4317/product-cache?cache=component&ids=1,2,1,3

http://127.0.0.1:4317/streaming?mode=stream&cache=request&state=pending&ssr=pending&ids=1,2,1,3&delays=1:1200,2:250,3:700&clear=1

http://127.0.0.1:4317/component-partials?mode=fetch

http://127.0.0.1:4317/segment-vary?cache=component&segment=pro

http://127.0.0.1:4317/request-dedupe?cache=request&mode=wait&ids=1,1,1,2
```

## Query Knobs

```txt
cache=none       no optimized cross-request caching
cache=request    request-level in-flight dedupe only
cache=resource   request dedupe + cached server resource results
cache=component  resource cache + cached component HTML fragments
cache=page       component cache + full page HTML cache

mode=stream      default; flush pending HTML, then stream resolved chunks
mode=wait        wait for all resources to resolve, then send full HTML
mode=fetch       fetch resource+template partial payloads from the browser

state=resolved   render the fulfilled async state
state=pending    render the pending boundary state
state=error      render the safe rejected/error state

segment=free     use free pricing
segment=pro      use pro pricing

delay=1000       default mock server resource latency
delays=1:1200,2:250,3:700
                 per-product latency for streaming inspection

runtime=iframe   use MiniWeb's iframe runtime boundary for the browser demo

ids=1,2,1,3      product IDs rendered by the page
clear=1          clear all in-memory caches before rendering
```

## More Details

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [SIGNALS.md](SIGNALS.md)
