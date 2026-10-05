'use strict';
// Reviewer-owned, nonproduction evidence-contract regression probe.
// Usage: node reviewer_tests/review32_evidence_provenance.cjs /path/to/unpacked/project
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const root = path.resolve(process.argv[2] || '.');
let pass=0,fail=0;
function check(label,fn){try{fn();console.log('PASS: '+label);pass++;}catch(e){console.error('FAIL: '+label+' — '+e.message);fail++;}}
const read = name => fs.readFileSync(path.join(root,name),'utf8');
check('browser script targets built distribution under file://',()=>{
  const s=read('scripts/test_browser_smoke.cjs');
  assert(/path\.join\(baseDir,\s*['"]dist['"],\s*['"]hort_ops_offline_planner\.html['"]\)/.test(s));
  assert(/file:\/\//.test(s));
});
check('browser script observes console and page errors and fails on either',()=>{
  const s=read('scripts/test_browser_smoke.cjs');
  assert(/page\.on\(['"]console['"]/.test(s));
  assert(/page\.on\(['"]pageerror['"]/.test(s));
  assert(/assert\.strictEqual\(consoleErrors\.length,\s*0/.test(s));
  assert(/assert\.strictEqual\(uncaughtErrors\.length,\s*0/.test(s));
});
check('evidence probe fails on contradictory runner evidence',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hort-review32-'));
  try{
    const log=path.join(tmp,'failed.log');
    fs.writeFileSync(log,'TOTAL: 15 PASSED, 1 FAILED, 1 BLOCKED, 17 SUITES.\n');
    const r=cp.spawnSync(process.execPath,[path.join(root,'scripts/review25_evidence_claim_consistency.cjs')],{cwd:root,env:{...process.env,RUNNER_LOG:log},encoding:'utf8',timeout:10000});
    assert.strictEqual(r.status,1,'Contradictory source should return exit 1');
  }finally{fs.rmSync(tmp,{force:true,recursive:true});}
});
check('evidence probe accepts a truthful zero-failure runner summary',()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hort-review32-'));
  try{
    const log=path.join(tmp,'green.log');
    fs.writeFileSync(log,'TOTAL: 17 PASSED, 0 FAILED, 0 BLOCKED, 17 SUITES.\n');
    const r=cp.spawnSync(process.execPath,[path.join(root,'scripts/review25_evidence_claim_consistency.cjs')],{cwd:root,env:{...process.env,RUNNER_LOG:log},encoding:'utf8',timeout:10000});
    assert.strictEqual(r.status,0,'Truthful source should return exit 0');
  }finally{fs.rmSync(tmp,{force:true,recursive:true});}
});
console.log('REVIEW32: '+pass+' PASS, '+fail+' FAIL');
process.exit(fail?1:0);
