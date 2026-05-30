# Component Partials Example

This folder shows the component-registry and partial-payload idea.

The app uses the same source/generated split as the product cache example, but defaults to client partial fetching. The partial response includes rendered HTML plus a resume context envelope so it is clear why a production framework partial cannot be just a raw string.

This example is here to explain fetchable component partials without claiming a full production serializer.
