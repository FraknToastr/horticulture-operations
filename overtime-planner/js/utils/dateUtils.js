// Canonical Australian Date Formatting Utilities
window.HortOpsDateUtils = {
  isRealYmd: function(text) {
    if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
    var y = parseInt(text.slice(0, 4), 10);
    var m = parseInt(text.slice(5, 7), 10);
    var d = parseInt(text.slice(8, 10), 10);
    if (m < 1 || m > 12) return false;
    var test = new Date(Date.UTC(y, m - 1, d));
    return test.getUTCFullYear() === y &&
           test.getUTCMonth() + 1 === m &&
           test.getUTCDate() === d;
  },

  isValidGregorianDate: function(text) {
    return this.isRealYmd(text);
  },
  getLocalDateKey: function(d) {
    d = d || new Date();
    if (typeof d === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      d = new Date(d);
    }
    try {
      var formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Australia/Adelaide',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(d);
    } catch (e) {
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + day;
    }
  },

  formatDisplayDate: function(dateStr) {
    if (!dateStr) return '';
    var clean = ('' + dateStr).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
    var match = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return match[3] + '/' + match[2] + '/' + match[1];
    }
    var parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      var d = String(parsed.getDate()).padStart(2, '0');
      var m = String(parsed.getMonth() + 1).padStart(2, '0');
      var y = parsed.getFullYear();
      return d + '/' + m + '/' + y;
    }
    return clean;
  },

  formatDayWithDate: function(dateStr, dayPrefix) {
    if (!dateStr) return '';
    var formatted = this.formatDisplayDate(dateStr);
    return dayPrefix ? (dayPrefix + ' ' + formatted) : formatted;
  },

  formatDisplayWeekendRange: function(satDate, sunDate) {
    return this.formatDisplayDate(satDate) + ' & ' + this.formatDisplayDate(sunDate);
  }
,


  calculateWeekFromDate: function(dateStr) {
    if (!dateStr) return 1;
    var match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return 1;
    var year = parseInt(match[1], 10);
    var month = parseInt(match[2], 10) - 1;
    var day = parseInt(match[3], 10);

    var dt = new Date(year, month, day);
    var jan1 = new Date(year, 0, 1);
    var dayOfWeek = jan1.getDay(); // 0 Sun, 6 Sat
    var daysUntilFirstSat = (6 - dayOfWeek + 7) % 7;
    var firstSat = new Date(year, 0, 1 + daysUntilFirstSat);
    var firstFri = new Date(firstSat);
    firstFri.setDate(firstFri.getDate() - 1);

    var diffMs = dt.getTime() - firstFri.getTime();
    var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 1;
    var weekNum = Math.floor(diffDays / 7) + 1;
    return Math.max(1, weekNum);
  },

  getCurrentWeekNumber: function(slots, targetDate) {
    if (!slots || slots.length === 0) return 1;
    targetDate = targetDate || new Date();

    var targetYear = targetDate.getFullYear();
    var targetMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
    var targetDay = String(targetDate.getDate()).padStart(2, '0');
    var targetISO = targetYear + '-' + targetMonth + '-' + targetDay;

    // 1. Check if targetDate falls within a slot's weekend/adjoining window
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      var fri = s.fridayDate || s.saturdayDate;
      var mon = s.mondayDate || s.sundayDate;
      if (targetISO >= fri && targetISO <= mon) {
        return s.weekNumber;
      }
    }

    // 2. Check Tuesday-to-Monday 7-day window surrounding Saturday
    for (var j = 0; j < slots.length; j++) {
      var slot = slots[j];
      var sat = new Date(slot.saturdayDate);
      var startOfWeek = new Date(sat);
      startOfWeek.setDate(sat.getDate() - 4); // Tuesday
      var endOfWeek = new Date(sat);
      endOfWeek.setDate(sat.getDate() + 2); // Monday

      var startY = startOfWeek.getFullYear();
      var startM = String(startOfWeek.getMonth() + 1).padStart(2, '0');
      var startD = String(startOfWeek.getDate()).padStart(2, '0');
      var startISO = startY + '-' + startM + '-' + startD;

      var endY = endOfWeek.getFullYear();
      var endM = String(endOfWeek.getMonth() + 1).padStart(2, '0');
      var endD = String(endOfWeek.getDate()).padStart(2, '0');
      var endISO = endY + '-' + endM + '-' + endD;

      if (targetISO >= startISO && targetISO <= endISO) {
        return slot.weekNumber;
      }
    }

    // 3. Fallback: closest slot in time
    var closestWeek = 1;
    var minDiff = Infinity;
    var targetTime = targetDate.getTime();
    for (var k = 0; k < slots.length; k++) {
      var st = slots[k];
      var satTime = new Date(st.saturdayDate).getTime();
      var diff = Math.abs(satTime - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestWeek = st.weekNumber;
      }
    }

    return closestWeek;
  }
};