/**
 * Permanent Stage 3 Absence & Refusal Durability Contract (Review 56 Corrective Suite)
 * Verifies P0-1, P0-2, P0-3, P1-4, P1-5 across canonical storage, eligibility, ranking,
 * export/restore, cold reload, cross-year intervals, and failure rollback.
 */
'use strict';

const assert = require('assert');
const path = require('path');

// Ensure browser-like globals for modular testing
global.window = global;
global.document = {
  getElementById: () => null,
  createElement: () => ({ style: {}, appendChild: () => {}, innerHTML: '' }),
  body: { appendChild: () => {} },
  addEventListener: () => {}
};
global.localStorage = {
  _store: {},
  getItem(k) { return this._store[k] || null; },
  setItem(k, v) { this._store[k] = String(v); },
  removeItem(k) { delete this._store[k]; },
  clear() { this._store = {}; }
};

// Load required modules
require('../js/utils/dateUtils.js');
require('../js/utils/qualifications.js');
require('../js/utils/fatigueEngine.js');
require('../js/utils/absences.js');
require('../js/utils/storage/schemaValidator.js');
require('../js/utils/storage/migrationEngine.js');
require('../js/utils/storage/storageDriver.js');
require('../js/utils/scheduler.js');
require('../js/utils/storage.js');
require('../js/utils/eligibilityEngine.js');
require('../js/utils/rostering/engine.js');
require('../js/components/staffAssignModal/candidateModel.js');
require('../js/components/exportModal.js');
require('../js/app.js');

const app = global.HortOpsApp;
const absencesEngine = global.HortOpsAbsences;
const eligibilityEngine = global.HortOpsEligibilityEngine;
const candidateModel = global.HortOpsStaffAssignCandidateModel;
const rosteringEngine = global.HortOpsRosteringEngine;
const storage = global.HortOpsStorage;

console.log('=== RUNNING STAGE 3 ABSENCE & REFUSAL DURABILITY CONTRACT ===\n');

// -------------------------------------------------------------
// Test 1: Cross-Year Multi-Period Absence Definition & Gregorian Boundaries
// -------------------------------------------------------------
console.log('Test 1: Cross-year absence interval (30 Dec 2026 -> 05 Jan 2027)');
const crossYearAbsence = {
  id: 'abs-cross-year-01',
  staffId: 'staff-alpha',
  type: 'annual_leave',
  startDate: '2026-12-30',
  endDate: '2027-01-05',
  notes: 'New Year cross-boundary leave'
};

const vRes = absencesEngine.validateAbsenceRecord(crossYearAbsence);
assert.strictEqual(vRes.valid, true, 'Cross-year absence interval must be valid: ' + vRes.error);

// Check dates within, before, and after interval
assert.strictEqual(absencesEngine.isStaffAbsentOnDate('staff-alpha', '2026-12-29', [crossYearAbsence]).absent, false);
assert.strictEqual(absencesEngine.isStaffAbsentOnDate('staff-alpha', '2026-12-30', [crossYearAbsence]).absent, true);
assert.strictEqual(absencesEngine.isStaffAbsentOnDate('staff-alpha', '2026-12-31', [crossYearAbsence]).absent, true);
assert.strictEqual(absencesEngine.isStaffAbsentOnDate('staff-alpha', '2027-01-01', [crossYearAbsence]).absent, true);
assert.strictEqual(absencesEngine.isStaffAbsentOnDate('staff-alpha', '2027-01-05', [crossYearAbsence]).absent, true);
assert.strictEqual(absencesEngine.isStaffAbsentOnDate('staff-alpha', '2027-01-06', [crossYearAbsence]).absent, false);
console.log('✔ Cross-year absence boundary queries evaluated with 100% accuracy');

// -------------------------------------------------------------
// Test 2: Full Lifecycle (Init -> Eligibility -> Mutate -> Commit -> Export -> Restore -> Cold Reload)
// -------------------------------------------------------------
console.log('\nTest 2: Full canonical lifecycle with durability and evidence preservation');

const initialRoster = [
  { id: 'staff-alpha', name: 'Alpha Officer', status: 'active', department: 'Horticulture', team: 'Parks', role: 'Worker', ytdOvertimeHours: 20 },
  { id: 'staff-beta', name: 'Beta Officer', status: 'active', department: 'Horticulture', team: 'Parks', role: 'Worker', ytdOvertimeHours: 20 }
];

