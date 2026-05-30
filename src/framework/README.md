# Mini Framework

This folder contains the reusable runtime used by every demo app.

The framework is intentionally small and dependency-free. It loads a demo app registry, runs the generated model/controller/template files, applies cache policy, tracks request dedupe, and renders either blocking HTML, client-fetched partials, or out-of-order streaming.

The framework is here so the app folders can stay focused on the concept they demonstrate instead of repeating server and cache plumbing.

It also contains `simple-optimizer.js`, which turns app `component.js` metadata into readable generated files. The optimizer is called by `../app/generate.js`.
