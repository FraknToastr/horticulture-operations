// Canonical Municipal Multi-Period Absence Ledger & Refusal History Engine (Stage 3)
// Governs Adelaide City Council planned & unplanned leave, RDOs, training, and fair-share overtime distribution.
if (typeof require !== 'undefined') {
  if (typeof window === 'undefined') {
    global.window = global;
  }
}

(function() {
  'use strict';

  var VALID_ABSENCE_TYPES = [
    'annual_leave',
    'sick_leave',
    'rdo',
    'long_service',
    'training',
    'bereavement'
  ];

  var ABSENCE_TYPE_LABELS = {
    'annual_leave': 'Annual Leave',
    'sick_leave': 'Sick / Personal Leave',
    'rdo': 'Rostered Day Off (RDO)',
    'long_service': 'Long Service Leave',
    'training': 'Mandatory Training',
    'bereavement': 'Compassionate / Bereavement'
  };

  var ABSENCE_TYPE_COLORS = {
    'annual_leave': '#0284c7', // Sky
    'sick_leave': '#dc2626',   // Red
    'rdo': '#7c3aed',          // Purple
    'long_service': '#059669', // Emerald
    'training': '#d97706',     // Amber
    'bereavement': '#475569'   // Slate
  };

  function isRealYmd(text) {
    if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    var y = parseInt(text.slice(0, 4), 10);
    var m = parseInt(text.slice(5, 7), 10);
    var d = parseInt(text.slice(8, 10), 10);
    if (m < 1 || m > 12) return false;
    var test = new Date(Date.UTC(y, m - 1, d));
    return test.getUTCFullYear() === y &&
           test.getUTCMonth() + 1 === m &&
           test.getUTCDate() === d;
  }

  var engine = {
    VALID_TYPES: VALID_ABSENCE_TYPES,
    TYPE_LABELS: ABSENCE_TYPE_LABELS,
    TYPE_COLORS: ABSENCE_TYPE_COLORS,

    isRealYmd: isRealYmd,

    validateRefusalRecord: function(record) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return { valid: false, error: 'Refusal record must be an object.' };
      }
      if (!record.id || typeof record.id !== 'string' || !record.id.trim()) {
        return { valid: false, error: 'Refusal record missing required id.' };
      }
      if (!record.staffId || typeof record.staffId !== 'string' || !record.staffId.trim()) {
        return { valid: false, error: 'Refusal record missing required staffId.' };
      }
      if (!record.date || typeof record.date !== 'string' || !isRealYmd(record.date)) {
        return { valid: false, error: 'Refusal record missing or invalid date (must be YYYY-MM-DD).' };
      }
      return { valid: true };
    },

    validateAbsenceRecord: function(record) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return { valid: false, error: 'Absence record must be an object.' };
      }
      if (!record.id || typeof record.id !== 'string' || !record.id.trim()) {
        return { valid: false, error: 'Absence record missing required id.' };
      }
      if (!record.staffId || typeof record.staffId !== 'string' || !record.staffId.trim()) {
        return { valid: false, error: 'Absence record missing required staffId.' };
      }
      if (!record.type || typeof record.type !== 'string') {
        return { valid: false, error: 'Absence record missing type.' };
      }
      var t = record.type.trim().toLowerCase();
      if (VALID_ABSENCE_TYPES.indexOf(t) === -1) {
        return { valid: false, error: 'Invalid absence type: ' + record.type };
      }
      if (!record.startDate || !isRealYmd(record.startDate)) {
        return { valid: false, error: 'Absence startDate must be YYYY-MM-DD.' };
      }
      if (!record.endDate || !isRealYmd(record.endDate)) {
        return { valid: false, error: 'Absence endDate must be YYYY-MM-DD.' };
      }
      if (record.endDate < record.startDate) {
        return { valid: false, error: 'Absence endDate (' + record.endDate + ') cannot precede startDate (' + record.startDate + ').' };
      }
      return { valid: true };
    },

    isStaffAbsentOnDate: function(staffId, dateStr, absences) {
      if (!staffId || !dateStr || !Array.isArray(absences) || absences.length === 0) {
        return { absent: false };
      }
      for (var i = 0; i < absences.length; i++) {
        var rec = absences[i];
        if (!rec || rec.staffId !== staffId) continue;
        if (dateStr >= rec.startDate && dateStr <= rec.endDate) {
          return {
            absent: true,
            record: rec,
            type: rec.type,
            label: ABSENCE_TYPE_LABELS[rec.type] || rec.type,
            notes: rec.notes || ''
          };
        }
      }
      return { absent: false };
    },

    findShiftConflicts: function(absences, allShifts) {
      if (!Array.isArray(absences) || !Array.isArray(allShifts)) return [];
      var conflicts = [];
      for (var sIdx = 0; sIdx < allShifts.length; sIdx++) {
        var shift = allShifts[sIdx];
        if (!shift || !shift.date) continue;
        var assigned = Array.isArray(shift.assignedStaffIds) ? shift.assignedStaffIds : [];
        for (var aIdx = 0; aIdx < assigned.length; aIdx++) {
          var staffId = assigned[aIdx];
          var check = this.isStaffAbsentOnDate(staffId, shift.date, absences);
          if (check.absent) {
            conflicts.push({
              shiftId: shift.shiftId,
              date: shift.date,
              staffId: staffId,
              absenceRecord: check.record,
              absenceType: check.type,
              message: 'Officer is on ' + check.label + ' during rostered shift on ' + shift.date
            });
          }
        }
      }
      return conflicts;
    },

    /**
     * Fair-Share Overtime Allocation Algorithm (Section 6.5)
     * Priority Score = w1 * Eligibility - w2 * YTD Hours + w3 * Refusal Weight - w4 * Fatigue Penalty
     * Higher score indicates higher dispatch priority.
     */
    calculateFairShareScore: function(staff, params) {
      params = params || {};
      var ytdHours = (typeof staff.ytdOvertimeHours === 'number') ? staff.ytdOvertimeHours : ((typeof staff.ytdHours === 'number') ? staff.ytdHours : 0);
      var asOfDate = params.asOfDate || (params.shift && (params.shift.date || params.shift.shiftDate)) || null;
      var refusalCount = (typeof params.refusalCount === 'number')
        ? params.refusalCount
        : (staff && Array.isArray(params.refusalHistory) ? this.getStaffRefusalCount(staff.id, params.refusalHistory, asOfDate) : 0);
      var fatiguePenalty = (typeof params.fatiguePenalty === 'number') ? params.fatiguePenalty : 0;

      // w1 = 1000 base eligibility
      // w2 = 2 per overtime hour accumulated
      // w3 = 5 per recorded refusal (fair balancing)
      // w4 = 25 per fatigue tier escalation
      var score = 1000 - (ytdHours * 2) + (refusalCount * 5) - fatiguePenalty;
      return Math.round(score * 100) / 100;
    },

    getStaffRefusalCount: function(staffId, refusalHistory, asOfDate) {
      if (!staffId || !Array.isArray(refusalHistory)) return 0;
      // Review 59 Gate D (R59-P2-05): Require a valid Gregorian YMD asOfDate decision context.
      // Missing, malformed, or unsupplied asOfDate fails closed to 0 to prevent awarding unbounded lifetime bonuses.
      if (!asOfDate || typeof asOfDate !== 'string' || !isRealYmd(asOfDate)) {
        return 0;
      }
      var count = 0;
      var seenIds = new Set();
      for (var i = 0; i < refusalHistory.length; i++) {
        var ref = refusalHistory[i];
        if (!ref || ref.staffId !== staffId) continue;
        // Review 58 R58-P1-03: Refusal date is mandatory and must be a valid real YMD date
        if (!ref.date || typeof ref.date !== 'string' || !isRealYmd(ref.date)) {
          continue;
        }

        // Stage 3 / Review 57 R57-P1-04: Exclude future refusal events relative to as-of shift date
        if (ref.date > asOfDate) {
          continue;
        }
        // Align with annual calendar-year overtime horizon
        if (ref.date.slice(0, 4) !== asOfDate.slice(0, 4)) {
          continue;
        }

        // Review 58 R58-P2-04: Deduplication MUST happen after date filtering
        // Out-of-window/future records must NEVER poison or preempt valid in-window duplicates
        if (ref.id) {
          if (seenIds.has(ref.id)) continue;
          seenIds.add(ref.id);
        }

        count++;
      }
      return count;
    }
  };

  window.HortOpsAbsences = engine;
  window.HortOpsAbsenceLedger = engine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
  }
})();
