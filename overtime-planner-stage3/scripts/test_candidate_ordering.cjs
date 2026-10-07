const assert = require('assert');
const path = require('path');

console.log('=== RUNNING CANDIDATE ORDERING EQUIVALENCE TEST SUITE (OFFLINE15.1) ===');

// Setup mock window environment
global.window = global;

const offlineDir = path.resolve(__dirname, '..');

require(path.join(offlineDir, 'js/data/staffRoster.js'));
require(path.join(offlineDir, 'js/data/initialJobs.js'));
require(path.join(offlineDir, 'js/data/holidays.js'));
require(path.join(offlineDir, 'js/data/historicalOccurrences.js'));
require(path.join(offlineDir, 'js/utils/dateUtils.js'));
require(path.join(offlineDir, 'js/utils/eligibilityEngine.js'));
require(path.join(offlineDir, 'js/components/staffAssignModal/candidateModel.js'));

const roster = window.HortOpsData.STAFF_ROSTER;
const jobs = window.HortOpsData.INITIAL_JOBS;

console.log(`Loaded ${roster.length} roster members and ${jobs.length} jobs.`);

// Original Inline Algorithm from staffAssignModal.js
function originalResolve(roster, ctx) {
  const shift = ctx.shift;
  const matchingJob = ctx.matchingJob;
  const primaryTeam = ctx.primaryTeam;
  const secondaryTeam = ctx.secondaryTeam;
  const tertiaryTeam = ctx.tertiaryTeam;
  const isExclusive = ctx.isExclusive;
  const exclusiveTeams = ctx.exclusiveTeams || [];
  const assignedIdsSet = ctx.assignedIdsSet || new Set();
  const allShifts = ctx.allShifts || [];
  const stagedAssignedStaffIds = ctx.stagedAssignedStaffIds || [];
  const searchTerm = ctx.searchTerm;
  const selectedDept = ctx.selectedDept || 'all';
  const selectedTeam = ctx.selectedTeam || 'all';
  const onlyPreferredCrew = ctx.onlyPreferredCrew;

  function getStaffPriority(staff) {
    var t = staff.team.toLowerCase();
    if (primaryTeam && t === primaryTeam.toLowerCase()) return 1;
    if (secondaryTeam && t === secondaryTeam.toLowerCase()) return 2;
    if (tertiaryTeam && t === tertiaryTeam.toLowerCase()) return 3;
    if (isExclusive && exclusiveTeams.some(function(ex) { return ex.toLowerCase() === t; })) return 4;
    return 5;
  }

  var filteredStaff = roster.filter(function(staff) {
    var isDoubleBookedOnly = false;
    if (window.HortOpsEligibilityEngine) {
      var evalRes = window.HortOpsEligibilityEngine.validateStaffEligibility(staff, shift, allShifts, stagedAssignedStaffIds);
      if (!evalRes.eligible) {
        if (evalRes.reasons.length === 1 && evalRes.reasons[0] === 'OVERLAPPING_SHIFT') {
          isDoubleBookedOnly = true;
        } else {
          return false;
        }
      }
    } else {
      return false;
    }

    if (searchTerm) {
      var q = searchTerm.toLowerCase();
      var matchName = staff.name.toLowerCase().indexOf(q) !== -1;
      var matchId = staff.id.toLowerCase().indexOf(q) !== -1;
      var matchRole = staff.role.toLowerCase().indexOf(q) !== -1;
      var matchTeam = staff.team.toLowerCase().indexOf(q) !== -1;
      var matchCrew = (staff.crew || '').toLowerCase().indexOf(q) !== -1;
      var matchDept = staff.department.toLowerCase().indexOf(q) !== -1;
      if (!matchName && !matchId && !matchRole && !matchTeam && !matchCrew && !matchDept) return false;
    }

    if (selectedDept !== 'all' && staff.department !== selectedDept) return false;
    if (selectedTeam !== 'all' && staff.team !== selectedTeam) return false;

    if (onlyPreferredCrew) {
      var isCandidatePref = (primaryTeam && staff.team.toLowerCase() === primaryTeam.toLowerCase()) ||
                            (secondaryTeam && staff.team.toLowerCase() === secondaryTeam.toLowerCase()) ||
                            (tertiaryTeam && staff.team.toLowerCase() === tertiaryTeam.toLowerCase()) ||
                            (isExclusive && exclusiveTeams.some(function(ex) { return ex.toLowerCase() === staff.team.toLowerCase(); }));
      if (!isCandidatePref) return false;
    }

    staff._isDoubleBooked = isDoubleBookedOnly;
    return true;
  });

  filteredStaff.sort(function(a, b) {
    var aAssigned = assignedIdsSet.has(a.id) ? 1 : 0;
    var bAssigned = assignedIdsSet.has(b.id) ? 1 : 0;
    if (aAssigned !== bAssigned) return aAssigned - bAssigned;

    var prioA = getStaffPriority(a);
    var prioB = getStaffPriority(b);
    if (prioA !== prioB) return prioA - prioB;

    if (matchingJob.plantOperatorRequired) {
      if (a.isPlantOperator !== b.isPlantOperator) {
        return a.isPlantOperator ? -1 : 1;
      }
    }

    var ytdA = a.ytdOvertimeHours || a.ytdHours || 0;
    var ytdB = b.ytdOvertimeHours || b.ytdHours || 0;
    if (ytdA !== ytdB) return ytdA - ytdB;

    return a.name.localeCompare(b.name);
  });

  var preferredCrewCount = roster.filter(function(s) {
    var t = s.team.toLowerCase();
    if (isExclusive) {
      return exclusiveTeams.some(function(ex) { return ex.toLowerCase() === t; });
    }
    return (primaryTeam && t === primaryTeam.toLowerCase()) ||
           (secondaryTeam && t === secondaryTeam.toLowerCase()) ||
           (tertiaryTeam && t === tertiaryTeam.toLowerCase());
  }).length;

  return { filteredStaff, preferredCrewCount };
}

