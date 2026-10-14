/* Explicit, isolated hosted-app audit. No existing browser profile is opened. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
delete process.env.PLAYWRIGHT_BROWSERS_PATH;
const {chromium, expect} = require('@playwright/test');
const ROOT = path.resolve(__dirname, '../..');
const OUT = path.join(ROOT, process.env.READINESS_OUTPUT || 'test-results/nsa-demo-readiness');
const INPUT = path.join(ROOT, 'src/sample/nsa-workspace-2026-27-area-pricing-v5.json');
const URL = process.env.READINESS_URL || 'https://frakntoastr.github.io/horticulture-operations/src/program-planner/nsa.html';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const source = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
const counts = ws => Object.fromEntries(Object.entries(ws.entities).map(([k,v])=>[k,v.length]));
const canonical = value => Array.isArray(value) ? value.map(canonical).sort((a,b)=>String(a?.id||JSON.stringify(a)).localeCompare(String(b?.id||JSON.stringify(b)))) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
fs.mkdirSync(path.join(OUT,'artifacts'),{recursive:true});
const report = {started:new Date().toISOString(),target:URL,input:path.relative(ROOT,INPUT),inputSha256:sha(fs.readFileSync(INPUT)),baseline:counts(source),platform:process.platform,setupWorkaround:'Reload after navigating to Settings before import: first navigation creates stored revision 1 while memory stays at revision 0. Cold import failure is recorded separately.',scenarios:[],assets:[],errors:[],requests:[]};
const persist=()=>fs.writeFileSync(path.join(OUT,'workspace-results.json'),JSON.stringify(report,null,2));
let browser, currentPage;
const pendingAssets = new Set();
async function scenario(id,title,expected,work,group='Workspace') {
 if(process.env.READINESS_ONLY&&!process.env.READINESS_ONLY.split(',').includes(id))return;
 const start=Date.now(); const r={id,title,group,expected,status:'not run'};report.scenarios.push(r);persist();
 try {r.observed=await work();r.status='passed';}
 catch(e){r.status='failed';r.observed=e.message;r.stack=e.stack; if(currentPage&&!currentPage.isClosed())try{const p=path.join(OUT,'artifacts',id+'.png');await currentPage.screenshot({path:p});r.evidence=path.relative(OUT,p);}catch(_){} }
 r.durationMs=Date.now()-start;persist();console.log(JSON.stringify({id,status:r.status,observed:r.observed}));
}
async function context(){return browser.newContext({viewport:{width:1600,height:1000},acceptDownloads:true});}
async function open(ctx,url=URL){
 const page=await ctx.newPage();currentPage=page;page.setDefaultTimeout(12000);
 page.on('pageerror',e=>{report.errors.push({url:page.url(),message:e.message});persist();});
 page.on('requestfailed',r=>{report.requests.push({url:r.url(),error:r.failure()?.errorText});});
 page.on('response',r=>{if(r.status()>=400)report.requests.push({url:r.url(),status:r.status()});
  if(r.url().startsWith('https://frakntoastr.github.io/horticulture-operations/') && r.status()===200){
   const task=(async()=>{try{const relative=decodeURIComponent(new global.URL(r.url()).pathname).replace('/horticulture-operations/','');const local=path.join(ROOT,relative);if(fs.existsSync(local)&&fs.statSync(local).isFile()){const remoteHash=sha(await r.body()),localHash=sha(fs.readFileSync(local));if(!report.assets.some(x=>x.path===relative))report.assets.push({path:relative,remoteHash,localHash,match:remoteHash===localHash});}}catch(e){report.requests.push({url:r.url(),inspectionError:e.message});}})();pendingAssets.add(task);task.finally(()=>pendingAssets.delete(task));
  }});
 await page.goto(url,{waitUntil:'load',timeout:60000});
 const frame=page.frames().find(f=>f!==page.mainFrame());assert(frame,'Workspace iframe exists');
 await frame.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready',null,{timeout:45000});
 return {page,frame};
}
async function dismiss(f){const b=f.locator('[data-program-backup-later]');if(await b.isVisible())await b.click();}
async function data(f){await dismiss(f);if(!await f.locator('[data-program-smart-import]').isVisible())await f.locator('[data-program-destination="data"]').click();await expect(f.locator('[data-program-smart-import]')).toBeVisible();}
async function snapshot(f){return f.evaluate(()=>JSON.parse(JSON.stringify(UOS.ProgramApp.workspace())));}
async function stage(f,file=INPUT){await data(f);await f.locator('[data-program-import-input]').setInputFiles(file);await expect(f.locator('[data-program-import-modal]')).toBeVisible();}
async function apply(f){await expect(f.locator('[data-program-import-apply]')).toBeEnabled();await f.locator('[data-program-import-apply]').click();await expect(f.locator('[data-program-import-modal]')).not.toBeVisible();await f.waitForFunction(()=>!UOS.ProgramApp.snapshot().busy);await dismiss(f);}
async function reload(p){await p.page.reload();p.frame=p.page.frames().find(f=>f!==p.page.mainFrame());await p.frame.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');}
async function imported(){const ctx=await context();const p=await open(ctx);await data(p.frame);await reload(p);await stage(p.frame);await apply(p.frame);return {...p,ctx};}
async function backup(p,selector,name){const dl=p.page.waitForEvent('download');await p.frame.locator(selector).click();const download=await dl;const file=path.join(OUT,'artifacts',name);await download.saveAs(file);assert.equal(await download.failure(),null);return {file,ws:JSON.parse(fs.readFileSync(file,'utf8')),sha256:sha(fs.readFileSync(file))};}
async function danger(f){await data(f);const d=f.locator('details.program-danger-zone');if(await d.getAttribute('open')===null)await d.locator('summary').click();await f.locator('[data-program-delete-stored]').click();await expect(f.locator('[data-program-delete-dialog]')).toBeVisible();}
async function mutate(f,id){return f.evaluate(async id=>{await UOS.ProgramApp.updateWorkspace(w=>{w.entities.applications.push({id,owner:'NSA',type:'application',title:'Readiness synthetic marker',dateReceived:'2026-10-14',status:'received'});return w;});return UOS.ProgramApp.workspace().workspaceRevision;},id);}
async function durable(f){return f.evaluate(async()=>({canonical:await UOS.ProgramStorage.getRaw(),verified:await UOS.storage.get(UOS.ProgramStorage.lastVerified.app,UOS.ProgramStorage.lastVerified.name),migration:await UOS.ProgramStorage.getMigrationState(),legacy:await UOS.ProgramStorage.stageLegacySources()}));}
async function main(){
 browser=process.env.READINESS_CDP?await chromium.connectOverCDP(process.env.READINESS_CDP):await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});report.browser=browser.version();persist();
 await scenario('WS01','Converted dataset integrity','Expected counts, unique IDs, valid model, stable normalization and linked project/task records.',async()=>{
  assert.equal(source.schemaVersion,5);assert.equal(source.app,'uos.horticulture.nsa');for(const [k,n] of Object.entries({applications:12,projects:2,tasks:50,rateItems:54,jobs:0,quotes:0,payments:0,geometries:0}))assert.equal(source.entities[k].length,n,k);
  for(const [k,records]of Object.entries(source.entities))assert.equal(new Set(records.map(x=>x.id)).size,records.length,k+' IDs');
  const projectIds=new Set(source.entities.projects.map(x=>x.id));for(const t of source.entities.tasks)assert(projectIds.has(t.projectId),'Task belongs to retained project');
  const ctx=await context(),p=await open(ctx);const valid=await p.frame.evaluate(w=>{UOS.ProgramModel.assertValid(w);return true;},source);assert(valid);await ctx.close();return {counts:counts(source),inputSha256:report.inputSha256};
 });
 let base, baseline,exported,deletedBackup;
 await scenario('WS02','Import preview cancellation','Real file input previews current-year file; Cancel preserves stored and active data.',async()=>{
  const ctx=await context();base={...await open(ctx),ctx};const before=await snapshot(base.frame);await stage(base.frame);const preview=await base.frame.locator('[data-program-import-modal]').innerText();await base.frame.locator('[data-program-import-cancel]').last().click();assert.deepEqual((await snapshot(base.frame)).entities,before.entities);await reload(base);return {preview:preview.slice(0,2500),unchanged:true,countsShown:/12/.test(preview)};
 });
 await scenario('WS03','Apply current-year file through Settings','All expected entities import and Data Health has no errors.',async()=>{
  await stage(base.frame);await apply(base.frame);baseline=await snapshot(base.frame);assert.deepEqual(counts(baseline),counts(source));await data(base.frame);await base.frame.locator('[data-program-health-run]').click();const health=await base.frame.locator('[data-program-health-summary]').innerText();assert.match(health,/0 errors|Healthy/i);fs.writeFileSync(path.join(OUT,'artifacts','normalized-import.json'),JSON.stringify(baseline));return {counts:counts(baseline),health};
 });
 await scenario('WS04','Reload and second-tab persistence','Imported entity content survives reload and a second tab.',async()=>{
  await base.page.reload();base.frame=base.page.frames().find(f=>f!==base.page.mainFrame());await base.frame.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');assert.deepEqual(canonical((await snapshot(base.frame)).entities),canonical(baseline.entities));const p=await open(base.ctx);assert.deepEqual(canonical((await snapshot(p.frame)).entities),canonical(baseline.entities));await p.page.close();currentPage=base.page;return 'All entity collections retained with identical business content.';
 });
 await scenario('WS05','JSON download and fresh-context recovery','Actual downloaded JSON restores complete imported entity content.',async()=>{
  await data(base.frame);await base.frame.locator('[data-program-export-open]').click();exported=await backup(base,'[data-program-export-json]','workspace-backup.json');assert.deepEqual(canonical(exported.ws.entities),canonical(baseline.entities));if(await base.frame.locator('[data-program-export-modal]').isVisible())await base.frame.locator('[data-program-export-cancel]').last().click();const ctx=await context(),p=await open(ctx);await data(p.frame);await reload(p);await stage(p.frame,exported.file);await apply(p.frame);assert.deepEqual(canonical((await snapshot(p.frame)).entities),canonical(exported.ws.entities));await ctx.close();return {artifact:path.relative(OUT,exported.file),sha256:exported.sha256};
 });
 await scenario('WS06','JSON drop import','Dropping the latest file stages it; cancellation preserves active data.',async()=>{
  await data(base.frame);await base.frame.locator('[data-program-dropzone]').evaluate((node,text)=>{const dt=new DataTransfer();dt.items.add(new File([text],'latest.json',{type:'application/json'}));node.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));},fs.readFileSync(INPUT,'utf8'));await expect(base.frame.locator('[data-program-import-modal]')).toBeVisible();await base.frame.locator('[data-program-import-cancel]').last().click();assert.deepEqual(canonical((await snapshot(base.frame)).entities),canonical(baseline.entities));return 'Drop staged preview; cancel retained baseline.';
 });
 for(const [id,title,payload]of [['WS07','Malformed JSON','{bad'],['WS08','Wrong app',JSON.stringify({...source,app:'uos.horticulture.evt'})],['WS09','Unsupported schema',JSON.stringify({...source,schemaVersion:999})]])await scenario(id,title+' import rejection','Unsafe file cannot replace active or stored data.',async()=>{
  const p=await imported();const before=await snapshot(p.frame);await data(p.frame);await p.frame.locator('[data-program-import-input]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(payload)});await expect.poll(async()=>{const status=await p.frame.locator('[data-program-data-status]').innerText();const modal=await p.frame.locator('[data-program-import-modal]').isVisible();return /fail|invalid|unsupported|different|error|block|expected|not.*match/i.test(status)||(modal&&await p.frame.locator('[data-program-import-apply]').isDisabled());}).toBe(true);assert.deepEqual(canonical((await snapshot(p.frame)).entities),canonical(before.entities));const status=await p.frame.locator('[data-program-data-status]').innerText();await p.ctx.close();return status;
 });
 await scenario('WS10','Temporary clear and restore','Clear Session Data removes memory data but Restore Stored Data recovers it.',async()=>{
  const p=await imported();await data(p.frame);const d=p.frame.locator('details.program-danger-zone');await d.locator('summary').click();await p.frame.locator('[data-program-clear="all"]').click();await p.frame.locator('[data-program-clear-confirm]').click();await expect.poll(async()=>(await snapshot(p.frame)).entities.applications.length).toBe(0);await p.frame.locator('[data-program-restore-stored]').click();await expect.poll(async()=>(await snapshot(p.frame)).entities.applications.length).toBe(12);assert.deepEqual(canonical((await snapshot(p.frame)).entities),canonical(baseline.entities));await p.ctx.close();return 'Session cleared; stored entity content restored.';
 });
 await scenario('DZ01','Backup gate, cancel, Escape and reopen','Deletion requires a fresh backup for each opened dialog; cancellation preserves records.',async()=>{
  const p=await imported();await danger(p.frame);await expect(p.frame.locator('[data-program-delete-confirm]')).toBeDisabled();await backup(p,'[data-program-delete-backup]','cancelled-delete-backup.json');await expect(p.frame.locator('[data-program-delete-confirm]')).toBeEnabled();await p.frame.locator('[data-program-delete-cancel]').last().click();assert.equal((await snapshot(p.frame)).entities.applications.length,12);await danger(p.frame);await expect(p.frame.locator('[data-program-delete-confirm]')).toBeDisabled();await p.page.keyboard.press('Escape');await expect(p.frame.locator('[data-program-delete-dialog]')).not.toBeVisible();assert.equal((await durable(p.frame)).canonical.entities.applications.length,12);await p.ctx.close();return 'Required backup gate and cancellation safeguards passed.';
 },'Dangerzone');
 await scenario('DZ02','Stale backup cannot delete newer revision','UI deletion refuses an older backed-up revision after a second-tab save.',async()=>{
  const p=await imported();await danger(p.frame);const b=await backup(p,'[data-program-delete-backup]','stale-backup.json');const other=await open(p.ctx);await mutate(other.frame,'NSA-APP-READINESS-NEWER');await p.frame.locator('[data-program-delete-confirm]').click();await expect(p.frame.locator('[data-program-data-status]')).toContainText(/Failed to delete/);assert.equal((await durable(other.frame)).canonical.entities.applications.length,13);const message=await p.frame.locator('[data-program-data-status]').innerText();await p.ctx.close();return {backedUpRevision:b.ws.workspaceRevision,message};
 },'Dangerzone');
 await scenario('DZ03','Permanent deletion, no resurrection, actual backup recovery','Canonical/recovery state is removed, stale tabs cannot resurrect it, EVT is preserved, actual backup restores and can save.',async()=>{
  const p=await imported();const old=await open(p.ctx);
  const evt=await open(p.ctx,URL.replace('nsa.html','events.html'));await evt.frame.evaluate(async()=>{await UOS.ProgramApp.updateWorkspace(w=>{w.entities.events.push({id:'EVT-EVENT-READINESS-SENTINEL',owner:'EVT',type:'event',title:'Readiness isolation sentinel',dateReceived:'2026-10-14',status:'received'});return w;});});const evtBefore=(await snapshot(evt.frame)).entities;
  await danger(p.frame);deletedBackup=await backup(p,'[data-program-delete-backup]','dangerzone-required-backup.json');assert.deepEqual(canonical(deletedBackup.ws.entities),canonical(baseline.entities));await p.frame.locator('[data-program-delete-confirm]').click();await expect(p.frame.locator('[data-program-data-status]')).toContainText('Stored workspace deleted');
  const d=await durable(p.frame);assert.equal(d.canonical,undefined);assert.equal(d.verified,undefined);assert.equal(d.migration,null);for(const k of ['nature','remediation','unified'])assert.equal(d.legacy[k],undefined);assert.equal((await snapshot(p.frame)).entities.applications.length,0);
  await data(p.frame);await p.frame.locator('[data-program-restore-stored]').click();assert.equal((await snapshot(p.frame)).entities.applications.length,0);
  const staleResult=await old.frame.evaluate(async()=>{try{await UOS.ProgramApp.updateWorkspace(w=>{w.workspace.activeView='register';return w;});return {saved:true};}catch(e){return {saved:false,name:e.name,message:e.message};}});assert.equal((await durable(p.frame)).canonical,undefined,'Stale tab must not recreate deleted workspace');
  await p.page.reload();p.frame=p.page.frames().find(f=>f!==p.page.mainFrame());await p.frame.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');assert.equal((await snapshot(p.frame)).entities.applications.length,0);assert.deepEqual(canonical((await durable(evt.frame)).canonical.entities),canonical(evtBefore));
  await stage(p.frame,deletedBackup.file);await apply(p.frame);assert.deepEqual(canonical((await snapshot(p.frame)).entities),canonical(deletedBackup.ws.entities));await mutate(p.frame,'NSA-APP-READINESS-POST-RESTORE');assert.equal((await durable(p.frame)).canonical.entities.applications.length,13);await p.ctx.close();return {backup:path.relative(OUT,deletedBackup.file),sha256:deletedBackup.sha256,staleResult,evtPreserved:true};
 },'Dangerzone');
 await scenario('WS11','CSV/GeoJSON bundle download and recovery','Alternative export is a valid ZIP and reimports supported entity content.',async()=>{
  const p=await imported();await data(p.frame);await p.frame.locator('[data-program-export-open]').click();const event=p.page.waitForEvent('download');await p.frame.locator('[data-program-export-bundle]').click();const dl=await event;const file=path.join(OUT,'artifacts','workspace-bundle.zip');await dl.saveAs(file);assert.equal(fs.readFileSync(file).subarray(0,2).toString(),'PK');const ctx=await context(),dest=await open(ctx);await data(dest.frame);await reload(dest);await stage(dest.frame,file);await apply(dest.frame);const after=await snapshot(dest.frame);assert.equal(after.entities.applications.length,12);assert.equal(after.entities.projects.length,2);assert.equal(after.entities.tasks.length,50);await p.ctx.close();await ctx.close();return {counts:counts(after),sha256:sha(fs.readFileSync(file))};
 });
 await scenario('WS12','Stale import preview','A second-tab save prevents stale preview from overwriting newer records.',async()=>{
  const p=await imported();await stage(p.frame);const other=await open(p.ctx);await mutate(other.frame,'NSA-APP-READINESS-IMPORT-FENCE');await p.frame.locator('[data-program-import-apply]').click();await expect(p.frame.locator('[data-program-data-status]')).toContainText(/newer|changed|revision|conflict/i);assert.equal((await durable(other.frame)).canonical.entities.applications.length,13);const message=await p.frame.locator('[data-program-data-status]').innerText();await p.ctx.close();return message;
 });
 await scenario('DEP01','Published asset parity','All inspected same-repository deployed assets match local source bytes.',async()=>{await Promise.allSettled([...pendingAssets]);assert(report.assets.length>10,'Inspect more than entry HTML');assert.deepEqual(report.assets.filter(x=>!x.match),[]);return {checked:report.assets.length,matched:true};},'Deployment');
 await scenario('DEP02','Workspace runtime errors','Workspace lifecycle does not produce unhandled browser exceptions.',async()=>{assert.deepEqual(report.errors,[]);return 'No unhandled page errors during workspace scenarios.';},'Deployment');
 report.finished=new Date().toISOString();persist();await browser.close();
}
module.exports={ROOT,OUT,INPUT,URL,source,counts,canonical,sha,report,persist,scenario,context,open,reload,data,stage,apply,imported,snapshot,backup,danger,durable,mutate,dismiss,setBrowser:b=>{browser=b;report.browser=b.version();}};
if(require.main===module)main().catch(async e=>{report.fatal=e.stack;persist();console.error(e.stack);if(browser)await browser.close();process.exitCode=1;});
