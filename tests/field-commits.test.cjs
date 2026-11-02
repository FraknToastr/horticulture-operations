const test = require('node:test');
const assert = require('node:assert/strict');
const commits = require('../src/program-planner/js/field-commits.js');

test('field drafts do not persist until flushed and concurrent navigation waits for storage', async () => {
  let dirty = true, writes = 0, release;
  const unregister = commits.register({isDirty: () => dirty, flush: async () => {
    writes++; dirty = false;
    await new Promise(resolve => { release = resolve; });
  }});
  assert.equal(writes, 0);
  const first = commits.flushAll();
  await Promise.resolve();
  assert.equal(writes, 1);
  assert.equal(commits.isDirty(), true);
  let finished = false;
  const next = commits.flushAll().then(() => { finished = true; });
  await Promise.resolve();
  assert.equal(finished, false);
  release();
  await Promise.all([first, next]);
  assert.equal(writes, 1);
  assert.equal(commits.isDirty(), false);
  unregister();
});

test('failed saves reject navigation flush, retain draft and permit retry', async () => {
  let dirty = true, fail = true;
  const unregister = commits.register({isDirty: () => dirty, flush: async () => {
    if (fail) throw new Error('Storage failed');
    dirty = false;
  }});
  await assert.rejects(commits.flushAll(), /Storage failed/);
  assert.equal(commits.isDirty(), true);
  fail = false;
  await commits.flushAll();
  assert.equal(commits.isDirty(), false);
  unregister();
});

test('completion of an earlier commit does not save newer typing in the focused field', async () => {
  let dirty = true, writes = 0, release;
  const unregister = commits.register({isDirty: () => dirty, flush: async () => {
    writes++; dirty = false;
    await new Promise(resolve => { release = resolve; });
  }});
  const first = commits.flushAll();
  await Promise.resolve();
  dirty = true;
  const waiting = commits.flushAll();
  release();
  await Promise.all([first, waiting]);
  assert.equal(writes, 1);
  assert.equal(commits.isDirty(), true);
  unregister();
});
