require('./js/utils/dateUtils.js');
require('./js/utils/eligibilityEngine.js');
require('./js/data/staffRoster.js');

var engine = window.HortOpsEligibilityEngine;
var prior = { shiftId: 'P', date: '2026-05-13', startTime: '02:00 PM', durationHours: 8, assignedStaffIds: ['EMP-REST-TEST'] };
var proposed = { shiftId: 'Q', date: '2026-05-14', startTime: '05:00 AM', durationHours: 6 };
var emp = { id: 'EMP-REST-TEST', name: 'Test', team: 'Parks', status: 'active' };

var iP = engine.shiftToAbsoluteInterval(prior);
var iQ = engine.shiftToAbsoluteInterval(proposed);
console.log('Prior interval:', JSON.stringify(iP));
console.log('Proposed interval:', JSON.stringify(iQ));
console.log('Gap (min):', iQ.startMin - iP.endMin);
console.log('Overlap?', engine.shiftsTimeOverlap(proposed, prior));
console.log('ViolatesRest?', engine.shiftsViolateRestGap(proposed, prior, 600));

var res = engine.validateEmployeeForOccurrence({ employee: emp, occurrence: proposed, allAssignments: [prior] });
console.log('eligible:', res.eligible, 'reasons:', JSON.stringify(res.reasons));
