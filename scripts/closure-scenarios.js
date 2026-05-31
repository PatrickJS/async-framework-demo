#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  SCENARIOS,
  boundaryLabels,
  evaluateScenario,
  expectedBoundaryEntries,
  expectedUnknownEntries,
  scenarioResultSummary,
} from '../src/compiler/scenario-suite.js';

const summaries = SCENARIOS.map((scenario) => {
  const result = evaluateScenario(scenario);
  assert.deepEqual(boundaryLabels(result.actualBoundaries), result.expectedBoundaries, `${scenario.id} boundaries`);
  assert.deepEqual(result.actualExtractableClosures, result.expectedExtractableClosures, `${scenario.id} closures`);
  assert.deepEqual(result.actualUnknowns, result.expectedUnknowns, `${scenario.id} unknowns`);
  return scenarioResultSummary(result);
});

console.log('markerless closure scenario suite');
console.log(`scenarios: ${SCENARIOS.length}`);
console.log(`expected boundaries: ${expectedBoundaryEntries(SCENARIOS).length}`);
console.log(`expected unknowns: ${expectedUnknownEntries(SCENARIOS).length}`);
console.log(`positive scenarios: ${summaries.filter((summary) => summary.expectedBoundaryCount > 0).length}`);
console.log(`negative scenarios: ${summaries.filter((summary) => summary.category === 'negative').length}`);
console.log(`ambiguous scenarios: ${summaries.filter((summary) => summary.category === 'ambiguous').length}`);
console.log('verification: pass');
