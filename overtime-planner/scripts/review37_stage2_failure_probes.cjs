'use strict';
// Review 37 independent regression tests. Run from scripts/ in the project root.
// Expected PR23 baseline: three INTENDED RED findings. After fixes: all green.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
function mockStorage(initial, failRemove) {
  const data = Object.assign(Object.create(null), initial || {});
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(data,k) ? data[k] : null; },
    setItem(k,v) { data[k] = String(v); },
    removeItem(k) { if (failRemove && failRemove(k)) throw new Error('Injected removeItem denial: ' + k); delete data[k]; },
    key(i) { return Object.keys(data)[i] || null; },
    get length() { return Object.keys(data).length; }
  };
}
function load(relative, context) { vm.runInContext(fs.readFileSync(path.join(root,relative),'utf8'),context,{filename:relative}); }
function build(localStorage) {
  const ctx = vm.createContext({window:{localStorage},console,Date,JSON,Object,Array,Math,String,Error});
  ctx.window.window=ctx.window;
  load('js/utils/storage/storageDriver.js', ctx);
  load('js/utils/storage.js', ctx);
  load('js/app.js', ctx); // no document => no auto bootstrap
  const app=ctx.window.HortOpsApp;
  app.recomputeDigest=function(){};
  app.renderCurrentView=function(){};
  ctx.window.HortOpsScheduler={clearBoundaryCache:function(){},DEFAULT_BUDGET_SETTINGS:{annualTarget:0}};
  return {ctx,app,driver:ctx.window.HortOpsStorageDriver};
}
const tests = [
  ['R37-P1: Failed reset must not report success or clear live state', () => {
    const ls=mockStorage({'hort_ops_workspace_v2':'{"jobs":[{"id":"synthetic"}]}','unrelated':'keep'},k=>k==='hort_ops_workspace_v2');
    const {app}=build(ls);
    app.state.jobs=[{id:'synthetic'}];
    const result=app.resetToCleanSlate();
    assert.notStrictEqual(result,true,'A failed persistent wipe cannot return true');
    assert.strictEqual(app.state.jobs.length,1,'Retain live data when wipe fails');
    assert.ok(ls.getItem('hort_ops_workspace_v2'),'Preserve evidence for retry');
    assert.strictEqual(ls.getItem('unrelated'),'keep');
  }],
  ['R37-P2: Compaction deletion failures must be reported truthfully', () => {
    const ls=mockStorage({'hort_ops_custom_staff_v1':'synthetic','unrelated':'keep'},k=>k==='hort_ops_custom_staff_v1');
    const {driver}=build(ls);
    const res=driver.compactStorage();
    assert.strictEqual(res.success,false,'Partial compaction cannot claim success');
    assert.strictEqual(ls.getItem('hort_ops_custom_staff_v1'),'synthetic');
  }],
  ['R37-P3: Persistence probe must clean up on read mismatch', () => {
    const ls=mockStorage({'unrelated':'keep'});
    const oldGet=ls.getItem.bind(ls);
    ls.getItem=function(k){if(k==='__hort_ops_persistence_probe__')return 'mismatch';return oldGet(k);};
    const {driver}=build(ls);
    const health=driver.getStorageHealth();
    assert.strictEqual(health.probeOk,false);
    assert.strictEqual(oldGet('__hort_ops_persistence_probe__'),null,'Probe key must not linger after failure');
  }]
];
let failed=0;
for(const [name,fn] of tests){try{fn();console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+' :: '+e.message);}}
console.log('TOTAL '+(tests.length-failed)+' PASS, '+failed+' FAIL');
process.exitCode=failed?1:0;
