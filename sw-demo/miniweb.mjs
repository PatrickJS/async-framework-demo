import {
  createMiniWeb,
  createMiniWebApp,
  middleware,
  toApp,
} from './assets/miniweb/index.js';
import { getDemoRoute, handleDemoRequest } from './router.mjs';

const staticWorkerAssets = new Set([
  '/architecture.html',
  '/backend-emulation.md',
  '/index.html',
  '/miniweb.mjs',
  '/registry.mjs',
  '/router.mjs',
  '/service-worker.mjs',
]);

const miniWebByOrigin = new Map();
const MINIWEB_RUNTIME_MODES = new Set(['same-realm', 'iframe']);

const isStaticWorkerAsset = (localPath) => {
  return staticWorkerAssets.has(localPath) || localPath.startsWith('/assets/');
};

const shouldHandleWithMiniWeb = (request) => {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  const localPath = getDemoRoute(url.pathname)?.localPath;

  return Boolean(localPath && !isStaticWorkerAsset(localPath));
};

const normalizeMiniWebRuntimeMode = (value) => {
  return MINIWEB_RUNTIME_MODES.has(value) ? value : 'same-realm';
};

const runtimeModeForRequest = (request) => {
  return normalizeMiniWebRuntimeMode(new URL(request.url).searchParams.get('runtime'));
};

const markMiniWebRuntime = (response, mode) => {
  const headers = new Headers(response.headers);
  headers.set('x-async-framework-demo-runtime', 'miniweb-service-worker');
  headers.set('x-async-framework-demo-miniweb-runtime', mode);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const createDemoFetchApp = () => {
  return {
    async fetch(request, _env, context) {
      const response = await handleDemoRequest(request);

      if (!response) {
        return new Response('Not found', {
          status: 404,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-store',
          },
        });
      }

      return markMiniWebRuntime(response, context.environment.execution.mode);
    },
  };
};

const createDemoMiniWeb = async (origin, basePath, runtimeMode) => {
  const app = createMiniWebApp({
    origin,
    apps: {
      demo: {
        app: createDemoFetchApp(),
        basePath: `${basePath}/`,
        runtime: 'demo',
      },
    },
    runtimes: {
      demo: runtimeMode === 'iframe'
        ? {
            mode: 'iframe',
            sandbox: 'allow-scripts',
          }
        : {
            mode: 'same-realm',
          },
    },
    routes: [
      middleware((request) => shouldHandleWithMiniWeb(request), toApp('demo')),
    ],
  });

  return createMiniWeb(app);
};

const getDemoMiniWeb = async (origin, basePath, runtimeMode) => {
  const key = `${origin}:${basePath}:${runtimeMode}`;

  if (!miniWebByOrigin.has(key)) {
    miniWebByOrigin.set(key, createDemoMiniWeb(origin, basePath, runtimeMode));
  }

  return miniWebByOrigin.get(key);
};

export const handleMiniWebDemoRequest = async (request) => {
  if (!shouldHandleWithMiniWeb(request)) return null;

  const url = new URL(request.url);
  const route = getDemoRoute(url.pathname);
  const runtimeMode = runtimeModeForRequest(request);
  const web = await getDemoMiniWeb(url.origin, route.basePath, runtimeMode);

  return web.fetch(request);
};