const initialAbsence = {
  id: 'abs-alpha-01',
  staffId: 'staff-alpha',
  type: 'annual_leave',
  startDate: '2026-10-10',
  endDate: '2026-10-15',
  notes: 'Pre-existing leave'
};

const initialRefusal = {
  id: 'ref-beta-01',
  staffId: 'staff-beta',
  date: '2026-10-01',
  reason: 'Family commitments'
};

// Create initial workspace envelope with all canonical current-v2 fields
const initialEnvelope = storage.createWorkspaceEnvelope({
  schemaVersion: 2,
  jobs: [],
  roster: initialRoster,
  assignments: {},
  rostering: { instructions: {}, provenance: {} },
  historicalSnapshots: {},
  permits: {},
  budgetSettings: {},
  uiState: {},
  absences: [initialAbsence, crossYearAbsence],
  refusalHistory: [initialRefusal]
});

// Save to storage
storage.saveWorkspace(initialEnvelope);

// 2a: Init app from storage
app.recomputeDigest = () => {};
app.renderCurrentView = () => {};
app.init();

assert(Object.hasOwn(app.state, 'absences'), 'app.state must have absences property');
assert(Object.hasOwn(app.state, 'refusalHistory'), 'app.state must have refusalHistory property');
assert.strictEqual(app.state.absences.length, 2, 'Must load both initial absence records');
assert.strictEqual(app.state.refusalHistory.length, 1, 'Must load initial refusal history record');
console.log('✔ App init correctly hydrates absences and refusalHistory into canonical state');

// 2b: Roster eligibility hard-blocks absentee on leave date
const shiftOnLeaveDate = { shiftId: 'sh-101', date: '2026-10-12', assignedStaffIds: [] };
const eligAlpha = eligibilityEngine.validateStaffEligibility(initialRoster[0], shiftOnLeaveDate, {}, [], []);
assert.strictEqual(eligAlpha.eligible, false, 'Staff-alpha must be hard-blocked on leave date');
assert.strictEqual(eligAlpha.hardBlock, true, 'Staff-alpha must trigger hardBlock');
assert(eligAlpha.reasons.includes('STAFF_ABSENT'), 'Must include STAFF_ABSENT reason');

// Shift outside leave date is eligible
const shiftOutside = { shiftId: 'sh-102', date: '2026-10-20', assignedStaffIds: [] };
const eligAlphaOutside = eligibilityEngine.validateStaffEligibility(initialRoster[0], shiftOutside, {}, [], []);
assert.strictEqual(eligAlphaOutside.eligible, true, 'Staff-alpha must be eligible when not on leave');
console.log('✔ Authoritative absence enforcement hard-blocks on-leave officers');

// 2c: Modify absence & refusal via saveAbsenceAndRefusalData
const newSickLeave = {
  id: 'abs-beta-sick',
  staffId: 'staff-beta',
  type: 'sick_leave',
  startDate: '2026-10-20',
  endDate: '2026-10-21',
  notes: 'Medical certificate'
};
const updatedAbsences = [initialAbsence, crossYearAbsence, newSickLeave];

const secondRefusal = {
  id: 'ref-beta-02',
  staffId: 'staff-beta',
  date: '2026-10-05',
  reason: 'Shift too short'
};
const updatedRefusals = [initialRefusal, secondRefusal];

const saveRes = app.saveAbsenceAndRefusalData(updatedAbsences, updatedRefusals);
assert.strictEqual(saveRes.success, true, 'saveAbsenceAndRefusalData must succeed: ' + saveRes.error);
assert.strictEqual(app.state.absences.length, 3, 'In-memory state must reflect 3 absences');
assert.strictEqual(app.state.refusalHistory.length, 2, 'In-memory state must reflect 2 refusals');

// 2d: Export modal exportBackupJson includes both domains in downloaded payload
const expModal = global.HortOpsExportModal;
let exportedPayload = null;
expModal.downloadFile = (content, filename, mime) => {
  exportedPayload = JSON.parse(content);
};
expModal.exportBackupJson();
assert(exportedPayload, 'exportBackupJson must trigger file download');
assert(Array.isArray(exportedPayload.absences), 'Exported payload must include absences array');
assert(Array.isArray(exportedPayload.refusalHistory), 'Exported payload must include refusalHistory array');
assert.strictEqual(exportedPayload.absences.length, 3, 'Exported payload must contain 3 absences');
assert.strictEqual(exportedPayload.refusalHistory.length, 2, 'Exported payload must contain 2 refusals');
console.log('✔ Export backup produces valid Schema v2 envelope containing complete absence and refusal ledgers');

