'use strict';

/**
 * run_all_release_gates.cjs
 *
 * Master release and retained gates runner for Horticulture Operations Overtime Planner.
 * Evaluates Stage 1 Retained Gates and Stage 2 Acceptance Gates.
 * Enforces fail-closed manifest validation and exact exit code semantics (R38-02, R39-03):
 *   0 = all mandatory suites passed
 *   1 = one or more mandatory suites failed
 *   2 = one or more mandatory suites blocked (no failures)
 *   3 = manifest / runner integrity failure
 */

const { spawnSync } = require('child_process');
const path = require('path');
const core = require('./release_runner_core.cjs');

console.log('================================================================');
console.log(' HORTICULTURE OPERATIONS - COMPLETE RELEASE & RETAINED GATES RUNNER');
console.log('================================================================\n');

// 1. Validate mandatory manifest before running any tests
const scriptsRoot = __dirname;
const validation = core.validateManifest(core.DEFAULT_SUITES, {
  requiredSuiteContract: core.MANDATORY_SUITE_CONTRACT,
  scriptsRoot: scriptsRoot
});

if (!validation.valid) {
  console.error('[RELEASE RUNNER INTEGRITY ERROR] Mandatory manifest validation failed:');
  for (const err of validation.errors) {
    console.error('  - ' + err);
  }
  const outcome = core.evaluateReleaseOutcome({
    manifestValidation: validation,
    results: [],
    expectedSuiteCount: core.DEFAULT_SUITES.length
  });
  process.exit(outcome.exitCode);
}

const suites = core.DEFAULT_SUITES;
const results = [];

for (let idx = 0; idx < suites.length; idx++) {
  const suite = suites[idx];
  console.log(`>>> [SUITE ${idx + 1}/${suites.length}] ${suite.id}: ${suite.name}...`);
  const start = Date.now();
  
  const env = Object.assign({}, process.env);
  // The copied planner owns its dependencies. Never resolve a sibling/global package.
  delete env.NODE_PATH;
  env.HORTOPS_ROOT = path.resolve(scriptsRoot, '..');
  env.HORTOPS_REPO_ROOT = env.HORTOPS_ROOT;

  const run = spawnSync(process.execPath, [path.join(scriptsRoot, suite.script)], {
    cwd: path.resolve(scriptsRoot, '..'),
    encoding: 'utf8',
    timeout: suite.timeout || 60000,
    maxBuffer: 16 * 1024 * 1024,
    env: env
  });

  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const duration = ((Date.now() - start) / 1000).toFixed(2) + 's';
  process.stdout.write(output);

  let status = 'FAILED';
  if (run.error) {
    if (run.error.code === 'ETIMEDOUT') {
      console.error(`[TIMEOUT] Suite ${suite.name} timed out after ${suite.timeout}ms`);
    } else {
      console.error(`[EXEC ERROR] ${suite.name}: ${run.error.message}`);
    }
  } else if (run.status === 0) {
    status = 'PASSED';
  }

  if (suite.browser && (/Cannot find module ['"](?:@playwright\/test|playwright)['"]/.test(output) || output.indexOf('[BLOCKED]') !== -1)) {
    status = 'BLOCKED';
  }

  results.push({
    id: suite.id,
    name: suite.name,
    status: status,
    duration: duration,
    exitCode: run.status,
    stage: suite.stage
  });

  console.log(`>>> [SUITE ${idx + 1} ${status}] (${duration}, exit ${run.status})\n`);
}

console.log('================================================================');
console.log(' FINAL COMPLETE RELEASE GATES AUDIT SUMMARY');
console.log('================================================================');
for (const r of results) {
  console.log(` [${r.status}] [${r.stage}] ${r.id}: ${r.name} (${r.duration}, exit ${r.exitCode})`);
}

const stage1Results = results.filter(r => r.stage === 'Stage 1 Retained');
const stage2Results = results.filter(r => r.stage === 'Stage 2 Acceptance');

const s1Passed = stage1Results.filter(r => r.status === 'PASSED').length;
const s1Failed = stage1Results.filter(r => r.status === 'FAILED').length;
const s1Blocked = stage1Results.filter(r => r.status === 'BLOCKED').length;

const s2Passed = stage2Results.filter(r => r.status === 'PASSED').length;
const s2Failed = stage2Results.filter(r => r.status === 'FAILED').length;
const s2Blocked = stage2Results.filter(r => r.status === 'BLOCKED').length;

console.log('\n----------------------------------------------------------------');
console.log(` STAGE 1 RETAINED GATES: ${s1Passed}/${stage1Results.length} PASSED (${s1Failed} failed, ${s1Blocked} blocked)`);
console.log(` STAGE 2 ACCEPTANCE GATES: ${s2Passed}/${stage2Results.length} PASSED (${s2Failed} failed, ${s2Blocked} blocked)`);
console.log('----------------------------------------------------------------');

// Evaluate overall release outcome using core evaluator
const evaluated = core.evaluateReleaseOutcome({
  manifestValidation: validation,
  results: results,
  expectedSuiteCount: suites.length
});

console.log(`TOTAL: ${evaluated.passedCount || 0} PASSED, ${evaluated.failedCount || 0} FAILED, ${evaluated.blockedCount || 0} BLOCKED, ${results.length}/${suites.length} SUITES.`);
console.log(`FINAL OUTCOME: ${evaluated.status} (exit ${evaluated.exitCode}) - ${evaluated.reason}`);

process.exit(evaluated.exitCode);
