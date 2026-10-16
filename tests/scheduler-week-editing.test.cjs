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

test('overlapping multi-slot jobs keep continuous durations in equal side-by-side lanes',()=>{
  const date='2026-10-05',base={startDate:date,endDate:date,allDay:false};
  const jobs=[{...base,id:'three',startTime:'09:00',endTime:'12:00'},{...base,id:'two',startTime:'10:00',endTime:'12:00'}];
  const before=JSON.stringify(jobs),layout=tools.timedWeekLayout(jobs,[date,'2026-10-06']);
  assert.equal(layout.blocks[0].length,2);assert.equal(layout.blocks[1].length,0);
  const [three,two]=layout.blocks[0];
  assert.deepEqual([three.lane,two.lane,three.lanes,two.lanes],[0,1,2,2]);
  assert.equal(three.top,tools.pixelAtMinute(layout,540)+2);
  assert.equal(two.top,tools.pixelAtMinute(layout,600)+2);
  assert.equal(three.height,288-4);assert.equal(two.height,192-4);
  assert.equal(three.top+three.height,two.top+two.height);
  assert.equal(JSON.stringify(jobs),before);
  const alone=tools.timedWeekLayout([jobs[0]],[date]);
  assert.equal(alone.blocks[0][0].lanes,1);assert.equal(alone.blocks[0][0].height,three.height);
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
test('uniform rows align two overlaps and triple overlaps without stretching the time ladder',()=>{
  const dates=['2026-10-05','2026-10-06'];
  const make=(id,date,startTime,endTime)=>({id,startDate:date,endDate:date,startTime,endTime,allDay:false});
  const jobs=[make('a',dates[0],'09:00','11:00'),make('b',dates[0],'09:00','11:00'),
    ...['c','d','e'].map(id=>make(id,dates[1],'09:00','11:00'))];
  const layout=tools.timedWeekLayout(jobs,dates),row=layout.rows[18];
  assert.equal(layout.blocks[0].length,2);assert.equal(layout.blocks[1].length,3);
  assert.deepEqual(layout.blocks[0].map(b=>[b.lane,b.lanes]),[[0,2],[1,2]]);
  assert.deepEqual(layout.blocks[1].map(b=>[b.lane,b.lanes]),[[0,3],[1,3],[2,3]]);
  assert.equal(row.height,48);assert.ok(layout.rows.every(row=>row.height===48));
  assert.equal(layout.rows[19].top,row.top+48);
  assert.equal(tools.minuteAtPixel(layout,row.top+row.height-1),540);
  assert.equal(tools.pixelAtMinute(layout,570),row.top+row.height);
  assert.equal(tools.pixelAtMinute(layout,1440),layout.height);
  assert.equal(layout.height,2304);assert.deepEqual(layout.dayRequirements,[236,348]);
});

test('lane reuse, separate overlap groups and short durations preserve real times',()=>{
  const date='2026-10-05',base={startDate:date,endDate:date,allDay:false};
  const jobs=[['a','09:00','11:00'],['b','10:00','12:00'],['c','11:00','13:00'],
    ['adjacent','13:00','13:30'],['short','14:00','14:05']].map(([id,startTime,endTime])=>({...base,id,startTime,endTime}));
  const layout=tools.timedWeekLayout(jobs,[date]),blocks=layout.blocks[0];
  assert.deepEqual(blocks.map(b=>[b.lane,b.lanes]),[[0,2],[1,2],[0,2],[0,1],[0,1]]);
  assert.equal(blocks[4].height,4);
  assert.equal(blocks[3].top,tools.pixelAtMinute(layout,780)+2);
});

test('same-type overlaps warn across projects while concurrent different types remain valid',()=>{
  const base={owner:'NSA',startDate:'2026-10-05',endDate:'2026-10-05',startTime:'09:00',endTime:'09:30',allDay:false};
  const conflicts=structuredClone(scheduler.detectConflicts([{...base,id:'a',projectId:'one',workTypeKey:'Turfing'},{...base,id:'b',projectId:'two',workTypeKey:'turfing'},{...base,id:'c',projectId:'one',workTypeKey:'irrigation'}]));
  assert.equal(conflicts.length,1);assert.equal(conflicts[0].sameType,true);assert.deepEqual(conflicts[0].jobIds,['a','b']);
  assert.match(conflicts[0].labels[0],/Same job type: Turfing/);
  assert.deepEqual(structuredClone(scheduler.detectConflicts([{...base,id:'a',workTypeKey:'turfing'},{...base,id:'b',startTime:'09:30',endTime:'10:00',workTypeKey:'turfing'}])),[]);
});


test('adaptive Week columns reclaim empty days evenly before booked spare space',()=>{
  const widths=tools.weekColumnWidths([348,80,80,80,80,80,80],1000);
  assert.equal(widths[0],348);assert.equal(new Set(widths.slice(1)).size,1);
  assert.ok(Math.abs(widths.reduce((a,b)=>a+b,0)-1000)<.01);
  const tight=tools.weekColumnWidths([800,140,140,80,80,80,80],1500);
  assert.deepEqual(tight.slice(3),[80,80,80,80]);
  assert.ok(tight[1]>=140 && tight[1]<1500/7);assert.equal(tight[1],tight[2]);
  assert.ok(Math.abs(tight.reduce((a,b)=>a+b,0)-1500)<.01);
  const full=tools.weekColumnWidths(Array(7).fill(348),1000);
  assert.deepEqual(full,Array(7).fill(348));
  assert.deepEqual(tools.weekColumnWidths(Array(7).fill(80),1400),Array(7).fill(200));
});

test('visible all-day bookings and Event milestones reserve booked-day minimums',()=>{
  const dates=['2026-10-05','2026-10-06','2026-10-07'];
  const jobs=[{id:'all',allDay:true,startDate:dates[0],endDate:dates[1]}, {id:'milestone',allDay:true,startDate:dates[2],endDate:dates[2],_eventMilestone:true}];
  assert.deepEqual(tools.timedWeekLayout(jobs,dates).dayRequirements,[140,140,140]);
  assert.deepEqual(tools.timedWeekLayout([],dates).dayRequirements,[80,80,80]);
  assert.deepEqual(tools.timedWeekLayout([{...jobs[0],_unscheduled:true}],dates).dayRequirements,[80,80,80]);
});
