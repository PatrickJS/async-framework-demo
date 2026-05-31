import { Suspense, server, useAsync, useSignal } from 'async-framework';

type Product = {
  id: string;
  title: string;
  price: string;
};

type ProductActionsProps = {
  onBuy: () => void;
};

function ProductActions({ onBuy }: ProductActionsProps) {
  return <button onClick={onBuy}>Buy now</button>;
}

type ProductCardProps = {
  product: Product;
  onSelect: () => void;
  onBuy: () => void;
};

function ProductCard({ product, onSelect, onBuy }: ProductCardProps) {
  const formattedPrice = useAsync(() => Promise.resolve(product.price));

  return (
    <Suspense fallback={<article>Loading product...</article>}>
      <article onClick={onSelect}>
        <h2>{product.title}</h2>
        <p>{formattedPrice.value}</p>
        <ProductActions onBuy={onBuy} />
      </article>
    </Suspense>
  );
}

type ProductSearchFormProps = {
  onSubmit: (event: SubmitEvent) => void;
};

function ProductSearchForm({ onSubmit }: ProductSearchFormProps) {
  return (
    <form onSubmit={onSubmit}>
      <input name="query" defaultValue="keyboard" />
      <button type="submit">Search</button>
    </form>
  );
}

const loadProducts = server(async function loadProducts() {
  return [
    { id: '1', title: 'Parser Keyboard', price: '$199' },
    { id: '2', title: 'Intent Mouse', price: '$89' },
  ];
});

export function ProductGallery() {
  const selectedProductId = useSignal('none');
  const purchasedProductId = useSignal('none');
  const submitted = useSignal(false);
  const products = useAsync(() => loadProducts());

  return (
    <main>
      <ProductSearchForm
        onSubmit={(event) => {
          event.preventDefault();
          submitted.value = true;
        }}
      />
      {products.value.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={() => {
            selectedProductId.value = product.id;
          }}
          onBuy={() => {
            purchasedProductId.value = product.id;
          }}
        />
      ))}
    </main>
  );
}
