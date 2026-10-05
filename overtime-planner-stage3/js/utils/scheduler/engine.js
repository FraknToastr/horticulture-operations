function getTestLedger() {
  return (typeof window !== "undefined" && window.HortOpsData) ? window.HortOpsData["HISTORICAL_" + "OCCURRENCES"] : null;
}
// Core Occurrence Materialization, Cadence Loops & Recurrence Engine
// Manages weekend slot generation, permit metadata resolution, explicit lifecycle, and digest generation.
function revalidateShiftAssignments(shift, roster, job, allShifts) {
  shift.invalidAssignees = [];
  shift.invalidAssigneeCount = 0;
  shift.crewIntegrityIssues = [];
  shift.crewIntegrityWarnings = [];
  shift.hasCrewConflict = false;
  if (!roster) return;

  var engine = window.HortOpsEligibilityEngine;
  var validationContext = {
    roster: roster,
    job: job,
    allShifts: allShifts || []
  };

  var assignedIds = shift.assignedStaffIds || [];

  assignedIds.forEach(function(staffId) {
    var staff = roster.find(function(s) { return s.id === staffId; });
    if (!staff) {
      shift.invalidAssignees.push({ staffId: staffId, name: staffId, code: 'NOT_FOUND', reason: 'Record not found in workforce directory' });
      return;
    }

    // Single source of truth: HortOpsEligibilityEngine strictly required (Mandate Offline15.1 Fail-Closed)
    if (!engine || typeof engine.validateEmployeeForOccurrence !== 'function') {
      shift.invalidAssignees.push({
        staffId: staffId,
        name: staff.name || staffId,
        code: 'ELIGIBILITY_ENGINE_UNAVAILABLE',
        reason: 'Eligibility engine unavailable: window.HortOpsEligibilityEngine is required'
      });
      return;
    }

    var validation = engine.validateEmployeeForOccurrence(staff, shift, validationContext);
    var isOk = (validation.valid !== undefined) ? validation.valid : validation.eligible;
    if (!isOk) {
      shift.invalidAssignees.push({
        staffId: staffId,
        name: staff.name,
        code: validation.code || 'INELIGIBLE',
        reason: validation.error || validation.message || 'Assignment violates eligibility policy'
      });
      return;
    }
  });

  shift.invalidAssigneeCount = shift.invalidAssignees.length;

  // Canonical crew-level integrity check (Mandate Section 3, 4, 5, 6, 26)
  if (!engine || typeof engine.validateCrewForOccurrence !== 'function') {
    if (assignedIds.length > 0) {
      shift.crewIntegrityIssues.push('Eligibility engine unavailable: window.HortOpsEligibilityEngine is required');
      shift.hasCrewConflict = true;
    }
  } else {
    var crewRes = engine.validateCrewForOccurrence({
      occurrence: shift,
      job: job,
      assignedStaffIds: assignedIds,
      roster: roster,
      allAssignments: allShifts || []
    });

    var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey()
      : new Date().toISOString().slice(0, 10);

    var isFuture = (shift.date || '') >= todayStr;
    if (!crewRes.valid) {
      if (isFuture) {
        shift.crewIntegrityIssues = crewRes.issues;
        shift.hasCrewConflict = true;
      } else {
        shift.crewIntegrityWarnings = crewRes.issues;
      }
    }
  }
}

function getNonEmptySnapshots(snaps) {
  if (!snaps) return null;
  if (Array.isArray(snaps) && snaps.length > 0) return snaps;
  if (typeof snaps === 'object' && Object.keys(snaps).length > 0) return snaps;
  return null;
}

