// Staff Assignment Candidate List Sub-module
// Renders candidate staff cards, suitability scoring, availability pills, and conflict warnings.
window.HortOpsStaffAssignCandidateList = {
  render: function(ctx) {
    var filteredStaff = ctx.filteredStaff || [];
    var assignedIdsSet = ctx.assignedIdsSet || new Set();
    var isExclusive = ctx.isExclusive;
    var getStaffPriority = ctx.getStaffPriority;
    var icons = ctx.icons || window.HortOpsIcons;
    var escHtml = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s || ''; };
    var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) || function(s) { return s || ''; };

    // Candidate Cards HTML
    var candidatesHtml = filteredStaff.length === 0 ?
      '<div style="text-align: center; padding: 3rem 1rem; color: var(--slate-400); font-size: 13px; background: var(--slate-50); border-radius: 6px; border: 1px solid var(--slate-200);">' +
        'No employees match the active filters and exclusive team constraints.' +
      '</div>' :
      filteredStaff.map(function(staff) {
        var isAssigned = assignedIdsSet.has(staff.id);
        var prio = getStaffPriority ? getStaffPriority(staff) : 5;

        var badgeHtml = '';
        if (prio === 1) {
          badgeHtml = '<span class="badge badge-emerald" title="Primary Team Preference">' + icons.render('star', 'w-2.5 h-2.5') + 'Primary</span>';
        } else if (prio === 2) {
          badgeHtml = '<span class="badge badge-sky" title="Secondary Preference">🥈 2nd Pref</span>';
        } else if (prio === 3) {
          badgeHtml = '<span class="badge badge-amber" title="Tertiary Preference">🥉 3rd Pref</span>';
        } else if (isExclusive && prio === 4) {
          badgeHtml = '<span class="badge badge-purple" title="Exclusive Team">' + icons.render('lock', 'w-2.5 h-2.5') + 'Exclusive</span>';
        }

        var isDoubleBooked = !!staff._isDoubleBooked;
        var doubleBookedBadge = isDoubleBooked ? '<span class="badge badge-amber" style="font-size: 10px; font-weight: 700; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;">⚠️ Double-Booked</span>' : '';
        var plantOpBadge = staff.isPlantOperator ? '<span class="badge badge-amber" style="font-size: 11px;">Plant Op</span>' : '';

        var qualBadgeHtml = '';
        if (staff._qualEval && !staff._qualEval.compliant) {
          if (staff._qualEval.expiredCodes && staff._qualEval.expiredCodes.length > 0) {
            qualBadgeHtml = '<span class="badge" style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; font-size: 10px; font-weight: 700;" title="Expired Accreditations: ' + escAttr(staff._qualEval.expiredCodes.join(', ')) + '">' + icons.render('alertTriangle', 'w-2.5 h-2.5') + 'Ticket Expired</span>';
          } else {
            qualBadgeHtml = '<span class="badge" style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; font-size: 10px; font-weight: 700;" title="Missing Accreditations: ' + escAttr(staff._qualEval.missingCodes.join(', ')) + '">' + icons.render('lock', 'w-2.5 h-2.5') + 'Ticket Missing</span>';
          }
        } else if (staff._qualEval && staff._qualEval.validCodes && staff._qualEval.validCodes.length > 0) {
          qualBadgeHtml = '<span class="badge badge-emerald" style="font-size: 10px; font-weight: 700;" title="Holds required accreditations: ' + escAttr(staff._qualEval.validCodes.join(', ')) + '">' + icons.render('shield', 'w-2.5 h-2.5') + 'Accredited</span>';
        }

        var fatigueBadgeHtml = '';
        var fEval = staff._fatigueEval;
        if (fEval) {
          if (fEval.tier === 'CRITICAL') {
            fatigueBadgeHtml = '<span class="badge" style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; font-size: 10px; font-weight: 700;" title="' + escAttr(fEval.message) + '">' + icons.render('alertTriangle', 'w-2.5 h-2.5') + 'Rest Req</span>';
          } else if (fEval.tier === 'HIGH') {
            fatigueBadgeHtml = '<span class="badge" style="background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; font-size: 10px; font-weight: 700;" title="' + escAttr(fEval.message) + '">⚠️ ' + fEval.consecutiveWeekends + ' Wknds</span>';
          } else if (fEval.tier === 'MODERATE') {
            fatigueBadgeHtml = '<span class="badge badge-amber" style="font-size: 10px; font-weight: 700;" title="' + escAttr(fEval.message) + '">' + fEval.consecutiveWeekends + ' Wknds</span>';
          }
        }

        var actionBtn = isAssigned ?
          '<button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; color: var(--emerald-800); background: var(--emerald-50); border-color: var(--emerald-300);" onclick="window.HortOpsStaffAssignModal.removeStaff(\'' + staff.id + '\')">' +
            icons.render('check', 'w-3 h-3') + '<span>Allocated</span>' +
          '</button>' :
          isDoubleBooked ?
          '<button disabled class="btn btn-secondary" style="padding: 0.25rem 0.5rem; opacity: 0.55; cursor: not-allowed;" title="Already allocated to another shift on this date">' +
            '<span>Double-Booked</span>' +
          '</button>' :
          staff._lacksQualifications ?
          '<button disabled class="btn btn-secondary" style="padding: 0.25rem 0.5rem; opacity: 0.55; cursor: not-allowed;" title="Officer lacks mandatory accreditations (' + escAttr(((staff._qualEval.missingCodes || []).concat(staff._qualEval.expiredCodes || [])).join(', ')) + ')">' +
            '<span>Lacks Ticket</span>' +
          '</button>' :
          (staff._fatigueEval && staff._fatigueEval.isHardBlocked) ?
          '<button disabled class="btn btn-secondary" style="padding: 0.25rem 0.5rem; opacity: 0.55; cursor: not-allowed;" title="' + escAttr(staff._fatigueEval.message) + '">' +
            '<span>Rest Req</span>' +
          '</button>' :
          '<button class="btn btn-primary" style="padding: 0.25rem 0.6rem;" onclick="window.HortOpsStaffAssignModal.addStaff(\'' + staff.id + '\')">' +
            icons.render('plus', 'w-3 h-3') + '<span>Add</span>' +
          '</button>';

        var candDotHtml = (window.HortOpsData && window.HortOpsData.renderTeamDot) ?
          window.HortOpsData.renderTeamDot(staff.team) :
          '<span class="team-dot" style="background-color: ' + (staff.avatarColor || '#10b981') + ';"></span>';

        return '<div class="candidate-card ' + (isAssigned ? 'is-assigned' : '') + '">' +
          '<div style="display: flex; align-items: center; gap: 0.5rem; flex: 1 1 auto; min-width: 0; overflow: hidden;">' +
            candDotHtml +
            badgeHtml +
            plantOpBadge +
            doubleBookedBadge +
            qualBadgeHtml +
            fatigueBadgeHtml +
            '<span style="font-weight: 700; font-size: 13px; color: var(--slate-900); flex-shrink: 0;">' + escHtml(staff.name) + '</span>' +
            '<span style="font-size: 12px; color: var(--slate-600); flex-shrink: 0;">' + escHtml(staff.role) + '</span>' +
            '<span style="color: var(--slate-300); font-size: 11px; flex-shrink: 0;">•</span>' +
            '<span style="font-size: 12px; color: var(--slate-500); flex-shrink: 0;">' + escHtml(staff.team) + '</span>' +
          '</div>' +
          '<div style="flex-shrink: 0; margin-left: 0.5rem;">' + actionBtn + '</div>' +
        '</div>';
      }).join('');

    return '<div style="max-height: 400px; overflow-y: auto; padding-right: 2px;">' +
      candidatesHtml +
    '</div>';
  }
};
