#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createBoundaryInferenceRequest,
  decisionToManifest,
  discoverExtractableClosuresInProject,
  parseProjectFiles,
  validateBoundaryManifestForProject,
} from '../src/compiler/closure-pipeline.js';
import {
  SCENARIOS,
  boundaryLabels,
  evaluateScenario,
  expectedBoundaryEntries,
  expectedUnknownEntries,
  scenarioResultSummary,
} from '../src/compiler/scenario-suite.js';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const jsxExampleDir = path.join(repoRoot, 'src/app/examples/jsx-closure-extraction');

await testCanonicalJsxExample();
testScenarioSuite();
testModelDecisionValidation();

console.log('closure tests passed');

async function testCanonicalJsxExample() {
  const files = await readSourceFiles(jsxExampleDir);
  const project = parseProjectFiles(files, jsxExampleDir);
  const request = createBoundaryInferenceRequest(project);
  const source = files.map((file) => file.source).join('\n');
  const manifest = JSON.parse(await readFile(path.join(jsxExampleDir, 'closure-boundaries.json'), 'utf8'));

  assert.equal(manifest.schemaVersion, 1);
  assert.match(source, /useAsync\(/);
  assert.match(source, /<Suspense/);
  assert.match(source, /server\(/);
  assert.equal(source.includes('QRL'), false);
  assert.equal(source.includes('qrl('), false);
  assert.equal(source.includes('useAsync$'), false);
  assert.equal(source.includes('server$'), false);
  assert.equal(source.includes('onClick$'), false);

  assertClosureSite(request, 'ProductCard', 'onSelect', 'selectedProductId.value = product.id');
  assertClosureSite(request, 'ProductCard', 'onBuy', 'purchasedProductId.value = product.id');
  assertClosureSite(request, 'ProductSearchForm', 'onSubmit', 'event.preventDefault()');

  assertForwardingEdge(request, {
    component: 'ProductCard',
    prop: 'onSelect',
    targetTag: 'article',
    targetProp: 'onClick',
    targetKind: 'host',
  });
  assertForwardingEdge(request, {
    component: 'ProductCard',
    prop: 'onBuy',
    targetTag: 'ProductActions',
    targetProp: 'onBuy',
    targetKind: 'component',
  });
  assertForwardingEdge(request, {
    component: 'ProductActions',
    prop: 'onBuy',
    targetTag: 'button',
    targetProp: 'onClick',
    targetKind: 'host',
  });
  assertForwardingEdge(request, {
    component: 'ProductSearchForm',
    prop: 'onSubmit',
    targetTag: 'form',
    targetProp: 'onSubmit',
    targetKind: 'host',
  });

  const validation = validateBoundaryManifestForProject(project, manifest);
  assert.deepEqual(validation.accepted, [
    { component: 'ProductActions', prop: 'onBuy', kind: 'event' },
    { component: 'ProductCard', prop: 'onBuy', kind: 'event' },
    { component: 'ProductCard', prop: 'onSelect', kind: 'event' },
    { component: 'ProductSearchForm', prop: 'onSubmit', kind: 'event' },
  ]);
  assert.deepEqual(manifest.components.ProductCard.evidence.onBuy, [
    'ProductCard.onBuy',
    'ProductActions.onBuy',
    'button.onClick',
  ]);

  assert.throws(() => {
    validateBoundaryManifestForProject(project, {
      schemaVersion: 1,
      components: {
        ProductCard: {
          props: {
            onMissing: 'event',
          },
          evidence: {
            onMissing: ['ProductCard.onMissing', 'button.onClick'],
          },
        },
      },
    });
  }, /does not have compiler evidence/);

  const closures = discoverExtractableClosuresInProject(project, manifest);
  assertClosureReport(closures, 'ProductCard.onSelect', 'selectedProductId.value = product.id');
  assertClosureReport(closures, 'ProductCard.onBuy', 'purchasedProductId.value = product.id');
  assertClosureReport(closures, 'ProductSearchForm.onSubmit', 'event.preventDefault()');
  assert.equal(closures.length, 3);
}

function testScenarioSuite() {
  assert.equal(SCENARIOS.length, 20);

  const summaries = SCENARIOS.map((scenario) => {
    const result = evaluateScenario(scenario);
    assert.deepEqual(boundaryLabels(result.actualBoundaries), result.expectedBoundaries, `${scenario.id} boundaries`);
    assert.deepEqual(result.actualExtractableClosures, result.expectedExtractableClosures, `${scenario.id} closures`);
    assert.deepEqual(result.actualUnknowns, result.expectedUnknowns, `${scenario.id} unknowns`);
    for (const boundary of result.actualBoundaries) {
      assert.equal(boundary.evidence[0], `${boundary.component}.${boundary.prop}`);
      assert.match(boundary.evidence.at(-1), /^[a-z][A-Za-z0-9]*\.on[A-Z]/);
    }
    return scenarioResultSummary(result);
  });

  assert.equal(summaries.filter((summary) => summary.expectedBoundaryCount > 0).length, 16);
  assert.equal(summaries.filter((summary) => summary.category === 'negative').length, 2);
  assert.equal(summaries.filter((summary) => summary.category === 'ambiguous').length, 2);
  assert.equal(expectedBoundaryEntries(SCENARIOS).length, 27);
  assert.equal(expectedUnknownEntries(SCENARIOS).length, 5);
  assert.equal(
    summaries.reduce((sum, summary) => sum + summary.expectedExtractableClosureCount, 0),
    21,
  );

  const twoHop = evaluateScenario(SCENARIOS.find((scenario) => scenario.id === '07-two-hop-forwarding'));
  assert.deepEqual(
    twoHop.actualBoundaries.find((boundary) => boundary.component === 'ActionPanel').evidence,
    ['ActionPanel.onAction', 'ActionButton.onTrigger', 'button.onClick'],
  );
}

function testModelDecisionValidation() {
  const request = {
    condensedAst: {
      propForwardingEdges: [
        {
          component: 'Button',
          prop: 'onPress',
          targetKind: 'host',
          targetTag: 'button',
          targetProp: 'onClick',
        },
        {
          component: 'Toolbar',
          prop: 'onSave',
          targetKind: 'component',
          targetComponent: 'Button',
          targetTag: 'Button',
          targetProp: 'onPress',
        },
      ],
    },
  };

  assert.deepEqual(
    decisionToManifest({
      decision: 'add_to_whitelist',
      manifestPatch: {
        components: [
          { component: 'Button', prop: 'onPress', kind: 'event' },
          { component: 'Toolbar', prop: 'onSave', kind: 'event' },
          { component: 'Toolbar', prop: 'onMissing', kind: 'event' },
        ],
      },
    }, request),
    {
      schemaVersion: 1,
      components: {
        Button: {
          props: { onPress: 'event' },
          evidence: { onPress: ['Button.onPress', 'button.onClick'] },
        },
        Toolbar: {
          props: { onSave: 'event' },
          evidence: { onSave: ['Toolbar.onSave', 'Button.onPress', 'button.onClick'] },
        },
      },
    },
  );
}

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

function assertClosureSite(request, targetComponent, prop, sourceSnippet) {
  const closure = request.condensedAst.closureSites.find((site) => {
    return site.targetComponent === targetComponent && site.prop === prop;
  });
  assert(closure, `expected closure site for ${targetComponent}.${prop}`);
  assert.match(closure.source, new RegExp(escapeRegExp(sourceSnippet)));
}

function assertForwardingEdge(request, expected) {
  const edge = request.condensedAst.propForwardingEdges.find((candidate) => {
    return Object.entries(expected).every(([key, value]) => candidate[key] === value);
  });
  assert(edge, `expected forwarding edge ${JSON.stringify(expected)}`);
}

function assertClosureReport(closures, target, sourceSnippet) {
  const closure = closures.find((candidate) => candidate.target === target);
  assert(closure, `expected extractable closure for ${target}`);
  assert.match(closure.source, new RegExp(escapeRegExp(sourceSnippet)));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
