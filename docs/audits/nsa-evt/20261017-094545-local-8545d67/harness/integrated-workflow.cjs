'use strict';
// Synthetic, in-memory model/API trace. Run from the repository root:
// rtk proxy node docs/audits/nsa-evt/20261017-094545-local-8545d67/harness/integrated-workflow.cjs
// This is not browser/UI evidence. No app files, real workspaces, or network are used.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const OUT = path.resolve(__dirname, '../evidence/integrated-workflow.json');
const ROOT = path.resolve(__dirname, '../../../../..');
const sha = value => createHash('sha256').update(value).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const files = [
  'src/shared/js/rate-library.js', 'src/shared/js/map-costing.js',
  ...['status.js', 'default-rate-catalog.js', 'model.js', 'status-model.js',
    'planner-model.js', 'scheduler-model.js', 'funding-model.js', 'costing-model.js',
    'quote-model.js', 'product-contracts.js', 'budget-model.js', 'data-health.js'
  ].map(file => 'src/program-planner/js/' + file)
];
const at = '2026-10-17T03:00:00.000Z';
const fixture = {
  title: 'Synthetic integrated audit work',
  taskTitle: 'Synthetic irrigation inspection',
  dateReceived: '2026-10-17',
  scheduledDate: '2026-10-19',
  startTime: '09:00', endTime: '11:00',
  labourQuantity: 2, labourRate: 100,
  materialQuantity: 3, materialRate: 10,
  cityAllocation: 300, deposit: 50
};
const attempt = {
  id: 'integrated-' + new Date().toISOString().replace(/[:.]/g, '-'),
  startedAt: new Date().toISOString(), evidenceType: 'in-memory model/API',
  fixture, fixtureSha256: sha(JSON.stringify(fixture)), sourceFiles: files.map(file => ({
    file, sha256: sha(fs.readFileSync(path.join(ROOT, file)))
  })),
  harnessSha256: sha(fs.readFileSync(__filename)), modes: [], limitations: [
    'Register input and approved City allocation are synthetic fixture setup, not UI actions.',
    'No browser interactions, transport, storage, external financial transactions or Outlook import are exercised.',
    'Receipt reversal here invokes the quote model API; UI evidence collection is covered separately.',
    'Project completion is assessed by the existing canonical status API without inventing additional rules.'
  ]
};
function load(owner) {
  const FixedDate = class extends Date {
    constructor(...args) { super(...(args.length ? args : [at])); }
    static now() { return Date.parse(at); }
  };
  let seed = 1729;
  const math = Object.create(Math);
  math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const context = {
    console, structuredClone, TextEncoder, TextDecoder, URLSearchParams,
    Date: FixedDate, Math: math, setTimeout, clearTimeout
  };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({
    appId: owner === 'NSA' ? 'uos.horticulture.nsa' : 'uos.horticulture.events',
    workspaceKind: owner, owner
  }) } };
  vm.createContext(context);
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), context, { filename: file });
  return context.UOS;
}
function run(owner) {
  const row = { owner, startedAt: new Date().toISOString(), checks: [], stages: [], status: 'RUNNING' };
  attempt.modes.push(row);
  let stage = 'load';
  try {
    const U = load(owner), M = U.ProgramModel, P = U.ProgramPlannerModel,
      S = U.ProgramSchedulerModel, C = U.ProgramCosting, Q = U.ProgramQuotes, ST = U.ProgramStatus;
    let ws = M.blank(at);
    const id = owner + (owner === 'NSA' ? '-APP-AUDIT-INTEGRATED' : '-EVENT-AUDIT-INTEGRATED');
    let projectId, taskId, jobId, quoteId, revisionId, depositId, paymentId, labourLineId, materialLineId;
    const check = (label, fn) => {
      fn();
      row.checks.push({ id: owner + '-IWF-' + String(row.checks.length + 1).padStart(2, '0'), label, result: 'PASS' });
    };
    const snap = name => {
      stage = name;
      row.stages.push({ name, at: new Date().toISOString(), stateSha256: sha(JSON.stringify(ws)), counts:
        Object.fromEntries(['applications','events','projects','tasks','jobs','costingLines','quotes','quoteLines','payments','paymentAllocations','statusEvents'].map(k => [k,(ws.entities[k] || []).length])),
        jobs: ws.entities.jobs.map(j => ({ id:j.id,projectId:j.projectId,sourceKind:j.sourceKind,sourceEntityId:j.sourceEntityId,status:j.status,startDate:j.startDate,startTime:j.startTime,endTime:j.endTime })),
        quotes: ws.entities.quotes.map(q => ({ id:q.id,status:q.status,revision:q.revision,previousQuoteId:q.previousQuoteId,fundingMode:q.fundingMode,subtotal:q.subtotal,grandTotal:q.grandTotal,payment:clone(Q.paymentSummary(ws,q.id)) }))
      });
    };
    stage = 'Register fixture and Project promotion';
    ws.entities[owner === 'NSA' ? 'applications' : 'events'].push({
      id, owner, type: owner === 'NSA' ? 'application' : 'event',
      title: fixture.title, dateReceived: fixture.dateReceived, status: 'received'
    });
    const promoted = M.promoteRegisterRecord(ws, id);
    ws = ST.migrate(promoted.workspace); projectId = promoted.project.id;
    ws.entities.projects.find(p => p.id === projectId).funding = { operationalAmount: fixture.cityAllocation };
    ws = M.normalize(ws);
    check('Register owns exactly one Project with owner-preserving parent reference', () => {
      const project = ws.entities.projects.find(p => p.id === projectId);
      assert.equal(project.owner,owner); assert.equal(project[owner === 'NSA' ? 'applicationId' : 'eventId'],id);
      assert.equal(ws.entities.projects.length,1);
    });
    const beforeJobs = ws.entities.jobs.length;
    const task = P.saveTask(ws, projectId, null, {
      title:fixture.taskTitle,description:'Synthetic inspection and preparation before delivery.',
      section:'Pre-delivery',operational:true,status:'Not Started',assigneeId:'Audit team',
      dueDate:fixture.scheduledDate,notes:'Synthetic fixture only',sortOrder:1
    }, {at});
    ws=task.workspace; taskId=task.task.id;
    check('Saving an operational Planner task does not implicitly create a calendar Job', () => {
      assert.equal(ws.entities.jobs.length,beforeJobs); assert.equal(task.job,null);
    });
    snap('Register -> Project -> operational Planner task (no automatic Job)');
    stage='Explicit Planner calendar creation and confirmed Scheduler booking';
    const draft=P.createDraftJob(ws,projectId,taskId,{at}); ws=draft.workspace; jobId=draft.job.id;
    check('Explicit calendar action creates one source-linked Draft Job',()=>{
      assert.equal(draft.created,true);assert.equal(draft.job.sourceKind,'planner');
      assert.equal(draft.job.sourceEntityId,taskId);assert.equal(draft.job.projectId,projectId);
      assert.equal(ST.codeFor('job',draft.job.status),'draft');
    });
    const reopened=P.createDraftJob(ws,projectId,taskId,{at});
    check('Reopening the explicit calendar action reuses the same Job',()=>{
      assert.equal(reopened.created,false);assert.equal(reopened.job.id,jobId);
      assert.equal(reopened.workspace.entities.jobs.length,ws.entities.jobs.length);
    });
    ws=S.scheduleJob(ws,jobId,{startDate:fixture.scheduledDate,endDate:fixture.scheduledDate,
      startTime:fixture.startTime,endTime:fixture.endTime,allDay:false,crewId:'Synthetic audit team'},at);
    // scheduleJob owns Job fields; the existing Planner reopen API reconciles its task link.
    // scheduler.js performs the equivalent link update in the real save handler.
    ws=P.createDraftJob(ws,projectId,taskId,{at}).workspace;
    check('Scheduler confirms times and preserves Planner -> Job ownership',()=>{
      const j=ws.entities.jobs.find(j=>j.id===jobId),t=ws.entities.tasks.find(t=>t.id===taskId);
      assert.equal(j.status,'scheduled');assert.equal(j.startTime,fixture.startTime);assert.equal(j.endTime,fixture.endTime);
      assert.equal(j.durationMinutes,120);assert.equal(t.jobId,jobId);assert.equal(t.schedulerJobId,jobId);
    });
    snap('Explicit calendar Job -> confirmed two-hour booking');
    stage='Rate Library and Costing snapshots';
    for(const rate of [
      {id:'RATE-AUDIT-INTEGRATED-LABOUR',category:'Labour',description:'Synthetic audit labour',unit:'hr',unitRate:fixture.labourRate,quantityMode:'hours',schedulerEnabled:true},
      {id:'RATE-AUDIT-INTEGRATED-MATERIAL',category:'Material',description:'Synthetic audit material',unit:'ea',unitRate:fixture.materialRate,quantityMode:'direct',schedulerEnabled:false}
    ]) ws=C.upsertRateItem(ws,{...rate,active:true});
    ws=C.createLine(ws,'RATE-AUDIT-INTEGRATED-LABOUR',{hours:fixture.labourQuantity},{
      projectId,jobId,discriminator:'integrated-planner-cost',
      provenance:{source:'Synthetic approved Rate Library fixture',owner}
    });
    labourLineId=ws.entities.costingLines.find(l=>l.jobId===jobId).id;
    const jobsBeforeMaterial=ws.entities.jobs.length;
    ws=C.createWork(ws,projectId,'RATE-AUDIT-INTEGRATED-MATERIAL',{quantity:fixture.materialQuantity},
      {operationId:'audit-integrated-material'});
    materialLineId=ws.entities.costingLines.find(l=>l.operationId==='audit-integrated-material').id;
    check('Planner Job cost snapshot retains task, Job, Project and rate lineage',()=>{
      const l=ws.entities.costingLines.find(l=>l.id===labourLineId);
      assert.equal(l.sourceKind,'planner');assert.equal(l.sourceEntityId,taskId);
      assert.equal(l.projectId,projectId);assert.equal(l.rateItemId,'RATE-AUDIT-INTEGRATED-LABOUR');
      assert.equal(l.quantity,2);assert.equal(l.unitRate,100);assert.equal(l.estimatedTotal,200);
    });
    check('Material is costing-only and contributes without creating a Scheduler Job',()=>{
      const l=ws.entities.costingLines.find(l=>l.id===materialLineId);
      assert.equal(l.jobId,null);assert.equal(l.estimatedTotal,30);assert.equal(ws.entities.jobs.length,jobsBeforeMaterial);
      assert.equal(C.totals(ws.entities.costingLines).subtotal,230);
    });
    check('Costing operations leave the scheduled times intact',()=>{
      const j=ws.entities.jobs.find(j=>j.id===jobId);
      assert.equal(j.startDate,fixture.scheduledDate);assert.equal(j.startTime,'09:00');assert.equal(j.endTime,'11:00');
    });
    snap('Scheduled Planner Job -> Labour snapshot + costing-only Material');
    stage='Customer Quote Draft and deposit';
    ws=Q.saveDraft(ws,{projectId,quoteDate:fixture.dateReceived,scopeNotes:'Synthetic irrigation inspection with audit materials.',fundingMode:'customer'});
    quoteId=ws.entities.quotes[0].id;
    check('Customer Draft totals include both snapshots with two decimal currency arithmetic',()=>{
      const q=ws.entities.quotes.find(q=>q.id===quoteId);
      assert.equal(q.subtotal,230);assert.equal(q.grandTotal,253);
      assert.equal(Q.customerAmounts(q).payable,253);
      assert.equal(ws.entities.quoteLines.filter(l=>l.quoteId===quoteId).length,2);
      assert.equal(Q.evaluateReadiness(ws,quoteId).ready,true);
    });
    let quoteSnapshot;
    ws=Q.recordPayment(ws,{quoteId,method:'Paid with Deposit',amount:fixture.deposit,paymentDate:fixture.dateReceived,
      reference:'Synthetic audit deposit',allocations:[{quoteLineId:ws.entities.quoteLines.find(l=>l.quoteId===quoteId).id,amount:fixture.deposit}]});
    depositId=ws.entities.payments[0].id;
    check('Default Customer Draft accepts a deposit and locks commercial values',()=>{
      assert.equal(Q.paymentSummary(ws,quoteId).paid,50);assert.equal(Q.paymentSummary(ws,quoteId).balanceDue,203);
      assert.equal(Q.commerciallyLocked(ws,quoteId),true);
      assert.throws(()=>Q.saveDraft(ws,{projectId,id:quoteId,fundingMode:'city'}),/lock|payment|receipt|stable/i);
    });
    snap('Customer Draft -> allocated deposit');
    stage='Issue, accept, payment and reversals';
    ws=Q.issue(ws,quoteId);
    // Issue deliberately captures City allocation and delivery cost into the snapshot.
    // Immutability begins with that issued snapshot, which acceptance must preserve.
    quoteSnapshot=JSON.stringify(Q.commercialProjection(ws,quoteId));
    ws=Q.accept(ws,quoteId);
    check('Issue and acceptance preserve the deposit and immutable commercial snapshot',()=>{
      assert.equal(ws.entities.quotes.find(q=>q.id===quoteId).status,'Accepted');
      assert.equal(ws.entities.quotes.find(q=>q.id===quoteId).grandTotal,253);
      assert.equal(JSON.stringify(Q.commercialProjection(ws,quoteId)),quoteSnapshot);
      assert.equal(Q.paymentSummary(ws,quoteId).paid,50);
    });
    ws=Q.recordPayment(ws,{quoteId,method:'Bank transfer',amount:203,paymentDate:fixture.dateReceived,reference:'Synthetic final balance'});
    paymentId=ws.entities.payments.find(p=>p.id!==depositId).id;
    check('Balance payment settles the accepted Quote',()=>{
      assert.equal(Q.paymentSummary(ws,quoteId).paid,253);assert.equal(Q.paymentSummary(ws,quoteId).balanceDue,0);
    });
    ws=Q.reversePayment(ws,paymentId,'Synthetic audit: reverse balance for correction');
    check('Reversing balance restores the exact outstanding amount without deleting history',()=>{
      assert.equal(Q.paymentSummary(ws,quoteId).paid,50);assert.equal(Q.paymentSummary(ws,quoteId).balanceDue,203);
      assert.equal(ws.entities.payments.find(p=>p.id===paymentId).status,'Reversed');
    });
    ws=Q.reversePayment(ws,depositId,'Synthetic audit: reverse deposit for revised funding');
    check('Reversing allocated deposit restores full balance and reverses allocation evidence',()=>{
      assert.equal(Q.paymentSummary(ws,quoteId).paid,0);assert.equal(Q.paymentSummary(ws,quoteId).balanceDue,253);
      assert.equal(ws.entities.paymentAllocations.filter(a=>a.paymentId===depositId).length,1);
      assert.equal(ws.entities.paymentAllocations.find(a=>a.paymentId===depositId).status,'Reversed');
      assert.equal(ws.entities.payments.length,2);
    });
    snap('Accepted Quote -> settled -> balance and deposit reversed');
    stage='Revision and funding change';
    ws=Q.createRevision(ws,quoteId);
    revisionId=ws.entities.quotes.find(q=>q.previousQuoteId===quoteId).id;
    ws=Q.saveDraft(ws,{projectId,id:revisionId,fundingMode:'city'});
    check('New revision changes funding without rewriting accepted Quote or receipt history',()=>{
      const revision=ws.entities.quotes.find(q=>q.id===revisionId);
      assert.equal(revision.status,'Draft');assert.equal(revision.revision,2);assert.equal(revision.fundingMode,'city');
      assert.equal(Q.customerAmounts(revision).payable,0);assert.equal(Q.paymentSummary(ws,revisionId).paid,0);
      assert.equal(JSON.stringify(Q.commercialProjection(ws,quoteId)),quoteSnapshot);
      assert.equal(ws.entities.payments.filter(p=>p.quoteId===quoteId).length,2);
      assert.equal(ws.entities.quoteLines.filter(l=>l.quoteId===revisionId).length,2);
      assert.equal(Q.evaluateReadiness(ws,revisionId).ready,true);
    });
    ws=Q.issue(ws,revisionId);ws=Q.accept(ws,revisionId);
    check('Issuing City revision supersedes old version and prohibits new Customer receipts',()=>{
      assert.equal(ws.entities.quotes.find(q=>q.id===quoteId).status,'Superseded');
      assert.equal(ws.entities.quotes.find(q=>q.id===revisionId).status,'Accepted');
      assert.equal(Q.paymentSummary(ws,revisionId).balanceDue,0);
      assert.throws(()=>Q.recordPayment(ws,{quoteId:revisionId,method:'Bank transfer',amount:1,paymentDate:fixture.dateReceived,reference:'Synthetic forbidden receipt'}),/No customer payment required/i);
      assert.throws(()=>Q.recordPayment(ws,{quoteId,method:'Bank transfer',amount:1,paymentDate:fixture.dateReceived,reference:'Synthetic superseded receipt'}),/Superseded/i);
    });
    snap('Revision 2 -> City-funded accepted Quote; Revision 1 preserved');
    stage='Supported canonical work completion';
    ws=ST.transition(ws,{entityId:taskId,entityType:'task',to:'in_progress',actor:'Synthetic audit operator',at:'2026-10-19T00:00:00.000Z'});
    ws=ST.transition(ws,{entityId:jobId,entityType:'job',to:'in_progress',actor:'Synthetic audit operator',at:'2026-10-19T00:00:00.000Z'});
    ws=ST.transition(ws,{entityId:jobId,entityType:'job',to:'completed',actor:'Synthetic audit operator',at:'2026-10-19T02:00:00.000Z'});
    ws=ST.transition(ws,{entityId:taskId,entityType:'task',to:'complete',actor:'Synthetic audit operator',at:'2026-10-19T02:01:00.000Z'});
    check('Completed Job retains scheduled and financial lineage with status evidence',()=>{
      assert.equal(ws.entities.jobs.find(j=>j.id===jobId).status,'completed');
      assert.equal(ws.entities.tasks.find(t=>t.id===taskId).status,'complete');
      assert.ok(ws.entities.statusEvents.filter(e=>e.entityId===jobId).length>=2);
    });
    const openTemplateTasks=ws.entities.tasks.filter(t=>t.projectId===projectId && t.id!==taskId && t.suppressed!==true && !['complete','not_applicable'].includes(ST.codeFor('task',t.status)));
    check('Project completion remains unavailable while its generated checklist is unfinished',()=>{
      assert.ok(openTemplateTasks.length>0);assert.equal(ST.completionEligible(ws,projectId),false);
      assert.throws(()=>ST.transition(ws,{entityId:projectId,entityType:'project',to:'complete',actor:'Synthetic audit operator',at:'2026-10-19T02:02:00.000Z'}),/transition is not allowed/);
      assert.equal(ws.entities.costingLines.length,2);assert.equal(ws.entities.quotes.length,2);
      assert.equal(ws.entities.payments.length,2);assert.equal(ws.entities.jobs.length,1);
    });
    row.blockedSteps=[{step:'Project final completion',result:'NOT TESTED',reason:'The promoted Project includes '+openTemplateTasks.length+' untouched generated checklist tasks. Completion eligibility correctly remains false. The audit does not invent completion evidence for those tasks.'}];
    check('Final canonical schema and owner relationships remain valid',()=>{
      M.assertValid(ws);
      for(const key of ['projects','tasks','jobs','costingLines','quotes','quoteLines','payments','paymentAllocations'])
        for(const entity of ws.entities[key])assert.equal(entity.owner,owner,key+' owner mismatch');
    });
    snap('Job and Task completed; Project completion correctly gated by unfinished generated checklist');
    row.lineage={registerId:id,projectId,taskId,jobId,labourLineId,materialLineId,quoteId,revisionId,depositId,paymentId};
    row.finalWorkspaceSha256=sha(JSON.stringify(ws));
    row.status='PASS';
  } catch(error) {
    row.status='FAIL';row.failure={stage,name:error.name,message:error.message,stack:String(error.stack).split('\n').slice(0,8)};
    row.classification='UNCLASSIFIED: inspect assertion/API error before assigning application defect';
  }
  row.finishedAt=new Date().toISOString();
}
for(const owner of ['NSA','EVT'])run(owner);
attempt.finishedAt=new Date().toISOString();
attempt.counts={modes:attempt.modes.length,passed:attempt.modes.filter(m=>m.status==='PASS').length,
  failed:attempt.modes.filter(m=>m.status==='FAIL').length,
  checksPassed:attempt.modes.reduce((n,m)=>n+m.checks.length,0)};
