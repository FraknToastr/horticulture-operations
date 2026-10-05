// Canonical Offline17.1 Assisted Rostering Engine
// Implements deterministic multi-year propagation, stable slot identity, non-destructive reconciliation,
// historical protection, Plant Operator-aware Rotation, and fail-closed candidate evaluation.

window.HortOpsRosteringEngine = {
  UI_REPEAT_CAP: 12,
  LOOKAHEAD_YEARS_HORIZON: 2,

    /**
   * Resolves chronologically ordered series occurrences for a job across calendar years.
   * Ensures series resolution is source-relative and occurrence-bounded (Defects A & B).
   *
   * @param {Object} job - Target job entity
   * @param {Array<Object>} [allShifts] - Currently materialized shifts (active year)
   * @param {number} [requestedCount] - Number of occurrences needed (default 12)
   * @param {Array<Object>} [jobs] - All jobs list (for generating future years)
   * @param {string} [sourceShiftId] - The starting shift ID for source-relative occurrence counting
   * @returns {Array<Object>} Chronologically sorted series occurrences
   */
  resolveSeries: function(job, allShifts, requestedCount, jobs, sourceShiftId) {
    if (!job || !job.id) return [];
    var targetJobId = String(job.id).trim();
    var countNeeded = Math.min(requestedCount || this.UI_REPEAT_CAP, 52);

    var matches = [];
    if (Array.isArray(allShifts)) {
      matches = allShifts.filter(function(s) {
        if (!s || !s.shiftId) return false;
        var sJobId = String(s.jobId || '').trim();
        if (sJobId === targetJobId) return true;
        var prefix = s.shiftId.split('@')[0];
        return prefix === targetJobId;
      });
    }

    var seen = new Set();
    var unique = [];
    matches.forEach(function(s) {
      if (!seen.has(s.shiftId)) {
        seen.add(s.shiftId);
        unique.push(s);
      }
    });

    unique.sort(function(a, b) {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      var timeA = a.startTime || '';
      var timeB = b.startTime || '';
      return timeA.localeCompare(timeB);
    });

    // Cross-year recurrence resolution if needed for recurring/annual jobs
    var isRecurring = job.frequencyType === 'recurring_weeks' ||
                      job.frequencyType === 'recurring_cadence' ||
                      job.frequencyType === 'annual' || job.frequencyType === 'work_pattern';

    // Source-relative remaining count (Defect A):
    var sourceIndex = sourceShiftId ? unique.findIndex(function(s) { return s.shiftId === sourceShiftId; }) : -1;
    var occurrencesFromSource = sourceIndex !== -1 ? (unique.length - sourceIndex) : (sourceShiftId ? 0 : unique.length);
    var remainingNeeded = countNeeded - occurrencesFromSource;
    var sourceEncountered = sourceIndex !== -1;

    if (isRecurring && remainingNeeded > 0 && window.HortOpsScheduler && typeof window.HortOpsScheduler.generateOperationalDigest === 'function') {
      var jobsList = Array.isArray(jobs) && jobs.length > 0 ? jobs : [job];
      var baseYear = new Date().getFullYear();
      if (unique.length > 0) {
        var lastDate = unique[unique.length - 1].date;
        baseYear = parseInt(lastDate.split('-')[0], 10) || baseYear;
      }

      // Occurrence-bounded lookahead (Defect B / Offline17.2a):
      var intervalWeeks = Math.max(1, parseInt(job.intervalWeeks, 10) || 1);
      var estimatedYears = Math.ceil((remainingNeeded * intervalWeeks) / 52) + 2;
      var maxHorizon = (job.frequencyType === 'annual')
        ? Math.max(15, remainingNeeded + 3)
        : Math.min(25, Math.max(5, estimatedYears));

      for (var yOffset = 1; yOffset <= maxHorizon && remainingNeeded > 0; yOffset++) {
        var targetYear = baseYear + yOffset;
        try {
          var futureDigest = window.HortOpsScheduler.generateOperationalDigest(jobsList, targetYear);
          var futureShifts = (futureDigest && futureDigest.allShifts) ? futureDigest.allShifts : [];
          var futureMatches = futureShifts.filter(function(s) {
            return s && (s.jobId === targetJobId || (s.shiftId && s.shiftId.split('@')[0] === targetJobId));
          });

          futureMatches.sort(function(a, b) {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return (a.startTime || '').localeCompare(b.startTime || '');
          });

          for (var m = 0; m < futureMatches.length && remainingNeeded > 0; m++) {
            var fs = futureMatches[m];
            if (!seen.has(fs.shiftId)) {
              seen.add(fs.shiftId);
              unique.push(fs);

              if (sourceShiftId) {
                if (fs.shiftId === sourceShiftId) {
                  sourceEncountered = true;
                }
                if (sourceEncountered) {
                  remainingNeeded--;
                }
              } else {
                remainingNeeded--;
              }
            }
          }
        } catch (e) {
          break;
        }
      }
    }

    return unique;
  },

  /**
   * Resolves remaining occurrences from currentShiftId forward across calendar years.
   *
   * @param {string} currentShiftId
   * @param {Array<Object>} allShifts
   * @param {Object} job
   * @param {number} [requestedCount]
   * @param {Array<Object>} [jobs]
   * @returns {Array<Object>} Remaining occurrences starting with current shift
   */
  resolveRemainingOccurrences: function(currentShiftId, allShifts, job, requestedCount, jobs) {
    if (!currentShiftId) return [];
    var count = requestedCount || this.UI_REPEAT_CAP;
    var series = this.resolveSeries(job, allShifts, count, jobs, currentShiftId);
    var index = series.findIndex(function(s) { return s.shiftId === currentShiftId; });
    if (index === -1) {
      var currentShift = Array.isArray(allShifts) ? allShifts.find(function(s) { return s.shiftId === currentShiftId; }) : null;
      return currentShift ? [currentShift] : [];
    }
    return series.slice(index);
  },

  /**
   * Calculates the maximum repeat count available starting at currentShiftId.
   *
   * @param {string} currentShiftId
   * @param {Array<Object>} allShifts
   * @param {Object} job
   * @param {Array<Object>} [jobs]
   * @returns {number} Count of remaining occurrences (at least 1, up to UI_REPEAT_CAP)
   */
  resolveRepeatMax: function(currentShiftId, allShifts, job, jobs) {
    if (!job) return 1;
    if (job.frequencyType === 'one_off') return 1;

    var remaining = this.resolveRemainingOccurrences(currentShiftId, allShifts, job, this.UI_REPEAT_CAP, jobs);
    if (job.frequencyType === 'annual' || job.frequencyType === 'recurring_weeks' || job.frequencyType === 'recurring_cadence' || job.frequencyType === 'work_pattern') {
      return Math.max(1, Math.min(remaining.length, this.UI_REPEAT_CAP));
    }
    return Math.max(1, remaining.length);
  },

  /**
   * Pure deterministic candidate recommendation for Rotation mode.
   * Ensures Plant Operator requirement is strictly satisfied and never assigns ordinary workers
   * when an eligible Plant Operator is required but absent.
   *
   * @param {Object} params - Context
   * @returns {{ candidate: Object|null, reusedPrevious: boolean, reason: string }}
   */
  recommendRotationCandidate: function(params) {
    params = params || {};
    var job = params.job;
    var occurrence = params.occurrence;
    var allShifts = (params.allShifts || []).slice();
    var isBoundaryDate = false;
    if (occurrence && typeof occurrence.date === 'string' && occurrence.date.length >= 10) {
      var monthDay = occurrence.date.slice(5, 10);
      if (monthDay <= '01-03' || monthDay >= '12-29') {
        isBoundaryDate = true;
      }
    }

    if (isBoundaryDate) {
      if (!window.HortOpsScheduler || typeof window.HortOpsScheduler.getAdjacentBoundaryShifts !== 'function') {
        return {
          candidate: null,
          reusedPrevious: false,
          reason: 'ADJACENT_SCHEDULE_UNAVAILABLE: HortOpsScheduler boundary lookup service is unavailable'
        };
      }
      var adj = window.HortOpsScheduler.getAdjacentBoundaryShifts(occurrence.date, params.jobs, params.customAssignments, params.roster, params.historicalSnapshots);
      if (adj && adj.lookupFailed) {
        return {
          candidate: null,
          reusedPrevious: false,
          reason: 'ADJACENT_SCHEDULE_UNAVAILABLE: ' + (adj.errorMessage || 'Adjacent lookup failed')
        };
      }
      if (adj && adj.length > 0) {
        var existingMap = {};
        for (var eI = 0; eI < allShifts.length; eI++) {
          if (allShifts[eI] && allShifts[eI].shiftId) existingMap[allShifts[eI].shiftId] = true;
        }
        for (var aI = 0; aI < adj.length; aI++) {
          if (adj[aI] && adj[aI].shiftId && !existingMap[adj[aI].shiftId]) {
            allShifts.push(adj[aI]);
          }
        }
      }
    }
    var roster = params.roster || [];
    var currentAssignedIds = (params.currentAssignedIds || []).slice();
    var previousHolderId = params.previousHolderId;

    var engine = window.HortOpsEligibilityEngine;
    if (!engine || typeof engine.validateStaffEligibility !== 'function') {
      return { candidate: null, reusedPrevious: false, reason: 'HortOpsEligibilityEngine unavailable' };
    }

    var candidateModel = window.HortOpsStaffAssignCandidateModel;
    var jobPrefs = {
      primaryTeam: job ? job.primaryTeam : (occurrence ? occurrence.primaryTeam : null),
      secondaryTeam: job ? job.secondaryTeam : (occurrence ? occurrence.secondaryTeam : null),
      tertiaryTeam: job ? job.tertiaryTeam : (occurrence ? occurrence.tertiaryTeam : null),
      isExclusive: job ? job.isExclusive : (occurrence ? occurrence.isExclusive : false),
      exclusiveTeams: job ? job.exclusiveTeams : (occurrence ? occurrence.exclusiveTeams : [])
    };

    var isPlantOpReq = Boolean(occurrence && (occurrence.plantOperatorRequired || (job && job.plantOperatorRequired)));
    var crewHasPlantOp = currentAssignedIds.some(function(id) {
      var s = roster.find(function(m) { return m.id === id; });
      return s && s.isPlantOperator;
    });
    var needsPlantOp = isPlantOpReq && !crewHasPlantOp;

    var eligibleCandidates = [];
    for (var i = 0; i < roster.length; i++) {
      var staff = roster[i];
      if (!staff || !staff.id) continue;
      if (currentAssignedIds.indexOf(staff.id) !== -1) continue;

      var evalRes = engine.validateStaffEligibility(staff, occurrence, job, allShifts, currentAssignedIds);
      if (evalRes.eligible) {
        eligibleCandidates.push(staff);
      }
    }

    if (eligibleCandidates.length === 0) {
      return { candidate: null, reusedPrevious: false, reason: 'No eligible candidates available' };
    }

    // Strict Plant Operator gate: If crew lacks a required Plant Operator, ONLY evaluate certified operators
    if (needsPlantOp) {
      var plantOpCandidates = eligibleCandidates.filter(function(c) { return Boolean(c.isPlantOperator); });
      if (plantOpCandidates.length === 0) {
        // Offline17.1: Do NOT fall back to ordinary workers! Leave slot vacant and report conflict
        return {
          candidate: null,
          reusedPrevious: false,
          reason: 'NO_ELIGIBLE_PLANT_OPERATOR'
        };
      }
      eligibleCandidates = plantOpCandidates;
    }

    var getTier = function(staff) {
      if (candidateModel && typeof candidateModel.getStaffPriority === 'function') {
        return candidateModel.getStaffPriority(staff, jobPrefs);
      }
      return 5;
    };

    var absencesEngine = (typeof window !== 'undefined' && (window.HortOpsAbsences || window.HortOpsAbsenceLedger)) || (typeof global !== 'undefined' && (global.HortOpsAbsences || global.HortOpsAbsenceLedger));
    var refusalHistory = params.refusalHistory ||
      (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.refusalHistory) ||
      (typeof global !== 'undefined' && global.HortOpsApp && global.HortOpsApp.state && global.HortOpsApp.state.refusalHistory) || [];

    var deterministicSort = function(a, b) {
      var poolRules = window.HortOpsPlanningRules;
      if (poolRules && job && (job.preferredPoolTagIds || []).length) {
        var poolTags = params.poolTags || (window.HortOpsApp && window.HortOpsApp.state.poolTags) || [];
        var preferredA = poolRules.matches(a, job.preferredPoolTagIds, poolTags) ? 0 : 1;
        var preferredB = poolRules.matches(b, job.preferredPoolTagIds, poolTags) ? 0 : 1;
        if (preferredA !== preferredB) return preferredA - preferredB;
      }
      var tierA = getTier(a);
      var tierB = getTier(b);
      if (tierA !== tierB) return tierA - tierB;

      // Stage 3 Gate 3E & Review 56 R56-P0-03 & Review 57 R57-P1-04: Fair-share scoring incorporating YTD overtime and refusal history with as-of temporal bounds
      if (absencesEngine && typeof absencesEngine.calculateFairShareScore === 'function') {
        var asOfDate = occurrence ? (occurrence.date || occurrence.shiftDate) : null;
        var scoreA = absencesEngine.calculateFairShareScore(a, { refusalHistory: refusalHistory, asOfDate: asOfDate });
        var scoreB = absencesEngine.calculateFairShareScore(b, { refusalHistory: refusalHistory, asOfDate: asOfDate });
        if (scoreA !== scoreB) {
          return scoreB - scoreA; // Higher fair-share score offered first
        }
      } else {
        var ytdA = a.ytdOvertimeHours || a.ytdHours || 0;
        var ytdB = b.ytdOvertimeHours || b.ytdHours || 0;
        if (ytdA !== ytdB) return ytdA - ytdB;
      }

      var roleA = String(a.role || '');
      var roleB = String(b.role || '');
      if (roleA !== roleB) return roleA.localeCompare(roleB);

      return String(a.id || '').localeCompare(String(b.id || ''));
    };

    var alternatives = eligibleCandidates.filter(function(c) { return c.id !== previousHolderId; });

    if (alternatives.length > 0) {
      alternatives.sort(deterministicSort);
      var selected = alternatives[0];
      var tier = getTier(selected);
      var tierDesc = tier === 1 ? 'Primary Team' : tier === 2 ? 'Secondary Team' : tier === 3 ? 'Tertiary Team' : tier === 4 ? 'Exclusive Team' : 'General Roster';
      return {
        candidate: selected,
        reusedPrevious: false,
        reason: 'Eligible alternative selected (' + tierDesc + ', rank tier ' + tier + ')'
      };
    }

    var prevStaff = eligibleCandidates.find(function(c) { return c.id === previousHolderId; });
    if (prevStaff) {
      return {
        candidate: prevStaff,
        reusedPrevious: true,
        reason: 'No alternative eligible employee available'
      };
    }

    return { candidate: null, reusedPrevious: false, reason: 'No eligible candidate available' };
  },

  /**
   * Canonical single-occurrence propagation logic shared by ordinary future
   * rostering and historical reconciliation.
   * Enforces Manual precedence, crew limits, eligibility, Plant Operator gates,
   * deterministic rotation candidate selection, and provenance generation.
   *
   * @param {Object} params
   * @returns {{ previousHolderId: string }}
   */
  propagateOccurrence: function(params) {
    params = params || {};
    var occurrence = params.occurrence;
    var sequenceIndex = params.sequenceIndex;
    var job = params.job;
    var slotId = params.slotId;
    var slotIndex = params.slotIndex;
    var mode = params.mode;
    var staffId = params.staffId;
    var staff = params.staff;
    var instructionId = params.instructionId;
    var sourceShiftId = params.sourceShiftId;
    var previousHolderId = params.previousHolderId;
    var customAssignments = params.customAssignments;
    var provenance = params.provenance;
    var allShifts = params.allShifts || [];
    var roster = params.roster || [];
    var auditLog = params.auditLog || [];
    var todayStr = params.todayStr;
    var matchingOldInstId = params.matchingOldInstId;

    var targetShiftId = occurrence.shiftId;

    // Historical target protection
    if ((occurrence.date || '') < todayStr) {
      auditLog.push({
        shiftId: targetShiftId,
        action: 'historical_target_immutable',
        message: 'Target occurrence on ' + occurrence.date + ' is historical; propagation skipped.'
      });
      return { previousHolderId: previousHolderId };
    }

    if (!customAssignments[targetShiftId]) {
      customAssignments[targetShiftId] = (occurrence.assignedStaffIds || []).slice();
    }
    var targetAssigned = customAssignments[targetShiftId].slice();

    // Check if this slot was previously assigned by this exact instruction or old instruction being replaced
    var priorAssignedByThisInst = null;
    targetAssigned.forEach(function(empId) {
      var pKey = targetShiftId + ':' + empId;
      var p = provenance[pKey];
      if (p && (p.instructionId === instructionId || (matchingOldInstId && p.instructionId === matchingOldInstId))) {
        priorAssignedByThisInst = empId;
      }
    });

    // Clean out prior assignment from this same instruction before re-evaluating to ensure idempotency
    if (priorAssignedByThisInst) {
      targetAssigned = targetAssigned.filter(function(id) { return id !== priorAssignedByThisInst; });
      delete provenance[targetShiftId + ':' + priorAssignedByThisInst];
    }

    // Check for manual or unrelated assignment collision for THIS durable slot
    var occupyingStaffId = null;
    var occupyingProv = null;
    targetAssigned.forEach(function(empId) {
      var pKey = targetShiftId + ':' + empId;
      var p = provenance[pKey];
      if (p) {
        var slotMatches = (p.slotId && p.slotId === slotId) ||
                          (p.slotIndex !== undefined && (p.slotIndex === slotIndex || ('SLOT-' + (p.slotIndex + 1)) === slotId));
        if (slotMatches) {
          occupyingStaffId = empId;
          occupyingProv = p;
        }
      }
    });

    // If no provenance exists for assigned staff (legacy raw assignment), fall back to index matching only if unprovenanced
    if (!occupyingStaffId && targetAssigned[slotIndex]) {
      var rawEmpId = targetAssigned[slotIndex];
      var rawP = provenance[targetShiftId + ':' + rawEmpId];
      if (!rawP || rawP.source === 'manual') {
        occupyingStaffId = rawEmpId;
        occupyingProv = rawP || { source: 'manual', slotId: slotId, slotIndex: slotIndex };
      }
    }

    if (occupyingStaffId) {
      var isManualOrUnrelated = !occupyingProv || occupyingProv.source === 'manual' || (occupyingProv.instructionId && occupyingProv.instructionId !== instructionId);
      if (isManualOrUnrelated) {
        auditLog.push({
          shiftId: targetShiftId,
          slotId: slotId,
          slotIndex: slotIndex,
          preservedEmployeeId: occupyingStaffId,
          instructionId: instructionId,
          mode: mode,
          action: 'manual_assignment_preserved',
          message: 'Propagated ' + mode + ' instruction blocked: manual assignment preserved for ' + occupyingStaffId
        });
        return { previousHolderId: occupyingStaffId };
      }
    }

    var targetCrewLimit = occurrence.crewSize || (job && job.crewSize) || 1;
    if (targetAssigned.length >= targetCrewLimit) {
      auditLog.push({
        shiftId: targetShiftId,
        slotId: slotId,
        mode: mode,
        action: 'manual_assignment_preserved',
        message: 'Downstream occurrence on ' + occurrence.date + ' is already staffed by manual assignments (' + targetAssigned.length + '/' + targetCrewLimit + '). Manual assignment preserved.'
      });
      return { previousHolderId: previousHolderId };
    }

    if (mode === 'fixed') {
      if (!staff) {
        auditLog.push({ shiftId: targetShiftId, employeeId: staffId, mode: 'fixed', action: 'staff_not_found' });
        return { previousHolderId: previousHolderId };
      }

      var evalFixed = window.HortOpsEligibilityEngine.validateStaffEligibility(staff, occurrence, job, allShifts, targetAssigned);

      if (evalFixed.eligible) {
        if (targetAssigned.indexOf(staffId) === -1) {
          targetAssigned.push(staffId);
        }
        customAssignments[targetShiftId] = targetAssigned;
        provenance[targetShiftId + ':' + staffId] = {
          source: 'rostering-rule',
          strategy: 'fixed',
          instructionId: instructionId,
          slotId: slotId,
          sourceShiftId: sourceShiftId,
          sequenceIndex: sequenceIndex
        };
        auditLog.push({ shiftId: targetShiftId, employeeId: staffId, mode: 'fixed', action: 'propagated_fixed' });
        return { previousHolderId: staffId };
      } else {
        // Ineligible: do NOT silently replace. Leave conflict/vacancy
        targetAssigned = targetAssigned.filter(function(id) { return id !== staffId; });
        customAssignments[targetShiftId] = targetAssigned;
        delete provenance[targetShiftId + ':' + staffId];

        auditLog.push({
          shiftId: targetShiftId,
          employeeId: staffId,
          mode: 'fixed',
          action: 'fixed_ineligible_vacancy',
          reason: evalFixed.reasons[0] || 'INELIGIBLE',
          message: 'Fixed officer ' + staff.name + ' is ineligible on ' + occurrence.date + ' (' + (evalFixed.reasons[0] || 'Ineligible') + '). Slot left vacant.'
        });
        return { previousHolderId: previousHolderId };
      }
    } else if (mode === 'rotation') {
      var rotRes = this.recommendRotationCandidate({
        job: job,
        occurrence: occurrence,
        allShifts: allShifts,
        roster: roster,
        currentAssignedIds: targetAssigned,
        previousHolderId: previousHolderId,
        slotIndex: slotIndex
      });

      if (rotRes.candidate) {
        var rotCandidate = rotRes.candidate;
        targetAssigned.push(rotCandidate.id);
        customAssignments[targetShiftId] = targetAssigned;
        provenance[targetShiftId + ':' + rotCandidate.id] = {
          source: 'rostering-rule',
          strategy: 'rotation',
          instructionId: instructionId,
          slotId: slotId,
          sourceShiftId: sourceShiftId,
          sequenceIndex: sequenceIndex,
          reusedPrevious: rotRes.reusedPrevious,
          reason: rotRes.reason
        };
        auditLog.push({
          shiftId: targetShiftId,
          employeeId: rotCandidate.id,
          mode: 'rotation',
          action: 'propagated_rotation',
          reusedPrevious: rotRes.reusedPrevious,
          reason: rotRes.reason
        });
        return { previousHolderId: rotCandidate.id };
      } else {
        customAssignments[targetShiftId] = targetAssigned;
        var isPlantUnresolved = (rotRes.reason === 'NO_ELIGIBLE_PLANT_OPERATOR');
        auditLog.push({
          shiftId: targetShiftId,
          slotId: slotId,
          mode: 'rotation',
          action: isPlantUnresolved ? 'plant_operator_unresolved' : 'rotation_no_candidate_vacancy',
          reason: rotRes.reason,
          message: isPlantUnresolved
            ? ('Plant Operator required but no eligible certified operator available for slot on ' + occurrence.date + '. Slot left vacant.')
            : ('Rotation unable to find eligible candidate for slot on ' + occurrence.date + ' (' + rotRes.reason + '). Slot left vacant.')
        });
        return { previousHolderId: previousHolderId };
      }
    }

    return { previousHolderId: previousHolderId };
  },

  /**
   * Applies assisted rostering changes for a given shift, updating customAssignments
   * and rosteringState (instructions and provenance).
   *
   * @param {Object} params - Context
   * @returns {{ success: boolean, customAssignments: Object, rosteringState: Object, auditLog: Array<Object> }}
   */
  applyRostering: function(params) {
    params = params || {};
    var job = params.job;
    var currentShift = params.currentShift;
    var stagedStaffIds = (params.stagedStaffIds || []).slice();
    var stagedStrategies = params.stagedStrategies || {};
    var stagedSlots = params.stagedSlots || [];
    var allShifts = params.allShifts || [];
    var roster = params.roster || params.staffList || [];
    // Deep clone state to guarantee caller immutability
    var customAssignments = JSON.parse(JSON.stringify(params.customAssignments || {}));
    var instructions = JSON.parse(JSON.stringify((params.rosteringState && params.rosteringState.instructions) || {}));
    var provenance = JSON.parse(JSON.stringify((params.rosteringState && params.rosteringState.provenance) || {}));
    var jobsList = params.jobs || (job ? [job] : []);

    if (!currentShift || !currentShift.shiftId || !job) {
      throw new Error('HortOpsRosteringEngine.applyRostering: currentShift and job are required.');
    }

    var auditLog = [];
    var affectedOccurrences = {};
    var prunedProvenance = [];
    var prunedInstructions = [];

    if (currentShift && currentShift.shiftId) {
      affectedOccurrences[currentShift.shiftId] = currentShift;
    }

    // Historical check
    var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey()
      : new Date().toISOString().slice(0, 10);
    var isSourceHistorical = (currentShift.date || '') < todayStr;

    // Build unified staged slot list
    var slotsToProcess = [];
    if (Array.isArray(stagedSlots) && stagedSlots.length > 0) {
      slotsToProcess = stagedSlots.slice();
    } else {
      for (var sIdx = 0; sIdx < stagedStaffIds.length; sIdx++) {
        var sEmpId = stagedStaffIds[sIdx];
        var sStrat = stagedStrategies[sEmpId] || { mode: 'manual', repeatCount: 1 };
        slotsToProcess.push({
          slotId: 'slot-' + sIdx,
          staffId: sEmpId,
          mode: sStrat.mode || 'manual',
          repeatCount: sStrat.repeatCount || 1
        });
      }
    }

    // 1. RECONCILIATION: Find all existing instructions that originated on this shift
    var existingShiftInstructions = [];
    Object.keys(instructions).forEach(function(instId) {
      var inst = instructions[instId];
      if (inst && (inst.sourceShiftId === currentShift.shiftId || inst.startShiftId === currentShift.shiftId)) {
        existingShiftInstructions.push(inst);
      }
    });

    // Offline17.5c: Permanent Historical Source Sealing Check
    // Any historical instruction is permanently sealed, regardless of current clock, source date, or continuation existence.
    // The historical source cannot restart future propagation, recreate continuations, or mutate downstream state.
    if (existingShiftInstructions.length > 0) {
      var historicalInst = existingShiftInstructions.find(function(old) {
        return old.status === 'historical';
      });

      if (historicalInst) {
        var activeCont = Object.values(instructions).find(function(other) {
          return (other.status === 'active' || other.status === undefined) &&
            other.jobId === historicalInst.jobId &&
            other.slotId === historicalInst.slotId &&
            (other.predecessorInstructionId === historicalInst.id || other.lineageRootId === (historicalInst.lineageRootId || historicalInst.id));
        });

        var contShiftId = activeCont ? (activeCont.sourceShiftId || (activeCont.jobId + '@' + activeCont.startDate)) : null;
        var contDate = activeCont ? (activeCont.startDate || (contShiftId ? contShiftId.split('@')[1] : '')) : null;

        auditLog.push({
          shiftId: currentShift.shiftId,
          slotId: historicalInst.slotId,
          employeeId: historicalInst.employeeId,
          mode: historicalInst.mode,
          action: 'historical_source_sealed',
          message: activeCont
            ? ('Historical rostering is locked. Future rostering continues from ' + (contDate || contShiftId) + '.')
            : 'Historical rostering is locked. No active future continuation exists.',
          activeContinuationShiftId: contShiftId
        });

        return {
          success: true,
          sealed: true,
          activeContinuationShiftId: contShiftId,
          customAssignments: customAssignments,
          rosteringState: {
            instructions: instructions,
            provenance: provenance
          },
          auditLog: auditLog,
          affectedOccurrences: affectedOccurrences,
          prunedProvenance: prunedProvenance,
          prunedInstructions: prunedInstructions
        };
      }
    }

    // Prune removed slots / retiring instructions
    var activeSlotIds = new Set(slotsToProcess.map(function(s) { return s.slotId; }));
    existingShiftInstructions.forEach(function(oldInst) {
      var slotStillActive = activeSlotIds.has(oldInst.slotId);
      var matchingStagedSlot = slotsToProcess.find(function(s) { return s.slotId === oldInst.slotId; });
      var modeChanged = matchingStagedSlot && String(matchingStagedSlot.mode).toLowerCase() !== String(oldInst.mode).toLowerCase();
      var employeeChanged = matchingStagedSlot && matchingStagedSlot.staffId !== oldInst.employeeId;
      var repeatReduced = matchingStagedSlot && (parseInt(matchingStagedSlot.repeatCount, 10) || 1) < oldInst.repeatCount;

      if (!slotStillActive || modeChanged || employeeChanged || repeatReduced) {
        // Prune stale generated assignments
        var pruneFromIndex = 1;
        if (matchingStagedSlot && !modeChanged && !employeeChanged && repeatReduced) {
          pruneFromIndex = parseInt(matchingStagedSlot.repeatCount, 10) || 1;
        }

        // Find series for old instruction (source-relative)
        var oldSeries = window.HortOpsRosteringEngine.resolveSeries(job, allShifts, oldInst.repeatCount + 2, jobsList, currentShift.shiftId);
        if (Array.isArray(oldSeries)) {
          for (var osIdx = 0; osIdx < oldSeries.length; osIdx++) {
            var osOcc = oldSeries[osIdx];
            if (osOcc && osOcc.shiftId) {
              affectedOccurrences[osOcc.shiftId] = osOcc;
            }
          }
        }
        var oldStartIndex = oldSeries.findIndex(function(s) { return s.shiftId === currentShift.shiftId; });
        if (oldStartIndex !== -1) {
          for (var k = pruneFromIndex; k < oldInst.repeatCount; k++) {
            var targetOccIndex = oldStartIndex + k;
            if (targetOccIndex >= oldSeries.length) break;
            var targetOcc = oldSeries[targetOccIndex];
            var targetShiftId = targetOcc.shiftId;
            if (targetOcc && targetOcc.shiftId) {
              affectedOccurrences[targetShiftId] = targetOcc;
            }

            // Defect E: Partition historical vs future! Preserve historical actuals untouched.
            if ((targetOcc.date || '') < todayStr) {
              continue;
            }

            var assigned = (customAssignments[targetShiftId] || []).slice();
            var filtered = [];
            assigned.forEach(function(empId) {
              var pKey = targetShiftId + ':' + empId;
              var p = provenance[pKey];
              if (p && p.instructionId === oldInst.id) {
                delete provenance[pKey];
                prunedProvenance.push(pKey);
              } else {
                filtered.push(empId);
              }
            });
            customAssignments[targetShiftId] = filtered;
          }
        }

        var historicalCount = 0;
        if (oldStartIndex !== -1) {
          for (var h = 0; h < oldInst.repeatCount; h++) {
            var occIdx = oldStartIndex + h;
            if (occIdx < oldSeries.length && (oldSeries[occIdx].date || '') < todayStr) {
              historicalCount++;
            }
          }
        }

        // Defect F / Offline17.2a: Clean stale employee provenance on currentShift only when source is NOT historical
        if (employeeChanged && oldInst.employeeId && !isSourceHistorical) {
          var staleEmpKey = currentShift.shiftId + ':' + oldInst.employeeId;
          if (provenance[staleEmpKey]) {
            delete provenance[staleEmpKey];
            prunedProvenance.push(staleEmpKey);
          }
        }

        if (historicalCount > 0) {
          // Preserve old instruction clamped to its historical actuals so past provenance remains valid
          oldInst.repeatCount = historicalCount;
          oldInst.status = 'historical';
          if (!oldInst.lineageRootId) oldInst.lineageRootId = oldInst.id;
          if (oldInst.predecessorInstructionId === undefined) oldInst.predecessorInstructionId = null;
          instructions[oldInst.id] = oldInst;
        } else {
          if (!slotStillActive || (matchingStagedSlot && matchingStagedSlot.mode === 'manual')) {
            delete instructions[oldInst.id];
            prunedInstructions.push(oldInst.id);
            var staleSlotProvKey = currentShift.shiftId + ':' + oldInst.employeeId;
            if (provenance[staleSlotProvKey]) {
              delete provenance[staleSlotProvKey];
              prunedProvenance.push(staleSlotProvKey);
            }
          }
        }
      }
    });

    // Update current shift assignments - preserve historical actuals if source is in the past
    var isNewInstructionOnHistorical = isSourceHistorical && existingShiftInstructions.length === 0;

    if (!isSourceHistorical) {
      var currentAssigned = slotsToProcess.map(function(s) { return s.staffId; }).filter(Boolean);
      var prevAssigned = (customAssignments[currentShift.shiftId] || []).slice();
      for (var pa = 0; pa < prevAssigned.length; pa++) {
        var pEmp = prevAssigned[pa];
        if (currentAssigned.indexOf(pEmp) === -1) {
          var staleProvKey = currentShift.shiftId + ':' + pEmp;
          if (provenance[staleProvKey]) {
            delete provenance[staleProvKey];
            prunedProvenance.push(staleProvKey);
          }
        }
      }
      customAssignments[currentShift.shiftId] = currentAssigned;
    } else {
      // Historical source: preserve historical actual on current shift if already assigned
      if (!customAssignments[currentShift.shiftId] || customAssignments[currentShift.shiftId].length === 0) {
        var currentAssigned = slotsToProcess.map(function(s) { return s.staffId; }).filter(Boolean);
        customAssignments[currentShift.shiftId] = currentAssigned;
      }
    }

    // Scenario A: New instruction attempted on historical source - lock to 1, no future propagation
    if (isNewInstructionOnHistorical) {
      auditLog.push({
        shiftId: currentShift.shiftId,
        action: 'historical_source_immutable',
        message: 'Current shift is in the past; new rostering propagation locked to 1.'
      });
      // Register current manual provenance
      slotsToProcess.forEach(function(slot) {
        if (slot.staffId) {
          provenance[currentShift.shiftId + ':' + slot.staffId] = {
            source: 'manual',
            slotId: slot.slotId,
            appliedAt: new Date().toISOString()
          };
        }
      });
      return {
        success: true,
        customAssignments: customAssignments,
        rosteringState: { instructions: instructions, provenance: provenance },
        auditLog: auditLog,
        affectedOccurrences: affectedOccurrences,
        prunedProvenance: prunedProvenance,
        prunedInstructions: prunedInstructions
      };
    }

    var staffMap = {};
    roster.forEach(function(s) { staffMap[s.id] = s; });

    // Determine series with multi-year resolution
    var maxRequestedRepeat = slotsToProcess.reduce(function(acc, s) {
      return Math.max(acc, parseInt(s.repeatCount, 10) || 1);
    }, 1);

    var remaining = this.resolveRemainingOccurrences(currentShift.shiftId, allShifts, job, maxRequestedRepeat, jobsList);
    if (Array.isArray(remaining)) {
      for (var rIdx = 0; rIdx < remaining.length; rIdx++) {
        var rOcc = remaining[rIdx];
        if (rOcc && rOcc.shiftId) {
          affectedOccurrences[rOcc.shiftId] = rOcc;
        }
      }
    }

    // 2. PROPAGATION: Process each slot
    for (var i = 0; i < slotsToProcess.length; i++) {
      var slot = slotsToProcess[i];
      var staffId = slot.staffId;
      var staff = staffMap[staffId];
      var slotId = slot.slotId || ('slot-' + i);
      var mode = String(slot.mode || 'manual').toLowerCase();
      var repeatCount = Math.max(1, Math.min(parseInt(slot.repeatCount, 10) || 1, remaining.length, this.UI_REPEAT_CAP));

      // Defect C: If slot is inherited from an upstream source instruction, preserve it without creating a new instruction
      if (slot.isInherited) {
        auditLog.push({
          shiftId: currentShift.shiftId,
          slotId: slotId,
          employeeId: staffId,
          mode: mode,
          action: 'inherited_slot_preserved',
          message: 'Slot ' + slotId + ' is inherited from source instruction; preserved without creating duplicate instruction.'
        });
        continue;
      }

      var currentProvKey = currentShift.shiftId + ':' + staffId;

      if (isSourceHistorical) {
        // Historical source: currentShift actual assignment and provenance are immutable.
        // Determine future occurrences in remaining and feed into the canonical propagation engine.
        var matchingOldInst = existingShiftInstructions.find(function(inst) { return inst.slotId === slotId; });
        var histCount = 0;
        if (matchingOldInst) {
          var oldSeriesForHist = window.HortOpsRosteringEngine.resolveSeries(job, allShifts, matchingOldInst.repeatCount + 2, jobsList, currentShift.shiftId);
          var histStartIdx = oldSeriesForHist.findIndex(function(s) { return s.shiftId === currentShift.shiftId; });
          if (histStartIdx !== -1) {
            for (var h = 0; h < matchingOldInst.repeatCount; h++) {
              var occIdx = histStartIdx + h;
              if (occIdx < oldSeriesForHist.length && (oldSeriesForHist[occIdx].date || '') < todayStr) {
                histCount++;
              }
            }
          }
        }

        var futureOccurrences = remaining.filter(function(occ) { return (occ.date || '') >= todayStr; });
        var futureRepeatNeeded = Math.max(0, repeatCount - histCount);

        if (futureRepeatNeeded > 0 && futureOccurrences.length > 0) {
          var firstFutureOcc = futureOccurrences[0];
          var forwardRepeatCount = Math.min(futureRepeatNeeded, futureOccurrences.length);

          if (mode === 'manual') {
            if (!customAssignments[firstFutureOcc.shiftId]) {
              customAssignments[firstFutureOcc.shiftId] = (firstFutureOcc.assignedStaffIds || []).slice();
            }
            var fAssigned = customAssignments[firstFutureOcc.shiftId].slice();
            var fCrewLimit = firstFutureOcc.crewSize || (job && job.crewSize) || 1;
            if (fAssigned.length < fCrewLimit) {
              if (fAssigned.indexOf(staffId) === -1) fAssigned.push(staffId);
              customAssignments[firstFutureOcc.shiftId] = fAssigned;
              provenance[firstFutureOcc.shiftId + ':' + staffId] = {
                source: 'manual',
                slotId: slotId,
                appliedAt: new Date().toISOString()
              };
            }
          } else {
            var forwardInstId = 'ROSTER-' + job.id + '-' + firstFutureOcc.date + '-' + slotId;
            var forwardInstruction = {
              id: forwardInstId,
              instructionId: forwardInstId,
              jobId: job.id,
              slotId: slotId,
              mode: mode,
              employeeId: staffId,
              sourceShiftId: firstFutureOcc.shiftId,
              startShiftId: firstFutureOcc.shiftId,
              startDate: firstFutureOcc.date,
              repeatCount: forwardRepeatCount,
              status: 'active',
              lineageRootId: matchingOldInst ? (matchingOldInst.lineageRootId || matchingOldInst.id) : forwardInstId,
              predecessorInstructionId: matchingOldInst ? matchingOldInst.id : null,
              createdAt: new Date().toISOString()
            };
            instructions[forwardInstId] = forwardInstruction;

            var previousHolderId = (matchingOldInst && matchingOldInst.employeeId) || staffId;

            for (var fk = 0; fk < forwardRepeatCount; fk++) {
              var fOcc = futureOccurrences[fk];
              var propRes = this.propagateOccurrence({
                occurrence: fOcc,
                sequenceIndex: fk,
                job: job,
                slotId: slotId,
                slotIndex: i,
                mode: mode,
                staffId: staffId,
                staff: staff,
                instructionId: forwardInstId,
                sourceShiftId: firstFutureOcc.shiftId,
                previousHolderId: previousHolderId,
                customAssignments: customAssignments,
                provenance: provenance,
                allShifts: allShifts,
                roster: roster,
                auditLog: auditLog,
                todayStr: todayStr,
                matchingOldInstId: matchingOldInst ? matchingOldInst.id : null
              });
              previousHolderId = propRes.previousHolderId;
            }
          }
        }
        continue;
      }

      // Ordinary future source:
      if (mode === 'manual') {
        provenance[currentProvKey] = {
          source: 'manual',
          slotId: slotId,
          appliedAt: new Date().toISOString()
        };
        auditLog.push({
          shiftId: currentShift.shiftId,
          slotId: slotId,
          employeeId: staffId,
          mode: 'manual',
          action: 'assigned_manual'
        });
        continue;
      }

      var existingSlotInst = existingShiftInstructions.find(function(inst) { return inst.slotId === slotId; });
      if (!existingSlotInst) {
        existingSlotInst = Object.values(instructions).find(function(inst) {
          return inst && inst.jobId === job.id && inst.slotId === slotId && inst.status === 'active';
        });
      }

      var instructionId = 'ROSTER-' + job.id + '-' + currentShift.date + '-' + slotId;
      var lineageRootId = instructionId;
      var predecessorInstructionId = null;

      if (existingSlotInst) {
        lineageRootId = existingSlotInst.lineageRootId || existingSlotInst.id;
        if (existingSlotInst.sourceShiftId === currentShift.shiftId) {
          predecessorInstructionId = (existingSlotInst.predecessorInstructionId !== undefined) ? existingSlotInst.predecessorInstructionId : null;
        } else {
          predecessorInstructionId = existingSlotInst.id;
          // When a new downstream continuation is established, seal the upstream predecessor as historical
          existingSlotInst.status = 'historical';
          var oldSeries = window.HortOpsRosteringEngine.resolveSeries(job, allShifts, existingSlotInst.repeatCount + 2, jobsList, existingSlotInst.sourceShiftId);
          var handoverIdx = oldSeries.findIndex(function(s) { return s.shiftId === currentShift.shiftId; });
          if (handoverIdx !== -1 && handoverIdx < existingSlotInst.repeatCount) {
            existingSlotInst.repeatCount = handoverIdx;
          }
          instructions[existingSlotInst.id] = existingSlotInst;
        }
      }

      var instruction = {
        id: instructionId,
        instructionId: instructionId,
        jobId: job.id,
        slotId: slotId,
        mode: mode,
        employeeId: staffId,
        sourceShiftId: currentShift.shiftId,
        startShiftId: currentShift.shiftId,
        startDate: currentShift.date,
        repeatCount: repeatCount,
        status: 'active',
        lineageRootId: lineageRootId,
        predecessorInstructionId: predecessorInstructionId,
        createdAt: (existingSlotInst && existingSlotInst.sourceShiftId === currentShift.shiftId && existingSlotInst.createdAt) ? existingSlotInst.createdAt : new Date().toISOString()
      };
      instructions[instructionId] = instruction;

      provenance[currentProvKey] = {
        source: 'rostering-rule',
        strategy: mode,
        instructionId: instructionId,
        slotId: slotId,
        sourceShiftId: currentShift.shiftId,
        sequenceIndex: 0
      };

      var previousHolderId = staffId;

      for (var k = 1; k < repeatCount && k < remaining.length; k++) {
        var targetOccurrence = remaining[k];
        var propRes = this.propagateOccurrence({
          occurrence: targetOccurrence,
          sequenceIndex: k,
          job: job,
          slotId: slotId,
          slotIndex: i,
          mode: mode,
          staffId: staffId,
          staff: staff,
          instructionId: instructionId,
          sourceShiftId: currentShift.shiftId,
          previousHolderId: previousHolderId,
          customAssignments: customAssignments,
          provenance: provenance,
          allShifts: allShifts,
          roster: roster,
          auditLog: auditLog,
          todayStr: todayStr,
          matchingOldInstId: null
        });
        previousHolderId = propRes.previousHolderId;
      }
    }

    return {
      success: true,
      customAssignments: customAssignments,
      rosteringState: {
        instructions: instructions,
        provenance: provenance
      },
      auditLog: auditLog,
      affectedOccurrences: affectedOccurrences,
      prunedProvenance: prunedProvenance,
      prunedInstructions: prunedInstructions
    };
  },

  /**
   * Safely reduces or deletes future assignments originating from a specific instruction.
   * NEVER modifies manual assignments or assignments from other instructions.
   */
  pruneInstructionAssignments: function(instructionId, newRepeatCount, customAssignments, rosteringState, series) {
    if (!instructionId || !rosteringState || !rosteringState.instructions) {
      return customAssignments;
    }
    var inst = rosteringState.instructions[instructionId];
    if (!inst) return customAssignments;

    newRepeatCount = parseInt(newRepeatCount, 10) || 0;
    var provenance = rosteringState.provenance || {};

    var startIndex = series.findIndex(function(s) { return s.shiftId === (inst.sourceShiftId || inst.startShiftId); });
    if (startIndex === -1) return customAssignments;

    for (var k = newRepeatCount; k < inst.repeatCount; k++) {
      var occIndex = startIndex + k;
      if (occIndex >= series.length) break;
      var occ = series[occIndex];
      var shiftId = occ.shiftId;
      var assigned = (customAssignments[shiftId] || []).slice();

      var pruned = [];
      assigned.forEach(function(empId) {
        var pKey = shiftId + ':' + empId;
        var p = provenance[pKey];
        if (p && p.instructionId === instructionId && p.source === 'rostering-rule') {
          delete provenance[pKey];
        } else {
          pruned.push(empId);
        }
      });
      customAssignments[shiftId] = pruned;
    }

    if (newRepeatCount <= 1) {
      delete rosteringState.instructions[instructionId];
    } else {
      inst.repeatCount = newRepeatCount;
    }

    return customAssignments;
  }
};
