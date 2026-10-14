/* Focused local-source regression: no reload workaround before import. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {fork} = require('node:child_process');
const port=process.platform==='win32'?4298:4297;
process.env.READINESS_URL = 'http://127.0.0.1:'+port+'/src/program-planner/nsa.html';
process.env.READINESS_OUTPUT ||= 'test-results/nsa-demo-readiness/local-fix';
delete process.env.PLAYWRIGHT_BROWSERS_PATH;
const {chromium} = require('@playwright/test');
const h = require('./workspace-readiness.cjs');
const server = fork(path.join(h.ROOT, 'src/scripts/static-server.cjs'), [h.ROOT], {
  env: {...process.env, PORT:String(port)}, stdio:'inherit'
});
let browser;
async function aligned(f) {
  return f.evaluate(async () => {
    const raw = await UOS.ProgramStorage.getRaw();
    return {memory:UOS.ProgramApp.workspace().workspaceRevision, durable:raw?.workspaceRevision};
  });
}
async function main() {
  for(let i=0;i<100;i++) {
    try { if((await fetch(process.env.READINESS_URL)).ok) break; } catch {}
    await new Promise(r=>setTimeout(r,50));
  }
  browser = await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  h.setBrowser(browser);
  h.report.setupWorkaround = 'None: corrected local source, fresh profiles and immediate imports.';
  h.report.sourceSha256 = h.sha(fs.readFileSync(path.join(h.ROOT,'src/program-planner/js/app.js')));
  for(const entry of ['nsa','events']) {
    await h.scenario('FIX-'+entry, entry+' fresh import and permanent-delete recovery',
      'Immediate import succeeds without reload; actual Dangerzone backup restores after deletion and reload.', async () => {
      const ctx = await h.context();
      try {
        const p = await h.open(ctx, process.env.READINESS_URL.replace('nsa.html',entry+'.html'));
        await h.data(p.frame);
        await p.frame.evaluate(()=>UOS.ProgramApp.navigate('data'));
        assert.deepEqual(await aligned(p.frame),{memory:0,durable:0});
        let input = h.INPUT, expected = h.source;
        if (entry === 'events') {
          expected = await p.frame.evaluate(()=>{
            const w=UOS.ProgramModel.blank();
            w.entities.events.push({id:'EVT-EVENT-RECOVERY',owner:'EVT',type:'event',title:'Recovery test',status:'received'});
            return JSON.parse(UOS.ProgramData.exportJson(UOS.ProgramModel.normalize(w),'EVT'));
          });
          input = {name:'evt-recovery.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(expected))};
        }
        try { await h.stage(p.frame,input); } catch(error) {
          throw new Error(error.message+' Import status: '+await p.frame.locator('[data-program-data-status]').innerText());
        }
        await h.apply(p.frame);
        assert.deepEqual(await aligned(p.frame),{memory:1,durable:1});
        assert.deepEqual(h.counts(await h.snapshot(p.frame)),h.counts(expected));
        await h.danger(p.frame);
        const downloaded = await h.backup(p,'[data-program-delete-backup]',entry+'-recovery.json');
        await p.frame.locator('[data-program-delete-confirm]').click();
        await p.frame.waitForFunction(()=>UOS.ProgramApp.isSessionCleared());
        assert.equal((await h.durable(p.frame)).canonical,undefined);
        await h.reload(p);
        await h.stage(p.frame,downloaded.file); await h.apply(p.frame);
        assert.deepEqual(h.canonical((await h.snapshot(p.frame)).entities),h.canonical(downloaded.ws.entities));
        assert.deepEqual(await aligned(p.frame),{memory:1,durable:1});
        await p.frame.evaluate(()=>UOS.ProgramApp.updateWorkspace(w=>{
          const rows=w.entities.events.length?w.entities.events:w.entities.applications;
          rows[0].title='Saved after recovery';return w;
        }));
        assert.deepEqual(await aligned(p.frame),{memory:2,durable:2});
        return {immediateImport:true,downloadSha256:downloaded.sha256,recoveryAndSave:true};
      } finally { await ctx.close(); }
    },'Local fix');
  }
  await h.scenario('FIX-QUEUE','Queued navigation, business edits and deletion',
    'Latest business content and eager destination survive; queued navigation cannot recreate deleted data.',async()=>{
    const ctx=await h.context();
    try {
      const p=await h.open(ctx);
      const result=await p.frame.evaluate(async()=>{
        const app=UOS.ProgramApp;
        const first=app.navigate('data');
        const edit=app.updateWorkspace(w=>{w.entities.applications.push({id:'NSA-APP-QUEUE',owner:'NSA',type:'application',title:'Queued edit',dateReceived:'2026-10-14',status:'received'});return w;});
        const last=app.navigate('register');
        await Promise.all([first,edit,last]);
        const raw=await UOS.ProgramStorage.getRaw();
        const before={revision:raw.workspaceRevision,memory:app.workspace().workspaceRevision,destination:app.workspace().workspace.destination,ids:raw.entities.applications.map(x=>x.id)};
        // Hold the navigation yield until deletion has completed, exercising
        // a queued (not already committed) navigation deterministically.
        const originalTimer=window.setTimeout, held=[];
        window.setTimeout=(callback,delay,...args)=>{
          if(delay===0){held.push(()=>callback(...args));return 0;}
          return originalTimer(callback,delay,...args);
        };
        const navigation=app.navigate('data');
        await new Promise(resolve=>originalTimer(resolve,30));
        await app.deleteStoredWorkspace(raw.workspaceRevision);
        window.setTimeout=originalTimer;
        held.forEach(callback=>callback());
        await navigation;
        return {before,raw:await UOS.ProgramStorage.getRaw(),cleared:app.isSessionCleared()};
      });
      assert.deepEqual(result.before,{revision:1,memory:1,destination:'register',ids:['NSA-APP-QUEUE']});
      assert.equal(result.raw,undefined);assert.equal(result.cleared,true);
      return result;
    } finally {await ctx.close();}
  },'Local fix');
  await h.scenario('FIX-STALE','Second-tab stale import and deletion',
    'A real newer business revision rejects stale imports and stale deletion.',async()=>{
    const ctx=await h.context();
    try {
      const a=await h.open(ctx);await h.mutate(a.frame,'NSA-APP-FIRST');
      const b=await h.open(ctx);const staged=await h.snapshot(b.frame);
      await h.mutate(a.frame,'NSA-APP-SECOND');
      const rejected=await b.frame.evaluate(async staged=>{
        const errors=[];
        for(const action of [()=>UOS.ProgramApp.adoptWorkspace(staged,{baseRevision:staged.workspaceRevision}),()=>UOS.ProgramApp.deleteStoredWorkspace(staged.workspaceRevision)]) {
          try {await action();errors.push('unexpected success');}catch(e){errors.push(e.name);}
        }
        return errors;
      },staged);
      assert.deepEqual(rejected,['WorkspaceRevisionConflictError','WorkspaceRevisionConflictError']);
      assert.equal((await h.durable(a.frame)).canonical.entities.applications.length,2);
      return rejected;
    } finally {await ctx.close();}
  },'Local fix');
  await h.scenario('FIX-FAIL','Failed navigation persistence',
    'A rejected storage write never advances the memory revision or reports Saved.',async()=>{
    const ctx=await h.context();
    try {
      const p=await h.open(ctx);
      const result=await p.frame.evaluate(async()=>{
        const save=UOS.ProgramStorage.saveValidated;
        UOS.ProgramStorage.saveValidated=()=>Promise.reject(new Error('Injected persistence failure'));
        try {await UOS.ProgramApp.navigate('data');}catch {}
        finally {UOS.ProgramStorage.saveValidated=save;}
        return {revision:UOS.ProgramApp.workspace().workspaceRevision,raw:await UOS.ProgramStorage.getRaw(),text:document.body.innerText};
      });
      assert.equal(result.revision,0);assert.equal(result.raw,undefined);
      assert.match(result.text,/Injected persistence failure|save failed|could not save|not saved/i);
      return {revision:result.revision,durableAbsent:true};
    } finally {await ctx.close();}
  },'Local fix');
  h.report.finished=new Date().toISOString();h.persist();
  if(h.report.scenarios.some(s=>s.status!=='passed'))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.kill();});
