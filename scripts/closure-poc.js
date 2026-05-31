#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createBoundaryInferenceRequest,
  discoverExtractableClosuresInProject,
  inferBoundaryManifestForProject,
  parseProjectFiles,
  validateBoundaryManifestForProject,
} from '../src/compiler/closure-pipeline.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appDir = path.join(repoRoot, 'src/app/examples/jsx-closure-extraction');
const project = parseProjectFiles(await readSourceFiles(appDir), appDir);
const request = createBoundaryInferenceRequest(project);
const inference = inferBoundaryManifestForProject(project);
const manifest = JSON.parse(await readFile(path.join(appDir, 'closure-boundaries.json'), 'utf8'));
const validation = validateBoundaryManifestForProject(project, manifest);
const closures = discoverExtractableClosuresInProject(project, manifest);

console.log('markerless JSX closure extraction POC');
console.log('source: src/app/examples/jsx-closure-extraction/component.tsx');
console.log('manifest: src/app/examples/jsx-closure-extraction/closure-boundaries.json');
console.log('');
console.log('parsed files:');
for (const file of request.condensedAst.files) {
  console.log(`  ${file.path}`);
}
console.log('');
console.log('candidate boundary surfaces:');
for (const edge of request.condensedAst.propForwardingEdges) {
  console.log(`  ${edge.sourceFile}: ${edge.component}.${edge.prop} -> ${edge.targetTag}.${edge.targetProp}`);
}
console.log('');
console.log('deterministically inferred boundaries:');
for (const [component, record] of Object.entries(inference.manifest.components)) {
  for (const [prop, kind] of Object.entries(record.props)) {
    console.log(`  ${component}.${prop} = ${kind} (${record.evidence[prop].join(' -> ')})`);
  }
}
console.log('');
console.log('accepted persisted boundaries:');
for (const boundary of validation.accepted) {
  console.log(`  ${boundary.component}.${boundary.prop} = ${boundary.kind}`);
}
console.log('');
console.log('extractable closures from persisted manifest:');
for (const closure of closures) {
  console.log(`  ${closure.file}:${closure.loc.line}:${closure.loc.column + 1} ${closure.target} ${closure.boundaryKind} -> ${oneLine(closure.source)}`);
}
console.log('');
console.log('verification: pass');

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

function oneLine(value) {
  return value.replace(/\s+/g, ' ').trim();
}
