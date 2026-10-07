'use strict';
// Reviewer-authored source/evidence contract checks. No production modifications.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', '..'));
let passed = 0, failed = 0;
function check(name, fn) {
  try {fn(); console.log('PASS: ' + name); passed++;}
  catch (e) {console.error('FAIL: ' + name + '\n  ' + e.message); failed++;}
}
function read(p) {return fs.readFileSync(path.join(root,p), 'utf8');}
const browser = read('scripts/test_browser_smoke.cjs');
const evidence = read('scripts/review25_evidence_claim_consistency.cjs');
const runner = read('scripts/run_all_release_gates.cjs');
const report = read('GATE_D_CHANGE_AND_EVIDENCE_REPORT.md');
check('retained acceptance and lifecycle suite included',()=> {
  for(const file of ['test_gate_b1.cjs','test_gate_b2.cjs','test_gate_b3.cjs','test_gate_c.cjs','test_rostering_lifecycle.cjs','test_browser_smoke.cjs'])
    assert(runner.includes(file), 'Runner missing ' + file);
});
check('master runner exits nonzero on failed or blocked suites',()=> {
  assert(/process\.exit\(failed\s*>\s*0\s*\|\|\s*blocked\s*>\s*0\s*\?\s*1\s*:\s*0\)/.test(runner), 'Fail-closed master exit missing');
});
check('browser smoke targets reported distribution artifact',()=> {
  const claimsDist = /test_browser_smoke\.cjs[\s\S]{0,150}dist\/hort_ops_offline_planner\.html/.test(report);
  assert(claimsDist, 'Cannot verify documented distribution claim');
  assert(/(?:dist[\\/]|path\.join\([^\n]*['"]dist['"])/.test(browser.split('const fileUrl')[1].split('\n')[0]), 'Browser test fileUrl targets index.html rather than claimed dist artifact');
});
check('evidence probe fails closed on master runner timeout',()=> {
  const timeout = evidence.match(/if\s*\(result\.error\s*&&\s*result\.error\.code\s*===\s*['"]ETIMEDOUT['"]\)\s*\{([\s\S]*?)\}/);
  assert(timeout, 'Timeout branch not found');
  assert(!/process\.exit\(0\)/.test(timeout[1]), 'Runner timeout yields process.exit(0), masking unavailable test evidence');
});
console.log('\nREVIEW31 RESULT: ' + passed + ' PASS, ' + failed + ' FAIL');
process.exit(failed ? 1 : 0);
