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
let passed=0,failed=0;function probe(id,fn){try{fn();passed++;console.log('PASS '+id)}catch(e){failed++;console.log('FAIL '+id+' :: '+e.message)}}
probe('R50-P01 Inspect Evidence must actually present selected prior evidence before setting reviewed state',()=>{
 const e=env('INSPECT');e.w.HortOpsQuarantineModal.inspectParentEvidence(e.tx);
 assert.ok(e.d.resolvedBundles[e.tx].priorEvidenceInspected,'setup: inspection not recorded');
 assert.ok(e.container.innerHTML.includes('IRREPLACEABLE_PRIOR_CONTENT_50'),'UI marked evidence inspected but never rendered prior payload; only a count/status banner was shown');
});
probe('R50-P02 failed UI export must not count as successfully exported prior evidence',()=>{
 const e=env('EXPORT');e.w.URL.createObjectURL=()=>{throw new Error('Injected Blob/URL generation failure')};
 e.w.HortOpsQuarantineModal.exportParentEvidence(e.tx);
 assert.ok(e.w.alerts.some(s=>s.includes('Export download failed')),'injected browser export failure was not reached');
 const ack=e.d.acknowledgeParentPriorEvidence(e.tx,{operatorConfirmed:true});
 const ret=e.d.retireCompositeParentBundle(e.tx);
 assert.equal(ack.success,false,'failed download nevertheless allowed evidence acknowledgement: '+JSON.stringify({exported:e.d.resolvedBundles[e.tx].priorEvidenceExported, ack,ret}));
 assert.equal(ret.success,false,'failed download allowed irreversible parent retirement');
 assert.equal(e.s.getItem(e.key),e.raw,'failed download lost retained parent');
});
probe('R50-P03 evidence read exception must reject acknowledgement instead of accepting stale bound copy',()=>{
 const e=env('READFAIL');const viewed=e.d.inspectParentPriorEvidence(e.tx);assert.equal(viewed.success,true,'setup inspect failed');
 const get=e.s.getItem.bind(e.s);e.s.getItem=k=>{if(k===e.key)throw Error('Injected sessionStorage.getItem read exception');return get(k)};
 const ack=e.d.acknowledgeParentPriorEvidence(e.tx,{operatorConfirmed:true});
 assert.equal(ack.success,false,'acknowledgement succeeded despite failed authoritative re-read of parent evidence');
});
probe('R50-P04 empty-prior parent still requires recorded, separate operator acknowledgement before retirement',()=>{
 const e=env('EMPTY',{});const ret=e.d.retireCompositeParentBundle(e.tx);
 assert.equal(ret.success,false,'parent envelope removed without any recorded deliberate acknowledgement (empty metadata does not mean empty parent evidence)');
 assert.equal(e.s.getItem(e.key),e.raw,'unacknowledged composite destroyed');
});
console.log('REVIEW50 INDEPENDENT SUMMARY '+passed+' PASS '+failed+' FAIL of '+(passed+failed));process.exitCode=failed?1:0;
