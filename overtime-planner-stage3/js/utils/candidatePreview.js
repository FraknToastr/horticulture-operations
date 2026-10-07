// Stage 4C: detached explanations of existing eligibility and ordering; no writes.
(function(root) {
  'use strict';

  function detached(value) {
    if (!value || typeof value !== 'object') return value;
    var copy = Array.isArray(value) ? [] : {};
    Object.keys(value).forEach(function(key) { copy[key] = detached(value[key]); });
    return copy;
  }

  var regularGap = 'Regular-work intervals are unavailable. Rest and fatigue checks cover recorded overtime commitments only; no recorded conflict is not proof of adequate rest.';
  var rankingOrder = [
    'Unassigned before already assigned; qualified before lacking mandatory qualifications.',
    'Active preferred pool match, then team tier: primary, secondary, tertiary, exclusive, other.',
    'Recorded fatigue tier LOW, MODERATE, HIGH, CRITICAL; then fewer consecutive weekends.',
    'Plant-operator preference when enabled on the job (a separate crew requirement).',
    'Existing fair-share score descending, or overtime hours ascending when that calculator is unavailable; then staff name.'
  ];

  function build(input) {
    input = input || {};
    var state = detached(input.state || {});
    var occurrence = detached(input.occurrence || {});
    var job = detached(input.job || (state.jobs || []).find(function(item) { return item.id === occurrence.jobId; }) || {});
    var shifts = detached(input.allShifts || state.allShifts || []);
    var roster = state.staffList || [];
    var assignedIds = (occurrence.assignedStaffIds || []).slice();
    var assignedSet = new Set(assignedIds);
    var engine = root.HortOpsEligibilityEngine;
    var candidateModel = root.HortOpsStaffAssignCandidateModel;
    var qualifications = root.HortOpsQualifications;
    var fatigue = root.HortOpsFatigueEngine;
    var absences = root.HortOpsAbsences || root.HortOpsAbsenceLedger;
    var rules = root.HortOpsPlanningRules;
    var tags = state.poolTags || [];
    var date = occurrence.date || occurrence.shiftDate || (occurrence.shiftId || '').split('@')[1] || '';
    occurrence.date = date;
    var prefs = {
      primaryTeam: job.primaryTeam || job.defaultTeam || job.preferredTeam || '',
      secondaryTeam: job.secondaryTeam || '', tertiaryTeam: job.tertiaryTeam || '',
      isExclusive: !!(job.isExclusiveTeams && job.exclusiveTeams && job.exclusiveTeams.length),
      exclusiveTeams: job.exclusiveTeams || []
    };
    var teamsEnabled = !rules || rules.sectionEnabled(job, 'teams');
    var poolsEnabled = !rules || rules.sectionEnabled(job, 'pools');
    if (rules) prefs = rules.effectivePrefs(job, prefs);
    // Hard restriction context follows the canonical evaluator; ranking preferences
    // intentionally retain the allocation editor's distinct preference contract.
    var effectiveExclusive = !!(occurrence.isExclusive || occurrence.isExclusiveTeams || job.isExclusive || job.isExclusiveTeams);
    if (job.exclusivePoolSource === 'tags' || job.exclusivePoolSource === 'none') effectiveExclusive = false;
    if (job.exclusivePoolSource === 'teams') effectiveExclusive = true;
    if (!teamsEnabled) effectiveExclusive = false;
    var effectiveExclusiveTeams = occurrence.exclusiveTeams && occurrence.exclusiveTeams.length ? occurrence.exclusiveTeams : (job.exclusiveTeams || []);
    var requiredQualifications = Array.isArray(job.requiredQualifications) ? job.requiredQualifications : (occurrence.requiredQualifications || []);
    var plantRequired = !!(job.plantOperatorRequired || occurrence.plantOperatorRequired || occurrence.requiresPlantOperator);
    var canRank = candidateModel && typeof candidateModel.sortCandidates === 'function' && typeof candidateModel.getStaffPriority === 'function';
    var useFairShare = absences && typeof absences.calculateFairShareScore === 'function';
    var eligible = [], excluded = [], assigned = [];

    function messages(codes) {
      return (codes || []).map(function(code) {
        var message = code === 'ALREADY_ASSIGNED_HERE' ? 'Already assigned to this occurrence' :
          code === 'NOT_PLANT_OPERATOR' ? 'Not a plant operator; individual eligibility is separate from crew coverage' :
          (engine && engine.getHumanIneligibleReason ? engine.getHumanIneligibleReason(code) : code);
        return { code: code, message: message };
      });
    }

    function explain(staff) {
      var evaluation = engine && typeof engine.validateEmployeeForOccurrence === 'function' ? engine.validateEmployeeForOccurrence({
        employee: staff, occurrence: occurrence, job: job, allAssignments: shifts,
        currentShiftAssignedIds: assignedIds, absences: state.absences || [], poolTags: tags
      }) : { eligible: false, reasons: ['ELIGIBILITY_ENGINE_UNAVAILABLE'], warnings: [] };
      var qualification = requiredQualifications.length ?
        (qualifications && typeof qualifications.evaluateStaffQualifications === 'function' ?
          qualifications.evaluateStaffQualifications(staff, requiredQualifications, date) :
          { compliant: false, missingCodes: requiredQualifications.slice(), expiredCodes: [], validCodes: [] }) :
        { compliant: true, missingCodes: [], expiredCodes: [], validCodes: [] };
      var fatigueEval = fatigue && typeof fatigue.evaluateStaffFatigue === 'function' ?
        fatigue.evaluateStaffFatigue(staff, shifts, date) :
        { tier: 'CRITICAL', consecutiveWeekends: 0, isHardBlocked: true, message: 'Fatigue engine unavailable' };
      var hours = useFairShare ?
        (typeof staff.ytdOvertimeHours === 'number' ? staff.ytdOvertimeHours : (typeof staff.ytdHours === 'number' ? staff.ytdHours : 0)) :
        (staff.ytdOvertimeHours || staff.ytdHours || 0);
      var hasHours = useFairShare ? (typeof staff.ytdOvertimeHours === 'number' || typeof staff.ytdHours === 'number') : !!(staff.ytdOvertimeHours || staff.ytdHours);
      var storedZero = staff.ytdOvertimeHours === 0 || staff.ytdHours === 0;
      var hoursSource = hours === 0 && storedZero ? 'stored-zero-unverified' : hasHours ? 'stored-hours-unverified' : 'default-zero-unverified';
      var refusalCount = useFairShare && typeof absences.getStaffRefusalCount === 'function' ?
        absences.getStaffRefusalCount(staff.id, state.refusalHistory || [], date) : 0;
      var preferred = !!(poolsEnabled && rules && rules.matches(staff, job.preferredPoolTagIds || [], tags));
      var row = {
        id: staff.id, name: staff.name || staff.id || '', team: staff.team || '', role: staff.role || '',
        eligible: !!evaluation.eligible, assigned: assignedSet.has(staff.id),
        reasons: messages(evaluation.reasons), warnings: messages(evaluation.warnings),
        qualification: detached(qualification), fatigue: detached(fatigueEval),
        ranking: {
          preferredPoolMatch: preferred, teamTier: canRank ? candidateModel.getStaffPriority(staff, prefs) : null,
          teamPreferenceApplied: teamsEnabled, poolPreferenceApplied: poolsEnabled,
          fatigueTier: fatigueEval.tier, consecutiveWeekends: fatigueEval.consecutiveWeekends,
          plantOperator: !!staff.isPlantOperator, plantOperatorPreferenceApplied: !!job.plantOperatorRequired,
          fairShareScore: useFairShare ? absences.calculateFairShareScore(staff, { refusalHistory: state.refusalHistory || [], asOfDate: date }) : null,
          overtimeHours: hours, hoursSource: hoursSource, hoursVerified: false,
          refusalCount: refusalCount, fatiguePenalty: 0,
          mode: useFairShare ? 'fair-share' : 'hours-fallback'
        },
        evidenceGaps: [regularGap, hoursSource === 'stored-zero-unverified' ?
          'Stored zero overtime hours may be an import default and are unverified. Existing ranking uses ' + hours + ' hours.' :
          hoursSource === 'default-zero-unverified' ? 'Overtime-hour facts are missing; existing ranking uses a zero fallback, not verified worked hours.' :
          'Stored overtime hours are an existing ranking input; worked-hour verification is not established. Planned commitments are not verified worked hours.']
      };
      // The existing comparator expects these annotations on detached staff projections.
      staff._lacksQualifications = !qualification.compliant;
      staff._qualEval = detached(qualification);
      staff._fatigueEval = detached(fatigueEval);
      return { row: row, staff: staff };
    }

    var candidates = [];
    roster.forEach(function(staff) {
      var explained = explain(staff);
      if (explained.row.assigned) assigned.push(explained.row);
      else if (!explained.row.eligible) excluded.push(explained.row);
      else candidates.push(explained);
    });
    assignedIds.forEach(function(id) {
      if (!roster.some(function(staff) { return staff.id === id; })) {
        assigned.push({ id: id, name: id, team: '', role: '', assigned: true, eligible: false,
          reasons: messages(['STAFF_NOT_FOUND']), warnings: [], qualification: null, fatigue: null, ranking: null,
          evidenceGaps: ['Assigned workforce record is unavailable.'] });
      }
    });

    if (canRank) {
      var projections = candidates.map(function(item) { return item.staff; });
      candidateModel.sortCandidates(projections, {
        assignedIdsSet: new Set(), prefs: prefs, matchingJob: job, poolTags: tags,
        asOfDate: date, refusalHistory: state.refusalHistory || []
      });
      projections.forEach(function(staff) { eligible.push(candidates.find(function(item) { return item.staff === staff; }).row); });
    } else {
      candidates.forEach(function(item) {
        item.row.eligible = false;
        item.row.reasons.push({ code: 'CANDIDATE_MODEL_UNAVAILABLE', message: 'Existing candidate ordering is unavailable; preview cannot verify ordering' });
        excluded.push(item.row);
      });
    }
    var crewEvaluation = engine && typeof engine.validateCrewForOccurrence === 'function' ? engine.validateCrewForOccurrence({
      occurrence: occurrence, job: job, assignedStaffIds: assignedIds, roster: roster,
      allAssignments: shifts, poolTags: tags, absences: state.absences || []
    }) : { valid: false, issues: [{ code: 'ELIGIBILITY_ENGINE_UNAVAILABLE', message: 'Canonical crew validator is unavailable' }] };
    var plantPresent = assigned.some(function(row) { return row.eligible && row.ranking && row.ranking.plantOperator; });
    var requiredCount = Number(occurrence.crewSize !== undefined ? occurrence.crewSize : job.crewSize) || 0;
    var crewMessages = [];
    if (assignedIds.length < requiredCount) crewMessages.push('Crew has ' + (requiredCount - assignedIds.length) + ' vacancy/vacancies.');
    (crewEvaluation.issues || []).forEach(function(issue) { crewMessages.push(issue.message); });
    if (assigned.some(function(row) { return !row.eligible; })) crewMessages.push('Already assigned staff include current hard-check failures; preview does not remove or replace them.');
    return {
      summary: {
        shiftId: occurrence.shiftId || '', jobId: occurrence.jobId || job.id || '', jobName: occurrence.jobName || job.name || '',
        date: date, startTime: occurrence.startTime, durationHours: occurrence.durationHours,
        crewSize: requiredCount, requiredQualifications: requiredQualifications.slice(), plantOperatorRequired: plantRequired,
        preferredPoolTags: (job.preferredPoolTagIds || []).map(function(id) { return detached(tags.find(function(tag) { return tag.id === id; }) || { id: id, label: id, active: false }); }),
        exclusivePoolTags: (job.exclusivePoolTagIds || []).map(function(id) { return detached(tags.find(function(tag) { return tag.id === id; }) || { id: id, label: id, active: false }); }),
        exclusivePoolSource: job.exclusivePoolSource ? (rules ? rules.source(job) : job.exclusivePoolSource) : (effectiveExclusive ? 'teams' : 'none'),
        staffingSections: { teams: teamsEnabled, pools: poolsEnabled },
        exclusiveTeams: effectiveExclusiveTeams.slice(), preferences: detached(prefs)
      },
      eligible: eligible, excluded: excluded, assigned: assigned,
      crew: { assignedCount: assignedIds.length, requiredCount: requiredCount, vacancies: Math.max(0, requiredCount - assignedIds.length),
        plantOperatorRequired: plantRequired, plantOperatorPresent: plantPresent,
        compliant: assignedIds.length >= requiredCount && crewEvaluation.valid && !assigned.some(function(row) { return !row.eligible; }),
        messages: crewMessages, canonical: detached(crewEvaluation) },
      evidenceGaps: [regularGap, 'Overtime-hour verification and future fairness policies remain unresolved. This preview explains existing ordering and does not promise successful allocation.'],
      rankingOrder: rankingOrder.map(function(text, index) {
        if (index !== 1) return text;
        return (poolsEnabled ? 'Active preferred pool match. ' : 'Staff Pools disabled: tag preferences and restrictions are inactive. ') +
          (teamsEnabled ? 'Then team tier: primary, secondary, tertiary, exclusive, other.' : 'Team Suitability disabled: team preferences and restrictions are inactive; all team tiers are neutral.');
      }),
      rankingFormula: useFairShare ? 'Existing score = round(1000 - 2 × overtime hours + 5 × in-year refusals through occurrence date - 0 fatigue penalty, 2 decimals). Fatigue is compared earlier, separately.' :
        'Existing fallback uses current overtime hours, or the older hours value when current hours are zero or missing, or zero when neither supplies a value. Lower hours come first, then name. No new score is calculated.'
    };
  }

  root.HortOpsCandidatePreview = { build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HortOpsCandidatePreview;
})(typeof window !== 'undefined' ? window : globalThis);
