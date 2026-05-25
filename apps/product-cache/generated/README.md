# Generated Product Cache Files

This folder is the readable generated output for the product cache example.

- `server_segment.js` is the split vary-key server resource.
- `server_product.js` is the split product server resource.
- `component_model.js` is the readable model entrypoint that re-exports the split server files.
- `component_controller.js` represents the async edge. It maps component props to the server resource call.
- `component_template.js` represents the render symbol. It renders HTML from props, resource state, and resume context.

The generated files use readable names instead of generated hash names so the concept is easier to follow.
