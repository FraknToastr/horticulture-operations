"use strict";
// Reproduce with: node /tmp/nsa-audit-recovery-supplement.cjs
// SOURCE_ROOT points to the disposable exact-candidate filesystem snapshot.
delete process.env.PLAYWRIGHT_BROWSERS_PATH;
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const ROOT = process.env.SOURCE_ROOT || "/tmp/nsa-evt-audit-20261017-094545";
const BASE = process.env.AUDIT_BASE_URL || "http://127.0.0.1:4401";
const OUT = process.env.AUDIT_RESULTS || "/tmp/nsa-audit-recovery-supplement-results.json";
const { chromium } = require(path.join(ROOT, "node_modules/playwright"));
const workDir = fs.mkdtempSync("/tmp/nsa-audit-recovery-fixtures-");
const latest = "src/sample/nsa-workspace-2026-27-area-pricing-v5.json";
const fixture = path.join(workDir, "latest-approved-copy.json");
fs.copyFileSync(path.join(ROOT, latest), fixture);
const sha = value => crypto.createHash("sha256").update(value).digest("hex");
const report = {
  runId: "REC-SUPP-20261017", startedAt: new Date().toISOString(),
  candidateRoot: ROOT, baseURL: BASE,
  harnessSHA256: sha(fs.readFileSync(__filename)),
  fixture: { path: latest, bytes: fs.statSync(fixture).size, sha256: sha(fs.readFileSync(fixture)) },
  isolation: { disposableSource: true, freshBrowserContexts: true, operatorProfiles: false, screenshots: false, trace: false, video: false, externalRequestsBlocked: true },
  attempts: [], observations: [], status: "RUNNING"
};
const persist = () => fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
async function scenario(id, owner, fn) {
  const attempt = { id, owner, attempt: 1, startedAt: new Date().toISOString(), status: "RUNNING" };
  report.attempts.push(attempt); persist(); const start = Date.now();
  try { attempt.observed = await fn(); attempt.status = "PASS"; }
  catch (error) { attempt.status = "FAIL"; attempt.error = { name: error.name, message: error.message, stack: String(error.stack).split("\n").slice(0, 6).join("\n") }; }
  attempt.durationMs = Date.now() - start; attempt.finishedAt = new Date().toISOString(); persist();
  if (attempt.status !== "PASS") throw new Error(id + " failed: " + attempt.error.message);
  return attempt.observed;
}
async function frameFor(page) {
  const frame = page.frames().find(f => f !== page.mainFrame());
  assert.ok(frame, "wrapper has embedded application frame");
  await frame.waitForFunction(() => window.UOS && UOS.ProgramApp && UOS.ProgramApp.snapshot().phase === "ready");
  return frame;
}
async function summary(frame) {
  return frame.evaluate(async () => {
    const U = UOS, ws = U.ProgramApp.workspace(); U.ProgramModel.assertValid(ws);
    const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
    const payload = value => ({ app: value.app, entities: Object.fromEntries(Object.entries(value.entities).map(([k, rows]) => [k, rows.slice().sort((a,b) => String(a.id).localeCompare(String(b.id)))])), referenceData: value.referenceData, context: value.context, migration: value.migration, statusControl: value.statusControl });
    const hash = async value => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(stable(value)))))).map(b => b.toString(16).padStart(2,"0")).join("");
    const all = Object.entries(ws.entities).flatMap(([collection, rows]) => rows.map(row => ({ collection, row }))), ids = new Set(all.map(item => item.row.id));
    const duplicateIds = all.length - ids.size, missingLinks = [];
    for (const { collection, row } of all) {
      if (collection === "rateItems" || collection === "catalogs") continue;
      for (const field of ["projectId", "applicationId", "eventId", "jobId", "quoteId"]) if (row[field] && !ids.has(row[field])) missingLinks.push({ collection, field });
    }
    const health = U.ProgramDataHealth.check(ws);
    return { app: ws.app, schemaVersion: ws.schemaVersion, revision: ws.workspaceRevision, counts: Object.fromEntries(Object.entries(ws.entities).map(([k,v]) => [k,v.length])), duplicateIds, missingLinkCount: missingLinks.length, health: { status: health.status, counts: health.counts, issueCodes: [...new Set(health.issues.map(i => i.code))] }, semanticHash: await hash(payload(ws)), foreignRecords: all.filter(i => i.row.owner && i.row.owner !== U.ProgramModel.owner).length };
  });
}
async function importText(frame, text, name, owner) {
  return frame.evaluate(async ({ text, name, owner }) => {
    const U = UOS, current = U.ProgramApp.workspace();
    const stage = await U.ProgramData.stage(new File([text], name, { type: "application/json" }), current, { expectedApp: owner });
    if (stage.preview.blocked) throw new Error("Workspace staging was blocked");
    const saved = await U.ProgramData.apply(stage, { currentWorkspace: current, commit: (candidate, options) => U.ProgramApp.adoptWorkspace(candidate, options) });
    U.ProgramModel.assertValid(saved);
    return { staged: true, revision: saved.workspaceRevision, sourceRevision: JSON.parse(text).workspaceRevision || 0 };
  }, { text, name, owner });
}
async function roundTrips(frame, owner) {
  return frame.evaluate(async owner => {
    const U = UOS, ws = U.ProgramApp.workspace(), privacy = U.ProgramPrivacy;
    const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
    const signature = value => JSON.stringify(stable(JSON.parse(U.ProgramData.exportJson(value, owner))));
    const original = signature(ws), json = U.ProgramData.exportJson(ws, owner), restored = U.ProgramModel.normalize(JSON.parse(json));
    U.ProgramModel.assertValid(restored);
    if (signature(restored) !== original) throw new Error("Complete JSON backup changed canonical data on restoration");
    const wasPrivate = privacy.isEnabled();
    let zipBytes = 0, maskChecks = 0, maskFailures = 0;
    try {
      privacy.setEnabled(false);
      const zip = U.ProgramData.exportBundle(ws, owner); zipBytes = zip.byteLength;
      const zipRestored = U.ProgramData.importBundle(zip, null, { expectedApp: owner }); U.ProgramModel.assertValid(zipRestored);
      if (signature(zipRestored) !== original) throw new Error("Privacy-off ZIP bundle changed canonical data on restoration");
      privacy.setEnabled(true);
      const masked = U.ProgramData.importBundle(U.ProgramData.exportBundle(ws, owner), null, { expectedApp: owner });
      function walk(value) { if (!value || typeof value !== "object") return; for (const [key,v] of Object.entries(value)) { if (privacy.isSensitivePiiField(key) && v != null && v !== "") { maskChecks++; if (v !== privacy.MASK) maskFailures++; } else if (v && typeof v === "object") walk(v); } }
      walk(masked);
      if (maskFailures) throw new Error("Privacy-on human ZIP export exposed classified contact fields");
    } finally { privacy.setEnabled(wasPrivate); }
    return { jsonBytes: new TextEncoder().encode(json).length, zipBytes, jsonCompleteRoundTrip: true, zipFullDataWithPrivacyOff: true, privacyOnMaskChecks: maskChecks, privacyOnMaskFailures: maskFailures };
  }, owner);
}
async function downloadBytes(download) {
  const stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}
