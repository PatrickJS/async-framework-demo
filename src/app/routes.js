export const ROUTES = {
  gallery: '/',
  favicon: '/favicon.ico',
  productPartial: '/_async/partial/ProductCard',
  edgeSegmentPartial: '/_async/partial/edge-segment',
  browserBase: '/sw-demo',
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
  const basePathMarker = `${basePath}/`;

  if (pathname === basePath || pathname.endsWith(basePath)) {
    return {
      basePath: pathname,
      localPath: '/',
    };
  }

  const markerIndex = pathname.indexOf(basePathMarker);

  if (markerIndex === -1) return null;

  const resolvedBasePath = pathname.slice(0, markerIndex + basePath.length);

  return {
    basePath: resolvedBasePath,
    localPath: pathname.slice(resolvedBasePath.length) || '/',
  };
};

export const isBrowserStaticRoute = (localPath) => {
  return BROWSER_STATIC_ROUTES.has(localPath) || localPath.startsWith('/assets/');
};

export const isBrowserResetRoute = (url, localPath) => {
  return url.searchParams.get('nosw') === '1' || localPath === ROUTES.browserReset;
};