const previous=fs.existsSync(OUT)?JSON.parse(fs.readFileSync(OUT,'utf8')):{schemaVersion:1,attempts:[]};
for(const prior of previous.attempts)for(const mode of prior.modes) {
  if(mode.failure && mode.failure.stage==='Explicit Planner calendar creation and confirmed Scheduler booking' && /null/.test(mode.failure.message)) {
    mode.classification='HARNESS_ASSERTION: scheduleJob changes Job fields; Scheduler UI separately reconciles task.schedulerJobId. The corrected trace calls the existing Planner reopen API to perform supported reconciliation.';
  }
  if(mode.failure && mode.failure.stage==='Rate Library and Costing snapshots' && /0 !== 2/.test(mode.failure.message)) {
    mode.classification='HARNESS_INPUT: an hours-mode Rate Item requires the hours measurement, not the direct quantity measurement; corrected to the existing Rate Library hours contract.';
  }
  if(mode.failure && mode.failure.stage==='Issue, accept, payment and reversals' && /cityFundingAmount/.test(mode.failure.message)) {
    mode.classification='HARNESS_ASSERTION: Issue intentionally adds cityFundingAmount and estimatedDeliveryCost to its commercial snapshot. Compare immutability after Issue, while independently asserting the unchanged Quote totals.';
  }
  if(mode.failure && mode.failure.stage==='Supported canonical work completion' && /transition is not allowed/.test(mode.failure.message)) {
    mode.classification='HARNESS_SEQUENCE: Task completion must follow Not Started -> In Progress -> Complete; the earlier attempt omitted the Task In Progress transition. Job scheduled -> in_progress -> completed had already passed.';
  }
  if(mode.failure && mode.failure.stage==='Supported canonical work completion' && /false !== true/.test(mode.failure.message)) {
    mode.classification='HARNESS_FIXTURE: Project promotion includes untouched generated checklist tasks; completing only the exercised Task/Job does not satisfy projectEligible. The corrected trace verifies the gate and records final Project completion NOT TESTED instead of inventing completion evidence.';
  }
}
previous.attempts.push(attempt);
fs.writeFileSync(OUT,JSON.stringify(previous,null,2)+'\n');
console.log(JSON.stringify({attempt:attempt.id,counts:attempt.counts,failures:attempt.modes.filter(m=>m.failure).map(m=>({owner:m.owner,failure:m.failure})),evidence:OUT}));
process.exitCode=attempt.counts.failed?1:0;

