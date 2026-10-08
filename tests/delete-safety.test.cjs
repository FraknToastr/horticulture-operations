const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../src/program-planner/js/delete-safety.js'), 'utf8');

function setup(confirm = async () => true) {
  let workspace = { entities: { tasks: [{ id: 'task-1', title: 'Original' }] }, workspace: { selectedProjectId: 'project-1', selectedEntityId: 'record-1' } };
  const messages = [], root = { UOS: { ProgramApp: { workspace: () => workspace }, dialogs: { confirm }, toast: message => messages.push(message) } };
  vm.runInNewContext(source, root);
  return { api: root.UOS.ProgramDeleteSafety, root, messages, get: () => workspace, set: value => { workspace = value; } };
}

test('delete warning uses danger styling, explicit Cancel, and runs once only after confirmation', async () => {
  let options, writes = 0;
  const fixture = setup(async value => { options = value; return true; });
  await fixture.api.confirm({ title: 'Remove task?', message: 'The task is suppressed.', confirmLabel: 'Remove task', apply: guard => { guard(fixture.get()); writes += 1; } });
  assert.equal(options.danger, true);
  assert.equal(options.cancelLabel, 'Cancel');
  assert.equal(options.confirmLabel, 'Remove task');
  assert.equal(writes, 1);
});

for (const answer of [false, null, undefined]) test(`dismissed warning (${answer}) does not mutate`, async () => {
  const fixture = setup(async () => answer), before = JSON.stringify(fixture.get());
  await fixture.api.confirm({ apply: () => { throw new Error('Must not run'); } });
  assert.equal(JSON.stringify(fixture.get()), before);
  assert.equal(fixture.messages.length, 0);
});

test('unavailable or failed warning service never deletes', async () => {
  for (const service of [undefined, () => Promise.reject(new Error('Dialog failed'))]) {
    const fixture = setup(service);
    if (!service) delete fixture.root.UOS.dialogs;
    let writes = 0;
    await fixture.api.confirm({ apply: () => { writes += 1; } });
    assert.equal(writes, 0);
    assert.equal(fixture.messages.length, 1);
  }
});

for (const change of ['entities', 'project', 'record', 'custom']) test(`stale ${change} aborts deletion`, async () => {
  let fixture, writes = 0;
  fixture = setup(async () => {
    if (change === 'entities') fixture.get().entities.tasks[0].title = 'Changed';
    if (change === 'project') fixture.get().workspace.selectedProjectId = 'other';
    if (change === 'record') fixture.get().workspace.selectedEntityId = 'other';
    return true;
  });
  await fixture.api.confirm({ validate: () => change !== 'custom', apply: () => { writes += 1; } });
  assert.equal(writes, 0);
  assert.match(fixture.messages[0], /changed/);
});

test('queued mutation guard catches changes after confirmation', async () => {
  const fixture = setup();
  let writes = 0;
  await fixture.api.confirm({ apply: guard => {
    fixture.get().entities.tasks.push({ id: 'new' });
    guard(fixture.get());
    writes += 1;
  } });
  assert.equal(writes, 0);
  assert.match(fixture.messages[0], /changed/);
});

test('repeated activation opens one modal and applies once', async () => {
  let release, dialogs = 0, writes = 0;
  const fixture = setup(() => { dialogs += 1; return new Promise(resolve => { release = resolve; }); });
  const first = fixture.api.confirm({ apply: () => { writes += 1; } });
  await Promise.resolve();
  await fixture.api.confirm({ apply: () => { writes += 1; } });
  assert.equal(dialogs, 1);
  release(true);
  await first;
  assert.equal(writes, 1);
});
