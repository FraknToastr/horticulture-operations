// Amend the preserved public baseline without rerunning unrelated tests.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'test-results/nsa-demo-readiness');
const read=file=>fs.readFileSync(path.join(out,file),'utf8');
const data=JSON.parse(read('readiness-data.json'));
const runs=['local-fix','local-fix-edge'].map(dir=>{
 const r=JSON.parse(read(dir+'/workspace-results.json'));
 assert.equal(r.scenarios.length,5);assert(r.scenarios.every(s=>s.status==='passed'));
 return {platform:r.platform,browser:r.browser,sourceSha256:r.sourceSha256,inputSha256:r.inputSha256,finished:r.finished,scenarios:r.scenarios,evidence:dir+'/workspace-results.json'};
});
assert.equal(runs[0].sourceSha256,runs[1].sourceSha256);
data.localCorrection={verified:true,scope:'Local source only. The published baseline below remains unchanged: 105 passed, 2 failed, 1 blocked.',runs};
data.limits[0]='Navigation revision correction applied and verified locally. No commit or publication performed; the recorded commit and asset parity describe the original public baseline.';
data.findings[0].status='Fixed locally; public build not updated';
data.findings[0].recommendation='Obtain separate publication authorization, verify deployed source, then repeat immediate import, deletion/recovery and the headed demonstration.';
if(!data.summary.includes('Local correction verified'))data.summary+=' Local correction verified in Chromium and Windows Edge. Public GitHub build remains unchanged.';
const marker='## Local correction verification';
let md=read('nsa-demo-readiness-report.md').split(marker)[0];
md=md.replace(/No application fix was made\./g,'The navigation revision defect is now fixed and verified locally; the public build is unchanged.');
md=md.replace('Correct F01 locally, add the focused regressions, obtain a separate publication request','With the focused local correction verified, obtain a separate publication request');
md=md.replace(/No product source changed, committed or published\.[^\n]*/g,data.limits[0]);
md+='\n'+marker+'\n\n'+data.localCorrection.scope+'\n\n';
md+='Navigation saves now use the navigation mutation kind and explicit base revision, reconcile only the saved revision, and recheck session deletion before queued persistence. No schema changes.\n\n';
for(const run of runs){
 md+='### '+run.platform+' — '+run.browser+'\n\nSource SHA-256: '+run.sourceSha256+'\n\n';
 for(const s of run.scenarios)md+='- **Passed** '+s.id+': '+s.title+'\n';
 md+='\nEvidence: ['+run.evidence+']('+run.evidence+')\n\n';
}
md+='The two existing stale-revision and atomic-deletion browser regressions also passed. Syntax and whitespace checks passed. No unrelated application suites were run.\n\n';
md+='Report recovery note: the existing Playwright command cleared its default output folder. The public baseline reports and Edge evidence were restored from the preserved Windows runner copies. Some original Linux raw artifacts are no longer present; their recorded baseline results remain in this report.\n';
const recoveryNote='The focused Playwright invocation cleared the default output directory. Baseline reports and Edge evidence were restored from preserved Windows copies; some original Linux raw artifacts are no longer available.';
if(!data.limits.includes(recoveryNote))data.limits.push(recoveryNote);
const old=read('nsa-demo-readiness-report.html');
const shot=old.match(/const SHOT=("(?:[^"\\]|\\.)*");/);
assert(shot,'Preserve the embedded baseline screenshot');
const template=fs.readFileSync(path.join(__dirname,'report-template.html'),'utf8');
fs.writeFileSync(path.join(out,'readiness-data.json'),JSON.stringify(data,null,2));
fs.writeFileSync(path.join(out,'nsa-demo-readiness-report.md'),md);
fs.writeFileSync(path.join(out,'nsa-demo-readiness-report.html'),template.replace('/*REPORT_JSON*/',JSON.stringify(data).replaceAll('<','\\u003c')).replace('/*EVIDENCE_IMAGE*/',shot[1]));
console.log('Recorded 10 passing local correction scenarios; original public baseline preserved.');
