// Staff Assignment Candidate Model Sub-module (Offline15.1 Architecture Contract Close-Out)
// Pure non-DOM candidate processing: filtering, soft preference ranking (Tiers 1-5), and deterministic sorting.
// Authority Separation: Hard eligibility is strictly delegated to window.HortOpsEligibilityEngine.
if (typeof require !== 'undefined') {
  if (typeof window === 'undefined') {
    global.window = global;
  }
}

window.HortOpsStaffAssignCandidateModel = {
  /**
   * Calculates soft preference rank tier for an employee based on job team preferences:
   * Tier 1 = Primary Team
   * Tier 2 = Secondary Team
   * Tier 3 = Tertiary Team
   * Tier 4 = Other Exclusive Team (if job has exclusive teams configured)
   * Tier 5 = Regular / Other
   * @param {Object} staff - Staff member record
   * @param {Object} prefs - Job preference settings { primaryTeam, secondaryTeam, tertiaryTeam, isExclusive, exclusiveTeams }
   * @returns {number} Rank tier 1-5
   */
  getStaffPriority: function(staff, prefs) {
    if (!staff || !staff.team) return 5;
    prefs = prefs || {};
    var t = staff.team.toLowerCase();
    var primaryTeam = prefs.primaryTeam;
    var secondaryTeam = prefs.secondaryTeam;
    var tertiaryTeam = prefs.tertiaryTeam;
    var isExclusive = prefs.isExclusive;
    var exclusiveTeams = prefs.exclusiveTeams || [];

    if (primaryTeam && t === primaryTeam.toLowerCase()) return 1;
    if (secondaryTeam && t === secondaryTeam.toLowerCase()) return 2;
    if (tertiaryTeam && t === tertiaryTeam.toLowerCase()) return 3;
    if (isExclusive && exclusiveTeams.some(function(ex) { return ex.toLowerCase() === t; })) return 4;
    return 5;
  },

  /**
   * Filters candidates from roster based on eligibility, search query, department, team, and preferred crew toggles.
   * Hard eligibility MUST fail closed if window.HortOpsEligibilityEngine is unavailable.
   * @param {Array} roster - Complete workforce list
   * @param {Object} options - Filter context options
   * @returns {Array} Filtered candidate staff members
   */
  filterCandidates: function(roster, options) {
    options = options || {};
    var shift = options.shift;
    var allShifts = options.allShifts || [];
    var stagedAssignedStaffIds = options.stagedAssignedStaffIds || [];
    var searchTerm = options.searchTerm;
    var selectedDept = options.selectedDept || 'all';
    var selectedTeam = options.selectedTeam || 'all';
    var onlyPreferredCrew = options.onlyPreferredCrew;
    var prefs = options.jobPreferences || {};
    var primaryTeam = prefs.primaryTeam;
    var secondaryTeam = prefs.secondaryTeam;
    var tertiaryTeam = prefs.tertiaryTeam;
    var isExclusive = prefs.isExclusive;
    var exclusiveTeams = prefs.exclusiveTeams || [];

    var engine = window.HortOpsEligibilityEngine;
    // Fail closed: if canonical eligibility engine is missing, no candidates are eligible
    if (!engine || typeof engine.validateStaffEligibility !== 'function') {
      console.warn('Eligibility engine unavailable: window.HortOpsEligibilityEngine is required');
      return [];
    }

    return (roster || []).filter(function(staff) {
      var isDoubleBookedOnly = false;
      var evalRes = engine.validateStaffEligibility(staff, shift, allShifts, stagedAssignedStaffIds);
      if (!evalRes.eligible) {
        if (evalRes.reasons.length === 1 && evalRes.reasons[0] === 'OVERLAPPING_SHIFT') {
          isDoubleBookedOnly = true;
        } else {
          return false;
        }
      }

      // Search matching across name, id, role, team, crew, department
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

      // Department & Team slicers
      if (selectedDept !== 'all' && staff.department !== selectedDept) return false;
      if (selectedTeam !== 'all' && staff.team !== selectedTeam) return false;

      // Preferred Crew Toggle
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
  },

  /**
   * Deterministically sorts filtered candidate list:
   * 1. Unassigned candidates before assigned candidates
   * 2. Preference Rank Tiers (Primary -> Secondary -> Tertiary -> Exclusive -> Other)
   * 3. Certified Plant Operator priority when job requires plant operator
   * 4. YTD Overtime Hours ascending (equal opportunity / lowest hours first)
   * 5. Deterministic tie-breaker: staff name localeCompare
   * @param {Array} candidates - Filtered candidate list
   * @param {Object} options - Sort options { assignedIdsSet, prefs, matchingJob }
   * @returns {Array} Sorted candidates
   */
  sortCandidates: function(candidates, options) {
    options = options || {};
    var assignedIdsSet = options.assignedIdsSet || new Set();
    var prefs = options.prefs || {};
    var matchingJob = options.matchingJob || {};
    var self = this;

    candidates.sort(function(a, b) {
      var aAssigned = assignedIdsSet.has(a.id) ? 1 : 0;
      var bAssigned = assignedIdsSet.has(b.id) ? 1 : 0;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;

      var prioA = self.getStaffPriority(a, prefs);
      var prioB = self.getStaffPriority(b, prefs);
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

    return candidates;
  },

  /**
   * Counts the total number of candidates in the workforce belonging to preferred/exclusive teams.
   * @param {Array} roster - Complete workforce list
   * @param {Object} prefs - Job preference settings
   * @returns {number} Preferred candidate count
   */
  countPreferredCandidates: function(roster, prefs) {
    prefs = prefs || {};
    var isExclusive = prefs.isExclusive;
    var exclusiveTeams = prefs.exclusiveTeams || [];
    var primaryTeam = prefs.primaryTeam;
    var secondaryTeam = prefs.secondaryTeam;
    var tertiaryTeam = prefs.tertiaryTeam;

    return (roster || []).filter(function(s) {
      var t = s.team.toLowerCase();
      if (isExclusive) {
        return exclusiveTeams.some(function(ex) { return ex.toLowerCase() === t; });
      }
      return (primaryTeam && t === primaryTeam.toLowerCase()) ||
             (secondaryTeam && t === secondaryTeam.toLowerCase()) ||
             (tertiaryTeam && t === tertiaryTeam.toLowerCase());
    }).length;
  },

  /**
   * High-level candidate resolution helper combining filtering, sorting, and preferred counts.
   * @param {Array} roster - Complete workforce list
   * @param {Object} ctx - Resolution context
   * @returns {Object} { filteredStaff, preferredCrewCount }
   */
  resolveCandidateModel: function(roster, ctx) {
    var filteredStaff = this.filterCandidates(roster, {
      shift: ctx.shift,
      allShifts: ctx.allShifts,
      stagedAssignedStaffIds: ctx.stagedAssignedStaffIds,
      searchTerm: ctx.searchTerm,
      selectedDept: ctx.selectedDept,
      selectedTeam: ctx.selectedTeam,
      onlyPreferredCrew: ctx.onlyPreferredCrew,
      jobPreferences: ctx.jobPreferences
    });

    this.sortCandidates(filteredStaff, {
      assignedIdsSet: ctx.assignedIdsSet,
      prefs: ctx.jobPreferences,
      matchingJob: ctx.matchingJob
    });

    var preferredCrewCount = this.countPreferredCandidates(roster, ctx.jobPreferences);

    return {
      filteredStaff: filteredStaff,
      preferredCrewCount: preferredCrewCount
    };
  }
};
