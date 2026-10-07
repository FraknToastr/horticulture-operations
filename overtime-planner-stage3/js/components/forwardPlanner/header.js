// Forward Planner 2-Tier Header Sub-module
// Renders the 2-tier sticky matrix header (Tier 1: Super-weeks, Tier 2: Weekend days & holidays).
window.HortOpsForwardPlannerHeader = {
  renderThead: function(ctx) {
    var visibleSlots = ctx.visibleSlots;
    var slotDayMap = ctx.slotDayMap;
    var filteredStaff = ctx.filteredStaff || [];
    var icons = ctx.icons || window.HortOpsIcons;
    var esc = ctx.esc;
    var escAttr = ctx.escAttr;

    // 8. Build 2-Tier Table Header:
    // Tier 1: Weeks Super Header (Week 1, Week 2, etc.)
    var thWeekCols = [];
    visibleSlots.forEach(function(slot) {
      var days = slotDayMap[slot.weekNumber] || [];
      var isClash = slot.isOverloaded || slot.hasArterialConflict;
      var bgStyle = isClash ? 'background-color: #fef3c7;' : 'background-color: #f1f5f9;';

      thWeekCols.push(
        '<th colspan="' + days.length + '" style="text-align: center; padding: 0.4rem 0.5rem; border-right: 2px solid var(--slate-300); border-bottom: 1px solid var(--slate-200); ' + bgStyle + '">' +
          '<div style="display: flex; align-items: center; justify-content: center; gap: 0.35rem;">' +
            '<span style="font-weight: 800; font-size: 12px; color: var(--slate-800); text-transform: uppercase; letter-spacing: 0.03em;">Week ' + slot.weekNumber + '</span>' +
            (isClash ? '<span class="badge badge-amber" style="font-size: 9px; padding: 0.05rem 0.3rem;">Clash</span>' : '') +
          '</div>' +
        '</th>'
      );
    });

    // Tier 2: Day Header (Announcing the Day)
    var thDayNameCols = [];
    visibleSlots.forEach(function(slot) {
      var days = slotDayMap[slot.weekNumber] || [];
      var isClash = slot.isOverloaded || slot.hasArterialConflict;

      days.forEach(function(dayCol, dayIdx) {
        var isLastDayInWeek = dayIdx === days.length - 1;
        var hasHoliday = !!dayCol.holiday;

        var borderStyle = isLastDayInWeek ? 'border-right: 2px solid var(--slate-300);' : 'border-right: 1px solid var(--slate-200);';
        var bgStyle = hasHoliday ? 'background-color: #fef08a; color: var(--amber-950);' :
          isClash ? 'background-color: #fef3c7; color: var(--slate-900);' : 'background-color: #f8fafc; color: var(--slate-800);';

        thDayNameCols.push(
          '<th style="padding: 0.35rem 0.5rem; min-width: 120px; text-align: center; border-bottom: 1px solid var(--slate-200); ' + borderStyle + bgStyle + '">' +
            '<div style="display: flex; align-items: center; justify-content: center;">' +
              '<span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">' + dayCol.day + '</span>' +
            '</div>' +
          '</th>'
        );
      });
    });

    // Tier 3: Date Sub-Header (Day removed, Date only + PH badge)
    var thDateCols = [];
    visibleSlots.forEach(function(slot) {
      var days = slotDayMap[slot.weekNumber] || [];
      var isClash = slot.isOverloaded || slot.hasArterialConflict;

      days.forEach(function(dayCol, dayIdx) {
        var isLastDayInWeek = dayIdx === days.length - 1;
        var hasHoliday = !!dayCol.holiday;

        var borderStyle = isLastDayInWeek ? 'border-right: 2px solid var(--slate-300);' : 'border-right: 1px solid var(--slate-200);';
        var bgStyle = hasHoliday ? 'background-color: #fef9c3; color: var(--amber-900);' :
          isClash ? 'background-color: #fffbeb;' : 'background-color: #ffffff;';

        var holidayTag = hasHoliday ?
          '<span class="badge badge-amber" style="font-size: 10px; font-weight: 800; padding: 0.1rem 0.35rem; shrink: 0;" title="' + dayCol.holiday.name + '">PH</span>' : '';

        thDateCols.push(
          '<th style="padding: 0.35rem 0.5rem; min-width: 120px; text-align: center; border-bottom: 1px solid var(--slate-200); ' + borderStyle + bgStyle + '">' +
            '<div style="display: flex; align-items: center; justify-content: center; gap: 0.35rem; width: 100%; text-align: center;">' +
              '<span style="font-size: 11px; font-weight: 600; font-family: ui-monospace, monospace; color: var(--slate-600); white-space: nowrap;">' + dayCol.label + '</span>' +
              holidayTag +
            '</div>' +
          '</th>'
        );
      });
    });

    var theadHtml = '<thead>' +
      '<tr style="background: #f1f5f9;">' +
        '<th rowspan="3" class="sticky-hierarchy-col" style="padding: 0.6rem 0.8rem; background: var(--slate-50); vertical-align: middle; border-bottom: 1px solid var(--slate-200); border-right: 1px solid var(--slate-200);">' +
          '<div style="display: flex; align-items: center; justify-content: space-between;">' +
            '<span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--slate-500); letter-spacing: 0.05em;">Staff Hierarchy (' + filteredStaff.length + ')</span>' +
          '</div>' +
        '</th>' +
        thWeekCols.join('') +
      '</tr>' +
      '<tr style="background: #f8fafc;">' +
        thDayNameCols.join('') +
      '</tr>' +
      '<tr style="background: #ffffff;">' +
        thDateCols.join('') +
      '</tr>' +
    '</thead>';


    return theadHtml;
  }
};
