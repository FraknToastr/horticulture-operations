'use strict';
// Review 53: a single targeted source-driven check on the new receipt API.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=process.env.HORTOPS_REPO_ROOT||process.cwd();
function store(seed){const m={...seed};return{getItem(k){return Object.hasOwn(m,k)?m[k]:null},setItem(k,v){m[k]=String(v)},removeItem(k){delete m[k]},key(i){return Object.keys(m)[i]??null},get length(){return Object.keys(m).length}}}
const tx='R53_UNPRESENTED', prior={'hort_ops_emergency_recovery_v2:prior':'UNIQUE_IRREPLACEABLE_HISTORICAL_EVIDENCE'};
const child={artifactType:'hort_ops_reset_recovery',artifactVersion:1,recoveryId:'R53_CHILD',createdAt:'2026-10-02T07:30:00Z',storageSnapshot:{hort_ops_workspace_v2:'{"schemaVersion":2,"jobs":[]}'}};
const parent={artifactType:'hort_ops_reset_transaction_recovery',artifactVersion:1,transactionId:tx,transactionType:'clean_slate_reset',currentWorkspaceRecoveryArtifact:child,previousEmergencyRecoveryMetadata:prior,compensationOutcome:{localRestored:false,localVerified:false}};
const key='hort_ops_emergency_recovery_v2:transaction:'+tx, raw=JSON.stringify(parent);
const sessionStorage=store({[key]:raw}),localStorage=store({hort_ops_workspace_v2:'{"schemaVersion":2,"jobs":["active"]}'});
const w={sessionStorage,localStorage,Date,JSON,Object,Array,String,Math,Error,console:{log(){},error(){},warn(){}},setTimeout(f){f()},window:null,HortOpsApp:{state:{recoveryRequired:true,_autosaveBlocked:true}}};w.window=w;
const ctx=vm.createContext(w);
for(const f of ['js/utils/storage/recoveryArtifact.js','js/utils/storage/storageDriver.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const driver=w.HortOpsStorageDriver;
const restored=driver.restoreEmergencyRecoveryArtifact(JSON.stringify(child),{parentTransactionId:tx});assert.equal(restored.success,true,'precondition: child restore');
const inspection=driver.recordParentEvidenceInspected(tx); // Deliberately no render, no receipt, no parent presentation.
const ack=driver.acknowledgeParentPriorEvidence(tx,{operatorConfirmed:true});
const retired=driver.retireCompositeParentBundle(tx);
const evidenceLeft=sessionStorage.getItem(key)===raw;
console.log('OBSERVED',JSON.stringify({inspectionSuccess:inspection.success,receipt:inspection.receipt??null,acknowledgementSuccess:ack.success,retirementSuccess:retired.success,parentEvidencePreserved:evidenceLeft}));
try{
 assert.equal(inspection.success,false,'Must reject inspection without any presentation receipt');
 assert.equal(ack.success,false,'Must reject subsequent acknowledgement');
 assert.equal(retired.success,false,'Must not retire parent with unpresented prior evidence');
 assert.equal(evidenceLeft,true,'Must preserve original historical bytes');
 console.log('REVIEW53 RECEIPT CONTRACT 1 PASS 0 FAIL');
}catch(e){console.log('REVIEW53 RECEIPT CONTRACT 0 PASS 1 FAIL:',e.message);process.exitCode=1}