// 2e: Restore from exported payload
app.state.absences = [];
app.state.refusalHistory = [];
const restoreOk = app.restoreWorkspaceJson(exportedPayload);
assert.strictEqual(restoreOk, true, 'restoreWorkspaceJson must succeed');
assert.strictEqual(app.state.absences.length, 3, 'Restored state must reflect 3 absences');
assert.strictEqual(app.state.refusalHistory.length, 2, 'Restored state must reflect 2 refusals');
console.log('✔ Workspace restore successfully reconstitutes both ledgers into runtime state');

// 2f: Cold reload from disk/storage
app.state.absences = [];
app.state.refusalHistory = [];
app.init();
assert.strictEqual(app.state.absences.length, 3, 'Cold reload must recover 3 absences from committed storage');
assert.strictEqual(app.state.refusalHistory.length, 2, 'Cold reload must recover 2 refusals from committed storage');
console.log('✔ Cold reload recovers complete persisted ledgers without degradation');

// -------------------------------------------------------------
// Test 3: Suspicious Evidence Loss Guard
// -------------------------------------------------------------
console.log('\nTest 3: Suspicious evidence loss guard');
// Attempting to commit empty absences when committed storage has 3 records
const maliciousDropProposal = { absences: [] };
const dropRes = app._commitCanonicalProposal(maliciousDropProposal);
assert.strictEqual(dropRes.success, false, 'Dropping established absences must fail-closed');
assert(dropRes.error.includes('Suspicious evidence loss'), 'Error must cite suspicious evidence loss');
console.log('✔ Suspicious evidence loss guard prevents inadvertent ledger drops');

// -------------------------------------------------------------
// Test 4: Forced Write Failure & Compensating Rollback
// -------------------------------------------------------------
console.log('\nTest 4: Forced write failure and rollback integrity');
const originalDriverSave = storage.saveWorkspace;
storage.saveWorkspace = () => ({ ok: false, error: 'Forced disk write failure for testing' });

const abortiveProposal = {
  absences: [
    ...app.state.absences,
    { id: 'abs-fail', staffId: 'staff-alpha', type: 'rdo', startDate: '2026-11-01', endDate: '2026-11-01' }
  ]
};
const failCommitRes = app._commitCanonicalProposal(abortiveProposal);
assert.strictEqual(failCommitRes.success, false, 'Commit must fail when storage fails');
assert(failCommitRes.error.includes('Forced disk write failure'), 'Error must propagate');

// Restore driver
storage.saveWorkspace = originalDriverSave;

// Re-verify that committed storage was NOT partially updated
const freshLoaded = storage.loadWorkspace();
assert.strictEqual(freshLoaded.absences.length, 3, 'Committed storage must remain uncorrupted (3 records)');
console.log('✔ Authoritative storage boundary transactional safety verified');

// -------------------------------------------------------------
// Test 5: Fair-Share Refusal Ranking & Authorised Leave Invariant
// -------------------------------------------------------------
console.log('\nTest 5: Fair-share refusal-aware ranking in modal candidate sorting & rotation');

// Both officers have 20 YTD hours. Beta has 2 refusals, Alpha has 0 refusals.
// Score Alpha = 1000 - (20 * 2) + (0 * 5) = 960
// Score Beta  = 1000 - (20 * 2) + (2 * 5) = 970
const scoreAlpha = absencesEngine.calculateFairShareScore(initialRoster[0], { refusalHistory: app.state.refusalHistory, asOfDate: '2026-11-15' });
const scoreBeta = absencesEngine.calculateFairShareScore(initialRoster[1], { refusalHistory: app.state.refusalHistory, asOfDate: '2026-11-15' });
assert.strictEqual(scoreAlpha, 960, 'Alpha score must be 960');
assert.strictEqual(scoreBeta, 970, 'Beta score must be 970');

