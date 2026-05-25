export const sourceConcept = 'server resource cache varies by segment server data';
export const generationSpec = {
  fallbackHeading: 'Loading product...',
  unavailableHeading: 'Pricing unavailable',
  titleField: 'title',
  priceField: 'price',
};

/*
Author-facing source sketch for segment-aware pricing.

export const getSegment = defineServerResource(async function () {
  return { plan: this.request.segment };
});

export const getProduct = defineServerResource(async function ({ productId }) {
  const segment = await getSegment();
  return db.products.priceFor(productId, segment.plan);
});

export const ProductCard = defineComponent((props) => {
  const product = useResource(getProduct, props);

  return <article>{product.value.price}</article>;
});
*/
