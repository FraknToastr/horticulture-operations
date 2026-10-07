'use strict';
// Review 29 independently executes retained accepted Gate B1/B2 suites.
// This test is expected to FAIL on PR22, and should become GREEN after corrective work.
const cp = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const projectRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
let failures = 0;
for (const name of ['test_gate_b1.cjs','test_gate_b2.cjs']) {
  const res = cp.spawnSync(process.execPath, [path.join(projectRoot,'scripts',name)], {
    encoding:'utf8',timeout:90000,maxBuffer:16*1024*1024
  });
  if(res.error || res.status!==0){
    failures++;
    console.error(`[FAIL] Accepted-gate regression ${name}: ${res.error ? res.error.message : 'exit '+res.status}`);
    console.error((res.stderr||res.stdout||'').slice(-2000));
  } else console.log(`[PASS] ${name}`);
}
console.log(`ACCEPTED GATE REGRESSION SUMMARY: ${2-failures} PASS, ${failures} FAIL`);
process.exit(failures?1:0);
