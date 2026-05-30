# Node Server Adapter

This folder contains the local Node.js HTTP entrypoint for the demo.

## Files

```txt
node.js
  Starts the loopback server, parses query options, and maps HTTP requests onto
  the shared app and framework runtime.
```

The server is intentionally thin. Shared route constants live in
`src/app/routes.js`; rendering, cache behavior, streaming helpers, and partial
payloads live in `src/framework/`.
