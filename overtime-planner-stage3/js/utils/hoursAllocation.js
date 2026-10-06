// Stage 4D: one-occurrence detached proposal using the owner's explicit hours policy.
(function(root) {
  'use strict';
  function copy(value) {
    if (!value || typeof value !== 'object') return value;
    var result = Array.isArray(value) ? [] : {};
    Object.keys(value).forEach(function(key) { result[key] = copy(value[key]); });
    return result;
  }
  function build(input) {
    var ctx = copy(input || {}), state = ctx.state || {}, target = ctx.occurrence || ctx.shift || {};
    var roster = state.staffList || state.roster || ctx.roster || [];
    var job = ctx.job || ctx.matchingJob || (state.jobs || []).find(function(item) { return item.id === target.jobId; }) || {};
    var shifts = ctx.allShifts || state.allShifts || [];
    var currentDate = ctx.currentDate || (root.HortOpsDateUtils && root.HortOpsDateUtils.getLocalDateKey());
    var evidenceEngine = root.HortOpsHoursEvidence, canonical = root.HortOpsEligibilityEngine;
    var allocator = root.HortOpsStaffAssignCandidateModel;
    var assigned = (ctx.stagedIds || ctx.stagedAssignedStaffIds || target.assignedStaffIds || []).slice();
    var required = Number(target.crewSize !== undefined ? target.crewSize : job.crewSize) || 0;
    var year = Number((target.date || '').slice(0,4));
    var policy = { window: 'calendar_year', year: year, actual: 'operator_verified_year_to_date',
      planned: 'saved_future_commitments', normalization: 'none', refusalBonus: false,
      precedence: 'existing_pool_team_fatigue_then_hours', regularHoursIncluded: false };
    var messages = ['Actual hours are an operator verification claim from the stated source, not automatic payroll verification.',
      'This draft uses overtime commitments for current safety checks. Regular working hours are excluded from this mode.',
      'Unknown hours are excluded from hours comparisons. Manual allocation remains subject to the current safety checks.'];
    var errors = [], unknownByStaff = Object.create(null), plannedByStaff = Object.create(null), earliestByStaff = Object.create(null);
    function unknown(id, code, message) {
      if (!unknownByStaff[id]) unknownByStaff[id] = [];
      if (!unknownByStaff[id].some(function(reason) { return reason.code === code; })) unknownByStaff[id].push({ code: code, message: message });
    }
    function crew(ids, staff) {
      return canonical && typeof canonical.validateCrewForOccurrence === 'function' ? canonical.validateCrewForOccurrence({
        occurrence: target, job: job, assignedStaffIds: ids, roster: staff || roster, allAssignments: shifts,
        poolTags: state.poolTags || ctx.poolTags || [], absences: state.absences || ctx.absences || []
      }) : { valid: false, issues: [{ code: 'ELIGIBILITY_ENGINE_UNAVAILABLE', message: 'Canonical crew validation is unavailable.' }] };
    }
    if (!evidenceEngine || !evidenceEngine.isRealDate(currentDate) || !evidenceEngine.isRealDate(target.date) || target.date < currentDate) {
      errors.push('Hours-aware proposals require a current or future canonical occurrence and a real current date.');
    }
    if (!allocator || typeof allocator.selectAutoAddCandidates !== 'function' || typeof allocator.resolveAllocatorModel !== 'function' || !canonical) {
      errors.push('Current allocation and eligibility engines are required for an hours-aware draft.');
    }

    // Canonical digests have one occurrence per shiftId. Duplicate identical timeline
    // entries count once; conflicting duplicates remain unknown rather than guessed.
    var timeline = [], byId = Object.create(null);
    shifts.forEach(function(shift) {
      if (!shift || !shift.shiftId) return;
      var ids = shift.shiftId === target.shiftId ? assigned.slice() : (shift.assignedStaffIds || []).slice();
      var item = Object.assign({}, shift, { assignedStaffIds: ids });
      var previous = byId[shift.shiftId];
      if (previous) {
        var same = previous.date === item.date && previous.durationHours === item.durationHours &&
          previous.startTime === item.startTime && JSON.stringify(previous.assignedStaffIds.slice().sort()) === JSON.stringify(ids.slice().sort());
        if (!same) {
          previous._hoursConflict = true;
          previous.assignedStaffIds = Array.from(new Set(previous.assignedStaffIds.concat(ids)));
        }
        return;
      }
      byId[shift.shiftId] = item; timeline.push(item);
    });
    if (target.shiftId && !byId[target.shiftId]) {
      var targetProjection = Object.assign({}, target, { assignedStaffIds: assigned.slice() });
      byId[target.shiftId] = targetProjection; timeline.push(targetProjection);
    }
    if (shifts.lookupFailed) timeline.lookupFailed = true;
    shifts = timeline;

    timeline.forEach(function(shift) {
      var date = shift.date || '', ids = shift.assignedStaffIds || [];
      if (!evidenceEngine || !evidenceEngine.isRealDate(date)) {
        ids.forEach(function(id) { unknown(id, 'PLANNED_TIMING_UNKNOWN', 'A saved commitment has an unresolved calendar date.'); });
        return;
      }
      if (Number(date.slice(0,4)) !== year || date < currentDate) return;
      ids = Array.from(new Set(ids));
      var validDuration = typeof shift.durationHours === 'number' && Number.isFinite(shift.durationHours) && shift.durationHours > 0;
      ids.forEach(function(id) {
        if (shift._hoursConflict || shift.unverifiedSchedule || !validDuration) {
          unknown(id, 'PLANNED_HOURS_UNKNOWN', 'Saved future commitment hours are unavailable or conflicting.');
          return;
        }
        plannedByStaff[id] = (plannedByStaff[id] || 0) + shift.durationHours;
        if (!earliestByStaff[id] || date < earliestByStaff[id]) earliestByStaff[id] = date;
      });
    });

    // A raw assignment reference cannot be silently dropped merely because its
    // job is inactive, deleted, or no longer generates that saved occurrence.
    var assignmentMap = state.assignments || state.customAssignments || {};
    Object.keys(assignmentMap).forEach(function(key) {
      var ids = assignmentMap[key];
      if (!Array.isArray(ids) || !ids.length) return;
      var resolved = timeline.find(function(shift) {
        return key === shift.shiftId || key === shift.jobId + '_' + shift.date || key === shift.jobId + '-w' + shift.weekNumber + '-' + shift.date;
      });
      if (resolved) {
        if (resolved.shiftId === target.shiftId) return; // Explicit staged override is the target draft.
        var resolvedDate = resolved.date || '';
        if (Number(resolvedDate.slice(0,4)) !== year || resolvedDate < currentDate) return;
        ids.forEach(function(id) {
          if ((resolved.assignedStaffIds || []).indexOf(id) === -1) unknown(id, 'PLANNED_ASSIGNMENT_UNRESOLVED', 'Saved assignment references disagree with the canonical commitment timeline.');
        });
        return;
      }
      var dateMatch = /(\d{4}-\d{2}-\d{2})$/.exec(key);
      if (dateMatch && evidenceEngine && evidenceEngine.isRealDate(dateMatch[1])) {
        if (Number(dateMatch[1].slice(0,4)) !== year || dateMatch[1] < currentDate) return;
      }
      ids.forEach(function(id) { unknown(id, 'PLANNED_ASSIGNMENT_UNRESOLVED', 'A saved assignment cannot be resolved to a canonical future occurrence.'); });
    });

    var rows = roster.map(function(staff) {
      var evidence = evidenceEngine ? evidenceEngine.latest(staff.overtimeHoursEvidence, year) : null;
      if (!evidence) unknown(staff.id, 'VERIFIED_ACTUAL_HOURS_UNKNOWN', 'No valid operator-verified hours evidence exists for this calendar year. Stored YTD values and import defaults are not verified evidence.');
      if (evidence && evidence.throughDate > currentDate) unknown(staff.id, 'ACTUAL_COVERAGE_FUTURE', 'Actual hours evidence covers a future date and cannot be used in this draft.');
      var planned = plannedByStaff[staff.id] || 0;
      if (evidence && earliestByStaff[staff.id] && evidence.throughDate >= earliestByStaff[staff.id]) unknown(staff.id, 'ACTUAL_PLANNED_OVERLAP', 'Actual evidence coverage overlaps saved future commitments. An aggregate total cannot establish that these hours are distinct.');
      var actual = evidence ? evidence.hours : null;
      var warnings = [];
      if (evidence && evidence.throughDate < currentDate) warnings.push('Actual hours cover 1 January through ' + evidence.throughDate + '; later actual work is not established by that evidence.');
      var check = canonical && typeof canonical.validateEmployeeForOccurrence === 'function' ? canonical.validateEmployeeForOccurrence({
        employee: staff, occurrence: target, job: job, allAssignments: shifts,
        currentShiftAssignedIds: assigned, poolTags: state.poolTags || ctx.poolTags || [], absences: state.absences || ctx.absences || []
      }) : { eligible: false, reasons: ['ELIGIBILITY_ENGINE_UNAVAILABLE'], warnings: [] };
      var hasUnknown = !!(unknownByStaff[staff.id] || []).length;
      var canonicalReasons = (check.reasons || []).map(function(code) { return { code: code,
        message: canonical && canonical.getHumanIneligibleReason ? canonical.getHumanIneligibleReason(code) : code }; });
      return { id: staff.id, name: staff.name || staff.id, team: staff.team || '', assigned: assigned.indexOf(staff.id) !== -1,
        eligible: !!check.eligible, comparable: !!check.eligible && !hasUnknown,
        actualHours: actual, plannedHours: unknownByStaff[staff.id] && unknownByStaff[staff.id].some(function(reason) { return /^PLANNED_/.test(reason.code); }) ? null : planned,
        baseHours: hasUnknown ? null : actual + planned, projectedHours: hasUnknown ? null : actual + planned,
        unknown: hasUnknown, reasons: canonicalReasons.concat(copy(unknownByStaff[staff.id] || [])),
        warnings: warnings, evidence: copy(evidence), selected: false };
    });
    assigned.forEach(function(id) {
      var row = rows.find(function(item) { return item.id === id; });
      if (!row || row.unknown) errors.push('Already staged staff include unknown verified hours (' + id + '). Hours-aware proposal cannot proceed; manual allocation remains available.');
    });
    var targetDurationKnown = typeof target.durationHours === 'number' && Number.isFinite(target.durationHours) && target.durationHours > 0 && !target.unverifiedSchedule;
    if (!targetDurationKnown) errors.push('The target occurrence duration is unknown; projected hours cannot be calculated.');
    var proposal = { success: false, selectedIds: [], stagedIds: assigned.slice(), shortage: Math.max(0, required - assigned.length), crewValidation: crew(assigned) };
    if (!errors.length) {
      var knownRoster = roster.filter(function(staff) { return rows.some(function(row) { return row.id === staff.id && !row.unknown; }); }).map(function(staff) {
        var row = rows.find(function(item) { return item.id === staff.id; });
        var detached = copy(staff);
        detached.ytdOvertimeHours = row.baseHours; detached.ytdHours = row.baseHours;
        return detached;
      });
      var allocatorContext = { roster: knownRoster, shift: target, matchingJob: job,
        allShifts: shifts, stagedAssignedStaffIds: assigned, poolTags: state.poolTags || ctx.poolTags || [],
        absences: state.absences || ctx.absences || [], refusalHistory: [] };
      var ordered = allocator.resolveAllocatorModel(knownRoster, allocatorContext);
      var sorted = ordered.filteredStaff.slice();
      allocator.sortCandidates(sorted, { assignedIdsSet: new Set(assigned), prefs: ordered.jobPreferences,
        matchingJob: job, poolTags: allocatorContext.poolTags, refusalHistory: [], asOfDate: target.date });
      var order = sorted.map(function(staff) { return staff.id; });
      rows.sort(function(a,b) {
        var indexA = order.indexOf(a.id), indexB = order.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return String(a.name).localeCompare(String(b.name));
        if (indexA === -1) return 1; if (indexB === -1) return -1;
        return indexA - indexB;
      });
      proposal = allocator.selectAutoAddCandidates(allocatorContext);
      (proposal.selectedIds || []).forEach(function(id) {
        var row = rows.find(function(item) { return item.id === id; });
        if (row) { row.selected = true; row.projectedHours = row.baseHours + target.durationHours; }
      });
      if (proposal.message) messages.push(proposal.message);
    }
    messages = messages.concat(errors);
    return { success: !errors.length && !!proposal.success, selectedIds: (proposal.selectedIds || []).slice(),
      stagedIds: (proposal.stagedIds || assigned).slice(), staffRows: rows,
      shortage: proposal.shortage !== undefined ? proposal.shortage : Math.max(0, required - assigned.length),
      messages: messages, policy: policy, crewValidation: copy(proposal.crewValidation), errors: copy(proposal.errors || []),
      regularHoursIncluded: false };
  }
  root.HortOpsHoursAllocation = { build: build };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.HortOpsHoursAllocation;
})(typeof window !== 'undefined' ? window : globalThis);
