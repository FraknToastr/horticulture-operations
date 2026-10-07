// Enterprise Agreement Overtime & Shift Costing Calculator
// Manages Enterprise Agreement overtime rates, meal allowances, weekend penalty rates, and shift costing math.
window.HortOpsCostCalculator = {
  DEFAULT_BUDGET_SETTINGS: {
    hourlyBaseRate: 44.50,
    satMultiplierFirst2h: 1.5,
    satMultiplierAfter2h: 2.0,
    sunMultiplier: 2.0,
    holidayMultiplier: 2.5,
    mealAllowance: 24.80
  },

  /**
   * Calculates projected cost for an operational shift under Enterprise Agreement rules.
   * @param {Object} shift - Occurrence record
   * @param {Object} [settings] - Budget/rate settings
   * @returns {{ totalCost: number, laborCost: number, mealCost: number, averageRatePerHour: number }}
   */
  calculateShiftCost: function(shift, settings) {
    if (!shift) {
      return {
        totalCost: 0,
        laborCost: 0,
        mealCost: 0,
        averageRatePerHour: 0
      };
    }
    settings = settings || this.DEFAULT_BUDGET_SETTINGS;
    var hourlyBaseRate = settings.hourlyBaseRate;
    var satMultiplierFirst2h = settings.satMultiplierFirst2h;
    var satMultiplierAfter2h = settings.satMultiplierAfter2h;
    var sunMultiplier = settings.sunMultiplier;
    var holidayMultiplier = settings.holidayMultiplier;
    var mealAllowance = settings.mealAllowance;

    // Unknown historical commitment calculations (Peer Review 04 Finding 4):
    // Unverified schedules produce 0 hours, 0 cost, 0 meals and finite non-NaN numbers
    if (shift.unverifiedSchedule || shift.durationHours === null || shift.durationHours === undefined) {
      return {
        totalCost: 0,
        laborCost: 0,
        mealCost: 0,
        averageRatePerHour: hourlyBaseRate
      };
    }

    var hours = Number(shift.durationHours) || 0;
    var crew = Number(shift.crewSize || shift.crewSizeRequired || 3) || 0;

    var totalLaborForOneWorker = 0;
    if (shift.isPublicHoliday) {
      totalLaborForOneWorker = hours * hourlyBaseRate * holidayMultiplier;
    } else if (shift.dayOfWeek === 'Sunday') {
      totalLaborForOneWorker = hours * hourlyBaseRate * sunMultiplier;
    } else if (shift.dayOfWeek === 'Saturday') {
      var first2h = Math.min(2, hours);
      var remHours = Math.max(0, hours - 2);
      totalLaborForOneWorker = (first2h * hourlyBaseRate * satMultiplierFirst2h) + (remHours * hourlyBaseRate * satMultiplierAfter2h);
    } else {
      // Non-holiday weekday overtime retains the existing rate calculation.
      var first2hW = Math.min(2, hours);
      var remHoursW = Math.max(0, hours - 2);
      totalLaborForOneWorker = (first2hW * hourlyBaseRate * satMultiplierFirst2h) + (remHoursW * hourlyBaseRate * satMultiplierAfter2h);
    }

    var totalLaborCost = totalLaborForOneWorker * crew;
    var totalMealCost = (hours >= 5 ? mealAllowance : 0) * crew;
    var totalCost = totalLaborCost + totalMealCost;
    var averageRatePerHour = (hours > 0 && crew > 0) ? (totalLaborCost / (hours * crew)) : hourlyBaseRate;

    return {
      totalCost: totalCost,
      laborCost: totalLaborCost,
      mealCost: totalMealCost,
      averageRatePerHour: averageRatePerHour
    };
  }
};
