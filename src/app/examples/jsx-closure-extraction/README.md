# JSX Closure Extraction

This example keeps the author source as normal TSX:

- `component.tsx` contains JSX, `useAsync(...)`, `server(...)`, and normal callback props.
- `closure-boundaries.json` stores accepted boundary intent with compiler evidence.
- `generated/` contains the same runtime files used by the other demos.

The server does not execute `component.tsx`. Generation parses it, validates the
manifest, and emits readable JavaScript files for the existing cache/runtime path.
