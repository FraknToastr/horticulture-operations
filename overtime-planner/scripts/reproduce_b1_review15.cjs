/* Review 15 discriminator: one owner, canonical assignments representation.
 * Copy to PROJECT_ROOT/scripts/reproduce_b1_review15.cjs; run node scripts/reproduce_b1_review15.cjs
 * Against submitted PR14: 3 failing conditions, 2 controls passing. */
'use strict';
var assert = require('assert');
var path = require('path');
var root = path.resolve(__dirname, '..');
var data = Object.create(null);
var localStorage = {
  getItem: function(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
  setItem: function(k,v) { data[k] = String(v); },
  removeItem: function(k) { delete data[k]; },
  clear: function() { data = Object.create(null); }
};
global.window = {localStorage:localStorage};global.localStorage=localStorage;
[
  'js/data/holidays.js','js/data/initialJobs.js','js/data/staffRoster.js',
  'js/data/historicalOccurrences.js','js/utils/icons.js','js/utils/securityUtils.js',
  'js/utils/dateUtils.js','js/utils/storage/schemaValidator.js',
  'js/utils/storage/migrationEngine.js','js/utils/storage/storageDriver.js',
  'js/utils/storage.js'
].forEach(function(n){require(path.join(root,n));});
var validator=window.HortOpsSchemaValidator,storage=window.HortOpsStorage,key=storage.WORKSPACE_STORAGE_KEY;
var failures=0,total=0;
function workspace(){return {schemaVersion:2,jobs:[],roster:[],assignments:{},historicalSnapshots:{},rostering:{instructions:{},provenance:{}},permits:{},budgetSettings:{},uiState:{}};}
function check(label,fn){total++;try{fn();console.log('PASS '+label);}catch(e){failures++;console.log('FAIL '+label+' :: '+e.message);}}
var id='JOB-REVIEW@2027-01-02';
check('CONTROL canonical assignment persists and reloads',function(){localStorage.clear();var b=workspace();b.assignments[id]=['EMP-01'];assert.strictEqual(storage.saveWorkspace(b).ok,true);var x=storage.loadWorkspace([],[],{});assert.strictEqual(x.recoveryRequired,false);assert.deepStrictEqual(x.assignments[id],['EMP-01']);});
check('B1-15-01 alias-only current v2 is rejected at public boundary',function(){var a=workspace();delete a.assignments;a.customAssignments={};a.customAssignments[id]=['EMP-02'];assert.strictEqual(validator.validateCurrentV2ForBoundary(a).valid,false);});
check('B1-15-01 direct save cannot commit unroundtrippable alias-only current v2',function(){localStorage.clear();var x=workspace();x.assignments[id]=['EMP-01'];assert.strictEqual(storage.saveWorkspace(x).ok,true);var raw=localStorage.getItem(key);var a=workspace();delete a.assignments;a.customAssignments={};a.customAssignments[id]=['EMP-02'];assert.strictEqual(storage.saveWorkspace(a).ok,false);assert.strictEqual(localStorage.getItem(key),raw);});
check('B1-15-01 contradictory dual assignment maps are rejected, never silently prioritised',function(){var a=workspace();a.assignments[id]=['EMP-01'];a.customAssignments={};a.customAssignments[id]=['EMP-02'];assert.strictEqual(validator.validateCurrentV2ForBoundary(a).valid,false);});
check('CONTROL canonical current v2 backup import still validates',function(){var x=workspace();x.assignments[id]=['EMP-01'];assert.strictEqual(storage.prepareWorkspaceJsonImport(JSON.stringify(x)).success,true);});
console.log('REVIEW15: '+(total-failures)+'/'+total+' passed; '+failures+' gap(s)');process.exitCode=failures?1:0;