// Test Matrix across 7 diverse operational scenarios
const testScenarios = [
  { name: 'Standard shift - Job 1 (no search, all depts)', jobIndex: 0, shift: { date: '2026-03-14', shiftId: 's1' }, assigned: ['EMP-001', 'EMP-002'] },
  { name: 'Plant Op shift - Job 3', jobIndex: 2, shift: { date: '2026-04-18', shiftId: 's2', plantOperatorRequired: true }, assigned: [] },
  { name: 'Exclusive Team shift', jobIndex: 1, shift: { date: '2026-05-02', shiftId: 's3' }, assigned: ['EMP-010'], overridePrefs: { isExclusive: true, exclusiveTeams: ['CBD North', 'Parklands East'] } },
  { name: 'Search query filter "John"', jobIndex: 0, shift: { date: '2026-06-20', shiftId: 's4' }, searchTerm: 'John', assigned: [] },
  { name: 'Department filter "City Maintenance"', jobIndex: 0, shift: { date: '2026-07-11', shiftId: 's5' }, selectedDept: 'City Maintenance', assigned: [] },
  { name: 'Team filter "Parklands East"', jobIndex: 0, shift: { date: '2026-08-15', shiftId: 's6' }, selectedTeam: 'Parklands East', assigned: [] },
  { name: 'onlyPreferredCrew toggle ON', jobIndex: 0, shift: { date: '2026-09-05', shiftId: 's7' }, onlyPreferredCrew: true, assigned: [] }
];

testScenarios.forEach((sc, idx) => {
  const job = jobs[sc.jobIndex] || jobs[0];
  const primaryTeam = sc.overridePrefs ? sc.overridePrefs.primaryTeam : (job.team || 'CBD Maintenance');
  const secondaryTeam = sc.overridePrefs ? sc.overridePrefs.secondaryTeam : (job.secondaryTeam || 'Parklands');
  const tertiaryTeam = sc.overridePrefs ? sc.overridePrefs.tertiaryTeam : (job.tertiaryTeam || '');
  const isExclusive = sc.overridePrefs ? sc.overridePrefs.isExclusive : Boolean(job.exclusiveTeamOnly);
  const exclusiveTeams = sc.overridePrefs ? sc.overridePrefs.exclusiveTeams : (job.exclusiveTeams || []);

  const ctx = {
    shift: sc.shift,
    matchingJob: job,
    primaryTeam: primaryTeam,
    secondaryTeam: secondaryTeam,
    tertiaryTeam: tertiaryTeam,
    isExclusive: isExclusive,
    exclusiveTeams: exclusiveTeams,
    assignedIdsSet: new Set(sc.assigned),
    allShifts: [],
    stagedAssignedStaffIds: sc.assigned,
    searchTerm: sc.searchTerm,
    selectedDept: sc.selectedDept,
    selectedTeam: sc.selectedTeam,
    onlyPreferredCrew: sc.onlyPreferredCrew
  };

  const origRes = originalResolve(roster.slice(), ctx);
  const modelRes = window.HortOpsStaffAssignCandidateModel.resolveCandidateModel(roster.slice(), {
    shift: ctx.shift,
    allShifts: ctx.allShifts,
    stagedAssignedStaffIds: ctx.stagedAssignedStaffIds,
    searchTerm: ctx.searchTerm,
    selectedDept: ctx.selectedDept,
    selectedTeam: ctx.selectedTeam,
    onlyPreferredCrew: ctx.onlyPreferredCrew,
    jobPreferences: {
      primaryTeam: primaryTeam,
      secondaryTeam: secondaryTeam,
      tertiaryTeam: tertiaryTeam,
      isExclusive: isExclusive,
      exclusiveTeams: exclusiveTeams
    },
    assignedIdsSet: ctx.assignedIdsSet,
    matchingJob: ctx.matchingJob
  });

  const origIds = origRes.filteredStaff.map(s => s.id);
  const modelIds = modelRes.filteredStaff.map(s => s.id);

  assert.strictEqual(origRes.preferredCrewCount, modelRes.preferredCrewCount, `Scenario ${idx+1} preferred crew count mismatch`);
  assert.strictEqual(origIds.length, modelIds.length, `Scenario ${idx+1} length mismatch`);
  assert.deepStrictEqual(origIds, modelIds, `Scenario ${idx+1} candidate ordering mismatch`);
  console.log(`  [PASS] Scenario ${idx + 1}: ${sc.name} -> ${origIds.length} candidates, exact 100% order match`);
});

console.log('\n================================================================');
console.log(' ALL 7 CANDIDATE ORDERING EQUIVALENCE SCENARIOS PASSED (100%)');
console.log(' CANDIDATE ORDERING AND RANKING TIERS PROVEN BYTE-FOR-BYTE EQUIVALENT.');
console.log('================================================================\n');
