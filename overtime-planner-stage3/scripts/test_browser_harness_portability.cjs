'use strict';
// Harness boundary tests; no application logic or production data is loaded.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.join(__dirname, 'local-test-environment.cjs'), 'utf8');
const root = fs.realpathSync(path.resolve(__dirname, '..'));
const packageRoot = path.join(root, 'node_modules', 'playwright');
const executable = path.join(root, '.cache', 'ms-playwright', 'chromium-test', 'chrome');

function fixture(options = {}) {
  const calls = [], errors = [];
  const stop = { exitCode: null };
  const environment = { NODE_PATH: '/untrusted/global', PLAYWRIGHT_BROWSERS_PATH: '/untrusted/other-app', ...options.env };
  const api = { chromium: { executablePath: () => options.executable || executable } };
  const sandbox = {
    __dirname,
    module: { exports: {} },
    process: { env: environment, exit(code) { stop.exitCode = code; throw stop; } },
    console: { error(message) { errors.push(message); } },
    require(id) {
      calls.push(id);
      if (id === 'path') return path;
      if (id === 'fs') return {
        realpathSync(value) {
          if (value === packageRoot && options.missingPackage) throw new Error('child-local package missing');
          if (value === packageRoot && options.linkedPackage) return '/untrusted/other-app/node_modules/playwright';
          if (value === executable && options.linkedRuntime) return '/untrusted/other-app/chrome';
          return value;
        },
        existsSync: () => !options.missingRuntime,
      };
      assert.equal(id, packageRoot, 'Playwright must resolve using the child absolute package path');
      return api;
    },
  };
  vm.runInNewContext(source, sandbox, { filename: 'local-test-environment.cjs' });
  return { api, boundary: sandbox.module.exports, environment, calls, errors, stop };
}

const success = fixture();
assert.equal(success.boundary.repoRoot(), root);
assert.equal(success.boundary.loadPlaywright(), success.api);
assert.equal(success.environment.PLAYWRIGHT_BROWSERS_PATH, path.join(root, '.cache', 'ms-playwright'));
assert.deepEqual(success.calls, ['fs', 'path', packageRoot]);

for (const options of [
  { missingPackage: true },
  { linkedPackage: true },
  { linkedRuntime: true },
  { missingRuntime: true },
  { executable: '/untrusted/global/chrome' },
  { env: { HORTOPS_REPO_ROOT: path.resolve(root, '..') } },
]) {
  const probe = fixture(options);
  assert.throws(() => probe.boundary.loadPlaywright(), error => error === probe.stop);
  assert.equal(probe.stop.exitCode, 2, 'Unusable or external browser tooling must be BLOCKED, never passed');
  assert.match(probe.errors.join('\n'), /\[BLOCKED\]/);
}
console.log('[PASS] Overtime browser harness rejects ancestor/global packages, external roots and missing/external browser runtimes.');
