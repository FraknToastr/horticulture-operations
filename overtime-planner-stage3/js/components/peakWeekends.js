(function() {
// Imported colours never enter CSS/HTML without token validation.
var safeColor = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.safeColor) || function() { return '#10b981'; };
// Peak Weekends & Clashes Component
window.HortOpsPeakWeekends = {
  render: function(state) {
    var icons = window.HortOpsIcons;
    var dateUtils = window.HortOpsDateUtils;
    var slots = state.slots;

    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) ? window.HortOpsSecurityUtils.escapeHtml : function(s) { return String(s || ''); };
    var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) ? window.HortOpsSecurityUtils.escapeHtmlAttr : function(s) { return String(s || ''); };

    var overloadedSlots = slots.filter(function(s) {
      return s.isOverloaded || s.hasArterialConflict || s.publicHolidays.some(function(h) { return s.shifts.some(function(sh) { return sh.date === h.date; }); });
    });

    var cardsHtml = overloadedSlots.length === 0 ?
      '<div style="text-align: center; padding: 3rem; color: var(--emerald-700); font-weight: 700;">' +
        icons.render('checkCircle', 'w-8 h-8 text-emerald-600', 'style="margin: 0 auto 0.5rem auto;"') +
        '<div>All 52 weekends within safe operational capacity limits. No scheduling clashes detected.</div>' +
      '</div>' :
      overloadedSlots.map(function(slot) {
        var badges = [];
        if (slot.isOverloaded) badges.push('<span class="badge badge-amber">' + icons.render('alertTriangle', 'w-3 h-3') + 'Shift Load (' + slot.shifts.length + ' Ops)</span>');
        if (slot.hasArterialConflict) badges.push('<span class="badge badge-amber">' + icons.render('alertTriangle', 'w-3 h-3') + 'Arterial Road Conflict</span>');
        var activeHolidays = slot.publicHolidays.filter(function(h) {
          return slot.shifts.some(function(sh) { return sh.date === h.date; });
        });
        if (activeHolidays.length > 0) badges.push('<span class="badge badge-slate">' + icons.render('flag', 'w-3 h-3') + esc(activeHolidays[0].name) + '</span>');

        // Subdivide overloaded week into day columns (Offline15.2 Day-Column Layout)
        var dayCols = [];
        var satDate = slot.saturdayDate;
        var sunDate = slot.sundayDate;

        // Check Friday
        var friDate = (dateUtils && typeof dateUtils.addDays === 'function') ? dateUtils.addDays(satDate, -1) : null;
        var hasFriShifts = friDate && slot.shifts.some(function(sh) { return sh.date === friDate; });
        var hasFriHoliday = friDate && (slot.publicHolidays || []).some(function(h) { return h.date === friDate; });
        if (hasFriShifts || hasFriHoliday) {
          dayCols.push({ date: friDate, dayName: 'Friday' });
        }

        // Saturday & Sunday
        dayCols.push({ date: satDate, dayName: 'Saturday' });
        dayCols.push({ date: sunDate, dayName: 'Sunday' });

        // Check Monday
        var monDate = (dateUtils && typeof dateUtils.addDays === 'function') ? dateUtils.addDays(sunDate, 1) : null;
        var hasMonShifts = monDate && slot.shifts.some(function(sh) { return sh.date === monDate; });
        var hasMonHoliday = monDate && (slot.publicHolidays || []).some(function(h) { return h.date === monDate; });
        if (hasMonShifts || hasMonHoliday) {
          dayCols.push({ date: monDate, dayName: 'Monday' });
        }

        slot.shifts.forEach(function(sh) {
          if (!dayCols.some(function(d) { return d.date === sh.date; })) {
            dayCols.push({ date: sh.date, dayName: sh.dayOfWeek || 'Overtime Day' });
          }
        });
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
            '<div class="day-column-empty">— No shifts —</div>' :
            dayShifts.map(function(sh) {
              var crewConflictBadge = (sh.hasCrewConflict || (sh.crewIntegrityIssues && sh.crewIntegrityIssues.length > 0)) ?
                ('<span class="badge" style="font-size: 10px; margin-left: 4px; background: #fef2f2; color: #b91c1c; border: 1px solid #f87171;" title="' + escAttr((sh.crewIntegrityIssues && sh.crewIntegrityIssues[0]) ? sh.crewIntegrityIssues[0].message : 'Plant Operator Required') + '">⚠ Plant Op</span>') : '';

              return '<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.45rem 0.65rem; border-left: 3px solid ' + escAttr(safeColor(sh.color, '#10b981')) + '; background: #ffffff; border: 1px solid var(--slate-200); border-left-width: 3px; border-radius: 6px; gap: 0.5rem;">' +
                '<div style="overflow: hidden; flex: 1;">' +
                  '<div style="font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 3px;">' + esc(sh.jobName) + crewConflictBadge + '</div>' +
                  '<div style="font-size: 11px; color: var(--slate-500); margin-top: 0.15rem;">' + esc(sh.startTime) + ' (' + esc(sh.durationHours) + 'h) • ' + esc(sh.category) + '</div>' +
                '</div>' +
                '<button class="btn btn-secondary" style="padding: 0.2rem 0.45rem; font-size: 11px; font-weight: 600; flex-shrink: 0;" onclick="window.HortOpsApp.openStaffAssignModal(\'" + escAttr(sh.shiftId) + "\')">' +
                  'Assign (' + (sh.assignedStaffIds || []).length + '/' + sh.crewSize + ')' +
                '</button>' +
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

        var shiftsList = '<div class="calendar-day-columns">' + dayColsHtml + '</div>';

        return '<div class="panel-card" style="margin-bottom: 0.75rem;">' +
          '<div class="panel-header" style="background: var(--slate-50);">' +
            '<div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">' +
              '<span style="font-weight: 800; color: var(--emerald-800);">Week ' + slot.weekNumber + '</span>' +
              '<span style="font-family: var(--font-mono); color: var(--slate-600);">' + displayRange + '</span>' +
              badges.join(' ') +
            '</div>' +
            '<span style="font-size: 13px; font-weight: 700; color: var(--slate-600);">' + slot.totalCrewHours + ' Crew Hours</span>' +
          '</div>' +
          '<div class="panel-body" style="padding: 0.75rem;">' + shiftsList + '</div>' +
        '</div>';
      }).join('');

    return '<div class="panel-card">' +
      '<div class="panel-header">' +
        '<span class="panel-title">' + icons.render('alertTriangle', 'w-4 h-4 text-amber-600') + 'Peak Weekends & Overtime Capacity Conflicts</span>' +
        '<button class="btn btn-primary" onclick="window.HortOpsPeakWeekends.autoStagger()">' +
          icons.render('sparkles', 'w-3.5 h-3.5 text-amber-300') + 'Auto-Stagger Clashes' +
        '</button>' +
      '</div>' +
      '<div class="panel-body">' + cardsHtml + '</div>' +
    '</div>';
  },

  autoStagger: function() {
    window.HortOpsApp.handleAutoStagger();
  }
};

})();
