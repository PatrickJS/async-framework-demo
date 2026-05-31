# Compiler Layer

This folder contains code that reads author source and emits runtime files.

## Files

```txt
closure-pipeline.js
  TSX/JSX fact extraction, prop-forwarding graph construction, closure
  discovery, manifest creation, and manifest validation.

scenario-suite.js
  Deterministic markerless closure extraction scenarios.

ollama-classifier.js
  Optional local Ollama manifest proposal workflow. Normal generation does not
  depend on model output.

simple-optimizer.js
  Emits the readable generated files consumed by the framework runtime.
```

Keep runtime behavior in `src/framework/`. Compiler code may inspect author
source, manifests, and examples, but generated files remain the runtime contract.
