#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyMiniWebAssets } from './copy-miniweb-assets.js';

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

await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

await copyTree(
  path.join(repoRoot, 'src', 'browser'),
  outputRoot,
  (relativePath) => {
    return (
      relativePath !== 'assets'
      && relativePath !== 'vendor'
      && !relativePath.startsWith('assets/')
      && !relativePath.startsWith('vendor/')
    );
  },
);
await copyTree(path.join(repoRoot, 'src', 'app'), path.join(outputRoot, 'app'));
await copyTree(path.join(repoRoot, 'src', 'framework'), path.join(outputRoot, 'framework'));

for (const file of [
  'ARCHITECTURE.md',
  'README.md',
  'SIGNALS.md',
  'LICENSE',
]) {
  await copyFile(path.join(repoRoot, file), path.join(outputRoot, file));
}

await copyMiniWebAssets(path.join(outputRoot, 'assets', 'miniweb'));

console.log(`built GitHub Pages artifact in ${path.relative(repoRoot, outputRoot)}`);
