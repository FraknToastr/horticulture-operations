'use strict';
// Master Stage 2 Workspace Management Test Dispatcher (PR23_02)
// Executes:
// 1. Pure Node Deterministic Workspace Contract (scripts/test_stage2_workspace_contract.cjs)
// 2. Release Runner Deterministic Contract Self-Test (scripts/test_runner_contract.cjs)
// 3. Playwright Headless Browser Smoke (scripts/test_stage2_browser_smoke.cjs)

const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
  { name: 'Stage 2 Node Workspace Contract (Matrix A01-A10)', script: 'test_stage2_workspace_contract.cjs' },
  { name: 'Stage 2 Release Runner Self-Test (Matrix B01-B04)', script: 'test_runner_contract.cjs' },
  { name: 'Stage 2 Browser Smoke Suite (Cold Reload & Quarantine)', script: 'test_stage2_browser_smoke.cjs', browser: true }
];

console.log('================================================================');
console.log(' HORTICULTURE OPERATIONS - STAGE 2 MASTER WORKSPACE TEST RUNNER');
console.log('================================================================\n');

let totalFailed = 0;
let totalBlocked = 0;
let totalPassed = 0;

for (let i = 0; i < suites.length; i++) {
  const s = suites[i];
  console.log(`>>> [SUITE ${i + 1}/${suites.length}] Running ${s.name}...`);
  const res = spawnSync(process.execPath, [path.join(__dirname, s.script)], {
    encoding: 'utf8',
    timeout: 120000
  });

  const out = (res.stdout || '') + (res.stderr || '');
  process.stdout.write(out);

  if (s.browser && (out.indexOf('[BLOCKED]') !== -1 || /Cannot find module ['"]playwright['"]/.test(out))) {
    totalBlocked++;
    console.log(`>>> [BLOCKED] ${s.name}\n`);
  } else if (res.status === 0) {
    totalPassed++;
    console.log(`>>> [PASSED] ${s.name}\n`);
  } else {
    totalFailed++;
    console.log(`>>> [FAILED] ${s.name} (exit ${res.status})\n`);
  }
}

console.log('================================================================');
console.log(`STAGE 2 SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED, ${totalBlocked} BLOCKED`);
console.log('================================================================\n');

if (totalFailed > 0) process.exit(1);
if (totalBlocked > 0) process.exit(2);
process.exit(0);
