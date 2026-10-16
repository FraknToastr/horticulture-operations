const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const tools = require('../src/program-planner/js/scheduler-calendar-tools.js');
const context = { window: { UOS: {} } };
vm.runInNewContext(fs.readFileSync(require.resolve('../src/program-planner/js/scheduler-model.js'), 'utf8'), context);
const scheduler = context.window.UOS.ProgramSchedulerModel;
const entries = workspace => structuredClone(scheduler.eventMilestones(workspace));

test('Event dates derive independent single-day references without creating or changing Jobs', () => {
  const workspace = { entities: { events: [{ id: 'EVT-EVENT-1', owner: 'EVT', title: 'Festival', status: 'cancelled', bumpInDate: '2026-10-04', bumpOutDate: '2026-10-06' }], jobs: [], projects: [], costingLines: [] } };
  const before = JSON.stringify(workspace), first = entries(workspace);
  assert.equal(first.length, 2);
  assert.deepEqual(first.map(entry => [entry.id, entry.title, entry.startDate, entry.endDate, entry.allDay]), [
    ['event-milestone:EVT-EVENT-1:bump-in', 'Festival · Bump-in', '2026-10-04', '2026-10-04', true],
    ['event-milestone:EVT-EVENT-1:bump-out', 'Festival · Bump-out', '2026-10-06', '2026-10-06', true]
  ]);
  assert.equal(first[0]._endMs - first[0]._startMs, 86400000);
  assert.equal(first[0].projectId, undefined);
  assert.equal(first[0].status, undefined);
  assert.equal(first[0].updatesApplicationStatus, undefined);
  assert.equal(JSON.stringify(workspace), before);
  assert.deepEqual(entries(JSON.parse(before)), first);
  workspace.entities.events[0].bumpInDate = '2026-10-05';
  assert.equal(entries(workspace)[0].id, first[0].id);
  assert.equal(entries(workspace)[0].startDate, '2026-10-05');
  workspace.entities.events[0].bumpInDate = '';
  assert.equal(entries(workspace).length, 1);
});

test('Milestones use strict civil dates, remain separate on one day, and ignore NSA and duplicate records', () => {
  const events = [
    { id: 'same-day', title: 'Same day', bumpInDate: '2026-10-05', bumpOutDate: '2026-10-05' },
    { id: 'invalid', owner: 'EVT', bumpInDate: '2026-02-30', bumpOutDate: '2026-10-05T00:00:00Z' },
    { id: 'nsa', owner: 'NSA', bumpInDate: '2026-10-05' },
    { id: 'same-day', bumpInDate: '2026-10-05' },
    null
  ];
  const result = entries({ entities: { events, applications: [{ id: 'NSA-APP-1', bumpInDate: '2026-10-05' }] } });
  assert.equal(result.length, 2);
  assert.equal(new Set(result.map(entry => entry.id)).size, 2);
  const spans = tools.spanLanes(result, scheduler.weekDays('2026-10-05'));
  assert.deepEqual(spans.map(span => [span.start, span.end, span.lane]), [[0, 0, 0], [0, 0, 1]]);
  assert.deepEqual(entries({ entities: { applications: [{ bumpInDate: '2026-10-05' }] } }), []);
});

test('Event names used by new Register records and imported payloads label milestones', () => {
  const result = entries({ entities: { events: [
    { id: 'new-event', eventName: 'New Festival', bumpInDate: '2026-10-05' },
    { id: 'imported-event', payload: { eventName: 'Imported Festival' }, bumpOutDate: '2026-10-06' }
  ] } });
  assert.deepEqual(result.map(entry => entry.title), ['New Festival · Bump-in', 'Imported Festival · Bump-out']);
});
