// Canonical Multi-Week Fatigue Risk & Predictive Overtime Allocation Engine (Stage 3 Gate 3C)
// Governs cumulative workload safety, consecutive working weekend thresholds,
// and equal-opportunity overtime allocation ranking across the municipal workforce.

if (typeof require !== 'undefined') {
  if (typeof window === 'undefined') {
    global.window = global;
  }
}

(function() {
  'use strict';

  var FATIGUE_TIERS = {
    LOW: {
      code: 'LOW',
      label: 'Low Fatigue',
      color: '#059669',
      badgeClass: 'badge-emerald',
      description: 'Safe operating zone. Well within regulatory hours and recovery cycles.'
    },
    MODERATE: {
      code: 'MODERATE',
      label: 'Moderate Fatigue',
      color: '#d97706',
      badgeClass: 'badge-amber',
      description: 'Approaching elevated workload threshold. Monitor successive allocations.'
    },
    HIGH: {
      code: 'HIGH',
      label: 'High Fatigue',
      color: '#ea580c',
      badgeClass: 'badge-orange',
      description: 'Elevated fatigue risk. 3 consecutive weekends or high rolling overtime accumulation.'
    },
    CRITICAL: {
      code: 'CRITICAL',
      label: 'Critical / Rest Required',
      color: '#dc2626',
      badgeClass: 'badge-danger',
      description: 'Mandatory rest required. >=4 consecutive weekends or severe overtime accumulation.'
    }
  };

  function parseDateToUtc(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    var clean = dateStr.slice(0, 10);
    var parts = clean.split('-');
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    return new Date(Date.UTC(y, m - 1, d));
  }

  function getDaysDiff(dateAStr, dateBStr) {
    var utcA = parseDateToUtc(dateAStr);
    var utcB = parseDateToUtc(dateBStr);
    if (!utcA || !utcB) return 0;
    var msPerDay = 86400000;
    return Math.round((utcA.getTime() - utcB.getTime()) / msPerDay);
  }

  function getWeekendAnchor(dateStr) {
    var utc = parseDateToUtc(dateStr);
    if (!utc) return dateStr;
    var dow = utc.getUTCDay(); // 0 Sun, 1 Mon, 5 Fri, 6 Sat
    var diffDays = 0;
    if (dow === 5) diffDays = 1;       // Friday -> Saturday
    else if (dow === 6) diffDays = 0;  // Saturday
    else if (dow === 0) diffDays = -1; // Sunday -> Saturday
    else if (dow === 1) diffDays = -2; // Monday -> Saturday
    else return null; // Tue, Wed, Thu not part of standard weekend overtime blocks

    var satTime = utc.getTime() + (diffDays * 86400000);
    return new Date(satTime).toISOString().slice(0, 10);
  }

  function getShiftAssignedStaffIds(shift) {
    if (!shift) return [];
    if (Array.isArray(shift.assignedStaffIds)) return shift.assignedStaffIds;
    if (Array.isArray(shift.assignedIds)) return shift.assignedIds;
    if (Array.isArray(shift.assignedStaffList)) {
      return shift.assignedStaffList.map(function(s) { return s.id; }).filter(Boolean);
    }
    return [];
  }

  var engine = {
    TIERS: FATIGUE_TIERS,

    parseDateToUtc: parseDateToUtc,
    getDaysDiff: getDaysDiff,
    getWeekendAnchor: getWeekendAnchor,

    /**
     * Calculates cumulative overtime hours worked by a staff member within a rolling window.
     * @param {string} staffId - Staff identifier
     * @param {Array} allShifts - Complete shift history/occurrences
     * @param {string} asOfDate - Target reference date (YYYY-MM-DD)
     * @param {number} windowDays - Window lookback in calendar days (e.g. 14 or 28)
     * @returns {number} Total cumulative hours in window
     */
    calculateRollingHours: function(staffId, allShifts, asOfDate, windowDays) {
      if (!staffId || !Array.isArray(allShifts) || !asOfDate) return 0;
      windowDays = windowDays || 14;
      var totalHours = 0;

      for (var i = 0; i < allShifts.length; i++) {
        var shift = allShifts[i];
        if (!shift || !shift.date) continue;
        var diff = getDaysDiff(asOfDate, shift.date);
        // Strictly include shifts on or before asOfDate within [0, windowDays) calendar days
        if (diff >= 0 && diff < windowDays) {
          var assigned = getShiftAssignedStaffIds(shift);
          if (assigned.indexOf(staffId) !== -1) {
            // R55-P1-05: Never silently invent 4 hours; only count verified valid numeric durations
            var dur = (typeof shift.durationHours === 'number' && !isNaN(shift.durationHours) && shift.durationHours > 0)
              ? shift.durationHours
              : 0;
            totalHours += dur;
          }
        }
      }

      return Math.round(totalHours * 100) / 100;
    },

    /**
     * Calculates the number of consecutive weekends worked leading up to (and including) asOfDate.
     * Consecutive means spaced 7 days apart without a full weekend rest break.
     * @param {string} staffId - Staff identifier
     * @param {Array} allShifts - Complete shift occurrences
     * @param {string} asOfDate - Target reference date
     * @returns {number} Consecutive weekends worked
     */
    calculateConsecutiveWeekends: function(staffId, allShifts, asOfDate) {
      if (!staffId || !Array.isArray(allShifts) || !asOfDate) return 0;

      // Collect all unique worked weekend anchor dates (Saturday YYYY-MM-DD)
      var workedWeekends = new Set();
      for (var i = 0; i < allShifts.length; i++) {
        var shift = allShifts[i];
        if (!shift || !shift.date) continue;
        var assigned = getShiftAssignedStaffIds(shift);
        if (assigned.indexOf(staffId) !== -1) {
          var wAnchor = getWeekendAnchor(shift.date);
          if (wAnchor) {
            workedWeekends.add(wAnchor);
          }
        }
      }

      if (workedWeekends.size === 0) return 0;

      // Start from the weekend anchor of asOfDate (or preceding weekend if asOfDate was not worked)
      var currentAnchor = getWeekendAnchor(asOfDate);
      if (!currentAnchor) {
        // asOfDate is mid-week; find preceding Saturday
        var utc = parseDateToUtc(asOfDate);
        if (utc) {
          var dow = utc.getUTCDay();
          var diff = (dow + 1) % 7;
          currentAnchor = new Date(utc.getTime() - (diff * 86400000)).toISOString().slice(0, 10);
        }
      }

      var consecutive = 0;
      var curUtc = parseDateToUtc(currentAnchor);
      if (!curUtc) return 0;

      // If current anchor was not worked, check previous weekend
      var curKey = curUtc.toISOString().slice(0, 10);
      if (!workedWeekends.has(curKey)) {
        curUtc = new Date(curUtc.getTime() - (7 * 86400000));
        curKey = curUtc.toISOString().slice(0, 10);
      }

      while (workedWeekends.has(curKey)) {
        consecutive++;
        curUtc = new Date(curUtc.getTime() - (7 * 86400000));
        curKey = curUtc.toISOString().slice(0, 10);
      }

      return consecutive;
    },

    /**
     * Evaluates comprehensive multi-week fatigue risk metrics and tier classification for an employee.
     * @param {Object} staff - Staff member record
     * @param {Array} allShifts - Complete shift occurrences
     * @param {string} asOfDate - Evaluation date
     * @returns {Object} Comprehensive fatigue evaluation
     */
    evaluateStaffFatigue: function(staff, allShifts, asOfDate) {
      if (typeof staff === 'string') {
        staff = { id: staff };
      }
      if (!staff || !staff.id) {
        return {
          tier: 'LOW',
          config: FATIGUE_TIERS.LOW,
          consecutiveWeekends: 0,
          rolling14DaysHours: 0,
          rolling28DaysHours: 0,
          isHardBlocked: false,
          score: 0,
          message: 'Safe workload.'
        };
      }

      asOfDate = asOfDate || (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function' ? window.HortOpsDateUtils.getLocalDateKey() : new Date().toISOString().slice(0, 10));

      var rolling14 = this.calculateRollingHours(staff.id, allShifts, asOfDate, 14);
      var rolling28 = this.calculateRollingHours(staff.id, allShifts, asOfDate, 28);
      var weekends = this.calculateConsecutiveWeekends(staff.id, allShifts, asOfDate);

      var tier = 'LOW';
      var isHardBlocked = false;
      var message = 'Workload within safe operating bounds.';

      if (weekends >= 4 || rolling14 >= 32 || rolling28 >= 56) {
        tier = 'CRITICAL';
        isHardBlocked = true;
        message = 'Mandatory rest required: ' + (weekends >= 4 ? (weekends + ' consecutive weekends worked.') : 'Rolling overtime limits exceeded (' + rolling14 + 'h / 14d).');
      } else if (weekends === 3 || rolling14 >= 22 || rolling28 >= 38) {
        tier = 'HIGH';
        isHardBlocked = false;
        message = 'Elevated fatigue: ' + (weekends === 3 ? '3 consecutive weekends worked.' : (rolling14 + 'h in last 14 days.'));
      } else if (weekends === 2 || rolling14 >= 12 || rolling28 >= 24) {
        tier = 'MODERATE';
        isHardBlocked = false;
        message = 'Moderate fatigue: ' + weekends + ' consecutive weekends worked (' + rolling14 + 'h in 14d).';
      }

      // Calculate composite fatigue score (0 - 100)
      var weekendComponent = Math.min(weekends * 25, 100);
      var hoursComponent = Math.min((rolling14 / 32) * 100, 100);
      var compositeScore = Math.round((weekendComponent * 0.6) + (hoursComponent * 0.4));

      return {
        staffId: staff.id,
        staffName: staff.name,
        tier: tier,
        config: FATIGUE_TIERS[tier],
        consecutiveWeekends: weekends,
        rolling14DaysHours: rolling14,
        rolling28DaysHours: rolling28,
        isHardBlocked: isHardBlocked,
        score: compositeScore,
        message: message
      };
    },

    /**
     * Simulates what an employee's fatigue metrics would become if allocated to a candidate shift.
     * Used for prospective candidate scoring and fail-closed assignment prevention.
     * @param {Object} staff - Staff member record
     * @param {Object} shift - Proposed shift occurrence
     * @param {Array} allShifts - Complete shift occurrences
     * @returns {Object} Prospective fatigue evaluation
     */
    simulateAssignmentFatigue: function(staff, shift, allShifts) {
      if (!staff || !shift) return this.evaluateStaffFatigue(staff, allShifts);
      allShifts = allShifts || [];

      // Create synthetic simulated shift list containing this new allocation
      var shiftDate = shift.date || shift.shiftDate || (shift.shiftId && shift.shiftId.split('@')[1]);
      var syntheticShifts = [];
      var matched = false;

      for (var i = 0; i < allShifts.length; i++) {
        var s = allShifts[i];
        if (s && s.shiftId === shift.shiftId) {
          var assigned = getShiftAssignedStaffIds(s).slice();
          if (assigned.indexOf(staff.id) === -1) assigned.push(staff.id);
          var copy = Object.assign({}, s, { assignedStaffIds: assigned });
          syntheticShifts.push(copy);
          matched = true;
        } else {
          syntheticShifts.push(s);
        }
      }

      if (!matched) {
        var newShift = Object.assign({}, shift, {
          assignedStaffIds: [staff.id]
        });
        syntheticShifts.push(newShift);
      }

      return this.evaluateStaffFatigue(staff, syntheticShifts, shiftDate);
    },

    /**
     * Equal-Opportunity Overtime Dispatch Ranking Engine.
     * Produces a fair, fatigue-safe candidate queue prioritized by:
     * 1. Fatigue Tier (LOW before MODERATE before HIGH before CRITICAL)
     * 2. Fewest consecutive weekends worked
     * 3. Lowest rolling 14-day overtime hours
     * 4. Lowest cumulative YTD overtime hours
     * 5. Deterministic tie-breaker: officer name
     * @param {Array} candidates - Candidate officers
     * @param {Array} allShifts - Complete shift occurrences
     * @param {string} asOfDate - Target date
     * @returns {Array} Sorted candidates with fatigue metadata
     */
    rankEqualizedCandidates: function(candidates, allShifts, asOfDate) {
      if (!Array.isArray(candidates)) return [];
      var self = this;

      var tierOrder = { LOW: 1, MODERATE: 2, HIGH: 3, CRITICAL: 4 };

      // Pre-evaluate fatigue for each candidate
      var evaluated = candidates.map(function(cand) {
        var evalRes = self.evaluateStaffFatigue(cand, allShifts, asOfDate);
        return {
          staff: cand,
          fatigue: evalRes
        };
      });

      evaluated.sort(function(a, b) {
        var tA = tierOrder[a.fatigue.tier] || 5;
        var tB = tierOrder[b.fatigue.tier] || 5;
        if (tA !== tB) return tA - tB;

        if (a.fatigue.consecutiveWeekends !== b.fatigue.consecutiveWeekends) {
          return a.fatigue.consecutiveWeekends - b.fatigue.consecutiveWeekends;
        }

        if (a.fatigue.rolling14DaysHours !== b.fatigue.rolling14DaysHours) {
          return a.fatigue.rolling14DaysHours - b.fatigue.rolling14DaysHours;
        }

        var ytdA = a.staff.ytdOvertimeHours || a.staff.ytdHours || 0;
        var ytdB = b.staff.ytdOvertimeHours || b.staff.ytdHours || 0;
        if (ytdA !== ytdB) return ytdA - ytdB;

        return (a.staff.name || '').localeCompare(b.staff.name || '');
      });

      return evaluated.map(function(item) {
        // R55-P1-06: Never mutate canonical staff objects in state.staffList
        var projected = Object.assign({}, item.staff);
        projected.fatigueEval = item.fatigue;
        return projected;
      });
    }
  };

  window.HortOpsFatigueEngine = engine;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = engine;
  }
})();
