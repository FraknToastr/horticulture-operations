'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const SOURCE = 'src/sample/nsa-workspace-2026-27-area-pricing-v5.json';
const SOURCE_SHA256 = 'd3424d247bca9586f1a35a7e3e584fa18b637e0bbeb44b0e29da84122c64ec5f';
const CANDIDATE = 'src/sample/nsa-workspace-2026-27-global-rates-reviewed-v5.json';
const EVIDENCE = 'docs/remediation/nsa-evt-release-2026-10-17';
const plain = value => JSON.parse(JSON.stringify(value));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function loadSuite() {
  const context = {
    console, structuredClone, TextEncoder, TextDecoder, Uint8Array, DataView,
    ArrayBuffer, URL, URLSearchParams, setTimeout, clearTimeout, crypto: crypto.webcrypto,
    document: { currentScript: { src: 'http://example.test/src/shared/js/imports.js' } }
  };
  context.window = context;
  context.root = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: 'uos.horticulture.nsa', workspaceKind: 'NSA', owner: 'NSA' }) } };
  vm.createContext(context);
  const files = [
    ...['imports.js', 'smart-import.js', 'rate-library.js', 'map-costing.js'].map(name => `src/shared/js/${name}`),
    ...['status.js', 'default-rate-catalog.js', 'model.js', 'funding-model.js',
      'quote-model.js', 'status-model.js', 'scheduler-model.js', 'costing-model.js',
      'moasure-geometry.js', 'work-area-service.js', 'product-contracts.js',
      'data-health.js', 'status-health.js', 'data-workspace.js'].map(name => `src/program-planner/js/${name}`)
  ];
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  return context.UOS;
}

function health(UOS, workspace) { return plain(UOS.ProgramDataHealth.check(workspace)); }
function groups(report) {
  return report.issues.reduce((counts, issue) => {
    counts[issue.code] = (counts[issue.code] || 0) + 1;
    return counts;
  }, {});
}
function valid(UOS, workspace) {
  const errors = Array.from(UOS.ProgramModel.validate(workspace));
  assert.equal(errors.length, 0, errors.join('\n'));
}

function buildCandidate(UOS, source) {
  const before = JSON.stringify(source);
  valid(UOS, source);
  const originalHealth = health(UOS, source);
  assert.equal(originalHealth.counts.error, 0);
  assert.deepEqual(groups(originalHealth), {
    STATUS_MIGRATION_READINESS: 1, FUNDING_OPERATIONAL_AMOUNT_MISSING: 2, RATE_LEGACY_CATALOG_ACTIVE: 54
  });
  const migrated = UOS.ProgramModel.canonicalizeLegacyGlobalRates(source);
  assert.equal(migrated.unresolved.length, 0, 'Migration requires unresolved decisions');
  const candidate = plain(migrated.workspace);
  valid(UOS, candidate);
  const candidateHealth = health(UOS, candidate);
  assert.deepEqual(groups(candidateHealth), { STATUS_MIGRATION_READINESS: 1, FUNDING_OPERATIONAL_AMOUNT_MISSING: 2 });
  assert.equal(candidateHealth.counts.error, 0);
  assert.equal(JSON.stringify(source), before, 'Migration changed its input');
  assert.deepEqual(plain(UOS.ProgramModel.canonicalizeLegacyGlobalRates(candidate).workspace), candidate);

  const archive = candidate.migration.legacyRateMigrationArchive;
  assert.deepEqual(archive.catalogs, source.entities.catalogs);
  assert.deepEqual(archive.rateItems, source.entities.rateItems);
  assert.deepEqual(archive.projectCatalogLinks, source.entities.projects.map(project => ({ projectId: project.id, catalogId: project.catalogId })));
  const sourceRates = new Map(source.entities.rateItems.map(rate => [rate.id, rate]));
  assert.deepEqual(candidate.entities.rateItems.map(rate => rate.id).sort(), [...sourceRates.keys()].sort());
  for (const rate of candidate.entities.rateItems) {
    const old = sourceRates.get(rate.id);
    const original = plain(old), current = plain(rate);
    delete original.catalogId; delete current.catalogId; delete current.migrationProvenance;
    assert.deepEqual(current, original, `Rate content or source provenance changed: ${rate.id}`);
    assert.equal(rate.catalogId, null);
    assert.deepEqual(rate.migrationProvenance.legacyCatalogs, source.entities.catalogs.filter(catalog => catalog.id === old.catalogId).map(catalog => ({ catalogId: catalog.id, owner: catalog.owner, financialYear: catalog.financialYear })));
  }
  for (const [collection, records] of Object.entries(source.entities)) {
    if (['catalogs', 'rateItems', 'projects'].includes(collection)) continue;
    assert.deepEqual(candidate.entities[collection], records, `Operational collection changed: ${collection}`);
  }
  assert.equal(candidate.entities.catalogs.length, 0);
  for (const project of candidate.entities.projects) {
    const old = source.entities.projects.find(record => record.id === project.id);
    assert.deepEqual(project, { ...old, catalogId: null });
  }
  const originalTop = plain(source), candidateTop = plain(candidate);
  delete originalTop.entities; delete candidateTop.entities;
  delete candidateTop.migration.legacyRateMigrationArchive;
  assert.deepEqual(candidateTop, originalTop, 'Unrelated metadata or reference mappings changed');
  return { candidate, originalHealth, candidateHealth };
}

