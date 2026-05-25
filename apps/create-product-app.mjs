export const createProductApp = ({
  slug,
  title,
  description,
  why,
  defaults = {},
  generatedBase,
}) => {
  const loadGenerated = (file) => () => import(new URL(`generated/${file}`, generatedBase));

  const manifestHash = `${slug}-cache-manifest-v1`;

  return {
    slug,
    title,
    description,
    why,
    defaults: {
      cache: 'none',
      storeName: 'redis',
      segment: 'free',
      asyncState: 'pending',
      ssrState: 'pending',
      renderMode: 'stream',
      delayMs: 1000,
      ids: ['1', '2', '1', '3'],
      delays: {},
      ...defaults,
    },

    page: {
      id: 'products',
      listTemplate: 'ProductListTemplate',
      cardTemplate: 'ProductCardTemplate',
      resourceName: 'product',
    },

    manifest: {
      manifestHash,

      defaults: {
        resources: {
          kind: 'resources',
          store: 'memory',
          scope: 'request',
          ttlMs: 60_000,
          dedupe: true,
        },

        components: {
          kind: 'components',
          store: 'memory',
          scope: 'private',
          ttlMs: 60_000,
        },

        pages: {
          kind: 'pages',
          store: 'memory',
          scope: 'private',
          ttlMs: 30_000,
        },
      },

      policies: {
        defaultResource: {
          kind: 'resources',
          tags: [`${slug}:resource`],
        },

        defaultComponent: {
          kind: 'components',
          tags: [`${slug}:component`],
        },

        defaultPage: {
          kind: 'pages',
          tags: [`${slug}:page`],
        },
      },

      resources: {
        SegmentModel: {
          id: 'server:getSegment',
          symbol: 'SegmentModel',
          policy: 'defaultResource',
          keyInputs: ['segment'],
          vary: [],
          generatedDefault: true,
        },

        ProductModel: {
          id: 'server:getProduct',
          symbol: 'ProductModel',
          policy: 'defaultResource',
          keyInputs: ['productId'],
          vary: ['SegmentModel'],
          generatedDefault: true,
        },
      },

      components: {
        ProductCardTemplate: {
          id: 'component:ProductCard',
          symbol: 'ProductCardTemplate',
          policy: 'defaultComponent',
          vary: ['SegmentModel'],
          ssrState: 'auto',
          suspenseStates: ['pending', 'resolved', 'rejected'],
          generatedDefault: true,
        },
      },

      pages: {
        products: {
          id: 'page:products',
          policy: 'defaultPage',
          vary: ['SegmentModel'],
        },
      },
    },

    registry: {
      resources: {
        SegmentModel: {
          id: 'server:getSegment',
          symbol: 'SegmentModel',
          optimized: true,
          policy: 'defaultResource',
          load: loadGenerated('server_segment.js'),
          exportName: 'SegmentModel',
        },

        ProductModel: {
          id: 'server:getProduct',
          symbol: 'ProductModel',
          optimized: true,
          policy: 'defaultResource',
          vary: ['SegmentModel'],
          load: loadGenerated('server_product.js'),
          exportName: 'ProductModel',
        },
      },

      asyncEdges: {
        ProductCardController: {
          id: 'async:ProductCard.product',
          symbol: 'ProductCardController',
          resource: 'ProductModel',
          load: loadGenerated('component_controller.js'),
          exportName: 'ProductCardController',
        },
      },

      components: {
        ProductCardTemplate: {
          id: 'component:ProductCard',
          symbol: 'ProductCardTemplate',
          optimized: true,
          policy: 'defaultComponent',
          vary: ['SegmentModel'],
          ssrState: 'auto',
          simple: true,
          load: loadGenerated('component_template.js'),
          exportName: 'ProductCardTemplate',
          asyncEdges: [
            {
              name: 'product',
              edge: 'ProductCardController',
            },
          ],
        },

        ProductListTemplate: {
          id: 'component:ProductList',
          symbol: 'ProductListTemplate',
          optimized: false,
          simple: true,
          load: loadGenerated('component_template.js'),
          exportName: 'ProductListTemplate',
          asyncEdges: [],
        },
      },
    },
  };
};
