'use strict';
// Review 50: independent contract probes. No production modifications.
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=process.env.HORTOPS_REPO_ROOT||process.cwd();
function store(seed={}){const d={...seed};return{getItem(k){return Object.hasOwn(d,k)?d[k]:null},setItem(k,v){d[k]=String(v)},removeItem(k){delete d[k]},key(i){return Object.keys(d)[i]??null},get length(){return Object.keys(d).length},dump(){return {...d}}}}
function art(id){return {artifactType:'hort_ops_reset_recovery',artifactVersion:1,recoveryId:id,createdAt:'2026-10-02T04:00:00Z',storageSnapshot:{hort_ops_workspace_v2:'{"schemaVersion":2,"jobs":[]}'}}}
function env(tx='R50TX',prior={'hort_ops_emergency_recovery_v2:prior-unique':'IRREPLACEABLE_PRIOR_CONTENT_50'}){
 const child=art('C50'),parent={artifactType:'hort_ops_reset_transaction_recovery',artifactVersion:1,transactionId:tx,transactionType:'clean_slate_reset',currentWorkspaceRecoveryArtifact:child,previousEmergencyRecoveryMetadata:prior,compensationOutcome:{localRestored:false,localVerified:false}};
 const key='hort_ops_emergency_recovery_v2:transaction:'+tx,raw=JSON.stringify(parent),s=store({[key]:raw}),l=store({hort_ops_workspace_v2:'{"schemaVersion":2,"jobs":["live"]}'}),container={innerHTML:''};
 const alerts=[];const w={sessionStorage:s,localStorage:l,Date,JSON,Object,Array,String,Math,Error,setTimeout(fn){fn()},confirm(){return true},alerts,alert(x){alerts.push(String(x))},console:{log(){},error(){},warn(){}},document:{getElementById(id){return container},body:{appendChild(){},removeChild(){}},createElement(){return {click(){}}}},HortOpsIcons:{render(){return 'icon'}},HortOpsSecurityUtils:{escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}},URL:{createObjectURL(){return 'blob:test'},revokeObjectURL(){}},Blob:function(parts){this.parts=parts}};
 w.window=w;w.HortOpsApp={state:{recoveryRequired:true,_autosaveBlocked:true,recoverySource:'emergency_session_backup',emergencyRecoveryPayload:null}};
 const ctx=vm.createContext(w);
 for(const file of ['js/utils/storage/recoveryArtifact.js','js/utils/storage/storageDriver.js','js/components/quarantineViewerModal.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
 const d=ctx.HortOpsStorageDriver;w.HortOpsStorageDriver=d;w.HortOpsStorage=d;
 const restore=d.restoreEmergencyRecoveryArtifact(JSON.stringify(child),{parentTransactionId:tx});assert.equal(restore.success,true,'setup restore '+JSON.stringify(restore));
 assert.equal(s.getItem(key),raw,'parent must remain after child restore');
 return {w,d,s,key,raw,tx,parent,container};
}

let pass=0,fail=0;
function test(label, f){try{f();console.log('PASS '+label);pass++}catch(e){console.log('FAIL '+label+' :: '+e.message);fail++}}

test('R51-P01 prepared evidence alone MUST NOT allow API-only export marking and retirement',()=>{
 const e=env('R51_DIRECT_EXPORT');
 const p=e.d.prepareParentEvidenceExport(e.tx);
 assert.equal(p.success,true,'setup prep');
 // No UI was opened; no Blob was generated and no file downloaded.
 const forged=e.d.exportParentPriorEvidence(e.tx,{markExported:true});
 assert.equal(forged.success,true,'export-only interface reached');
 const ack=e.d.acknowledgeParentPriorEvidence(e.tx);
 const retired=e.d.retireCompositeParentBundle(e.tx);
 assert.equal(retired.success,false,'Parent retired without actual export, inspection, or explicit confirmation: '+JSON.stringify({forged,ack,retired}));
 assert.equal(e.s.getItem(e.key),e.raw,'parent bytes must remain untouched');
});

test('R51-P02 inspection alone MUST NOT auto-confirm separate parent acknowledgement',()=>{
 const e=env('R51_NO_CONFIRM');
 const view=e.d.inspectParentPriorEvidence(e.tx);
 assert.equal(view.success,true,'setup inspection');
 // No separate affirmative confirmation provided.
 const ack=e.d.acknowledgeParentPriorEvidence(e.tx,{operatorConfirmed:false});
 assert.equal(ack.success,false,'inspection is incorrectly treated as affirmative confirmation: '+JSON.stringify(ack));
 const ret=e.d.retireCompositeParentBundle(e.tx);
 assert.equal(ret.success,false,'parent retired with no explicit confirmation');
 assert.equal(e.s.getItem(e.key),e.raw,'parent evidence preserved');
});

test('R51-P03 inspect failing before modal renders MUST NOT leave successful inspection authorisation',()=>{
 const e=env('R51_RENDER_FAULT');
 e.w.HortOpsQuarantineModal.renderModal=function(){throw Error('Injected DOM render failure')};
 try{e.w.HortOpsQuarantineModal.inspectParentEvidence(e.tx)}catch(_e){}
 const rec=e.d.resolvedBundles[e.tx];
 assert.equal(Boolean(rec.priorEvidenceInspected),false,'inspection flagged complete before any evidence could be presented');
 assert.equal(e.s.getItem(e.key),e.raw,'parent preserved');
});
console.log(`REVIEW51 CHALLENGES: ${pass} PASS ${fail} FAIL of ${pass+fail}`);
process.exitCode=fail?1:0;
