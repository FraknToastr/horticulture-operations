'use strict';

// Review 39 replacement for scripts/test_runner_contract.cjs.
// Required production design: scripts/release_runner_core.cjs exports:
//   DEFAULT_SUITES
//   MANDATORY_SUITE_IDS
//   validateManifest(suites, options)
//   evaluateReleaseOutcome(input)
//
// Exact exit semantics:
//   0 = complete mandatory inventory and all PASSED
//   1 = at least one executed mandatory suite FAILED
//   2 = at least one mandatory suite BLOCKED, no FAILED
//   3 = manifest / runner integrity error

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = process.env.HORTOPS_REPO_ROOT
  ? path.resolve(process.env.HORTOPS_REPO_ROOT)
  : path.resolve(__dirname, '..');

const corePath = path.join(root, 'scripts', 'release_runner_core.cjs');
assert.ok(fs.existsSync(corePath), 'Review 39 requires scripts/release_runner_core.cjs');

const core = require(corePath);

for (const name of ['DEFAULT_SUITES', 'MANDATORY_SUITE_IDS', 'validateManifest', 'evaluateReleaseOutcome']) {
  assert.ok(core[name] !== undefined, `release_runner_core.cjs must export ${name}`);
}
assert.ok(Array.isArray(core.DEFAULT_SUITES), 'DEFAULT_SUITES must be an array');
assert.ok(Array.isArray(core.MANDATORY_SUITE_IDS), 'MANDATORY_SUITE_IDS must be an array');
assert.strictEqual(typeof core.validateManifest, 'function');
assert.strictEqual(typeof core.evaluateReleaseOutcome, 'function');

function validate(suites, requiredIds) {
  return core.validateManifest(suites, {
    requiredSuiteIds: requiredIds,
    scriptsRoot: path.join(root, 'scripts')
  });
}

function outcome(validation, results, expectedCount) {
  return core.evaluateReleaseOutcome({
    manifestValidation: validation,
    results: results || [],
    expectedSuiteCount: expectedCount
  });
}

function expectInvalidExit3(suites, requiredIds, message) {
  const validation = validate(suites, requiredIds);
  assert.strictEqual(validation.valid, false, message + ': manifest must be invalid');
  const evaluated = outcome(validation, [], suites.length);
  assert.strictEqual(evaluated.exitCode, 3, message + ': invalid manifest must map to exit 3');
  assert.ok(
    String(evaluated.status || evaluated.reason || '').toUpperCase().indexOf('INCOMPLETE') !== -1 ||
    String(evaluated.status || evaluated.reason || '').toUpperCase().indexOf('INTEGRITY') !== -1 ||
    String(evaluated.status || evaluated.reason || '').toUpperCase().indexOf('MANIFEST') !== -1,
    message + ': result must identify manifest/runner integrity failure'
  );
}

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('B01/R39-T13: mandatory BLOCKED suite -> exact exit 2', () => {
  const required = ['a', 'b'];
  const suites = [
    { id: 'a', name: 'A', script: 'test_gate_b1.cjs', stage: 'Stage 1 Retained' },
    { id: 'b', name: 'B', script: 'test_stage2_browser_smoke.cjs', stage: 'Stage 2 Acceptance', browser: true }
  ];
  const validation = validate(suites, required);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors || []));
  const evaluated = outcome(validation, [
    { id: 'a', status: 'PASSED' },
    { id: 'b', status: 'BLOCKED' }
  ], 2);
  assert.strictEqual(evaluated.exitCode, 2);
});

test('B02/R39-T14: mandatory FAILED suite -> exact exit 1', () => {
  const required = ['a', 'b'];
  const suites = [
    { id: 'a', name: 'A', script: 'test_gate_b1.cjs', stage: 'Stage 1 Retained' },
    { id: 'b', name: 'B', script: 'test_stage2_workspace_contract.cjs', stage: 'Stage 2 Acceptance' }
  ];
  const validation = validate(suites, required);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors || []));
  const evaluated = outcome(validation, [
    { id: 'a', status: 'PASSED' },
    { id: 'b', status: 'FAILED' }
  ], 2);
  assert.strictEqual(evaluated.exitCode, 1);
});

