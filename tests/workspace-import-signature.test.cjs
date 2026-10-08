const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('isolated workspace detection accepts schema v4/v5 without relaxing app identity', () => {
  const targets = [];
  const context = { UOS: { smartImport: { listTargets: () => targets, registerTarget: target => targets.push(target) } } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/shared/js/import-targets.js', 'utf8'), context);
  for (const [id, app, kind] of [['program-workspace-nsa', 'uos.horticulture.nsa', 'NSA'], ['program-workspace-events', 'uos.horticulture.events', 'EVT']]) {
    const predicate = targets.find(target => target.id === id).json.predicate;
    for (const schemaVersion of [4, 5]) assert.equal(predicate({ app, exportAppId: app, workspaceKind: kind, schemaVersion }), true);
    assert.equal(predicate({ app, exportAppId: app, workspaceKind: kind, schemaVersion: 6 }), false);
    assert.equal(predicate({ app, exportAppId: 'other', workspaceKind: kind, schemaVersion: 5 }), false);
    assert.equal(predicate({ app, exportAppId: app, workspaceKind: 'other', schemaVersion: 5 }), false);
  }
});
