'use strict';
// Record existing evidence only. This does not implement Stage 5 or run tests.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const relative = file => path.relative(root, file);
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const entry = file => ({path: relative(file), bytes: fs.statSync(file).size, sha256: sha(file)});
function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(item => item.isDirectory()
    ? walk(path.join(dir, item.name)) : [path.join(dir, item.name)]);
}
const baselinePath = path.join(__dirname, 'stage-4-preservation-baseline.json');
const baseline = JSON.parse(fs.readFileSync(baselinePath));
const differences = Object.entries(baseline.protectedFiles).filter(([file, hash]) =>
  !fs.existsSync(path.join(root, file)) || sha(path.join(root, file)) !== hash).map(([file]) => file);
if (differences.length) throw new Error('Protected files changed: ' + differences.join(', '));

const sources = [
  'AGENTS.md', 'src/governance/DECISIONS.md', 'src/governance/PRODUCT_CONTRACTS.md',
  'src/governance/PRODUCT_CONSTITUTION.md', 'src/governance/RELEASE_GATES.md',
  'src/program-planner/js/quote-model.js', 'src/program-planner/js/quote-builder.js',
  'src/program-planner/js/planner.js', 'src/program-planner/js/status.js',
  'src/program-planner/js/status-ui.js', 'src/program-planner/js/status-model.js',
  'src/program-planner/js/model.js', 'src/program-planner/js/storage.js',
  'src/program-planner/js/program-map.js', 'src/program-planner/space-map-editor.css',
  'src/program-planner/styles.css', 'src/program-planner/client-demo-fixes.css',
  'src/shared/css/tokens.css', 'src/shared/css/components.css',
  'tests/quote-funding.test.cjs', 'tests/browser/quote-first-interaction.spec.js',
  'tests/browser/quote-payment-funding-workflow.spec.js',
  'tests/browser/performance-audit.spec.js', 'tests/browser/space-map-editor.spec.js',
  'tests/browser/space-map-sidebar.spec.js', 'tests/canonical-work-governance.test.cjs',
  'playwright.desktop.config.cjs', 'scripts/desktop-browser-guard.cjs'
];
const lineage = fs.readdirSync(path.join(root, 'src/governance')).find(name => name.startsWith('PC-020'));
if (!lineage) throw new Error('PC-020 document missing');
sources.push('src/governance/' + lineage);
const prior = walk(__dirname).filter(file => /^stage-[1-4](?:[-/.])/.test(path.relative(__dirname, file)));
const audit = path.join(root, 'docs/audits/nsa-evt/20261017-094545-local-8545d67');
const anchors = [
  {file: path.join(audit, 'report.md'), pattern: /^### F-00[467]/},
  {file: path.join(root, 'src/governance/DECISIONS.md'), pattern: /^## Explicit Planner calendar creation/},
  {file: path.join(root, 'src/program-planner/js/quote-model.js'), pattern: /function reversePayment\(/},
  {file: path.join(root, 'src/program-planner/js/quote-builder.js'), pattern: /function reversePaymentWithReason\(/},
  {file: path.join(root, 'src/program-planner/js/planner.js'), pattern: /uos\.program\.statusOperator/},
  {file: path.join(root, 'src/program-planner/js/status-ui.js'), pattern: /payment\.reversedBy/}
].map(({file, pattern}) => ({path: relative(file), matches: fs.readFileSync(file, 'utf8').split('\n')
  .flatMap((line, i) => pattern.test(line) ? [{line: i + 1, text: line.trim().slice(0, 600)}] : [])}));
for (const anchor of anchors) if (!anchor.matches.length) throw new Error('Missing anchor: ' + anchor.path);
const stage4 = JSON.parse(fs.readFileSync(path.join(__dirname, 'stage-4-results.json')));
const git = args => cp.execFileSync('rtk', ['proxy', 'git', ...args], {cwd: root, encoding: 'utf8'}).trim();
const result = {
  recordedAt: new Date().toISOString(), stage: 5, status: 'DEFERRED_BY_OWNER',
  reason: 'Waiting for a quota top-up', implementationStarted: false,
  testsRunForThisHandoff: false, resumeRequiresOwnerRequest: true, commitOrPushPerformed: false,
  branch: git(['branch', '--show-current']),
  upstream: git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']),
  baseCommit: git(['rev-parse', 'HEAD']),
  workingTree: 'Uncommitted prior-stage and unrelated changes exist; preserve them',
  plan: entry(path.join(__dirname, 'stage-5-resume-plan.md')),
  readme: entry(path.join(__dirname, 'README.md')),
  preservation: {baseline: relative(baselinePath), protectedFiles: Object.keys(baseline.protectedFiles).length,
    differences, readmeIsAllowedExistingChange: true},
  priorStageSummary: {complete: [1, 2, 3, 4], stage4: {
    browserPassed: stage4.browser.stats.expected, loaderPassed: stage4.loader.passed,
    shippedRuntimeChanged: stage4.shippedRuntimeChanged, assessment: stage4.assessment},
    productionVerdict: 'UNVERIFIED', stage3CandidateAdopted: false, stage3OwnerDecisionsRemaining: 3},
  openItems: [
    'Governance conflicts with accepted 1 October explicit-calendar decision',
    'Named officer required for new reversals; historical actors must not be invented',
    'CSS cleanup requires proof of redundancy and computed-style parity',
    'Critical MapLibre advisory and full local licence texts remain open; separate vendor update',
    'PDF.js candidate adoption needs entry-point, browser and broader PDF checks',
    'Stage 3 owner decisions remain pending'
  ],
  evidenceAnchors: anchors, priorStageArtifacts: prior.sort().map(entry),
  originalAudit: ['README.md', 'report.md', 'report.html', 'results.json'].map(name => entry(path.join(audit, name))),
  sourceInputs: sources.map(file => entry(path.join(root, file))),
  recorder: entry(__filename),
  limitations: [
    'This manifest inventories existing evidence; no new application tests were run',
    'Evidence describes local desktop HTTP checks, not GitHub Pages or Edge file:// certification',
    'No Stage 5 code, CSS or governance changes have been implemented',
    'Historical manifests retain their original README hash; this handoff records the updated README separately'
  ]
};
fs.writeFileSync(path.join(__dirname, 'stage-5-deferred-evidence.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({status: result.status, protectedFiles: result.preservation.protectedFiles,
  changedProtectedFiles: differences.length, priorStageArtifacts: prior.length, sourceInputs: sources.length}));