// Modal candidate ranking: Beta (970) must rank BEFORE Alpha (960)
const candidates = [
  { ...initialRoster[0], _fatigueEval: { tier: 'LOW', consecutiveWeekends: 0 }, _lacksQualifications: false },
  { ...initialRoster[1], _fatigueEval: { tier: 'LOW', consecutiveWeekends: 0 }, _lacksQualifications: false }
];
const sortedCandidates = candidateModel.sortCandidates(candidates, {
  matchingJob: {},
  prefs: {},
  assignedIdsSet: new Set(),
  refusalHistory: app.state.refusalHistory,
  asOfDate: '2026-11-15'
});
assert.strictEqual(sortedCandidates[0].id, 'staff-beta', 'Beta must be sorted first due to higher fair-share score');
assert.strictEqual(sortedCandidates[1].id, 'staff-alpha', 'Alpha must be sorted second');

// Assisted rotation candidate selection: Beta must be recommended before Alpha
const rotResult = rosteringEngine.recommendRotationCandidate({
  roster: initialRoster,
  occurrence: { shiftId: 'sh-rot', date: '2026-11-15' },
  allShifts: [],
  currentAssignedIds: [],
  refusalHistory: app.state.refusalHistory
});
assert(rotResult && rotResult.candidate, 'Candidate must be recommended by rotation engine');
assert.strictEqual(rotResult.candidate.id, 'staff-beta', 'Assisted rotation must select Beta first based on fair share');

// Authorised leave invariant: Taking leave does NOT add refusals
const leaveCountAlpha = absencesEngine.getStaffRefusalCount('staff-alpha', app.state.refusalHistory, '2026-11-15');
assert.strictEqual(leaveCountAlpha, 0, 'Alpha has 2 approved leave records, but refusal count must remain 0');
console.log('✔ Refusal history correctly lifts fair-share dispatch priority while leave does not count as refusal');

// -------------------------------------------------------------
// Test 6: Negative Tests for Fail-Closed Engine Dependencies
// -------------------------------------------------------------
console.log('\nTest 6: Fail-closed negative tests for missing/throwing/malformed dependencies');

// 6a: Missing simulateAssignmentFatigue method
const realFatigueEngine = global.HortOpsFatigueEngine;
global.HortOpsFatigueEngine = {}; // empty object
const noFatigueRes = eligibilityEngine.validateStaffEligibility(initialRoster[1], shiftOutside, {}, [], []);
assert.strictEqual(noFatigueRes.eligible, false, 'Missing fatigue method must hard-block');
assert.strictEqual(noFatigueRes.hardBlock, true);
assert(noFatigueRes.reasons.includes('FATIGUE_ENGINE_UNAVAILABLE'), 'Must specify FATIGUE_ENGINE_UNAVAILABLE');

// 6b: Throwing simulateAssignmentFatigue
global.HortOpsFatigueEngine = {
  simulateAssignmentFatigue: () => { throw new Error('Simulated fatigue calculation crash'); }
};
const throwFatigueRes = eligibilityEngine.validateStaffEligibility(initialRoster[1], shiftOutside, {}, [], []);
assert.strictEqual(throwFatigueRes.eligible, false, 'Throwing fatigue engine must hard-block');
assert(throwFatigueRes.reasons.includes('FATIGUE_ENGINE_UNAVAILABLE'));

// 6c: Malformed return from simulateAssignmentFatigue
global.HortOpsFatigueEngine = {
  simulateAssignmentFatigue: () => 'not an object'
};
const malformedFatigueRes = eligibilityEngine.validateStaffEligibility(initialRoster[1], shiftOutside, {}, [], []);
assert.strictEqual(malformedFatigueRes.eligible, false, 'Malformed fatigue result must hard-block');
assert(malformedFatigueRes.reasons.includes('FATIGUE_ENGINE_UNAVAILABLE'));

// Restore fatigue engine
global.HortOpsFatigueEngine = realFatigueEngine;

// 6d: Missing isStaffAbsentOnDate method
const realAbsEngine = global.HortOpsAbsences;
const realAbsLedger = global.HortOpsAbsenceLedger;
global.HortOpsAbsences = {};
global.HortOpsAbsenceLedger = null;
const noAbsRes = eligibilityEngine.validateStaffEligibility(initialRoster[1], shiftOutside, {}, [], []);
assert.strictEqual(noAbsRes.eligible, false, 'Missing absence method must hard-block');
assert.strictEqual(noAbsRes.hardBlock, true);
assert(noAbsRes.reasons.includes('ABSENCE_ENGINE_UNAVAILABLE'), 'Must specify ABSENCE_ENGINE_UNAVAILABLE');

