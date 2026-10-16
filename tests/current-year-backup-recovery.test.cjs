const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const workspace = JSON.parse(fs.readFileSync('src/sample/nsa-workspace-2026-27-schema-v5.json'));
const original = JSON.parse(fs.readFileSync('src/sample/horticulture-program-workspace-20260923-123603-v3.json'));

test('current-year recovery is reproducible and retains application payloads', () => {
  const rebuilt = JSON.parse(JSON.stringify(require('../scripts/convert_current_year_nsa_backup.cjs')));
  const model = require("./helpers/area-pricing-suite.cjs").loadSuite().ProgramModel;
  assert.deepEqual(rebuilt.workspace, JSON.parse(JSON.stringify(model.normalize(workspace))));
  const historical = JSON.parse(fs.readFileSync('src/sample/nsa-workspace-2026-27-conversion-report.json'));
  for (const key of Object.keys(historical)) {
    if (key === "idMappings") { for (const mapping of historical.idMappings) assert.ok(rebuilt.report.idMappings.some(item => JSON.stringify(item) === JSON.stringify(mapping))); }
    else if (key === "counts") { for (const name of Object.keys(historical.counts)) if (name !== "rateItems") assert.equal(rebuilt.report.counts[name], historical.counts[name]); }
    else assert.deepEqual(rebuilt.report[key], historical[key]);
  }
  assert.equal(workspace.entities.applications.length, 12);
  for (const application of workspace.entities.applications) {
    assert.deepEqual(application.payload, original.entities.applications.find(record => record.id === application.id).payload);
  }
  assert.equal(workspace.entities.applications.filter(record => record.status === 'in_progress').length, 2);
});

test('recovery contains no duplicate IDs or unrelated operational entities', () => {
  const ids = Object.values(workspace.entities).flat().map(record => record.id);
  assert.equal(new Set(ids).size, ids.length);
  const applications = new Set(workspace.entities.applications.map(record => record.id));
  const projects = new Set(workspace.entities.projects.map(record => record.id));
  for (const project of workspace.entities.projects) assert.ok(applications.has(project.applicationId));
  for (const task of workspace.entities.tasks) assert.ok(projects.has(task.projectId));
  assert.equal(workspace.entities.events.length, 0);
  assert.equal(workspace.entities.quotes.length, 0);
  assert.equal(workspace.entities.payments.length, 0);
  assert.equal(workspace.referenceData.EVT, undefined);
  assert.equal(workspace.workspace.projectChecklists, undefined);
});

test('workspace file detection accepts v4/v5 and rejects future versions and wrong identities', () => {
  const targets = [];
  const context = { UOS: { smartImport: { listTargets: () => targets, registerTarget: definition => targets.push(definition) } } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/shared/js/import-targets.js', 'utf8'), context);
  for (const [id, app, kind] of [['program-workspace-nsa', 'uos.horticulture.nsa', 'NSA'], ['program-workspace-events', 'uos.horticulture.events', 'EVT']]) {
    const predicate = targets.find(target => target.id === id).json.predicate;
    for (const version of [4, 5]) assert.equal(predicate({ app, exportAppId: app, workspaceKind: kind, schemaVersion: version }), true);
    assert.equal(predicate({ app, exportAppId: app, workspaceKind: kind, schemaVersion: 6 }), false);
    assert.equal(predicate({ app, exportAppId: 'wrong', workspaceKind: kind, schemaVersion: 5 }), false);
    assert.equal(predicate({ app, exportAppId: app, workspaceKind: 'wrong', schemaVersion: 5 }), false);
  }
});
