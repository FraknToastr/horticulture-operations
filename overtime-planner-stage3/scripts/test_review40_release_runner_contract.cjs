'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function resolveRepoRoot() {
  const candidates = [];
  if (process.env.HORTOPS_REPO_ROOT) candidates.push(path.resolve(process.env.HORTOPS_REPO_ROOT));
  candidates.push(path.resolve(__dirname, '..'));
  candidates.push(path.resolve(process.cwd()));
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'scripts', 'release_runner_core.cjs'))) return c;
  }
  throw new Error('Cannot locate Overtime Planner repository. Set HORTOPS_REPO_ROOT.');
}
const root = resolveRepoRoot();
const scriptsRoot = path.join(root, 'scripts');
const corePath = path.join(scriptsRoot, 'release_runner_core.cjs');
const core = require(corePath);

const EXPECTED_CONTRACT = Object.freeze([
  ['stage1-gate-b1','test_gate_b1.cjs','Stage 1 Retained',false],
  ['stage1-gate-b2','test_gate_b2.cjs','Stage 1 Retained',false],
  ['stage1-gate-b3','test_gate_b3.cjs','Stage 1 Retained',false],
  ['stage1-gate-c','test_gate_c.cjs','Stage 1 Retained',false],
  ['stage1-restore-canonical','test_r23_restore_canonical.cjs','Stage 1 Retained',false],
  ['stage1-r29-negative-domains','test_r29_negative_canonical_domains.cjs','Stage 1 Retained',false],
  ['stage1-fr02-schedule-validation','test_fr02_schedule_validation.cjs','Stage 1 Retained',false],
  ['stage1-fr03-dst-rest','test_fr03_dst_rest.cjs','Stage 1 Retained',false],
  ['stage1-rg1-static-syntax','test_static_release.cjs','Stage 1 Retained',false],
  ['stage1-rg2-scheduler','test_scheduler.cjs','Stage 1 Retained',false],
  ['stage1-rg3-workforce','test_workforce.cjs','Stage 1 Retained',false],
  ['stage1-rg4-persistence','test_persistence.cjs','Stage 1 Retained',false],
  ['stage1-rg5-rostering-engine','test_rostering_engine.cjs','Stage 1 Retained',false],
  ['stage1-rg6-recovery-ui','test_recovery_ui.cjs','Stage 1 Retained',false],
  ['stage1-rg7-multi-year','test_multi_year_differential.cjs','Stage 1 Retained',false],
  ['stage1-rg8-rostering-lifecycle','test_rostering_lifecycle.cjs','Stage 1 Retained',false],
  ['stage1-rg9-browser-smoke','test_browser_smoke.cjs','Stage 1 Retained',true],
  ['stage2-workspace-contract','test_stage2_workspace_contract.cjs','Stage 2 Acceptance',false],
  ['stage2-review39-recovery-contract','test_review39_recovery_contract.cjs','Stage 2 Acceptance',false],
  ['stage2-runner-contract','test_runner_contract.cjs','Stage 2 Acceptance',false],
  ['stage2-review40-recovery-restore-contract','test_review40_recovery_restore_contract.cjs','Stage 2 Acceptance',false],
  ['stage2-review40-release-runner-contract','test_review40_release_runner_contract.cjs','Stage 2 Acceptance',false],
  ['stage2-browser-smoke','test_stage2_browser_smoke.cjs','Stage 2 Acceptance',true],
  ['stage2-review39-browser-recovery','test_review39_browser_recovery.cjs','Stage 2 Acceptance',true]
]);

function tuple(s) {
  return [s.id, s.script, s.stage, Boolean(s.browser)];
}
function tuples(arr) {
  return arr.map(tuple);
}
const EXPECTED_IDS = EXPECTED_CONTRACT.map(x => x[0]);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('R40/R41-R01: mandatory inventory is the exact cumulative 24-suite contract', () => {
  assert.strictEqual(core.DEFAULT_SUITES.length, 24,
    'production release runner must contain 24 cumulative mandatory suites');
  assert.deepStrictEqual(tuples(core.DEFAULT_SUITES), EXPECTED_CONTRACT);
  assert.strictEqual(core.DEFAULT_SUITES.filter(s => s.stage === 'Stage 2 Acceptance').length, 7);
});

