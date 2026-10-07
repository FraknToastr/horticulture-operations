/**
 * Stage 3 - Gate 3B Verification Contract:
 * Hard Qualification Matching in Staff Assignment Modal & Candidate Engine
 *
 * Verifies:
 * 1. Candidate evaluation against job required qualifications as of shiftDate
 * 2. Candidate list sorting priority (Accredited officers prioritized before unaccredited)
 * 3. Candidate card rendering (Accredited vs Ticket Missing / Ticket Expired badges, disabled action button)
 * 4. Staged crew non-compliance alert banner & per-officer badges
 * 5. Fail-closed assignment blocking in addStaff() & saveAllocation()
 * 6. removeAllUnaccredited() cleansing method
 * 7. Zero-regression backward compatibility for jobs without required qualifications
 */

const assert = require('assert');
const path = require('path');

// Setup mock window environment for browser/node hybrid modules
if (typeof window === 'undefined') {
  global.window = {};
}
if (typeof document === 'undefined') {
  global.document = {
    getElementById: function() { return null; }
  };
}

// 1. Load Dependencies
require('../js/data/holidays.js');
require('../js/utils/icons.js');
require('../js/utils/securityUtils.js');
require('../js/utils/dateUtils.js');
require('../js/utils/qualifications.js');
require('../js/utils/storage/schemaValidator.js');
require('../js/utils/eligibilityEngine.js');
require('../js/components/staffAssignModal/candidateModel.js');
require('../js/components/staffAssignModal/candidateList.js');
require('../js/components/staffAssignModal/stagedCrew.js');
require('../js/components/staffAssignModal.js');

const quals = window.HortOpsQualifications;
const candidateModel = window.HortOpsStaffAssignCandidateModel;
const candidateList = window.HortOpsStaffAssignCandidateList;
const stagedCrew = window.HortOpsStaffAssignStagedCrew;
const modal = window.HortOpsStaffAssignModal;

assert(quals, 'HortOpsQualifications must be available');
assert(candidateModel, 'HortOpsStaffAssignCandidateModel must be available');
assert(candidateList, 'HortOpsStaffAssignCandidateList must be available');
assert(stagedCrew, 'HortOpsStaffAssignStagedCrew must be available');
assert(modal, 'HortOpsStaffAssignModal must be available');

console.log('=== STAGE 3 GATE 3B VERIFICATION CONTRACT ===\n');

// Mock Data
const shiftDate = '2026-06-06';
const mockShift = {
  shiftId: 'job-chainsaw-1@2026-06-06',
  jobId: 'job-chainsaw-1',
  jobName: 'Large Elm Tree Felling',
  date: shiftDate,
  startTime: '07:00',
  crewSize: 2,
  durationHours: 4
};

const mockJobWithReqs = {
  id: 'job-chainsaw-1',
  name: 'Large Elm Tree Felling',
  category: 'Arboriculture',
  crewSize: 2,
  durationHours: 4,
  startTime: '07:00',
  requiredQualifications: ['CHAINSAW_L2', 'FIRST_AID']
};

const staffAccredited = {
  id: 'staff-acc-1',
  name: 'Alex Vance',
  role: 'Senior Arborist',
  team: 'Trees',
  department: 'Horticulture',
  status: 'active',
  isPlantOperator: false,
  ytdHours: 10,
  qualifications: [
    { code: 'CHAINSAW_L2', issuedDate: '2025-01-01', expiryDate: '2028-01-01', status: 'active' },
    { code: 'FIRST_AID', issuedDate: '2025-01-01', expiryDate: '2028-01-01', status: 'active' }
  ]
};

const staffExpired = {
  id: 'staff-exp-2',
  name: 'Bob Miller',
  role: 'Arborist',
  team: 'Trees',
  department: 'Horticulture',
  status: 'active',
  isPlantOperator: false,
  ytdHours: 5,
  qualifications: [
    { code: 'CHAINSAW_L2', issuedDate: '2022-01-01', expiryDate: '2025-01-01', status: 'active' }, // Expired before 2026-06-06
    { code: 'FIRST_AID', issuedDate: '2025-01-01', expiryDate: '2028-01-01', status: 'active' }
  ]
};

const staffMissing = {
  id: 'staff-mis-3',
  name: 'Charlie Davis',
  role: 'Groundsperson',
  team: 'Trees',
  department: 'Horticulture',
  status: 'active',
  isPlantOperator: false,
  ytdHours: 2,
  qualifications: [
    { code: 'FIRST_AID', issuedDate: '2025-01-01', expiryDate: '2028-01-01', status: 'active' }
    // Missing CHAINSAW_L2
  ]
};

const mockRoster = [staffAccredited, staffExpired, staffMissing];

// -------------------------------------------------------------
// Test Group 1: Candidate Model Qualification Evaluation
// -------------------------------------------------------------
console.log('--- Test Group 1: Candidate Model Qualification Evaluation ---');
const filtered = candidateModel.filterCandidates(mockRoster, {
  shift: mockShift,
  allShifts: [mockShift],
  stagedAssignedStaffIds: [],
  matchingJob: mockJobWithReqs
});

