(function() {
// Imported colours never enter CSS/HTML without token validation.
var safeColor = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.safeColor) || function() { return '#10b981'; };
// Monthly Operational Calendar View Component
window.HortOpsCalendarView = {
  selectedMonth: (new Date().getMonth() + 1),

  render: function(state) {
    var icons = window.HortOpsIcons;
    var dateUtils = window.HortOpsDateUtils;
    var slots = state.slots;
    var self = this;
    var programme = state.uiState && state.uiState.planningRange;

    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) ? window.HortOpsSecurityUtils.escapeHtml : function(s) { return String(s || ''); };
    var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) ? window.HortOpsSecurityUtils.escapeHtmlAttr : function(s) { return String(s || ''); };

    var currentMonthNum = new Date().getMonth() + 1;
    var currentWeekNum = (dateUtils && dateUtils.getCurrentWeekNumber) ? dateUtils.getCurrentWeekNumber(slots) : 36;

    var monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // A weekday pattern occurrence can belong to a different month than its Saturday bucket.
    var monthSlots = slots.filter(function(s) {
      return !!programme || s.month === self.selectedMonth || s.shifts.some(function(sh) {
        return sh.frequencyType === 'work_pattern' &&
          Number(String(sh.date).slice(5, 7)) === self.selectedMonth &&
          Number(String(sh.date).slice(0, 4)) === Number(state.currentYear);
      });
    });

    var monthNav = '<div style="display: flex; gap: 0.25rem; flex-wrap: wrap; align-items: center;">' +
      '<button class="btn btn-secondary" style="padding: 0.35rem 0.65rem; font-size: 12px; font-weight: 700; color: var(--emerald-700); margin-right: 0.25rem;" onclick="window.HortOpsCalendarView.setMonth(' + currentMonthNum + ')">Current Month</button>' +
      monthNames.map(function(name, idx) {
        var m = idx + 1;
        var isActive = self.selectedMonth === m;
        return '<button class="btn ' + (isActive ? 'btn-primary' : 'btn-secondary') + '" style="padding: 0.35rem 0.65rem; font-size: 13px;" onclick="window.HortOpsCalendarView.setMonth(' + m + ')">' +
          esc(name) +
        '</button>';
      }).join('') +
    '</div>';
    if (programme) monthNav = '<span class="badge badge-emerald">' + esc(programme.start) + ' – ' + esc(programme.end) + '</span>';

    var weekendCardsHtml = monthSlots.map(function(slot) {
      var isCurrentWeek = slot.weekNumber === currentWeekNum;
      var currentWeekBadge = isCurrentWeek ? 
        '<span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #6ee7b7; font-size: 10px; font-weight: 800; padding: 0.15rem 0.45rem; margin-left: 0.5rem; letter-spacing: 0.05em;">CURRENT WEEK</span>' : '';

      // Only display public holidays that have scheduled operations
      var activeHolidays = slot.publicHolidays.filter(function(h) {
        return slot.shifts.some(function(sh) {
          return sh.date === h.date || (sh.isPublicHoliday && sh.holidayName === h.name);
        });
      });

      var holidaysHtml = activeHolidays.map(function(h) {
        return '<span class="badge badge-amber" style="margin-left: 0.5rem;">' + icons.render('flag', 'w-3 h-3') + esc(h.name) + '</span>';
      }).join('');

      // Subdivide week row into individual day columns (Offline15.2 Day-Column Layout)
      var dayCols = [];
      var satDate = slot.saturdayDate;
      var sunDate = slot.sundayDate;

      // Check Friday (pre-holiday)
      var friDate = (dateUtils && typeof dateUtils.addDays === 'function') ? dateUtils.addDays(satDate, -1) : null;
      var hasFriShifts = friDate && slot.shifts.some(function(sh) { return sh.date === friDate; });
      var hasFriHoliday = friDate && (slot.publicHolidays || []).some(function(h) { return h.date === friDate; });
      if (hasFriShifts || hasFriHoliday) {
        dayCols.push({ date: friDate, dayName: 'Friday' });
      }

      // Saturday & Sunday
      dayCols.push({ date: satDate, dayName: 'Saturday' });
      dayCols.push({ date: sunDate, dayName: 'Sunday' });

      // Check Monday (post-holiday)
      var monDate = (dateUtils && typeof dateUtils.addDays === 'function') ? dateUtils.addDays(sunDate, 1) : null;
      var hasMonShifts = monDate && slot.shifts.some(function(sh) { return sh.date === monDate; });
      var hasMonHoliday = monDate && (slot.publicHolidays || []).some(function(h) { return h.date === monDate; });
      if (hasMonShifts || hasMonHoliday) {
        dayCols.push({ date: monDate, dayName: 'Monday' });
      }

      // Include any other non-standard shift dates
      slot.shifts.forEach(function(sh) {
        if (!dayCols.some(function(d) { return d.date === sh.date; })) {
          dayCols.push({ date: sh.date, dayName: sh.dayOfWeek || 'Overtime Day' });
        }
      });
            if (programme) dayCols = dayCols.filter(function(d) { return d.date >= programme.start && d.date <= programme.end; });
            dayCols.sort(function(a, b) { return a.date.localeCompare(b.date); });
      var patternRange = slot.shifts.some(function(sh) { return sh.frequencyType === 'work_pattern'; });
      var displayRange = patternRange ?
        dateUtils.formatDisplayDate(dayCols[0].date) + ' – ' + dateUtils.formatDisplayDate(dayCols[dayCols.length - 1].date) :
        dateUtils.formatDisplayWeekendRange(slot.saturdayDate, slot.sundayDate);

      var dayColsHtml = dayCols.map(function(dCol) {
        var dayShifts = slot.shifts.filter(function(sh) { return sh.date === dCol.date; });
        var dayHoliday = (slot.publicHolidays || []).find(function(h) { return h.date === dCol.date; });
        var holidayPill = dayHoliday ?
          '<span class="badge badge-slate" style="font-size: 10px; margin-left: 4px;">' + icons.render('flag', 'w-2.5 h-2.5') + esc(dayHoliday.name) + '</span>' : '';

        var dayCardsHtml = dayShifts.length === 0 ?
          '<div class="day-column-empty">— No shifts scheduled —</div>' :
          dayShifts.map(function(sh) {
            var assignedCount = (sh.assignedStaffIds || []).length;
            var isFull = assignedCount >= sh.crewSize;
            var crewConflictBadge = (sh.hasCrewConflict || (sh.crewIntegrityIssues && sh.crewIntegrityIssues.length > 0)) ?
              ('<span class="badge" style="font-size: 10px; margin-left: 4px; background: #fef2f2; color: #b91c1c; border: 1px solid #f87171;" title="' + escAttr((sh.crewIntegrityIssues && sh.crewIntegrityIssues[0]) ? sh.crewIntegrityIssues[0].message : 'Plant Operator Required') + '">⚠ Plant Op</span>') : '';

            var startStr = sh.startTime ? sh.startTime.split(' ')[0] : '';
            var durStr = (sh.durationHours !== undefined) ? (sh.durationHours + 'h') : '';
            var timeMeta = startStr && durStr ? (startStr + ' (' + durStr + ')') : (startStr || durStr);

            return '<div style="border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.65rem 0.75rem; background: #ffffff; border-left: 4px solid ' + escAttr(safeColor(sh.color, '#10b981')) + '; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.03);" onclick="window.HortOpsApp.openStaffAssignModal(\'" + escAttr(sh.shiftId) + "\')">' +
              '<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">' +
                '<span style="font-weight: 700; font-size: 12px; color: var(--slate-900); display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">' + esc(sh.jobName) + crewConflictBadge + '</span>' +
                '<span class="badge ' + (isFull ? 'badge-emerald' : 'badge-amber') + '" style="font-size: 10px; flex-shrink: 0;">' + assignedCount + '/' + sh.crewSize + ' Crew</span>' +
              '</div>' +
              '<div style="font-size: 11px; color: var(--slate-500); margin-top: 0.25rem;">' +
                esc(timeMeta) +
              '</div>' +
              (sh.locationDetails ? ('<div style="font-size: 11px; color: var(--slate-400); margin-top: 0.2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">' + esc(sh.locationDetails) + '</div>') : '') +
              '<button type="button" class="btn btn-secondary candidate-preview-entry" data-candidate-preview="' + escAttr(sh.shiftId) + '">Preview candidates</button>' +
            '</div>';
          }).join('');

        return '<div class="day-column">' +
          '<div class="day-column-header">' +
            '<div class="day-column-title">' +
              '<span class="day-column-name">' + esc(dCol.dayName) + '</span>' +
              '<span class="day-column-date">' + esc(dateUtils.formatDisplayDate(dCol.date)) + '</span>' +
              holidayPill +
            '</div>' +
            '<span class="badge badge-slate" style="font-size: 10px;">' + dayShifts.length + ' Ops</span>' +
          '</div>' +
          '<div class="day-column-body">' + dayCardsHtml + '</div>' +
        '</div>';
      }).join('');

      var shiftsHtml = '<div class="calendar-day-columns">' + dayColsHtml + '</div>';

      var cardBorder = isCurrentWeek ? 
        'margin-bottom: 1rem; border: 2px solid #059669; box-shadow: 0 4px 6px -1px rgba(5, 150, 105, 0.15);' : 
        'margin-bottom: 1rem;';

      return '<div class="panel-card" style="' + cardBorder + '">' +
        '<div class="panel-header" style="background: ' + (isCurrentWeek ? '#f0fdf4' : 'var(--slate-100)') + ';">' +
          '<div style="display: flex; align-items: center; flex-wrap: wrap;">' +
            '<span style="font-weight: 800; color: var(--emerald-800); margin-right: 0.5rem;">Week ' + slot.weekNumber + '</span>' +
            '<span style="font-family: var(--font-mono); color: var(--slate-600);">' + displayRange + '</span>' +
            currentWeekBadge +
            holidaysHtml +
          '</div>' +
          '<div style="display: flex; gap: 0.5rem; align-items: center;">' +
            (slot.isOverloaded ? '<span class="badge badge-amber">' + icons.render('alertTriangle', 'w-3 h-3') + 'High Capacity Load</span>' : '') +
            '<span style="font-size: 13px; font-weight: 700; color: var(--slate-600);">' + slot.shifts.length + ' Operations • ' + slot.totalCrewHours + ' Crew Hours</span>' +
          '</div>' +
        '</div>' +
        '<div class="panel-body">' + shiftsHtml + '</div>' +
      '</div>';
    }).join('');

    return '<div class="panel-card">' +
      '<div class="panel-header">' +
        '<span class="panel-title">' + icons.render('calendar', 'w-4 h-4') + (programme ? 'Programme Operational Roster' : esc(monthNames[self.selectedMonth - 1]) + ' ' + state.currentYear + ' Operational Roster') + '</span>' +
        monthNav +
      '</div>' +
      '<div class="panel-body">' + weekendCardsHtml + '</div>' +
    '</div>';
  },

  setMonth: function(m) {
    this.selectedMonth = m;
    window.HortOpsApp.renderCurrentView();
  }
};

})();
