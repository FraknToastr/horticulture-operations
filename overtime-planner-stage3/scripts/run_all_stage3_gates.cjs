/**
 * Stage 3 Master Acceptance Suite:
 * Workforce Intelligence, Qualification Registries & Advanced Fatigue Management
 *
 * Runs all Stage 3 Acceptance Gates:
 * - Gate 3A: Qualification Registry Core & Schema v2 Additive Extensions
 * - Gate 3B: Hard Qualification Matching in Staff Assignment Modal
 * - Gate 3C: Advanced Multi-Week Fatigue Risk & Predictive Overtime Allocation Engine
 * - Gate 3D: Workforce Intelligence Analytics Dashboard, Fatigue Risk Heatmap & Qualification Compliance Matrix
 */

const { spawnSync } = require('child_process');
const path = require('path');

const STAGE3_SUITES = [
  {
    id: 'gate-3a-qualification-registry',
    name: 'Gate 3A: Qualification Registry Core & Schema v2 Additive Extensions',
    script: 'test_stage3_qualification_registry_contract.cjs'
  },
  {
    id: 'gate-3b-qualification-matching',
    name: 'Gate 3B: Hard Qualification Matching in Staff Assignment Modal',
    script: 'test_stage3_qualification_matching_contract.cjs'
  },
  {
    id: 'gate-3c-fatigue-engine',
    name: 'Gate 3C: Advanced Fatigue Engine & Predictive Overtime Allocation',
    script: 'test_stage3_fatigue_engine_contract.cjs'
  },
  {
    id: 'gate-3d-analytics-workforce',
    name: 'Gate 3D: Workforce Intelligence Analytics Dashboard & Fatigue Heatmap',
    script: 'test_stage3_analytics_contract.cjs'
  },
  {
    id: 'gate-3e-absence-ledger',
    name: 'Gate 3E: Multi-Period Absence Ledger, RDOs, Training & Fair-Share Refusals',
    script: 'test_stage3_absence_ledger_contract.cjs'
  },
  {
    id: 'gate-3f-review56-durability',
    name: 'Gate 3F: Review 56 Absence & Refusal Durability, Rollback & Fail-Closed Integration',
    script: 'test_stage3_absence_persistence_contract.cjs'
  }
];

console.log('================================================================');
console.log(' STAGE 3 MASTER ACCEPTANCE RUNNER');
console.log(' Workforce Intelligence, Qualifications & Advanced Fatigue System');
console.log('================================================================\n');

let passedCount = 0;
let failedCount = 0;
const results = [];

STAGE3_SUITES.forEach((suite, index) => {
  console.log(`>>> [STAGE 3 GATE ${index + 1}/${STAGE3_SUITES.length}] Running ${suite.id}...`);
  const scriptPath = path.join(__dirname, suite.script);
  const startTime = Date.now();
  const proc = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (proc.status === 0) {
    passedCount++;
    results.push({ suite: suite.name, status: 'PASSED', duration });
    console.log(`>>> [GATE ${index + 1} PASSED] (${duration}s, exit 0)\n`);
  } else {
    failedCount++;
    results.push({ suite: suite.name, status: 'FAILED', duration, code: proc.status });
    console.log(`>>> [GATE ${index + 1} FAILED] (${duration}s, exit ${proc.status})\n`);
  }
});

console.log('================================================================');
console.log(' STAGE 3 ACCEPTANCE SUMMARY');
console.log('================================================================');
results.forEach(r => {
  console.log(` [${r.status}] ${r.suite} (${r.duration}s)`);
});
console.log('----------------------------------------------------------------');
console.log(`TOTAL: ${passedCount} PASSED, ${failedCount} FAILED (of ${STAGE3_SUITES.length} gates)`);
console.log('================================================================\n');

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log('✔ ALL STAGE 3 ACCEPTANCE GATES 100% VERIFIED AND PASSING CLEANLY!\n');
  process.exit(0);
}
