// Canonical overtime dates. All comparisons and interval arithmetic use local
// calendar keys and UTC day arithmetic, never a planner's display week number.
(function () {
  'use strict';
  if (typeof window === 'undefined') global.window = global;
  var DAY = 86400000;
  var types = ['one_off', 'recurring_weeks', 'recurring_cadence', 'annual', 'seasonal', 'work_pattern'];
  function fail(error) { return { valid: false, error: error }; }
  function real(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T00:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function time(date) { return Date.parse(date + 'T00:00:00Z'); }
  function key(date) { return date.toISOString().slice(0, 10); }
  function weekday(date) { return new Date(date + 'T00:00:00Z').getUTCDay(); }
  function integer(value, min, max) { return Number.isInteger(value) && value >= min && value <= max; }
  function md(value) { return typeof value === 'string' && /^\d{2}-\d{2}$/.test(value) && real('2000-' + value); }
  function holiday(date) {
    if (!window.HortOpsData || typeof window.HortOpsData.getPublicHolidaysForYear !== 'function') throw new Error('The South Australian public-holiday calendar is unavailable.');
    return window.HortOpsData.getPublicHolidaysForYear(Number(date.slice(0, 4))).find(function (h) { return h.date === date && !h.isPartDay && !h.isPartialDay; });
  }
  function operating(date) {
    if (!real(date)) return false;
    var day = weekday(date);
    return day === 0 || day === 6 || ((day === 1 || day === 5) && !!holiday(date));
  }
  function preferred(day) { return { saturday: 6, sunday: 0, friday: 5, monday: 1, friday_pre_holiday: 5, monday_post_holiday: 1 }[day || 'saturday']; }
  function validateEnd(job) {
    var end = job.scheduleEnd;
    if (end === undefined) return { valid: true };
    if (!end || typeof end !== 'object' || Array.isArray(end) || ['never', 'on_date', 'after_count'].indexOf(end.mode) < 0) return fail('Choose a valid series end condition.');
    if (end.mode === 'on_date' && !real(end.date)) return fail('Choose a valid series end date.');
    if (end.mode === 'after_count' && !integer(end.count, 1, 10000)) return fail('Occurrence count must be a whole number from 1 to 10000.');
        var start;
        if (job.frequencyType === 'one_off') start = job.targetDate;
        else if (job.frequencyType === 'recurring_weeks' || job.frequencyType === 'recurring_cadence') start = job.anchorDate;
        else if (job.frequencyType === 'work_pattern') start = job.workPattern && job.workPattern.startDate;
        else if (job.frequencyType === 'annual') start = job.annualRule && job.annualRule.startYear + '-01-01';
        else if (job.frequencyType === 'seasonal') start = job.seasonalRule && job.seasonalRule.firstYear + '-' + job.seasonalRule.start;
    if (end.mode === 'on_date' && start && end.date < start) return fail('The series end cannot precede its start.');
    return { valid: true };
  }
    function validate(job) {
        try { return validateRules(job); }
        catch (error) { return fail('Recurrence validation unavailable: ' + error.message); }
    }
    function validateRules(job) {
    if (!job || types.indexOf(job.frequencyType) < 0) return fail('Choose a supported schedule type.');
    var check = validateEnd(job); if (!check.valid) return check;
    if (job.frequencyType === 'one_off') {
            if (!real(job.targetDate)) return fail('A valid Gregorian calendar targetDate (YYYY-MM-DD) is required.');
            if (!operating(job.targetDate)) return fail('One-off targetDate has unsupported weekday: overtime is allowed on Saturday/Sunday, or public-holiday Friday/Monday only.');
    }
    if (job.frequencyType === 'recurring_weeks' || job.frequencyType === 'recurring_cadence') {
            if (!real(job.anchorDate)) return fail('A valid Gregorian calendar YYYY-MM-DD anchorDate is required.');
            if (!integer(job.intervalWeeks, 1, 520)) return fail('An integer intervalWeeks >= 1 and <= 520 is required.');
            if (preferred(job.preferredDay) === undefined) return fail('Recurring job has unsupported preferredDay.');
            if (weekday(job.anchorDate) !== preferred(job.preferredDay)) return fail('anchorDate does not match preferredDay.');
      if (!operating(job.anchorDate)) return fail('A Friday/Monday start must be a recognised public holiday.');
    }
    if (job.frequencyType === 'annual') {
      var rule = job.annualRule;
      if (!rule || !integer(rule.startYear, 2020, 2100) || !integer(rule.month, 1, 12)) return fail('Annual date requires an explicit first year, month and date rule.');
      if (rule.kind === 'fixed') {
        if (!integer(rule.day, 1, 31) || !real('2000-' + String(rule.month).padStart(2, '0') + '-' + String(rule.day).padStart(2, '0'))) return fail('Choose a real annual month/day.');
      } else if (rule.kind === 'weekday') {
        if ([0, 6].indexOf(rule.weekday) < 0 || [1, 2, 3, 4, 5, -1].indexOf(rule.ordinal) < 0) return fail('Choose the first–fifth or last Saturday/Sunday.');
      } else return fail('Choose exact date or weekday-in-month for the annual date.');
    }
    if (job.frequencyType === 'seasonal') {
      var season = job.seasonalRule;
      if (!season || !md(season.start) || !md(season.end) || !md(season.anchor) || !integer(season.firstYear, 2020, 2100)) return fail('Specify season start, end, interval anchor and first season year.');
      if (!integer(season.intervalWeeks, 1, 52)) return fail('Seasonal interval must be a whole number from 1 to 52 weeks.');
      if (!Array.isArray(season.days) || !season.days.length || new Set(season.days).size !== season.days.length || !season.days.every(function (d) { return [0, 1, 5, 6].indexOf(d) >= 0; })) return fail('Select seasonal operating days.');
      if (typeof season.includePublicHolidays !== 'boolean') return fail('Choose whether to include public-holiday Friday/Monday dates.');
      if (season.end >= season.start ? season.anchor < season.start || season.anchor > season.end : season.anchor < season.start && season.anchor > season.end) return fail('The interval anchor must fall inside the season.');
    }
    if (job.frequencyType === 'work_pattern') {
      var pattern = job.workPattern;
      if (!pattern || !real(pattern.startDate) || (pattern.endDate !== undefined && !real(pattern.endDate)) || (pattern.endDate && pattern.endDate < pattern.startDate)) return fail('Choose valid pattern start/end dates.');
      if (['weekly', 'run'].indexOf(pattern.mode) < 0 || typeof pattern.includePublicHolidays !== 'boolean') return fail('Choose a valid multi-day pattern.');
      if (!Array.isArray(pattern.excludedDates) || new Set(pattern.excludedDates).size !== pattern.excludedDates.length || !pattern.excludedDates.every(real)) return fail('Excluded dates must be unique valid dates.');
      if (pattern.mode === 'run') {
        if (!integer(pattern.runLength, 1, 4)) return fail('A consecutive run must contain one to four calendar days.');
        for (var index = 0; index < pattern.runLength; index++) if (!operating(key(new Date(time(pattern.startDate) + index * DAY)))) return fail('Every day of a consecutive run must be Saturday/Sunday or a public-holiday Friday/Monday.');
      } else {
        if (!Array.isArray(pattern.days) || new Set(pattern.days).size !== pattern.days.length || !pattern.days.every(function (d) { return [0, 1, 5, 6].indexOf(d) >= 0; }) || (!pattern.days.length && !pattern.includePublicHolidays)) return fail('Choose weekend days or public-holiday Friday/Monday dates.');
        if (pattern.intervalWeeks !== undefined && !integer(pattern.intervalWeeks, 1, 52)) return fail('Pattern interval must be a whole number from 1 to 52 weeks.');
      }
    }
    return { valid: true };
  }
  function annualDate(rule, year) {
    var month = String(rule.month).padStart(2, '0');
    if (rule.kind === 'fixed') return year + '-' + month + '-' + String(rule.day).padStart(2, '0');
    var days = [];
    for (var day = 1; day <= 31; day++) {
      var date = year + '-' + month + '-' + String(day).padStart(2, '0');
      if (real(date) && weekday(date) === rule.weekday) days.push(date);
    }
    return rule.ordinal === -1 ? days[days.length - 1] : days[rule.ordinal - 1];
  }
  function windowFor(rule, year) {
    var crosses = rule.end < rule.start;
    return { start: year + '-' + rule.start, end: (year + (crosses ? 1 : 0)) + '-' + rule.end,
      anchor: (year + (crosses && rule.anchor < rule.start ? 1 : 0)) + '-' + rule.anchor };
  }
  function weeklyMatch(date, anchor, interval, days, includeHolidays) {
    if (date < anchor) return false;
    var anchorMonday = time(anchor) - ((weekday(anchor) + 6) % 7) * DAY;
    var week = Math.floor((time(date) - anchorMonday) / (7 * DAY));
    return week % interval === 0 && (days.indexOf(weekday(date)) >= 0 || (includeHolidays && !!holiday(date)));
  }
  function datesInRange(job, from, to) {
    if (!real(from) || !real(to) || to < from) throw new Error('Choose a valid inclusive scheduling range.');
    if (!validate(job).valid) return [];
    var results = [], end = job.scheduleEnd || { mode: 'never' };
    var exclusions = new Set(job.excludedDates || (job.workPattern && job.workPattern.excludedDates) || []);
    if (end.mode === 'on_date') to = to < end.date ? to : end.date;
    if (to < from) return [];
    function emit(date) { if (date && date >= from && date <= to && !exclusions.has(date)) results.push(date); }
    function collect(start, finish, match) {
      if (finish > to) finish = to;
      var count = 0;
      // Counts run from the series/season origin, including occurrences outside
      // the displayed horizon. A display or New Year never resets the counter.
      var begin = end.mode === 'after_count' ? start : (start > from ? start : from);
      for (var stamp = time(begin); stamp <= time(finish); stamp += DAY) {
        var date = key(new Date(stamp));
        if (!match(date) || !operating(date)) continue;
        count++;
        if (end.mode === 'after_count' && count > end.count) break;
        emit(date);
      }
    }
    if (job.frequencyType === 'one_off') emit(job.targetDate);
    else if (job.frequencyType === 'annual') {
      var rule = job.annualRule, count = 0;
      for (var year = rule.startYear; year <= Number(to.slice(0, 4)); year++) {
        var annual = annualDate(rule, year);
        if (!annual || !operating(annual)) continue;
        if (end.mode === 'after_count' && ++count > end.count) break;
        emit(annual);
      }
    } else if (job.frequencyType === 'seasonal') {
      var season = job.seasonalRule;
      for (var sy = Math.max(season.firstYear, Number(from.slice(0, 4)) - 1); sy <= Number(to.slice(0, 4)); sy++) {
        var bounds = windowFor(season, sy);
        if (!real(bounds.start) || !real(bounds.end) || !real(bounds.anchor)) continue;
        collect(bounds.start, bounds.end, function (date) { return weeklyMatch(date, bounds.anchor, season.intervalWeeks, season.days, season.includePublicHolidays); });
      }
    } else if (job.frequencyType === 'work_pattern') {
      var pattern = job.workPattern, excluded = new Set(pattern.excludedDates);
      collect(pattern.startDate, pattern.endDate || to, function (date) {
        if (excluded.has(date)) return false;
        return pattern.mode === 'run' ? time(date) - time(pattern.startDate) < pattern.runLength * DAY :
          weeklyMatch(date, pattern.startDate, pattern.intervalWeeks || 1, pattern.days, pattern.includePublicHolidays);
      });
    } else {
      collect(job.anchorDate, to, function (date) { return weekday(date) === preferred(job.preferredDay) && (time(date) - time(job.anchorDate)) % (job.intervalWeeks * 7 * DAY) === 0; });
    }
    return Array.from(new Set(results)).sort();
  }
  window.HortOpsRecurrence = { types: types, validate: validate, isRealDate: real,
    isOperatingDate: operating, holiday: holiday, datesInRange: datesInRange,
    dates: function (job, year) { return datesInRange(job, year + '-01-01', year + '-12-31'); },
    seasonWindow: windowFor, annualDate: annualDate };
}());
