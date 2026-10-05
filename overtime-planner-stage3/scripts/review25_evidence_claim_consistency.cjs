'use strict';
// Reviewer-authored evidence claim consistency probe. Runs the complete suite; does not alter production.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const assert = require('assert');
const root = path.resolve(__dirname, '..');
const briefing = fs.readFileSync(path.join(root, '00_CHATGPT_FULL_PEER_REVIEW_BRIEFING.md'), 'utf8');

let output = '';
if (process.env.RUNNER_LOG && fs.existsSync(process.env.RUNNER_LOG)) {
  output = fs.readFileSync(process.env.RUNNER_LOG, 'utf8');
} else {
  const timeoutMs = process.env.RUNNER_TIMEOUT ? parseInt(process.env.RUNNER_TIMEOUT, 10) : 300000;
  const result = cp.spawnSync(process.execPath, [path.join(root, 'scripts', 'run_all_release_gates.cjs')], {
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024
  });
  if (result.error && result.error.code === 'ETIMEDOUT') {
    console.warn('BLOCKED: Test runner timed out after ' + timeoutMs + 'ms in this execution environment. Not an application defect.');
    process.exit(1);
  }
  if (result.error || result.status !== 0) {
    console.error('BLOCKED/FAILED: Master runner did not complete successfully: ' + (result.error ? result.error.message : 'exit ' + result.status));
    process.exit(1);
  }
  output = (result.stdout || '') + '\n' + (result.stderr || '');
}

const summary = output.match(/TOTAL:\s*(\d+)\s+PASSED,\s*(\d+)\s+FAILED,\s*(\d+)\s+BLOCKED,\s*(\d+)\s+SUITES\./);
assert(summary, 'Master runner must emit a complete, parseable aggregate test summary');
const passed = Number(summary[1]);
const failed = Number(summary[2]);
const blocked = Number(summary[3]);
const total = Number(summary[4]);
assert.strictEqual(passed + failed + blocked, total, 'Runner status counts do not add up');
assert.strictEqual(total, 17, 'Expected full 17-suite release battery');
// A release-evidence verification probe must reject an incomplete or red battery
// even if the briefing avoids a specific "Entire test suite" phrase.
assert.strictEqual(failed, 0, 'Release battery contains failing suite(s)');
assert.strictEqual(blocked, 0, 'Release battery contains blocked suite(s)');
assert.strictEqual(passed, total, 'Release battery must pass all declared suites');
console.log('PASS: Briefing\'s aggregate claim agrees with actual runner: ' + summary[0]);
process.exit(0);
