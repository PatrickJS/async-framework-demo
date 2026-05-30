export const sourceConcept = 'same component source, different streaming runtime mode';
export const generationSpec = {
  fallbackHeading: 'Loading product...',
  unavailableHeading: 'Product unavailable',
  titleField: 'title',
  priceField: 'price',
};

/*
Author-facing source sketch for the streaming example.
The important authoring detail is still just server data + pending boundary.

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
