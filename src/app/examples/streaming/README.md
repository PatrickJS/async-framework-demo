# Out-Of-Order Streaming Example

This folder shows the out-of-order streaming version of the same product card.

`component.js` stays normal and simple. The generated folder shows the same model/controller/template split, while the framework chooses `mode=stream` so pending cards can flush first and resolved chunks can stream later.

This example is here to make the difference between blocking SSR and out-of-order streaming visible.