// 6e: Throwing isStaffAbsentOnDate
global.HortOpsAbsences = {
  isStaffAbsentOnDate: () => { throw new Error('Simulated absence check crash'); }
};
const throwAbsRes = eligibilityEngine.validateStaffEligibility(initialRoster[1], shiftOutside, {}, [], []);
assert.strictEqual(throwAbsRes.eligible, false, 'Throwing absence engine must hard-block');
assert(throwAbsRes.reasons.includes('ABSENCE_ENGINE_UNAVAILABLE'));

// Restore absences engine
global.HortOpsAbsences = realAbsEngine;
global.HortOpsAbsenceLedger = realAbsLedger;

console.log('✔ Fail-closed architecture safely blocks assignments when safety dependencies fail');

// -------------------------------------------------------------
// Test 7: Review 57 Typed Safety Contracts, Temporal Scope & Identity Retention
// -------------------------------------------------------------
console.log('\nTest 7: Review 57 Typed Safety Contracts, Temporal Scope & Identity Retention');

// 7a: Absence fail-closed typed validation
const emptyAbsenceRes = eligibilityEngine.validateStaffEligibility(initialRoster[1], shiftOutside, {}, [], []);
global.HortOpsAbsences = { isStaffAbsentOnDate: () => ({}) };
const malformedAbsRes = eligibilityEngine.validateStaffEligibility(initialRoster[1], shiftOutside, {}, [], []);
assert.strictEqual(malformedAbsRes.eligible, false, 'Malformed absence object must fail closed');
assert.strictEqual(malformedAbsRes.hardBlock, true);
assert(malformedAbsRes.reasons.includes('ABSENCE_ENGINE_UNAVAILABLE'), 'Must cite ABSENCE_ENGINE_UNAVAILABLE');

global.HortOpsAbsences = { isStaffAbsentOnDate: () => ({ absent: 'false' }) };
const nonBoolAbsRes = eligibilityEngine.validateStaffEligibility(initialRoster[1], shiftOutside, {}, [], []);
assert.strictEqual(nonBoolAbsRes.eligible, false, 'Non-boolean absent field must fail closed');
assert.strictEqual(nonBoolAbsRes.hardBlock, true);
assert(nonBoolAbsRes.reasons.includes('ABSENCE_ENGINE_UNAVAILABLE'));

// Restore absences engine
global.HortOpsAbsences = realAbsEngine;

// 7b: Fatigue fail-closed typed validation
global.HortOpsFatigueEngine = { simulateAssignmentFatigue: () => ({}) };
const emptyFatigueRes = eligibilityEngine.validateStaffEligibility(initialRoster[1], shiftOutside, {}, [], []);
assert.strictEqual(emptyFatigueRes.eligible, false, 'Malformed fatigue object must fail closed');
assert.strictEqual(emptyFatigueRes.hardBlock, true);
assert(emptyFatigueRes.reasons.includes('FATIGUE_ENGINE_UNAVAILABLE'), 'Must cite FATIGUE_ENGINE_UNAVAILABLE');

global.HortOpsFatigueEngine = { simulateAssignmentFatigue: () => ({ tier: 'INVALID_TIER', isHardBlocked: false }) };
const invalidTierFatigueRes = eligibilityEngine.validateStaffEligibility(initialRoster[1], shiftOutside, {}, [], []);
assert.strictEqual(invalidTierFatigueRes.eligible, false, 'Invalid fatigue tier must fail closed');
assert.strictEqual(invalidTierFatigueRes.hardBlock, true);
assert(invalidTierFatigueRes.reasons.includes('FATIGUE_ENGINE_UNAVAILABLE'));

global.HortOpsFatigueEngine = { simulateAssignmentFatigue: () => ({ tier: 'LOW', isHardBlocked: 'false' }) };
const nonBoolFatigueRes = eligibilityEngine.validateStaffEligibility(initialRoster[1], shiftOutside, {}, [], []);
assert.strictEqual(nonBoolFatigueRes.eligible, false, 'Non-boolean isHardBlocked must fail closed');
assert.strictEqual(nonBoolFatigueRes.hardBlock, true);
assert(nonBoolFatigueRes.reasons.includes('FATIGUE_ENGINE_UNAVAILABLE'));

// Restore fatigue engine
global.HortOpsFatigueEngine = realFatigueEngine;