test('R40/R41-R02: authoritative descriptor contract is independent from DEFAULT_SUITES', () => {
  assert.ok(Array.isArray(core.MANDATORY_SUITE_CONTRACT),
    'release core must export MANDATORY_SUITE_CONTRACT');
  assert.deepStrictEqual(tuples(core.MANDATORY_SUITE_CONTRACT), EXPECTED_CONTRACT,
    'mandatory descriptor contract must exactly bind ID -> script -> stage -> browser');
  const src = fs.readFileSync(corePath, 'utf8');
  assert.ok(!/MANDATORY_SUITE_CONTRACT\s*=\s*DEFAULT_SUITES/.test(src),
    'authoritative descriptor contract must not be derived from DEFAULT_SUITES');
});

test('R40-R03: manifest validation rejects unknown extra suite IDs', () => {
  const suites = core.DEFAULT_SUITES.map(s => Object.assign({}, s));
  suites.push({ id: 'review41-unknown-extra', name: 'Unknown Extra', script: 'test_gate_b1.cjs', stage: 'Stage 1 Retained' });
  const v = core.validateManifest(suites, {
    requiredSuiteIds: EXPECTED_IDS,
    scriptsRoot
  });
  assert.strictEqual(v.valid, false);
});

test('R40-R04: manifest validation rejects zero-byte and whitespace-only scripts', () => {
  const os = require('os');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'review41-runner-'));
  try {
    fs.writeFileSync(path.join(tempRoot, 'empty.cjs'), '');
    fs.writeFileSync(path.join(tempRoot, 'white.cjs'), '  \n\t');
    for (const script of ['empty.cjs', 'white.cjs']) {
      const supplied = [{ id: 'a', name: 'A', script, stage: 'Stage 1 Retained' }];
      const v = core.validateManifest(supplied, {
        requiredSuiteIds: ['a'],
        scriptsRoot: tempRoot
      });
      assert.strictEqual(v.valid, false, `must reject non-substantive script ${script}`);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('R41-R05: suite ID mapped to the wrong script is rejected before execution', () => {
  const suites = core.DEFAULT_SUITES.map(s => Object.assign({}, s));
  suites[0].script = 'test_gate_b2.cjs';
  const v = core.validateManifest(suites, {
    requiredSuiteContract: core.MANDATORY_SUITE_CONTRACT,
    scriptsRoot
  });
  assert.strictEqual(v.valid, false, 'correct ID with wrong script must fail manifest integrity');
});

test('R41-R06: suite ID mapped to the wrong stage/browser classification is rejected', () => {
  const suites = core.DEFAULT_SUITES.map(s => Object.assign({}, s));
  suites[0].stage = 'Stage 2 Acceptance';
  suites[16].browser = false;
  const v = core.validateManifest(suites, {
    requiredSuiteContract: core.MANDATORY_SUITE_CONTRACT,
    scriptsRoot
  });
  assert.strictEqual(v.valid, false);
});

test('R41-R07: Stage 2 dispatcher retains the two Review 40 Node acceptance contracts', () => {
  const src = fs.readFileSync(path.join(root, 'scripts', 'test_stage2_workspace_management.cjs'), 'utf8');
  assert.ok(src.includes('test_review40_recovery_restore_contract.cjs'));
  assert.ok(src.includes('test_review40_release_runner_contract.cjs'));
});

test('R40/R41-R08: production manifest validates against the descriptor contract', () => {
  const v = core.validateManifest(core.DEFAULT_SUITES, {
    requiredSuiteContract: core.MANDATORY_SUITE_CONTRACT,
    scriptsRoot
  });
  assert.strictEqual(v.valid, true, JSON.stringify(v.errors || []));
  assert.deepStrictEqual(core.DEFAULT_SUITES.map(s => s.id), EXPECTED_IDS);
});

console.log('================================================================');
console.log(' REVIEW 40/41 CUMULATIVE RELEASE RUNNER ASSURANCE CONTRACT');
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
    console.error(`       ${err.message}\n`);
  }
}
console.log(`\nTOTAL: ${tests.length - failed} PASSED, ${failed} FAILED (of ${tests.length})`);
process.exit(failed ? 1 : 0);
