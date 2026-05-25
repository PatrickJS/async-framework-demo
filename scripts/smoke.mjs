#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const runJson = (args) => {
  const result = spawnSync('node', ['server.mjs', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: node server.mjs ${args.join(' ')}\n${result.stderr || result.stdout}`);
  }

  return JSON.parse(result.stdout);
};

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const streamResult = runJson([
  '--once',
  '--app=product-cache',
  '--cache=request',
  '--mode=stream',
  '--ids=1,2,1,3',
  '--runs=1',
  '--clear=1',
]);

assert(streamResult.renderMode === 'stream', 'expected stream render mode');
assert(streamResult.metrics.requestDedupeHits >= 1, 'expected request dedupe in stream smoke');
assert(streamResult.metrics.pendingStateExecutions > 0, 'expected pending state renders in stream smoke');

const waitResult = runJson([
  '--once',
  '--app=product-cache',
  '--cache=request',
  '--mode=wait',
  '--ids=1,2,1,3',
  '--runs=1',
  '--clear=1',
]);

assert(waitResult.renderMode === 'wait', 'expected wait render mode');
assert(waitResult.metrics.blockingResources > 0, 'expected blocking resources in wait smoke');

const port = 4327;
const server = spawn('node', ['server.mjs', `--port=${port}`], {
  cwd: repoRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
let errorOutput = '';
server.stdout.on('data', (chunk) => {
  output += chunk;
});
server.stderr.on('data', (chunk) => {
  errorOutput += chunk;
});

const waitForServer = async () => {
  const started = Date.now();

  while (!output.includes(`http://127.0.0.1:${port}/`)) {
    if (Date.now() - started > 5000) {
      throw new Error(`server did not start\n${output}\n${errorOutput}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }
};

try {
  await waitForServer();

  const url = new URL(`http://127.0.0.1:${port}/_async/partial/ProductCard`);
  url.searchParams.set('app', 'component-partials');
  url.searchParams.set('id', 'pending-ProductCardTemplate-1');
  url.searchParams.set('productId', '1');
  url.searchParams.set('cache', 'request');
  url.searchParams.set('store', 'memory');
  url.searchParams.set('segment', 'free');
  url.searchParams.set('delay', '0');

  const response = await fetch(url);
  assert(response.ok, `partial response failed with ${response.status}`);

  const payload = await response.json();
  assert(payload.type === 'component-partial', 'expected component partial payload');
  assert(typeof payload.html === 'string' && payload.html.includes('product-card'), 'expected partial HTML');
  assert(payload.context?.component === 'ProductCardTemplate', 'expected resume context');
  assert(payload.template?.kind === 'component-render-symbol', 'expected template reference');

  console.log('smoke checks passed');
} finally {
  server.kill('SIGTERM');
}
