const {test}=require('node:test'),assert=require('node:assert/strict');
const tools=require('../src/program-planner/js/scheduler-calendar-tools.js');
const base={startDate:'2026-10-05',endDate:'2026-10-05',startTime:'09:00',endTime:'12:00',allDay:false};
test('relocation preserves hours and midnight endpoints across civil dates',()=>{
 assert.deepEqual(tools.shiftSchedule(base,2),{...base,startDate:'2026-10-07',endDate:'2026-10-07'});
 const overnight={...base,startTime:'23:30',endTime:'00:00',endDate:'2026-10-06'};
 assert.deepEqual(tools.occupiedDates(overnight),{startDate:'2026-10-05',endDate:'2026-10-05'});
 assert.equal(tools.shiftSchedule(overnight,1).endDate,'2026-10-07');
 assert.equal(tools.dateDistance('2026-10-03','2026-10-05'),2);
});
test('side resizing proposes inclusive all-day dates without changing the source',()=>{
 const before=JSON.stringify(base),range=tools.resizeDates(base,'date-end',3);
 assert.deepEqual(range,{startDate:'2026-10-05',endDate:'2026-10-08',startTime:'',endTime:'',allDay:true});
 assert.equal(JSON.stringify(base),before);
 assert.equal(tools.resizeDates(range,'date-start',20).startDate,'2026-10-08');
 assert.equal(tools.resizeDates(range,'date-end',-20).endDate,'2026-10-05');
});
test('spanning cards clip to visible dates and occupy separate overlapping lanes',()=>{
 const dates=Array.from({length:7},(_,i)=>tools.shiftDate('2026-10-05',i));
 const spans=tools.spanLanes([{...base,id:'a',allDay:true,startDate:'2026-10-03',endDate:'2026-10-08'},{...base,id:'b',allDay:true,startDate:'2026-10-06',endDate:'2026-10-14'},{...base,id:'c',allDay:true,startDate:'2026-10-09',endDate:'2026-10-09'}],dates);
 assert.deepEqual(spans.map(s=>[s.job.id,s.start,s.end,s.lane]),[['a',0,3,0],['b',1,6,1],['c',4,4,0]]);
 assert.equal(spans[0].continuesBefore,true);assert.equal(spans[1].continuesAfter,true);
});
