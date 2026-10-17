'use strict';

// Summarize retained evidence; this does not run tests or change application files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const evidence = path.resolve(__dirname, '..');
const root = path.resolve(evidence, '../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(evidence, name), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const checkedAt = new Date().toISOString();

const baseline = read('stage-4-preservation-baseline.json');
const differences = [];
for (const [relative, expected] of Object.entries(baseline.protectedFiles)) {
  const file = path.join(root, relative);
  const actual = fs.existsSync(file) ? hash(file) : null;
  if (actual !== expected) differences.push({path: relative, expected, actual});
}
const preservation = {
  checkedAt,
  baseline: 'stage-4-preservation-baseline.json',
  baselineSHA256: hash(path.join(evidence, 'stage-4-preservation-baseline.json')),
  protectedFiles: Object.keys(baseline.protectedFiles).length,
  allowedExistingChanges: baseline.allowedExistingChanges,
  differences,
  status: differences.length ? 'FAILED' : 'PASSED'
};
fs.writeFileSync(path.join(evidence, 'stage-4-preservation-results.json'), JSON.stringify(preservation, null, 2) + '\n');
assert.equal(differences.length, 0, 'A protected file changed during Stage 4');

const browser = read('stage-4-browser-results.json');
assert.deepEqual(browser.errors, []);
const cases = [];
function collect(suite) {
  for (const spec of suite.specs || []) {
    const tests = spec.tests || [];
    assert.equal(spec.ok, true, spec.title);
    for (const test of tests) {
      assert.equal(test.results.length, 1, 'No retry or hidden failed result expected');
      const result = test.results[0];
      assert.equal(result.status, 'passed', spec.title);
      const proofs = [];
      for (const attachment of result.attachments || []) {
        assert.equal(attachment.contentType, 'application/json', 'Only JSON evidence is allowed');
        assert.ok(attachment.body, 'Proof must be retained inline');
        proofs.push({name: attachment.name, value: JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8'))});
      }
      cases.push({title: spec.title, status: result.status, durationMs: result.duration, proofs});
    }
  }
  for (const child of suite.suites || []) collect(child);
}
for (const suite of browser.suites || []) collect(suite);
assert.equal(cases.length, 7);
assert.equal(browser.stats.expected, 7);
assert.equal(browser.stats.unexpected, 0);
assert.equal(browser.stats.skipped, 0);
assert.equal(browser.stats.flaky, 0);

const tap = fs.readFileSync(path.join(evidence, 'stage-4-runtime-tests.tap'), 'utf8');
const count = key => {
  const match = tap.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'));
  assert.ok(match, 'Missing TAP summary: ' + key);
  return Number(match[1]);
};
const loader = {tests: count('tests'), passed: count('pass'), failed: count('fail'), skipped: count('skipped')};
assert.deepEqual(loader, {tests: 3, passed: 3, failed: 0, skipped: 0});

const advisory = read('stage-4-advisories.json');
assert.equal(advisory.packages.length, 8);
for (const item of advisory.packages) {
  assert.ok(!item.error, 'Advisory query failed: ' + item.name);
  assert.equal(item.completeFirstPage, true, 'Incomplete advisory query');
}
const inventory = read('stage-4-vendor-inventory.json');
const pkg = read('stage-4-pdf-package.json');
const build = read('stage-4-build.json');
assert.equal(build.shippedFilesChanged, false);
assert.equal(pkg.repositoryDependenciesChanged, false);

const artifactFiles = fs.readdirSync(__dirname).map(name => 'stage-4/' + name);
artifactFiles.push('README.md', 'stage-4-checkpoint.md', 'stage-4-pdf-package.json',
  'stage-4-build.json', 'stage-4-vendor-inventory.json', 'stage-4-advisories.json',
  'stage-4-runtime-tests.tap', 'stage-4-browser-results.json',
  'stage-4-browser-attempt-1.json', 'stage-4-browser-attempt-2.json',
  'stage-4-browser-attempt-3.json', 'stage-4-preservation-results.json');
const artifacts = Object.fromEntries(artifactFiles.sort().map(name => [name, {
  bytes: fs.statSync(path.join(evidence, name)).size,
  sha256: hash(path.join(evidence, name))
}]));
const result = {
  checkedAt,
  stage: 4,
  status: 'COMPLETE',
  nextStage: 5,
  nextStageStarted: false,
  assessment: 'CONDITIONAL_UPGRADE_PROPOSAL',
  productionVerdict: 'UNVERIFIED',
  shippedRuntimeChanged: false,
  dependencyInstallationPerformed: false,
  commitOrPushPerformed: false,
  scope: 'NSA/EVT only; Overtime excluded',
  preservation,
  loader,
  browser: {stats: browser.stats, cases, mediaAttachments: 0},
  inventory: {
    dependencies: inventory.dependencies.length,
    vendorFiles: inventory.vendorFiles.length,
    missingFullLocalLicences: inventory.dependencies.filter(item => item.licenseEvidence && item.licenseEvidence.present === false).map(item => item.name),
    gaps: inventory.gaps
  },
  advisorySnapshot: {
    checkedAt: advisory.checkedAt,
    source: advisory.source,
    queries: advisory.packages.map(item => ({
      name: item.name, version: item.version, matches: item.advisories.length,
      advisories: item.advisories.map(entry => ({id: entry.ghsaId, severity: entry.severity, url: entry.url}))
    })),
    limitation: 'Exact top-level package snapshot, not a complete transitive SBOM or security certification'
  },
  candidate: {version: pkg.version, variant: build.variant, contract: build.contract},
  adoptionGates: [
    'Edge file://, other browsers and GitHub Pages not verified',
    'Actual EVT Register import not exercised',
    'Broader PDF corpus and optional CMap/font/WASM asset needs not assessed',
    'Dedicated worker failure and late module completion after timeout not specifically exercised',
    'MapLibre advisory and full local licence texts require a separate vendor update'
  ],
  priorAttempts: [
    {file: 'stage-4-browser-attempt-1.json', finding: 'Flattened sample has no form fields; harness corrected and source-generated AcroForm added'},
    {file: 'stage-4-browser-attempt-2.json', finding: 'Removed document destroy API; candidate loading-task cleanup bridge added'},
    {file: 'stage-4-browser-attempt-3.json', finding: 'Field objects changed to Map; parity harness normalizes representations'}
  ],
  artifacts
};
fs.writeFileSync(path.join(evidence, 'stage-4-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({stage: result.stage, status: result.status, protectedFiles: preservation.protectedFiles,
  changedProtectedFiles: differences.length, browserPassed: cases.length, loaderPassed: loader.passed, nextStage: result.nextStage}));
