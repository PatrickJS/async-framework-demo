#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createBoundaryInferenceRequest,
  parseProjectFiles,
  validateBoundaryManifestForProject,
} from '../src/compiler/closure-pipeline.js';
import { inferBoundaryManifestPatchWithOllama } from '../src/compiler/ollama-classifier.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appDir = path.join(repoRoot, 'src/app/examples/jsx-closure-extraction');
const runs = Math.max(1, Number(process.env.OLLAMA_RUNS ?? 3) || 3);
const project = parseProjectFiles(await readSourceFiles(appDir), appDir);
const request = createBoundaryInferenceRequest(project);
const results = [];

for (let index = 0; index < runs; index += 1) {
  const started = performance.now();
  const result = await inferBoundaryManifestPatchWithOllama(request);
  validateBoundaryManifestForProject(project, result.manifest);
  results.push({
    run: index + 1,
    model: result.model,
    wallMs: Number((performance.now() - started).toFixed(1)),
    promptTokensPerSecond: result.performance.promptTokensPerSecond,
    outputTokensPerSecond: result.performance.outputTokensPerSecond,
  });
}

console.log(JSON.stringify({
  runs,
  results,
  averageWallMs: average(results.map((result) => result.wallMs)),
  averagePromptTokensPerSecond: average(results.map((result) => result.promptTokensPerSecond)),
  averageOutputTokensPerSecond: average(results.map((result) => result.outputTokensPerSecond)),
}, null, 2));

async function readSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'generated') continue;
      files.push(...await readSourceFiles(fullPath));
    } else if (
      ['.tsx', '.jsx', '.ts', '.js'].includes(path.extname(entry.name))
      && entry.name !== 'app.js'
      && entry.name !== 'component.config.js'
    ) {
      files.push({
        filename: fullPath,
        source: await readFile(fullPath, 'utf8'),
      });
    }
  }

  return files.sort((left, right) => left.filename.localeCompare(right.filename));
}

function average(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;
  return Number((finite.reduce((sum, value) => sum + value, 0) / finite.length).toFixed(1));
}
