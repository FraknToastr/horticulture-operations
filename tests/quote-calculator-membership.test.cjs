const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
function fixture(owner){
  const c={console,structuredClone,URLSearchParams,crypto};c.window=c;
  c.UOS={ProgramAppConfig:{current:()=>({appId:owner==='NSA'?'uos.horticulture.nsa':'uos.horticulture.events',owner,workspaceKind:owner})},ProgramDates:{today:()=> '2026-10-15'}};
  vm.createContext(c);for(const file of ['status.js','default-rate-catalog.js','model.js','funding-model.js','quote-model.js'])vm.runInContext(fs.readFileSync('src/program-planner/js/'+file,'utf8'),c);
  const U=c.UOS,w=U.ProgramModel.blank(),parentId=owner+(owner==='NSA'?'-APP-':'-EVENT-')+'MEMBERSHIP',projectId=owner+'-PROJ-MEMBERSHIP';
  w.entities[owner==='NSA'?'applications':'events'].push({id:parentId,owner,type:owner==='NSA'?'application':'event',title:'Membership',status:'received',dateReceived:'2026-10-15'});
  w.entities.projects.push({id:projectId,owner,type:'project',[owner==='NSA'?'applicationId':'eventId']:parentId});
  const line=(suffix,total)=>({id:owner+'-COST-'+suffix,owner,type:'costingLine',projectId,kind:'Material',description:suffix,quantity:1,unit:'item',unitRate:total,estimatedTotal:total});
  w.entities.costingLines.push(line('ORIGINAL',100));
  return {U,w,projectId,line};
}
for(const owner of ['NSA','EVT'])test(owner+': Draft membership preserves history, survives refresh/import, and respects payment locks',()=>{
  const {U,w:initial,projectId,line}=fixture(owner),Q=U.ProgramQuotes;
  let w=Q.saveDraft(initial,{projectId,quoteDate:'2026-10-15',scopeNotes:'Horticulture work',fundingMode:'customer',customLines:[{id:'custom',description:'Adjustment',quantity:1,rate:5,costBasis:'authorised-manual'}]});
  w.entities.quoteLines.find(l=>l.sourceKind==='custom').rateItemId=w.entities.rateItems[0].id;
  const originalId=w.entities.quotes[0].id;
  w=Q.issue(w,originalId);
  const history=JSON.stringify({quote:w.entities.quotes[0],lines:w.entities.quoteLines});
  w=Q.createRevision(w,originalId);const draftId=w.entities.quotes[1].id,sourceId=w.entities.costingLines[0].id;
  w=Q.setDraftCostingLineIncluded(w,draftId,sourceId,false);
  assert.equal(w.entities.costingLines.length,1);
  assert.equal(w.entities.quoteLines.filter(l=>l.quoteId===draftId&&l.costingLineId===sourceId).length,0);
  assert.equal(w.entities.quotes[1].subtotal,5);
  w=Q.refreshDraftFromCurrentCosts(w,draftId,{confirmed:true});
  assert.equal(w.entities.quoteLines.filter(l=>l.quoteId===draftId&&l.costingLineId===sourceId).length,0);
  w.entities.costingLines.push(line('NEW',25));
  w=Q.syncDraftCostingLines(w,draftId,[line('NEW',25).id]);
  assert.equal(w.entities.quotes[1].subtotal,30);
  assert.equal(JSON.stringify({quote:w.entities.quotes.find(q=>q.id===originalId),lines:w.entities.quoteLines.filter(l=>l.quoteId===originalId)}),history);
  w=U.ProgramModel.normalize(JSON.parse(JSON.stringify(w)));
  assert.equal(w.entities.quotes[1].excludedCostingLineIds[0],sourceId);
  w.entities.costingLines[0].quantity=2;w.entities.costingLines[0].estimatedTotal=200;
  w=Q.setDraftCostingLineIncluded(w,draftId,sourceId,true);
  assert.equal(w.entities.quotes[1].subtotal,230);
  assert.equal(w.entities.quoteLines.find(l=>l.quoteId===originalId&&l.costingLineId===sourceId).quantity,1);
  assert.throws(()=>Q.setDraftCostingLineIncluded(w,originalId,sourceId,false),/unpaid Draft/);
  w=Q.recordPayment(w,{quoteId:draftId,amount:10,paymentDate:'2026-10-15',reference:'Deposit',method:'Bank transfer'});
  assert.throws(()=>Q.setDraftCostingLineIncluded(w,draftId,sourceId,false),/unpaid Draft/);
  assert.throws(()=>Q.syncDraftCostingLines(w,draftId,[sourceId]),/unpaid Draft/);
  assert.throws(()=>Q.saveDraft(w,{id:draftId,projectId,excludedCostingLineIds:[sourceId]}),/Reverse active payments/);
});

test('Exclusions carry into the next revision and cannot reference another Project',()=>{
  const {U,w:initial,projectId}=fixture('NSA'),Q=U.ProgramQuotes;
  initial.entities.projects[0].funding={operationalAmount:100};
  let w=Q.saveDraft(initial,{projectId,quoteDate:'2026-10-15',fundingMode:'city'}),id=w.entities.quotes[0].id;
  const sourceId=w.entities.costingLines[0].id;
  w=Q.setDraftCostingLineIncluded(w,id,sourceId,false);
  w=Q.saveDraft(w,{id,projectId,customLines:[{id:'manual',description:'Manual',quantity:1,rate:10}]});
  // Preserve a valid cost basis while testing the next revision's membership.
  w.entities.quoteLines.find(l=>l.quoteId===id).rateItemId=w.entities.rateItems[0].id;
  w=Q.issue(w,id);w=Q.createRevision(w,id);
  assert.equal(w.entities.quotes[1].excludedCostingLineIds[0],sourceId);
  assert.equal(w.entities.quoteLines.some(l=>l.quoteId===w.entities.quotes[1].id&&l.costingLineId===sourceId),false);
  const otherProject='NSA-PROJ-OTHER',otherLine='NSA-COST-OTHER';
  w.entities.applications.push({...w.entities.applications[0],id:'NSA-APP-OTHER'});
  w.entities.projects.push({...w.entities.projects[0],id:otherProject,applicationId:'NSA-APP-OTHER'});
  w.entities.costingLines.push({...w.entities.costingLines[0],id:otherLine,projectId:otherProject});
  assert.throws(()=>Q.setDraftCostingLineIncluded(w,w.entities.quotes[1].id,otherLine,true),/does not belong/);
});
