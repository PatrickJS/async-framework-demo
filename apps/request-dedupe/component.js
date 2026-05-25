export const sourceConcept = 'duplicate component instances share one server resource request';
export const generationSpec = {
  fallbackHeading: 'Loading product...',
  unavailableHeading: 'Product unavailable',
  titleField: 'title',
  priceField: 'price',
};

/*
Author-facing source sketch for repeated component instances.

export const getProduct = defineServerResource(async function ({ productId }) {
  return db.products.get(productId);
});

export const ProductList = defineComponent((props) => {
  return props.ids.map((productId) => (
    <ProductCard productId={productId} />
  ));
});

export const ProductCard = defineComponent((props) => {
  const product = useResource(getProduct, props);
  return <article>{product.value.title}</article>;
});
*/
