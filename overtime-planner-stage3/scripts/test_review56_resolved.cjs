'use strict';
const assert = require('assert');
const path = require('path');
const root = require('./local-test-environment.cjs').repoRoot();
const f = (s) => require(path.join(root, s));
global.window = global;

f('js/utils/absences.js');
f('js/utils/qualifications.js');
f('js/utils/fatigueEngine.js');
f('js/utils/eligibilityEngine.js');
f('js/components/staffAssignModal/candidateModel.js');
f('js/app.js');

const app = global.HortOpsApp;
const record = { id: 'A1', staffId: 'A', type: 'annual_leave', startDate: '2026-10-10', endDate: '2026-10-11' };
const refusal = { id: 'R1', staffId: 'B', shiftId: 'X', date: '2026-08-01' };
const roster = [
  { id: 'A', name: 'Alan', status: 'active', team: 'Parks', department: 'Horticulture', role: 'Worker', ytdOvertimeHours: 12 },
  { id: 'B', name: 'Beth', status: 'active', team: 'Parks', department: 'Horticulture', role: 'Worker', ytdOvertimeHours: 12 }
];

let saved = null;
const workspace = {
  schemaVersion: 2,
  jobs: [],
  roster: roster,
  assignments: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {},
  permits: {},
  budgetSettings: {},
  uiState: {},
  absences: [record],
  refusalHistory: [refusal]
};

global.HortOpsScheduler = { DEFAULT_BUDGET_SETTINGS: {} };
global.HortOpsStorage = {
  loadWorkspace: () => workspace,
  readVerifiedCommittedV2: () => ({ ok: true, exists: false }),
  createWorkspaceEnvelope: x => x,
  saveWorkspace: x => { saved = x; return { ok: true }; }
};
global.HortOpsSchemaValidator = { validateCurrentV2Presence: () => ({ valid: true }) };
app.recomputeDigest = function() {};
app.renderCurrentView = function() {};

// Probe 1: app.init()
app.init();
console.log('Test 1 - app.state.absences:', app.state.absences);
console.log('Test 1 - app.state.refusalHistory:', app.state.refusalHistory);
assert(Object.hasOwn(app.state, 'absences'), 'absences must be loaded');
assert(Object.hasOwn(app.state, 'refusalHistory'), 'refusalHistory must be loaded');
assert.strictEqual(app.state.absences.length, 1);
assert.strictEqual(app.state.refusalHistory.length, 1);
console.log('✔ Probe 1: absences & refusalHistory preserved across init()');

// Probe 1b: absent worker eligibility check
const shift = { shiftId: 'SHIFT1', date: '2026-10-10', startTime: '07:00 AM', durationHours: 5, assignedStaffIds: [] };
let absent = global.HortOpsEligibilityEngine.validateStaffEligibility(roster[0], shift, {}, [], []);
console.log('Test 1b - Alan on 2026-10-10 eligible:', absent.eligible, 'reasons:', absent.reasons);
assert.strictEqual(absent.eligible, false);
assert(absent.reasons.includes('STAFF_ABSENT'));
console.log('✔ Probe 1b: On-leave worker Alan is correctly hard-blocked on shift date');

// Probe 2: _commitCanonicalProposal preserves live domains
const result = app._commitCanonicalProposal({});
console.log('Test 2 - commit result:', result.success);
assert.strictEqual(result.success, true);
assert(Object.hasOwn(saved, 'absences') && Object.hasOwn(saved, 'refusalHistory'));
assert.strictEqual(saved.absences.length, 1);
assert.strictEqual(saved.refusalHistory.length, 1);
console.log('✔ Probe 2: Commit saves both absences and refusalHistory');

// Probe 3: Fair-share candidate ranking
const cm = global.HortOpsStaffAssignCandidateModel;
const cand = roster.map(s => ({ ...s, _fatigueEval: { tier: 'LOW', consecutiveWeekends: 0 }, _lacksQualifications: false }));
const sorted = cm.sortCandidates(cand, { matchingJob: {}, prefs: {}, assignedIdsSet: new Set() });
console.log('Test 3 - Sorted IDs:', sorted.map(x => x.id));
// Beth has 1 refusal -> score 981. Alan has 0 refusals -> score 976.
// In fair-share ranking: Beth has higher priority -> sorted ['B', 'A']
assert.deepStrictEqual(sorted.map(x => x.id), ['B', 'A']);
console.log('✔ Probe 3: Candidate ranking prioritizes Beth (higher fair-share score) over Alan');

// Probe 4: Missing fatigue method fail-closed
const oldFatigue = global.HortOpsFatigueEngine;
global.HortOpsFatigueEngine = {};
const noFatigue = global.HortOpsEligibilityEngine.validateStaffEligibility(roster[0], { ...shift, date: '2026-10-17' }, {}, [], []);
console.log('Test 4 - Missing fatigue method eligible:', noFatigue.eligible, 'reasons:', noFatigue.reasons);
assert.strictEqual(noFatigue.eligible, false);
assert(noFatigue.reasons.includes('FATIGUE_ENGINE_UNAVAILABLE'));
console.log('✔ Probe 4: Missing fatigue method strictly fails closed');
global.HortOpsFatigueEngine = oldFatigue;

// Probe 5: Missing absence engine method fail-closed
const oldAbs = global.HortOpsAbsences;
const oldLedger = global.HortOpsAbsenceLedger;
global.HortOpsAbsences = {};
global.HortOpsAbsenceLedger = null;
const noAbs = global.HortOpsEligibilityEngine.validateStaffEligibility(roster[0], shift, {}, [], [], { absences: [record] });
console.log('Test 5 - Missing absence engine method eligible:', noAbs.eligible, 'reasons:', noAbs.reasons);
assert.strictEqual(noAbs.eligible, false);
assert(noAbs.reasons.includes('ABSENCE_ENGINE_UNAVAILABLE'));
console.log('✔ Probe 5: Missing absence method strictly fails closed');
global.HortOpsAbsences = oldAbs;
global.HortOpsAbsenceLedger = oldLedger;

console.log('\n================================================================');
console.log(' ALL 5 REVIEW 56 DEFECT PROBES VERIFIED RESOLVED (100% OK)');
console.log('================================================================');
