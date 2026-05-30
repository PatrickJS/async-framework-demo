#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const miniWebSourceRoot = path.join(repoRoot, 'node_modules', '@async', 'miniweb', 'dist');

const copyJsFiles = async (sourceDir, targetDir) => {
  await fs.mkdir(targetDir, { recursive: true });

  for (const entry of await fs.readdir(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyJsFiles(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.js')) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
};

export const copyMiniWebAssets = async (targetRoot) => {
  await fs.rm(targetRoot, { recursive: true, force: true });
  await fs.mkdir(targetRoot, { recursive: true });
  await fs.copyFile(path.join(miniWebSourceRoot, 'index.js'), path.join(targetRoot, 'index.js'));
  await copyJsFiles(path.join(miniWebSourceRoot, 'core'), path.join(targetRoot, 'core'));
};

const defaultTarget = path.join(repoRoot, 'src', 'browser', 'assets', 'miniweb');
const targetArg = process.argv.find((value) => value.startsWith('--target='));
const targetRoot = targetArg
  ? path.resolve(repoRoot, targetArg.slice('--target='.length))
  : defaultTarget;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await copyMiniWebAssets(targetRoot);
  console.log(`copied @async/miniweb static assets to ${path.relative(repoRoot, targetRoot)}`);
}
