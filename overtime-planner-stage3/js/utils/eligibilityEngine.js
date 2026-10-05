// Authoritative Staff Allocation Validator & Eligibility Engine (P0-10, P0-03, Mandate Sections 6, 8, 9)
// Pure business-rule function used across candidate filtering, auto-fill, manual add, and shift validation.

window.HortOpsEligibilityEngine = {
  /**
   * Canonical crew-level validator across all application flows (Mandate Section 3, 4, 5, 26).
   *
   * @param {Object} params - { occurrence, job, assignedStaffIds, roster, allAssignments }
   * @returns {{ valid: boolean, hardBlock: boolean, issues: Array<{ code: string, hardBlock: boolean, message: string }> }}
   */
  validateCrewForOccurrence: function(params) {
    if (!params) params = {};
    var occurrence = params.occurrence || params.shift || {};
    var job = params.job || null;
    var assignedStaffIds = (params.assignedStaffIds || occurrence.assignedStaffIds || []).slice();
    var roster = params.roster || (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.staffList) || [];
    var allAssignments = params.allAssignments || params.allShifts || [];

    var issues = [];
    var isReq = Boolean(occurrence.plantOperatorRequired || (job && job.plantOperatorRequired) || occurrence.requiresPlantOperator);

    if (isReq) {
      var hasEligibleOperator = false;
      for (var i = 0; i < assignedStaffIds.length; i++) {
        var staffId = assignedStaffIds[i];
        var staff = roster.find(function(s) { return Boolean(s && s.id && staffId && s.id === staffId); });
        if (!staff) continue;
        if (!staff.isPlantOperator) continue;

        // An operator satisfies the rule only if they pass normal employee eligibility for this occurrence
        var val = this.validateEmployeeForOccurrence({
          employee: staff,
          occurrence: occurrence,
          job: job,
          allAssignments: allAssignments
        });

        var isEligible = (val.valid !== undefined) ? val.valid : val.eligible;
        if (isEligible) {
          hasEligibleOperator = true;
          break;
        }
      }

      if (!hasEligibleOperator) {
        issues.push({
          code: 'PLANT_OPERATOR_REQUIRED',
          hardBlock: true,
          message: 'This crew requires at least one eligible Plant Operator.'
        });
      }
    }

    return {
      valid: issues.length === 0,
      hardBlock: issues.some(function(iss) { return iss.hardBlock; }),
      issues: issues
    };
  },

  /**
   * Converts a time string (e.g. "06:00 AM", "14:30", "5:00") into minutes from midnight (0 - 1439).
   * @param {string} timeStr
   * @returns {number}
   */
  parseTimeToMinutes: function(timeStr) {
    if (!timeStr) return 360; // default 06:00 AM = 360 min
    var clean = String(timeStr).trim().toUpperCase();
    var isPM = clean.indexOf('PM') !== -1;
    var isAM = clean.indexOf('AM') !== -1;
    clean = clean.replace(/[AP]M/, '').trim();

    var parts = clean.split(':');
    var hours = parseInt(parts[0], 10) || 0;
    var minutes = parseInt(parts[1], 10) || 0;

    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;

    return hours * 60 + minutes;
  },

  /**
   * Converts a shift { date:'YYYY-MM-DD', startTime, durationHours } to an absolute
   * interval in elapsed minutes measured from UNIX epoch.
   * Using Date.getTime() ensures elapsed physical time is strictly enforced across
   * date boundaries, calendar-year boundaries, and daylight-saving (DST) transitions.
   *
   * Implementation assumption: Municipal rest-rule policy mandates physical elapsed
   * rest hours rather than clock hours across daylight saving shifts.
   *
   * @param {Object} shift - { date, startTime, durationHours }
   * @returns {{ startMin: number, endMin: number }|null}
   */
  /**
   * Returns South Australia UTC offset in minutes (+570 for ACST, +630 for ACDT)
   * for an absolute UTC epoch timestamp.
   * Uses Intl.DateTimeFormat if available, with deterministic statutory DST boundary fallback.
   *
   * @param {number} utcMs
   * @returns {number}
   */
  getAdelaideOffsetMinutes: function(utcMs) {
    if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
      try {
        var d = new Date(utcMs);
        var formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'Australia/Adelaide',
          year: 'numeric', month: 'numeric', day: 'numeric',
          hour: 'numeric', minute: 'numeric', second: 'numeric',
          hour12: false
        });
        var parts = formatter.formatToParts(d);
        var map = {};
        for (var pI = 0; pI < parts.length; pI++) { map[parts[pI].type] = parts[pI].value; }
        var hour = parseInt(map.hour, 10);
        if (hour === 24) hour = 0;
        var localAsUtc = Date.UTC(parseInt(map.year, 10), parseInt(map.month, 10) - 1, parseInt(map.day, 10), hour, parseInt(map.minute, 10), parseInt(map.second, 10));
        return (localAsUtc - utcMs) / 60000;
      } catch(e) {}
    }
    // Statutory fallback for South Australia DST rules:
    // First Sunday in April 03:00 local (DST ends -> UTC+9:30)
    // First Sunday in October 02:00 local (DST starts -> UTC+10:30)
    var dt = new Date(utcMs);
    var y = dt.getUTCFullYear();
    var apr1 = new Date(Date.UTC(y, 3, 1, 0, 0, 0));
    var aprFirstSun = 1 + (7 - apr1.getUTCDay()) % 7;
    var endDstUtc = Date.UTC(y, 3, aprFirstSun, 0, 0, 0) - (7 * 3600000) - (30 * 60000);

    var oct1 = new Date(Date.UTC(y, 9, 1, 0, 0, 0));
    var octFirstSun = 1 + (7 - oct1.getUTCDay()) % 7;
    var startDstUtc = Date.UTC(y, 9, octFirstSun, 0, 0, 0) - (7 * 3600000) - (30 * 60000);

    if (utcMs >= endDstUtc && utcMs < startDstUtc) {
      return 570; // ACST UTC+9:30
    }
    return 630; // ACDT UTC+10:30
  },

  /**
   * Converts Adelaide local date and time string into exact UTC epoch milliseconds.
   * Guaranteed to be host-machine timezone agnostic.
   *
   * @param {string} dateStr - 'YYYY-MM-DD'
   * @param {string} timeStr - 'HH:MM AM/PM'
   * @returns {number}
   */
  adelaideLocalToUtcMs: function(dateStr, timeStr) {
    var parts = String(dateStr).split('-');
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    var timeMin = this.parseTimeToMinutes(timeStr || '06:00 AM');
    var h = Math.floor(timeMin / 60);
    var min = timeMin % 60;

    var approxUtc = Date.UTC(y, m - 1, d, h, min) - (570 * 60000);
    var off1 = this.getAdelaideOffsetMinutes(approxUtc);
    var finalUtc = Date.UTC(y, m - 1, d, h, min) - (off1 * 60000);
    var off2 = this.getAdelaideOffsetMinutes(finalUtc);
    return Date.UTC(y, m - 1, d, h, min) - (off2 * 60000);
  },

  shiftToAbsoluteInterval: function(shift) {
    if (!shift || !shift.date) return null;
    var parts = String(shift.date).split('-');
    if (parts.length < 3) return null;
    var year  = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10) - 1; // 0-indexed
    var day   = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

    var startMs = this.adelaideLocalToUtcMs(shift.date, shift.startTime || '06:00 AM');
    if (isNaN(startMs)) return null;

    var durHours = parseFloat(shift.durationHours);
    if (isNaN(durHours) || durHours < 0) durHours = 6;
    var durMs = durHours * 60 * 60 * 1000;

    var startMin = Math.round(startMs / 60000);
    var endMin = Math.round((startMs + durMs) / 60000);

    return { startMin: startMin, endMin: endMin };
  },

  /**
   * Returns true when shiftA and shiftB time intervals overlap, using absolute
   * date-and-time arithmetic so cross-midnight and cross-year overlaps are caught.
   * Standard half-open interval rule: A.start < B.end AND B.start < A.end
   * (adjacent, non-overlapping shifts return false).
   *
   * Preserves existing shift identity rules: two shifts with matching, non-null
   * shiftIds are treated as the same shift by the caller before this is invoked.
   *
   * @param {Object} shiftA - { date, startTime, durationHours }
   * @param {Object} shiftB - { date, startTime, durationHours }
   * @returns {boolean}
   */
  shiftsTimeOverlap: function(shiftA, shiftB) {
    var iA = this.shiftToAbsoluteInterval(shiftA);
    var iB = this.shiftToAbsoluteInterval(shiftB);
    if (!iA || !iB) return false;
    return (iA.startMin < iB.endMin) && (iB.startMin < iA.endMin);
  },

  /**
   * Returns true when the gap between two non-overlapping shifts is strictly less
   * than minRestMinutes. Checked in both directions so inserting a shift between
   * two existing shifts cannot create an undetected violation.
   * Exactly minRestMinutes of gap is permitted (strict < comparison).
   *
   * @param {Object} shiftA - { date, startTime, durationHours }
   * @param {Object} shiftB - { date, startTime, durationHours }
   * @param {number} minRestMinutes - Minimum required rest gap in minutes (default 600 = 10 h)
   * @returns {boolean}
   */
  shiftsViolateRestGap: function(shiftA, shiftB, minRestMinutes) {
    var restMin = (minRestMinutes !== undefined) ? minRestMinutes : 600;
    var iA = this.shiftToAbsoluteInterval(shiftA);
    var iB = this.shiftToAbsoluteInterval(shiftB);
    if (!iA || !iB) return false;
    // Gap is the time between the end of the earlier shift and the start of the later one.
    var gap;
    if (iA.endMin <= iB.startMin) {
      gap = iB.startMin - iA.endMin; // A is before B
    } else if (iB.endMin <= iA.startMin) {
      gap = iA.startMin - iB.endMin; // B is before A
    } else {
      return false; // Overlapping: handled by OVERLAPPING_SHIFT, not here
    }
    return gap < restMin;
  },

  /**
   * Validates whether a staff member can be allocated to a shift on a specific date.
   *
   * @param {Object} staff - Staff member record
   * @param {Object} shift - Target shift ({ date, shiftId, startTime, durationHours, primaryTeam, exclusiveTeams, isExclusive, plantOperatorRequired })
   * @param {Object|Array} [jobOrAllShifts] - Job definition or array of all scheduled shifts
   * @param {Array} [maybeAllShifts] - All scheduled shifts in the workspace for double-booking checking
   * @param {Array} [maybeCurrentIds] - IDs currently staged/assigned to this specific shift
   * @returns {{ eligible: boolean, reasons: string[], warnings: string[] }}
   */
  /**
   * Canonical assignment validator across all application flows (Mandate Section 7).
   *
   * @param {Object} params - { employee, occurrence, job, allAssignments, roster, now, currentShiftAssignedIds }
   * @returns {{ eligible: boolean, hardBlock: boolean, code: string, reasons: string[], warnings: string[], message: string }}
   */
  validateEmployeeForOccurrence: function(params, maybeOccurrence, maybeContext) {
    if (!params) params = {};
    var employee = params.employee || params.staff || (params.id ? params : null);
    var occurrence = params.occurrence || params.shift || maybeOccurrence;
    var context = maybeContext || {};
    var job = params.job || context.job;
    var allAssignments = params.allAssignments || params.allShifts || context.allShifts || context.allAssignments || [];
    var currentShiftAssignedIds = params.currentShiftAssignedIds || context.currentShiftAssignedIds || [];

    if (!employee) {
      return {
        eligible: false,
        hardBlock: true,
        code: 'EMPLOYEE_NOT_FOUND',
        reasons: ['STAFF_NOT_FOUND'],
        warnings: [],
        message: 'Employee record not found in workforce directory'
      };
    }

    var reasons = [];
    var warnings = [];
    var hardBlock = false;

    // 1. Employment Status Lifecycle (Mandate Section 6, 7, 12, 29; Constitution Art. 11)
    var rawStatus = (employee.status !== undefined && employee.status !== null)
      ? String(employee.status).trim().toLowerCase()
      : '';
    if (rawStatus === 'active') {
      // Active status is permitted
    } else if (rawStatus === 'departed') {
      reasons.push('EMPLOYMENT_DEPARTED');
      hardBlock = true;
    } else if (rawStatus === 'inactive') {
      reasons.push('EMPLOYMENT_INACTIVE');
      hardBlock = true;
    } else if (rawStatus === 'temporarily_unavailable') {
      reasons.push('EMPLOYMENT_UNAVAILABLE');
      hardBlock = true;
    } else if (rawStatus === 'on_leave') {
      reasons.push('EMPLOYMENT_ON_LEAVE');
      hardBlock = true;
    } else {
      // Fail closed for any unknown/missing/blank/whitespace status
      reasons.push('UNKNOWN_EMPLOYMENT_STATUS');
      hardBlock = true;
    }

    // 2. Overtime Exemption Window Check
    if (employee.isOvertimeExempt) {
      var shiftDate = occurrence ? occurrence.date : '';
      var start = employee.exemptionStartDate || '';
      var end = employee.exemptionEndDate || '';

      var isExempt = false;
      if (!start && !end) {
        isExempt = true;
      } else if (start && end && shiftDate >= start && shiftDate <= end) {
        isExempt = true;
      } else if (start && !end && shiftDate >= start) {
        isExempt = true;
      } else if (!start && end && shiftDate <= end) {
        isExempt = true;
      }

      if (isExempt) {
        reasons.push('OVERTIME_EXEMPT');
        hardBlock = true;
      }
    }

    // 3. Exclusive Team Restriction Check
    var isExclusive = (occurrence && (occurrence.isExclusive || occurrence.isExclusiveTeams)) || (job && (job.isExclusive || job.isExclusiveTeams));
    var exclusiveTeams = (occurrence && occurrence.exclusiveTeams && occurrence.exclusiveTeams.length > 0) ? occurrence.exclusiveTeams : (job && job.exclusiveTeams ? job.exclusiveTeams : []);
    if (isExclusive && exclusiveTeams && exclusiveTeams.length > 0) {
      var staffTeam = (employee.team || '').toLowerCase();
      var isAllowedTeam = exclusiveTeams.some(function(t) {
        return t.toLowerCase() === staffTeam;
      });
      if (!isAllowedTeam) {
        reasons.push('TEAM_NOT_ALLOWED');
        hardBlock = true;
      }
    }

    // 4. Double Booking & Mandatory Rest-Gap Checks (Mandate Section 7, 9; Constitution Art. 7)
    if (allAssignments && allAssignments.lookupFailed) {
      reasons.push('ADJACENT_SCHEDULE_UNAVAILABLE');
      hardBlock = true;
    }
    //    4a. OVERLAPPING_SHIFT — employee already assigned to a concurrently overlapping shift.
    //    4b. INSUFFICIENT_REST — less than 10 hours between a known work commitment and the
    //        proposed shift. Enforced against allAssignments (known overtime/assigned shifts)
    //        only. The current workforce model does not supply a complete regular-hours
    //        schedule; regular-hours enforcement is deferred to the registry-development stage.
    //        TODO(registry-dev): incorporate regular working hours once available so that
    //        rest-gap validation covers the full daily schedule, not only overtime assignments.
    if (occurrence && occurrence.date && allAssignments && Array.isArray(allAssignments)) {
      var self = this;
      var hasOverlap = false;
      var hasInsufficientRest = false;
      var hasUnverifiedSchedule = false;
      allAssignments.forEach(function(otherShift) {
        var isSameShift = Boolean(
          otherShift &&
          occurrence &&
          otherShift.shiftId &&
          occurrence.shiftId &&
          otherShift.shiftId === occurrence.shiftId
        );
        if (isSameShift) return;
        var assigned = (otherShift && otherShift.assignedStaffIds) || [];
        if (assigned.indexOf(employee.id) === -1) return;
        if (otherShift.unverifiedSchedule || !otherShift.startTime || otherShift.durationHours === undefined || otherShift.durationHours === null) {
          // Where reliable historical scheduling information is genuinely unavailable, do not silently assume no commitment existed
          hasUnverifiedSchedule = true;
        } else if (self.shiftsTimeOverlap(occurrence, otherShift)) {
          hasOverlap = true;
        } else if (self.shiftsViolateRestGap(occurrence, otherShift, 600)) {
          hasInsufficientRest = true;
        }
      });
      if (hasUnverifiedSchedule) {
        reasons.push('ADJACENT_SCHEDULE_UNAVAILABLE');
        hardBlock = true;
      }
      if (hasOverlap) {
        reasons.push('OVERLAPPING_SHIFT');
        hardBlock = true;
      }
      if (hasInsufficientRest) {
        reasons.push('INSUFFICIENT_REST');
        hardBlock = true;
      }
    }

    // 5. Already Assigned Here
    if (currentShiftAssignedIds && currentShiftAssignedIds.indexOf(employee.id) !== -1) {
      warnings.push('ALREADY_ASSIGNED_HERE');
    }

    // 6. Plant Operator Requirement Check
    if (occurrence && (occurrence.plantOperatorRequired || (job && job.plantOperatorRequired)) && !employee.isPlantOperator) {
      warnings.push('NOT_PLANT_OPERATOR');
    }

    // Stage 3 Workforce Intelligence, Qualification Registries & Fatigue Safety Integration
    var qualsEngine = (typeof window !== 'undefined' && window.HortOpsQualifications) || (typeof global !== 'undefined' && global.HortOpsQualifications);
    if (!qualsEngine && typeof require !== 'undefined') {
      try { qualsEngine = require('./qualifications.js'); } catch (e) {}
    }

    var fatigueEngine = (typeof window !== 'undefined' && window.HortOpsFatigueEngine) || (typeof global !== 'undefined' && global.HortOpsFatigueEngine);
    if (!fatigueEngine && typeof require !== 'undefined') {
      try { fatigueEngine = require('./fatigueEngine.js'); } catch (e) {}
    }

    var absenceEngine = (typeof window !== 'undefined' && (window.HortOpsAbsences || window.HortOpsAbsenceLedger)) || (typeof global !== 'undefined' && (global.HortOpsAbsences || global.HortOpsAbsenceLedger));
    if (!absenceEngine && typeof require !== 'undefined') {
      try { absenceEngine = require('./absences.js'); } catch (e) {}
    }

    // 7. Multi-Period Absence Ledger Check (Stage 3 Gate 3E & Review 56 R56-P1-05)
    if (occurrence && occurrence.date) {
      if (!absenceEngine || typeof absenceEngine.isStaffAbsentOnDate !== 'function') {
        reasons.push('ABSENCE_ENGINE_UNAVAILABLE');
        hardBlock = true;
      } else {
        try {
          var absences = params.absences || context.absences || (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.absences) || (typeof global !== 'undefined' && global.HortOpsApp && global.HortOpsApp.state && global.HortOpsApp.state.absences) || [];
          if (!Array.isArray(absences)) {
            reasons.push('ABSENCE_ENGINE_UNAVAILABLE');
            hardBlock = true;
          } else {
            var absCheck = absenceEngine.isStaffAbsentOnDate(employee.id, occurrence.date, absences);
            if (!absCheck || typeof absCheck !== 'object' || typeof absCheck.absent !== 'boolean') {
              reasons.push('ABSENCE_ENGINE_UNAVAILABLE');
              hardBlock = true;
            } else if (absCheck.absent) {
              reasons.push('STAFF_ABSENT');
              hardBlock = true;
            }
          }
        } catch (e) {
          reasons.push('ABSENCE_ENGINE_UNAVAILABLE');
          hardBlock = true;
        }
      }
    }

    // 8. Mandatory Qualification Check (Stage 3 Gate 3B & Review 55 R55-P0-01)
    var reqQuals = (job && Array.isArray(job.requiredQualifications)) ? job.requiredQualifications : (occurrence && Array.isArray(occurrence.requiredQualifications) ? occurrence.requiredQualifications : []);
    if (reqQuals && reqQuals.length > 0) {
      if (!qualsEngine || typeof qualsEngine.evaluateStaffQualifications !== 'function') {
        reasons.push('SAFETY_ENGINE_UNAVAILABLE');
        hardBlock = true;
      } else {
        var shiftDate = occurrence ? (occurrence.date || occurrence.shiftDate) : null;
        var qEval = qualsEngine.evaluateStaffQualifications(employee, reqQuals, shiftDate);
        if (!qEval || !qEval.compliant) {
          reasons.push('LACKS_REQUIRED_QUALIFICATION');
          hardBlock = true;
        }
      }
    }

    // 9. Advanced Fatigue Engine Simulation Check (Stage 3 Gate 3C & Review 55 R55-P0-01, Review 56 R56-P1-04)
    if (occurrence && occurrence.date) {
      if (!fatigueEngine || typeof fatigueEngine.simulateAssignmentFatigue !== 'function') {
        reasons.push('FATIGUE_ENGINE_UNAVAILABLE');
        hardBlock = true;
      } else {
        try {
          var fEval = fatigueEngine.simulateAssignmentFatigue(employee, occurrence, allAssignments);
          var validTiers = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
          if (!fEval || typeof fEval !== 'object' || typeof fEval.isHardBlocked !== 'boolean' || typeof fEval.tier !== 'string' || validTiers.indexOf(fEval.tier) === -1) {
            reasons.push('FATIGUE_ENGINE_UNAVAILABLE');
            hardBlock = true;
          } else if (fEval.tier === 'CRITICAL' || fEval.isHardBlocked) {
            reasons.push('FATIGUE_REST_REQUIRED');
            hardBlock = true;
          }
        } catch (e) {
          reasons.push('FATIGUE_ENGINE_UNAVAILABLE');
          hardBlock = true;
        }
      }
    }

    var humanMessages = {
      'EMPLOYMENT_DEPARTED': 'Employee departed from organisation',
      'EMPLOYMENT_INACTIVE': 'Employee marked inactive',
      'EMPLOYMENT_UNAVAILABLE': 'Employee temporarily unavailable',
      'EMPLOYMENT_ON_LEAVE': 'Employee is currently on leave',
      'UNKNOWN_EMPLOYMENT_STATUS': 'Employee has unknown employment status',
      'OVERTIME_EXEMPT': 'Employee has active overtime exemption',
      'TEAM_NOT_ALLOWED': 'Employee team not permitted under exclusive-team restrictions',
      'OVERLAPPING_SHIFT': 'Employee is already assigned to a concurrent overlapping shift',
      'INSUFFICIENT_REST': 'Employee has insufficient rest between work commitments (minimum 10 hours required)',
      'ADJACENT_SCHEDULE_UNAVAILABLE': 'Cannot verify commitments from adjacent year; allocation blocked fail-closed',
      'STAFF_NOT_FOUND': 'Employee not found in workforce directory',
      'STAFF_ABSENT': 'Employee has active scheduled absence / leave on shift date',
      'SAFETY_ENGINE_UNAVAILABLE': 'Qualification safety engine is unavailable (fail-closed)',
      'LACKS_REQUIRED_QUALIFICATION': 'Employee lacks mandatory qualifications for this role',
      'ABSENCE_ENGINE_UNAVAILABLE': 'Absence ledger safety engine is unavailable (fail-closed)',
      'FATIGUE_ENGINE_UNAVAILABLE': 'Fatigue safety engine is unavailable (fail-closed)',
      'FATIGUE_REST_REQUIRED': 'Mandatory physical rest required (critical fatigue limit exceeded)'
    };

    var primaryReason = reasons[0] || '';
    var message = primaryReason ? (humanMessages[primaryReason] || primaryReason) : 'Eligible';

    var isEligible = reasons.length === 0;
    return {
      eligible: isEligible,
      valid: isEligible,
      hardBlock: hardBlock,
      code: primaryReason || (warnings[0] || 'OK'),
      reasons: reasons,
      warnings: warnings,
      message: message,
      error: !isEligible ? message : null
    };
  },

  /**
   * Returns a concise human-readable message for an eligibility failure code.
   * Exposed publicly so all UI modals and workflow engines share canonical reason strings.
   *
   * @param {string} code
   * @returns {string}
   */
  getHumanIneligibleReason: function(code) {
    var map = {
      'EMPLOYMENT_DEPARTED': 'Departed',
      'EMPLOYMENT_INACTIVE': 'Inactive',
      'EMPLOYMENT_UNAVAILABLE': 'Unavailable',
      'EMPLOYMENT_ON_LEAVE': 'On Leave',
      'UNKNOWN_EMPLOYMENT_STATUS': 'Unknown Status',
      'OVERTIME_EXEMPT': 'Exemption Active',
      'TEAM_NOT_ALLOWED': 'Non-Exclusive Team',
      'OVERLAPPING_SHIFT': 'Double-Booked',
      'INSUFFICIENT_REST': 'Insufficient Rest (< 10h)',
      'ADJACENT_SCHEDULE_UNAVAILABLE': 'Adjacent Schedule Unavailable',
      'STAFF_NOT_FOUND': 'Staff Not Found',
      'NOT_PLANT_OPERATOR': 'Plant Operator Required',
      'STAFF_ABSENT': 'Absent (Leave/RDO)',
      'SAFETY_ENGINE_UNAVAILABLE': 'Safety Engine Unavailable',
      'LACKS_REQUIRED_QUALIFICATION': 'Lacks Required Qualification',
      'FATIGUE_ENGINE_UNAVAILABLE': 'Fatigue Engine Unavailable',
      'FATIGUE_REST_REQUIRED': 'Fatigue Rest Required'
    };
    return map[code] || code || 'Ineligible';
  },

  validateStaffEligibility: function(staff, shift, jobOrAllShifts, maybeAllShifts, maybeCurrentIds, maybeContext) {
    var job = (jobOrAllShifts && !Array.isArray(jobOrAllShifts)) ? jobOrAllShifts : null;
    var allShifts = Array.isArray(jobOrAllShifts) ? jobOrAllShifts : (Array.isArray(maybeAllShifts) ? maybeAllShifts : []);
    var currentShiftAssignedIds = Array.isArray(jobOrAllShifts) ? maybeAllShifts : maybeCurrentIds;
    var context = (typeof maybeContext === 'object' && maybeContext !== null) ? maybeContext : {};

    var res = this.validateEmployeeForOccurrence({
      employee: staff,
      occurrence: shift,
      job: job,
      allAssignments: allShifts,
      currentShiftAssignedIds: currentShiftAssignedIds,
      absences: context.absences || (context.state && context.state.absences)
    });

    return {
      eligible: res.eligible,
      reasons: res.reasons,
      warnings: res.warnings,
      hardBlock: res.hardBlock,
      code: res.code,
      message: res.message
    };
  }
};
