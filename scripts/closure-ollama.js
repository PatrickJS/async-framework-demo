#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createBoundaryInferenceRequest,
  parseProjectFiles,
  stableJson,
  validateBoundaryManifestForProject,
} from '../src/compiler/closure-pipeline.js';
import { inferBoundaryManifestPatchWithOllama } from '../src/compiler/ollama-classifier.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appDir = path.join(repoRoot, 'src/app/examples/jsx-closure-extraction');
const project = parseProjectFiles(await readSourceFiles(appDir), appDir);
const request = createBoundaryInferenceRequest(project);
const result = await inferBoundaryManifestPatchWithOllama(request);

validateBoundaryManifestForProject(project, result.manifest);

console.log('ollama markerless closure proposal');
console.log(`model: ${result.model}`);
console.log(`decision: ${result.decision.decision}`);
console.log(`confidence: ${result.decision.confidence}`);
console.log(`reason: ${result.decision.reason}`);
console.log(`prompt tokens/sec: ${result.performance.promptTokensPerSecond ?? 'n/a'}`);
console.log(`output tokens/sec: ${result.performance.outputTokensPerSecond ?? 'n/a'}`);
console.log('');
console.log(stableJson(result.manifest));

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
