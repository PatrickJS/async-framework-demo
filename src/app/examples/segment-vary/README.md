# Segment Vary Example

This folder shows why cache keys need explicit vary data.

The generated model reads the segment key through `SegmentModel`, and `ProductModel` varies by that segment. The same product ID can render a different price for `free` and `pro`.

This example is here to make private/public cache-key reasoning visible.

