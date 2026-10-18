'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const evidence = path.resolve(__dirname, '..');
const root = path.resolve(evidence, '../../..');
const read = name => fs.readFileSync(path.join(evidence, name), 'utf8');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const dataSource = read('stage-5-results.json');
const data = JSON.parse(dataSource);
const html = read('final-remediation-report.html');
const markdown = read('final-remediation-report.md');
const dataHash = sha(dataSource);
const embedded = html.match(/<script type="application\/json" id="report-data">([\s\S]*?)<\/script>/)?.[1];
assert.ok(embedded, 'Embedded report data missing');
assert.deepEqual(JSON.parse(embedded), data);
assert.ok(html.includes('name="report-data-sha256" content="' + dataHash + '"'));
assert.ok(markdown.includes('report-data-sha256: ' + dataHash));
assert.equal(data.ownerDecisionsRemaining, 0);
assert.equal(data.cleanAutomationDefault, 'paused');
assert.equal(data.releaseReadiness, 'UNVERIFIED');
assert.ok(!/<script[^>]+src=|<link[^>]+href=|@import|\bfetch\(|XMLHttpRequest|\bimport\(/i.test(html), 'Report has a runtime external dependency');
const links = [...html.matchAll(/href="([^"]+)"/g), ...markdown.matchAll(/\]\(([^)]+)\)/g)]
  .map(match => match[1]).filter(target => !/^(https?:|#)/.test(target));
const missing = links.filter(target => !fs.existsSync(path.resolve(evidence, target)));
assert.deepEqual(missing, [], 'Missing local report links');

const browser = JSON.parse(read('stage-5-report-browser-results.json'));
assert.equal(browser.stats.expected, 2);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
assert.deepEqual(browser.errors, []);
let proof;
let media = 0;
function inspect(suite) {
  for (const spec of suite.specs || []) for (const test of spec.tests || []) for (const result of test.results || []) {
    assert.equal(result.status, 'passed');
    for (const attachment of result.attachments || []) {
      if (attachment.name === 'report-proof') proof = JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8'));
      if (/^(image|video)\//.test(attachment.contentType) || /trace|screenshot|\.zip$/i.test(attachment.name || '')) media++;
    }
  }
  for (const child of suite.suites || []) inspect(child);
}
browser.suites.forEach(inspect);
assert.ok(proof);
assert.equal(proof.dataSHA256, dataHash);
assert.equal(proof.networkRequests, 0);
assert.equal(proof.pageErrors, 0);
assert.equal(media, 0);

const baseline = JSON.parse(read('stage-5-preservation-baseline.json'));
const preservation = JSON.parse(read('stage-5-preservation-results.json'));
const allowed = new Map(preservation.authorisedChanges.map(item => [item.path, item.after]));
const unexpected = [];
for (const [relative, before] of Object.entries(baseline.protectedFiles)) {
  const after = sha(fs.readFileSync(path.join(root, relative)));
  if (after !== (allowed.get(relative) || before)) unexpected.push(relative);
}
assert.deepEqual(unexpected, [], 'Source changed after verification');
const artifactNames = [
  'final-remediation-report.md', 'final-remediation-report.html', 'stage-5-results.json',
  'stage-5-checkpoint.md', 'stage-3-owner-decisions-2026-10-18.json',
  'stage-5-preservation-baseline.json', 'stage-5-preservation-results.json',
  'stage-5-report-browser-results.json', 'stage-5-report-browser-attempt-1.json',
  'stage-5-actor-model-results.json', 'stage-5-governance-tests.tap',
  'stage-5-default-model-results.tap', 'stage-5-clean-default-tests.tap',
  'stage-5-browser-attempt-1.json', 'stage-5-browser-attempt-2.json',
  'stage-5-browser-attempt-3.json', 'stage-5-inspector-browser-attempt-1.json',
  'stage-5-inspector-browser-results.json', 'stage-5/build-report.cjs',
  'stage-5/playwright.config.cjs', 'stage-5/validate-report.cjs'
];
const artifacts = Object.fromEntries(artifactNames.map(name => [name, {bytes: Buffer.byteLength(read(name)), sha256: sha(read(name))}]));
const testFiles = [
  'tests/payment-reversal-attribution.test.cjs', 'tests/browser/payment-reversal-attribution.spec.js',
  'tests/browser/stage5-clean-start.spec.js', 'tests/browser/stage5-inspector-styles.spec.js',
  'tests/browser/stage5-remediation-report.spec.js'
];
const result = {
  checkedAt: new Date().toISOString(), stage: 5, status: 'PASSED',
  applicationBrowserCasesPassed: data.browser.passed, reportBrowserCasesPassed: browser.stats.expected,
  reportDataMatches: true, markdownDataHashMatches: true, externalRuntimeDependencies: 0,
  offlineProof: proof, javascriptDisabledContentPassed: true,
  localLinksChecked: links.length, missingLinks: missing, mediaAttachments: media,
  baselineFilesChecked: Object.keys(baseline.protectedFiles).length, unexpectedChanges: unexpected,
  artifacts, testSources: Object.fromEntries(testFiles.map(file => [file, sha(fs.readFileSync(path.join(root, file)))])),
  releaseReadiness: 'UNVERIFIED', commitOrPushPerformed: false
};
fs.writeFileSync(path.join(evidence, 'stage-5-report-validation.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({status: result.status, applicationBrowserCases: data.browser.passed,
  reportBrowserCases: browser.stats.expected, localLinksChecked: links.length,
  protectedBaselineFiles: result.baselineFilesChecked, unexpectedChanges: unexpected.length}));