assert.strictEqual(filtered.length, 3, 'All candidates must remain visible for coordinator transparency');

const candAcc = filtered.find(s => s.id === 'staff-acc-1');
const candExp = filtered.find(s => s.id === 'staff-exp-2');
const candMis = filtered.find(s => s.id === 'staff-mis-3');

assert.strictEqual(candAcc._lacksQualifications, false, 'Fully accredited staff must not lack qualifications');
assert.strictEqual(candAcc._qualEval.compliant, true);

assert.strictEqual(candExp._lacksQualifications, true, 'Staff with expired ticket must lack qualifications');
assert.strictEqual(candExp._qualEval.compliant, false);
assert(candExp._qualEval.expiredCodes.includes('CHAINSAW_L2'), 'CHAINSAW_L2 must be flagged as expired');

assert.strictEqual(candMis._lacksQualifications, true, 'Staff missing ticket must lack qualifications');
assert.strictEqual(candMis._qualEval.compliant, false);
assert(candMis._qualEval.missingCodes.includes('CHAINSAW_L2'), 'CHAINSAW_L2 must be flagged as missing');

console.log('✔ Candidate Model accurately evaluates and categorizes qualifications');

// -------------------------------------------------------------
// Test Group 2: Candidate Model Sorting Priority
// -------------------------------------------------------------
console.log('\n--- Test Group 2: Candidate Model Sorting Priority ---');
const sorted = candidateModel.sortCandidates([...filtered], {
  assignedIdsSet: new Set(),
  prefs: {},
  matchingJob: mockJobWithReqs
});

// Accredited staff has 10 YTD hours, Expired has 5 YTD hours, Missing has 2 YTD hours.
// Normally lowest hours is first, but accredited officers MUST rank before unaccredited officers!
assert.strictEqual(sorted[0].id, 'staff-acc-1', 'Accredited officer must rank first despite higher YTD hours');
assert.strictEqual(sorted[0]._lacksQualifications, false);
assert.strictEqual(sorted[1]._lacksQualifications, true);
assert.strictEqual(sorted[2]._lacksQualifications, true);
console.log('✔ Candidate Model prioritizes fully accredited officers above unaccredited officers');

// -------------------------------------------------------------
// Test Group 3: Candidate List Card & Button Rendering
// -------------------------------------------------------------
console.log('\n--- Test Group 3: Candidate List Card & Button Rendering ---');
const listHtml = candidateList.render({
  filteredStaff: sorted,
  assignedIdsSet: new Set(),
  isExclusive: false,
  icons: window.HortOpsIcons
});

assert(listHtml.includes('Accredited'), 'HTML must render Accredited badge for qualified staff');
assert(listHtml.includes('Ticket Expired'), 'HTML must render Ticket Expired badge for staff with expired ticket');
assert(listHtml.includes('Ticket Missing'), 'HTML must render Ticket Missing badge for staff missing ticket');
assert(listHtml.includes('Lacks Ticket'), 'HTML must render disabled Lacks Ticket button for unqualified staff');
assert(listHtml.includes('disabled'), 'HTML must disable Add button for unqualified staff');
console.log('✔ Candidate List UI renders distinct badges and disables action button for unaccredited staff');

// -------------------------------------------------------------
// Test Group 4: Staged Crew Non-Compliance Alert Banner & Badging
// -------------------------------------------------------------
console.log('\n--- Test Group 4: Staged Crew Alerts & Badging ---');
const stagedHtmlWithUnaccredited = stagedCrew.render({
  shift: mockShift,
  matchingJob: mockJobWithReqs,
  assignedStaffList: [staffAccredited, staffExpired],
  stagedAssignedStaffIds: ['staff-acc-1', 'staff-exp-2'],
  icons: window.HortOpsIcons
});

assert(stagedHtmlWithUnaccredited.includes('Accreditation Non-Compliance'), 'Must display Accreditation Non-Compliance warning banner');
assert(stagedHtmlWithUnaccredited.includes('Remove Unaccredited'), 'Must provide Remove Unaccredited action button');
assert(stagedHtmlWithUnaccredited.includes('Ticket Expired'), 'Row must display Ticket Expired badge');

const stagedHtmlCompliant = stagedCrew.render({
  shift: mockShift,
  matchingJob: mockJobWithReqs,
  assignedStaffList: [staffAccredited],
  stagedAssignedStaffIds: ['staff-acc-1'],
  icons: window.HortOpsIcons
});

assert(!stagedHtmlCompliant.includes('Accreditation Non-Compliance'), 'Compliant crew must not display non-compliance warning');
console.log('✔ Staged Crew view properly displays compliance alert banner and per-officer status pills');

