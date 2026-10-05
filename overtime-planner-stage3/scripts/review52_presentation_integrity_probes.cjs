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
function check(label,fn){try{fn();console.log('PASS '+label);pass++}catch(e){console.log('FAIL '+label+' :: '+e.stack);fail++}}
check('R52-P01 missing inspection modal root must not record inspection or permit parent retirement',()=>{
 const e=env('R52_MISSING_ROOT');
 e.w.document.getElementById=(id)=>null;
 e.w.HortOpsQuarantineModal.inspectParentEvidence(e.tx);
 const rec=e.d.resolvedBundles[e.tx];
 const inspected=Boolean(rec.priorEvidenceInspected);
 const ack=e.d.acknowledgeParentPriorEvidence(e.tx,{operatorConfirmed:true});
 const ret=e.d.retireCompositeParentBundle(e.tx);
 console.log('OBSERVE R52-P01:', JSON.stringify({inspected,ackSuccess:ack.success,retireSuccess:ret.success,parentPreserved:e.s.getItem(e.key)===e.raw}));
 assert.equal(inspected,false,'False inspection: no DOM root and no evidence shown');
 assert.equal(ack.success,false,'Acknowledgement must be rejected without displayed evidence');
 assert.equal(ret.success,false,'Retirement must be rejected');
 assert.equal(e.s.getItem(e.key),e.raw,'Parent evidence must remain byte-identical');
});
check('R52-P02 transient recovery inventory read fault during modal render must not authorize retirement',()=>{
 const e=env('R52_RENDER_INVENTORY_FAULT');
 const original=e.s.getItem.bind(e.s);let reads=0;
 e.s.getItem=(key)=>{if(key===e.key && ++reads===2)throw Error('Injected sessionStorage getItem failure during render');return original(key)};
 e.w.HortOpsQuarantineModal.inspectParentEvidence(e.tx);
 const rendered=String(e.container.innerHTML);const rec=e.d.resolvedBundles[e.tx];
 const inspected=Boolean(rec.priorEvidenceInspected);
 const displayed=rendered.includes('IRREPLACEABLE_PRIOR_CONTENT_50');
 const ack=e.d.acknowledgeParentPriorEvidence(e.tx,{operatorConfirmed:true});
 const ret=e.d.retireCompositeParentBundle(e.tx);
 console.log('OBSERVE R52-P02:',JSON.stringify({reads,displayed,inspected,ackSuccess:ack.success,retireSuccess:ret.success,parentPreserved:e.s.getItem(e.key)===e.raw}));
 assert.equal(displayed,false,'Probe precondition: original evidence must be absent from presentation on storage failure');
 assert.equal(inspected,false,'Cannot certify inspection when inventory failed and evidence not displayed');
 assert.equal(ack.success,false,'Acknowledgement must fail closed when inspection did not render evidence');
 assert.equal(ret.success,false,'Parent must not be retired');
 assert.equal(e.s.getItem(e.key),e.raw,'Recovery evidence must remain intact');
});
console.log(`REVIEW52 NEW PROBES ${pass} PASS ${fail} FAIL`);process.exitCode=fail?1:0;
