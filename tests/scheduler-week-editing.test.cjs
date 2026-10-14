const test = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../src/program-planner/js/scheduler-calendar-tools.js');
const context={window:{UOS:{}}};
require('node:vm').runInNewContext(require('node:fs').readFileSync(require.resolve('../src/program-planner/js/scheduler-model.js'),'utf8'),context);
const scheduler=context.window.UOS.ProgramSchedulerModel;
test('half-hour placement uses civil time and represents the last slot as an exclusive midnight endpoint', () => {
  assert.deepEqual(tools.slotInterval('2026-10-05', 540), {date:'2026-10-05',start:540,end:570});
  assert.equal(tools.slotInterval('2026-10-05', 569).start,540);
  const last=tools.intervalPatch(tools.slotInterval('2026-12-31',1439));
  assert.deepEqual(last,{startDate:'2026-12-31',endDate:'2027-01-01',startTime:'23:30',endTime:'00:00',allDay:false});
  assert.deepEqual(tools.dayInterval(last),{date:'2026-12-31',start:1410,end:1440});
});

test('overlapping multi-slot jobs become whole blocks within a shared band',()=>{
  const date='2026-10-05',base={startDate:date,endDate:date,allDay:false};
  const jobs=[{...base,id:'three',startTime:'09:00',endTime:'12:00'},{...base,id:'two',startTime:'10:00',endTime:'12:00'}];
  const before=JSON.stringify(jobs),layout=tools.stackedWeekLayout(jobs,[date,'2026-10-06']);
  assert.equal(layout.bands.length,1);assert.equal(layout.bands[0].first,18);assert.equal(layout.bands[0].last,24);
  assert.equal(layout.blocks[0].length,2);assert.equal(layout.blocks[1].length,0);
  assert.ok(layout.blocks[0][1].top>layout.blocks[0][0].top+layout.blocks[0][0].height);
  assert.equal(JSON.stringify(jobs),before);
  const alone=tools.stackedWeekLayout([jobs[0]],[date]);
  assert.equal(alone.bands.length,0);assert.equal(alone.blocks[0].length,1);
  assert.equal(alone.blocks[0][0].top,tools.pixelAtMinute(alone,540)+4);
  assert.equal(alone.blocks[0][0].height,tools.pixelAtMinute(alone,720)-tools.pixelAtMinute(alone,540)-8);
});

test('moving preserves duration, snaps the start and clamps to the same column',()=>{
  const range={date:'2026-10-05',start:555,end:560};
  assert.deepEqual(tools.adjustInterval(range,'move',30),{date:range.date,start:600,end:605});
  assert.equal(tools.adjustInterval(range,'move',-10000).start,0);
  const last=tools.adjustInterval(range,'move',10000);
  assert.equal(last.end-last.start,5);assert.ok(last.end<=1440);assert.equal(last.start%30,0);
});
test('resizing enforces a half-hour minimum and does not move the other endpoint',()=>{
  const range={date:'2026-10-05',start:540,end:630};
  assert.deepEqual(tools.adjustInterval(range,'start',1000),{date:range.date,start:600,end:630});
  assert.deepEqual(tools.adjustInterval(range,'end',-1000),{date:range.date,start:540,end:570});
  assert.equal(tools.adjustInterval(range,'end',10000).end,1440);
  assert.throws(()=>tools.intervalPatch({date:range.date,start:630,end:540}),/valid time/);
});
test('all-day and genuinely multi-day jobs do not acquire day handles',()=>{
  assert.equal(tools.dayInterval({allDay:true,startDate:'2026-10-05',endDate:'2026-10-05'}),null);
  assert.equal(tools.dayInterval({allDay:false,startDate:'2026-10-05',endDate:'2026-10-06',startTime:'23:00',endTime:'01:00'}),null);
  assert.equal(tools.dayInterval({allDay:false,startDate:'2026-10-05',endDate:'2026-10-05',startTime:'10:00',endTime:'09:00'}),null);
});
test('week rows grow across every day to stack full-width concurrent jobs without changing times',()=>{
  const dates=['2026-10-05','2026-10-06'];
  const jobs=['a','b','c'].map(id=>({id,startDate:dates[0],endDate:dates[0],startTime:'09:00',endTime:'09:30',allDay:false}));
  const layout=tools.stackedWeekLayout(jobs,dates),row=layout.rows[18];
  assert.equal(row.cells[0].length,3);assert.equal(row.cells[1].length,0);assert.equal(row.height,252);
  assert.equal(layout.rows[19].top,row.top+252);
  assert.equal(tools.minuteAtPixel(layout,row.top+row.height-1),540);
  assert.equal(tools.pixelAtMinute(layout,570),row.top+row.height);
  assert.equal(tools.pixelAtMinute(layout,1440),layout.height);
});
test('same-type overlaps warn across projects while concurrent different types remain valid',()=>{
  const base={owner:'NSA',startDate:'2026-10-05',endDate:'2026-10-05',startTime:'09:00',endTime:'09:30',allDay:false};
  const conflicts=structuredClone(scheduler.detectConflicts([{...base,id:'a',projectId:'one',workTypeKey:'Turfing'},{...base,id:'b',projectId:'two',workTypeKey:'turfing'},{...base,id:'c',projectId:'one',workTypeKey:'irrigation'}]));
  assert.equal(conflicts.length,1);assert.equal(conflicts[0].sameType,true);assert.deepEqual(conflicts[0].jobIds,['a','b']);
  assert.match(conflicts[0].labels[0],/Same job type: Turfing/);
  assert.deepEqual(structuredClone(scheduler.detectConflicts([{...base,id:'a',workTypeKey:'turfing'},{...base,id:'b',startTime:'09:30',endTime:'10:00',workTypeKey:'turfing'}])),[]);
});
