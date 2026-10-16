// Read-only converter: emits the workspace and report; never modifies the source.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = 'src/sample/horticulture-program-workspace-20260923-123603-v3.json';
const original = JSON.parse(fs.readFileSync(path.join(root, source), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const context = { console, structuredClone, TextEncoder, TextDecoder, Uint8Array, DataView, ArrayBuffer, URLSearchParams, DecompressionStream, crypto };
context.window = context;
context.UOS = { ProgramAppConfig: { current: () => ({ appId: 'uos.horticulture.nsa', workspaceKind: 'NSA', owner: 'NSA' }) } };
vm.createContext(context);
for (const file of ['status.js', 'default-rate-catalog.js', 'model.js', 'status-model.js', 'data-workspace.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'src/program-planner/js', file), 'utf8'), context, { filename: file });
}
const { ProgramModel: model, ProgramStatus: status, ProgramData: data } = context.UOS;
const report = { source, financialYear: '2026–27', cutoff: { from: '2026-07-01', through: '2027-06-30' }, excludedApplications: [], idMappings: [], statusRepairs: [], checklistConflicts: [], unconvertedChecklists: [], sourceWarnings: clone(original.migration.warnings || []) };
const workspace = clone(original);
workspace.entities.applications = original.entities.applications.filter(record => {
  const received = record.payload?.dateReceived || record.dateReceived || '';
  const keep = record.owner === 'NSA' && /^\d{4}-\d{2}-\d{2}$/.test(received) && received >= report.cutoff.from && received <= report.cutoff.through;
  if (!keep) report.excludedApplications.push({ id: record.id, title: record.title || '', received, reason: received ? 'Outside received-date financial-year scope' : 'Received date unavailable' });
  return keep;
});
const applicationIds = new Set(workspace.entities.applications.map(record => record.id));
workspace.entities.projects = workspace.entities.projects.filter(record => record.owner === 'NSA' && applicationIds.has(record.applicationId));
const projectIds = new Set(workspace.entities.projects.map(record => record.id));
for (const [collection, records] of Object.entries(workspace.entities)) {
  if (['applications', 'projects', 'rateItems'].includes(collection)) continue;
  workspace.entities[collection] = records.filter(record => record.owner === 'NSA' && projectIds.has(record.projectId));
}
const checklists = {};
for (const project of workspace.entities.projects) {
  const primary = original.workspace.projectChecklists?.[project.id] || {};
  const secondary = original.workspace.projectChecklists?.[project.applicationId] || {};
  const merged = clone(primary);
  for (const [key, saved] of Object.entries(secondary)) {
    if (!/^\d+$/.test(key) || Number(key) < 1 || Number(key) > 25) {
      report.unconvertedChecklists.push({ applicationId: project.applicationId, key, saved, reason: 'Not a current NSA checklist key; no inferred task mapping' });
    } else if (!merged[key]) merged[key] = clone(saved);
    else if (JSON.stringify(merged[key]) !== JSON.stringify(saved)) report.checklistConflicts.push({ projectId: project.id, key, retained: merged[key], alternative: saved, resolution: 'Project-scoped checklist is authoritative' });
  }
  checklists[project.id] = merged;
}
for (const application of workspace.entities.applications) {
  if (!workspace.entities.projects.some(project => project.applicationId === application.id) && original.workspace.projectChecklists?.[application.id]) {
    report.unconvertedChecklists.push({ applicationId: application.id, saved: original.workspace.projectChecklists[application.id], reason: 'No linked project; not inventing a project' });
  }
}
workspace.app = 'uos.horticulture.nsa';
workspace.workspaceKind = 'NSA';
workspace.exportAppId = workspace.app;
workspace.context = { financialYear: '2026–27', locale: 'en-AU', selectedOwner: 'NSA', timeZone: 'Australia/Adelaide' };
workspace.workspace = { ownerMode: 'NSA', destination: 'register', projectChecklists: checklists };
workspace.referenceData = { NSA: clone(original.referenceData.NSA || {}), shared: clone(original.referenceData.shared || {}) };
workspace.migration = { status: 'migrated', sources: [source], warnings: [] };
for (const application of workspace.entities.applications) {
  const code = status.codeFor('register_nsa', application.status);
  if (code === status.reviewCode) {
    report.statusRepairs.push({ id: application.id, from: application.status, to: 'received', reason: 'Invalid application status' });
    application.status = 'received';
    if (application.payload) application.payload.status = 'received';
  }
}
let converted = model.normalize(workspace);
// Planner task generation can introduce display-label statuses after v5 migration.
converted = status.migrate(converted);
converted = model.normalize(converted);
converted.exportAppId = converted.app;
converted.migration.currentYearRecovery = { source, financialYear: report.financialYear, receivedFrom: report.cutoff.from, receivedThrough: report.cutoff.through };
model.assertValid(converted);
data.assertWorkspaceIsolation(converted, 'NSA');
if (JSON.stringify(model.normalize(converted)) !== JSON.stringify(converted)) throw new Error('Conversion is not normalization-stable');
const roundtrip = model.importJson(data.exportJson(converted, 'NSA'));
model.assertValid(roundtrip);
const orderedEntities = entities => Object.fromEntries(Object.entries(clone(entities)).map(([name, records]) => [name, records.sort((a, b) => a.id.localeCompare(b.id))]));
assert.deepStrictEqual(orderedEntities(roundtrip.entities), orderedEntities(converted.entities), 'Export/import changed entities');
report.counts = Object.fromEntries(Object.entries(converted.entities).filter(([, records]) => records.length).map(([name, records]) => [name, records.length]));
report.idMappings = converted.entities.rateItems.filter(record => record.provenance?.sourceId && record.provenance.sourceId !== record.id).map(record => ({ collection: 'rateItems', from: record.provenance.sourceId, to: record.id }));
report.taskStatusNormalization = 'Saved display labels converted to canonical task codes; task progress preserved.';
report.retainedApplications = converted.entities.applications.map(record => ({ id: record.id, title: record.title, received: record.payload.dateReceived, status: record.status }));
report.validation = { model: 'passed', isolation: 'passed', normalizationStability: 'passed', exportImport: 'passed' };
module.exports = { workspace: converted, report };
if (require.main === module) process.stdout.write(JSON.stringify(module.exports));
