// South Australia SafeWork SA Statutory Public Holiday Engine (N-P0-02, P0-12)
// Strictly adheres to SA Public Holidays Act 1910 and SafeWork SA statutory rules:
// - ANZAC Day is always 25 April. In SA, there is NO weekend substitution (no Monday holiday if 25 April falls on Sat/Sun).
// - Christmas & Proclamation: when 25/26 Dec fall on weekends, both calendar weekend days AND designated substitute weekdays are public holidays.

window.HortOpsData = window.HortOpsData || {};

(function() {
  function formatIso(year, month, day) {
    var m = month < 10 ? '0' + month : '' + month;
    var d = day < 10 ? '0' + day : '' + day;
    return year + '-' + m + '-' + d;
  }

  function getEasterSunday(year) {
    var a = year % 19;
    var b = Math.floor(year / 100);
    var c = year % 100;
    var d = Math.floor(b / 4);
    var e = b % 4;
    var f = Math.floor((b + 8) / 25);
    var g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4);
    var k = c % 4;
    var l = (32 + 2 * e + 2 * i - h - k) % 7;
    var m = Math.floor((a + 11 * h + 22 * l) / 451);
    var eMonth = Math.floor((h + l - 7 * m + 114) / 31);
    var eDay = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, eMonth - 1, eDay));
  }

  function getNthWeekdayOfMonth(year, month, targetWeekday, nth) {
    var count = 0;
    for (var day = 1; day <= 31; day++) {
      var d = new Date(Date.UTC(year, month - 1, day));
      if (d.getUTCMonth() !== month - 1) break;
      if (d.getUTCDay() === targetWeekday) {
        count++;
        if (count === nth) {
          return formatIso(year, month, day);
        }
      }
    }
    return '';
  }

  function computeSAPublicHolidays(year) {
    var holidays = [];

    // 1. New Year's Day (1 Jan + Monday substitution if weekend)
    var ny = new Date(Date.UTC(year, 0, 1));
    holidays.push({
      date: formatIso(year, 1, 1),
      name: "New Year's Day",
      shortName: 'New Year',
      isLongWeekend: ny.getUTCDay() === 1 || ny.getUTCDay() === 5
    });
    if (ny.getUTCDay() === 6) {
      holidays.push({
        date: formatIso(year, 1, 3),
        name: "New Year's Day (Observed)",
        shortName: 'New Year (Obs)',
        isLongWeekend: true
      });
    } else if (ny.getUTCDay() === 0) {
      holidays.push({
        date: formatIso(year, 1, 2),
        name: "New Year's Day (Observed)",
        shortName: 'New Year (Obs)',
        isLongWeekend: true
      });
    }

    // 2. Australia Day (26 Jan + Monday substitution if weekend)
    var ad = new Date(Date.UTC(year, 0, 26));
    if (ad.getUTCDay() === 6) {
      holidays.push({
        date: formatIso(year, 1, 28),
        name: 'Australia Day (Observed)',
        shortName: 'Australia Day',
        isLongWeekend: true
      });
    } else if (ad.getUTCDay() === 0) {
      holidays.push({
        date: formatIso(year, 1, 27),
        name: 'Australia Day (Observed)',
        shortName: 'Australia Day',
        isLongWeekend: true
      });
    } else {
      holidays.push({
        date: formatIso(year, 1, 26),
        name: 'Australia Day',
        shortName: 'Australia Day',
        isLongWeekend: ad.getUTCDay() === 1 || ad.getUTCDay() === 5
      });
    }

    // 3. Adelaide Cup (2nd Monday in March)
    var acDate = getNthWeekdayOfMonth(year, 3, 1, 2);
    if (acDate) {
      holidays.push({
        date: acDate,
        name: 'Adelaide Cup Day',
        shortName: 'Adelaide Cup',
        isLongWeekend: true,
        notes: 'Mad March Festival / Racing peak'
      });
    }

    // 4-7. Easter (Good Friday, Easter Saturday, Easter Sunday, Easter Monday)
    var easterSun = getEasterSunday(year);
    var gf = new Date(easterSun); gf.setUTCDate(gf.getUTCDate() - 2);
    var esat = new Date(easterSun); esat.setUTCDate(esat.getUTCDate() - 1);
    var emon = new Date(easterSun); emon.setUTCDate(emon.getUTCDate() + 1);

    holidays.push({ date: gf.toISOString().slice(0, 10), name: 'Good Friday', shortName: 'Good Friday', isLongWeekend: true });
    holidays.push({ date: esat.toISOString().slice(0, 10), name: 'Easter Saturday', shortName: 'Easter Sat', isLongWeekend: true });
    holidays.push({ date: easterSun.toISOString().slice(0, 10), name: 'Easter Sunday', shortName: 'Easter Sun', isLongWeekend: true });
    holidays.push({ date: emon.toISOString().slice(0, 10), name: 'Easter Monday', shortName: 'Easter Mon', isLongWeekend: true });

    // 8. ANZAC Day (Strictly 25 April - NO weekend substitution under SafeWork SA rules)
    var anzac = new Date(Date.UTC(year, 3, 25));
    holidays.push({
      date: formatIso(year, 4, 25),
      name: 'ANZAC Day',
      shortName: 'ANZAC Day',
      isLongWeekend: anzac.getUTCDay() === 1 || anzac.getUTCDay() === 5
    });

    // 9. King's Birthday (2nd Monday in June)
    var kbDate = getNthWeekdayOfMonth(year, 6, 1, 2);
    if (kbDate) {
      holidays.push({ date: kbDate, name: "King's Birthday", shortName: "King's B'day", isLongWeekend: true });
    }

    // 10. Labour Day (1st Monday in October)
    var ldDate = getNthWeekdayOfMonth(year, 10, 1, 1);
    if (ldDate) {
      holidays.push({ date: ldDate, name: 'Labour Day', shortName: 'Labour Day', isLongWeekend: true });
    }

    // 11. Christmas Day & Proclamation Day (SafeWork SA rules)
    var xmas = new Date(Date.UTC(year, 11, 25));
    if (xmas.getUTCDay() === 5) {
      // Friday: Fri 25 Dec (Christmas), Sat 26 Dec (Proclamation), Mon 28 Dec (Proclamation substitute)
      holidays.push({ date: formatIso(year, 12, 25), name: 'Christmas Day', shortName: 'Christmas', isLongWeekend: true });
      holidays.push({ date: formatIso(year, 12, 26), name: 'Proclamation Day', shortName: 'Proclamation', isLongWeekend: true });
      holidays.push({ date: formatIso(year, 12, 28), name: 'Proclamation Day (Observed)', shortName: 'Proclamation', isLongWeekend: true });
    } else if (xmas.getUTCDay() === 6) {
      // Saturday: Sat 25 Dec (Christmas), Sun 26 Dec (Proclamation), Mon 27 Dec (Christmas Obs), Tue 28 Dec (Proclamation Obs)
      holidays.push({ date: formatIso(year, 12, 25), name: 'Christmas Day', shortName: 'Christmas', isLongWeekend: false });
      holidays.push({ date: formatIso(year, 12, 26), name: 'Proclamation Day', shortName: 'Proclamation', isLongWeekend: false });
      holidays.push({ date: formatIso(year, 12, 27), name: 'Christmas Day (Observed)', shortName: 'Christmas (Obs)', isLongWeekend: true });
      holidays.push({ date: formatIso(year, 12, 28), name: 'Proclamation Day (Observed)', shortName: 'Proclamation', isLongWeekend: true });
    } else if (xmas.getUTCDay() === 0) {
      // Sunday: Sun 25 Dec (Christmas), Mon 26 Dec (Proclamation), Tue 27 Dec (Christmas Obs)
      holidays.push({ date: formatIso(year, 12, 25), name: 'Christmas Day', shortName: 'Christmas', isLongWeekend: false });
      holidays.push({ date: formatIso(year, 12, 26), name: 'Proclamation Day', shortName: 'Proclamation', isLongWeekend: true });
      holidays.push({ date: formatIso(year, 12, 27), name: 'Christmas Day (Observed)', shortName: 'Christmas (Obs)', isLongWeekend: true });
    } else {
      // Monday - Thursday
      holidays.push({
        date: formatIso(year, 12, 25),
        name: 'Christmas Day',
        shortName: 'Christmas',
        isLongWeekend: xmas.getUTCDay() === 1 || xmas.getUTCDay() === 4
      });
      holidays.push({
        date: formatIso(year, 12, 26),
        name: 'Proclamation Day',
        shortName: 'Proclamation',
        isLongWeekend: xmas.getUTCDay() === 4 || xmas.getUTCDay() === 5
      });
    }

    holidays.sort(function(a, b) { return a.date.localeCompare(b.date); });
    return holidays;
  }

  function getPublicHolidaysForYear(year) {
    return computeSAPublicHolidays(year);
  }

  function isSouthAustralianPublicHoliday(dateStr) {
    var year = parseInt(dateStr.slice(0, 4), 10);
    var holidays = getPublicHolidaysForYear(year);
    return holidays.find(function(h) { return h.date === dateStr; });
  }

  function getHolidayAdjacency(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    var day = d.getDay(); // 5 = Friday, 1 = Monday
    var year = d.getFullYear();
    var holidays = getPublicHolidaysForYear(year);

    var directHoliday = holidays.find(function(h) { return h.date === dateStr; });
    if (directHoliday) {
      return { isAdjacent: true, linkedHoliday: directHoliday, reason: directHoliday.name };
    }

    if (day === 5) {
      var nextMon = new Date(d);
      nextMon.setDate(d.getDate() + 3);
      var monStr = nextMon.toISOString().slice(0, 10);
      var monHoliday = holidays.find(function(h) { return h.date === monStr; });
      if (monHoliday) {
        return { isAdjacent: true, linkedHoliday: monHoliday, reason: 'Friday Pre-Holiday (' + monHoliday.name + ')' };
      }
    }

    if (day === 1) {
      var prevFri = new Date(d);
      prevFri.setDate(d.getDate() - 3);
      var friStr = prevFri.toISOString().slice(0, 10);
      var friHoliday = holidays.find(function(h) { return h.date === friStr; });
      if (friHoliday) {
        return { isAdjacent: true, linkedHoliday: friHoliday, reason: 'Monday Post-Holiday (' + friHoliday.name + ')' };
      }
    }

    return { isAdjacent: false };
  }

  // Bind to global namespace
  window.HortOpsData.computeSAPublicHolidays = computeSAPublicHolidays;
  window.HortOpsData.getPublicHolidaysForYear = getPublicHolidaysForYear;
  window.HortOpsData.isSouthAustralianPublicHoliday = isSouthAustralianPublicHoliday;
  window.HortOpsData.getHolidayAdjacency = getHolidayAdjacency;

  window.HortOpsData.SA_PUBLIC_HOLIDAYS_2025 = computeSAPublicHolidays(2025);
  window.HortOpsData.SA_PUBLIC_HOLIDAYS_2026 = computeSAPublicHolidays(2026);
  window.HortOpsData.SA_PUBLIC_HOLIDAYS_2027 = computeSAPublicHolidays(2027);
  window.HortOpsData.SA_PUBLIC_HOLIDAYS_2028 = computeSAPublicHolidays(2028);
})();