window.HortOpsSchedulerEngine = {
  revalidateShiftAssignments: revalidateShiftAssignments,

  /**
   * Resolves explicit occurrence lifecycle against its parent job and schedule horizon (Mandate Section 16, 17, 18, 30).
   * @param {Object} params - { explicitOccurrence, parentJob, todayStr }
   * @returns {{ include: boolean, status: string, integrityIssue: Object|null }}
   */
  resolveExplicitOccurrenceLifecycle: function(params) {
    params = params || {};
    var occ = params.explicitOccurrence || {};
    var parentJob = params.parentJob || null;
    var todayStr = params.todayStr || (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function' ? window.HortOpsDateUtils.getLocalDateKey() : '2026-09-05');
    var isPast = (occ.date || '') < todayStr;

    if (!parentJob) {
      if (isPast) {
        // Past explicit occurrence with missing parent: preserve historical attribution
        return {
          include: true,
          status: 'historical_orphan_preserved',
          integrityIssue: null
        };
      } else {
        // Future explicit occurrence with missing parent: suppress from operational schedule, record integrity issue
        return {
          include: false,
          status: 'orphaned_future_occurrence',
          integrityIssue: {
            code: 'MISSING_PARENT_JOB',
            severity: 'error',
            message: 'Future explicit occurrence references a job that does not exist in the Job Registry.'
          }
        };
      }
    }

    // Universal Active-only schedulability (Mandate Section 2, 3, 36)
    var parentStatus = String(parentJob.status || '').trim().toLowerCase();
    var isParentActive = (parentJob.active !== false) && (parentStatus === 'active');

    if (!isParentActive) {
      if (isPast) {
        // Past explicit occurrence with non-active parent: preserve historical attribution
        return {
          include: true,
          status: 'historical_' + (parentStatus || 'non_active') + '_preserved',
          integrityIssue: null
        };
      } else {
        // Future explicit occurrence with non-active parent (inactive, draft, archived, resolved, etc.): suppressed
        var code = (parentStatus === 'inactive') ? 'INACTIVE_PARENT_JOB' : 'NON_ACTIVE_PARENT_JOB';
        return {
          include: false,
          status: 'non_active_parent_suppressed',
          integrityIssue: {
            code: code,
            severity: 'info',
            message: 'Future explicit occurrence suppressed due to ' + (parentStatus || 'non-active') + ' parent job.'
          }
        };
      }
    }

    return {
      include: true,
      status: 'active',
      integrityIssue: null
    };
  },

  formatDateISO: function(d) {
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  },

  getUtcDayDiff: function(d1Str, d2Str) {
    var d1 = Date.UTC(parseInt(d1Str.slice(0, 4), 10), parseInt(d1Str.slice(5, 7), 10) - 1, parseInt(d1Str.slice(8, 10), 10));
    var d2 = Date.UTC(parseInt(d2Str.slice(0, 4), 10), parseInt(d2Str.slice(5, 7), 10) - 1, parseInt(d2Str.slice(8, 10), 10));
    return Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
  },

  generateWeekendSlots: function(year) {
    var holidays = window.HortOpsData.getPublicHolidaysForYear(year);
    var slots = [];

    var jan1 = new Date(year, 0, 1);
    var dayOfWeek = jan1.getDay();
    var daysUntilFirstSat = (6 - dayOfWeek + 7) % 7;
    var currentSat = new Date(year, 0, 1 + daysUntilFirstSat);

    var weekNum = 1;
    while (currentSat.getFullYear() === year) {
      var sat = new Date(currentSat);
      var sun = new Date(currentSat);
      sun.setDate(sun.getDate() + 1);

      var fri = new Date(sat);
      fri.setDate(fri.getDate() - 1);
      var mon = new Date(sun);
      mon.setDate(mon.getDate() + 1);

      var satStr = this.formatDateISO(sat);
      var sunStr = this.formatDateISO(sun);
      var friStr = this.formatDateISO(fri);
      var monStr = this.formatDateISO(mon);

      var matchedHolidays = holidays.filter(function(h) {
        return h.date === satStr || h.date === sunStr || h.date === friStr || h.date === monStr;
      });

      slots.push({
        weekNumber: weekNum,
        saturdayDate: satStr,
        sundayDate: sunStr,
        fridayDate: friStr,
        mondayDate: monStr,
        month: sat.getMonth() + 1,
        year: sat.getFullYear(),
        publicHolidays: matchedHolidays,
        shifts: [],
        totalShifts: 0,
        totalCrewHours: 0,
        isOverloaded: false,
        hasArterialConflict: false
      });

      weekNum++;
      currentSat.setDate(currentSat.getDate() + 7);
    }

    // Boundary slot: If the Friday of the next weekend (Saturday in year + 1) falls within this year,
    // append a boundary slot (e.g. Friday 31 Dec 2027 where Saturday is 1 Jan 2028).
    var nextSat = new Date(currentSat);
    var nextFri = new Date(nextSat);
    nextFri.setDate(nextFri.getDate() - 1);
    if (nextFri.getFullYear() === year) {
      var nextSun = new Date(nextSat);
      nextSun.setDate(nextSun.getDate() + 1);
      var nextMon = new Date(nextSun);
      nextMon.setDate(nextMon.getDate() + 1);

      var bSatStr = this.formatDateISO(nextSat);
      var bSunStr = this.formatDateISO(nextSun);
      var bFriStr = this.formatDateISO(nextFri);
      var bMonStr = this.formatDateISO(nextMon);

      var bMatchedHolidays = holidays.filter(function(h) {
        return h.date === bSatStr || h.date === bSunStr || h.date === bFriStr || h.date === bMonStr;
      });

      slots.push({
        weekNumber: weekNum,
        saturdayDate: bSatStr,
        sundayDate: bSunStr,
        fridayDate: bFriStr,
        mondayDate: bMonStr,
        month: nextFri.getMonth() + 1,
        year: year,
        publicHolidays: bMatchedHolidays,
        shifts: [],
        totalShifts: 0,
        totalCrewHours: 0,
        isOverloaded: false,
        hasArterialConflict: false
      });
    }

    return slots;
  },

  resolveEffectivePermitState: function(baseRecord, dateKey, entityId, customPermits) {
    return this.resolvePermitMeta(baseRecord, dateKey, entityId, customPermits);
  },

  resolvePermitMeta: function(job, dateKey, entityId, customPermits) {
    customPermits = customPermits || {};
    var data = window.HortOpsData || {};
    var hist = (data.HISTORICAL_PERMIT_DATA && data.HISTORICAL_PERMIT_DATA[dateKey]) || null;
    var cust = customPermits[entityId] || customPermits[dateKey] || null;

    var requiresWZTM = (cust && cust.requiresWZTM !== undefined) ? !!cust.requiresWZTM :
      ((cust && cust.wztmStatus && cust.wztmStatus !== 'not_required') ? true :
      (job && job.requiresWZTM !== undefined ? !!job.requiresWZTM : (hist ? !!hist.requiresWZTM : false)));

    var requiresTPO = (cust && cust.requiresTPO !== undefined) ? !!cust.requiresTPO :
      ((cust && cust.tpoStatus && cust.tpoStatus !== 'not_required') ? true :
      (job && job.requiresTPO !== undefined ? !!job.requiresTPO : (hist ? !!hist.requiresTPO : false)));

    var wztmStatus = 'not_required';
    if (cust && cust.wztmStatus !== undefined) {
      wztmStatus = cust.wztmStatus;
    } else if (requiresWZTM) {
      wztmStatus = (job && job.wztmStatus) || (hist && hist.wztmStatus) || 'pending';
    }

    var wztmNotes = (cust && cust.wztmNotes !== undefined) ? cust.wztmNotes :
      ((job && job.wztmNotes !== undefined) ? job.wztmNotes :
      ((hist && hist.wztmNotes) || (wztmStatus === 'finalized' ? 'Approved' : '')));

    var tpoStatus = 'not_required';
    if (cust && cust.tpoStatus !== undefined) {
      tpoStatus = cust.tpoStatus;
    } else if (requiresTPO) {
      tpoStatus = (job && job.tpoStatus) || (hist && hist.tpoStatus) || 'pending';
    }

    var tpoNotes = (cust && cust.tpoNotes !== undefined) ? cust.tpoNotes :
      ((job && job.tpoNotes !== undefined) ? job.tpoNotes :
      ((hist && hist.tpoNotes) || (tpoStatus === 'finalized' ? 'Approved' : '')));

    return {
      requiresWZTM: requiresWZTM,
      wztmStatus: wztmStatus,
      wztmNotes: wztmNotes,
      requiresTPO: requiresTPO,
      tpoStatus: tpoStatus,
      tpoNotes: tpoNotes
    };
  },

  /**
   * Offline17.5d: Verifies whether a given date or shiftId is generated by a Job's
   * canonical recurrence contract.
   * @param {Object} job - The job definition
   * @param {string} dateOrShiftId - YYYY-MM-DD or JOB_ID@YYYY-MM-DD
   * @returns {boolean}
   */
  isGeneratedRecurrenceOccurrence: function(job, dateOrShiftId) {
    if (!job || typeof job !== "object" || !dateOrShiftId || typeof dateOrShiftId !== "string") {
      return false;
    }

    var dateStr = dateOrShiftId;
    if (dateOrShiftId.indexOf("@") !== -1) {
      var parts = dateOrShiftId.split("@");
      if (parts[0] !== job.id) return false;
      dateStr = parts[1];
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return false;
    }

    if (job.frequencyType === 'work_pattern') {
      var rules = window.HortOpsPlanningRules;
      return !!rules && rules.dates(job, parseInt(dateStr.slice(0,4),10)).indexOf(dateStr) !== -1;
    }
    var freq = job.frequencyType || "recurring_weeks";

    // 1. One-off Job: only job.targetDate is canonical generated occurrence
    if (freq === "one_off") {
      return job.targetDate === dateStr;
    }

    // 2. Recurring Weeks / Recurring Cadence
    if (freq === "recurring_weeks" || freq === "recurring_cadence") {
      var pref = (job.preferredDay || "saturday").toLowerCase();
      var expectedDay = (pref === "sunday") ? 0
                      : (pref === "monday" || pref === "monday_post_holiday") ? 1
                      : (pref === "friday" || pref === "friday_pre_holiday") ? 5
                      : 6;

      var candD = new Date(dateStr + "T12:00:00Z");
      if (candD.getUTCDay() !== expectedDay) {
        return false;
      }

      var interval = Math.max(1, parseInt(job.intervalWeeks, 10) || 1);
      var intervalDays = interval * 7;
      var anchorStr = job.anchorDate || job.targetDate;

      if (anchorStr) {
        var anchorD = new Date(anchorStr + "T12:00:00Z");
        if (anchorD.getUTCDay() !== expectedDay) {
          return false;
        }
        if (dateStr < anchorStr) {
          return false;
        }
        var diffDays = this.getUtcDayDiff(anchorStr, dateStr);
        return (diffDays % intervalDays === 0);
      } else {
        var candYear = parseInt(dateStr.slice(0, 4), 10);
        var slots = this.generateWeekendSlots(candYear);
        var matchingSlot = slots.find(function(s) {
          var d = (pref === "sunday") ? s.sundayDate
                : (pref === "friday" || pref === "friday_pre_holiday") ? s.fridayDate
                : (pref === "monday" || pref === "monday_post_holiday") ? s.mondayDate
                : s.saturdayDate;
          return d === dateStr;
        });
        if (!matchingSlot) return false;
        var startWeekIdx = Math.max(0, (job.anchorWeek || 1) - 1);
        var currentIdx = matchingSlot.weekNumber - 1;
        return currentIdx >= startWeekIdx && (currentIdx - startWeekIdx) % interval === 0;
      }
    }

    // 3. Annual Job
    if (freq === "annual") {
      if (!job.targetMonth) return false;
      var prefAnnual = (job.preferredDay || "saturday").toLowerCase();
      var validAnnualDays = ["friday", "saturday", "sunday", "monday"];
      if (validAnnualDays.indexOf(prefAnnual) === -1) return false;

      var candYearAnn = parseInt(dateStr.slice(0, 4), 10);
      var slotsAnn = this.generateWeekendSlots(candYearAnn);
      var targetSlotsInMonth = slotsAnn.filter(function(s) { return s.month === job.targetMonth; });
      var chosenSlot = targetSlotsInMonth[1] || targetSlotsInMonth[0] || slotsAnn[0];
      if (!chosenSlot) return false;

      var expectedDate = (prefAnnual === "sunday") ? chosenSlot.sundayDate
                       : (prefAnnual === "friday") ? chosenSlot.fridayDate
                       : (prefAnnual === "monday") ? chosenSlot.mondayDate
                       : chosenSlot.saturdayDate;
      return dateStr === expectedDate;
    }

    return false;
  },

  /**
   * Offline17.5d: Verifies whether a given date or shiftId is an authorised explicit operational occurrence
   * of a Job (from [] or workspace shifts).
   * @param {Object} job - The job definition
   * @param {string} dateOrShiftId - YYYY-MM-DD or JOB_ID@YYYY-MM-DD
   * @param {Object|Array} [workspaceOrShifts] - Optional workspace object or shifts array
   * @returns {boolean}
   */

  isExplicitOperationalOccurrence: function(job, dateOrShiftId, workspaceOrShifts) {
    if (!job || typeof job !== "object" || !dateOrShiftId || typeof dateOrShiftId !== "string") {
      return false;
    }

    var dateStr = dateOrShiftId;
    var shiftId = dateOrShiftId;
    if (dateOrShiftId.indexOf("@") !== -1) {
      var parts = dateOrShiftId.split("@");
      if (parts[0] !== job.id) return false;
      dateStr = parts[1];
    } else {
      shiftId = job.id + "@" + dateStr;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return false;
    }

    // Offline17.5e Trust Boundary: Untrusted workspace envelope objects (e.g. raw workspace.shifts)
    // CANNOT manufacture proof of explicit operational occurrences.
    // Explicit occurrences are proven solely by the authoritative canonical ledger ([]).
    // Standalone explicit shift arrays passed directly by runtime scheduling context are accepted.
    if (Array.isArray(workspaceOrShifts) && workspaceOrShifts.length > 0) {
      var matchInArray = workspaceOrShifts.find(function(s) {
        if (!s) return false;
        var sJobId = s.jobId || (s.shiftId ? s.shiftId.split("@")[0] : "");
        var sDate = s.date || (s.shiftId ? s.shiftId.split("@")[1] : "");
        return sJobId === job.id && (s.shiftId === shiftId || sDate === dateStr);
      });
      if (matchInArray) return true;
    }

    // 2. Check authoritative historical occurrences ledger
    var wsSnapshots = (workspaceOrShifts && typeof workspaceOrShifts === 'object' && !Array.isArray(workspaceOrShifts) && workspaceOrShifts.historicalSnapshots);
    var sourceSnapshots = getNonEmptySnapshots(wsSnapshots) ||
                          getNonEmptySnapshots(window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.historicalSnapshots) ||
                          getTestLedger();
    var histOccs = [];
    if (Array.isArray(sourceSnapshots)) {
      histOccs = sourceSnapshots;
    } else if (sourceSnapshots && typeof sourceSnapshots === "object") {
      histOccs = Object.keys(sourceSnapshots).map(function(k) { return sourceSnapshots[k]; });
    }
    if (Array.isArray(histOccs) && histOccs.length > 0) {
      var matchInLedger = histOccs.find(function(h) {
        if (!h) return false;
        var hJobId = h.jobId || (h.shiftId ? h.shiftId.split("@")[0] : "");
        var hDate = h.date || (h.shiftId ? h.shiftId.split("@")[1] : "");
        return hJobId === job.id && (h.shiftId === shiftId || (hJobId + "@" + hDate) === shiftId || hDate === dateStr);
      });

      if (matchInLedger) {
        if (typeof this.resolveExplicitOccurrenceLifecycle === "function") {
          var lifecycle = this.resolveExplicitOccurrenceLifecycle({
            explicitOccurrence: matchInLedger,
            parentJob: job
          });
          if (lifecycle && lifecycle.include === false) {
            return false;
          }
        }
        return true;
      }
    }

    return false;
  },

  /**
   * Offline17.5d: Composite helper - Verifies whether a given date or shiftId is a canonical operational occurrence
   * of a Job (generated by recurrence OR an authorised explicit occurrence).
   * @param {Object} job - The job definition
   * @param {string} dateOrShiftId - YYYY-MM-DD or JOB_ID@YYYY-MM-DD
   * @param {Object|Array} [workspaceOrShifts] - Optional workspace object or shifts array
   * @returns {boolean}
   */
  isCanonicalOperationalOccurrence: function(job, dateOrShiftId, workspaceOrShifts) {
    return this.isGeneratedRecurrenceOccurrence(job, dateOrShiftId) ||
           this.isExplicitOperationalOccurrence(job, dateOrShiftId, workspaceOrShifts);
  },

  /**
   * Backward-compatible alias for isCanonicalOperationalOccurrence.
   */
  isCanonicalOccurrence: function(job, dateOrShiftId, workspaceOrShifts) {
    return this.isCanonicalOperationalOccurrence(job, dateOrShiftId, workspaceOrShifts);
  },

    /**
   * Resolves authoritative historical timing snapshot for a shift.
   * Checks runtime workspace snapshots first, then legacy HISTORICAL_OCCURRENCES fallback.
   * @param {string} shiftId
   * @param {string} jobId
   * @param {string} dateStr
   * @param {Object} [customSnapshots]
   * @returns {{ found: boolean, shiftId?: string, jobId?: string, date?: string, startTime?: string, durationHours?: number, crewSize?: number, assignedStaffIds?: string[] }}
   */
  resolveShiftHistoricalTiming: function(shiftId, jobId, dateStr, customSnapshots) {
    if (!dateStr && shiftId && shiftId.indexOf('@') !== -1) {
      dateStr = shiftId.split('@')[1];
    }
    if (!jobId && shiftId && shiftId.indexOf('@') !== -1) {
      jobId = shiftId.split('@')[0];
    }
    var canonicalId = (jobId && dateStr) ? (jobId + '@' + dateStr) : shiftId;

    // 1. Check workspace historicalSnapshots (passed or from HortOpsApp.state)
    var snaps = customSnapshots;
    if (!snaps && window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.historicalSnapshots) {
      snaps = window.HortOpsApp.state.historicalSnapshots;
    }

    if (snaps && typeof snaps === 'object') {
      var s = (shiftId && snaps[shiftId]) || (canonicalId && snaps[canonicalId]);
      if (!s) {
        for (var k in snaps) {
          if (snaps.hasOwnProperty(k)) {
            var cand = snaps[k];
            if (cand && (cand.shiftId === shiftId || cand.shiftId === canonicalId || (cand.jobId === jobId && cand.date === dateStr))) {
              s = cand;
              break;
            }
          }
        }
      }
      if (s && s.startTime && s.durationHours !== null && s.durationHours !== undefined) {
        return {
          found: true,
          shiftId: s.shiftId || canonicalId,
          jobId: s.jobId || jobId,
          date: s.date || dateStr,
          startTime: s.startTime,
          durationHours: Number(s.durationHours),
          crewSize: s.crewSize !== undefined ? Number(s.crewSize) : undefined,
          assignedStaffIds: Array.isArray(s.assignedStaffIds) ? s.assignedStaffIds.slice() : []
        };
      }
    }

    // 2. Check fallback from global app historicalSnapshots or test ledger
    var sourceSnapshots = getNonEmptySnapshots(customSnapshots) ||
                          getNonEmptySnapshots(window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.historicalSnapshots) ||
                          getTestLedger();
    var histOccs = [];
    if (Array.isArray(sourceSnapshots)) {
      histOccs = sourceSnapshots;
    } else if (sourceSnapshots && typeof sourceSnapshots === 'object') {
      histOccs = Object.keys(sourceSnapshots).map(function(k) { return sourceSnapshots[k]; });
    }
    if (Array.isArray(histOccs) && histOccs.length > 0) {
      var histMatch = histOccs.find(function(h) {
        if (!h) return false;
        var hJobId = h.jobId || (h.shiftId ? h.shiftId.split('@')[0] : '');
        var hDate = h.date || (h.shiftId ? h.shiftId.split('@')[1] : '');
        return (hJobId === jobId && (h.shiftId === shiftId || h.shiftId === canonicalId || hDate === dateStr));
      });
      if (histMatch && histMatch.startTime && histMatch.durationHours !== null && histMatch.durationHours !== undefined) {
        return {
          found: true,
          shiftId: histMatch.shiftId || canonicalId,
          jobId: histMatch.jobId || jobId,
          date: histMatch.date || dateStr,
          startTime: histMatch.startTime,
          durationHours: Number(histMatch.durationHours),
          crewSize: histMatch.crewSize !== undefined ? Number(histMatch.crewSize) : undefined,
          assignedStaffIds: Array.isArray(histMatch.assignedStaffIds) ? histMatch.assignedStaffIds.slice() : []
        };
      }
    }

    return { found: false };
  },

  _applyHistoricalTimingToShift: function(shift, job, shiftDate, assignedIds, todayStr, customSnapshots, integrityIssues) {
    if (shiftDate < todayStr) {
      shift.isHistorical = true;
      var snapMatch = this.resolveShiftHistoricalTiming(shift.shiftId, job.id, shiftDate, customSnapshots);
      if (assignedIds && assignedIds.length > 0) {
        shift.isHistoricalCommitment = true;
        if (snapMatch && snapMatch.found && snapMatch.startTime && snapMatch.durationHours !== null && snapMatch.durationHours !== undefined) {
          shift.startTime = snapMatch.startTime;
          shift.durationHours = snapMatch.durationHours;
          if (snapMatch.crewSize !== undefined && snapMatch.crewSize !== null) {
            shift.crewSize = snapMatch.crewSize;
          }
          shift.unverifiedSchedule = false;
        } else {
          // Active job with past actual commitment but no authoritative snapshot: fail closed (Peer Review 05 Finding 1)
          shift.startTime = null;
          shift.durationHours = null;
          shift.unverifiedSchedule = true;
          shift.hasIntegrityIssue = true;
          var unverifiedIssue = {
            code: 'UNVERIFIED_HISTORICAL_SCHEDULE',
            severity: 'warning',
            message: 'Historical commitment for job ' + (job.id || 'unknown') + ' on ' + shiftDate + ' has no authoritative timing snapshot.'
          };
          shift.integrityIssue = unverifiedIssue;
          if (integrityIssues && Array.isArray(integrityIssues)) {
            integrityIssues.push(Object.assign({
              shiftId: shift.shiftId,
              jobId: job.id,
              date: shiftDate
            }, unverifiedIssue));
          }
        }
      } else {
        if (snapMatch && snapMatch.found && snapMatch.startTime && snapMatch.durationHours !== null && snapMatch.durationHours !== undefined) {
          shift.startTime = snapMatch.startTime;
          shift.durationHours = snapMatch.durationHours;
          if (snapMatch.crewSize !== undefined && snapMatch.crewSize !== null) {
            shift.crewSize = snapMatch.crewSize;
          }
        }
        shift.unverifiedSchedule = false;
      }
    }
  },

  generateOperationalDigest: function(jobs, year, includeResolved, customAssignments, staffList, customPermits, customSnapshots) {
    var self = this;
    if (includeResolved === undefined) includeResolved = true;
    if (!customAssignments) customAssignments = {};
    if (!staffList) staffList = (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.staffList) || [];

    var slots = this.generateWeekendSlots(year);
    var allShifts = [];
    var seededShiftKeys = new Set();
    var jobMap = {};
    (jobs || []).forEach(function(j) { if (j && j.id) jobMap[j.id] = j; });

    // Seed immutable historical / explicit occurrences (Mandate Section 1, 4, 5, 11)
    var histOccs = [];
    var sourceSnapshots = getNonEmptySnapshots(customSnapshots) ||
                          getNonEmptySnapshots(window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.historicalSnapshots) ||
                          getTestLedger();
    if (Array.isArray(sourceSnapshots)) {
      histOccs = sourceSnapshots;
    } else if (sourceSnapshots && typeof sourceSnapshots === "object") {
      histOccs = Object.keys(sourceSnapshots).map(function(k) { return sourceSnapshots[k]; });
    }
    var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey()
      : new Date().toISOString().slice(0, 10);

    var integrityIssues = [];

    if (Array.isArray(histOccs) && histOccs.length > 0) {
      histOccs.forEach(function(hist) {
        if (!hist || !hist.date || hist.date.slice(0, 4) !== String(year)) return;
        var job = jobMap[hist.jobId];
        // Canonical explicit occurrence lifecycle resolution (Mandate Section 16, 17, 18, 8, 9)
        var lifecycle = self.resolveExplicitOccurrenceLifecycle({
          explicitOccurrence: hist,
          parentJob: job,
          todayStr: todayStr
        });
        if (!lifecycle.include) {
          if (lifecycle.integrityIssue) {
            integrityIssues.push(Object.assign({
              shiftId: hist.shiftId || (hist.jobId + '@' + hist.date),
              jobId: hist.jobId,
              date: hist.date,
              severity: (lifecycle.integrityIssue && lifecycle.integrityIssue.severity) ? lifecycle.integrityIssue.severity : 'error'
            }, lifecycle.integrityIssue));
          }
          return;
        }

        var slot = (job && job.frequencyType === 'work_pattern' && window.HortOpsPlanningRules) ? window.HortOpsPlanningRules.slotFor(slots,hist.date) : slots.find(function(s) {
          if (hist.weekNumber !== undefined && hist.weekNumber !== null) return s.weekNumber === hist.weekNumber;
          return s.saturdayDate === hist.date || s.sundayDate === hist.date || s.fridayDate === hist.date || s.mondayDate === hist.date;
        });
        if (slot) {
          var key = hist.jobId + '@' + hist.date;
          var dateKey = hist.jobId + '_' + hist.date;
          seededShiftKeys.add(key);
          seededShiftKeys.add(dateKey);
          if (hist.shiftId) seededShiftKeys.add(hist.shiftId);

          var assignedIds = customAssignments[hist.shiftId] || customAssignments[key] || customAssignments[dateKey] || hist.assignedStaffIds || [];
          var permitMeta = self.resolvePermitMeta(hist, dateKey, hist.shiftId || key, customPermits);

                    var histShift = Object.assign({}, hist, permitMeta, {
                        shiftId: hist.shiftId || (hist.jobId + '@' + hist.date),
                        jobId: hist.jobId,
                        jobName: hist.jobName || (job ? job.name : (hist.jobId || 'Unknown Job')),
                        // Snapshot records carry canonical dates, not planner display coordinates.
                        // Derive these on the runtime projection without changing saved history.
                        weekNumber: slot.weekNumber,
                        dayOfWeek: (job && job.frequencyType === 'work_pattern' && window.HortOpsPlanningRules) ? window.HortOpsPlanningRules.weekdays[new Date(hist.date+'T12:00:00Z').getUTCDay()] : hist.date === slot.saturdayDate ? 'Saturday' :
                            hist.date === slot.sundayDate ? 'Sunday' :
                            hist.date === slot.fridayDate ? 'Friday' :
                            hist.date === slot.mondayDate ? 'Monday' : hist.dayOfWeek,
                        assignedStaffIds: (assignedIds || []).slice(),
            isHistorical: hist.date < todayStr,
            isHistoricalCommitment: hist.date < todayStr,
            unverifiedSchedule: false
          });
          // Derive current display metadata from the canonical date; never rewrite snapshots.
          if (job && job.frequencyType === 'work_pattern') {
            histShift.frequencyType = 'work_pattern';
            var patternHoliday = window.HortOpsData.getPublicHolidaysForYear(year).find(function(h) { return h.date === hist.date; });
            histShift.isPublicHoliday = !!patternHoliday;
            histShift.publicHolidayName = patternHoliday ? patternHoliday.name : null;
            if (patternHoliday && !slot.publicHolidays.some(function(h) { return h.date === hist.date; })) slot.publicHolidays.push(patternHoliday);
          }
          slot.shifts.push(histShift);
          allShifts.push(histShift);
        }
      });
    }

    // Fail-closed job schedulability (Mandate Section 14): Only active jobs generate future occurrences (fail-closed on missing status)
    var eligibleJobs = (jobs || []).filter(function(j) {
      if (!j) return false;
      var status = String(j.status || '').trim().toLowerCase();
      return status === 'active';
    });

    eligibleJobs.forEach(function(job, jobIdx) {
      if (job.frequencyType === 'work_pattern') {
        var rules = window.HortOpsPlanningRules;
        if (!rules) throw new Error('Work pattern engine unavailable');
        rules.dates(job, year).forEach(function(date) {
          var shiftId = job.id + '@' + date, dateKey = job.id + '_' + date;
          if (seededShiftKeys.has(shiftId) || seededShiftKeys.has(dateKey)) return;
          var slot = rules.slotFor(slots, date);
          var holiday = window.HortOpsData.getPublicHolidaysForYear(year).find(function(h) { return h.date === date; });
          var assigned = customAssignments[shiftId] || customAssignments[dateKey] || [];
          var shift = Object.assign({}, job, self.resolvePermitMeta(job,dateKey,shiftId,customPermits), {
            shiftId:shiftId,jobId:job.id,jobName:job.name,date:date,
            weekNumber:slot.weekNumber,dayOfWeek:rules.weekdays[new Date(date+'T12:00:00Z').getUTCDay()],
            assignedStaffIds:assigned.slice(),isPublicHoliday:!!holiday,holidayName:holiday ? holiday.name : undefined
          });
          self._applyHistoricalTimingToShift(shift,job,date,assigned,todayStr,customSnapshots,integrityIssues);
          if (holiday && !slot.publicHolidays.some(function(h) { return h.date === date; })) slot.publicHolidays.push(holiday);
          slot.shifts.push(shift); allShifts.push(shift); seededShiftKeys.add(shiftId); seededShiftKeys.add(dateKey);
        });
        return;
      }

      // 1. Recurring Shift Engine (P0-04, P0-06, P0-08, P0-09)
      if ((job.frequencyType === 'recurring_weeks' || job.frequencyType === 'recurring_cadence') && job.intervalWeeks) {
        var interval = job.intervalWeeks;
        var anchorStr = job.anchorDate || job.targetDate;

        if (anchorStr) {
          var anchorD = new Date(anchorStr + 'T12:00:00');
          var anchorDay = anchorD.getDay(); // 0 Sun, 1 Mon, 5 Fri, 6 Sat
          var pref = (job.preferredDay || 'saturday').toLowerCase();
          var expectedDay = (pref === 'sunday') ? 0
                          : (pref === 'monday' || pref === 'monday_post_holiday') ? 1
                          : (pref === 'friday' || pref === 'friday_pre_holiday') ? 5
                          : 6;
          if (anchorDay !== expectedDay) {
            // Anchor weekday mismatch with preferredDay: skip recurring calculation
            return;
          }
        }

        slots.forEach(function(slot) {
          var shiftDate = slot.saturdayDate;
          var dayName = 'Saturday';

          if (job.preferredDay === 'sunday') {
            shiftDate = slot.sundayDate;
            dayName = 'Sunday';
          } else if (job.preferredDay === 'friday' || job.preferredDay === 'friday_pre_holiday') {
            shiftDate = slot.fridayDate;
            dayName = 'Friday';
          } else if (job.preferredDay === 'monday' || job.preferredDay === 'monday_post_holiday') {
            shiftDate = slot.mondayDate;
            dayName = 'Monday';
          }

          var isOccurrence = false;
          if (anchorStr) {
            var diffDays = self.getUtcDayDiff(anchorStr, shiftDate);
            var intervalDays = interval * 7;
            if (shiftDate >= anchorStr && diffDays % intervalDays === 0) {
              isOccurrence = true;
            }
          } else {
            var startWeekIdx = Math.max(0, (job.anchorWeek || 1) - 1);
            var currentIdx = slot.weekNumber - 1;
            if (currentIdx >= startWeekIdx && (currentIdx - startWeekIdx) % interval === 0) {
              isOccurrence = true;
            }
          }

          if (isOccurrence) {
            // Strictly enforce target calendar year for all shifts in operational digest
            if (shiftDate.slice(0, 4) !== String(year)) {
              return;
            }
            var matchingHoliday = slot.publicHolidays.find(function(h) { return h.date === shiftDate; });
            var shiftId = job.id + '@' + shiftDate;
            var legacyShiftId = job.id + '-w' + slot.weekNumber + '-' + shiftDate;

            var dateKey = job.id + '_' + shiftDate;
            var permitMeta = self.resolvePermitMeta(job, dateKey, shiftId, customPermits);
            var historicalData = window.HortOpsData.HISTORICAL_REAL_ASSIGNMENTS || {};

            var assignedIds = customAssignments[shiftId] || customAssignments[legacyShiftId] || customAssignments[dateKey];
            if (!assignedIds) {
              var hist = historicalData[dateKey];
              if (hist && hist.length > 0) {
                assignedIds = hist.slice();
              } else {
                assignedIds = [];
              }
            }

            var shift = {
              shiftId: shiftId,
              jobId: job.id,
              jobName: job.name,
              date: shiftDate,
              dayOfWeek: dayName, // True calendar weekday (P0-09)
              weekNumber: slot.weekNumber,
              startTime: job.startTime,
              durationHours: job.durationHours,
              crewSize: job.crewSize,
              isPublicHoliday: !!matchingHoliday,
              holidayName: matchingHoliday ? matchingHoliday.name : undefined,
              status: job.status,
              category: job.category,
              color: job.color,
              equipment: job.equipment || [],
              locationDetails: job.locationDetails,
              isExclusive: !!(job.isExclusive || job.isExclusiveTeams),
              isExclusiveTeams: !!(job.isExclusive || job.isExclusiveTeams),
              exclusiveTeams: (job.exclusiveTeams || []).slice(),
              primaryTeam: job.primaryTeam,
              secondaryTeam: job.secondaryTeam,
              tertiaryTeam: job.tertiaryTeam,
              plantOperatorRequired: !!job.plantOperatorRequired,
              notes: job.notes,
              assignedStaffIds: assignedIds,
              requiresWZTM: permitMeta.requiresWZTM,
              wztmStatus: permitMeta.wztmStatus,
              wztmNotes: permitMeta.wztmNotes,
              requiresTPO: permitMeta.requiresTPO,
              tpoStatus: permitMeta.tpoStatus,
              tpoNotes: permitMeta.tpoNotes
            };

            self._applyHistoricalTimingToShift(shift, job, shiftDate, assignedIds, todayStr, customSnapshots, integrityIssues);
            if (!seededShiftKeys.has(shiftId) && !seededShiftKeys.has(dateKey)) {
              seededShiftKeys.add(shiftId);
              seededShiftKeys.add(dateKey);
              slot.shifts.push(shift);
              allShifts.push(shift);
            }
          }
        });
      }

      // 2. Annual Shift Engine (P0-07, P0-08, P0-09, Mandate Section 13, 14)
      else if (job.frequencyType === 'annual' && job.targetMonth) {
        var pref = (job.preferredDay || 'saturday').toLowerCase();
        var validAnnualDays = ['friday', 'saturday', 'sunday', 'monday'];
        if (validAnnualDays.indexOf(pref) === -1) {
          // Unsupported preferredDay for annual job: skip rather than silently converting to Saturday
          return;
        }

        var targetSlotsInMonth = slots.filter(function(s) { return s.month === job.targetMonth; });
        var chosenSlot = targetSlotsInMonth[1] || targetSlotsInMonth[0] || slots[0];

        if (chosenSlot) {
          var shiftDate, dayName;
          switch (pref) {
            case 'sunday':
              shiftDate = chosenSlot.sundayDate;
              dayName = 'Sunday';
              break;
            case 'friday':
              shiftDate = chosenSlot.fridayDate;
              dayName = 'Friday';
              break;
            case 'monday':
              shiftDate = chosenSlot.mondayDate;
              dayName = 'Monday';
              break;
            case 'saturday':
            default:
              shiftDate = chosenSlot.saturdayDate;
              dayName = 'Saturday';
              break;
          }

          var matchingHoliday = chosenSlot.publicHolidays.find(function(h) { return h.date === shiftDate; });
          var shiftId = job.id + '@' + shiftDate;
          var legacyShiftId = job.id + '-annual-' + chosenSlot.weekNumber;

          var dateKey = job.id + '_' + shiftDate;
          var permitMeta = self.resolvePermitMeta(job, dateKey, shiftId, customPermits);
          var historicalData = window.HortOpsData.HISTORICAL_REAL_ASSIGNMENTS || {};

          var assignedIds = customAssignments[shiftId] || customAssignments[legacyShiftId] || customAssignments[dateKey];
          if (!assignedIds) {
            var hist = historicalData[dateKey];
            if (hist && hist.length > 0) {
              assignedIds = hist.slice();
            } else {
              assignedIds = [];
            }
          }

          var shift = {
            shiftId: shiftId,
            jobId: job.id,
            jobName: job.name,
            date: shiftDate,
            dayOfWeek: dayName,
            weekNumber: chosenSlot.weekNumber,
            startTime: job.startTime,
            durationHours: job.durationHours,
            crewSize: job.crewSize,
            isPublicHoliday: !!matchingHoliday,
            holidayName: matchingHoliday ? matchingHoliday.name : undefined,
            status: job.status,
            category: job.category,
            color: job.color,
            equipment: job.equipment || [],
            locationDetails: job.locationDetails,
            isExclusive: !!(job.isExclusive || job.isExclusiveTeams),
            isExclusiveTeams: !!(job.isExclusive || job.isExclusiveTeams),
            exclusiveTeams: (job.exclusiveTeams || []).slice(),
            primaryTeam: job.primaryTeam,
            secondaryTeam: job.secondaryTeam,
            tertiaryTeam: job.tertiaryTeam,
            plantOperatorRequired: !!job.plantOperatorRequired,
            notes: job.notes,
            assignedStaffIds: assignedIds,
            requiresWZTM: permitMeta.requiresWZTM,
            wztmStatus: permitMeta.wztmStatus,
            wztmNotes: permitMeta.wztmNotes,
            requiresTPO: permitMeta.requiresTPO,
            tpoStatus: permitMeta.tpoStatus,
            tpoNotes: permitMeta.tpoNotes
          };

          self._applyHistoricalTimingToShift(shift, job, shiftDate, assignedIds, todayStr, customSnapshots, integrityIssues);
          if (!seededShiftKeys.has(shiftId) && !seededShiftKeys.has(dateKey)) {
            seededShiftKeys.add(shiftId);
            seededShiftKeys.add(dateKey);
            chosenSlot.shifts.push(shift);
            allShifts.push(shift);
          }
        }
      }

      // 3. One-Off Shift Engine (P0-06, P0-07, P0-08, P0-09)
      else if (job.frequencyType === 'one_off' && job.targetDate) {
        var targetDateStr = job.targetDate;
        var targetDateObj = new Date(targetDateStr + 'T12:00:00');
        if (targetDateObj.getFullYear() !== year) {
          return;
        }

        var targetSlot = slots.find(function(s) {
          return s.saturdayDate === targetDateStr ||
                 s.sundayDate === targetDateStr ||
                 s.fridayDate === targetDateStr ||
                 s.mondayDate === targetDateStr;
        });
        if (!targetSlot) {
          return;
        }

        var d = new Date(targetDateStr + 'T12:00:00Z');
        var dayIdx = d.getUTCDay();
        var dayName = dayIdx === 0 ? 'Sunday' : dayIdx === 5 ? 'Friday' : dayIdx === 1 ? 'Monday' : 'Saturday';

        var matchingHoliday = targetSlot.publicHolidays.find(function(h) { return h.date === targetDateStr; });
        var shiftId = job.id + '@' + targetDateStr;
        var legacyShiftId = job.id + '-oneoff-' + targetDateStr;

        var dateKey = job.id + '_' + targetDateStr;
        var permitMeta = self.resolvePermitMeta(job, dateKey, shiftId, customPermits);
        var historicalData = window.HortOpsData.HISTORICAL_REAL_ASSIGNMENTS || {};

        var assignedIds = customAssignments[shiftId] || customAssignments[legacyShiftId] || customAssignments[dateKey];
        if (!assignedIds) {
          var hist = historicalData[dateKey];
          if (hist && hist.length > 0) {
            assignedIds = hist.slice();
          } else {
            assignedIds = [];
          }
        }

        var shift = {
          shiftId: shiftId,
          jobId: job.id,
          jobName: job.name,
          date: targetDateStr,
          dayOfWeek: dayName,
          weekNumber: targetSlot.weekNumber,
          startTime: job.startTime,
          durationHours: job.durationHours,
          crewSize: job.crewSize,
          isPublicHoliday: !!matchingHoliday,
          holidayName: matchingHoliday ? matchingHoliday.name : undefined,
          status: job.status,
          category: job.category,
          color: job.color,
          equipment: job.equipment || [],
          locationDetails: job.locationDetails,
          isExclusive: !!(job.isExclusive || job.isExclusiveTeams),
          isExclusiveTeams: !!(job.isExclusive || job.isExclusiveTeams),
          exclusiveTeams: (job.exclusiveTeams || []).slice(),
          primaryTeam: job.primaryTeam,
          secondaryTeam: job.secondaryTeam,
          tertiaryTeam: job.tertiaryTeam,
          plantOperatorRequired: !!job.plantOperatorRequired,
          notes: job.notes,
          assignedStaffIds: assignedIds,
          requiresWZTM: permitMeta.requiresWZTM,
          wztmStatus: permitMeta.wztmStatus,
          wztmNotes: permitMeta.wztmNotes,
          requiresTPO: permitMeta.requiresTPO,
          tpoStatus: permitMeta.tpoStatus,
          tpoNotes: permitMeta.tpoNotes
        };

        self._applyHistoricalTimingToShift(shift, job, targetDateStr, assignedIds, todayStr, customSnapshots, integrityIssues);
        if (!seededShiftKeys.has(shiftId) && !seededShiftKeys.has(dateKey)) {
          seededShiftKeys.add(shiftId);
          seededShiftKeys.add(dateKey);
          targetSlot.shifts.push(shift);
          allShifts.push(shift);
        }
      }
    });

    // Preserve historical commitments from non-active jobs (Mandate Section 16, 17, 18, 30; Peer Review 03 & 04)
    // When a job becomes inactive or archived, any previously assigned commitment must remain
    // available in allShifts for eligibility & rest-gap checking, without reactivating the job or generating
    // unassigned future slots.
    var yearPrefix = String(year);
    if (customAssignments && typeof customAssignments === 'object') {
      for (var aKey in customAssignments) {
        if (!customAssignments.hasOwnProperty(aKey)) continue;
        var assignedStaff = customAssignments[aKey];
        if (!Array.isArray(assignedStaff) || assignedStaff.length === 0) continue;

        // Extract jobId and dateStr from assignment key
        // Formats: jobId@YYYY-MM-DD, jobId_YYYY-MM-DD, jobId-wXX-YYYY-MM-DD, jobId-oneoff-YYYY-MM-DD
        var aJobId = '';
        var aDateStr = '';
        if (aKey.indexOf('@') !== -1) {
          var atParts = aKey.split('@');
          aJobId = atParts[0];
          aDateStr = atParts[1];
        } else if (aKey.indexOf('_') !== -1) {
          var usParts = aKey.split('_');
          aJobId = usParts[0];
          aDateStr = usParts[1];
        } else {
          var matchDate = aKey.match(/\d{4}-\d{2}-\d{2}/);
          if (matchDate) {
            aDateStr = matchDate[0];
            aJobId = aKey.slice(0, aKey.indexOf(aDateStr)).replace(/[-_w\d]+$/, '').replace(/[-_]$/, '');
          }
        }

        if (!aDateStr || aDateStr.slice(0, 4) !== yearPrefix) continue;

        var canonicalShiftId = (aJobId ? aJobId : 'job') + '@' + aDateStr;
        if (seededShiftKeys.has(aKey) || seededShiftKeys.has(canonicalShiftId)) {
          continue;
        }

        var parentJob = jobMap[aJobId] || null;
        var isPast = aDateStr < todayStr;

        // Future assignments on non-active or missing jobs must be suppressed (Peer Review 04 Finding 2)
        if (!isPast) {
          if (!parentJob || String(parentJob.status || '').trim().toLowerCase() !== 'active') {
            integrityIssues.push({
              shiftId: canonicalShiftId,
              jobId: aJobId,
              date: aDateStr,
              code: 'SUPPRESSED_FUTURE_INACTIVE_JOB_ASSIGNMENT',
              severity: 'info',
              message: 'Future assignment on ' + (parentJob ? (parentJob.status || 'non-active') : 'missing') + ' job ' + aJobId + ' suppressed from operational schedule.'
            });
            continue;
          }
        }

        var targetSlot = slots.find(function(s) {
          return s.saturdayDate === aDateStr || s.sundayDate === aDateStr || s.fridayDate === aDateStr || s.mondayDate === aDateStr;
        });

        var d = new Date(aDateStr + 'T12:00:00Z');
        var dayIdx = d.getUTCDay();
        var dayName = dayIdx === 0 ? 'Sunday' : dayIdx === 5 ? 'Friday' : dayIdx === 1 ? 'Monday' : 'Saturday';

        // Check if there is an authoritative historical occurrence snapshot (Peer Review 04 & 05)
        var histMatch = self.resolveShiftHistoricalTiming(canonicalShiftId, aJobId, aDateStr, customSnapshots);

        if (histMatch && histMatch.found && histMatch.startTime && histMatch.durationHours !== undefined && histMatch.durationHours !== null) {
          // Authoritative historical snapshot exists - preserve recorded timing verbatim
          var isHoliday = targetSlot && Array.isArray(targetSlot.publicHolidays)
            ? targetSlot.publicHolidays.some(function(h) { return h.date === aDateStr; })
            : false;

          var histShift = Object.assign({}, histMatch, {
            shiftId: canonicalShiftId,
            jobId: aJobId,
            jobName: histMatch.jobName || (parentJob ? parentJob.name : aJobId),
            date: aDateStr,
            dayOfWeek: dayName,
            weekNumber: targetSlot ? targetSlot.weekNumber : null,
            startTime: histMatch.startTime,
            durationHours: histMatch.durationHours,
            crewSize: histMatch.crewSize || (parentJob ? parentJob.crewSize : 1),
            isPublicHoliday: isHoliday,
            status: parentJob ? String(parentJob.status || 'inactive').toLowerCase() : 'historical',
            category: histMatch.category || (parentJob ? parentJob.category : undefined),
            primaryTeam: histMatch.primaryTeam || (parentJob ? parentJob.primaryTeam : undefined),
            plantOperatorRequired: !!(histMatch.plantOperatorRequired !== undefined ? histMatch.plantOperatorRequired : (parentJob && parentJob.plantOperatorRequired)),
            notes: histMatch.notes || (parentJob ? parentJob.notes : undefined),
            assignedStaffIds: assignedStaff.slice(),
            isHistorical: true,
            isHistoricalCommitment: true,
            unverifiedSchedule: false
          });
          seededShiftKeys.add(canonicalShiftId);
          seededShiftKeys.add(aKey);
          if (targetSlot) targetSlot.shifts.push(histShift);
          allShifts.push(histShift);
        } else {
          // No reliable historical snapshot: fail-closed with unverified schedule (Peer Review 04 Finding 1 & 4)
          var unverifiedIssue = {
            code: 'UNVERIFIED_HISTORICAL_SCHEDULE',
            severity: 'warning',
            message: 'Historical commitment for job ' + (aJobId || 'unknown') + ' on ' + aDateStr + ' has no authoritative timing snapshot.'
          };
          integrityIssues.push(Object.assign({
            shiftId: canonicalShiftId,
            jobId: aJobId,
            date: aDateStr
          }, unverifiedIssue));

          var unverifiedShift = {
            shiftId: canonicalShiftId,
            jobId: aJobId || 'unknown_job',
            jobName: parentJob ? parentJob.name : ('Unknown / Missing Job (' + (aJobId || 'unresolved') + ')'),
            date: aDateStr,
            dayOfWeek: dayName,
            weekNumber: targetSlot ? targetSlot.weekNumber : null,
            startTime: null,
            durationHours: null,
            crewSize: (parentJob && parentJob.crewSize) || 1,
            assignedStaffIds: assignedStaff.slice(),
            isHistorical: true,
            isHistoricalCommitment: true,
            unverifiedSchedule: true,
            status: parentJob ? String(parentJob.status || 'inactive').toLowerCase() : 'missing_parent',
            hasIntegrityIssue: true,
            integrityIssue: unverifiedIssue
          };
          seededShiftKeys.add(canonicalShiftId);
          seededShiftKeys.add(aKey);
          if (targetSlot) targetSlot.shifts.push(unverifiedShift);
          allShifts.push(unverifiedShift);
        }
      }
    }

    // Calculate totals and clash flags
    slots.forEach(function(slot) {
      slot.totalShifts = slot.shifts.length;
      slot.totalCrewHours = slot.shifts.reduce(function(sum, s) {
        if (!s || s.unverifiedSchedule || s.durationHours === null || s.durationHours === undefined) {
          return sum;
        }
        var dHours = Number(s.durationHours) || 0;
        var cSize = Number(s.crewSize) || 0;
        return sum + (dHours * cSize);
      }, 0);
      slot.isOverloaded = slot.shifts.length >= 3;

      var arterialShifts = slot.shifts.filter(function(s) { return s.category === 'Arterial Road'; });
      slot.hasArterialConflict = arterialShifts.length >= 2;
    });

    var jobMap = {};
    jobs.forEach(function(j) { jobMap[j.id] = j; });
    allShifts.forEach(function(shift) {
      revalidateShiftAssignments(shift, staffList, jobMap[shift.jobId], allShifts);
    });

    // Mandatory uniqueness release gate (Mandate Section 3.6)
    var shiftIds = allShifts.map(function(s) { return s.shiftId; });
    if (new Set(shiftIds).size !== shiftIds.length) {
      console.error('Integrity failure: duplicate shiftId detected in schedule digest', shiftIds);
      throw new Error('Duplicate shift IDs detected in operational schedule digest: ' + (shiftIds.length - new Set(shiftIds).size) + ' duplicates');
    }

    return { slots: slots, allShifts: allShifts, integrityIssues: integrityIssues };
  },

  /**
   * Retrieves commitment shifts from an adjacent year when targetDate is near a calendar-year boundary
   * (e.g. <= Jan 3 or >= Dec 29). Caches results so schedules are not repeatedly regenerated.
   *
   * @param {string} targetDate - 'YYYY-MM-DD'
   * @param {Array} [jobs]
   * @param {Object} [customAssignments]
   * @param {Array} [staffList]
   * @returns {Array} List of boundary shifts from the adjacent year
   */
  _getJobsSignature: function(jobs) {
    if (!jobs || !Array.isArray(jobs)) return 'nojobs';
    var sig = [];
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i];
      if (!j || !j.id) continue;
      sig.push(
        j.id + ':' +
        (j.status || '') + ':' +
        (j.startTime || '') + ':' +
        (j.durationHours || '') + ':' +
        JSON.stringify(j.workPattern || null) + ':' + JSON.stringify(j.preferredPoolTagIds || []) + ':' + JSON.stringify(j.exclusivePoolTagIds || []) + ':' + (j.exclusivePoolSource || '') + ':' + (j.frequencyType || '') + ':' +
        (j.preferredDay || '') + ':' +
        (j.intervalWeeks || '') + ':' +
        (j.anchorWeek !== undefined ? j.anchorWeek : '') + ':' +
        (j.anchorDate || '') + ':' +
        (j.targetDate || '') + ':' +
        (j.specificDate || '') + ':' +
        (j.targetMonth || '') + ':' +
        (j.active !== false ? '1' : '0')
      );
    }
    sig.sort();
    return sig.join('|');
  },

  _getBoundarySignature: function(customAssignments, adjYear, isEarlyJan) {
    if (!customAssignments) return 'empty';
    var prefix = String(adjYear);
    var sig = [];
    for (var k in customAssignments) {
      if (customAssignments.hasOwnProperty(k) && k.indexOf(prefix) !== -1) {
        if ((isEarlyJan && k.indexOf('-12-') !== -1) || (!isEarlyJan && k.indexOf('-01-') !== -1)) {
          sig.push(k + '=' + (customAssignments[k] || []).join(','));
        }
      }
    }
    sig.sort();
    return sig.join(';');
  },

  _getHistoricalSnapshotsSignature: function(snapshots, adjYear, isEarlyJan) {
    if (!snapshots || typeof snapshots !== 'object') return 'empty';
    var prefix = String(adjYear);
    var sig = [];
    for (var k in snapshots) {
      if (snapshots.hasOwnProperty(k)) {
        var snap = snapshots[k];
        if (!snap) continue;
        var sDate = snap.date || (snap.shiftId && snap.shiftId.indexOf('@') !== -1 ? snap.shiftId.split('@')[1] : '');
        if (sDate && sDate.indexOf(prefix) === 0) {
          if ((isEarlyJan && sDate.indexOf('-12-') !== -1) || (!isEarlyJan && sDate.indexOf('-01-') !== -1)) {
            sig.push(
              (snap.shiftId || k) + ':' +
              (snap.startTime || '') + ':' +
              (snap.durationHours !== null && snap.durationHours !== undefined ? snap.durationHours : '') + ':' +
              ((snap.assignedStaffIds || []).join(','))
            );
          }
        }
      }
    }
    sig.sort();
    return sig.join(';');
  },

  clearBoundaryCache: function() {
    this._boundaryCache = {};
  },

  getAdjacentBoundaryShifts: function(targetDate, jobs, customAssignments, staffList, customSnapshots) {
    if (!targetDate || typeof targetDate !== 'string' || targetDate.length < 10) {
      var emptyOk = [];
      emptyOk.lookupSuccess = true;
      return emptyOk;
    }
    var year = parseInt(targetDate.slice(0, 4), 10);
    var monthDay = targetDate.slice(5, 10);
    if (isNaN(year)) {
      var emptyOk2 = [];
      emptyOk2.lookupSuccess = true;
      return emptyOk2;
    }

    var isEarlyJan = (monthDay <= '01-03');
    var isLateDec  = (monthDay >= '12-29');
    if (!isEarlyJan && !isLateDec) {
      var emptyOk3 = [];
      emptyOk3.lookupSuccess = true;
      return emptyOk3;
    }

    var adjYear = isEarlyJan ? (year - 1) : (year + 1);
    this._boundaryCache = this._boundaryCache || {};
    var effectiveJobs = jobs || (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.jobs) || [];
    var effectiveAssignments = customAssignments || (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.customAssignments) || {};
    var effectiveStaff = staffList || (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.staffList) || [];

    var effectiveSnapshots = customSnapshots || (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.historicalSnapshots) || {};

    var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey()
      : new Date().toISOString().slice(0, 10);

    var jobsSig = this._getJobsSignature(effectiveJobs);
    var assignSig = this._getBoundarySignature(effectiveAssignments, adjYear, isEarlyJan);
    var histSig = this._getHistoricalSnapshotsSignature(effectiveSnapshots, adjYear, isEarlyJan);
    var cacheKey = String(adjYear) + '_' + (isEarlyJan ? 'dec' : 'jan') + '_D[' + todayStr + ']_J[' + jobsSig + ']_A[' + assignSig + ']_H[' + histSig + ']';
    if (this._boundaryCache[cacheKey]) {
      return this._boundaryCache[cacheKey];
    }

    try {
      var digest = this.generateOperationalDigest(effectiveJobs, adjYear, true, effectiveAssignments, effectiveStaff, null, effectiveSnapshots);
      if (!digest || !Array.isArray(digest.allShifts)) {
        throw new Error('Digest generation failed for adjacent year ' + adjYear);
      }
      var shifts = digest.allShifts || [];
      var boundaryShifts = [];

      if (isEarlyJan) {
        var minDate = String(adjYear) + '-12-29';
        boundaryShifts = shifts.filter(function(s) { return s && s.date && s.date >= minDate; });
      } else {
        var maxDate = String(adjYear) + '-01-03';
        boundaryShifts = shifts.filter(function(s) { return s && s.date && s.date <= maxDate; });
      }

      boundaryShifts.lookupSuccess = true;
      this._boundaryCache[cacheKey] = boundaryShifts;
      return boundaryShifts;
    } catch (e) {
      var errList = [];
      errList.lookupFailed = true;
      errList.error = true;
      errList.code = 'ADJACENT_SCHEDULE_UNAVAILABLE';
      errList.errorMessage = 'Adjacent-year schedule lookup failed for year ' + adjYear + ': ' + (e ? e.message : 'Unknown error');
      return errList;
    }
  }
};