test('B03: complete valid manifest + all PASSED -> exact exit 0', () => {
  const required = ['a', 'b'];
  const suites = [
    { id: 'a', name: 'A', script: 'test_gate_b1.cjs', stage: 'Stage 1 Retained' },
    { id: 'b', name: 'B', script: 'test_stage2_workspace_contract.cjs', stage: 'Stage 2 Acceptance' }
  ];
  const validation = validate(suites, required);
  assert.strictEqual(validation.valid, true, JSON.stringify(validation.errors || []));
  const evaluated = outcome(validation, [
    { id: 'a', status: 'PASSED' },
    { id: 'b', status: 'PASSED' }
  ], 2);
  assert.strictEqual(evaluated.exitCode, 0);
});

test('B04/R39-T09: empty manifest -> exact exit 3', () => {
  expectInvalidExit3([], ['a'], 'empty manifest');
});

test('B05/R39-T10: truncated manifest missing one mandatory suite -> exact exit 3', () => {
  const suites = [{ id: 'a', name: 'A', script: 'test_gate_b1.cjs', stage: 'Stage 1 Retained' }];
  expectInvalidExit3(suites, ['a', 'b'], 'truncated manifest');
});

test('B06/R39-T11: duplicate suite IDs cannot satisfy mandatory inventory -> exact exit 3', () => {
  const suites = [
    { id: 'a', name: 'A1', script: 'test_gate_b1.cjs', stage: 'Stage 1 Retained' },
    { id: 'a', name: 'A2', script: 'test_gate_b2.cjs', stage: 'Stage 1 Retained' }
  ];
  expectInvalidExit3(suites, ['a', 'b'], 'duplicate suite id');
});

test('B07/R39-T12: mandatory script path missing -> exact exit 3 before execution', () => {
  const suites = [{ id: 'a', name: 'A', script: '__review39_missing_script__.cjs', stage: 'Stage 1 Retained' }];
  expectInvalidExit3(suites, ['a'], 'missing mandatory script');
});

test('B08: malformed suite entry -> exact exit 3', () => {
  const suites = [{ id: 'a', name: 'A', stage: 'Stage 1 Retained' }];
  expectInvalidExit3(suites, ['a'], 'malformed suite');
});

test('B09/R39-T15: production DEFAULT_SUITES exactly matches authoritative MANDATORY_SUITE_IDS', () => {
  assert.ok(core.MANDATORY_SUITE_IDS.length > 0, 'mandatory inventory must never be empty');
  const ids = core.DEFAULT_SUITES.map(s => s.id);
  assert.strictEqual(ids.length, new Set(ids).size, 'production suite IDs must be unique');
  assert.deepStrictEqual([...ids].sort(), [...core.MANDATORY_SUITE_IDS].sort(), 'production manifest must contain the exact mandatory suite ID set');
  const validation = validate(core.DEFAULT_SUITES, core.MANDATORY_SUITE_IDS);
  assert.strictEqual(validation.valid, true, 'production mandatory manifest must validate: ' + JSON.stringify(validation.errors || []));
});

test('B10: result count mismatch after valid manifest -> exact exit 3', () => {
  const required = ['a', 'b'];
  const suites = [
    { id: 'a', name: 'A', script: 'test_gate_b1.cjs', stage: 'Stage 1 Retained' },
    { id: 'b', name: 'B', script: 'test_gate_b2.cjs', stage: 'Stage 1 Retained' }
  ];
  const validation = validate(suites, required);
  assert.strictEqual(validation.valid, true);
  const evaluated = outcome(validation, [{ id: 'a', status: 'PASSED' }], 2);
  assert.strictEqual(evaluated.exitCode, 3, 'truncated execution after valid manifest must be runner-integrity failure');
});

console.log('================================================================');
console.log(' REVIEW 39 MASTER RELEASE RUNNER CONTRACT SUITE');
console.log('================================================================\n');

let failed = 0;
for (let i = 0; i < tests.length; i++) {
  const [name, fn] = tests[i];
  try {
    fn();
    console.log(`[PASS] (${i + 1}/${tests.length}) ${name}`);
  } catch (err) {
    failed++;
    console.error(`[FAIL] (${i + 1}/${tests.length}) ${name}`);
    console.error(`       ${err.message}\n${err.stack}\n`);
  }
}

console.log('\n----------------------------------------------------------------');
console.log(`TOTAL: ${tests.length - failed} PASSED, ${failed} FAILED (of ${tests.length} runner contract assertions)`);
console.log('----------------------------------------------------------------\n');

process.exit(failed > 0 ? 1 : 0);
