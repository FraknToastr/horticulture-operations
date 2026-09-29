const { spawnSync } = require('child_process');
const path = require('path');

console.log('================================================================');
console.log(' HORTICULTURE OPERATIONS - COMPLETE RELEASE & RETAINED GATES RUNNER');
console.log('================================================================\n');

const defaultSuites = [
  // Retained Accepted Gate Battery (Review 29 Mandate R29-03)
  { name: 'Retained Gate B1: Canonical v2 Persistence & Boundary Validation', script: 'test_gate_b1.cjs', timeout: 60000, stage: 'Stage 1 Retained' },
  { name: 'Retained Gate B2: Authoritative Commitment Lifecycle Acceptance', script: 'test_gate_b2.cjs', timeout: 60000, stage: 'Stage 1 Retained' },
  { name: 'Retained Gate B3: Transaction Coordinator & Rollback Hardening', script: 'test_gate_b3.cjs', timeout: 60000, stage: 'Stage 1 Retained' },
  { name: 'Retained Gate C: Prototype Seed Isolation & Privacy Clearance', script: 'test_gate_c.cjs', timeout: 60000, stage: 'Stage 1 Retained' },
  { name: 'Retained Canonical Restore: Full Envelope Equivalence (R23-B3)', script: 'test_r23_restore_canonical.cjs', timeout: 60000, stage: 'Stage 1 Retained' },
  { name: 'Review 29: Negative Canonical Domain Matrix & Shift Resilience', script: 'test_r29_negative_canonical_domains.cjs', timeout: 60000, stage: 'Stage 1 Retained' },

  // Core Functional Specifications
  { name: 'FR-02: Strict Gregorian Calendar & Recurrence Interval Validation', script: 'test_fr02_schedule_validation.cjs', timeout: 30000, stage: 'Stage 1 Retained' },
  { name: 'FR-03: Adelaide Timezone & DST-Aware 10-Hour Physical Rest', script: 'test_fr03_dst_rest.cjs', timeout: 30000, stage: 'Stage 1 Retained' },

  // Primary Integrated Release Gates (RG1 - RG9)
  { name: 'RG1: Static Syntax & Helper Scope Audit', script: 'test_static_release.cjs', timeout: 30000, stage: 'Stage 1 Retained' },
  { name: 'RG2: Scheduler Engine Invariants & Recurrence Overrides', script: 'test_scheduler.cjs', timeout: 60000, stage: 'Stage 1 Retained' },
  { name: 'RG3: Workforce Lifecycle & Assignment Integrity', script: 'test_workforce.cjs', timeout: 30000, stage: 'Stage 1 Retained' },
  { name: 'RG4: Persistence Contract & JSON Schema Validation', script: 'test_persistence.cjs', timeout: 60000, stage: 'Stage 1 Retained' },
  { name: 'RG5: Assisted Rostering Engine & Propagation Invariants', script: 'test_rostering_engine.cjs', timeout: 60000, stage: 'Stage 1 Retained' },
  { name: 'RG6: Truthful Persistence State & Recovery Warnings', script: 'test_recovery_ui.cjs', timeout: 30000, stage: 'Stage 1 Retained' },
  { name: 'RG7: Multi-Year Scheduler & Rostering Differential (2025-2028)', script: 'test_multi_year_differential.cjs', timeout: 60000, stage: 'Stage 1 Retained' },
  { name: 'RG8: Offline17.5j Rostering Integrity Freeze & Invariants', script: 'test_rostering_lifecycle.cjs', timeout: 120000, stage: 'Stage 1 Retained' },
  { name: 'RG9: Playwright Headless Browser Smoke Suite', script: 'test_browser_smoke.cjs', browser: true, timeout: 120000, stage: 'Stage 1 Retained' },

  // Stage 2 Acceptance Battery (Review 37 Mandate R37-04)
  { name: 'Stage 2 Node: Workspace Management, Destructive Reset & Storage Hygiene Contract', script: 'test_stage2_workspace_contract.cjs', timeout: 60000, stage: 'Stage 2 Acceptance' },
  { name: 'Stage 2 Node: Master Release Runner Self-Test Contract (Matrix B01-B04)', script: 'test_runner_contract.cjs', timeout: 60000, stage: 'Stage 2 Acceptance' },
  { name: 'Stage 2 Browser: Workspace Seeding, Reset Verification & Quarantine Smoke', script: 'test_stage2_browser_smoke.cjs', browser: true, timeout: 120000, stage: 'Stage 2 Acceptance' }
];

const suites = process.env.RELEASE_RUNNER_SUITES_JSON
  ? JSON.parse(process.env.RELEASE_RUNNER_SUITES_JSON)
  : defaultSuites;

const results = [];
for (let idx = 0; idx < suites.length; idx++) {
  const suite = suites[idx];
  console.log(`>>> [SUITE ${idx + 1}/${suites.length}] Running ${suite.name}...`);
  const start = Date.now();
  const run = spawnSync(process.execPath, [path.join(__dirname, suite.script)], {
    encoding: 'utf8',
    timeout: suite.timeout || 60000,
    maxBuffer: 16 * 1024 * 1024
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

  if (suite.browser && (/Cannot find module ['"]playwright['"]/.test(output) || output.indexOf('[BLOCKED]') !== -1)) {
    status = 'BLOCKED';
  }

  results.push({ name: suite.name, status, duration, exitCode: run.status, stage: suite.stage });
  console.log(`>>> [SUITE ${idx + 1} ${status}] (${duration}, exit ${run.status})\n`);
}

console.log('================================================================');
console.log(' FINAL COMPLETE RELEASE GATES AUDIT SUMMARY');
console.log('================================================================');
for (const r of results) {
  console.log(` [${r.status}] [${r.stage}] ${r.name} (${r.duration}, exit ${r.exitCode})`);
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

const totalFailed = results.filter(r => r.status === 'FAILED').length;
const totalBlocked = results.filter(r => r.status === 'BLOCKED').length;
const totalPassed = results.filter(r => r.status === 'PASSED').length;
console.log(`TOTAL: ${totalPassed} PASSED, ${totalFailed} FAILED, ${totalBlocked} BLOCKED, ${results.length} SUITES.`);

const totalSuites = suites.length;
console.log(`TOTAL: ${totalPassed} PASSED, ${totalFailed} FAILED, ${totalBlocked} BLOCKED, ${results.length}/${totalSuites} SUITES.`);

// Review 38 Mandate R38-02: Fail-closed release-gate evaluation
// Every mandatory suite must complete as PASSED.
// Any FAILED suite => exit code 1
// Any BLOCKED suite (with 0 failed) => exit code 2
// Incomplete or truncated execution => exit code 3
if (results.length !== totalSuites) {
  console.error(`\n[RELEASE GATE INCOMPLETE] Expected ${totalSuites} suites, but executed ${results.length}. Failing closed.`);
  process.exit(3);
}

if (totalFailed > 0) {
  console.error(`\n[RELEASE GATE FAILED] ${totalFailed} suite(s) failed. Release gate rejected.`);
  process.exit(1);
}

if (totalBlocked > 0) {
  console.error(`\n[RELEASE GATE BLOCKED] ${totalBlocked} mandatory suite(s) blocked by environment/infrastructure. Release gate cannot pass.`);
  process.exit(2);
}

console.log(`\n[RELEASE GATE PASSED] All ${totalPassed} mandatory release gate suites passed with zero failures and zero blocked.`);
process.exit(0);
