#!/usr/bin/env node
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const DEFAULT_PORT = 4328;

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/plain; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
]);

const parsePort = () => {
  const arg = process.argv.find((value) => value.startsWith('--port='));

  if (!arg) return Number(process.env.PORT || DEFAULT_PORT);

  return Number(arg.slice('--port='.length)) || DEFAULT_PORT;
};

const browserStaticFiles = new Set([
  '/architecture.html',
  '/backend-emulation.md',
  '/index.html',
  '/miniweb.js',
  '/registry.js',
  '/router.js',
  '/service-worker.js',
]);

const sourcePathnameFor = (pathname) => {
  const projectPrefix = '/async-framework-demo';

  if (pathname === '/') return '/src/browser/index.html';

  if (pathname === projectPrefix || pathname === `${projectPrefix}/`) {
    return '/src/browser/index.html';
  }

  if (pathname.startsWith(`${projectPrefix}/`)) {
    const localPath = pathname.slice(projectPrefix.length);

    if (localPath.startsWith('/app/')) return `/src${localPath}`;
    if (localPath.startsWith('/framework/')) return `/src${localPath}`;

    if (browserStaticFiles.has(localPath) || localPath.startsWith('/assets/')) {
      return `/src/browser${localPath}`;
    }

    return '/src/browser/index.html';
  }

  if (browserStaticFiles.has(pathname) || pathname.startsWith('/assets/')) {
    return `/src/browser${pathname}`;
  }

  if (pathname.startsWith('/app/')) return `/src${pathname}`;
  if (pathname.startsWith('/framework/')) return `/src${pathname}`;

  return pathname;
};

const resolveFilePath = async (urlPathname) => {
  const pathname = decodeURIComponent(urlPathname);
  const sourcePathname = sourcePathnameFor(pathname);
  const requested = sourcePathname.endsWith('/')
    ? path.join(sourcePathname, 'index.html')
    : sourcePathname;
  let filePath = path.resolve(repoRoot, `.${requested}`);

  if (!filePath.startsWith(repoRoot)) return null;

  try {
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    await fs.access(filePath);
    return filePath;
  } catch {
    if (!pathname.startsWith('/app/') && !pathname.startsWith('/framework/') && !pathname.startsWith('/assets/')) {
      return path.join(repoRoot, 'src', 'browser', 'index.html');
    }

    return null;
  }
};

const port = parsePort();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`);
  const filePath = await resolveFilePath(url.pathname);

  if (!filePath) {
    res.writeHead(404, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end('Not found');
    return;
  }

  const extension = path.extname(filePath);
  const body = await fs.readFile(filePath);

  res.writeHead(200, {
    'content-type': mimeTypes.get(extension) ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(body);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`static demo server running at http://127.0.0.1:${port}/`);
});
