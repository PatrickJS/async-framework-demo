#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { optimizeApp } from './framework/simple-optimizer.mjs';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const appsDir = path.join(rootDir, 'apps');

const readAppDirs = async () => {
  const entries = await fs.readdir(appsDir, { withFileTypes: true });
  const dirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const appDir = path.join(appsDir, entry.name);
    try {
      await fs.access(path.join(appDir, 'component.js'));
      dirs.push(appDir);
    } catch {
      // Ignore helper folders.
    }
  }

  return dirs.sort();
};

const parseArgs = () => {
  const args = {
    app: null,
  };

  for (const arg of process.argv.slice(2)) {
    const [name, value] = arg.split('=');
    if (name === '--app') args.app = value;
  }

  return args;
};

const run = async () => {
  const args = parseArgs();
  const appDirs = await readAppDirs();
  const filtered = args.app
    ? appDirs.filter((dir) => path.basename(dir) === args.app)
    : appDirs;

  if (filtered.length === 0) {
    const target = args.app ? `app "${args.app}"` : 'apps';
    throw new Error(`No matching ${target} found under ${appsDir}`);
  }

  for (const appDir of filtered) {
    const result = await optimizeApp(appDir);
    console.log(`generated ${path.basename(result.appDir)} -> generated/{server_segment,server_product,component_model,component_controller,component_template}.js`);
  }
};

await run();
