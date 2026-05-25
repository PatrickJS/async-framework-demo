# Request Dedupe Example

This folder shows request-level in-flight sharing.

The example intentionally renders duplicate product IDs. With request caching enabled, identical `ProductModel` calls share the same in-flight promise instead of starting duplicate server work.

This example is here to answer the "can we wait on the first request with the same signature?" question.

