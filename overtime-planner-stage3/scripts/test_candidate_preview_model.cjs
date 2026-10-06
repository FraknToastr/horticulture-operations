/* Independent model checks use the real child-local safety engines and comparator. */
const assert = require('node:assert/strict');
const path = require('node:path');
global.window = global;
const base = path.resolve(__dirname, '..');
for (const file of ['js/utils/dateUtils.js', 'js/utils/planningRules.js', 'js/utils/qualifications.js', 'js/utils/fatigueEngine.js', 'js/utils/absences.js', 'js/utils/eligibilityEngine.js', 'js/components/staffAssignModal/candidateModel.js', 'js/utils/candidatePreview.js']) require(path.join(base, file));
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const staff = (id, extra = {}) => ({ id, name: id, status: 'active', team: 'Primary', role: 'Ranger', department: 'Parks', qualifications: [], ...extra });
const occurrence = { shiftId: 'JOB-P@2026-12-31', jobId: 'JOB-P', jobName: 'Boundary', date: '2026-12-31', startTime: '22:00', durationHours: 4, crewSize: 2, assignedStaffIds: ['Assigned'] };
const job = { id: 'JOB-P', name: 'Boundary', primaryTeam: 'Primary', preferredPoolTagIds: ['POOL-P'], exclusivePoolSource: 'none', plantOperatorRequired: true };
const state = { jobs: [job], staffList: [staff('Low', { ytdOvertimeHours: 0 }), staff('Tagged', { poolTagIds: ['POOL-P'], ytdOvertimeHours: 200 }), staff('Operator', { isPlantOperator: true, ytdOvertimeHours: 100 }), staff('Departed', { status: 'departed', isOvertimeExempt: true }), staff('Overlap'), staff('Assigned')],
  poolTags: [{ id: 'POOL-P', label: 'Rangers', active: true }], absences: [], refusalHistory: [{ id: 'REF-1', staffId: 'Low', date: '2026-12-30' }],
  allShifts: [occurrence, { shiftId: 'OTHER@2027-01-01', date: '2027-01-01', startTime: '00:00', durationHours: 2, assignedStaffIds: ['Overlap'] }] };
