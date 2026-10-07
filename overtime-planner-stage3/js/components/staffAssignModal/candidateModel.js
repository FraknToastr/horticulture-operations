// Staff Assignment Candidate Model Sub-module (Offline15.1 Architecture Contract Close-Out)
// Pure non-DOM candidate processing: filtering, soft preference ranking (Tiers 1-5), and deterministic sorting.
// Authority Separation: Hard eligibility is strictly delegated to window.HortOpsEligibilityEngine.
if (typeof require !== 'undefined') {
  if (typeof window === 'undefined') {
    global.window = global;
  }
}

window.HortOpsStaffAssignCandidateModel = {
  // Keep array metadata (notably boundary lookup failures) while detaching inputs.
  _allocatorCopy: function(value) {
    if (!value || typeof value !== 'object') return value;
    var copy = Array.isArray(value) ? [] : {}, self = this;
    Object.keys(value).forEach(function(key) { copy[key] = self._allocatorCopy(value[key]); });
    return copy;
  },

  /** Browse every matching staff record, including canonical hard-check failures. */
  resolveAllocatorModel: function(roster, ctx) {
    ctx = this._allocatorCopy(ctx || {});
    var self = this, rules = window.HortOpsPlanningRules, engine = window.HortOpsEligibilityEngine;
    var state = (window.HortOpsApp && window.HortOpsApp.state) || {};
    var shift = ctx.shift || {}, job = ctx.matchingJob || {};
    var tags = ctx.poolTags || this._allocatorCopy(state.poolTags || []);
    var absences = ctx.absences || this._allocatorCopy(state.absences || []);
    var refusalHistory = ctx.refusalHistory || this._allocatorCopy(state.refusalHistory || []);
    var allShifts = ctx.allShifts || [], assigned = ctx.stagedAssignedStaffIds || [];
    var date = shift.date || shift.shiftDate || (shift.shiftId || '').split('@')[1] || '';
    var prefs = ctx.jobPreferences || {
      primaryTeam: job.primaryTeam || job.defaultTeam || job.preferredTeam || '',
      secondaryTeam: job.secondaryTeam || '', tertiaryTeam: job.tertiaryTeam || '',
      isExclusive: !!(job.isExclusiveTeams && (job.exclusiveTeams || []).length), exclusiveTeams: job.exclusiveTeams || []
    };
    if (rules) prefs = rules.effectivePrefs(job, prefs);
    var teamsOn = !rules || rules.sectionEnabled(job, 'teams');
    var poolsOn = !rules || rules.sectionEnabled(job, 'pools');
    var source = rules ? rules.source(job) : (job.exclusivePoolSource || 'none');
    var activeTags = tags.filter(function(tag) { return tag.active; });
    var tagIds = poolsOn ? (source === 'tags' ? job.exclusivePoolTagIds || [] : job.preferredPoolTagIds || []) : [];
    var activeIds = tagIds.filter(function(id) { return activeTags.some(function(tag) { return tag.id === id; }); });
    var exclusiveTeams = shift.exclusiveTeams && shift.exclusiveTeams.length ? shift.exclusiveTeams : (job.exclusiveTeams || []);
    var teamExclusive = teamsOn && (source === 'teams' || (!job.exclusivePoolSource && (shift.isExclusive || shift.isExclusiveTeams || job.isExclusive || job.isExclusiveTeams)));
    var mode = poolsOn && (source === 'tags' || activeIds.length) ? 'pools' :
      teamsOn && (prefs.primaryTeam || prefs.secondaryTeam || prefs.tertiaryTeam || (teamExclusive && exclusiveTeams.length)) ? 'teams' : 'neutral';
    var reqQuals = Array.isArray(job.requiredQualifications) ? job.requiredQualifications : (shift.requiredQualifications || []);
    var query = String(ctx.searchTerm || '').trim().toLowerCase();
    var filtered = this._allocatorCopy(roster || []).filter(function(staff) {
      var memberships = (staff.poolTagIds || []).slice();
      staff._poolLabels = tags.filter(function(tag) { return memberships.indexOf(tag.id) !== -1; }).map(function(tag) { return tag.label; });
      if (query) {
        var fields = [staff.name,staff.id,staff.role,staff.team,staff.crew,staff.department].concat(staff._poolLabels,staff._poolLabels.map(function(label) { return '#' + label; }));
        if (!fields.some(function(field) { return String(field || '').toLowerCase().indexOf(query) !== -1; })) return false;
      }
      if (ctx.selectedDept && ctx.selectedDept !== 'all' && staff.department !== ctx.selectedDept) return false;
      if (ctx.selectedTeam && ctx.selectedTeam !== 'all' && staff.team !== ctx.selectedTeam) return false;
      if (ctx.selectedPoolTag && ctx.selectedPoolTag !== 'all' && memberships.indexOf(ctx.selectedPoolTag) === -1) return false;
      var result = engine && typeof engine.validateEmployeeForOccurrence === 'function' ? engine.validateEmployeeForOccurrence({
        employee: staff, occurrence: shift, job: job, allAssignments: allShifts,
        currentShiftAssignedIds: assigned, poolTags: tags, absences: absences
      }) : { eligible: false, reasons: ['ELIGIBILITY_ENGINE_UNAVAILABLE'], warnings: [], hardBlock: true };
      staff._eligibility = self._allocatorCopy(result);
      staff._eligible = !!result.eligible; staff._isAssigned = assigned.indexOf(staff.id) !== -1;
      staff._priorityTier = self.getStaffPriority(staff, prefs);
      staff._isDoubleBooked = (result.reasons || []).indexOf('OVERLAPPING_SHIFT') !== -1;
      var quals = window.HortOpsQualifications;
      staff._qualEval = reqQuals.length ? (quals && typeof quals.evaluateStaffQualifications === 'function' ?
        quals.evaluateStaffQualifications(staff, reqQuals, date) : { compliant: false, missingCodes: reqQuals.slice(), expiredCodes: [], validCodes: [] }) :
        { compliant: true, missingCodes: [], expiredCodes: [], validCodes: [] };
      staff._lacksQualifications = !staff._qualEval.compliant;
      var fatigue = window.HortOpsFatigueEngine;
      staff._fatigueEval = fatigue && typeof fatigue.evaluateStaffFatigue === 'function' ? fatigue.evaluateStaffFatigue(staff, allShifts, date) :
        { tier: 'CRITICAL', consecutiveWeekends: 0, isHardBlocked: true, message: 'Fatigue engine unavailable' };
      staff._preferenceMatch = mode === 'pools' ? !!(rules && rules.matches(staff, tagIds, tags)) :
        mode === 'teams' ? staff._priorityTier < 5 || (teamExclusive && exclusiveTeams.some(function(team) { return String(team).toLowerCase() === String(staff.team || '').toLowerCase(); })) : staff._eligible;
      return true;
    });
    function sort(group) {
      var ordered = self.sortCandidates(group, { assignedIdsSet: new Set(assigned), prefs: prefs, matchingJob: job,
        poolTags: tags, refusalHistory: refusalHistory, asOfDate: date });
      // Presentation keeps actionable staff ahead of blocked members within each
      // pool/team group; the existing comparator still orders each subset.
      return ordered.filter(function(staff) { return staff._eligible; }).concat(
        ordered.filter(function(staff) { return !staff._eligible; }));
    }
    var matching = sort(filtered.filter(function(staff) { return staff._preferenceMatch; }));
    var other = sort(filtered.filter(function(staff) { return !staff._preferenceMatch; }));
    return {
      filteredStaff: matching.concat(other), matchingStaff: matching, otherStaff: other,
      matchingCount: matching.length, preferredCrewCount: matching.length,
      eligibleCount: filtered.filter(function(staff) { return staff._eligible; }).length,
      blockedCount: filtered.filter(function(staff) { return !staff._eligible; }).length,
      groupMode: mode, groupLabel: mode === 'pools' ? 'Matching pool members' : mode === 'teams' ? 'Matching teams' : 'Eligible staff',
      jobPreferences: this._allocatorCopy(prefs), poolOptions: this._allocatorCopy(activeTags)
    };
  },

  /** Pure staging proposal; save commands remain independently authoritative. */
  selectAutoAddCandidates: function(ctx) {
    ctx = this._allocatorCopy(ctx || {});
    var self = this, roster = ctx.roster || [], shift = ctx.shift || {}, job = ctx.matchingJob || {};
    var original = (ctx.stagedAssignedStaffIds || []).slice(), staged = original.slice(), chosen = [], errors = [];
    var count = Number(shift.crewSize !== undefined ? shift.crewSize : job.crewSize) || 0;
    var engine = window.HortOpsEligibilityEngine;
    var state = (window.HortOpsApp && window.HortOpsApp.state) || {};
    var tags = ctx.poolTags || this._allocatorCopy(state.poolTags || []);
    var absences = ctx.absences || this._allocatorCopy(state.absences || []);
    function evaluate(ids) {
      var failures = [];
      ids.forEach(function(id) {
        var staff = roster.find(function(person) { return person.id === id; });
        var result = engine && typeof engine.validateEmployeeForOccurrence === 'function' ? engine.validateEmployeeForOccurrence({
          employee: staff, occurrence: shift, job: job, allAssignments: ctx.allShifts || [],
          currentShiftAssignedIds: ids, poolTags: tags, absences: absences
        }) : { eligible: false, reasons: ['ELIGIBILITY_ENGINE_UNAVAILABLE'] };
        if (!result.eligible) failures.push({ id: id, reasons: (result.reasons || []).slice() });
      });
      return failures;
    }
    function crew(ids) {
      return engine && typeof engine.validateCrewForOccurrence === 'function' ? engine.validateCrewForOccurrence({
        occurrence: shift, job: job, assignedStaffIds: ids, roster: roster,
        allAssignments: ctx.allShifts || [], poolTags: tags, absences: absences
      }) : { valid: false, hardBlock: true, issues: [{ code: 'ELIGIBILITY_ENGINE_UNAVAILABLE', message: 'Crew validation is unavailable' }] };
    }
    function finish(success, message, ids, selected) {
      return { success: success, selectedIds: selected.slice(), stagedIds: ids.slice(),
        shortage: Math.max(0, count - ids.length), crewValidation: self._allocatorCopy(crew(ids)),
        errors: errors, message: message };
    }
    errors = evaluate(staged);
    if (errors.length) return finish(false, 'Existing staged staff fail current hard checks. Review them before auto-adding.', original, []);
    var browse = this.resolveAllocatorModel(roster, Object.assign({}, ctx, { searchTerm: '', selectedDept: 'all', selectedTeam: 'all', selectedPoolTag: 'all' }));
    var available = browse.filteredStaff.filter(function(staff) { return staff._eligible && !staff._isAssigned; });
    this.sortCandidates(available, { assignedIdsSet: new Set(staged), prefs: browse.jobPreferences, matchingJob: job,
      poolTags: tags, refusalHistory: ctx.refusalHistory || state.refusalHistory || [], asOfDate: shift.date || shift.shiftDate });
    var plantRequired = !!(shift.plantOperatorRequired || shift.requiresPlantOperator || job.plantOperatorRequired);
    var crewHasOperator = staged.some(function(id) { return roster.some(function(staff) { return staff.id === id && staff.isPlantOperator; }); });
    if (plantRequired && !crewHasOperator) {
      var operator = available.find(function(staff) { return staff.isPlantOperator; });
      if (!operator || staged.length >= count) return finish(false, 'An eligible plant operator is required; no safe additions can satisfy this crew.', original, []);
      available = [operator].concat(available.filter(function(staff) { return staff !== operator; }));
    }
    for (var i = 0; i < available.length && staged.length < count; i++) {
      var proposed = staged.concat(available[i].id), failures = evaluate(proposed);
      if (failures.length) { errors = errors.concat(failures); continue; }
      // If an operator is required the first addition supplies it; every stage is
      // crew-validated rather than assuming individual eligibility proves coverage.
      var compliance = crew(proposed);
      if (!compliance.valid) {
        errors.push({ id: available[i].id, reasons: (compliance.issues || []).map(function(issue) { return issue.code; }) });
        continue;
      }
      staged = proposed; chosen.push(available[i].id);
    }
    var finalFailures = evaluate(staged), finalCrew = crew(staged);
    if (finalFailures.length || !finalCrew.valid) {
      errors = errors.concat(finalFailures);
      return finish(false, 'Current hard or crew checks prevent a safe auto-add proposal.', original, []);
    }
    return finish(true, staged.length < count ? (chosen.length ? 'Eligible staff added; some crew vacancies remain.' : 'No eligible additions are available; crew vacancies remain.') :
      chosen.length ? 'Eligible staff added in the current preference order.' : 'No crew vacancies remain.', staged, chosen);
  },

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
    if (prefs.teamsEnabled === false) return 5;
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
    var rules = window.HortOpsPlanningRules;
    var prefs = rules ? rules.effectivePrefs(options.matchingJob, options.jobPreferences) : (options.jobPreferences || {});
    if (prefs.teamsEnabled === false) onlyPreferredCrew = false;
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

    // R55-P1-06: Create shallow-cloned projection to guarantee state.staffList is NEVER mutated
    var candidateProjections = (roster || []).map(function(staff) {
      return Object.assign({}, staff);
    });

    return candidateProjections.filter(function(staff) {
      var isDoubleBookedOnly = false;
      // Preserve the legacy overload for jobs without the optional extension;
      // explicit section settings must be evaluated against their actual job.
      var evalRes = options.matchingJob && options.matchingJob.staffingSections !== undefined ?
        engine.validateStaffEligibility(staff, shift, options.matchingJob, allShifts, stagedAssignedStaffIds) :
        engine.validateStaffEligibility(staff, shift, allShifts, stagedAssignedStaffIds);
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

      // Qualification compliance evaluation (Stage 3 Gate 3B & Review 55 R55-P1-04)
      var matchingJob = options.matchingJob || {};
      var reqQuals = Array.isArray(matchingJob.requiredQualifications) ? matchingJob.requiredQualifications : [];
      var shiftDate = (shift && (shift.date || shift.shiftDate)) || (shift && shift.shiftId && shift.shiftId.split('@')[1]) || (new Date().toISOString().slice(0, 10));
      if (reqQuals.length > 0) {
        if (window.HortOpsQualifications && typeof window.HortOpsQualifications.evaluateStaffQualifications === 'function') {
          var qualEval = window.HortOpsQualifications.evaluateStaffQualifications(staff, reqQuals, shiftDate);
          staff._qualEval = qualEval;
          staff._lacksQualifications = !qualEval.compliant;
        } else {
          // Fail-closed when qualification safety engine is missing
          staff._qualEval = { compliant: false, qualified: false, missingCodes: reqQuals, expiredCodes: [], validCodes: [] };
          staff._lacksQualifications = true;
        }
      } else {
        staff._qualEval = { compliant: true, qualified: true, missingCodes: [], expiredCodes: [], validCodes: [] };
        staff._lacksQualifications = false;
      }

      // Multi-Week Fatigue Risk Evaluation (Stage 3 Gate 3C & Review 55 R55-P1-04)
      if (window.HortOpsFatigueEngine && typeof window.HortOpsFatigueEngine.evaluateStaffFatigue === 'function') {
        var fatigueEval = window.HortOpsFatigueEngine.evaluateStaffFatigue(staff, allShifts, shiftDate);
        staff._fatigueEval = fatigueEval;
      } else {
        // Fail-closed when fatigue engine is missing
        staff._fatigueEval = { tier: 'CRITICAL', consecutiveWeekends: 0, rolling14DaysHours: 0, isHardBlocked: true, message: 'Fatigue engine unavailable' };
      }

      staff._isDoubleBooked = isDoubleBookedOnly;
      return true;
    });
  },

  /**
   * Deterministically sorts filtered candidate list:
   * 1. Unassigned candidates before assigned candidates
   * 2. Qualification Compliance (Fully accredited before lacking tickets)
   * 3. Preference Rank Tiers (Primary -> Secondary -> Tertiary -> Exclusive -> Other)
   * 4. Multi-Week Fatigue Risk (LOW before MODERATE before HIGH before CRITICAL)
   * 5. Certified Plant Operator priority when job requires plant operator
   * 6. YTD Overtime Hours ascending (equal opportunity / lowest hours first)
   * 7. Deterministic tie-breaker: staff name localeCompare
   * @param {Array} candidates - Filtered candidate list
   * @param {Object} options - Sort options { assignedIdsSet, prefs, matchingJob }
   * @returns {Array} Sorted candidates
   */
  sortCandidates: function(candidates, options) {
    options = options || {};
    var assignedIdsSet = options.assignedIdsSet || new Set();
    var prefs = options.prefs || {};
    var matchingJob = options.matchingJob || {};
    var planningRules = window.HortOpsPlanningRules;
    if (planningRules) prefs = planningRules.effectivePrefs(matchingJob, prefs);
    var self = this;

    candidates.sort(function(a, b) {
      var aAssigned = assignedIdsSet.has(a.id) ? 1 : 0;
      var bAssigned = assignedIdsSet.has(b.id) ? 1 : 0;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;

      // Gate 3B: Prioritize fully qualified candidates over those lacking required tickets
      var aQualFail = a._lacksQualifications ? 1 : 0;
      var bQualFail = b._lacksQualifications ? 1 : 0;
      if (aQualFail !== bQualFail) return aQualFail - bQualFail;

      var rules = window.HortOpsPlanningRules;
      if (rules && rules.sectionEnabled(matchingJob, 'pools') && (matchingJob.preferredPoolTagIds || []).length) {
        var tags = options.poolTags || (window.HortOpsApp && window.HortOpsApp.state.poolTags) || [];
        var tagA = rules.matches(a, matchingJob.preferredPoolTagIds, tags) ? 0 : 1;
        var tagB = rules.matches(b, matchingJob.preferredPoolTagIds, tags) ? 0 : 1;
        if (tagA !== tagB) return tagA - tagB;
      }
      var prioA = self.getStaffPriority(a, prefs);
      var prioB = self.getStaffPriority(b, prefs);
      if (prioA !== prioB) return prioA - prioB;

      // Gate 3C: Prioritize lower fatigue tier (LOW -> MODERATE -> HIGH -> CRITICAL)
      if (a._fatigueEval && b._fatigueEval) {
        var tierOrder = { LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };
        var tA = tierOrder[a._fatigueEval.tier] || 5;
        var tB = tierOrder[b._fatigueEval.tier] || 5;
        if (tA !== tB) return tA - tB;

        if (a._fatigueEval.consecutiveWeekends !== b._fatigueEval.consecutiveWeekends) {
          return a._fatigueEval.consecutiveWeekends - b._fatigueEval.consecutiveWeekends;
        }
      }

      if (matchingJob.plantOperatorRequired) {
        if (a.isPlantOperator !== b.isPlantOperator) {
          return a.isPlantOperator ? -1 : 1;
        }
      }

      // Fair-Share Score & Refusal History evaluation (Stage 3 Gate 3E & Review 56 R56-P0-03 & Review 57 R57-P1-04)
      var asOfDate = options.asOfDate || options.shiftDate || (options.shift && (options.shift.date || options.shift.shiftDate)) || null;
      var absencesEngine = (typeof window !== 'undefined' && (window.HortOpsAbsences || window.HortOpsAbsenceLedger)) || (typeof global !== 'undefined' && (global.HortOpsAbsences || global.HortOpsAbsenceLedger));
      var refusalHistory = options.refusalHistory ||
        (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.refusalHistory) ||
        (typeof global !== 'undefined' && global.HortOpsApp && global.HortOpsApp.state && global.HortOpsApp.state.refusalHistory) || [];

      if (absencesEngine && typeof absencesEngine.calculateFairShareScore === 'function') {
        var scoreA = absencesEngine.calculateFairShareScore(a, { refusalHistory: refusalHistory, asOfDate: asOfDate });
        var scoreB = absencesEngine.calculateFairShareScore(b, { refusalHistory: refusalHistory, asOfDate: asOfDate });
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // Higher fair-share priority first
        }
      } else {
        var ytdA = a.ytdOvertimeHours || a.ytdHours || 0;
        var ytdB = b.ytdOvertimeHours || b.ytdHours || 0;
        if (ytdA !== ytdB) return ytdA - ytdB;
      }

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
    if (prefs.teamsEnabled === false) return 0;
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
      jobPreferences: ctx.jobPreferences,
      matchingJob: ctx.matchingJob
    });

    this.sortCandidates(filteredStaff, {
      assignedIdsSet: ctx.assignedIdsSet,
      prefs: ctx.jobPreferences,
      matchingJob: ctx.matchingJob,
      asOfDate: (ctx.shift && (ctx.shift.date || ctx.shift.shiftDate)) || null,
      refusalHistory: ctx.refusalHistory
    });

    var rules = window.HortOpsPlanningRules;
    var preferredCrewCount = this.countPreferredCandidates(roster, rules ? rules.effectivePrefs(ctx.matchingJob, ctx.jobPreferences) : ctx.jobPreferences);

    return {
      filteredStaff: filteredStaff,
      preferredCrewCount: preferredCrewCount
    };
  }
};