function main() {
  assert.ok(process.argv.slice(2).every(argument => argument === '--check'), 'Use no arguments, or --check');
  const bytes = fs.readFileSync(path.join(root, SOURCE));
  assert.equal(sha(bytes), SOURCE_SHA256, 'Approved original changed; review it before proceeding');
  const source = JSON.parse(bytes);
  const { candidate, originalHealth, candidateHealth } = buildCandidate(loadSuite(), source);
  const output = JSON.stringify(candidate, null, 2) + '\n';
  const outputPath = path.join(root, CANDIDATE);
  if (process.argv.includes('--check') || fs.existsSync(outputPath)) {
    assert.equal(fs.readFileSync(outputPath, 'utf8'), output, 'Existing candidate differs; it will not be overwritten');
  } else fs.writeFileSync(outputPath, output, { flag: 'wx' });
  const inventory = originalHealth.issues.map(issue => ({
    ...issue,
    disposition: issue.code === 'RATE_LEGACY_CATALOG_ACTIVE' ? 'corrected-in-candidate' : 'owner-decision-required',
    decision: issue.code === 'FUNDING_OPERATIONAL_AMOUNT_MISSING'
      ? 'Record the authorised Council operational amount; no source amount exists, including evidence for zero.'
      : issue.code === 'STATUS_MIGRATION_READINESS'
        ? 'An attributed officer must review readiness and decide whether to enable automation.'
        : 'Migrate legacy eligibility metadata; preserve rate IDs, source records and obsolete Project links in the migration archive.'
  }));
  const report = {
    source: { path: SOURCE, sha256: sha(bytes), bytes: bytes.length },
    candidate: { path: CANDIDATE, sha256: sha(output), bytes: Buffer.byteLength(output), adopted: false },
    original: { counts: originalHealth.counts, groups: groups(originalHealth) },
    reviewed: { counts: candidateHealth.counts, groups: groups(candidateHealth) },
    correctedWarnings: 54,
    ownerDecisions: inventory.filter(issue => issue.disposition === 'owner-decision-required'),
    inventory,
    projectCatalogLinks: candidate.migration.legacyRateMigrationArchive.projectCatalogLinks,
    safety: { originalUntouched: sha(fs.readFileSync(path.join(root, SOURCE))) === SOURCE_SHA256, idsPreserved: true, sourceArchivesExact: true, inputUnchanged: true, idempotent: true }
  };
  if (!process.argv.includes('--check')) fs.writeFileSync(path.join(root, EVIDENCE, 'stage-3-warning-review.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ originalWarnings: originalHealth.counts.warning, candidateWarnings: candidateHealth.counts.warning, corrected: 54, candidate: CANDIDATE, checked: process.argv.includes('--check') }));
}

if (require.main === module) main();
module.exports = { loadSuite, buildCandidate, health, groups, SOURCE, SOURCE_SHA256, CANDIDATE };
