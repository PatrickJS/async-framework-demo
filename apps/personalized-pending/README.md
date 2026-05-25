# Personalized Pending Example

This folder shows the `ssr=pending` policy idea.

The component can render a safe pending shell during SSR while private data resolves later through a controlled path. That is useful when personalized data should not be embedded into shared HTML.

This example is here to separate fast shell rendering from private user-specific data.

