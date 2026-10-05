(function() {
// Imported colours never enter CSS/HTML without token validation.
var safeColor = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.safeColor) || function() { return '#10b981'; };
var colorWithAlpha = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.colorWithAlpha) || function() { return '#10b98155'; };
// Forward Planner Matrix Renderer Sub-module
// Renders the horizontal matrix body rows: grouped vacancies, department/team staff rows, and shift cards.
// Offline17.1: Realigned vacancy denominator to totalShiftVacancies, removed staff-level Plant pill.
window.HortOpsForwardPlannerMatrix = {
  renderTbody: function(ctx) {
    ctx = ctx || {};
    var tableRows = ctx.tableRows || [];
    var visibleSlots = ctx.visibleSlots || [];
    var slotDayMap = ctx.slotDayMap || {};
    var staffScheduleMap = ctx.staffScheduleMap || {};
    var self = ctx.self || {};
    var icons = ctx.icons || window.HortOpsIcons;
    var esc = ctx.esc || (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s || ''; };
    var escAttr = ctx.escAttr || (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) || function(s) { return s || ''; };

    var staffMap = {};
    (ctx.staffList || []).forEach(function(s) {
      staffMap[s.id] = s;
    });

    // Build Table Body Rows (Vacancies + Staff)
    var tbodyRowsHtml = tableRows.map(function(rowItem) {
      // A. VACANCY ROW
      if (rowItem.type === 'vacancy') {
        var vacancy = rowItem.vacancy || rowItem;
        var shift = vacancy.shift;
        var jobColor = safeColor(shift.color, '#047857');
        var isSelected = self.selectedStaffId === vacancy.id;
        var tickHtml = isSelected ? '<span style="color: var(--emerald-600); font-weight: 800; margin-right: 4px;">✓</span>' : '';
        var locationStr = shift.locationDetails ? shift.locationDetails.split('/')[0].trim() : 'Adelaide';

        var isVacPlantOp = Boolean(shift.plantOperatorRequired || (shift.job && shift.job.plantOperatorRequired));
        var hasPlantOpOnVacShift = false;
        if (isVacPlantOp && shift.assignedStaffIds && shift.assignedStaffIds.length > 0) {
          hasPlantOpOnVacShift = shift.assignedStaffIds.some(function(id) {
            var s = staffMap[id];
            return s && s.isPlantOperator;
          });
        }
        var showVacPlantOpBadge = isVacPlantOp && !hasPlantOpOnVacShift;
        var vacPlantOpBadge = showVacPlantOpBadge ?
          ('<div class="plant-op-warning-badge" style="width: 26px; height: 26px; min-width: 26px; border-radius: 50%; border: 1.5px solid #f59e0b; background: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #d97706;" title="Plant Operator Required — Not yet assigned">' +
            icons.render('alertTriangle', 'w-3.5 h-3.5') +
          '</div>') : '';

        var vacConflictBadge = (shift.hasCrewConflict || (shift.invalidAssignees && shift.invalidAssignees.length > 0)) ?
          '<span class="badge" style="font-size: 9px; padding: 1px 3px; background: #ffe4e6; color: #9f1239; border: 1px solid #fecdd3; display: inline-flex; align-items: center; gap: 2px;" title="Crew conflict on this shift">' +
            icons.render('alertTriangle', 'w-2.5 h-2.5 text-rose-600') + 'Conflict' +
          '</span>' : '';

        var totalVac = vacancy.totalShiftVacancies || Math.max(1, (shift.crewSizeRequired || shift.crewSize || 1) - (shift.assignedStaffIds ? shift.assignedStaffIds.length : 0));

        var vacStickyHtml = '<td class="sticky-hierarchy-col" style="background-color: #ffffff; border-right: 1px solid var(--slate-200); padding: 0.2rem 0.35rem; vertical-align: middle;">' +
                '<div class="unallocated-slot-card animate-subdued-flash" style="background-color: #ffffff; border: 2px dashed ' + escAttr(jobColor) + '; border-radius: 6px; padding: 0.2rem 0.5rem; display: flex; align-items: center; justify-content: space-between; gap: 0.45rem; width: 100%; box-sizing: border-box; height: 54px; min-height: 54px; max-height: 54px; --vacancy-glow: ' + escAttr(colorWithAlpha(jobColor, '55')) + ';" title="Unallocated Slot — ' + escAttr(shift.jobName) + '">' +
            '<div style="display: flex; align-items: center; gap: 0.45rem; overflow: hidden; flex: 1;">' +
              // Left: V1, V2... vacancy badge
              '<div style="width: 24px; height: 24px; min-width: 24px; border-radius: 50%; border: 1.5px solid ' + escAttr(jobColor) + '; background: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: ' + escAttr(jobColor) + '; flex-shrink: 0;">' +
                'V' + vacancy.vacancyNumber +
              '</div>' +
              '<div style="overflow: hidden; flex: 1; line-height: 1.2;">' +
                // Line 1: "Unallocated Slot" pill
                '<div style="display: flex; align-items: center; gap: 0.35rem; margin-bottom: 2px;">' +
                  tickHtml +
                  '<span class="unallocated-pill" style="border: 1.5px solid ' + escAttr(jobColor) + '; color: ' + escAttr(jobColor) + '; background-color: #ffffff; border-radius: 9999px; font-size: 10px; font-weight: 700; padding: 1px 8px; line-height: 1.2;">Unallocated Slot</span>' +
                  vacConflictBadge +
                '</div>' +
                // Line 2: [Job Name]
                '<div style="font-weight: 700; font-size: 12px; color: var(--slate-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">' +
                  esc(shift.jobName) +
                '</div>' +
                // Line 3: Vacancy n of totalVac • Location (Offline17.1: Uses totalShiftVacancies)
                '<div style="font-size: 10px; color: var(--slate-500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">' +
                  'Vacancy ' + vacancy.vacancyNumber + ' of ' + totalVac + ' • ' + esc(locationStr) +
                '</div>' +
              '</div>' +
            '</div>' +
            // Right: Plant Operator warning badge
            vacPlantOpBadge +
          '</div>' +
        '</td>';

        // Vacancy day cells
        var vacCells = [];
        visibleSlots.forEach(function(slot) {
          var days = slotDayMap[slot.weekNumber] || [];
          days.forEach(function(dayCol, dayIdx) {
            var isLastDayInWeek = dayIdx === days.length - 1;
            var borderStyle = isLastDayInWeek ? 'border-right: 2px solid var(--slate-300);' : 'border-right: none;';
            var isVacantShiftDay = (slot.weekNumber === shift.weekNumber) && (dayCol.day === shift.dayOfWeek || dayCol.dateStr === shift.date);

            if (isVacantShiftDay) {
              vacCells.push(
                '<td style="padding: 0.25rem; text-align: center; vertical-align: middle; background-color: rgba(254, 243, 199, 0.25); ' + borderStyle + '">' +
                  '<button class="vacancy-add-btn animate-subdued-flash" style="background-color: #ffffff; border-color: ' + escAttr(jobColor) + '; color: var(--slate-900);" onclick="event.stopPropagation(); window.HortOpsApp.openStaffAssignModal(\'' + escAttr(shift.shiftId) + '\')" title="Allocate staff to vacancy on ' + escAttr(shift.jobName) + '">' +
                    '<div style="display: flex; align-items: center; gap: 0.25rem; color: ' + jobColor + '; font-size: 12px; font-weight: 700;">' +
                      icons.render('plus', 'w-3.5 h-3.5') +
                      '<span>Add Staff</span>' +
                    '</div>' +
                    '<span style="font-size: 12px; font-weight: 600; color: var(--slate-600); font-family: var(--font-mono); margin-top: 1px;">' + shift.startTime + ' (' + shift.durationHours + 'h)</span>' +
                  '</button>' +
                '</td>'
              );
            } else {
              vacCells.push(
                '<td style="padding: 0.25rem; text-align: center; vertical-align: middle; color: var(--slate-300); ' + borderStyle + '">' +
                  '—' +
                '</td>'
              );
            }
          });
        });

        return '<tr class="vacancy-row ' + (isSelected ? 'row-selected' : '') + '" onclick="window.HortOpsForwardPlanner.toggleSelectStaff(\'' + escAttr(vacancy.id) + '\')" style="cursor: pointer;">' + vacStickyHtml + vacCells.join('') + '</tr>';
      }

      // B. STANDARD STAFF ROW
      var staff = rowItem.staff;
      var isSelected = self.selectedStaffId === staff.id;
      var staffWeeks = staffScheduleMap[staff.id] || {};

      var tickHtml = isSelected ? '<span style="color: var(--emerald-600); font-weight: 800; margin-right: 4px;">✓</span>' : '';

      var teamColor = (window.HortOpsData && window.HortOpsData.getTeamColor) ?
        window.HortOpsData.getTeamColor(staff.team) : '#059669';
      var teamDotHtml = (window.HortOpsData && window.HortOpsData.renderTeamDot) ?
        window.HortOpsData.renderTeamDot(staff.team) :
        '<span class="team-dot" style="background-color: ' + teamColor + ';" title="Team: ' + staff.team + '"></span>';

      // Offline17.1: Removed staff-level Plant badge from profile column
      var profileHtml = '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
        teamDotHtml +
        '<div style="overflow: hidden;">' +
          '<div style="font-weight: 600; font-size: 13px; color: var(--slate-900); display: flex; align-items: center; gap: 0.25rem;">' +
            tickHtml +
            '<span class="truncate">' + esc(staff.name) + '</span>' +
          '</div>' +
          '<div style="font-size: 11px; color: var(--slate-500); truncate;">' +
            '<span style="color: ' + escAttr(teamColor) + '; font-weight: 700;">' + esc(staff.team) + '</span> • ' + esc(staff.role) +
          '</div>' +
        '</div>' +
      '</div>';

      var staffDayCells = [];
      visibleSlots.forEach(function(slot) {
        var days = slotDayMap[slot.weekNumber] || [];
        var weekAlloc = staffWeeks[slot.weekNumber];

        days.forEach(function(dayCol, dayIdx) {
          var isLastDayInWeek = dayIdx === days.length - 1;
          var isSat = dayCol.day === 'Saturday';
          var isSun = dayCol.day === 'Sunday';
          var borderStyle = isLastDayInWeek ? 'border-right: 2px solid var(--slate-300);' : 'border-right: none;';

          var assignedShifts = [];
          if (weekAlloc) {
            if (isSat) assignedShifts = weekAlloc.satShifts;
            else if (isSun) assignedShifts = weekAlloc.sunShifts;
            else assignedShifts = weekAlloc.allShifts.filter(function(s) { return s.date === dayCol.dateStr; });
          }

          if (assignedShifts.length > 0 && self.selectedJobId) {
            assignedShifts = assignedShifts.filter(function(sh) { return sh.jobId === self.selectedJobId; });
          }

          if (assignedShifts.length > 0) {
            // Render assigned shift cards (P1-06, P1-10)
            var isOverbooked = assignedShifts.length > 1;
            var overlapBadge = isOverbooked ?
              '<span class="badge badge-amber" style="font-size: 9px; padding: 1px 3px; margin-bottom: 2px; display: inline-flex; align-items: center; gap: 2px;" title="Double-booked on this date: assigned to ' + assignedShifts.length + ' shifts">' +
                icons.render('alertTriangle', 'w-2.5 h-2.5 text-amber-600') + 'Overlap (' + assignedShifts.length + ')' +
              '</span>' : '';

            var shiftCards = assignedShifts.map(function(sh) {
              var conflictBadge = (sh.invalidAssigneeCount > 0) ?
                '<span class="badge" style="font-size: 9px; padding: 1px 3px; margin-bottom: 2px; background: #ffe4e6; color: #9f1239; border: 1px solid #fecdd3; display: inline-flex; align-items: center; gap: 2px;" title="' + sh.invalidAssigneeCount + ' ineligible assignee(s) on this shift">' +
                  icons.render('alertTriangle', 'w-2.5 h-2.5 text-rose-600') + 'Conflict' +
                '</span>' : '';

              var startStr = sh.startTime ? sh.startTime.split(' ')[0] : '';
              var durStr = (sh.durationHours !== undefined) ? (sh.durationHours + 'h') : '';
              var timeMetaStr = startStr && durStr ? (startStr + ' • ' + durStr) : (startStr || durStr);

              var isPlantOpReq = Boolean(sh.plantOperatorRequired || (sh.job && sh.job.plantOperatorRequired));
              var hasPlantOpAssigned = false;
              if (isPlantOpReq && sh.assignedStaffIds && sh.assignedStaffIds.length > 0) {
                hasPlantOpAssigned = sh.assignedStaffIds.some(function(id) {
                  var s = staffMap[id];
                  return s && s.isPlantOperator;
                });
              }
              var showShiftPlantOpBadge = isPlantOpReq && !hasPlantOpAssigned;
              var plantOpRightBadge = showShiftPlantOpBadge ?
                ('<div class="plant-op-warning-badge" style="width: 26px; height: 26px; min-width: 26px; border-radius: 50%; border: 1.5px solid rgba(255,255,255,0.6); background: rgba(0,0,0,0.22); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fef08a; margin-left: 6px;" title="Plant Operator Required — Not yet assigned">' +
                  icons.render('alertTriangle', 'w-3.5 h-3.5') +
                '</div>') : '';

              return '<button class="shift-card-btn" style="background-color: ' + escAttr(safeColor(sh.color, '#10b981')) + '; display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 0.3rem 0.5rem;" onclick="event.stopPropagation(); window.HortOpsApp.openStaffAssignModal(\'' + escAttr(sh.shiftId) + '\')">' +
                '<div style="overflow: hidden; flex: 1; text-align: left;">' +
                  conflictBadge +
                  '<div class="shift-card-title">' + esc(sh.jobName) + '</div>' +
                  '<div class="shift-card-meta">' + esc(timeMetaStr) + '</div>' +
                '</div>' +
                plantOpRightBadge +
              '</button>';
            }).join('');

            staffDayCells.push(
              '<td style="padding: 0.25rem; vertical-align: top; ' + borderStyle + '">' +
                '<div style="display: flex; flex-direction: column; gap: 0.25rem;">' + overlapBadge + shiftCards + '</div>' +
              '</td>'
            );
          } else {
            staffDayCells.push(
              '<td style="padding: 0.25rem; vertical-align: middle; text-align: center; ' + borderStyle + '">' +
                '<div style="height: 38px; display: flex; align-items: center; justify-content: center;">' +
                  '<span style="color: var(--slate-300); font-size: 13px; user-select: none;">—</span>' +
                '</div>' +
              '</td>'
            );
          }
        });
      });

      return '<tr class="' + (isSelected ? 'row-selected' : '') + '" onclick="window.HortOpsForwardPlanner.toggleSelectStaff(\'' + escAttr(staff.id) + '\')" style="cursor: pointer;">' +
        '<td class="sticky-hierarchy-col">' + profileHtml + '</td>' +
        staffDayCells.join('') +
      '</tr>';
    }).join('');

    return tbodyRowsHtml;
  }
};

window.HortOpsForwardPlannerMatrix.renderMatrixBody = window.HortOpsForwardPlannerMatrix.renderTbody;
window.HortOpsForwardPlannerRenderer = window.HortOpsForwardPlannerMatrix;

})();
