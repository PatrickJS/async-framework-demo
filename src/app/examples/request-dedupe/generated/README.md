# Generated Request Dedupe Files

This generated folder uses the same readable model/controller/template split.

The interesting behavior lives in the framework cache runtime: every `ProductCardController` calls `ProductModel`, and repeated inputs can share a request-scoped in-flight promise.

