// GENERATED FILE. Source: ../component.tsx
const PRODUCTS = {
  "1": {
    "title": "Parser Keyboard",
    "price": "$199",
    "proPrice": "$179"
  },
  "2": {
    "title": "Intent Mouse",
    "price": "$89",
    "proPrice": "$79"
  },
  "3": {
    "title": "Closure Monitor",
    "price": "$499",
    "proPrice": "$459"
  },
  "4": {
    "title": "Manifest Dock",
    "price": "$229",
    "proPrice": "$209"
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const ProductModel = async ({ productId }, context) => {
  await sleep(context.delayForProduct(productId));

  const product = PRODUCTS[productId] ?? {
    title: `Product ${productId}`,
    price: '$42',
    proPrice: '$39',
  };
  const segment = context.segment === 'pro' ? 'pro' : 'free';

  return {
    id: productId,
    title: product.title,
    price: segment === 'pro' ? product.proPrice : product.price,
    segment,
    loadedAt: new Date().toISOString(),
  };
};
