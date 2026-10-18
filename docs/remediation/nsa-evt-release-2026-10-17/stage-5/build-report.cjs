'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const evidence = path.resolve(__dirname, '..');
const root = path.resolve(evidence, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(evidence, name), 'utf8'));
const write = (name, content) => fs.writeFileSync(path.join(evidence, name), content);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fileHash = file => hash(fs.readFileSync(file));
const decisions = read('stage-3-owner-decisions-2026-10-18.json');
assert.equal(decisions.ownerDecisionsRemaining, 0);
const actors = read('stage-5-actor-model-results.json');
const actorCases = actors.runs.find(run => run.reportedUnit === 'individual test cases');
assert.equal(actorCases.passed, 10);
assert.equal(actorCases.failed, 0);
function tap(name, passed) {
  const source = fs.readFileSync(path.join(evidence, name), 'utf8');
  const count = key => Number(source.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1]);
  assert.equal(count('fail'), 0, name);
  assert.equal(count('pass'), passed, name);
  return {source: name, passed, failed: 0};
}
const governance = tap('stage-5-governance-tests.tap', 17);
const cleanDefaults = tap('stage-5-clean-default-tests.tap', 7);
const modelFiles = tap('stage-5-default-model-results.tap', 4);
const browserSources = ['stage-5-browser-attempt-3.json', 'stage-5-inspector-browser-results.json'];
const browserCases = new Map();
let mediaAttachments = 0;
function collect(suite, source) {
  for (const spec of suite.specs || []) for (const test of spec.tests || []) {
    const result = test.results?.at(-1);
    if (!result) continue;
    for (const attachment of result.attachments || []) {
      if (/^(image|video)\//.test(attachment.contentType) || /trace|screenshot|\.zip$/i.test(attachment.name || '')) mediaAttachments++;
    }
    browserCases.set(spec.title, {title: spec.title, status: result.status, source, durationMs: result.duration});
  }
  for (const child of suite.suites || []) collect(child, source);
}
for (const source of browserSources) for (const suite of read(source).suites) collect(suite, source);
assert.equal(browserCases.size, 17);
for (const result of browserCases.values()) assert.equal(result.status, 'passed', result.title);
assert.equal(mediaAttachments, 0);

const readmePath = path.join(evidence, 'README.md');
let readme = fs.readFileSync(readmePath, 'utf8');
readme = readme.replace('**Stages 1–4 complete; Stage 5 resumed on 18 October 2026.**', '**Stages 1–5 complete locally; stopped on 18 October 2026.**');
if (!readme.includes('[Final remediation report]')) readme += '\n[Final remediation report](final-remediation-report.md) and\n[self-contained interactive report](final-remediation-report.html) record the\ncompleted work, verification and remaining release limits. No commit or push\nwas performed for Stage 5. See the [Stage 5 checkpoint](stage-5-checkpoint.md).\n';
fs.writeFileSync(readmePath, readme);

const allowed = new Set([
  'docs/remediation/nsa-evt-release-2026-10-17/README.md',
  'docs/remediation/nsa-evt-release-2026-10-17/stage-3-checkpoint.md',
  'docs/remediation/nsa-evt-release-2026-10-17/stage-5-resume-plan.md',
  'src/governance/DECISIONS.md', 'src/governance/PRODUCT_CONTRACTS.md',
  'src/governance/PRODUCT_CONSTITUTION.md', 'src/governance/PRODUCT_CONSTITUTION_VIEWER.html',
  'src/governance/RELEASE_GATES.md', 'src/governance/PROJECT_TEST_PROFILE.md',
  'src/governance/PLANNER_BUDGET_UI_TEST_ACCEPTANCE_2026-09-29.md',
  'src/program-planner/index.html', 'src/program-planner/js/quote-builder.js',
  'src/program-planner/js/quote-model.js', 'src/program-planner/js/model.js',
  'src/program-planner/js/status-model.js', 'src/program-planner/space-map-editor.css',
  'tests/canonical-work-governance.test.cjs', 'tests/empty-operational-baseline.test.cjs',
  'tests/model-v5.test.cjs', 'tests/quote-funding.test.cjs',
  'tests/browser/quote-first-interaction.spec.js', 'tests/browser/quote-payment-funding-workflow.spec.js',
  'tests/browser/draft-quoted-cost-deletion.spec.js'
]);
allowed.add('src/governance/' + fs.readdirSync(path.join(root, 'src/governance')).find(name => name.startsWith('PC-020')));
const baseline = read('stage-5-preservation-baseline.json');
const changed = [];
for (const [relative, before] of Object.entries(baseline.protectedFiles)) {
  const after = fileHash(path.join(root, relative));
  if (before !== after) {
    assert.ok(allowed.has(relative), 'Unexpected modification: ' + relative);
    changed.push({path: relative, before, after});
  }
}
const preservation = {checkedAt: new Date().toISOString(), baseline: 'stage-5-preservation-baseline.json',
  trackedFilesChecked: Object.keys(baseline.protectedFiles).length, authorisedChanges: changed,
  unchangedFiles: Object.keys(baseline.protectedFiles).length - changed.length,
  unexpectedChanges: [], originalAuditUnchanged: true, overtimeUnchanged: true,
  originalSampleUnchanged: true, reviewedCandidateUnchanged: true};
write('stage-5-preservation-results.json', JSON.stringify(preservation, null, 2) + '\n');

const verification = [
  {name: 'Reversal attribution, atomic validation, persistence and idempotence', passed: 10, unit: 'individual model cases', source: 'stage-5-actor-model-results.json'},
  {name: 'Actor and existing funding regressions', passed: 2, unit: 'model file gates; overlaps the actor cases above', source: 'stage-5-actor-model-results.json'},
  {name: 'Clean/reset defaults and explicit saved preferences', passed: cleanDefaults.passed, unit: 'individual model cases', source: cleanDefaults.source},
  {name: 'Affected model, baseline sanitation and status engine', passed: modelFiles.passed, unit: 'model file gates; not an individual-case total', source: modelFiles.source},
  {name: 'Governance and explicit Planner Job lineage', passed: governance.passed, unit: 'individual cases', source: governance.source},
  {name: 'Reversal/funding UI, clean startup and inspector styles', passed: 17, unit: 'distinct browser cases across the retained run and focused inspector rerun', source: 'stage-5-browser-attempt-3.json + stage-5-inspector-browser-results.json'}
];
const stages = [
  {id: 1, title: 'Desktop test alignment', status: 'Complete', description: 'Manual MetroMap activation, current inspector collapse levels and guarded desktop release selection.', evidence: 'stage-1-checkpoint.md'},
  {id: 2, title: 'Canonical receipt eligibility', status: 'Complete', description: 'Draft deposits remain allowed. Ordinary payments require Issued or Accepted; Declined blocks new receipts.', evidence: 'stage-2-checkpoint.md'},
  {id: 3, title: 'Workspace review and owner decisions', status: 'Complete', description: '54 sample warnings corrected in a separate candidate. All three owner decisions closed: sample budgets do not apply to the clean release; automation stays paused.', evidence: 'stage-3-checkpoint.md'},
  {id: 4, title: 'Dependency assessment', status: 'Complete', description: 'Inventory and isolated PDF.js 6.4.299 compatibility proposal retained. Shipped runtimes unchanged; dependency risks remain open.', evidence: 'stage-4-checkpoint.md'},
  {id: 5, title: 'Governance, officers and CSS', status: 'Complete', description: 'Explicit-calendar contracts, named officers for new reversals, paused clean defaults, bounded inspector CSS consolidation and final reports.', evidence: 'stage-5-checkpoint.md'}
];
const findings = [
  {id: 'F-001', stage: 1, title: 'Stale release checks', state: 'fixed', label: 'Remediated', detail: 'Desktop selection and guarded tests match the current manual-key and inspector workflows. Screenshot/mobile aggregates remain excluded.'},
  {id: 'F-002', stage: 2, title: 'Receipt command eligibility', state: 'fixed', label: 'Remediated', detail: 'The command and UI agree on deposits, ordinary payments and Declined Quotes. Historical receipts and reversals remain accessible.'},
  {id: 'F-003', stage: 3, title: 'Historical sample warnings', state: 'owner-closed', label: 'Owner decisions closed', detail: 'Two absent sample budgets are irrelevant to a release with no saved workspace. No amounts were invented. The owner confirmed automation must stay paused; historical sample warnings remain truthful.'},
  {id: 'F-004', stage: 5, title: 'Automatic Job governance drift', state: 'fixed', label: 'Remediated', detail: 'Active contracts now require the explicit Planner calendar action. Purpose changes and normal saves affect eligibility without creating or recreating Jobs. Historical rules are retained as superseded.'},
  {id: 'F-005', stage: 4, title: 'Vendored dependency risks', state: 'open', label: 'Open vendor update', detail: 'MapLibre 5.3.0 matches critical GHSA-jrc7-96c5-q579. Current attribution is curated, but the affected library still ships. PDF.js 2.16.105 retains its explicit isEvalSupported:false mitigation. Full local licence texts and a separately verified vendor upgrade remain outstanding.'},
  {id: 'F-006', stage: 5, title: 'Inspector CSS duplication', state: 'fixed', label: 'Remediated', detail: 'Consolidated proven duplicate declarations and removed an overridden action-row rule. Existing 8px tokens replace equivalent literals; both owner themes and all three collapse levels were checked using computed styles.'},
  {id: 'F-007', stage: 5, title: 'Payment reversal officer', state: 'fixed', label: 'Remediated', detail: 'New reversals require a trimmed officer name and reason in the UI and canonical command. Session names prefill an editable field. Evidence survives reload; old missing actors remain missing and repeated commands preserve the first evidence.'},
  {id: 'RELEASE', stage: 0, title: 'Release environment verification', state: 'unverified', label: 'Not verified', detail: 'These are local desktop Chromium HTTP checks. GitHub Pages, Edge file:// and the broader PDF corpus are not certified. A clean client handover requires fresh or deliberately cleared browser storage; this work does not erase an existing operator workspace.'}
];
const data = {
  reportVersion: 1, recordedDate: '2026-10-18', baseCommit: baseline.baseCommit,
  scope: 'NSA/EVT working tree; Overtime excluded', roadmapComplete: true,
  releaseReadiness: 'UNVERIFIED', ownerDecisionsRemaining: 0, cleanAutomationDefault: 'paused',
  originalAudit: '../../audits/nsa-evt/20261017-094545-local-8545d67/report.md',
  environment: {node: process.version, playwright: '1.62.0', browser: 'Installed desktop Chromium', viewport: '1600 × 1000', transport: 'Local HTTP'},
  stages, findings, verification,
  browser: {passed: 17, selected: 17, sources: browserSources, cases: [...browserCases.values()], mediaAttachments},
  preservation: {trackedFilesChecked: preservation.trackedFilesChecked, authorisedChanges: changed.length,
    unchangedFiles: preservation.unchangedFiles, unexpectedChanges: 0, evidence: 'stage-5-preservation-results.json'},
  priorAttempts: [
    {source: 'stage-5-browser-attempt-1.json', outcome: 'No tests ran: nested config needed an explicit server working directory. Corrected configuration.'},
    {source: 'stage-5-browser-attempt-2.json', outcome: 'Stopped on stale Draft ordinary-payment fixtures. Corrected fixtures to their intended allowed deposit method; production eligibility unchanged.'},
    {source: 'stage-5-browser-attempt-3.json', outcome: '15 passed; inspector probe sampled the start of a colour transition. Corrected probe to exercise real Edit/Cancel with test-only transitions disabled; reran only the two inspector cases.'},
    {source: 'stage-5-inspector-browser-attempt-1.json', outcome: 'Inspector-only probe then exposed its separate hover/focus expectation error. Checked owner-soft hover/focus colours and resting active colours independently; both final owner cases passed without further production CSS changes.'},
    {source: 'stage-5-report-browser-attempt-1.json', outcome: 'Report keyboard check found an ambiguous Stage select label. Added explicit accessible filter names and reran only the two offline report checks.'}
  ],
  boundaries: ['No screenshots, mobile, touch, video or traces', 'No vendor upgrade or Stage 3 sample adoption',
    'No existing operator workspace erased', 'No commit, push or publication for Stage 5'],
  next: 'Separately scope the outstanding vendor/licence work and target deployment checks before calling the client release ready.'
};
const json = JSON.stringify(data, null, 2) + '\n';
const dataHash = hash(json);
write('stage-5-results.json', json);
const escape = value => String(value).replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]));
const rows = verification.map(item => `<tr><th scope="row">${escape(item.name)}</th><td>${item.passed} passed</td><td>${escape(item.unit)}</td></tr>`).join('');
const stageHtml = stages.map(stage => `<article class="stage" data-stage="${stage.id}"><div class="stage-number">${stage.id}</div><div><p class="status">Complete</p><h3>${escape(stage.title)}</h3><p>${escape(stage.description)}</p><a href="${stage.evidence}">Stage ${stage.id} checkpoint</a></div></article>`).join('');
const findingHtml = findings.map(finding => `<details class="finding" data-stage="${finding.stage}" data-state="${finding.state}" data-search="${escape([finding.id, finding.title, finding.detail].join(' ').toLowerCase())}"><summary><span><small>${finding.id}${finding.stage ? ' · Stage ' + finding.stage : ''}</small><strong>${escape(finding.title)}</strong></span><span class="badge ${finding.state}">${finding.label}</span></summary><p>${escape(finding.detail)}</p></details>`).join('');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="report-data-sha256" content="${dataHash}"><title>NSA / EVT — Remediation review</title>
<style>
:root{color-scheme:light;--ink:#11243b;--muted:#52637a;--green:#087c5c;--blue:#137998;--line:#d8e1e8;--paper:#fff;--canvas:#f3f6f8;--focus:#2254c5;--space:8px}*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.55 "Segoe UI",Calibri,sans-serif}a{color:var(--blue);text-underline-offset:3px}a:hover{color:var(--green)}button,input,select{font:inherit}button,a,input,select,summary{outline-offset:4px}button:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid var(--focus)}[hidden]{display:none!important}header,main,footer{max-width:1180px;margin:auto;padding:32px}header{padding-top:48px;padding-bottom:24px}.eyebrow{margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--green)}h1{font-size:clamp(30px,4vw,44px);line-height:1.15;margin:0 0 16px;letter-spacing:-.025em}h2{font-size:24px;line-height:1.25;margin:0 0 20px}h3{font-size:18px;line-height:1.35;margin:4px 0 8px}p{margin:0 0 16px;text-wrap:pretty}.lede{max-width:800px;color:var(--muted)}.release-note{padding:20px 24px;border:1px solid #c8d9e5;background:#edf5fa;border-radius:6px}.release-note strong{display:block;margin-bottom:4px}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:24px 0 0}.fact{padding:20px;background:var(--paper);border:1px solid var(--line);border-radius:6px}.fact b{display:block;font-size:26px;line-height:1.2;margin-bottom:6px}.fact span{color:var(--muted);font-size:14px}main{padding-top:8px}.section{margin-bottom:32px;padding:24px;background:var(--paper);border:1px solid var(--line);border-radius:6px}.tools{display:flex;gap:16px;align-items:end;flex-wrap:wrap;margin-bottom:20px}.tools label{display:grid;gap:6px;font-size:14px;font-weight:600}.tools input,.tools select{min-height:42px;padding:8px 10px;color:var(--ink);background:var(--paper);border:1px solid #aebdca;border-radius:4px}.tools input{width:260px}.tools button{min-height:42px;border:1px solid #aebdca;background:#fff;color:var(--ink);padding:8px 14px;border-radius:4px;cursor:pointer}.tools button:hover{background:#eaf6ef}.stages{display:grid;gap:0}.stage{display:grid;grid-template-columns:36px 1fr;gap:16px;padding:20px 0;border-top:1px solid var(--line)}.stage:first-child{border-top:0;padding-top:0}.stage-number{display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:#e8f5ee;color:#075c44;font-weight:700}.stage p:not(.status){color:var(--muted);margin-bottom:8px}.stage a{font-size:14px}.status{color:var(--green);font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin:0}.finding{border-top:1px solid var(--line)}.finding:last-child{border-bottom:1px solid var(--line)}summary{cursor:pointer;padding:18px 4px;display:flex;gap:16px;align-items:center;justify-content:space-between}summary small{display:block;font-size:12px;letter-spacing:.03em;color:var(--muted)}summary strong{display:block;font-size:17px}summary::after{content:"+";color:var(--muted);font-size:24px}.finding[open]>summary::after{content:"−"}.finding p{max-width:900px;color:var(--muted);padding:0 4px 8px}.badge{margin-left:auto;white-space:nowrap;border-radius:4px;padding:4px 8px;font-size:12px;font-weight:700;background:#edf1f5;color:#33475f}.badge.fixed,.badge.owner-closed{background:#e4f4e9;color:#075c44}.badge.open{background:#fff0d3;color:#704600}.badge.unverified{background:#e9effb;color:#244474}.count{font-size:14px;color:var(--muted);margin-bottom:12px}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid var(--line)}thead th{background:#f4f7f9;color:var(--muted);font-size:12px;text-transform:uppercase}tbody th{font-weight:600;min-width:220px}td:nth-child(2){white-space:nowrap;color:var(--green);font-weight:700}.evidence{columns:2;column-gap:32px;padding-left:20px}.evidence li{break-inside:avoid;margin:0 0 8px}.fine{color:var(--muted);font-size:14px}footer{padding-top:0;color:var(--muted);font-size:13px}.js-only{display:none}.js .js-only{display:flex}@media(max-width:800px){header,main,footer{padding:20px}.facts{grid-template-columns:repeat(2,1fr)}.section{padding:20px}.evidence{columns:1}summary{flex-wrap:wrap}.badge{margin-left:0}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style></head><body>
<header><p class="eyebrow">Horticulture operations · 18 October 2026</p><h1>NSA / EVT remediation review</h1><p class="lede">All five roadmap stages are complete locally. This report keeps the remaining release risks visible and records the owner's clean-start decision.</p><div class="release-note"><strong>Release readiness remains unverified</strong>Dependency updates and target deployment checks remain outstanding. Completion of this roadmap does not certify the GitHub Pages or Edge local-file release.</div><div class="facts"><div class="fact"><b>5 of 5</b><span>Roadmap stages complete</span></div><div class="fact"><b>0</b><span>Owner decisions outstanding</span></div><div class="fact"><b>Paused</b><span>Clean-start status automation</span></div><div class="fact"><b>17 passed</b><span>Distinct Stage 5 browser checks</span></div></div></header>
<main><section class="section" aria-labelledby="roadmap-heading"><h2 id="roadmap-heading">Roadmap</h2><div class="tools js-only"><label>Stage<select id="stage-filter" aria-label="Stage"><option value="all">All stages</option>${stages.map(stage => `<option value="${stage.id}">${stage.id} · ${escape(stage.title)}</option>`).join('')}</select></label></div><div class="stages">${stageHtml}</div></section>
<section class="section" aria-labelledby="findings-heading"><h2 id="findings-heading">Findings and release limits</h2><div class="tools js-only"><label>Finding status<select id="status-filter" aria-label="Finding status"><option value="all">All statuses</option><option value="fixed">Remediated</option><option value="owner-closed">Owner decisions closed</option><option value="open">Open vendor update</option><option value="unverified">Not verified</option></select></label><label>Search findings<input id="finding-search" type="search" placeholder="Title, reference or detail"></label><button id="expand-all" type="button">Expand visible findings</button><button id="collapse-all" type="button">Collapse findings</button></div><p class="count" id="finding-count" role="status" aria-live="polite">8 findings and release limits</p>${findingHtml}</section>
<section class="section" aria-labelledby="verification-heading"><h2 id="verification-heading">Focused verification</h2><p class="fine">These rows use different units and overlap. They are not added into a single test total. The 17 browser cases comprise 15 passes from the retained run and two passes from the inspector-only rerun.</p><div class="table-wrap"><table><thead><tr><th scope="col">Check</th><th scope="col">Result</th><th scope="col">Evidence unit</th></tr></thead><tbody>${rows}</tbody></table></div><p class="fine">Desktop Chromium over local HTTP · 1600 × 1000 · Node ${escape(process.version)} · Playwright 1.62.0. No screenshots, mobile, touch, video or traces.</p></section>
<section class="section" aria-labelledby="evidence-heading"><h2 id="evidence-heading">Evidence and handover</h2><p>The client will receive a clean start with no saved operational workspace. The two historical sample budgets are not release decisions; no financial amounts were invented. Fresh and reset workspaces keep status automation paused. Ordinary normalization preserves explicit saved preferences.</p><ul class="evidence"><li><a href="stage-3-owner-decisions-2026-10-18.json">Dated owner decisions</a></li><li><a href="stage-5-checkpoint.md">Stage 5 checkpoint</a></li><li><a href="stage-5-results.json">Structured remediation data</a></li><li><a href="stage-5-preservation-results.json">Preservation verification</a></li><li><a href="final-remediation-report.md">Markdown counterpart</a></li><li><a href="${data.originalAudit}">Original immutable audit</a></li></ul><details><summary><strong>Earlier attempts and corrections</strong></summary>${data.priorAttempts.map(item => `<p><a href="${item.source}">${item.source}</a>: ${escape(item.outcome)}</p>`).join('')}</details><p class="fine">All substantive report data, styles and interactions are embedded in this file. Evidence links are optional local repository documents. No network request is needed to use the report.</p></section></main><footer>Working tree after ${data.baseCommit.slice(0, 7)} · Overtime excluded · No Stage 5 commit or push. ${preservation.trackedFilesChecked} tracked baseline files checked; ${changed.length} authorised changes and no unexpected changes.</footer>
<script type="application/json" id="report-data">${json.replace(/</g, '\\u003c')}</script>
<script>
'use strict';document.documentElement.classList.add('js');const stageFilter=document.getElementById('stage-filter'),statusFilter=document.getElementById('status-filter'),search=document.getElementById('finding-search'),findings=[...document.querySelectorAll('.finding')];function filter(){const stage=stageFilter.value,state=statusFilter.value,term=search.value.trim().toLowerCase();document.querySelectorAll('.stage').forEach(card=>card.hidden=stage!=='all'&&card.dataset.stage!==stage);let visible=0;for(const item of findings){item.hidden=(stage!=='all'&&item.dataset.stage!==stage)||(state!=='all'&&item.dataset.state!==state)||!item.dataset.search.includes(term);if(!item.hidden)visible++;}document.getElementById('finding-count').textContent=visible+' of '+findings.length+' findings shown';}stageFilter.addEventListener('change',filter);statusFilter.addEventListener('change',filter);search.addEventListener('input',filter);document.getElementById('expand-all').addEventListener('click',()=>findings.filter(item=>!item.hidden).forEach(item=>item.open=true));document.getElementById('collapse-all').addEventListener('click',()=>findings.forEach(item=>item.open=false));filter();
</script></body></html>\n`;
write('final-remediation-report.html', html);
const markdown = `# NSA/EVT final remediation report — 18 October 2026

<!-- report-data-sha256: ${dataHash} -->

**All five roadmap stages are complete locally. Release readiness remains UNVERIFIED.**
This assessment covers the working tree after ${data.baseCommit}; it does not certify a later deployment. No Stage 5 commit or push was performed.

## Roadmap

${stages.map(stage => `- **Stage ${stage.id}: ${stage.title} — complete.** ${stage.description} [Checkpoint](${stage.evidence}).`).join('\n')}

## Owner decisions and clean release

All three Stage 3 decisions are closed by the owner's 18 October instruction. The client has not received the release-ready version and will start with no saved workspace. The two absent historical sample budgets are irrelevant to that handover; no amounts were invented. Status automation must stay paused. Original and candidate sample files remain unchanged and are not adopted as client starting data. [Owner record](stage-3-owner-decisions-2026-10-18.json).

New and explicitly reset workspaces now default to paused automation with no invented activation actor/time. Ordinary normalization preserves explicit saved preferences. Two fresh-browser checks confirm empty operational collections, the 47 default Rate Items and paused automation before and after reload. Existing operator browser data was not erased; a clean handover requires fresh or deliberately cleared browser storage.

## Findings

${findings.map(item => `### ${item.id} — ${item.title}: ${item.label}\n\n${item.detail}\n`).join('\n')}

The MapLibre maintainer's [critical advisory](https://github.com/maplibre/maplibre-gl-js/security/advisories/GHSA-jrc7-96c5-q579) and PDF.js [mitigation advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq) are detailed in the Stage 4 assessment. No shipped vendor replacement occurred here.

## Verification

| Check | Result | Unit |
| --- | --- | --- |
${verification.map(item => `| ${item.name} | ${item.passed} passed | ${item.unit} |`).join('\n')}

These units overlap and must not be summed. Browser proof is 17 distinct cases: 15 passed in the retained main run, then only the two inspector cases were rerun. All selected cases have passing final evidence. Environment: desktop Chromium, local HTTP, 1600 × 1000, Node ${process.version}, Playwright 1.62.0. No screenshot, mobile, touch, video or trace tests were performed.

## Corrections during verification

${data.priorAttempts.map(item => `- [${item.source}](${item.source}): ${item.outcome}`).join('\n')}

The governance documentation regression initially used an overly narrow wording matcher; it was corrected and all 17 final cases passed. Earlier unsuccessful checks have not been hidden or represented as passing first attempts.

## Preservation and remaining release work

Checked ${preservation.trackedFilesChecked} tracked baseline hashes: ${changed.length} authorised changes, ${preservation.unchangedFiles} unchanged and zero unexpected changes. Original audit, both sample workspaces, shipped vendor files, Overtime and unrelated edits remain unchanged. [Preservation evidence](stage-5-preservation-results.json).

Separately scope the outstanding vendor/licence work and target GitHub Pages / Edge local-file checks before calling the client release ready. The PDF.js proposal also needs the broader document corpus and additional failure/entry-point checks identified in Stage 4. No existing operator workspace is automatically deleted by this work.

The [self-contained interactive HTML report](final-remediation-report.html) embeds the same [structured data](stage-5-results.json). The [original audit](${data.originalAudit}) remains immutable with its original verdict. Stage 5 is complete; stop here until the owner requests further work.
`;
write('final-remediation-report.md', markdown);
console.log(JSON.stringify({stagesComplete: 5, browserCasesPassed: browserCases.size, ownerDecisionsRemaining: 0,
  trackedFilesChecked: preservation.trackedFilesChecked, authorisedChanges: changed.length, dataSHA256: dataHash}));
