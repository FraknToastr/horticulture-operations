/*
 * Independent Review 14 B1 discriminating probes — standalone, portable.
 * Copy to scripts/reproduce_b1_review14.cjs, then run:
 *   node scripts/reproduce_b1_review14.cjs
 * Each numbered assertion describes required behaviour, not current PR13 behaviour.
 * Expected against submitted PR13: some FAIL; expected after corrective patch: 0 FAIL.
 */
'use strict';
var path = require('path');
var root = path.resolve(__dirname, '..');
var store = {};
var ls = {
  getItem: function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function(k, v) { store[k] = String(v); },
  removeItem: function(k) { delete store[k]; },
  clear: function() { store = {}; }
};
global.window = {localStorage: ls};
global.localStorage = ls;
[
  'js/data/holidays.js','js/data/initialJobs.js','js/data/staffRoster.js',
  'js/data/historicalOccurrences.js','js/utils/icons.js','js/utils/securityUtils.js',
  'js/utils/dateUtils.js','js/utils/storage/schemaValidator.js',
  'js/utils/storage/migrationEngine.js','js/utils/storage/storageDriver.js',
  'js/utils/storage.js','js/utils/eligibilityEngine.js','js/utils/rostering/engine.js',
  'js/utils/scheduler/costCalculator.js','js/utils/scheduler/engine.js',
  'js/utils/scheduler.js','js/app.js','js/components/exportModal.js'
].forEach(function(file) { require(path.join(root, file)); });
var v = window.HortOpsSchemaValidator;
var s = window.HortOpsStorage;
var app = window.HortOpsApp;
var exporter = window.HortOpsExportModal;
var key = s.WORKSPACE_STORAGE_KEY;
var failures = 0;
var tests = 0;
function check(name, fn) {
  tests++;
  try {
    if (!fn()) throw new Error('condition false');
    console.log('PASS ' + name);
  } catch (e) {
    failures++;
    console.log('FAIL ' + name + ' — ' + (e.message || e));
  }
}
function blank() {
  return {schemaVersion:2,jobs:[],roster:[],assignments:{},
    rostering:{instructions:{},provenance:{}},historicalSnapshots:{},
    permits:{},budgetSettings:{},uiState:{}};
}
function copy(o) { return JSON.parse(JSON.stringify(o)); }
function illegalCtor(input) {
  try { s.createWorkspaceEnvelope(input); return false; }
  catch(e) { return true; }
}
function rejected(input) {
  try { return v.validateCurrentV2ForBoundary(input).valid === false; }
  catch(e) { return false; }
}
function baseline() {
  ls.clear();
  var x=blank();x.assignments={'job-1@2027-01-02':['staff-1']};
  var res=s.saveWorkspace(x);
  if (!res || !res.ok) throw new Error('baseline save failed');
  return ls.getItem(key);
}
check('00 valid explicit-empty v2 accepted', function() {
  return v.validateCurrentV2ForBoundary(blank()).valid && !illegalCtor(blank());
});
check('01 constructor rejects absent and null assignments', function() {
  var a=blank(),b=blank();delete a.assignments;b.assignments=null;
  return illegalCtor(a) && illegalCtor(b);
});
check('02 raw save rejects absent and null assignments without byte loss', function() {
  var original=baseline(),a=blank(),b=blank();delete a.assignments;b.assignments=null;
  return !s.saveWorkspace(a).ok && !s.saveWorkspace(b).ok && ls.getItem(key)===original;
});
check('03 app.saveCurrentWorkspace rejects null assignments without byte loss', function() {
  var original=baseline();app.init();app.state.customAssignments=null;
  return app.saveCurrentWorkspace() === false && ls.getItem(key)===original;
});
check('04 JSON backup rejects null assignments and downloads nothing', function() {
  var original=baseline(),out=0,originalFn=exporter.downloadFile;
  app.init();app.state.customAssignments=null;
  exporter.downloadFile=function(){out++;};
  var result=exporter.exportBackupJson();exporter.downloadFile=originalFn;
  return result===false && out===0 && ls.getItem(key)===original;
});
check('05 load of current-v2 missing assignments enters Recovery Required unchanged',function(){
  var x=blank();delete x.assignments;ls.clear();var raw=JSON.stringify(x);ls.setItem(key,raw);
  var loaded=s.loadWorkspace([],[],{});
  return loaded.recoveryRequired===true && ls.getItem(key)===raw;
});
check('06 JSON import and real restore reject absent/null assignments without mutation',function(){
  var before=baseline();app.init();var originalState=JSON.stringify(app.state);
  var no=blank();delete no.assignments;var nul=blank();nul.assignments=null;
  var importResult=s.prepareWorkspaceJsonImport(JSON.stringify(no));
  var restoreResult=app.restoreWorkspaceJson(nul);
  return importResult.success===false && restoreResult===false &&
    ls.getItem(key)===before && JSON.stringify(app.state)===originalState;
});
check('07 reject malformed assignment-map values and IDs',function(){
  var a=blank(),b=blank(),c=blank(),d=blank();
  a.assignments={'job-1@2027-01-02':'text'};
  b.assignments={'job-1@2027-01-02':[12,null]};
  c.assignments={'job-1@2027-01-02':['', 'emp-1']};
  d.assignments={'job-1@2027-01-02':['emp-1','emp-1']};
  return rejected(a)&&rejected(b)&&rejected(c)&&rejected(d);
});
check('08 recordType whitelist rejects inherited prototype keys',function(){
  var k='job-1@2027-01-02',snap={shiftId:k,jobId:'job-1',date:'2027-01-02',startTime:'08:00 PM',durationHours:8,recordType:'scheduled_commitment'};
  var accepted=v.validateScheduledCommitment(k,snap).valid;
  var bad=['constructor','toString','__proto__','valueOf'];
  return accepted&&bad.every(function(t){var s2=copy(snap);s2.recordType=t;return v.validateScheduledCommitment(k,s2).valid===false;});
});
check('09 snapshot employee IDs use prototype-safe duplicate detection',function(){
  var k='job-1@2027-01-02',snap={shiftId:k,jobId:'job-1',date:'2027-01-02',startTime:'08:00 PM',durationHours:8,assignedStaffIds:['toString']};
  return v.validateScheduledCommitment(k,snap).valid===true;
});
check('10 null Job and roster entries reject with normal validation result, not throw',function(){
  var a=blank(),b=blank();a.jobs=[null];b.roster=[null];
  return rejected(a)&&rejected(b);
});
console.log('REVIEW14 ' + (tests-failures) + '/' + tests + ' passed; ' + failures + ' gap(s)');
process.exitCode=failures?1:0;