async function runOwner(browser, owner) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: "en-AU", timezoneId: "Australia/Adelaide", acceptDownloads: true });
  let blockedExternalRequests = 0;
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === BASE || ["data:","blob:","about:"].includes(url.protocol)) return route.continue();
    blockedExternalRequests++; return route.abort("blockedbyclient");
  });
  await context.addInitScript(() => {
    sessionStorage.setItem("uos.program.backup-reminder:NSA", "acknowledged");
    sessionStorage.setItem("uos.program.backup-reminder:EVT", "acknowledged");
  });
  const page = await context.newPage(); let frame;
  try {
    await page.goto(BASE + "/src/program-planner/" + (owner === "NSA" ? "nsa" : "events") + ".html", { waitUntil: "load" });
    frame = await frameFor(page);
    await scenario("REC-SUPP-" + owner + "-ISOLATION", owner, async () => {
      const s = await summary(frame); assert.equal(s.counts[owner === "NSA" ? "applications" : "events"], 0); assert.equal(s.foreignRecords, 0);
      return { emptyFreshWorkspace: true, initialRevision: s.revision, fixtureSource: owner === "NSA" ? latest : "synthetic-in-memory" };
    });
    await scenario("REC-SUPP-" + owner + "-IMPORT", owner, async () => {
      if (owner === "NSA") await importText(frame, fs.readFileSync(fixture,"utf8"), "latest-approved-copy.json", owner);
      else {
        const text = await frame.evaluate(async () => {
          const U=UOS;
          await U.ProgramApp.updateWorkspace(ws=>{
          ws.entities.events.push({id:"EVT-EVENT-AUDIT-RECOVERY",owner:"EVT",type:"event",title:"Synthetic audit event",status:"received",dateReceived:"2026-10-17",councilEventNumber:"SYNTHETIC-COUNCIL-1",bumpInDate:"2026-10-18",bumpOutDate:"2026-10-20",provenance:{owner:"EVT",sourceApp:"audit-synthetic",sourceVersion:5}});
          return ws;
          });
          await U.ProgramApp.updateWorkspace(ws=>U.ProgramModel.promoteRegisterRecord(ws,'EVT-EVENT-AUDIT-RECOVERY').workspace);
          return U.ProgramData.exportJson(U.ProgramApp.workspace(),"EVT");
        });
        await importText(frame,text,"synthetic-evt-recovery.json",owner);
      }
      const s=await summary(frame); assert.equal(s.duplicateIds,0);assert.equal(s.missingLinkCount,0);assert.equal(s.foreignRecords,0);assert.equal(s.health.counts.error,0);
      assert.equal(s.counts[owner === "NSA"?"applications":"events"],owner === "NSA"?12:1);
      if(owner === "NSA"){assert.equal(s.counts.projects,2);assert.equal(s.counts.tasks,50);assert.equal(s.counts.rateItems,54);}
      return s;
    });
    await scenario("REC-SUPP-" + owner + "-ROUNDTRIP",owner,()=>roundTrips(frame,owner));
    await scenario("REC-SUPP-" + owner + "-RELOAD",owner,async()=>{
      const before=await summary(frame);await page.reload({waitUntil:"load"});frame=await frameFor(page);const after=await summary(frame);
      assert.equal(after.semanticHash,before.semanticHash);assert.deepEqual(after.counts,before.counts);
      return {semanticHash:after.semanticHash,revision:after.revision,counts:after.counts,preserved:true};
    });
    await scenario("REC-SUPP-" + owner + "-DANGERZONE",owner,async()=>{
      const before=await summary(frame);await frame.locator('[data-program-destination="data"]').click();
      const visibility=await frame.evaluate(()=>{
        const node=document.querySelector('details.program-danger-zone summary'),ancestors=[];
        for(let n=node;n;n=n.parentElement){const style=getComputedStyle(n);if(n.hidden||style.display==='none'||style.visibility==='hidden')ancestors.push({tag:n.tagName,id:n.id,className:n.className,hidden:n.hidden,display:style.display,visibility:style.visibility});}
        return {destination:UOS.ProgramApp.workspace().workspace.destination,busy:UOS.ProgramApp.snapshot().busy,dataViewHidden:document.querySelector('[data-program-view="data"]').hidden,ancestors};
      });report.observations.push({owner,stage:'before-danger-zone',visibility});persist();
      await frame.locator("details.program-danger-zone summary").click();await frame.locator("[data-program-delete-stored]").click();
      const confirm=frame.locator("[data-program-delete-confirm]");assert.equal(await confirm.isDisabled(),true);
      const downloadPromise=page.waitForEvent("download");await frame.locator("[data-program-delete-backup]").click();const download=await downloadPromise;
      const bytes=await downloadBytes(download),saved=JSON.parse(bytes.toString("utf8"));
      assert.equal(saved.app,owner === "NSA"?"uos.horticulture.nsa":"uos.horticulture.events");assert.equal(saved.workspaceRevision,before.revision);
      assert.equal(saved.entities[owner === "NSA"?"applications":"events"].length,owner === "NSA"?12:1);
      await confirm.waitFor({state:"visible"});assert.equal(await confirm.isEnabled(),true);await confirm.click();
      await frame.waitForFunction(()=>!UOS.ProgramApp.snapshot().busy&&UOS.ProgramApp.workspace().entities.applications.length===0&&UOS.ProgramApp.workspace().entities.events.length===0);
      const immediate=await frame.evaluate(async()=>({rawAbsent:(await UOS.ProgramStorage.getRaw())==null,migrationAbsent:(await UOS.ProgramStorage.getMigrationState())==null}));
      assert.equal(immediate.rawAbsent,true);assert.equal(immediate.migrationAbsent,true);
      await page.reload({waitUntil:"load"});frame=await frameFor(page);const after=await summary(frame);
      for(const name of ["applications","events","projects","tasks","jobs","geometries","quotes","payments"])assert.equal(after.counts[name],0,name+" must remain empty after deletion/reload");
      return {backupBytes:bytes.length,backupSHA256:sha(bytes),backedUpRevision:before.revision,backupGate:true,deleted:true,reloadEmpty:true,countsAfterReload:after.counts,immediate};
    });
  } finally {report.observations.push({owner,blockedExternalRequests});persist();await context.close();}
}
(async()=>{
  let browser;
  try{
    const expectedRuntime='/home/n0rt/.cache/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell';
    browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});report.browser=browser.version();report.browserRuntime={effectiveExecutable:expectedRuntime,executableSHA256:sha(fs.readFileSync(expectedRuntime)),packageVersion:require(path.join(ROOT,'node_modules/playwright/package.json')).version,inheritedBrowserPathIgnored:true};persist();
    for(const owner of (process.env.AUDIT_OWNERS||"NSA,EVT").split(',')) await runOwner(browser,owner);
    report.status=report.attempts.every(a=>a.status==="PASS")?"PASS":"FAIL";
  }catch(error){report.status="FAIL";report.fatal={name:error.name,message:error.message};process.exitCode=1;}
  finally{if(browser)await browser.close();fs.rmSync(workDir,{recursive:true,force:true});report.finishedAt=new Date().toISOString();persist();console.log(JSON.stringify({status:report.status,results:OUT,attempts:report.attempts.map(a=>({id:a.id,status:a.status,durationMs:a.durationMs,error:a.error&&a.error.message}))}));}
})();
