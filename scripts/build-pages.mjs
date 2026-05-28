#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyMiniWebAssets } from './copy-miniweb-assets.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const outputRoot = path.join(repoRoot, 'dist-pages');

const copyTree = async (sourceRoot, targetRoot, filter = () => true) => {
  await fs.mkdir(targetRoot, { recursive: true });

  for (const entry of await fs.readdir(sourceRoot, { withFileTypes: true })) {
    const sourcePath = path.join(sourceRoot, entry.name);
    const relativePath = path.relative(sourceRoot, sourcePath);
    const targetPath = path.join(targetRoot, entry.name);

    if (!filter(relativePath, entry)) continue;

    if (entry.isDirectory()) {
      await copyTree(sourcePath, targetPath, (childRelativePath, childEntry) => {
        return filter(path.join(relativePath, childRelativePath), childEntry);
      });
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
};

const copyFile = async (source, target) => {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
};

const rootIndexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0; url=./sw-demo/">
    <title>Async Framework Demo</title>
  </head>
  <body>
    <p><a href="./sw-demo/">Open Async Framework Demo</a></p>
  </body>
</html>
`;

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

await copyTree(
  path.join(repoRoot, 'sw-demo'),
  path.join(outputRoot, 'sw-demo'),
  (relativePath) => {
    return (
      relativePath !== 'assets'
      && relativePath !== 'vendor'
      && !relativePath.startsWith('assets/')
      && !relativePath.startsWith('vendor/')
    );
  },
);
await copyTree(path.join(repoRoot, 'apps'), path.join(outputRoot, 'apps'));
await copyTree(path.join(repoRoot, 'framework'), path.join(outputRoot, 'framework'));

for (const file of [
  'ARCHITECTURE.md',
  'README.md',
  'SIGNALS.md',
  'LICENSE',
  'cache-config.server.mjs',
  'registry.mjs',
]) {
  await copyFile(path.join(repoRoot, file), path.join(outputRoot, file));
}

await fs.writeFile(path.join(outputRoot, 'index.html'), rootIndexHtml);
await copyMiniWebAssets(path.join(outputRoot, 'sw-demo', 'assets', 'miniweb'));

console.log(`built GitHub Pages artifact in ${path.relative(repoRoot, outputRoot)}`);
