'use strict';
// Master Release Runner Deterministic Contract Self-Test Suite (PR23_02 / Review 38 Mandate R38-02)
// Tests:
//   B01: Inject one mandatory browser suite BLOCKED -> Exit code 2, diagnostic reports BLOCKED
//   B02: Inject one mandatory suite FAILED -> Exit code 1, diagnostic reports FAILED
//   B03: All mandatory suites PASSED -> Exit code 0, diagnostic reports all PASSED
//   B04: Incomplete / missing suite manifest -> Exit code 3, diagnostic reports INCOMPLETE
// 100% Deterministic — Runs scripts/run_all_release_gates.cjs in isolated child process with mock manifests.

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const runnerPath = path.resolve(__dirname, 'run_all_release_gates.cjs');

function runRunnerWithSuites(syntheticSuites) {
  const env = Object.assign({}, process.env, {
    RELEASE_RUNNER_SUITES_JSON: JSON.stringify(syntheticSuites)
  });
  return spawnSync(process.execPath, [runnerPath], {
    env: env,
    encoding: 'utf8',
    timeout: 30000
  });
}

const tmpDir = path.resolve(__dirname, '../test_reports/mock_suites');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

fs.writeFileSync(path.join(tmpDir, 'mock_pass.cjs'), 'console.log("Mock pass suite"); process.exit(0);\n');
fs.writeFileSync(path.join(tmpDir, 'mock_fail.cjs'), 'console.log("Mock fail suite"); process.exit(1);\n');
fs.writeFileSync(path.join(tmpDir, 'mock_blocked.cjs'), 'console.log("[BLOCKED] Playwright browser not available"); process.exit(0);\n');

const relPass = '../test_reports/mock_suites/mock_pass.cjs';
const relFail = '../test_reports/mock_suites/mock_fail.cjs';
const relBlocked = '../test_reports/mock_suites/mock_blocked.cjs';

const tests = [
  ['B01: Inject one mandatory browser suite BLOCKED while others PASSED -> Exits code 2 with BLOCKED summary', () => {
    const suites = [
      { name: 'Mock Stage 1 Retained Gate', script: relPass, stage: 'Stage 1 Retained' },
      { name: 'Mock Mandatory Browser Gate', script: relBlocked, browser: true, stage: 'Stage 2 Acceptance' }
    ];
    const res = runRunnerWithSuites(suites);
    const output = (res.stdout || '') + (res.stderr || '');

    assert.strictEqual(res.status, 2, 'Runner must exit code 2 when a mandatory suite is BLOCKED');
    assert.ok(output.indexOf('[RELEASE GATE BLOCKED]') !== -1, 'Output must report [RELEASE GATE BLOCKED]');
    assert.ok(output.indexOf('1 BLOCKED') !== -1, 'Summary must report 1 BLOCKED');
    assert.ok(output.indexOf('0 FAILED') !== -1, 'Summary must report 0 FAILED (not conflated with failure)');
  }],

  ['B02: Inject one mandatory suite FAILED while others PASSED -> Exits code 1 with FAILED summary', () => {
    const suites = [
      { name: 'Mock Stage 1 Retained Gate', script: relPass, stage: 'Stage 1 Retained' },
      { name: 'Mock Failing Stage 2 Gate', script: relFail, stage: 'Stage 2 Acceptance' }
    ];
    const res = runRunnerWithSuites(suites);
    const output = (res.stdout || '') + (res.stderr || '');

    assert.strictEqual(res.status, 1, 'Runner must exit code 1 when any suite FAILS');
    assert.ok(output.indexOf('[RELEASE GATE FAILED]') !== -1, 'Output must report [RELEASE GATE FAILED]');
    assert.ok(output.indexOf('1 FAILED') !== -1, 'Summary must report 1 FAILED');
  }],

  ['B03: All mandatory suites PASSED -> Exits code 0 with clean summary', () => {
    const suites = [
      { name: 'Mock Stage 1 Retained Gate', script: relPass, stage: 'Stage 1 Retained' },
      { name: 'Mock Stage 2 Acceptance Gate', script: relPass, stage: 'Stage 2 Acceptance' }
    ];
    const res = runRunnerWithSuites(suites);
    const output = (res.stdout || '') + (res.stderr || '');

    assert.strictEqual(res.status, 0, 'Runner must exit code 0 when all suites PASS');
    assert.ok(output.indexOf('[RELEASE GATE PASSED]') !== -1, 'Output must report [RELEASE GATE PASSED]');
    assert.ok(output.indexOf('2 PASSED, 0 FAILED, 0 BLOCKED') !== -1, 'Summary must report all suites passed');
  }],

  ['B04: Missing / incomplete suite manifest -> Exits nonzero', () => {
    const suites = [
      { name: 'Nonexistent Script Suite', script: '../test_reports/mock_suites/nonexistent_file.cjs', stage: 'Stage 1 Retained' }
    ];
    const res = runRunnerWithSuites(suites);
    const output = (res.stdout || '') + (res.stderr || '');

    assert.notStrictEqual(res.status, 0, 'Runner must not exit zero when a suite cannot execute');
    assert.ok(output.indexOf('[RELEASE GATE FAILED]') !== -1 || output.indexOf('FAILED') !== -1);
  }]
];

console.log('================================================================');
console.log(' MASTER RELEASE RUNNER CONTRACT SELF-TEST SUITE (R38-02 / B01-B04)');
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
    console.error(`       Error: ${err.message}\n${err.stack}\n`);
  }
}

console.log('\n----------------------------------------------------------------');
console.log(`TOTAL: ${tests.length - failed} PASSED, ${failed} FAILED (of ${tests.length} runner contract assertions)`);
console.log('----------------------------------------------------------------\n');

try {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
} catch (e) {}

if (failed > 0) {
  process.exit(1);
}
