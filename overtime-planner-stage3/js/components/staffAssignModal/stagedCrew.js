// Staff Assignment Staged Crew Sub-module
// Renders staged allocations for the selected shift, vacancy slot fill states, permit compliance, and commit actions.
// Implements stable slot strategy management, source-owned downstream occurrence indicators, and historical protection.

window.HortOpsStaffAssignStagedCrew = {
  renderPermits: function(ctx) {
    ctx = ctx || {};
    var shift = ctx.shift || {};
    var escAttr = ctx.escAttr || (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) || function(s) { return s || ''; };

    if (!shift.requiresWZTM && !shift.requiresTPO) return '';

    return '<div style="background: #ffffff; border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.5rem 0.75rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; font-size: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">' +
      '<div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">' +
        '<span style="font-weight: 800; color: var(--slate-600); text-transform: uppercase;">Permits:</span>' +
        (shift.requiresWZTM ? (
          '<div style="display: flex; align-items: center; gap: 0.4rem; background: var(--slate-50); padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--slate-200);">' +
            '<strong style="color: var(--slate-800);">WZTM:</strong>' +
            '<select style="font-size: 11px; padding: 2px 4px; border-radius: 3px; font-weight: 700;" onchange="window.HortOpsStaffAssignModal.updatePermit(\'wztm\', this.value)">' +
              '<option value="pending"' + (shift.wztmStatus === 'pending' ? ' selected' : '') + '>Pending (Not Applied)</option>' +
              '<option value="booked"' + (shift.wztmStatus === 'booked' ? ' selected' : '') + '>Applied / Booked</option>' +
              '<option value="finalized"' + (shift.wztmStatus === 'finalized' ? ' selected' : '') + '>Approved / Finalized</option>' +
            '</select>' +
            '<input type="text" placeholder="Permit Ref# / Notes" value="' + escAttr(shift.wztmNotes || '') + '" style="font-size: 11px; padding: 2px 4px; width: 140px; border: 1px solid var(--slate-300); border-radius: 3px;" onblur="window.HortOpsStaffAssignModal.updatePermitNotes(\'wztm\', this.value)" />' +
          '</div>'
        ) : '') +
        (shift.requiresTPO ? (
          '<div style="display: flex; align-items: center; gap: 0.4rem; background: var(--slate-50); padding: 0.25rem 0.5rem; border-radius: 4px; border: 1px solid var(--slate-200);">' +
            '<strong style="color: var(--slate-800);">TPO:</strong>' +
            '<select style="font-size: 11px; padding: 2px 4px; border-radius: 3px; font-weight: 700;" onchange="window.HortOpsStaffAssignModal.updatePermit(\'tpo\', this.value)">' +
              '<option value="pending"' + (shift.tpoStatus === 'pending' ? ' selected' : '') + '>Pending (Not Applied)</option>' +
              '<option value="booked"' + (shift.tpoStatus === 'booked' ? ' selected' : '') + '>Applied / Booked</option>' +
              '<option value="finalized"' + (shift.tpoStatus === 'finalized' ? ' selected' : '') + '>Approved / Finalized</option>' +
            '</select>' +
            '<input type="text" placeholder="TPO Ref# / Notes" value="' + escAttr(shift.tpoNotes || '') + '" style="font-size: 11px; padding: 2px 4px; width: 140px; border: 1px solid var(--slate-300); border-radius: 3px;" onblur="window.HortOpsStaffAssignModal.updatePermitNotes(\'tpo\', this.value)" />' +
          '</div>'
        ) : '') +
      '</div>' +
    '</div>';
  },

  render: function(ctx) {
    ctx = ctx || {};
    var shift = ctx.shift || {};
    var assignedIds = ctx.stagedAssignedStaffIds || ctx.assignedIds || [];
    var vacancies = ctx.vacancies !== undefined ? ctx.vacancies : Math.max(0, shift.crewSize - assignedIds.length);
    var assignedStaffList = ctx.assignedStaffList || [];
    if (assignedStaffList.length === 0 && assignedIds.length > 0 && ctx.staffList) {
      assignedStaffList = assignedIds.map(function(id) {
        return ctx.staffList.find(function(s) { return s.id === id; });
      }).filter(Boolean);
    }
    var ineligibleAssignees = ctx.ineligibleAssignees || [];
    var isPlantOpReq = ctx.isPlantOpReq;
    var isPlantOpPresent = ctx.isPlantOpPresent;
    var getHumanIneligibleReason = ctx.getHumanIneligibleReason || function(r) { return r; };
    var icons = ctx.icons || window.HortOpsIcons;
    var escHtml = ctx.escHtml || (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s || ''; };
    var escAttr = ctx.escAttr || (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) || function(s) { return s || ''; };

    var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey()
      : new Date().toISOString().slice(0, 10);

    var plantOpAlertHtml = (isPlantOpReq && !isPlantOpPresent) ?
      '<div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.65rem; font-size: 12px; color: #9f1239; display: flex; align-items: center; gap: 0.4rem;">' +
        icons.render('shield', 'w-4 h-4 text-rose-700') +
        '<div><strong>Plant Operator Required:</strong> This job strictly requires at least one certified Plant Operator. Save will be blocked until a certified operator is assigned.</div>' +
      '</div>' : '';

    var conflictAlertHtml = (ineligibleAssignees.length > 0) ?
      '<div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.65rem; font-size: 12px; color: #9f1239; display: flex; align-items: center; justify-content: space-between;">' +
        '<div style="display: flex; align-items: center; gap: 0.4rem;">' +
          icons.render('alertTriangle', 'w-4 h-4 text-rose-700') +
          '<div><strong>Allocation Conflict:</strong> ' + ineligibleAssignees.length + ' assigned staff member(s) are ineligible under current rules.</div>' +
        '</div>' +
        '<button type="button" class="btn btn-danger" style="padding: 0.2rem 0.5rem; font-size: 11px;" onclick="window.HortOpsStaffAssignModal.removeAllIneligible()">Remove Ineligible</button>' +
      '</div>' : '';

    var matchingJob = ctx.matchingJob || {};
    var reqQuals = Array.isArray(matchingJob.requiredQualifications) ? matchingJob.requiredQualifications : [];
    var shiftDate = (shift && (shift.date || shift.shiftDate)) || (shift && shift.shiftId && shift.shiftId.split('@')[1]) || todayStr;

    var unaccreditedStaff = [];
    if (reqQuals.length > 0 && window.HortOpsQualifications && typeof window.HortOpsQualifications.evaluateStaffQualifications === 'function') {
      assignedStaffList.forEach(function(staff) {
        var evalRes = window.HortOpsQualifications.evaluateStaffQualifications(staff, reqQuals, shiftDate);
        if (!evalRes.compliant) {
          unaccreditedStaff.push({ staff: staff, evalRes: evalRes });
        }
      });
    }

    var qualificationAlertHtml = (unaccreditedStaff.length > 0) ?
      '<div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.65rem; font-size: 12px; color: #9f1239; display: flex; align-items: center; justify-content: space-between;">' +
        '<div style="display: flex; align-items: center; gap: 0.4rem;">' +
          icons.render('shield', 'w-4 h-4 text-rose-700') +
          '<div><strong>Accreditation Non-Compliance:</strong> ' + unaccreditedStaff.length + ' allocated officer(s) lack active accreditations required for this shift (' + escHtml(reqQuals.join(', ')) + ').</div>' +
        '</div>' +
        '<button type="button" class="btn btn-danger" style="padding: 0.2rem 0.5rem; font-size: 11px;" onclick="window.HortOpsStaffAssignModal.removeAllUnaccredited()">Remove Unaccredited</button>' +
      '</div>' : '';

    var criticalFatigueStaff = [];
    if (window.HortOpsFatigueEngine && typeof window.HortOpsFatigueEngine.evaluateStaffFatigue === 'function') {
      assignedStaffList.forEach(function(staff) {
        var fRes = window.HortOpsFatigueEngine.evaluateStaffFatigue(staff, ctx.allShifts, shiftDate);
        if (fRes.isHardBlocked || fRes.tier === 'CRITICAL') {
          criticalFatigueStaff.push({ staff: staff, evalRes: fRes });
        }
      });
    }

    var fatigueAlertHtml = (criticalFatigueStaff.length > 0) ?
      '<div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.65rem; font-size: 12px; color: #9f1239; display: flex; align-items: center; justify-content: space-between;">' +
        '<div style="display: flex; align-items: center; gap: 0.4rem;">' +
          icons.render('alertTriangle', 'w-4 h-4 text-rose-700') +
          '<div><strong>Fatigue Policy Violation:</strong> ' + criticalFatigueStaff.length + ' allocated officer(s) have worked >=4 consecutive weekends. Mandatory physical rest required.</div>' +
        '</div>' +
        '<button type="button" class="btn btn-danger" style="padding: 0.2rem 0.5rem; font-size: 11px;" onclick="window.HortOpsStaffAssignModal.removeAllFatigued()">Remove Fatigued</button>' +
      '</div>' : '';

    var stagedSlots = ctx.stagedSlots || [];
    var slotStrategies = ctx.stagedSlotStrategies || {};

    var sealedSlots = stagedSlots.filter(function(s) { return s && s.isSealedHistorical; });
    var sealedAlertHtml = '';
    if (sealedSlots.length > 0) {
      var slotWithCont = sealedSlots.find(function(s) { return s.activeContinuationShiftId; });
      var contShiftId = slotWithCont ? slotWithCont.activeContinuationShiftId : null;
      var contDate = slotWithCont ? (slotWithCont.activeContinuationDate || contShiftId.split('@')[1]) : null;

      var openBtnHtml = contShiftId ?
        ('<button type="button" class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 11px; font-weight: 700; white-space: nowrap; margin-left: auto; border: 1px solid var(--slate-400); background: #ffffff; color: var(--slate-800); cursor: pointer;" onclick="window.HortOpsStaffAssignModal.openActiveContinuation(\'' + escAttr(contShiftId) + '\')">' +
          icons.render('calendar', 'w-3.5 h-3.5') + ' Open Active Rostering' +
        '</button>') : '';

      var bannerMessage = contShiftId ?
        ('<strong>Historical Record:</strong> One or more slots on this shift are sealed historical assignments. Future rostering for these slots continues from ' + escHtml(contDate) + '.') :
        ('<strong>Historical Record:</strong> This rostering instruction is complete. No active future continuation.');

      sealedAlertHtml = '<div class="sealed-history-banner" style="background: var(--slate-100, #f1f5f9); border: 1px solid var(--slate-300, #cbd5e1); border-radius: 6px; padding: 0.5rem 0.75rem; margin-bottom: 0.65rem; font-size: 12px; color: var(--slate-700, #334155); display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">' +
        '<div style="display: flex; align-items: center; gap: 0.4rem;">' +
          icons.render('lock', 'w-4 h-4 text-slate-600') +
          '<div>' + bannerMessage + '</div>' +
        '</div>' +
        openBtnHtml +
      '</div>';
    }

    var assignedStaffHtml = assignedStaffList.length === 0 ?
      '<div style="text-align: center; padding: 2rem 1rem; color: var(--slate-400); font-size: 13px;">No staff allocated yet. Select candidates from the directory on the right.</div>' :
      assignedStaffList.map(function(staff) {
        var dotHtml = (window.HortOpsData && window.HortOpsData.renderTeamDot) ?
          window.HortOpsData.renderTeamDot(staff.team) :
          '<span class="team-dot" style="background-color: ' + (staff.avatarColor || '#10b981') + ';"></span>';

        var ineligItem = ineligibleAssignees.find(function(item) { return item.staff.id === staff.id; });
        var ineligBadge = ineligItem ?
          '<span class="badge" style="background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; font-size: 10px; font-weight: 700; margin-left: 4px;">⚠️ Ineligible: ' + getHumanIneligibleReason(ineligItem.reason) + '</span>' : '';
        var cardBorder = ineligItem ? 'border: 1px solid #f87171; background: #fff1f2;' : 'border: 1px solid var(--slate-200); background: var(--slate-50);';

        var plantOpPill = staff.isPlantOperator ?
          '<span class="badge badge-amber" style="font-size: 10px; font-weight: 700; flex-shrink: 0; padding: 1px 6px;">Plant Op</span>' : '';

        var slot = stagedSlots.find(function(s) { return s.staffId === staff.id; });
        var slotStrategy = slot || slotStrategies[staff.id] || { mode: 'manual', repeatCount: 1 };
        var currentMode = slotStrategy.mode || 'manual';
        var currentRepeat = slotStrategy.repeatCount || 1;

        var assignmentColHtml = '';
        if (slot && slot.isSealedHistorical) {
          var modeLabel = (slot.mode || 'fixed').charAt(0).toUpperCase() + (slot.mode || 'fixed').slice(1);
          var repeatLabel = slot.repeatCount || 1;
          var contDateStr = slot.activeContinuationDate || (slot.activeContinuationShiftId ? slot.activeContinuationShiftId.split('@')[1] : null);
          var openSlotBtn = slot.activeContinuationShiftId ?
            '<button type="button" class="btn btn-secondary" style="padding: 1px 6px; font-size: 10px; font-weight: 700; border: 1px solid var(--slate-300); background: #ffffff; color: var(--slate-700); cursor: pointer;" onclick="window.HortOpsStaffAssignModal.openActiveContinuation(\'' + escAttr(slot.activeContinuationShiftId) + '\')">' +
              'Open' +
            '</button>' : '';

          var subtitleHtml = contDateStr ?
            ('<span style="font-size: 10px; color: var(--slate-500);">Continues: ' + escHtml(contDateStr) + '</span>') :
            ('<span style="font-size: 10px; color: var(--slate-400);">No active future continuation</span>');

          var titleAttr = contDateStr ?
            ('Sealed historical record. Future rostering continues from ' + escAttr(contDateStr) + '.') :
            'Sealed historical record. This rostering instruction is complete.';

          assignmentColHtml = '<div class="allocated-assignment-col" style="display: flex; flex-direction: column; justify-content: center; width: 220px; flex-shrink: 0; padding-right: 0.5rem; border-right: 1px solid var(--slate-200); margin-right: 0.5rem;" title="' + titleAttr + '">' +
            '<div style="display: flex; align-items: center; gap: 4px;">' +
              '<span class="badge" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-size: 10px; font-weight: 700; padding: 1px 6px;">Historical • ' + escHtml(modeLabel) + ' (' + repeatLabel + ')</span>' +
            '</div>' +
            '<div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-top: 2px;">' +
              subtitleHtml +
              openSlotBtn +
            '</div>' +
          '</div>';
        } else if (slot && slot.isInherited) {
          var modeLabel = (slot.mode || 'fixed').charAt(0).toUpperCase() + (slot.mode || 'fixed').slice(1);
          assignmentColHtml = '<div class="allocated-assignment-col" style="display: flex; flex-direction: column; justify-content: center; width: 220px; flex-shrink: 0; padding-right: 0.5rem; border-right: 1px solid var(--slate-200); margin-right: 0.5rem;" title="Inherited from ' + escAttr(slot.sourceDate) + ' (' + escAttr(modeLabel) + ', Repeat ' + slot.repeatCount + '). Edit source shift to change instruction.">' +
            '<div style="display: flex; align-items: center; gap: 4px;">' +
              '<span class="badge" style="background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; font-size: 10px; font-weight: 700; padding: 1px 6px;">Inherited • ' + escHtml(modeLabel) + ' (' + slot.repeatCount + ')</span>' +
            '</div>' +
            '<span style="font-size: 10px; color: var(--slate-400); margin-top: 2px;">Source: ' + escHtml(slot.sourceDate) + '</span>' +
          '</div>';
        } else {
          // Active instruction (source shift): Repeat is editable up to ctx.maxRepeat!
          var maxRepeat = ctx.maxRepeat || 1;
          var repeatOptionsHtml = '';
          for (var r = 1; r <= maxRepeat; r++) {
            repeatOptionsHtml += '<option value="' + r + '"' + (currentRepeat === r ? ' selected' : '') + '>' + r + (r === 1 ? ' shift' : ' shifts') + '</option>';
          }

          var repeatDisabled = (currentMode === 'manual') ? ' disabled' : '';

          assignmentColHtml = '<div class="allocated-assignment-col" style="display: flex; align-items: center; gap: 0.35rem; width: 220px; flex-shrink: 0; padding-right: 0.5rem; border-right: 1px solid var(--slate-200); margin-right: 0.5rem;">' +
            '<select class="assignment-mode-select" style="height: 26px; font-size: 11px; padding: 1px 4px; border-radius: 4px; border: 1px solid var(--slate-300); background: #ffffff; color: var(--slate-800); font-weight: 600;" onchange="window.HortOpsStaffAssignModal.updateSlotMode(\'' + staff.id + '\', this.value)" title="Choose assignment mode: Manual (current shift only), Fixed (same officer across repeats), or Rotation (different officers across repeats)">' +
              '<option value="manual"' + (currentMode === 'manual' ? ' selected' : '') + '>Manual</option>' +
              '<option value="fixed"' + (currentMode === 'fixed' ? ' selected' : '') + '>Fixed</option>' +
              '<option value="rotation"' + (currentMode === 'rotation' ? ' selected' : '') + '>Rotation</option>' +
            '</select>' +
            '<select class="repeat-count-select" style="height: 26px; font-size: 11px; padding: 1px 4px; border-radius: 4px; border: 1px solid var(--slate-300); background: ' + (currentMode === 'manual' ? '#f1f5f9' : '#ffffff') + '; color: ' + (currentMode === 'manual' ? 'var(--slate-400)' : 'var(--slate-800)') + '; font-weight: 600;" onchange="window.HortOpsStaffAssignModal.updateSlotRepeat(\'' + staff.id + '\', parseInt(this.value, 10))"' + repeatDisabled + ' title="Number of consecutive occurrences affected, starting with this shift">' +
              repeatOptionsHtml +
            '</select>' +
          '</div>';
        }

        var qualBadge = '';
        if (reqQuals.length > 0 && window.HortOpsQualifications && typeof window.HortOpsQualifications.evaluateStaffQualifications === 'function') {
          var staffQualEval = window.HortOpsQualifications.evaluateStaffQualifications(staff, reqQuals, shiftDate);
          if (staffQualEval.compliant) {
            qualBadge = '<span class="badge badge-emerald" style="font-size: 10px; font-weight: 700; flex-shrink: 0;" title="Accredited: ' + escAttr(staffQualEval.validCodes.join(', ')) + '">' + icons.render('shield', 'w-2.5 h-2.5') + 'Accredited</span>';
          } else if (staffQualEval.expiredCodes.length > 0) {
            qualBadge = '<span class="badge" style="background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; font-size: 10px; font-weight: 700; flex-shrink: 0;" title="Expired Accreditations: ' + escAttr(staffQualEval.expiredCodes.join(', ')) + '">' + icons.render('alertTriangle', 'w-2.5 h-2.5') + 'Ticket Expired</span>';
          } else {
            qualBadge = '<span class="badge" style="background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; font-size: 10px; font-weight: 700; flex-shrink: 0;" title="Missing Accreditations: ' + escAttr(staffQualEval.missingCodes.join(', ')) + '">' + icons.render('lock', 'w-2.5 h-2.5') + 'Ticket Missing</span>';
          }
        }

        var fatigueBadge = '';
        if (window.HortOpsFatigueEngine && typeof window.HortOpsFatigueEngine.evaluateStaffFatigue === 'function') {
          var staffFatigue = window.HortOpsFatigueEngine.evaluateStaffFatigue(staff, ctx.allShifts, shiftDate);
          if (staffFatigue.tier === 'CRITICAL') {
            fatigueBadge = '<span class="badge" style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171; font-size: 10px; font-weight: 700; flex-shrink: 0;" title="' + escAttr(staffFatigue.message) + '">' + icons.render('alertTriangle', 'w-2.5 h-2.5') + 'Rest Req</span>';
          } else if (staffFatigue.tier === 'HIGH') {
            fatigueBadge = '<span class="badge" style="background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; font-size: 10px; font-weight: 700; flex-shrink: 0;" title="' + escAttr(staffFatigue.message) + '">⚠️ ' + staffFatigue.consecutiveWeekends + ' Wknds</span>';
          } else if (staffFatigue.tier === 'MODERATE') {
            fatigueBadge = '<span class="badge badge-amber" style="font-size: 10px; font-weight: 700; flex-shrink: 0;" title="' + escAttr(staffFatigue.message) + '">' + staffFatigue.consecutiveWeekends + ' Wknds</span>';
          }
        }

        return '<div class="allocated-staff-row" style="' + cardBorder + '">' +
          assignmentColHtml +
          '<div style="display: flex; align-items: center; gap: 0.5rem; flex: 1 1 auto; min-width: 0; overflow: hidden;">' +
            dotHtml +
            plantOpPill +
            qualBadge +
            fatigueBadge +
            '<span style="font-weight: 700; color: var(--slate-900); font-size: 13px; flex-shrink: 0;">' + escHtml(staff.name) + '</span>' +
            '<span style="font-size: 12px; color: var(--slate-600); flex-shrink: 0;">' + escHtml(staff.role) + '</span>' +
            '<span style="color: var(--slate-300); font-size: 11px; flex-shrink: 0;">•</span>' +
            '<span style="font-size: 12px; color: var(--slate-500); flex-shrink: 0;">' + escHtml(staff.team) + '</span>' +
            ineligBadge +
          '</div>' +
          '<div style="flex-shrink: 0; margin-left: 0.5rem;">' +
            (slot && slot.isSealedHistorical
              ? '<button class="btn btn-secondary" style="padding: 0.25rem 0.4rem; opacity: 0.5; cursor: not-allowed;" disabled title="' + (slot.activeContinuationDate ? ('Sealed historical record. Future rostering continues from ' + escAttr(slot.activeContinuationDate) + '.') : 'Sealed historical record. This rostering instruction is complete.') + '">' +
                  icons.render('lock', 'w-3.5 h-3.5') +
                '</button>'
              : (slot && slot.isInherited
                ? '<button class="btn btn-secondary" style="padding: 0.25rem 0.4rem; opacity: 0.5; cursor: not-allowed;" disabled title="Inherited from ' + escAttr(slot.sourceDate) + '. Edit source shift to remove.">' +
                    icons.render('lock', 'w-3.5 h-3.5') +
                  '</button>'
                : '<button class="btn btn-danger" style="padding: 0.25rem 0.4rem;" onclick="window.HortOpsStaffAssignModal.removeStaff(\'' + staff.id + '\')" title="Remove from shift">' +
                    icons.render('trash', 'w-3.5 h-3.5') +
                  '</button>')) +
          '</div>' +
        '</div>';
      }).join('');

    var allocationStatusHeader = '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.65rem;">' +
      '<span style="font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--slate-700);">' +
        (assignedIds.length < shift.crewSize ? (assignedIds.length + ' / ' + shift.crewSize + ' Allocated (' + vacancies + ' remaining)') :
         assignedIds.length === shift.crewSize ? ('Fully Staffed (' + shift.crewSize + '/' + shift.crewSize + ')') :
         (assignedIds.length + ' / ' + shift.crewSize + ' Allocated (' + (assignedIds.length - shift.crewSize) + ' over target)')) +
      '</span>' +
      '<span class="badge ' + (assignedIds.length < shift.crewSize ? 'badge-amber' : assignedIds.length === shift.crewSize ? 'badge-emerald' : '') + '" ' +
        (assignedIds.length > shift.crewSize ? 'style="background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; font-weight: 700;"' : '') + '>' +
        (assignedIds.length < shift.crewSize ? vacancies + ' Vacanc' + (vacancies === 1 ? 'y' : 'ies') + ' Needed' :
         assignedIds.length === shift.crewSize ? 'Fully Staffed' :
         'Over Target (+' + (assignedIds.length - shift.crewSize) + ')') +
      '</span>' +
    '</div>';

    var leftColumnHtml = allocationStatusHeader +
      conflictAlertHtml +
      plantOpAlertHtml +
      qualificationAlertHtml +
      fatigueAlertHtml +
      sealedAlertHtml +
      '<div class="allocated-table-header">' +
        '<div style="width: 220px; flex-shrink: 0; padding-right: 0.5rem; border-right: 1px solid var(--slate-200); margin-right: 0.5rem;">' +
          'Assignment Mode & Repeat' +
        '</div>' +
        '<div style="flex: 1; min-width: 0;">' +
          'Allocated Officer Details' +
        '</div>' +
      '</div>' +
      '<div style="max-height: 480px; overflow-y: auto; border: 1px solid var(--slate-200); border-top: none; border-radius: 0 0 6px 6px; padding: 0.5rem; background: #ffffff;">' +
        assignedStaffHtml +
      '</div>' +
      '<div style="margin-top: 1rem; display: flex; gap: 0.5rem;">' +
        '<button class="btn btn-secondary" style="padding: 0.6rem 1rem;" onclick="window.HortOpsStaffAssignModal.close()">' +
          'Cancel' +
        '</button>' +
        '<button class="btn btn-primary" style="flex: 1; padding: 0.6rem;" onclick="window.HortOpsStaffAssignModal.saveAllocation()">' +
          'Confirm & Save Allocation' +
        '</button>' +
      '</div>';

    return leftColumnHtml;
  },

  renderLeftColumn: function(ctx) {
    return this.render(ctx);
  }
};
