'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { loadSuite, buildCandidate, health, SOURCE, SOURCE_SHA256 } = require('../scripts/review_nsa_workspace_warnings.cjs');
const source = () => JSON.parse(fs.readFileSync(SOURCE));

test('approved workspace has the audited identity and all 57 warnings', () => {
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(SOURCE)).digest('hex'), SOURCE_SHA256);
  const UOS = loadSuite(), workspace = source();
  assert.equal(UOS.ProgramModel.validate(workspace).length, 0);
  assert.deepEqual(health(UOS, workspace).counts, { error: 0, warning: 57, total: 57 });
});

test('global-rate migration archives obsolete Project links and keeps the candidate valid', () => {
  const UOS = loadSuite(), workspace = source();
  const { candidate, candidateHealth } = buildCandidate(UOS, workspace);
  assert.equal(UOS.ProgramModel.validate(candidate).length, 0);
  assert.equal(candidateHealth.counts.warning, 3);
  assert.equal(candidate.entities.rateItems.length, 54);
  assert.equal(candidate.entities.tasks.length, 50);
  assert.equal(candidate.entities.applications.length, 12);
  assert.equal(candidate.migration.statusReadiness.automationPaused, true);
  assert.equal(candidate.migration.statusReadiness.status, 'review-required');
  assert.ok(candidate.entities.projects.every(project => project.funding === undefined));
});

test('global-rate migration retains unresolved Project links instead of guessing a replacement', () => {
  const UOS = loadSuite(), workspace = source();
  workspace.entities.projects[0].catalogId = 'UNKNOWN-CATALOG';
  const before = JSON.stringify(workspace);
  const result = UOS.ProgramModel.canonicalizeLegacyGlobalRates(workspace).workspace;
  assert.equal(result.entities.projects[0].catalogId, 'UNKNOWN-CATALOG');
  assert.ok(UOS.ProgramModel.validate(result).some(error => error.includes('UNKNOWN-CATALOG')));
  assert.equal(JSON.stringify(workspace), before);
});

test('global-rate migration never overwrites a malformed Project-link archive', () => {
  const UOS = loadSuite(), workspace = source();
  workspace.migration.legacyRateMigrationArchive = { catalogs: [], rateItems: [], projectCatalogLinks: 'preserve this evidence' };
  const before = JSON.stringify(workspace);
  assert.throws(() => UOS.ProgramModel.canonicalizeLegacyGlobalRates(workspace), /Project-link archive/);
  assert.equal(JSON.stringify(workspace), before);
});
