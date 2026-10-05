// Canonical Schema v2 Envelope & Entity Validator
// Enforces schema specifications, entity integrity rules, status allow-lists, weekday alignment,
// and fail-closed validation of assisted rostering instructions and provenance.
if (typeof require !== "undefined") {
  if (typeof window === "undefined") {
    global.window = global;
  }
  if (typeof window.HortOpsSchedulerEngine === "undefined") {
    try { require("../scheduler/engine.js"); } catch (e) {}
  }
  if (typeof window.HortOpsScheduler === "undefined") {
    try { require("../scheduler.js"); } catch (e) {}
  }
  if (typeof window.HortOpsQualifications === "undefined") {
    try { require("../qualifications.js"); } catch (e) {}
  }
}

window.HortOpsSchemaValidator = {
  WORKSPACE_SCHEMA_VERSION: 2,

  /**
   * Deterministically normalizes legacy Schema v2 workspace instructions without lineage annotations.
   * Chained lineage links and terminal active statuses are reconstructed for non-overlapping sequential instructions.
   * Preserves modern valid 17.5 lineage annotations. Idempotent across repeated executions.
   * Ambiguous or conflicting historical states are left un-annotated so Pass 2 validation can fail closed into Recovery Mode.
   * @param {Object} workspace
   * @returns {Object} workspace
   */
  normalizeLineage: function(workspace) {
    if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace) || !workspace.rostering) {
      return workspace;
    }
    var instructions = workspace.rostering.instructions;
    if (!instructions || typeof instructions !== 'object' || Array.isArray(instructions)) {
      return workspace;
    }

    var provenance = (workspace.rostering.provenance && typeof workspace.rostering.provenance === 'object' && !Array.isArray(workspace.rostering.provenance))
      ? workspace.rostering.provenance
      : {};

    var jobsList = Array.isArray(workspace.jobs) ? workspace.jobs : [];

    var instKeys = Object.keys(instructions);
    var groups = {};
    for (var i = 0; i < instKeys.length; i++) {
      var k = instKeys[i];
      var inst = instructions[k];
      if (inst && typeof inst === 'object' && !Array.isArray(inst) && inst.jobId && inst.slotId) {
        var gKey = inst.jobId + ':' + inst.slotId;
        if (!groups[gKey]) groups[gKey] = [];
        groups[gKey].push(inst);
      }
    }

    var gKeys = Object.keys(groups);
    for (var g = 0; g < gKeys.length; g++) {
      var list = groups[gKeys[g]];
      var anyMissingStatus = list.some(function(item) {
        return item.status === undefined || item.status === null;
      });

      if (!anyMissingStatus) {
        // Lineage already fully annotated (e.g. Modern 17.5 workspace or already normalized)
        continue;
      }

      var allMissingStatus = list.every(function(item) {
        return item.status === undefined || item.status === null;
      });

      if (!allMissingStatus) {
        // Offline17.5b: Mixed modern/legacy group: some instructions have status, some lack status.
        // Rule: Existing authoritative modern metadata must NOT be overwritten!
        // Leave un-annotated to fail closed into Recovery Mode.
        continue;
      }

      // Multiple un-annotated legacy instructions: require positive proof of non-overlap
      var getDate = function(item) {
        if (item.startDate) return item.startDate;
        var sShift = item.sourceShiftId || item.startShiftId;
        if (sShift && sShift.indexOf("@") !== -1) return sShift.split("@")[1];
        return "";
      };

      var allDatesValid = list.every(function(item) { return !!getDate(item); });
      if (!allDatesValid) {
        // Ambiguous: leave un-annotated to fail closed in Pass 2
        continue;
      }

      var job = jobsList.find(function(j) { return j && j.id === list[0].jobId; });
      if (!job) {
        // Unknown job: cannot prove canonical recurrence, fail closed
        continue;
      }

      // Offline17.5e: Canonical Operational Occurrence Verification helper (Authoritative Ledger only)
      // Raw workspace envelope fields (like workspace.shifts) cannot manufacture proof of explicit occurrences.
      var isOpOccurrence = function(j, dateStr, shiftId) {
        if (window.HortOpsScheduler && typeof window.HortOpsScheduler.isCanonicalOperationalOccurrence === "function") {
          return window.HortOpsScheduler.isCanonicalOperationalOccurrence(j, shiftId || dateStr);
        }
        if (window.HortOpsSchedulerEngine && typeof window.HortOpsSchedulerEngine.isCanonicalOperationalOccurrence === "function") {
          return window.HortOpsSchedulerEngine.isCanonicalOperationalOccurrence(j, shiftId || dateStr);
        }
        return false;
      };

      // Offline17.5d: Universal Pre-Shortcut Validation
      // Prove that EVERY candidate legacy instruction source is a canonical operational occurrence
      var allValidSources = list.every(function(item) {
        var sShift = item.sourceShiftId || item.startShiftId;
        var sDate = getDate(item);
        if (!sShift || !sDate) return false;
        if (sShift.indexOf("@") === -1) return false;
        var parts = sShift.split("@");
        if (parts[0] !== job.id || parts[1] !== sDate) return false;
        return isOpOccurrence(job, sDate, sShift);
      });

      if (!allValidSources) {
        // Non-operational source occurrence: refuse normalisation, fail closed without mutating
        continue;
      }

      // Offline17.5d: Pure legacy single-instruction group (proven valid operational source)
      if (list.length === 1) {
        var sole = list[0];
        sole.status = "active";
        if (!sole.lineageRootId) sole.lineageRootId = sole.id;
        if (sole.predecessorInstructionId === undefined) sole.predecessorInstructionId = null;
        continue;
      }

      // Offline17.5d: One-off jobs cannot have multiple source instructions in a continuation chain
      if (job.frequencyType === "one_off") {
        continue;
      }

      var sorted = list.slice().sort(function(a, b) {
        var da = getDate(a);
        var db = getDate(b);
        if (da < db) return -1;
        if (da > db) return 1;
        return 0;
      });

      var strictlyNonOverlapping = true;

      for (var s = 0; s < sorted.length - 1; s++) {
        var curr = sorted[s];
        var next = sorted[s + 1];
        var currStart = getDate(curr);
        var nextStart = getDate(next);

        if (currStart >= nextStart) {
          strictlyNonOverlapping = false;
          break;
        }

        // Check 1: Provenance explicitly owned by curr instruction
        var provKeys = Object.keys(provenance);
        var currProvDates = [];
        for (var pk = 0; pk < provKeys.length; pk++) {
          var p = provenance[provKeys[pk]];
          if (p && p.instructionId === curr.id) {
            var targetShift = p.targetShiftId || provKeys[pk].split(':')[0];
            if (targetShift && targetShift.indexOf('@') !== -1) {
              currProvDates.push(targetShift.split('@')[1]);
            }
          }
        }

        if (currProvDates.length > 0) {
          currProvDates.sort();
          var maxProvDate = currProvDates[currProvDates.length - 1];
          if (maxProvDate >= nextStart) {
            strictlyNonOverlapping = false;
            break;
          }
        }

        // Check 2: Repeat contract & recurrence interval
        var currRepeat = parseInt(curr.repeatCount, 10) || 1;
        if (job) {
          if (job.frequencyType === 'recurring_weeks' || job.frequencyType === 'recurring_cadence') {
            var intervalWeeks = Math.max(1, parseInt(job.intervalWeeks, 10) || 1);
            var intervalDays = intervalWeeks * 7;
            var dt = new Date(currStart + 'T12:00:00Z');
            dt.setUTCDate(dt.getUTCDate() + (currRepeat - 1) * intervalDays);
            var currEnd = dt.toISOString().slice(0, 10);
            if (currEnd >= nextStart) {
              strictlyNonOverlapping = false;
              break;
            }
          } else if (job.frequencyType === 'annual') {
            var startYear = parseInt(currStart.slice(0, 4), 10);
            var endYear = startYear + (currRepeat - 1);
            var nextYear = parseInt(nextStart.slice(0, 4), 10);
            if (endYear >= nextYear) {
              strictlyNonOverlapping = false;
              break;
            }
          }
        }
      }

      if (!strictlyNonOverlapping) {
        // Overlapping / ambiguous legacy state: leave un-annotated to fail closed into Recovery Mode!
        continue;
      }

      // Deterministically chain the verified non-overlapping lineage:
      var rootId = sorted[0].id;
      for (var idx = 0; idx < sorted.length; idx++) {
        var c = sorted[idx];
        c.lineageRootId = rootId;
        if (idx < sorted.length - 1) {
          c.status = 'historical';
          c.predecessorInstructionId = (idx === 0) ? null : sorted[idx - 1].id;
        } else {
          c.status = 'active';
          c.predecessorInstructionId = sorted[idx - 1].id;
        }
      }
    }

    return workspace;
  },

  validate: function(parsed) {
    return this.validateWorkspaceSchema(parsed);
  },

  /**
   * Validates workspace JSON object against canonical Schema v2 specification.
   * @param {Object} parsed - Candidate workspace object
   * @returns {{ valid: boolean, error?: string }}
   */
  validateWorkspaceSchema: function(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, error: 'Invalid JSON: root must be an object envelope.' };
    }
    this.normalizeLineage(parsed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false, error: 'Invalid JSON: root must be an object envelope.' };
    }
    if (
      parsed.schemaVersion === undefined ||
      parsed.schemaVersion === null ||
      typeof parsed.schemaVersion !== 'number' ||
      !Number.isInteger(parsed.schemaVersion) ||
      parsed.schemaVersion !== this.WORKSPACE_SCHEMA_VERSION
    ) {
      return { valid: false, error: 'Unsupported or missing workspace schema version ' + parsed.schemaVersion + '. Canonical workspace requires integer Schema v2.' };
    }
    if (!Array.isArray(parsed.jobs)) {
      return { valid: false, error: 'Missing or invalid "jobs" array in workspace backup.' };
    }
    if (!Array.isArray(parsed.roster)) {
      return { valid: false, error: 'Missing or invalid "roster" array in workspace backup.' };
    }

    var validDays = ['friday', 'saturday', 'sunday', 'monday', 'friday_pre_holiday', 'monday_post_holiday'];
    var validFreqs = ['recurring_weeks', 'recurring_cadence', 'annual', 'one_off'];
    var seenJobIds = new Set();

    for (var i = 0; i < parsed.jobs.length; i++) {
      var j = parsed.jobs[i];
      if (!j || typeof j !== 'object' || Array.isArray(j)) {
        return { valid: false, error: 'Invalid Job object at index ' + i };
      }
      if (!j.id || !j.name) {
        return { valid: false, error: 'Job at index ' + i + ' missing required id or name.' };
      }
      if (!/^[A-Za-z0-9_-]+$/.test(String(j.id))) {
        return { valid: false, error: 'Job ID "' + j.id + '" contains invalid characters. Only letters, numbers, hyphens, and underscores are permitted.' };
      }
      var upperJobId = String(j.id).trim().toUpperCase();
      if (seenJobIds.has(upperJobId)) {
        return { valid: false, error: 'Duplicate Job ID detected in workspace: ' + j.id + '. All job IDs must be globally unique.' };
      }
      seenJobIds.add(upperJobId);

      var validJobStatuses = ['active', 'inactive', 'resolved', 'draft', 'archived'];
      if (j.status === undefined || j.status === null || String(j.status).trim() === '') {
        return { valid: false, error: 'Job "' + j.name + '" missing required status field in Schema v2.' };
      }
      var jobStatusStr = String(j.status).trim().toLowerCase();
      if (validJobStatuses.indexOf(jobStatusStr) === -1) {
        return { valid: false, error: 'Job "' + j.name + '" has unsupported status "' + j.status + '".' };
      }

      if (!j.frequencyType || validFreqs.indexOf(j.frequencyType) === -1) {
        return { valid: false, error: 'Job "' + j.name + '" has unsupported frequencyType: ' + j.frequencyType };
      }

      if (j.frequencyType === 'recurring_weeks' || j.frequencyType === 'recurring_cadence') {
        if (!j.anchorDate || !this.isRealYmd(j.anchorDate)) {
          return { valid: false, error: 'Recurring job "' + j.name + '" requires a valid Gregorian calendar YYYY-MM-DD anchorDate.' };
        }
        if (typeof j.intervalWeeks !== 'number' || !Number.isInteger(j.intervalWeeks) || j.intervalWeeks < 1) {
          return { valid: false, error: 'Recurring job "' + j.name + '" requires an integer intervalWeeks >= 1.' };
        }
        if (j.preferredDay && validDays.indexOf(j.preferredDay.toLowerCase()) === -1) {
          return { valid: false, error: 'Recurring job "' + j.name + '" has unsupported preferredDay: ' + j.preferredDay + '. Only Friday, Saturday, Sunday, and Monday are supported.' };
        }

        var anchorDt = new Date(j.anchorDate + 'T12:00:00');
        var anchorDayOfWeek = anchorDt.getDay(); // 0 Sun, 1 Mon, 5 Fri, 6 Sat
        var pref = (j.preferredDay || 'saturday').toLowerCase();
        var expectedDayOfWeek = (pref === 'sunday') ? 0
                              : (pref === 'monday' || pref === 'monday_post_holiday') ? 1
                              : (pref === 'friday' || pref === 'friday_pre_holiday') ? 5
                              : 6;
        if (anchorDayOfWeek !== expectedDayOfWeek) {
          var dayNames = { 0: 'Sunday', 1: 'Monday', 5: 'Friday', 6: 'Saturday' };
          return { valid: false, error: 'Recurring job "' + j.name + '" anchorDate ' + j.anchorDate + ' falls on ' + (dayNames[anchorDayOfWeek] || 'unknown weekday') + ', which does not match preferredDay (' + j.preferredDay + ').' };
        }
      } else if (j.frequencyType === 'annual') {
        if (!j.targetMonth || typeof j.targetMonth !== 'number' || j.targetMonth < 1 || j.targetMonth > 12) {
          return { valid: false, error: 'Annual job "' + j.name + '" requires a valid targetMonth (1-12).' };
        }
        var validAnnualDays = ['friday', 'saturday', 'sunday', 'monday'];
        if (j.preferredDay && validAnnualDays.indexOf(String(j.preferredDay).toLowerCase()) === -1) {
          return { valid: false, error: 'Annual job "' + j.name + '" has unsupported preferredDay "' + j.preferredDay + '". Only Friday, Saturday, Sunday, and Monday are supported.' };
        }
      } else if (j.frequencyType === 'one_off') {
        if (!j.targetDate || !this.isRealYmd(j.targetDate)) {
          return { valid: false, error: 'One-off job "' + j.name + '" requires a valid Gregorian calendar targetDate (YYYY-MM-DD).' };
        }
        var d = new Date(j.targetDate + 'T12:00:00');
        var dayOfWeek = d.getDay(); // 0 Sun, 1 Mon, 2 Tue, 3 Wed, 4 Thu, 5 Fri, 6 Sat
        if (dayOfWeek >= 2 && dayOfWeek <= 4) {
          return { valid: false, error: 'One-off job "' + j.name + '" date ' + j.targetDate + ' falls on unsupported weekday (Tue/Wed/Thu). Overtime only occurs Fri/Sat/Sun/Mon.' };
        }
      }

      // Stage 3 Gate 3A: Optional requiredQualifications array validation
      if (j.requiredQualifications !== undefined && j.requiredQualifications !== null) {
        if (!Array.isArray(j.requiredQualifications)) {
          return { valid: false, error: 'Job "' + j.name + '" requiredQualifications must be an array.' };
        }
        for (var qIdx = 0; qIdx < j.requiredQualifications.length; qIdx++) {
          var qCode = j.requiredQualifications[qIdx];
          if (typeof qCode !== 'string' || !qCode.trim()) {
            return { valid: false, error: 'Job "' + j.name + '" contains invalid qualification code at index ' + qIdx + '.' };
          }
          var qCodeUpper = qCode.trim().toUpperCase();
          if (window.HortOpsQualifications && typeof window.HortOpsQualifications.isValidCode === 'function') {
            if (!window.HortOpsQualifications.isValidCode(qCodeUpper)) {
              return { valid: false, error: 'Job "' + j.name + '" has unrecognized required qualification code "' + qCode + '".' };
            }
          }
        }
      }
    }

    var validStaffStatuses = ['active', 'departed', 'inactive', 'on_leave', 'temporarily_unavailable'];
    var seenIds = new Set();
    for (var k = 0; k < parsed.roster.length; k++) {
      var s = parsed.roster[k];
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        return { valid: false, error: 'Invalid staff object at index ' + k };
      }
      if (!s.id || !s.name) {
        return { valid: false, error: 'Staff member at index ' + k + ' missing required id or name.' };
      }
      if (!/^[A-Za-z0-9_-]+$/.test(String(s.id))) {
        return { valid: false, error: 'Staff ID "' + s.id + '" contains invalid characters. Only letters, numbers, hyphens, and underscores are permitted.' };
      }
      var upper = String(s.id).toUpperCase();
      if (seenIds.has(upper)) {
        return { valid: false, error: 'Duplicate staff ID detected in backup roster: ' + s.id };
      }
      seenIds.add(upper);

      if (s.status === undefined || s.status === null || String(s.status).trim() === '') {
        return { valid: false, error: 'Staff member "' + s.name + '" missing required status field in Schema v2.' };
      }
      var staffStatusStr = String(s.status).trim().toLowerCase();
      if (validStaffStatuses.indexOf(staffStatusStr) === -1) {
        return { valid: false, error: 'Staff member "' + s.name + '" has unsupported status "' + s.status + '".' };
      }

      // Stage 3 Gate 3A: Optional qualifications array validation
      if (s.qualifications !== undefined && s.qualifications !== null) {
        if (!Array.isArray(s.qualifications)) {
          return { valid: false, error: 'Staff member "' + s.name + '" qualifications must be an array.' };
        }
        var seenQualCodes = new Set();
        for (var sqIdx = 0; sqIdx < s.qualifications.length; sqIdx++) {
          var sq = s.qualifications[sqIdx];
          if (!sq || typeof sq !== 'object' || Array.isArray(sq)) {
            return { valid: false, error: 'Staff member "' + s.name + '" has invalid qualification object at index ' + sqIdx + '.' };
          }
          if (!sq.code || typeof sq.code !== 'string' || !sq.code.trim()) {
            return { valid: false, error: 'Staff member "' + s.name + '" qualification at index ' + sqIdx + ' missing required code.' };
          }
          var sqCodeUpper = sq.code.trim().toUpperCase();
          if (window.HortOpsQualifications && typeof window.HortOpsQualifications.isValidCode === 'function') {
            if (!window.HortOpsQualifications.isValidCode(sqCodeUpper)) {
              return { valid: false, error: 'Staff member "' + s.name + '" has unrecognized qualification code "' + sq.code + '".' };
            }
          }
          if (seenQualCodes.has(sqCodeUpper)) {
            return { valid: false, error: 'Staff member "' + s.name + '" has duplicate qualification code "' + sqCodeUpper + '".' };
          }
          seenQualCodes.add(sqCodeUpper);

          if (sq.status !== undefined && sq.status !== null) {
            var sqStatus = String(sq.status).trim().toLowerCase();
            var validSqStatuses = ['active', 'expired', 'suspended'];
            if (validSqStatuses.indexOf(sqStatus) === -1) {
              return { valid: false, error: 'Staff member "' + s.name + '" qualification "' + sqCodeUpper + '" has invalid status "' + sq.status + '".' };
            }
          }
          if (sq.issuedDate !== undefined && sq.issuedDate !== null && sq.issuedDate !== '') {
            if (!this.isRealYmd(sq.issuedDate)) {
              return { valid: false, error: 'Staff member "' + s.name + '" qualification "' + sqCodeUpper + '" has invalid issuedDate (must be YYYY-MM-DD).' };
            }
          }
          if (sq.expiryDate !== undefined && sq.expiryDate !== null && sq.expiryDate !== '') {
            if (!this.isRealYmd(sq.expiryDate)) {
              return { valid: false, error: 'Staff member "' + s.name + '" qualification "' + sqCodeUpper + '" has invalid expiryDate (must be YYYY-MM-DD).' };
            }
            if (sq.issuedDate && sq.expiryDate < sq.issuedDate) {
              return { valid: false, error: 'Staff member "' + s.name + '" qualification "' + sqCodeUpper + '" expiryDate cannot precede issuedDate.' };
            }
          }
        }
      }

      // R55-P1-06: Persisted schema purity check - assert no transient UI properties in canonical staff objects
      var staffKeys = Object.keys(s);
      for (var skIdx = 0; skIdx < staffKeys.length; skIdx++) {
        if (staffKeys[skIdx].startsWith('_')) {
          return { valid: false, error: 'Staff member "' + s.name + '" contains transient UI property: ' + staffKeys[skIdx] };
        }
      }
    }

    // Stage 3 Multi-Period Absence Ledger validation (R55-P0-00, Roadmap Section 2.3, Review 60 P0 & P1)
    if (Object.prototype.hasOwnProperty.call(parsed, 'absences') || parsed.absences !== undefined) {
      if (parsed.absences === null || !Array.isArray(parsed.absences)) {
        return { valid: false, error: 'Invalid "absences" property: must be an array.' };
      }
      var seenAbsenceIds = new Set();
      var validAbsenceTypes = ['annual_leave', 'sick_leave', 'rdo', 'long_service', 'training', 'bereavement'];
      for (var aIdx = 0; aIdx < parsed.absences.length; aIdx++) {
        var ab = parsed.absences[aIdx];
        if (!ab || typeof ab !== 'object' || Array.isArray(ab)) {
          return { valid: false, error: 'Absence entry at index ' + aIdx + ' must be an object.' };
        }
        if (!ab.id || typeof ab.id !== 'string' || !ab.id.trim()) {
          return { valid: false, error: 'Absence entry at index ' + aIdx + ' missing required id.' };
        }
        // Review 60 P1 (R60-P1-03): Authoritative schema rejection of duplicate absence identities
        if (seenAbsenceIds.has(ab.id)) {
          return { valid: false, error: 'Absence entry at index ' + aIdx + ' duplicate id "' + ab.id + '".' };
        }
        seenAbsenceIds.add(ab.id);
        if (!ab.staffId || typeof ab.staffId !== 'string' || !ab.staffId.trim()) {
          return { valid: false, error: 'Absence entry at index ' + aIdx + ' missing required staffId.' };
        }
        if (!ab.type || typeof ab.type !== 'string' || validAbsenceTypes.indexOf(ab.type.trim().toLowerCase()) === -1) {
          return { valid: false, error: 'Absence entry at index ' + aIdx + ' has invalid type "' + ab.type + '".' };
        }
        if (!ab.startDate || !this.isRealYmd(ab.startDate)) {
          return { valid: false, error: 'Absence entry at index ' + aIdx + ' has invalid startDate (must be YYYY-MM-DD).' };
        }
        if (!ab.endDate || !this.isRealYmd(ab.endDate)) {
          return { valid: false, error: 'Absence entry at index ' + aIdx + ' has invalid endDate (must be YYYY-MM-DD).' };
        }
        if (ab.endDate < ab.startDate) {
          return { valid: false, error: 'Absence entry at index ' + aIdx + ' endDate (' + ab.endDate + ') cannot precede startDate (' + ab.startDate + ').' };
        }
      }
    }

    // Stage 3 Refusal History validation (R55-P0-00, Section 6.5, Review 59 Gate B & Review 60 P0)
    if (Object.prototype.hasOwnProperty.call(parsed, 'refusalHistory') || parsed.refusalHistory !== undefined) {
      if (parsed.refusalHistory === null || !Array.isArray(parsed.refusalHistory)) {
        return { valid: false, error: 'Invalid "refusalHistory" property: must be an array.' };
      }
      var seenRefusalIds = new Set();
      for (var rhIdx = 0; rhIdx < parsed.refusalHistory.length; rhIdx++) {
        var rh = parsed.refusalHistory[rhIdx];
        if (!rh || typeof rh !== 'object' || Array.isArray(rh)) {
          return { valid: false, error: 'Refusal history entry at index ' + rhIdx + ' must be an object.' };
        }
        if (!rh.id || typeof rh.id !== 'string' || !rh.id.trim()) {
          return { valid: false, error: 'Refusal history entry at index ' + rhIdx + ' missing required id.' };
        }
        if (seenRefusalIds.has(rh.id)) {
          return { valid: false, error: 'Refusal history entry at index ' + rhIdx + ' duplicate id "' + rh.id + '".' };
        }
        seenRefusalIds.add(rh.id);
        if (!rh.staffId || typeof rh.staffId !== 'string' || !rh.staffId.trim()) {
          return { valid: false, error: 'Refusal history entry at index ' + rhIdx + ' missing required staffId.' };
        }
        if (!rh.date || typeof rh.date !== 'string' || !this.isRealYmd(rh.date)) {
          return { valid: false, error: 'Refusal history entry at index ' + rhIdx + ' missing or invalid date (must be YYYY-MM-DD).' };
        }
      }
    }

    // Review 14 B1-14-01: Canonical validation of operational assignments map
    var assignVal = (parsed && parsed.assignments !== undefined) ? parsed.assignments : (parsed ? parsed.customAssignments : undefined);
    var assignRes = this.validateAssignmentsMap(assignVal);
    if (!assignRes.valid) {
      return assignRes;
    }

    // Offline17.1 / Offline17.2 / Offline17.2a: Comprehensive Fail-Closed Validation of Rostering Data
    if (parsed.rostering !== undefined && parsed.rostering !== null) {
      if (typeof parsed.rostering !== 'object' || Array.isArray(parsed.rostering)) {
        return { valid: false, error: 'Invalid rostering structure: root "rostering" property must be an object.' };
      }
      if (parsed.rostering.instructions === undefined || parsed.rostering.instructions === null || typeof parsed.rostering.instructions !== 'object' || Array.isArray(parsed.rostering.instructions)) {
        return { valid: false, error: 'Malformed rostering structure: missing or invalid "rostering.instructions" object map.' };
      }
      if (parsed.rostering.provenance === undefined || parsed.rostering.provenance === null || typeof parsed.rostering.provenance !== 'object' || Array.isArray(parsed.rostering.provenance)) {
        return { valid: false, error: 'Malformed rostering structure: missing or invalid "rostering.provenance" object map.' };
      }

      var allowedModes = ['manual', 'fixed', 'rotation'];
      var validInstructions = new Set();
      var instructionMap = {};

      // Validate instructions
      if (parsed.rostering.instructions !== undefined && parsed.rostering.instructions !== null) {
        if (typeof parsed.rostering.instructions !== 'object' || Array.isArray(parsed.rostering.instructions)) {
          return { valid: false, error: 'Invalid "rostering.instructions": must be a key-value object map.' };
        }

        var instKeys = Object.keys(parsed.rostering.instructions);
        for (var idx = 0; idx < instKeys.length; idx++) {
          var instKey = instKeys[idx];
          var inst = parsed.rostering.instructions[instKey];
          if (!inst || typeof inst !== 'object' || Array.isArray(inst)) {
            return { valid: false, error: 'Instruction "' + instKey + '" must be an object.' };
          }

          var instId = inst.instructionId || inst.id;
          if (!instId || typeof instId !== 'string' || instId.trim() === '') {
            return { valid: false, error: 'Instruction "' + instKey + '" missing valid instructionId.' };
          }

          if (inst.instructionId && instKey !== inst.instructionId) {
            return { valid: false, error: 'Instruction collection key "' + instKey + '" does not match instructionId: ' + inst.instructionId };
          }

          if (instKey !== instId) {
            return { valid: false, error: 'Instruction collection key "' + instKey + '" does not match instructionId: ' + instId };
          }

          if (inst.id && inst.instructionId && inst.id !== inst.instructionId) {
            return { valid: false, error: 'Instruction "' + instKey + '" has mismatched id ("' + inst.id + '") and instructionId ("' + inst.instructionId + '").' };
          }

          // Canonical instruction ID format validation
          if (!/^ROSTER-[A-Za-z0-9_-]+-\d{4}-\d{2}-\d{2}-SLOT-\d+$/i.test(instId)) {
            return { valid: false, error: 'Instruction "' + instKey + '" has non-canonical instructionId: ' + instId };
          }

          if (!inst.jobId || typeof inst.jobId !== 'string' || !seenJobIds.has(String(inst.jobId).trim().toUpperCase())) {
            return { valid: false, error: 'Instruction "' + instId + '" references unknown or invalid jobId: ' + inst.jobId };
          }

          var sourceShift = inst.sourceShiftId || inst.startShiftId;
          if (!sourceShift || typeof sourceShift !== 'string' || !/^([A-Za-z0-9_-]+)@(\d{4}-\d{2}-\d{2})$/.test(sourceShift)) {
            return { valid: false, error: 'Instruction "' + instId + '" missing or malformed sourceShiftId.' };
          }
          var sourceJobPrefix = sourceShift.split('@')[0];
          if (!seenJobIds.has(sourceJobPrefix.toUpperCase())) {
            return { valid: false, error: 'Instruction "' + instId + '" sourceShiftId references unknown jobId: ' + sourceJobPrefix };
          }
          if (sourceJobPrefix.toUpperCase() !== String(inst.jobId).trim().toUpperCase()) {
            return { valid: false, error: 'Instruction "' + instId + '" sourceShiftId job prefix "' + sourceJobPrefix + '" does not match jobId "' + inst.jobId + '".' };
          }

          var jobObj = (parsed.jobs || []).find(function(j) { return j && String(j.id).trim().toUpperCase() === sourceJobPrefix.toUpperCase(); });

          // Offline17.5h: Active Instruction / Active Parent Invariant
          // An active rostering instruction cannot exist under a non-active Job.
          // This check applies across all non-active Job statuses (inactive, draft, archived, resolved)
          // and regardless of whether the source shift is generated recurrence or a trusted explicit occurrence.
          if (inst.status === 'active') {
            if (!jobObj || String(jobObj.status || '').toLowerCase() !== 'active') {
              var jobStatus = jobObj ? jobObj.status : 'missing';
              var jobIdStr = jobObj ? jobObj.id : sourceJobPrefix;
              return { valid: false, error: 'Active rostering instruction "' + (inst.id || instId) + '" belongs to non-active Job "' + jobIdStr + '" (status: "' + jobStatus + '").' };
            }
          }

          // Offline17.5e & 17.5g: Modern historical instructions (status === 'historical') remain recorded historical truth
          // and must NOT be re-derived or invalidated against mutable current Job recurrence definitions.
          // However, modern active instructions (status === 'active') and unannotated legacy instructions claim authority
          // over current/future operations and MUST resolve to a recognized operational occurrence (generated or trusted explicit).
          if (inst.status === 'historical') {
            // Permanently exempt from current recurrence check to preserve historical truth
          } else if (jobObj) {
            var isCanonical = false;
            if (window.HortOpsScheduler && typeof window.HortOpsScheduler.isCanonicalOperationalOccurrence === "function") {
              isCanonical = window.HortOpsScheduler.isCanonicalOperationalOccurrence(jobObj, sourceShift, parsed);
            } else if (window.HortOpsSchedulerEngine && typeof window.HortOpsSchedulerEngine.isCanonicalOperationalOccurrence === "function") {
              isCanonical = window.HortOpsSchedulerEngine.isCanonicalOperationalOccurrence(jobObj, sourceShift, parsed);
            }
            if (!isCanonical) {
              if (inst.status === 'active') {
                return { valid: false, error: 'Active rostering instruction "' + instId + '" source ' + sourceShift + ' is not a recognised operational occurrence of Job ' + jobObj.id + '.' };
              } else {
                return { valid: false, error: 'Legacy rostering source ' + sourceShift + ' is not a recognised operational occurrence of Job ' + jobObj.id + '.' };
              }
            }
          }

          if (!inst.mode || typeof inst.mode !== 'string' || allowedModes.indexOf(inst.mode.toLowerCase()) === -1) {
            return { valid: false, error: 'Instruction "' + instId + '" has unsupported mode "' + inst.mode + '". Allowed: manual, fixed, rotation.' };
          }

          if (typeof inst.repeatCount !== 'number' || !Number.isInteger(inst.repeatCount) || inst.repeatCount < 1 || inst.repeatCount > 12) {
            return { valid: false, error: 'Instruction "' + instId + '" has invalid repeatCount: ' + inst.repeatCount + '. Must be an integer between 1 and 12.' };
          }

          // slotId is strictly REQUIRED
          if (!inst.slotId || typeof inst.slotId !== 'string' || !/^SLOT-\d+$/i.test(inst.slotId.trim())) {
            return { valid: false, error: 'Instruction "' + instId + '" missing or invalid slotId. Must match SLOT-\d+.' };
          }

          if (inst.mode.toLowerCase() === 'fixed') {
            if (!inst.employeeId || typeof inst.employeeId !== 'string' || !seenIds.has(String(inst.employeeId).trim().toUpperCase())) {
              return { valid: false, error: 'Fixed instruction "' + instId + '" requires employeeId resolving to a valid roster member (got: ' + inst.employeeId + ').' };
            }
          }

          if (inst.createdAt !== undefined && (typeof inst.createdAt !== 'string' || isNaN(Date.parse(inst.createdAt)))) {
            return { valid: false, error: 'Instruction "' + instId + '" has invalid createdAt timestamp: ' + inst.createdAt };
          }

          // Offline17.5: Lineage fields validation
          if (inst.status !== undefined && inst.status !== null) {
            if (typeof inst.status !== 'string' || (inst.status !== 'active' && inst.status !== 'historical')) {
              return { valid: false, error: 'Instruction "' + instId + '" has invalid status: ' + inst.status + '. Must be "active" or "historical".' };
            }
          }

          if (inst.lineageRootId !== undefined && inst.lineageRootId !== null) {
            if (typeof inst.lineageRootId !== 'string' || inst.lineageRootId.trim() === '') {
              return { valid: false, error: 'Instruction "' + instId + '" has invalid lineageRootId: must be a non-empty string.' };
            }
          }

          if (inst.predecessorInstructionId !== undefined && inst.predecessorInstructionId !== null) {
            if (typeof inst.predecessorInstructionId !== 'string' || inst.predecessorInstructionId.trim() === '') {
              return { valid: false, error: 'Instruction "' + instId + '" has invalid predecessorInstructionId: must be a string.' };
            }
            if (inst.predecessorInstructionId === instId) {
              return { valid: false, error: 'Instruction "' + instId + '" cannot reference itself as predecessor.' };
            }
          }

          validInstructions.add(instId);
          instructionMap[instId] = inst;
        }

        // Offline17.5: Pass 2 - Lineage chain & active terminal invariants
        var activeTerminalsBySlot = {};
        for (var p2Idx = 0; p2Idx < instKeys.length; p2Idx++) {
          var p2Key = instKeys[p2Idx];
          var p2Inst = instructionMap[p2Key];
          var p2Status = p2Inst.status || 'active'; // Default to active for backward compatibility

          if (p2Inst.predecessorInstructionId) {
            var predId = p2Inst.predecessorInstructionId;
            var predInst = instructionMap[predId];
            if (!predInst) {
              return { valid: false, error: 'Instruction "' + p2Key + '" references nonexistent predecessorInstructionId: ' + predId };
            }
            if (predInst.jobId !== p2Inst.jobId || predInst.slotId !== p2Inst.slotId) {
              return { valid: false, error: 'Predecessor instruction mismatch for "' + p2Key + '": jobId or slotId differs from predecessor "' + predId + '".' };
            }
            if (p2Inst.lineageRootId && predInst.lineageRootId && p2Inst.lineageRootId !== predInst.lineageRootId) {
              return { valid: false, error: 'Predecessor lineageRootId mismatch for "' + p2Key + '": expected ' + predInst.lineageRootId + ', got ' + p2Inst.lineageRootId };
            }

            // Cycle check
            var visitedChain = new Set([p2Key]);
            var curr = predId;
            while (curr) {
              if (visitedChain.has(curr)) {
                return { valid: false, error: 'Lineage cycle detected: instruction "' + p2Key + '" has cyclic predecessor reference to "' + curr + '".' };
              }
              visitedChain.add(curr);
              var next = instructionMap[curr];
              curr = next ? next.predecessorInstructionId : null;
            }
          }

          if (p2Status === 'active') {
            var rootKey = p2Inst.jobId + ':' + p2Inst.slotId;
            activeTerminalsBySlot[rootKey] = (activeTerminalsBySlot[rootKey] || 0) + 1;
            if (activeTerminalsBySlot[rootKey] > 1) {
              return { valid: false, error: 'Multiple active terminal instructions found for slot lineage: ' + p2Inst.jobId + ':' + p2Inst.slotId + ' (count: ' + activeTerminalsBySlot[rootKey] + ').' };
            }
          }
        }
      }

      // Validate provenance
      if (parsed.rostering.provenance !== undefined && parsed.rostering.provenance !== null) {
        if (typeof parsed.rostering.provenance !== 'object' || Array.isArray(parsed.rostering.provenance)) {
          return { valid: false, error: 'Invalid "rostering.provenance": must be a key-value object map.' };
        }

        var provKeys = Object.keys(parsed.rostering.provenance);
        var activeShiftSlotClaims = new Set();
        for (var pIdx = 0; pIdx < provKeys.length; pIdx++) {
          var pKey = provKeys[pIdx];
          var prov = parsed.rostering.provenance[pKey];
          if (!prov || typeof prov !== 'object' || Array.isArray(prov)) {
            return { valid: false, error: 'Provenance entry "' + pKey + '" must be an object.' };
          }

          // Target key format validation: SHIFT_ID:EMPLOYEE_ID
          var keyMatch = pKey.match(/^([A-Za-z0-9_-]+@\d{4}-\d{2}-\d{2}):([A-Za-z0-9_-]+)$/);
          if (!keyMatch) {
            return { valid: false, error: 'Provenance entry "' + pKey + '" has malformed target key. Expected format: JOB_ID@YYYY-MM-DD:EMPLOYEE_ID' };
          }
          var targetShiftId = keyMatch[1];
          var targetEmpId = keyMatch[2];
          var targetJobPrefix = targetShiftId.split('@')[0];

          if (!seenJobIds.has(targetJobPrefix.toUpperCase())) {
            return { valid: false, error: 'Provenance entry "' + pKey + '" target shift references unknown jobId: ' + targetJobPrefix };
          }
          if (!seenIds.has(targetEmpId.toUpperCase())) {
            return { valid: false, error: 'Provenance entry "' + pKey + '" references unknown employee: ' + targetEmpId };
          }

          if (prov.source === 'rostering-rule') {
            if (!prov.instructionId || !validInstructions.has(prov.instructionId)) {
              return { valid: false, error: 'Provenance entry "' + pKey + '" references nonexistent instructionId: ' + prov.instructionId };
            }
            var owningInst = instructionMap[prov.instructionId];

            // Offline17.5j (Invariant I2): Historical rostering instructions may explain past operational state only.
            // They cannot own current or future rostering-rule provenance (targetDate >= today).
            var todayStr = (typeof window !== 'undefined' && window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
              ? window.HortOpsDateUtils.getLocalDateKey()
              : new Date().toISOString().slice(0, 10);
            var targetShiftDate = targetShiftId.split('@')[1];
            if (owningInst && owningInst.status === 'historical' && targetShiftDate >= todayStr) {
              return {
                valid: false,
                error: 'Historical rostering instruction "' + prov.instructionId + '" cannot own current or future provenance for target shift "' + targetShiftId + '" (target date ' + targetShiftDate + ' >= today ' + todayStr + ').'
              };
            }

            if (!prov.strategy || typeof prov.strategy !== 'string' || (prov.strategy.toLowerCase() !== 'fixed' && prov.strategy.toLowerCase() !== 'rotation')) {
              return { valid: false, error: 'Provenance entry "' + pKey + '" missing or invalid strategy. Must be "fixed" or "rotation".' };
            }
            if (prov.strategy.toLowerCase() !== owningInst.mode.toLowerCase()) {
              return { valid: false, error: 'Provenance entry "' + pKey + '" strategy ("' + prov.strategy + '") does not match instruction mode ("' + owningInst.mode + '").' };
            }

            var expectedSourceShift = owningInst.sourceShiftId || owningInst.startShiftId;
            if (!prov.sourceShiftId || typeof prov.sourceShiftId !== 'string' || prov.sourceShiftId !== expectedSourceShift) {
              return { valid: false, error: 'Provenance entry "' + pKey + '" missing or mismatched sourceShiftId.' };
            }

            if (!prov.slotId || typeof prov.slotId !== 'string' || prov.slotId !== owningInst.slotId) {
              return { valid: false, error: 'Provenance entry "' + pKey + '" missing or mismatched slotId.' };
            }

            if (prov.sequenceIndex === undefined || typeof prov.sequenceIndex !== 'number' || !Number.isInteger(prov.sequenceIndex) || prov.sequenceIndex < 0) {
              return { valid: false, error: 'Provenance entry "' + pKey + '" missing or invalid sequenceIndex: ' + prov.sequenceIndex };
            }

            // Offline17.5: Defense-in-depth: sequenceIndex must be strictly within instruction repeatCount
            if (prov.sequenceIndex >= owningInst.repeatCount) {
              return { valid: false, error: 'Provenance entry "' + pKey + '" sequenceIndex (' + prov.sequenceIndex + ') exceeds instruction repeatCount (' + owningInst.repeatCount + ').' };
            }

            if (owningInst.mode.toLowerCase() === 'fixed' && owningInst.employeeId) {
              if (targetEmpId.toUpperCase() !== owningInst.employeeId.toUpperCase()) {
                return { valid: false, error: 'Fixed provenance entry "' + pKey + '" target employee does not match instruction employee: ' + owningInst.employeeId };
              }
            }
          } else if (prov.source === 'manual') {
            if (!prov.slotId || typeof prov.slotId !== 'string' || !/^SLOT-\d+$/i.test(prov.slotId.trim())) {
              return { valid: false, error: 'Manual provenance entry "' + pKey + '" missing or invalid slotId. Must match SLOT-\d+.' };
            }
            if (prov.appliedAt !== undefined && (typeof prov.appliedAt !== 'string' || isNaN(Date.parse(prov.appliedAt)))) {
              return { valid: false, error: 'Manual provenance entry "' + pKey + '" has invalid appliedAt timestamp: ' + prov.appliedAt };
            }
          } else {
            return { valid: false, error: 'Provenance entry "' + pKey + '" has unsupported source: ' + prov.source };
          }

          // Duplicate slot assignment defense-in-depth: one slotId on one shift cannot be claimed by multiple provenance records
          var shiftSlotKey = targetShiftId + ':' + prov.slotId;
          if (activeShiftSlotClaims.has(shiftSlotKey)) {
            return { valid: false, error: 'Duplicate slot assignment: slot "' + prov.slotId + '" on shift "' + targetShiftId + '" is claimed by multiple provenance records.' };
          }
          activeShiftSlotClaims.add(shiftSlotKey);

          // Relational consistency: If assignments map exists in workspace envelope, target shift must exist and contain target employee
          var assignmentsMap = (parsed.assignments && typeof parsed.assignments === 'object')
            ? parsed.assignments
            : (parsed.customAssignments && typeof parsed.customAssignments === 'object' ? parsed.customAssignments : null);

          if (assignmentsMap) {
            var assignedArr = assignmentsMap[targetShiftId];
            if (!Array.isArray(assignedArr) || assignedArr.indexOf(targetEmpId) === -1) {
              return { valid: false, error: 'Provenance claims employee "' + targetEmpId + '" is assigned to "' + targetShiftId + '", but assignments does not contain this employee.' };
            }
          }
        }
      }
    }

    // Validation of historical snapshots / recorded scheduled commitments (Gate B1 Canonical Validation)
    if (parsed.historicalSnapshots !== undefined && parsed.historicalSnapshots !== null) {
      if (typeof parsed.historicalSnapshots !== 'object' || Array.isArray(parsed.historicalSnapshots)) {
        return { valid: false, error: 'Invalid "historicalSnapshots": must be a key-value object map.' };
      }
      var snapKeys = Object.keys(parsed.historicalSnapshots);
      for (var sIdx = 0; sIdx < snapKeys.length; sIdx++) {
        var sKey = snapKeys[sIdx];
        var snapRes = this.validateScheduledCommitment(sKey, parsed.historicalSnapshots[sKey]);
        if (!snapRes.valid) {
          return snapRes;
        }
      }
    }

    return { valid: true };
  },

  /**
   * Validates canonical assignments map for Schema v2 workspaces.
   * @param {*} assignments
   * @returns {{ valid: boolean, error?: string }}
   */
  validateAssignmentsMap: function(assignments) {
    var keys, i, j, key, match, staff, seen, ids;
    var own = Object.prototype.hasOwnProperty;
    if (!assignments || Object.prototype.toString.call(assignments) !== '[object Object]') {
      return { valid: false, error: 'assignments must be a canonical object map' };
    }
    keys = Object.keys(assignments);
    for (i = 0; i < keys.length; i++) {
      key = keys[i];
      if (typeof key !== 'string' || !key.trim()) {
        return { valid: false, error: 'Invalid assignment shiftId: ' + key };
      }
      if (key.indexOf('@') !== -1) {
        match = /^([A-Za-z0-9_-]+)@(\d{4}-\d{2}-\d{2})$/.exec(key);
        if (!match || !this.isRealYmd(match[2])) {
          return { valid: false, error: 'Invalid assignment shiftId: ' + key };
        }
      } else {
        if (!/^[A-Za-z0-9_-]+$/.test(key)) {
          return { valid: false, error: 'Invalid assignment shiftId: ' + key };
        }
      }
      ids = assignments[key];
      if (!Array.isArray(ids)) {
        return { valid: false, error: 'assignments[' + key + '] must be an array' };
      }
      seen = Object.create(null);
      for (j = 0; j < ids.length; j++) {
        staff = ids[j];
        if (typeof staff !== 'string' || !staff.trim()) {
          return { valid: false, error: 'Invalid employee ID in assignments[' + key + ']' };
        }
        // Validate identity uniqueness without requiring the employee to remain
        // present in today's Workforce Registry (historical staff may have left).
        if (own.call(seen, staff.toUpperCase())) {
          return { valid: false, error: 'Duplicate employee ID in assignments[' + key + ']' };
        }
        seen[staff.toUpperCase()] = true;
      }
    }
    return { valid: true };
  },

  validateJob: function(job) {
    if (!job || typeof job !== 'object') {
      return { valid: false, error: 'Invalid job object.' };
    }
    var envelope = {
      schemaVersion: 2,
      jobs: [job],
      roster: [],
      assignments: {},
      rostering: { instructions: {}, provenance: {} },
      historicalSnapshots: {}
    };
    return this.validate(envelope);
  },

  isRealYmd: function(text) {
    if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    var y = +text.slice(0, 4), m = +text.slice(5, 7), d = +text.slice(8, 10);
    if (m < 1 || m > 12) return false;
    var test = new Date(Date.UTC(y, m - 1, d));
    return test.getUTCFullYear() === y &&
           test.getUTCMonth() + 1 === m &&
           test.getUTCDate() === d;
  },

  isRealClock: function(text) {
    if (typeof text !== 'string') return false;
    var match = /^\s*(\d{1,2}):(\d{2})(?:\s*(AM|PM))?\s*$/i.exec(text);
    if (!match) return false;
    var hour = +match[1], minute = +match[2];
    if (minute > 59) return false;
    return match[3] ? (hour >= 1 && hour <= 12) : (hour >= 0 && hour <= 23);
  },

  validateScheduledCommitment: function(key, snapshot) {
    if (typeof key !== 'string' || !key.trim()) {
      return { valid: false, error: 'Historical snapshot key must be a non-empty string.' };
    }
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return { valid: false, error: 'Historical snapshot "' + key + '" must be an object.' };
    }
    var shiftId = snapshot.shiftId;
    if (!shiftId || typeof shiftId !== 'string') {
      return { valid: false, error: 'Historical snapshot "' + key + '" missing or invalid shiftId.' };
    }
    if (shiftId !== key) {
      return { valid: false, error: 'Historical snapshot key "' + key + '" does not match shiftId "' + shiftId + '".' };
    }
    var atIdx = shiftId.indexOf('@');
    if (atIdx <= 0 || atIdx === shiftId.length - 1 || shiftId.indexOf('@', atIdx + 1) !== -1) {
      return { valid: false, error: 'Historical snapshot "' + key + '" has invalid shiftId format. Expected format: JOB_ID@YYYY-MM-DD.' };
    }
    var expectedJobId = shiftId.slice(0, atIdx);
    var expectedDate = shiftId.slice(atIdx + 1);

    if (!this.isRealYmd(expectedDate)) {
      return { valid: false, error: 'Historical snapshot "' + key + '" has invalid calendar date in shiftId: ' + expectedDate };
    }

    if (snapshot.jobId !== undefined && snapshot.jobId !== null) {
      if (typeof snapshot.jobId !== 'string' || snapshot.jobId !== expectedJobId) {
        return { valid: false, error: 'Historical snapshot "' + key + '" jobId "' + snapshot.jobId + '" does not match shiftId prefix: ' + expectedJobId };
      }
    }

    if (snapshot.date !== undefined && snapshot.date !== null) {
      if (typeof snapshot.date !== 'string' || snapshot.date !== expectedDate || !this.isRealYmd(snapshot.date)) {
        return { valid: false, error: 'Historical snapshot "' + key + '" date "' + snapshot.date + '" does not match shiftId date: ' + expectedDate };
      }
    }

    var own = Object.prototype.hasOwnProperty;

    // Review 13 B1-03: unverifiedSchedule is a runtime indicator, never an authoritative persisted snapshot field
    if (own.call(snapshot, 'unverifiedSchedule')) {
      return {
        valid: false,
        error: 'Runtime unverifiedSchedule flag is not an authoritative persisted snapshot field'
      };
    }

    if (snapshot.startTime === undefined || snapshot.startTime === null || !this.isRealClock(snapshot.startTime)) {
      return { valid: false, error: 'Historical snapshot "' + key + '" missing or invalid startTime: ' + snapshot.startTime };
    }
    if (typeof snapshot.durationHours !== 'number' || !isFinite(snapshot.durationHours) || snapshot.durationHours <= 0) {
      return { valid: false, error: 'Historical snapshot "' + key + '" has invalid durationHours: must be a positive finite number.' };
    }

    // Review 13 B1-02: explicit crewSize: null is invalid on authoritative record
    if (own.call(snapshot, 'crewSize')) {
      var crew = snapshot.crewSize;
      if (typeof crew !== 'number' || !isFinite(crew) || crew <= 0 || Math.floor(crew) !== crew) {
        return { valid: false, error: 'Historical snapshot "' + key + '" has invalid crewSize: must be a positive integer when supplied.' };
      }
    }

    // Review 13 B1-02: explicit assignedStaffIds: null is invalid, not optional
    if (own.call(snapshot, 'assignedStaffIds')) {
      if (!Array.isArray(snapshot.assignedStaffIds)) {
        return { valid: false, error: 'Historical snapshot "' + key + '" has invalid assignedStaffIds: must be an array when supplied.' };
      }
      var seenStaff = Object.create(null);
      for (var aIdx = 0; aIdx < snapshot.assignedStaffIds.length; aIdx++) {
        var staffId = snapshot.assignedStaffIds[aIdx];
        if (typeof staffId !== 'string' || !staffId.trim()) {
          return { valid: false, error: 'Historical snapshot "' + key + '" contains invalid staff ID at index ' + aIdx + '.' };
        }
        if (seenStaff[staffId]) {
          return { valid: false, error: 'Historical snapshot "' + key + '" contains duplicate assigned staff ID: "' + staffId + '".' };
        }
        seenStaff[staffId] = true;
      }
    }

    // Review 14 B1-14-02: unknown or inherited recordType must not authenticate a scheduled commitment
    if (own.call(snapshot, 'recordType')) {
      if (typeof snapshot.recordType !== 'string' ||
          (snapshot.recordType !== 'scheduled_commitment' && snapshot.recordType !== 'historical')) {
        return { valid: false, error: 'Historical snapshot "' + key + '" has invalid recordType: must be one of "scheduled_commitment" or "historical".' };
      }
    }

    return { valid: true };
  },

  validateCurrentV2Presence: function(input, options) {
    var own = Object.prototype.hasOwnProperty;
    var tag = Object.prototype.toString;
    function map(v) {
      return v !== null && typeof v === 'object' &&
        tag.call(v) === '[object Object]';
    }
    function requireMap(obj, key, label) {
      if (!own.call(obj, key)) {
        return { valid: false, error: 'Missing required current-v2 field: ' + label };
      }
      if (!map(obj[key])) {
        return { valid: false, error: 'Invalid current-v2 field: ' + label + ': expected object map' };
      }
      return { valid: true };
    }
    if (!map(input) || input.schemaVersion !== 2) {
      return { valid: false, error: 'Expected an explicit current Schema v2 workspace object' };
    }
    if (own.call(input, 'absences') && (input.absences === null || !Array.isArray(input.absences))) {
      return { valid: false, error: 'Invalid current-v2 field: absences: expected array, null is not permitted' };
    }
    if (own.call(input, 'refusalHistory') && (input.refusalHistory === null || !Array.isArray(input.refusalHistory))) {
      return { valid: false, error: 'Invalid current-v2 field: refusalHistory: expected array, null is not permitted' };
    }
    var r = requireMap(input, 'historicalSnapshots', 'historicalSnapshots');
    if (!r.valid) return r;
    r = requireMap(input, 'rostering', 'rostering');
    if (!r.valid) return r;
    r = requireMap(input.rostering, 'instructions', 'rostering.instructions');
    if (!r.valid) return r;
    r = requireMap(input.rostering, 'provenance', 'rostering.provenance');
    if (!r.valid) return r;

    // Explicit exception for pre-projection in-memory application state ONLY.
    if (options && options.inputKind === 'runtime_state') {
      return requireMap(input, 'customAssignments', 'customAssignments');
    }

    // Default for ALL public/current-v2 storage, import, export and restore paths.
    r = requireMap(input, 'assignments', 'assignments');
    if (!r.valid) return r;
    if (own.call(input, 'customAssignments')) {
      return {
        valid: false,
        error: 'Ambiguous current-v2 workspace: runtime customAssignments must be explicitly projected to canonical assignments'
      };
    }
    return { valid: true };
  },

  rejectNonJsonValue: function(value, path, ancestors) {
    var t = typeof value, keys, i, descriptor;
    if (value === null || t === 'string' || t === 'boolean') return;
    if (t === 'number') {
      if (!isFinite(value)) throw new Error('Non-finite number at ' + path);
      return;
    }
    if (t !== 'object') throw new Error('Non-JSON value at ' + path + ': ' + t);
    if (!Array.isArray(value) && Object.prototype.toString.call(value) !== '[object Object]') {
      throw new Error('Unsupported non-JSON object at ' + path);
    }
    if (ancestors.indexOf(value) !== -1) throw new Error('Cyclic workspace reference at ' + path);
    ancestors.push(value);
    keys = Object.keys(value);
    for (i = 0; i < keys.length; i++) {
      descriptor = Object.getOwnPropertyDescriptor(value, keys[i]);
      if (descriptor && (descriptor.get || descriptor.set)) {
        throw new Error('Accessor property is not a JSON field: ' + path + '.' + keys[i]);
      }
      this.rejectNonJsonValue(value[keys[i]], path + '.' + keys[i], ancestors);
    }
    ancestors.pop();
  },

  validateCurrentV2ForBoundary: function(input) {
    var presence = this.validateCurrentV2Presence(input);
    var working, result;
    if (!presence.valid) {
      return presence;
    }
    try {
      this.rejectNonJsonValue(input, 'workspace', []);
    } catch (errJson) {
      return { valid: false, error: errJson.message || String(errJson) };
    }
    try {
      working = JSON.parse(JSON.stringify(input));
    } catch (e) {
      return { valid: false, error: 'Workspace cannot be safely copied for validation' };
    }
    try {
      result = this.validateWorkspaceSchema(working);
    } catch (errSchema) {
      return { valid: false, error: 'Unexpected error validating workspace schema: ' + (errSchema.message || String(errSchema)) };
    }
    if (!result.valid) {
      return result;
    }
    return { valid: true, data: working };
  },

  missingIdentityKeys: function(previous, proposed, path, allowedMissing) {
    var missing = [];
    var k;
    var tag = Object.prototype.toString;
    function isMap(value) { return value !== null && typeof value === 'object' && tag.call(value) === '[object Object]'; }
    var own = Object.prototype.hasOwnProperty;
    if (!isMap(previous) || !isMap(proposed)) {
      return { valid: false, error: 'Invalid evidence map at ' + path, missing: [] };
    }
    var allowedSet = null;
    if (Array.isArray(allowedMissing)) {
      allowedSet = {};
      for (var a = 0; a < allowedMissing.length; a++) {
        allowedSet[allowedMissing[a]] = true;
      }
    }
    for (k in previous) {
      if (own.call(previous, k) && !own.call(proposed, k)) {
        if (!allowedSet || !allowedSet[k]) {
          missing.push(k);
        }
      }
    }
    return missing.length ?
      { valid: false, error: 'Unexpected loss of ' + path + ': ' + missing.join(', '), missing: missing } :
      { valid: true, missing: [] };
  },

  checkEvidenceKeyRetention: function(previous, proposed, permittedRemovals) {
    var check, prevValid, nextValid;
    prevValid = this.validateCurrentV2Presence(previous);
    if (!prevValid.valid) return prevValid;
    nextValid = this.validateCurrentV2Presence(proposed);
    if (!nextValid.valid) return nextValid;
    var permittedSnapshots = (permittedRemovals && permittedRemovals.snapshots) || null;
    var permittedInstructions = (permittedRemovals && permittedRemovals.instructions) || null;
    var permittedProvenance = (permittedRemovals && permittedRemovals.provenance) || null;

    check = this.missingIdentityKeys(previous.historicalSnapshots, proposed.historicalSnapshots, 'historicalSnapshots', permittedSnapshots);
    if (!check.valid) return check;
    check = this.missingIdentityKeys(previous.rostering.instructions, proposed.rostering.instructions, 'rostering.instructions', permittedInstructions);
    if (!check.valid) return check;
    return this.missingIdentityKeys(previous.rostering.provenance, proposed.rostering.provenance, 'rostering.provenance', permittedProvenance);
  }
};
