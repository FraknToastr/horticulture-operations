'use strict';
// Independent, bounded Review 30 regression checks. Run from scripts/ in a complete PR22 tree.
const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const scripts = __dirname;
const runner = fs.readFileSync(path.join(scripts,'run_all_release_gates.cjs'),'utf8');
const required = ['test_gate_b1.cjs','test_gate_b2.cjs','test_gate_b3.cjs','test_gate_c.cjs','test_r23_restore_canonical.cjs','test_r29_negative_canonical_domains.cjs','test_rostering_lifecycle.cjs','test_browser_smoke.cjs'];
for (const name of required) {
  assert(runner.includes(`script: '${name}'`), `Master runner omits ${name}`);
  assert(fs.existsSync(path.join(scripts,name)), `Missing test file ${name}`);
}
console.log('PASS: All retained-gate, lifecycle and browser checks are registered.');
let fails=0;
for (const name of ['test_gate_b1.cjs','test_gate_b2.cjs','test_r29_negative_canonical_domains.cjs']) {
  const run=spawnSync(process.execPath,[path.join(scripts,name)],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
  const ok=run.status===0&&!run.error;
  console.log(`${ok?'PASS':'FAIL'}: ${name}${run.error?' '+run.error.message:''}`);
  if(!ok){fails++;process.stderr.write((run.stdout||'')+'\n'+(run.stderr||''));}
}
if(fails)process.exit(1);
console.log('PASS: Review 29 regression closure remains demonstrable.');
