'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const directory = __dirname;
const root = path.resolve(directory, '../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const models = read(path.join(directory, 'model-results.json'));
assert.equal(models.totals.passed, 121);
assert.equal(models.totals.failed, 0);
const cases = new Map();
let mediaAttachments = 0;
function collect(suite, source) {
  for (const spec of suite.specs || []) for (const test of spec.tests || []) {
    const result = test.results?.at(-1);
    if (!result) continue;
    for (const attachment of result.attachments || []) {
      if (/^(image|video)\//.test(attachment.contentType) || /trace|screenshot|\.zip$/i.test(attachment.name || '')) mediaAttachments++;
    }
    cases.set(spec.title, {title: spec.title, status: result.status, durationMs: result.duration, source});
  }
  for (const child of suite.suites || []) collect(child, source);
}
for (const source of ['browser-attempt-2.json', 'map-browser-results.json']) {
  for (const suite of read(path.join(directory, source)).suites) collect(suite, source);
}
assert.equal(cases.size, 16);
for (const result of cases.values()) assert.equal(result.status, 'passed', result.title);
assert.equal(mediaAttachments, 0);

const stage5 = path.join(root, 'docs/remediation/nsa-evt-release-2026-10-17');
const baseline = read(path.join(stage5, 'stage-5-preservation-baseline.json'));
const prior = read(path.join(stage5, 'stage-5-preservation-results.json'));
const priorHashes = new Map(prior.authorisedChanges.map(item => [item.path, item.after]));
const allowed = new Set([
  'src/program-planner/index.html', 'src/program-planner/js/quote-model.js',
  'src/program-planner/js/quote-builder.js', 'src/remediation-planner/js/map.js',
  'src/shared/css/components.css', 'src/program-planner/styles.css',
  'src/program-planner/status-v5.css', 'tests/quote-funding.test.cjs',
  'tests/governed-remediation.test.cjs', 'tests/calculator-bulk-delete.test.cjs',
  'tests/browser/quote-funding.spec.js', 'tests/browser/quote-first-interaction.spec.js',
  'tests/browser/quote-payment-funding-workflow.spec.js'
]);
const changed = [];
for (const [relative, original] of Object.entries(baseline.protectedFiles)) {
  const before = priorHashes.get(relative) || original;
  const after = sha(path.join(root, relative));
  if (before !== after) {
    assert.ok(allowed.has(relative), 'Unexpected follow-up modification: ' + relative);
    changed.push({path: relative, before, after});
  }
}
const artifacts = fs.readdirSync(directory).filter(name => name !== 'results.json').sort();
const newTests = ['tests/browser/map-navigation-refinements.spec.js', 'tests/browser/header-status-refinements.spec.js'];
const result = {
  checkedAt: new Date().toISOString(), status: 'PASSED', scope: 'NSA/EVT funding and UI refinements',
  modelCasesPassed: models.totals.passed, distinctBrowserCasesPassed: cases.size,
  browserCases: [...cases.values()], mediaAttachments,
  preservation: {baselineFilesChecked: Object.keys(baseline.protectedFiles).length,
    comparedWith: 'Stage 5 completed source hashes plus its unchanged-file baseline',
    authorisedFollowupChanges: changed, unexpectedChanges: [], overtimeUnchanged: true,
    originalSamplesAndVendorFilesUnchanged: true},
  artifacts: Object.fromEntries(artifacts.map(name => [name, {bytes: fs.statSync(path.join(directory, name)).size, sha256: sha(path.join(directory, name))}])),
  newTests: Object.fromEntries(newTests.map(file => [file, sha(path.join(root, file))])),
  commitOrPushPerformed: false,
  limits: 'Local desktop Chromium HTTP proof; no screenshots/mobile/touch/video/traces or deployment certification'
};
fs.writeFileSync(path.join(directory, 'results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({status: result.status, modelCases: result.modelCasesPassed,
  browserCases: cases.size, protectedFiles: result.preservation.baselineFilesChecked,
  followupChanges: changed.length, mediaAttachments}));
