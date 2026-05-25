export const sourceConcept = 'private server data can choose pending SSR output';
export const generationSpec = {
  fallbackHeading: 'Loading private offer...',
  unavailableHeading: 'Private offer unavailable',
  titleField: 'title',
  priceField: 'price',
};

/*
Author-facing source sketch for a personalized component.

export const getPersonalizedProduct = defineServerResource(async function ({ productId }) {
  return db.products.privateOffer(productId, this.request.user);
});

export const ProductCard = defineComponent((props) => {
  const product = useResource(getPersonalizedProduct, props);

  return (
    <PendingBoundary fallback={<article>Loading private offer...</article>}>
      <article>{product.value.price}</article>
    </PendingBoundary>
  );
});
*/
