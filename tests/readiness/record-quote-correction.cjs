// Append focused local Quote evidence; keep the published readiness baseline.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'test-results/nsa-demo-readiness');
const read=file=>fs.readFileSync(path.join(out,file),'utf8');
const data=JSON.parse(read('readiness-data.json'));
const runs=['quote-focused/results.json','quote-status-focus/results.json','quote-file-edge/results.json'].map(file=>{
 const d=JSON.parse(read(file));assert.equal(d.stats.unexpected,0);assert.equal(d.stats.skipped,0);
 const scenarios=d.suites.flatMap(s=>s.specs.flatMap(spec=>spec.tests.map(t=>({title:spec.title,status:t.results.at(-1).status}))));
 return {file,passed:d.stats.expected,scenarios};
});
const sources=['src/program-planner/js/quote-builder.js','src/program-planner/js/card-visibility.js','src/program-planner/js/status-ui.js','src/program-planner/js/register.js'];
data.quoteCorrection={
 verified:true,generated:new Date().toISOString(),scope:'Local source only; no commit or publication.',
 changes:[
  'Payment controls no longer invoke automatic card scrolling when clicked or focused.',
  'Ledger action controls remain stable through Quote refreshes; reversal guards prevent duplicate dialogs and reject empty reasons.',
  'Reversal evidence resolves by payment ID and displays its stored timestamp. Missing historical actor information remains Not recorded.',
  'Dialog close and successful reversal return focus to the payment control without scrolling.'
 ],
 limitation:'The initially disabled Customer deposit button was not reproduced in the current local source. Fresh-entry and reopened-workspace checks passed without changing funding. Existing funding eligibility rules were preserved.',
 runs,
 hashes:Object.fromEntries(sources.map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]))
};
const marker='## Quote interaction correction';
let md=read('nsa-demo-readiness-report.md').split(marker)[0];
md+='\n'+marker+'\n\n'+data.quoteCorrection.scope+'\n\n';
md+=data.quoteCorrection.changes.map(x=>'- '+x).join('\n')+'\n\n';
md+='**Deposit availability:** '+data.quoteCorrection.limitation+'\n\n';
for(const run of runs)md+='- '+run.passed+' passed: ['+run.file+']('+run.file+')\n';
md+='\nEdge checks used isolated local-file NSA and EVT app entries, including reopening the workspace. Chromium checks include single-click activation, refresh during the pointer gesture, cancellation, empty reason, duplicate-dialog prevention, stored timestamp and scroll/focus assertions. Existing payment/funding tests and two shared status-dialog regressions also passed.\n';
const old=read('nsa-demo-readiness-report.html'),shot=old.match(/const SHOT=("(?:[^"\\]|\\.)*");/);assert(shot);
const template=fs.readFileSync(path.join(__dirname,'report-template.html'),'utf8');
fs.writeFileSync(path.join(out,'readiness-data.json'),JSON.stringify(data,null,2));
fs.writeFileSync(path.join(out,'nsa-demo-readiness-report.md'),md);
fs.writeFileSync(path.join(out,'nsa-demo-readiness-report.html'),template.replace('/*REPORT_JSON*/',JSON.stringify(data).replaceAll('<','\\u003c')).replace('/*EVIDENCE_IMAGE*/',shot[1]));
console.log(JSON.stringify({quoteChecks:runs.reduce((sum,r)=>sum+r.passed,0),publishedBaseline:data.counts}));