// Deliberately different live state verifies that explicit detached context wins.
global.HortOpsApp = { state: { poolTags: [], absences: [{ staffId: 'Tagged', startDate: '2026-12-31', endDate: '2026-12-31', type: 'leave' }], refusalHistory: [] } };
const before = JSON.stringify(state);
freeze(state);
const model = HortOpsCandidatePreview.build({ state, occurrence, job, allShifts: state.allShifts });
assert.equal(JSON.stringify(state), before, 'preview never changes frozen inputs');
assert.deepEqual(model.eligible.map(row => row.id), ['Tagged', 'Operator', 'Low']);
assert.deepEqual(model.assigned.map(row => row.id), ['Assigned']);
const blocked = model.excluded.find(row => row.id === 'Departed');
assert.deepEqual(blocked.reasons.map(reason => reason.code), ['EMPLOYMENT_DEPARTED', 'OVERTIME_EXEMPT']);
assert.ok(model.excluded.find(row => row.id === 'Overlap').reasons.some(reason => reason.code === 'OVERLAPPING_SHIFT'));
assert.equal(model.eligible.find(row => row.id === 'Low').ranking.hoursSource, 'stored-zero-unverified');
assert.equal(model.eligible.find(row => row.id === 'Low').ranking.hoursVerified, false);
assert.equal(model.eligible.find(row => row.id === 'Low').ranking.fairShareScore, 1005);
assert.equal(model.crew.plantOperatorPresent, false);
assert.ok(model.crew.canonical.issues.some(issue => issue.code === 'PLANT_OPERATOR_REQUIRED'));
assert.ok(model.evidenceGaps.some(text => text.includes('not proof of adequate rest')));
for (const row of [...model.eligible, ...model.excluded, ...model.assigned]) {
  const original = state.staffList.find(person => person.id === row.id);
  const check = HortOpsEligibilityEngine.validateEmployeeForOccurrence({ employee: original, occurrence, job, allAssignments: state.allShifts, currentShiftAssignedIds: occurrence.assignedStaffIds, poolTags: state.poolTags, absences: state.absences });
  assert.equal(row.eligible, check.eligible);
  assert.deepEqual(row.reasons.map(reason => reason.code), check.reasons);
}
const projections = model.eligible.map(row => ({ ...state.staffList.find(person => person.id === row.id), _lacksQualifications: !row.qualification.compliant, _fatigueEval: row.fatigue }));
HortOpsStaffAssignCandidateModel.sortCandidates(projections, { matchingJob: job, prefs: model.summary.preferences, poolTags: state.poolTags, refusalHistory: state.refusalHistory, asOfDate: occurrence.date });
assert.deepEqual(model.eligible.map(row => row.id), projections.map(person => person.id));
const shifts = state.allShifts.slice(); shifts.lookupFailed = true;
const unavailable = HortOpsCandidatePreview.build({ state, occurrence, job, allShifts: shifts });
assert.equal(unavailable.eligible.length, 0);
assert.ok(unavailable.excluded.every(row => row.reasons.some(reason => reason.code === 'ADJACENT_SCHEDULE_UNAVAILABLE')));
const exclusive = HortOpsCandidatePreview.build({ state, occurrence, job: { ...job, exclusivePoolSource: 'tags', exclusivePoolTagIds: ['POOL-P'] }, allShifts: state.allShifts });
assert.deepEqual(exclusive.eligible.map(row => row.id), ['Tagged']);
const missing = HortOpsCandidatePreview.build({ state: { ...state, staffList: [staff('Missing')], refusalHistory: [] }, occurrence: { ...occurrence, assignedStaffIds: [] }, job, allShifts: [] });
assert.equal(missing.eligible[0].ranking.hoursSource, 'default-zero-unverified');
assert.equal(missing.eligible[0].ranking.overtimeHours, 0);
// Match the actual allocation editor's preference fallbacks rather than inventing
// support for differently named fields, and keep occurrence crew flags distinct.
for (const [settings, primaryTeam] of [[{ primaryTeam: 'One', defaultTeam: 'Two', preferredTeam: 'Three' }, 'One'], [{ defaultTeam: 'Two', preferredTeam: 'Three' }, 'Two'], [{ preferredTeam: 'Three' }, 'Three'], [{ preferredTeams: ['Ignored'] }, '']]) {
  const prefsModel = HortOpsCandidatePreview.build({ state: { ...state, staffList: [staff('Preference')] }, occurrence: { ...occurrence, assignedStaffIds: [], plantOperatorRequired: true }, job: { ...settings, secondaryTeam: 'Second', tertiaryTeam: 'Third', isExclusiveTeams: true, exclusiveTeams: ['Primary'] }, allShifts: [] });
  assert.deepEqual(prefsModel.summary.preferences, { primaryTeam, secondaryTeam: 'Second', tertiaryTeam: 'Third', isExclusive: true, exclusiveTeams: ['Primary'] });
  assert.equal(prefsModel.eligible[0].ranking.plantOperatorPreferenceApplied, false);
  assert.equal(prefsModel.crew.plantOperatorRequired, true);
}
const occurrenceRestriction = HortOpsCandidatePreview.build({ state, occurrence: { ...occurrence, isExclusive: true, exclusiveTeams: ['Primary'] }, job: { ...job, exclusivePoolSource: undefined, isExclusive: false, exclusiveTeams: ['Different'] }, allShifts: state.allShifts });
assert.equal(occurrenceRestriction.summary.exclusivePoolSource, 'teams');
assert.deepEqual(occurrenceRestriction.summary.exclusiveTeams, ['Primary']);
assert.equal(occurrenceRestriction.summary.preferences.isExclusive, false);
const noRestriction = HortOpsCandidatePreview.build({ state, occurrence: { ...occurrence, isExclusive: true, exclusiveTeams: ['Primary'] }, job: { ...job, exclusivePoolSource: 'none' }, allShifts: state.allShifts });
assert.equal(noRestriction.summary.exclusivePoolSource, 'none');
model.summary.preferredPoolTags[0].label = 'Mutated detached output';
assert.equal(state.poolTags[0].label, 'Rangers');
assert.equal(JSON.stringify(state), before);
console.log('Stage 4C model: 11 groups passed (ordering, canonical reasons/context, assigned/crew, evidence, overnight boundary, snapshot catalogue, lookup metadata, exclusive pool, missing hours, allocation preference parity, detached immutability).');
