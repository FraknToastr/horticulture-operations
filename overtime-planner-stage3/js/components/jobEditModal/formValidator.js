// Job editor validation uses the same dates as preview, planner and rostering.
window.HortOpsJobEditFormValidator = {
    validate: function(formData) {
        if (!formData || !formData.name || !formData.name.trim()) return {valid:false,message:'Please specify a valid Job Name.'};
        if (!window.HortOpsRecurrence) return {valid:false,message:'Canonical recurrence validation unavailable.'};
        var check = window.HortOpsRecurrence.validate(formData);
        if (!check.valid) return {valid:false,message:check.error};
        if (!formData.staffingSections || formData.staffingSections.teams !== false) {
            var primary = formData.primaryTeam || formData.defaultTeam || 'Parks';
            formData.primaryTeam = primary;
            formData.defaultTeam = primary;
            formData.preferredTeam = primary;
        }
        return {valid:true};
    },
  // Offline17.5f: Resolves chronologically ordered occurrence dates for an instruction
  resolveInstructionOccurrences: function(job, startShiftIdOrDate, repeatCount) {
    if (!job || !startShiftIdOrDate) return [];
    var count = Math.max(1, parseInt(repeatCount, 10) || 1);
    var sDate = startShiftIdOrDate.indexOf('@') !== -1 ? startShiftIdOrDate.split('@')[1] : startShiftIdOrDate;
    var baseYear = parseInt(sDate.split('-')[0], 10) || new Date().getFullYear();
    var shiftId = startShiftIdOrDate.indexOf('@') !== -1 ? startShiftIdOrDate : (job.id + '@' + startShiftIdOrDate);

    // Inactive jobs generate no occurrences
    if (String(job.status || '').trim().toLowerCase() !== 'active') {
      return [];
    }

    if (!window.HortOpsScheduler || typeof window.HortOpsScheduler.generateOperationalDigest !== 'function') {
      return [sDate];
    }

    var digest = window.HortOpsScheduler.generateOperationalDigest([job], baseYear);
    var baseShifts = (digest && digest.allShifts) ? digest.allShifts.filter(function(s) { return s && s.jobId === job.id; }) : [];

    if (!window.HortOpsRosteringEngine || typeof window.HortOpsRosteringEngine.resolveRemainingOccurrences !== 'function') {
      var found = baseShifts.find(function(s) { return s.shiftId === shiftId || s.date === sDate; });
      return found ? [found.date] : [];
    }

    var remaining = window.HortOpsRosteringEngine.resolveRemainingOccurrences(
      shiftId,
      baseShifts,
      job,
      count + 2,
      [job]
    );

    return remaining.slice(0, count).map(function(s) { return s.date; });
  },

  // Offline17.5i: Detects if proposed Job mutations alter operational occurrence generation
  doesProposedJobChangeOperationalSchedule: function(existingJob, proposedJob) {
    if (!existingJob || !proposedJob) return false;
        var recurrenceFields = ['frequencyType', 'intervalWeeks', 'anchorDate', 'anchorWeek', 'targetDate', 'targetMonth', 'preferredDay', 'status', 'workPattern', 'annualRule', 'seasonalRule', 'scheduleEnd'];
    return recurrenceFields.some(function(field) {
      if (proposedJob[field] === undefined && existingJob[field] === undefined) return false;
            if (['workPattern','annualRule','seasonalRule','scheduleEnd'].indexOf(field) !== -1) return JSON.stringify(proposedJob[field] || null) !== JSON.stringify(existingJob[field] || null);
      return String(proposedJob[field] || '') !== String(existingJob[field] || '');
    });
  },

  // Offline17.5f & 17.5i: Scheduling compatibility guard for active future rostering
  validateSchedulingCompatibility: function(existingJob, formData, workspace) {
    if (!existingJob || typeof existingJob !== 'object' || !formData || typeof formData !== 'object') {
      return { valid: true };
    }

    var hasRecurrenceChanged = this.doesProposedJobChangeOperationalSchedule(existingJob, formData);

    if (!hasRecurrenceChanged) {
      return { valid: true };
    }

    var state = workspace || (window.HortOpsApp ? window.HortOpsApp.state : null) || {};
    var instructions = (state.rostering && state.rostering.instructions) || {};
    var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey()
      : new Date().toISOString().slice(0, 10);

    var isStatusDeactivating = (formData.status !== undefined) &&
                               (String(formData.status).toLowerCase() !== 'active') &&
                               (String(existingJob.status || '').toLowerCase() === 'active');

    var candidateMergedJob = Object.assign({}, existingJob, formData);
    var instructionsToSeal = [];
    var instKeys = Object.keys(instructions);

    for (var i = 0; i < instKeys.length; i++) {
      var inst = instructions[instKeys[i]];
      if (!inst || inst.jobId !== existingJob.id) continue;

      // Historical instructions are sealed recorded facts and NEVER block Job schedule changes
      if (inst.status === 'historical') continue;

      var status = inst.status || 'active';
      if (status !== 'active') continue;

      var sDate = inst.startDate;
      if (!sDate && inst.sourceShiftId && inst.sourceShiftId.indexOf('@') !== -1) {
        sDate = inst.sourceShiftId.split('@')[1];
      }
      if (!sDate) continue;

      var repeatCount = Math.max(1, parseInt(inst.repeatCount, 10) || 1);

      // Resolve current occurrence sequence under existingJob
      var currentOccs = this.resolveInstructionOccurrences(existingJob, inst.sourceShiftId || sDate, repeatCount);
      var currentFutureOccs = currentOccs.filter(function(d) { return d >= todayStr; });

      // Offline17.5g: Fail-closed on unresolvable active instructions.
      // If status === 'active' and currentOccs is empty, the instruction claims active authority
      // but cannot be resolved against the existing schedule. This must fail closed.
      if (status === 'active' && currentOccs.length === 0) {
        return {
          valid: false,
          message: 'Active rostering for this Job could not be resolved against the current schedule. Resolve the rostering integrity issue before changing the Job.'
        };
      }

      // Offline17.5i: If instruction has no future work under existingJob, it is fully exhausted.
      // Any schedule-affecting Job mutation (recurrence change or retirement) must seal exhausted
      // active instructions to historical before the mutation takes effect, preventing recurrence
      // changes from resurrecting completed instructions into future scope.
      if (currentFutureOccs.length === 0) {
        instructionsToSeal.push(inst.id || instKeys[i]);
        continue;
      }

      if (isStatusDeactivating) {
        return {
          valid: false,
          message: 'This Job has active future rostering and cannot be made inactive until that rostering is ended or revised.'
        };
      }

      // Resolve proposed occurrence sequence under candidateMergedJob
      var proposedOccs = this.resolveInstructionOccurrences(candidateMergedJob, inst.sourceShiftId || sDate, repeatCount);
      var proposedFutureOccs = proposedOccs.filter(function(d) { return d >= todayStr; });

      var isMatch = (currentFutureOccs.length === proposedFutureOccs.length) &&
                    currentFutureOccs.every(function(d, idx) { return d === proposedFutureOccs[idx]; });

      if (!isMatch) {
        return {
          valid: false,
          message: 'This Job has active future rostering based on its current schedule. End or revise that rostering before changing the Job schedule.'
        };
      }
    }

    // Check future manual assignments / custom assignments (ignoring historical-sealed records)
    var assignments = state.customAssignments || state.assignments || {};
    var prov = (state.rostering && state.rostering.provenance) || {};
    var assignKeys = Object.keys(assignments);
    for (var a = 0; a < assignKeys.length; a++) {
      var aKey = assignKeys[a];
      if (aKey.indexOf(existingJob.id + '@') === 0 || aKey.indexOf(existingJob.id + '_') === 0) {
        var aDate = aKey.indexOf('@') !== -1 ? aKey.split('@')[1] : aKey.split('_')[1];
        var staffIds = assignments[aKey] || [];
        if (aDate >= todayStr && staffIds.length > 0) {
          // If all assignees on this shift belong to sealed historical instructions, do not block
          var hasActiveOrManual = false;
          for (var s = 0; s < staffIds.length; s++) {
            var pEntry = prov[aKey + ':' + staffIds[s]];
            if (pEntry && pEntry.instructionId) {
              var linkedInst = instructions[pEntry.instructionId];
              // Offline17.5j (Invariant I2 Defence-in-Depth):
              // If an assignment on or after today resolves via provenance to a historical instruction,
              // treat this as an integrity contradiction and fail closed rather than ignoring it.
              if (linkedInst && linkedInst.status === 'historical') {
                return {
                  valid: false,
                  message: 'Future assignment on ' + aDate + ' is linked to a historical instruction. Resolve this rostering contradiction before changing the Job.'
                };
              }
            }
            hasActiveOrManual = true;
            break;
          }

          if (!hasActiveOrManual) {
            continue;
          }

          var isStillValid = false;
          if (String(candidateMergedJob.status || '').trim().toLowerCase() === 'active') {
            if (candidateMergedJob.frequencyType === 'work_pattern') {
              isStillValid = !!window.HortOpsPlanningRules && window.HortOpsPlanningRules.dates(candidateMergedJob, parseInt(aDate.slice(0,4),10)).indexOf(aDate) !== -1;
            } else if (window.HortOpsScheduler && typeof window.HortOpsScheduler.isCanonicalOperationalOccurrence === 'function') {
              isStillValid = window.HortOpsScheduler.isCanonicalOperationalOccurrence(candidateMergedJob, aDate);
            } else if (window.HortOpsSchedulerEngine && typeof window.HortOpsSchedulerEngine.isCanonicalOperationalOccurrence === 'function') {
              isStillValid = window.HortOpsSchedulerEngine.isCanonicalOperationalOccurrence(candidateMergedJob, aDate);
            }
          }
          if (!isStillValid) {
            if (isStatusDeactivating) {
              return {
                valid: false,
                message: 'This Job has active future rostering and cannot be made inactive until that rostering is ended or revised.'
              };
            }
            return {
              valid: false,
              message: 'This Job has active future rostering based on its current schedule. End or revise that rostering before changing the Job schedule.'
            };
          }
        }
      }
    }

    return { valid: true, instructionsToSeal: instructionsToSeal };
  },

  // Offline17.5h: Shared lifecycle transition helper for status changes
  prepareJobStatusTransition: function(existingJob, proposedStatus, workspace) {
    if (!existingJob) return { allowed: false, instructionsToSeal: [], reason: 'Job not found' };
    var candidate = Object.assign({}, existingJob, { status: proposedStatus });
    var res = this.validateSchedulingCompatibility(existingJob, candidate, workspace);
    return {
      allowed: res.valid,
      instructionsToSeal: res.instructionsToSeal || [],
      reason: res.message || null
    };
  },

  // Offline17.5i: General schedule mutation helper
  prepareJobScheduleMutation: function(existingJob, proposedChanges, workspace) {
    if (!existingJob) return { allowed: false, instructionsToSeal: [], reason: 'Job not found' };
    var candidate = Object.assign({}, existingJob, proposedChanges);
    var res = this.validateSchedulingCompatibility(existingJob, candidate, workspace);
    return {
      allowed: res.valid,
      instructionsToSeal: res.instructionsToSeal || [],
      reason: res.message || null
    };
  },

  validateRecurrenceCompatibility: function(existingJob, formData, workspace) {
    return this.validateSchedulingCompatibility(existingJob, formData, workspace);
  }
};