// 7c: Temporal bounds for fair share: future refusal must be excluded
const fairShareFutureTest = absencesEngine.calculateFairShareScore(
  { id: 'person1', ytdOvertimeHours: 0 },
  { asOfDate: '2026-10-10', refusalHistory: [{ id: 'future', staffId: 'person1', date: '2027-03-10' }] }
);
assert.strictEqual(fairShareFutureTest, 1000, 'Future refusal must be excluded relative to asOfDate');

// 7d: Authorised removal of final absence
const preCount = app.state.absences.length;
assert(preCount > 0, 'Must have absences to test final removal');
const singleAbsenceApp = {
  absences: [{ id: 'sole-absence', staffId: 'staff-alpha', type: 'annual_leave', startDate: '2026-11-20', endDate: '2026-11-20' }]
};
app.state.absences = singleAbsenceApp.absences;
storage.saveWorkspace(storage.createWorkspaceEnvelope({ ...storage.loadWorkspace(), absences: singleAbsenceApp.absences }));

const finalRemovalRes = app.saveAbsenceAndRefusalData([], app.state.refusalHistory, { deletedAbsenceIds: ['sole-absence'], deletedRefusalIds: [] });
assert.strictEqual(finalRemovalRes.success, true, 'Authorised removal of final absence must succeed');
const loadedAfterFinalRemoval = storage.loadWorkspace();
assert.strictEqual(loadedAfterFinalRemoval.absences.length, 0, 'Committed storage must reflect 0 absences');

// 7e: Unsolicited replacement of absence identities blocked
const replacementProposal = { absences: [{ id: 'unsolicited-new-id', staffId: 'staff-alpha', type: 'sick_leave', startDate: '2026-11-22', endDate: '2026-11-22' }] };
// First establish 1 record in storage
storage.saveWorkspace(storage.createWorkspaceEnvelope({ ...storage.loadWorkspace(), absences: [{ id: 'original-id', staffId: 'staff-alpha', type: 'sick_leave', startDate: '2026-11-22', endDate: '2026-11-22' }] }));
const unsolicitedRes = app._commitCanonicalProposal(replacementProposal);
assert.strictEqual(unsolicitedRes.success, false, 'Unsolicited replacement of absence identities must fail');

// 7f: Unsolicited elimination of refusal identities blocked
const unsolicitedRefusalRes = app._commitCanonicalProposal({ refusalHistory: [] });
assert.strictEqual(unsolicitedRefusalRes.success, false, 'Unsolicited elimination of refusal identities must fail');

console.log('✔ Review 57 typed safety contracts, temporal bounds & identity preservation verified');

// Test 8: Review 61 Three-way identity state, concurrency reconciliation & zero-write rollback contracts
console.log('\nTest 8: Review 61 Three-way concurrency reconciliation & zero-write rollback contracts');

// 8a: Stale modal resurrecting deleted absence blocked with zero writes (R61-P1-01)
const abs8Baseline = [{ id: 'abs-8a', staffId: 'staff-alpha', type: 'rdo', startDate: '2026-12-01', endDate: '2026-12-01' }];
const ref8Baseline = [{ id: 'ref-8a', staffId: 'staff-alpha', date: '2026-12-01', reason: 'prior refusal' }];
storage.saveWorkspace(storage.createWorkspaceEnvelope({ ...storage.loadWorkspace(), absences: abs8Baseline, refusalHistory: ref8Baseline }));
app.state.absences = structuredClone(abs8Baseline);
app.state.refusalHistory = structuredClone(ref8Baseline);

// Another session deletes abs-8a
storage.saveWorkspace(storage.createWorkspaceEnvelope({ ...storage.loadWorkspace(), absences: [], refusalHistory: ref8Baseline }));

// Stale modal attempts to save with baseline containing abs-8a
const staleAbsRes = app.saveAbsenceAndRefusalData(abs8Baseline, ref8Baseline, { baseAbsences: abs8Baseline, baseRefusals: ref8Baseline });
assert.strictEqual(staleAbsRes.success, false, 'Stale modal must not resurrect externally deleted absence');
assert.strictEqual(storage.loadWorkspace().absences.length, 0, 'Committed storage must remain deleted (zero writes)');

// 8b: Stale modal resurrecting deleted refusal blocked with zero writes (R61-P1-01)
storage.saveWorkspace(storage.createWorkspaceEnvelope({ ...storage.loadWorkspace(), absences: abs8Baseline, refusalHistory: ref8Baseline }));
// Another session deletes ref-8a
storage.saveWorkspace(storage.createWorkspaceEnvelope({ ...storage.loadWorkspace(), absences: abs8Baseline, refusalHistory: [] }));

