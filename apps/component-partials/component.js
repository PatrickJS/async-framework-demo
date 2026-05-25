export const sourceConcept = 'fetchable component partial with HTML plus context';
export const generationSpec = {
  fallbackHeading: 'Loading product...',
  unavailableHeading: 'Product unavailable',
  titleField: 'title',
  priceField: 'price',
};

/*
Author-facing source sketch for a fetchable component partial.

export const getProduct = defineServerResource(async function ({ productId }) {
  return db.products.get(productId);
});

export const ProductCard = defineComponent((props) => {
  const product = useResource(getProduct, props);

  return (
    <PendingBoundary fallback={<article>Loading product...</article>}>
      <article>
        <h2>{product.value.title}</h2>
        <p>{product.value.price}</p>
      </article>
    </PendingBoundary>
  );
});
*/
