export const ROUTES = {
  gallery: '/',
  favicon: '/favicon.ico',
  productPartial: '/_async/partial/ProductCard',
  edgeSegmentPartial: '/_async/partial/edge-segment',
  browserBase: '',
  browserProjectBase: '/async-framework-demo',
  browserDebug: '/debug',
  browserReset: '/reset',
};

export const BROWSER_STATIC_ROUTES = new Set([
  '/architecture.html',
  '/backend-emulation.md',
  '/index.html',
  '/miniweb.js',
  '/registry.js',
  '/router.js',
  '/service-worker.js',
]);

export const appSlugFromPathname = (pathname) => {
  return pathname.replace(/^\/+/, '').split('/')[0] || null;
};

export const getBrowserDemoRoute = (pathname, basePath = ROUTES.browserBase) => {
  const projectBaseMarker = `${ROUTES.browserProjectBase}/`;

  if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
    return {
      basePath,
      localPath: pathname.slice(basePath.length) || '/',
    };
  }

  if (pathname === ROUTES.browserProjectBase || pathname.startsWith(projectBaseMarker)) {
    return {
      basePath: ROUTES.browserProjectBase,
      localPath: pathname.slice(ROUTES.browserProjectBase.length) || '/',
    };
  }

  return {
    basePath: '',
    localPath: pathname || '/',
  };
};

export const isBrowserStaticRoute = (localPath) => {
  return BROWSER_STATIC_ROUTES.has(localPath) || localPath.startsWith('/assets/');
};

export const isBrowserResetRoute = (url, localPath) => {
  return url.searchParams.get('nosw') === '1' || localPath === ROUTES.browserReset;
};