// -------------------------------------------------------------
// Test Group 5: Modal Fail-Closed Assignment & Save Hard Block
// -------------------------------------------------------------
console.log('\n--- Test Group 5: Modal Fail-Closed Assignment & Save Hard Block ---');

// Mock window.HortOpsApp state
let lastAlert = null;
global.alert = function(msg) { lastAlert = msg; };

window.HortOpsApp = {
  state: {
    allShifts: [mockShift],
    jobs: [mockJobWithReqs],
    staffList: mockRoster,
    currentYear: 2026
  }
};

modal.activeShiftId = mockShift.shiftId;
modal.stagedAssignedStaffIds = [];
modal.stagedSlots = [];
modal.stagedSlotStrategies = {};
modal.renderModal = function() {}; // No-op for headless unit test

// Test addStaff with unqualified staff
lastAlert = null;
modal.addStaff('staff-exp-2');
assert(lastAlert && lastAlert.includes('Cannot assign'), 'addStaff must block assignment of staff with expired ticket');
assert.strictEqual(modal.stagedAssignedStaffIds.length, 0, 'Unqualified staff must not be added to stagedAssignedStaffIds');

lastAlert = null;
modal.addStaff('staff-mis-3');
assert(lastAlert && lastAlert.includes('Cannot assign'), 'addStaff must block assignment of staff missing ticket');
assert.strictEqual(modal.stagedAssignedStaffIds.length, 0, 'Unqualified staff must not be added to stagedAssignedStaffIds');

// Test addStaff with accredited staff
lastAlert = null;
modal.addStaff('staff-acc-1');
assert.strictEqual(lastAlert, null, 'Accredited staff must be assigned without alert');
assert.strictEqual(modal.stagedAssignedStaffIds.includes('staff-acc-1'), true, 'Accredited staff must be in stagedAssignedStaffIds');

// Test saveAllocation hard block if unaccredited staff is somehow present (e.g. from prior state)
modal.stagedAssignedStaffIds.push('staff-exp-2');
lastAlert = null;
let rosterApplied = false;
window.HortOpsRosteringEngine = {
  applyRostering: function() { rosterApplied = true; return { ok: true }; }
};

modal.saveAllocation();
assert(lastAlert && lastAlert.includes('lack mandatory accreditations'), 'saveAllocation must block when unaccredited staff is staged');
assert.strictEqual(rosterApplied, false, 'applyRostering must NOT be called when qualification check fails');

// Test removeAllUnaccredited
modal.removeAllUnaccredited();
assert.strictEqual(modal.stagedAssignedStaffIds.includes('staff-exp-2'), false, 'Expired staff must be removed');
assert.strictEqual(modal.stagedAssignedStaffIds.includes('staff-acc-1'), true, 'Accredited staff must be retained');

// Test successful save with compliant crew (passes qualification check to rostering engine)
lastAlert = null;
rosterApplied = false;
modal.saveAllocation();
assert.strictEqual(rosterApplied, true, 'applyRostering must be called for compliant crew');
assert(!lastAlert || !lastAlert.includes('lack mandatory accreditations'), 'Must not block on qualification check');

console.log('✔ Modal strictly blocks unaccredited assignments, cleanses unaccredited crew, and enforces save guard');

// -------------------------------------------------------------
// Test Group 6: Backward Compatibility (Jobs without requirements)
// -------------------------------------------------------------
console.log('\n--- Test Group 6: Backward Compatibility ---');
const legacyJob = {
  id: 'job-general-9',
  name: 'General Turf Mowing',
  category: 'Turf',
  crewSize: 2,
  durationHours: 4,
  startTime: '07:00'
  // No requiredQualifications property
};

const legacyShift = {
  shiftId: 'job-general-9@2026-06-06',
  jobId: 'job-general-9',
  jobName: 'General Turf Mowing',
  date: shiftDate,
  startTime: '07:00',
  crewSize: 2,
  durationHours: 4
};

window.HortOpsApp.state.jobs = [legacyJob];
window.HortOpsApp.state.allShifts = [legacyShift];
modal.activeShiftId = legacyShift.shiftId;
modal.stagedAssignedStaffIds = [];

// Any active staff member can be assigned when job requires no qualifications
lastAlert = null;
modal.addStaff('staff-mis-3');
assert.strictEqual(lastAlert, null, 'Jobs without qualification requirements must allow regular assignments');
assert.strictEqual(modal.stagedAssignedStaffIds.includes('staff-mis-3'), true);

rosterApplied = false;
lastAlert = null;
modal.saveAllocation();
assert.strictEqual(rosterApplied, true, 'saveAllocation must proceed to rostering engine cleanly for legacy jobs');
assert(!lastAlert || !lastAlert.includes('lack mandatory accreditations'));
console.log('✔ Jobs without qualification requirements operate with 100% backward compatibility');

console.log('\n======================================================');
console.log(' [PASS] GATE 3B CONTRACT VERIFICATION COMPLETE: 100% OK');
console.log('======================================================\n');
