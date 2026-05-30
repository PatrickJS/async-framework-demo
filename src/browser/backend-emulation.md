# GitHub Pages Backend Emulation

The GitHub Pages version is static, but the browser installs a service worker that handles demo routes from the site root with MiniWeb assets generated from the installed `@async/miniweb` package during the Pages build.

The worker is not a real shared backend. It is a browser-local MiniWeb backend emulator for the demo contract: query-driven pages, partial JSON endpoints, cache counters, resource delays, and stream-like replacement chunks.

By default the MiniWeb app runs in the same realm. Add `runtime=iframe` to a demo URL to run the MiniWeb app through its iframe runtime boundary; the page surfaces the selected mode in the execution metrics and the worker adds `x-async-framework-demo-miniweb-runtime`.

## Request Flow

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant Page as Browser page
  participant Pages as GitHub Pages static host
  participant SW as Service worker
  participant MiniWeb as MiniWeb route graph
  participant Runtime as Shared demo runtime
  participant Cache as Browser-local demo cache

  User->>Page: Open /
  Page->>Pages: GET /index.html
  Pages-->>Page: Static bootstrap HTML
  Page->>Pages: GET /service-worker.js
  Pages-->>Page: Worker module + static imports
  Page->>SW: register(scope: /)
  SW-->>Page: claim controlled pages

  User->>Page: Open /product-cache?cache=page
  Page->>SW: navigation request
  SW->>MiniWeb: web.fetch(request)
  MiniWeb->>Runtime: parse query + render route
  Runtime->>Cache: read/write resource, component, page cache entries
  Cache-->>Runtime: browser-local cache state
  Runtime-->>SW: HTML + metrics + replacement descriptors
  SW-->>Page: Response(text/html)

  Page->>SW: fetch /_async/partial/ProductCard
  SW->>MiniWeb: web.fetch(request)
  MiniWeb->>Runtime: render component partial payload
  Runtime-->>SW: JSON payload with HTML, data, context, template ref
  SW-->>Page: Response(application/json)

  Page->>SW: fetch /_async/partial/edge-segment
  SW-->>Page: edge-like JSON payload
```

## Route Decision

```mermaid
flowchart TD
  A["Request URL"] --> C{"Static worker asset?"}
  C -- "index.html, service-worker.js, miniweb.js, router.js, assets/*, docs" --> Z
  C -- "No" --> D{"Reset URL?"}
  D -- "/?nosw=1 or /reset" --> E["Return reset HTML that unregisters worker"]
  D -- "No" --> F{"Partial endpoint?"}
  F -- "ProductCard" --> G["Return component partial JSON"]
  F -- "edge-segment" --> H["Return edge segment JSON"]
  F -- "No" --> I{"Known demo slug?"}
  I -- "No" --> J["404"]
  I -- "Yes" --> K{"mode=stream?"}
  K -- "Yes" --> L["ReadableStream response with pending shell, then resolved chunks"]
  K -- "No" --> M["Full HTML response"]
```

## What Is Real vs Emulated

| Surface | Node server demo | GitHub Pages service-worker demo |
| --- | --- | --- |
| Static files | Served by Node | Served by GitHub Pages |
| Route handling | `src/server/node.js` | `src/browser/service-worker.js` -> `src/browser/miniweb.js` -> `src/browser/router.js` |
| Query-param rendering | Real server request | Worker navigation request |
| MiniWeb runtime mode | N/A | `same-realm` by default, `runtime=iframe` opt-in |
| In-memory cache | Node process memory | Browser service-worker memory |
| Partial endpoint | `/_async/partial/ProductCard` | `/_async/partial/ProductCard` |
| Edge endpoint | `/_async/partial/edge-segment` | `/_async/partial/edge-segment` |
| Delays | Node timers | Worker timers |
| Streaming | Node HTTP response stream | Worker `ReadableStream` response |
| Shared backend state | Yes, per Node process | No, per browser install |
| Deployment target | Node host | GitHub Pages |

## Static Deployment Shape

```mermaid
flowchart LR
  subgraph Repo["GitHub repo"]
    A["src/browser/index.html"]
    B["src/browser/service-worker.js"]
    C["src/browser/miniweb.js"]
    D["src/browser/router.js"]
    F["src/app/examples/*/generated/*.js"]
    RuntimeFiles["src/framework/*.js"]
  end

  subgraph Actions["GitHub Actions"]
    Install["npm ci"]
    Build["npm run build:pages"]
  end

  subgraph Pages["GitHub Pages"]
    PagesHost["Static asset hosting only"]
    E["assets/miniweb/*.js"]
  end

  subgraph Browser["User browser"]
    H["Service worker scope: site root"]
    I["Demo pages"]
    J["Browser-local cache state"]
  end

  Repo --> Actions
  Install --> Build
  Build --> Pages
  Pages --> Browser
  H --> I
  H --> J
```

## Why This Works For Demos

The server behavior is intentionally small and deterministic:

- parse query params
- render HTML from generated demo modules
- return two JSON partial endpoints
- keep simple cache state
- wait with timers to mimic resource latency
- stream replacement chunks in demo order

That maps cleanly to MiniWeb plus a service worker because the worker can pass a real `Request` through a browser-local route graph and return `Response` objects directly. The limitation is that the worker cannot prove multi-user backend behavior. It proves the demo route contract and the UI behavior on static hosting.

## Debugging Stale Workers

Use either path:

- `/debug` checks the installed controller, worker version, and partial endpoint responses.
- `/?nosw=1` unregisters the worker and clears demo caches.

When changing worker code, bump `DEMO_SW_VERSION` in `src/browser/router.js` so the debug page can show which worker version is active.
