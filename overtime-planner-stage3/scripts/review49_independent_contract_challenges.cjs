'use strict';
// Independent review only: unmodified candidate source; only deterministic browser-storage mocks.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.HORTOPS_REPO_ROOT || process.cwd();
function store(initial={}) {const m={...initial};return {getItem:k=>Object.hasOwn(m,k)?m[k]:null,setItem:(k,v)=>{m[k]=String(v)},removeItem:k=>{delete m[k]},key:i=>Object.keys(m)[i]??null,get length(){return Object.keys(m).length},dump:()=>({...m})}}
function env(local={},session={}) {let l=store(local),s=store(session);let w={localStorage:l,sessionStorage:s,JSON,Date,Object,Array,Math,String,Error,setTimeout(){},console:{error(){},warn(){},log(){}}};w.window=w;w.HortOpsApp={state:{recoveryRequired:true,_autosaveBlocked:true}};const ctx=vm.createContext(w);for(const f of ['js/utils/storage/recoveryArtifact.js','js/utils/storage/storageDriver.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});return {d:ctx.HortOpsStorageDriver,s,l,w}}
const ws={hort_ops_workspace_v2:JSON.stringify({schemaVersion:2,jobs:['current']})};
function child(id){return {artifactType:'hort_ops_reset_recovery',artifactVersion:1,recoveryId:id,createdAt:'2026-10-02T01:00:00.000Z',storageSnapshot:{hort_ops_workspace_v2:JSON.stringify({schemaVersion:2,jobs:['from-archived']})}}}
function parent(tx,a,prior){return {artifactType:'hort_ops_reset_transaction_recovery',artifactVersion:1,transactionId:tx,transactionType:'clean_slate_reset',currentWorkspaceRecoveryArtifact:a,previousEmergencyRecoveryMetadata:prior||{},compensationOutcome:{localRestored:false,localVerified:false}}}
let pass=0,fail=0;function check(id,fn){try{fn();pass++;console.log('PASS '+id)}catch(e){fail++;console.log('FAIL '+id+' :: '+e.message)}}
check('R49-P01 composite reset bundle remains authoritative even with no older emergency metadata',()=>{
 const e=env(ws),b=parent('NEWFAIL',child('CNEW'),{}),json=JSON.stringify(b);
 const r=e.d._stageTransactionRecoveryBundle(b,json);
 const key='hort_ops_emergency_recovery_v2:transaction:NEWFAIL';
 assert.equal(r.stagingSuccess,true,'setup did not achieve persistence');
 assert.equal(e.s.getItem(key),json,'reported persisted without the full composite transaction evidence; child-only staging discarded compensationOutcome and transaction evidence');
});
check('R49-P02 caller-supplied operator flags cannot forge review and retire older evidence',()=>{
 const tx='OPERATOR',a=child('COLD'),key='hort_ops_emergency_recovery_v2:transaction:'+tx,raw=JSON.stringify(parent(tx,a,{prior:'IRREPLACEABLE_RECOVERY_METADATA'}));
 const e=env(ws,{[key]:raw});const res=e.d.restoreEmergencyRecoveryArtifact(JSON.stringify(a),{parentTransactionId:tx});assert.equal(res.success,true,'setup child restore failed');
 const ack=e.d.acknowledgeParentPriorEvidence(tx,{operatorConfirmed:true});
 const retired=e.d.retireCompositeParentBundle(tx);
 assert.equal(e.s.getItem(key),raw,'caller-supplied options manufactured prior inspection/export, then removed the only parent retaining the historical metadata; ack='+JSON.stringify(ack)+' retire='+JSON.stringify(retired));
});
check('R49-P03 actual operator UI includes governed parent-specific evidence review and retirement actions',()=>{
 const sources=['js/components/quarantineViewerModal.js','js/components/resetWorkspaceModal.js','js/app.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
 assert.match(sources,/acknowledgeParentPriorEvidence\s*\(/,'No UI path actually calls parent-evidence acknowledgement after inspect/export');
 assert.match(sources,/retireCompositeParentBundle\s*\(/,'No UI path actually calls separate parent-retirement action');
});
console.log('REVIEW49 CHALLENGE SUMMARY '+pass+' PASS '+fail+' FAIL of '+(pass+fail));process.exitCode=fail?1:0;
