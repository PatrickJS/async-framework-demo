export const sourceConcept = 'component + server resource + async resource + pending boundary';
export const generationSpec = {
  fallbackHeading: 'Loading product...',
  unavailableHeading: 'Product unavailable',
  titleField: 'title',
  priceField: 'price',
};

/*
Author-facing source sketch.
The demo server does not run this source directly; it runs the generated files beside it.

export const getProduct = defineServerResource(async function ({ productId }) {
  return db.products.get(productId);
});

export const ProductCard = defineComponent((props) => {
  const product = useResource(getProduct, props);
  const selected = createSignal(false);

  createEffect(() => {
    product.value.title;
    selected.value;
  });

  return (
    <PendingBoundary fallback={<article>Loading product...</article>}>
      <article>
        <h2>{product.value.title}</h2>
        <p>{product.value.price}</p>
        <button onClick={() => selected.value = !selected.value}>
          Toggle
        </button>
      </article>
    </PendingBoundary>
  );
});
*/
