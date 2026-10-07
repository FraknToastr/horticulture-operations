'use strict';

// Cumulative Stage 2 master dispatcher after Review 41.
// Seven suites are mandatory for Stage 2 closure.

const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  { id: 'stage2-workspace-contract', name: 'Stage 2 Node Workspace Contract', script: 'test_stage2_workspace_contract.cjs' },
  { id: 'stage2-review39-recovery-contract', name: 'Review 39 Node Recovery Contract', script: 'test_review39_recovery_contract.cjs' },
  { id: 'stage2-runner-contract', name: 'Review 39 Master Release Runner Contract', script: 'test_runner_contract.cjs' },
  { id: 'stage2-review40-recovery-restore-contract', name: 'Review 40/41 Recovery Restore Contract', script: 'test_review40_recovery_restore_contract.cjs' },
  { id: 'stage2-review40-release-runner-contract', name: 'Review 40/41 Release Runner Assurance Contract', script: 'test_review40_release_runner_contract.cjs' },
  { id: 'stage2-browser-smoke', name: 'Stage 2 Existing Browser Smoke', script: 'test_stage2_browser_smoke.cjs', browser: true },
  { id: 'stage2-review39-browser-recovery', name: 'Review 39/40 Browser Recovery Lifecycle', script: 'test_review39_browser_recovery.cjs', browser: true }
];

console.log('================================================================');
console.log(' HORTICULTURE OPERATIONS - CUMULATIVE STAGE 2 MASTER TEST RUNNER');
console.log('================================================================\n');

let failed = 0;
let blocked = 0;
let passed = 0;

for (let i = 0; i < suites.length; i++) {
  const s = suites[i];
  console.log(`>>> [SUITE ${i + 1}/${suites.length}] ${s.id}: ${s.name}`);
  const env = Object.assign({}, process.env);
  delete env.NODE_PATH;
  env.HORTOPS_REPO_ROOT = require('./local-test-environment.cjs').repoRoot();
  const res = spawnSync(process.execPath, [path.join(__dirname, s.script)], {
    cwd: require('./local-test-environment.cjs').repoRoot(),
    encoding: 'utf8',
    timeout: s.browser ? 180000 : 120000,
    maxBuffer: 16 * 1024 * 1024,
    env
  });
  const out = (res.stdout || '') + (res.stderr || '');
  process.stdout.write(out);

  const isBlocked = s.browser && (
    out.indexOf('[BLOCKED]') !== -1 ||
    /Cannot find module ['"](?:@playwright\/test|playwright)['"]/.test(out)
  );

  if (isBlocked) {
    blocked++;
    console.log(`>>> [BLOCKED] ${s.name}\n`);
  } else if (res.status === 0) {
    passed++;
    console.log(`>>> [PASSED] ${s.name}\n`);
  } else {
    failed++;
    console.log(`>>> [FAILED] ${s.name} (exit ${res.status})\n`);
  }
}

console.log('================================================================');
console.log(`STAGE 2 CUMULATIVE SUMMARY: ${passed} PASSED, ${failed} FAILED, ${blocked} BLOCKED, ${suites.length} MANDATORY`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
if (blocked > 0) process.exit(2);
if (passed !== suites.length) process.exit(3);
process.exit(0);
