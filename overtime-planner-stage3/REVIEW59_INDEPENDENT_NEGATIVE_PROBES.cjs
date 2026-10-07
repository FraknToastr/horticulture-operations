'use strict';
/** Independent Review 59 acceptance probes for PR26_02 and successor candidates.
 * Usage: HORTOPS_ROOT=/path/to/extracted/repository node REVIEW59_INDEPENDENT_NEGATIVE_PROBES.cjs
 * Exit 1 if any safety contract fails. Does not mutate application sources.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const root = process.env.HORTOPS_ROOT || process.argv[2];
if (!root) { console.error('Set HORTOPS_ROOT to a repository containing js/'); process.exit(2); }
global.window=global;
require(path.join(root,'js/app.js'));
require(path.join(root,'js/utils/absences.js'));
require(path.join(root,'js/utils/storage/schemaValidator.js'));
const app=global.HortOpsApp, abs=global.HortOpsAbsences, validator=global.HortOpsSchemaValidator;
const A={id:'A1',staffId:'S',type:'rdo',startDate:'2026-10-10',endDate:'2026-10-10',notes:'INITIAL'};
const R={id:'R1',staffId:'S',date:'2026-10-01'};
const blank=()=>({schemaVersion:2,jobs:[],roster:[],assignments:{},rostering:{instructions:{},provenance:{}},historicalSnapshots:{},permits:{},budgetSettings:{},uiState:{},absences:[structuredClone(A)],refusalHistory:[structuredClone(R)]});
let committed,writes;
function setup(){ committed=blank();writes=0;global.HortOpsScheduler={DEFAULT_BUDGET_SETTINGS:{}};global.HortOpsStorage={loadWorkspace:()=>structuredClone(committed),readVerifiedCommittedV2:()=>({ok:true,exists:true,data:structuredClone(committed)}),createWorkspaceEnvelope:x=>x,saveWorkspace:x=>{committed=structuredClone(x);writes++;return {ok:true}}};app.recomputeDigest=()=>{};app.renderCurrentView=()=>{};app.state={schemaVersion:2};app.init(); }
let fails=0,passes=0;
function check(id,fn){try{let detail=fn();passes++;console.log(`PASS ${id}${detail?' | '+detail:''}`);}catch(e){fails++;console.log(`FAIL ${id}: ${e.message}`);}}
// R59-A: Original Review58 probe tested deleting *both* ledgers; the single-absence path below was untested.
check('R59-P0-A ordinary single-absence deletion with retained refusal MUST be blocked',()=>{setup();let res=app.saveAbsenceAndRefusalData([],structuredClone(committed.refusalHistory));assert.equal(res.success,false,'returned success=true for no-options removal');assert.equal(committed.absences.length,1,'committed absence disappeared');assert.equal(writes,0,'storage written');});
check('R59-BASELINE explicitly declared one-record deletion MUST work',()=>{setup();let res=app.saveAbsenceAndRefusalData([],structuredClone(committed.refusalHistory),{deletedAbsenceIds:['A1'],deletedRefusalIds:[]});assert.equal(res.success,true);assert.equal(committed.absences.length,0);assert.equal(committed.refusalHistory.length,1);});
check('R59-P1-B missing refusal date rejected by canonical schema',()=>{let x=blank();x.refusalHistory=[{id:'R1',staffId:'S'}];let r=validator.validateWorkspaceSchema(x);assert.equal(r.valid,false,'validator accepted missing date');});
check('R59-P1-B invalid refusal date rejected by canonical schema',()=>{let x=blank();x.refusalHistory=[{id:'R1',staffId:'S',date:'2026-02-30'}];let r=validator.validateWorkspaceSchema(x);assert.equal(r.valid,false,'validator accepted invalid Gregorian date');});
check('R59-P1-C duplicate refusal identifiers rejected by canonical schema',()=>{let x=blank();x.refusalHistory=[{id:'R1',staffId:'S',date:'2026-10-01'},{id:'R1',staffId:'S',date:'2026-10-02'}];let r=validator.validateWorkspaceSchema(x);assert.equal(r.valid,false,'validator accepted duplicate refusal IDs');});
check('R59-P1-D stale modal edit cannot silently overwrite more recently committed record with same ID',()=>{setup();const stale=structuredClone(committed.absences);committed.absences[0].notes='LATEST SAVED REVISION';let res=app.saveAbsenceAndRefusalData(stale,structuredClone(committed.refusalHistory),{deletedAbsenceIds:[],deletedRefusalIds:[]});assert.equal(res.success,false,'stale edit accepted');assert.equal(committed.absences[0].notes,'LATEST SAVED REVISION','newer version overwritten');});
check('R59-P2-E missing as-of date does not apply lifetime refusal bonuses',()=>{assert.equal(abs.getStaffRefusalCount('S',[{id:'OLD',staffId:'S',date:'2025-01-01'},{id:'FUTURE',staffId:'S',date:'2027-01-01'}],undefined),0,'undefined asOfDate counted out-of-scope refusals');});
console.log(`REVIEW59 RESULTS: ${passes} PASS, ${fails} FAIL, TOTAL ${passes+fails}`);
process.exitCode=fails?1:0;
