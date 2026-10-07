// Operational Scheduling Engine & Capacity Simulation
// Sole Public Facade for Scheduling and Costing: delegates to costCalculator.js and engine.js sub-modules.
if (typeof require !== 'undefined') {
  if (typeof window === 'undefined') {
    global.window = global;
  }
  if (!window.HortOpsRecurrence) require('./recurrence.js');
  if (!window.HortOpsPlanningRules) require('./planningRules.js');
  if (typeof window.HortOpsCostCalculator === 'undefined') {
    try { require('./scheduler/costCalculator.js'); } catch (e) {}
  }
  if (typeof window.HortOpsSchedulerEngine === 'undefined') {
    try { require('./scheduler/engine.js'); } catch (e) {}
  }
}

window.HortOpsScheduler = {
  DEFAULT_BUDGET_SETTINGS: {
    hourlyBaseRate: 44.50,
    satMultiplierFirst2h: 1.5,
    satMultiplierAfter2h: 2.0,
    sunMultiplier: 2.0,
    holidayMultiplier: 2.5,
    mealAllowance: 24.80
  },

  revalidateShiftAssignments: function(shift, roster, job, allShifts) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.revalidateShiftAssignments !== 'function') {
      throw new Error('Scheduler engine unavailable: window.HortOpsSchedulerEngine is required');
    }
    return window.HortOpsSchedulerEngine.revalidateShiftAssignments(shift, roster, job, allShifts);
  },

  resolveExplicitOccurrenceLifecycle: function(params) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.resolveExplicitOccurrenceLifecycle !== 'function') {
      throw new Error('Scheduler engine unavailable: window.HortOpsSchedulerEngine is required');
    }
    return window.HortOpsSchedulerEngine.resolveExplicitOccurrenceLifecycle(params);
  },

  formatDateISO: function(d) {
    if (window.HortOpsSchedulerEngine && typeof window.HortOpsSchedulerEngine.formatDateISO === 'function') {
      return window.HortOpsSchedulerEngine.formatDateISO(d);
    }
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  },

  getUtcDayDiff: function(d1Str, d2Str) {
    if (window.HortOpsSchedulerEngine && typeof window.HortOpsSchedulerEngine.getUtcDayDiff === 'function') {
      return window.HortOpsSchedulerEngine.getUtcDayDiff(d1Str, d2Str);
    }
    var d1 = Date.UTC(parseInt(d1Str.slice(0, 4), 10), parseInt(d1Str.slice(5, 7), 10) - 1, parseInt(d1Str.slice(8, 10), 10));
    var d2 = Date.UTC(parseInt(d2Str.slice(0, 4), 10), parseInt(d2Str.slice(5, 7), 10) - 1, parseInt(d2Str.slice(8, 10), 10));
    return Math.round((d2 - d1) / (24 * 60 * 60 * 1000));
  },

  generateWeekendSlots: function(year) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.generateWeekendSlots !== 'function') {
      throw new Error('Scheduler engine unavailable: window.HortOpsSchedulerEngine is required');
    }
    return window.HortOpsSchedulerEngine.generateWeekendSlots(year);
  },

  resolveEffectivePermitState: function(baseRecord, dateKey, entityId, customPermits) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.resolveEffectivePermitState !== 'function') {
      throw new Error('Scheduler engine unavailable: window.HortOpsSchedulerEngine is required');
    }
    return window.HortOpsSchedulerEngine.resolveEffectivePermitState(baseRecord, dateKey, entityId, customPermits);
  },

  resolvePermitMeta: function(job, dateKey, entityId, customPermits) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.resolvePermitMeta !== 'function') {
      throw new Error('Scheduler engine unavailable: window.HortOpsSchedulerEngine is required');
    }
    return window.HortOpsSchedulerEngine.resolvePermitMeta(job, dateKey, entityId, customPermits);
  },

  isGeneratedRecurrenceOccurrence: function(job, dateOrShiftId) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.isGeneratedRecurrenceOccurrence !== "function") {
      throw new Error("Scheduler engine unavailable: window.HortOpsSchedulerEngine is required");
    }
    return window.HortOpsSchedulerEngine.isGeneratedRecurrenceOccurrence(job, dateOrShiftId);
  },

  isExplicitOperationalOccurrence: function(job, dateOrShiftId, workspaceOrShifts) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.isExplicitOperationalOccurrence !== "function") {
      throw new Error("Scheduler engine unavailable: window.HortOpsSchedulerEngine is required");
    }
    return window.HortOpsSchedulerEngine.isExplicitOperationalOccurrence(job, dateOrShiftId, workspaceOrShifts);
  },

  isCanonicalOperationalOccurrence: function(job, dateOrShiftId, workspaceOrShifts) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.isCanonicalOperationalOccurrence !== "function") {
      throw new Error("Scheduler engine unavailable: window.HortOpsSchedulerEngine is required");
    }
    return window.HortOpsSchedulerEngine.isCanonicalOperationalOccurrence(job, dateOrShiftId, workspaceOrShifts);
  },

  isCanonicalOccurrence: function(job, dateOrShiftId, workspaceOrShifts) {
    return this.isCanonicalOperationalOccurrence(job, dateOrShiftId, workspaceOrShifts);
  },

  resolveShiftHistoricalTiming: function(shiftId, jobId, dateStr, customSnapshots) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.resolveShiftHistoricalTiming !== 'function') {
      throw new Error('Scheduler engine unavailable: window.HortOpsSchedulerEngine is required');
    }
    return window.HortOpsSchedulerEngine.resolveShiftHistoricalTiming(shiftId, jobId, dateStr, customSnapshots);
  },

  generateRangeDigest: function(jobs, from, to, includeResolved, customAssignments, staffList, customPermits, customSnapshots) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.generateRangeDigest !== 'function') throw new Error('Range scheduler unavailable.');
    return window.HortOpsSchedulerEngine.generateRangeDigest(jobs, from, to, includeResolved, customAssignments, staffList, customPermits, customSnapshots);
  },

  generateOperationalDigest: function(jobs, year, includeResolved, customAssignments, staffList, customPermits, customSnapshots) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.generateOperationalDigest !== 'function') {
      throw new Error('Scheduler engine unavailable: window.HortOpsSchedulerEngine is required');
    }
    return window.HortOpsSchedulerEngine.generateOperationalDigest(jobs, year, includeResolved, customAssignments, staffList, customPermits, customSnapshots);
  },

  clearBoundaryCache: function() {
    if (window.HortOpsSchedulerEngine && typeof window.HortOpsSchedulerEngine.clearBoundaryCache === 'function') {
      window.HortOpsSchedulerEngine.clearBoundaryCache();
    }
  },

  getAdjacentBoundaryShifts: function(targetDate, jobs, customAssignments, staffList, customSnapshots) {
    if (!window.HortOpsSchedulerEngine || typeof window.HortOpsSchedulerEngine.getAdjacentBoundaryShifts !== 'function') {
      var errList = [];
      errList.lookupFailed = true;
      errList.error = true;
      errList.code = 'ADJACENT_SCHEDULE_UNAVAILABLE';
      errList.errorMessage = 'HortOpsSchedulerEngine is unavailable';
      return errList;
    }
    return window.HortOpsSchedulerEngine.getAdjacentBoundaryShifts(targetDate, jobs, customAssignments, staffList, customSnapshots);
  },

  calculateShiftCost: function(shift, settings) {
    if (!window.HortOpsCostCalculator || typeof window.HortOpsCostCalculator.calculateShiftCost !== 'function') {
      throw new Error('Cost calculator unavailable: window.HortOpsCostCalculator is required for shift cost calculation');
    }
    var s = settings || this.DEFAULT_BUDGET_SETTINGS;
    return window.HortOpsCostCalculator.calculateShiftCost(shift, s);
  }
};