const staleRefRes = app.saveAbsenceAndRefusalData(abs8Baseline, ref8Baseline, { baseAbsences: abs8Baseline, baseRefusals: ref8Baseline });
assert.strictEqual(staleRefRes.success, false, 'Stale modal must not resurrect externally deleted refusal');
assert.strictEqual(storage.loadWorkspace().refusalHistory.length, 0, 'Committed storage must remain deleted (zero writes)');

// 8c: Colliding concurrent absence addition with differing payload blocked (R61-P1-02)
storage.saveWorkspace(storage.createWorkspaceEnvelope({ ...storage.loadWorkspace(), absences: abs8Baseline, refusalHistory: ref8Baseline }));
const concurrentTheirsAbs = { id: 'abs-collision', staffId: 'staff-beta', type: 'rdo', startDate: '2026-12-05', endDate: '2026-12-05', notes: 'COMMITTED BY SESSION 2' };
storage.saveWorkspace(storage.createWorkspaceEnvelope({ ...storage.loadWorkspace(), absences: [...abs8Baseline, concurrentTheirsAbs] }));

const collidingOursAbs = { id: 'abs-collision', staffId: 'staff-beta', type: 'rdo', startDate: '2026-12-05', endDate: '2026-12-05', notes: 'PROPOSED BY OLDER SESSION 1' };
const collidingAbsRes = app.saveAbsenceAndRefusalData([...abs8Baseline, collidingOursAbs], ref8Baseline, { baseAbsences: abs8Baseline, baseRefusals: ref8Baseline });
assert.strictEqual(collidingAbsRes.success, false, 'Colliding concurrent absence addition must fail');
assert.strictEqual(storage.loadWorkspace().absences.find(x => x.id === 'abs-collision').notes, 'COMMITTED BY SESSION 2', 'Committed data must not be overwritten');

// 8d: Colliding concurrent refusal addition with differing payload blocked (R61-P1-02)
storage.saveWorkspace(storage.createWorkspaceEnvelope({ ...storage.loadWorkspace(), absences: abs8Baseline, refusalHistory: ref8Baseline }));
const concurrentTheirsRef = { id: 'ref-collision', staffId: 'staff-beta', date: '2026-12-05', reason: 'COMMITTED BY SESSION 2' };
storage.saveWorkspace(storage.createWorkspaceEnvelope({ ...storage.loadWorkspace(), refusalHistory: [...ref8Baseline, concurrentTheirsRef] }));

const collidingOursRef = { id: 'ref-collision', staffId: 'staff-beta', date: '2026-12-05', reason: 'PROPOSED BY OLDER SESSION 1' };
const collidingRefRes = app.saveAbsenceAndRefusalData(abs8Baseline, [...ref8Baseline, collidingOursRef], { baseAbsences: abs8Baseline, baseRefusals: ref8Baseline });
assert.strictEqual(collidingRefRes.success, false, 'Colliding concurrent refusal addition must fail');
assert.strictEqual(storage.loadWorkspace().refusalHistory.find(x => x.id === 'ref-collision').reason, 'COMMITTED BY SESSION 2', 'Committed data must not be overwritten');

// 8e: Clean non-colliding fresh addition succeeds
const freshAbs = { id: 'abs-fresh-new', staffId: 'staff-alpha', type: 'training', startDate: '2026-12-10', endDate: '2026-12-10' };
storage.saveWorkspace(storage.createWorkspaceEnvelope({ ...storage.loadWorkspace(), absences: abs8Baseline, refusalHistory: ref8Baseline }));
const freshRes = app.saveAbsenceAndRefusalData([...abs8Baseline, freshAbs], ref8Baseline, { baseAbsences: abs8Baseline, baseRefusals: ref8Baseline });
assert.strictEqual(freshRes.success, true, 'Fresh non-colliding absence addition must succeed');
assert.strictEqual(storage.loadWorkspace().absences.length, 2, 'Committed storage must reflect addition');

console.log('✔ Review 61 three-way concurrency reconciliation & zero-write rollback contracts verified');

console.log('\n================================================================');
console.log(' [PASS] ALL STAGE 3 DURABILITY, TYPED SAFETY & RECOVERY CONTRACTS VERIFIED 100%');
console.log('================================================================\n');
