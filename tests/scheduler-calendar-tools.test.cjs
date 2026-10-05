const test = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../src/program-planner/js/scheduler-calendar-tools.js');
const job = (patch = {}) => ({ id: 'JOB-1', title: 'Depot work', startDate: '2026-10-05', endDate: '2026-10-05', startTime: '09:00', endTime: '10:00', allDay: false, ...patch });

test('all-day ICS uses exclusive end date, stable UID and CRLF', () => {
  const file = tools.outlookFile(job({ allDay: true, endDate: '2026-10-07' }), { now: 0 });
  assert.match(file.contents, /DTSTART;VALUE=DATE:20261005\r\nDTEND;VALUE=DATE:20261008/);
  assert.match(file.contents, /UID:JOB-1@horticulture-operations/);
  assert.match(file.contents, /DTSTAMP:19700101T000000Z/);
  assert.equal(file.filename, 'JOB-1.ics');
  assert.equal(file.contents.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal(tools.outlookFile(job(), { now: 1 }).contents.match(/UID:.*/)[0], file.contents.match(/UID:.*/)[0]);
});

test('Adelaide summer and winter offsets are independent of host zone', () => {
  assert.match(tools.outlookFile(job()).contents, /DTSTART:20261004T223000Z/);
  assert.match(tools.outlookFile(job({ startDate: '2026-07-01', endDate: '2026-07-01' })).contents, /DTSTART:20260630T233000Z/);
  assert.throws(() => tools.validate(job({ startDate: '2026-10-04', endDate: '2026-10-04', startTime: '02:30', endTime: '04:00' })), /does not exist/);
  const repeated = tools.localInstant('2026-04-05', '02:30');
  assert.equal(repeated.ambiguous, true);
  assert.equal(new Date(repeated.ms).toISOString(), '2026-04-04T16:00:00.000Z');
});

test('invalid intervals fail and overnight intervals require next end date', () => {
  assert.throws(() => tools.validate(job({ endTime: '08:00' })), /End must/);
  assert.throws(() => tools.validate(job({ startDate: '2026-02-30' })), /valid calendar date/);
  assert.throws(() => tools.validate(job({ startTime: '24:00' })), /valid dates/);
  assert.doesNotThrow(() => tools.validate(job({ startTime: '23:00', endTime: '01:00', endDate: '2026-10-06' })));
});

test('ICS escapes text, excludes protected location, folds UTF-8 without breaking characters', () => {
  const file = tools.outlookFile(job({ title: 'Plants, tools;\\\n' + '🌿'.repeat(50), location: 'Private address' }), { includeLocation: false });
  assert.equal(file.contents.includes('Private address'), false);
  for (const line of file.contents.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  const unfolded = file.contents.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('Plants\\, tools\\;\\\\\\n'));
  assert.ok(unfolded.includes('🌿'.repeat(50)));
  assert.equal(unfolded.includes('ATTENDEE'), false);
});

test('daily segments handle overnight, multi-day and exclusive midnight ends', () => {
  const overnight = job({ startTime: '23:00', endTime: '01:00', endDate: '2026-10-06' });
  const first = tools.daySegments([overnight], '2026-10-05')[0];
  assert.equal(first.start, 1380); assert.equal(first.end, 1440); assert.equal(first.continuesAfter, true);
  const second = tools.daySegments([overnight], '2026-10-06')[0];
  assert.equal(second.start, 0); assert.equal(second.end, 60); assert.equal(second.continuesBefore, true);
  assert.deepEqual(tools.daySegments([job({ endDate: '2026-10-06', endTime: '00:00' })], '2026-10-06'), []);
  const multi = tools.daySegments([job({ endDate: '2026-10-07' })], '2026-10-06')[0];
  assert.equal(multi.start, 0); assert.equal(multi.end, 1440);
  assert.deepEqual(tools.daySegments([job({ allDay: true })], '2026-10-05'), []);
});

test('overlap groups allocate reusable lanes without sharing a simultaneous lane', () => {
  const jobs = [job({ id: 'a', startTime: '09:00', endTime: '11:00' }), job({ id: 'b', startTime: '10:00', endTime: '12:00' }), job({ id: 'c', startTime: '11:00', endTime: '13:00' }), job({ id: 'd', startTime: '14:00', endTime: '14:05' })];
  const segments = tools.daySegments(jobs, '2026-10-05');
  assert.deepEqual(segments.map(s => [s.job.id, s.lane, s.lanes]), [['a', 0, 2], ['b', 1, 2], ['c', 0, 2], ['d', 0, 1]]);
});
