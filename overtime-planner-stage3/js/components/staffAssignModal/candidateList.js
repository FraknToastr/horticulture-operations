// Show the complete browsed workforce, including blocked pool members and canonical reasons.
(function() {
  'use strict';
  window.HortOpsStaffAssignCandidateList = {
    render: function(ctx) {
      var esc = window.HortOpsSecurityUtils.escapeHtml, attr = window.HortOpsSecurityUtils.escapeHtmlAttr;
      var icons = ctx.icons || window.HortOpsIcons, assigned = ctx.assignedIdsSet || new Set(), tags = ctx.poolTags || [];
      var groups = ctx.allocatorGroups || [{id:'all',label:'All staff',staff:ctx.filteredStaff || []}];
      function reasonText(value) {
        if (value && typeof value === 'object') return value.message || value.code || '';
        return ctx.getHumanIneligibleReason ? ctx.getHumanIneligibleReason(value) : window.HortOpsEligibilityEngine.getHumanIneligibleReason(value);
      }
      function renderCard(person) {
        var isAssigned = assigned.has(person.id) || person._isAssigned;
        var check = person._eligibility || {eligible:!person._isDoubleBooked && !person._lacksQualifications && !(person._fatigueEval && person._fatigueEval.isHardBlocked),reasons:[],warnings:[]};
        var priority = ctx.getStaffPriority ? ctx.getStaffPriority(person) : 5;
        var tierLabels = {1:'Primary',2:'2nd preference',3:'3rd preference',4:'Exclusive'};
        var badges = ctx.teamsEnabled !== false && tierLabels[priority] ? '<span class="badge badge-emerald">' + tierLabels[priority] + '</span>' : '';
        if (person.isPlantOperator) badges += '<span class="badge badge-amber">Plant Op</span>';
        if (person._qualEval && (!person._qualEval.compliant || (person._qualEval.validCodes || []).length)) {
          var qualLabel = person._qualEval.compliant ? 'Accredited' : (person._qualEval.expiredCodes || []).length ? 'Ticket Expired' : 'Ticket Missing';
          badges += '<span class="badge ' + (person._qualEval.compliant ? 'badge-emerald' : 'badge-amber') + '" title="' + attr((person._qualEval.validCodes || []).concat(person._qualEval.missingCodes || [],person._qualEval.expiredCodes || []).join(', ')) + '">' + qualLabel + '</span>';
        }
        if (person._fatigueEval && person._fatigueEval.tier !== 'LOW') {
          var fatigueLabel = person._fatigueEval.tier === 'CRITICAL' ? 'Rest Req' : person._fatigueEval.consecutiveWeekends + ' Wknds';
          badges += '<span class="badge badge-amber" title="' + attr(person._fatigueEval.message || '') + '">' + esc(fatigueLabel) + '</span>';
        }
        var tagChips = (person.poolTagIds || []).map(function(id) {
          var tag = tags.find(function(item) { return item.id === id; });
          return tag ? '<span class="badge ' + (tag.active ? 'badge-emerald' : 'badge-slate') + '" data-staff-pool-tag="' + attr(id) + '" style="font-size:10px;white-space:normal;overflow-wrap:anywhere">#' + esc(tag.label) + (tag.active ? '' : ' (retired)') + '</span>' : '';
        }).join('');
        var reasons = (check.reasons || []).map(function(reason) { return '<li>' + esc(reasonText(reason)) + '</li>'; }).join('');
        var warnings = (check.warnings || []).map(function(reason) { return '<li>' + esc(reasonText(reason)) + '</li>'; }).join('');
        var blockedLabel = person._isDoubleBooked ? 'Double-Booked' : person._lacksQualifications ? 'Lacks Ticket' : person._fatigueEval && person._fatigueEval.isHardBlocked ? 'Rest Req' : 'Unavailable';
        var action = isAssigned ? '<button type="button" disabled class="btn btn-secondary" style="padding:.25rem .5rem">' + icons.render('check','w-3 h-3') + 'Assigned</button>' :
          !check.eligible ? '<button type="button" disabled aria-disabled="true" class="btn btn-secondary" style="padding:.25rem .5rem;opacity:.6" title="' + attr((check.reasons || []).map(reasonText).join('; ')) + '">' + blockedLabel + '</button>' :
          '<button type="button" class="btn btn-primary" style="padding:.25rem .5rem"' + (ctx.vacancies !== undefined && ctx.vacancies <= 0 ? ' disabled title="Crew target is already filled"' : '') + ' onclick="window.HortOpsStaffAssignModal.addStaff(' + attr("'" + String(person.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029') + "'") + ')">' + icons.render('plus','w-3 h-3') + 'Add</button>';
        return '<div class="candidate-card ' + (isAssigned ? 'is-assigned' : '') + '" data-allocator-staff="' + attr(person.id) + '" style="display:flex;align-items:flex-start;flex-wrap:wrap;gap:.5rem;height:auto;min-height:0;white-space:normal"><div style="flex:1 1 180px;min-width:0;overflow-wrap:anywhere"><div style="display:flex;flex-wrap:wrap;align-items:center;gap:.35rem"><strong style="font-size:13px;color:var(--slate-900);min-width:0">' + esc(person.name || person.id) + '</strong>' + tagChips + '</div><div style="font-size:12px;color:var(--slate-500);margin:.25rem 0">' + esc(person.role || '') + ' · ' + esc(person.team || '') + '</div><div style="display:flex;flex-wrap:wrap;gap:.25rem">' + badges + '</div>' +
          (reasons ? '<ul data-allocator-reasons style="font-size:11px;color:var(--rose-700);line-height:1.5;padding-left:1rem;margin:.4rem 0 0">' + reasons + '</ul>' : '') +
          (warnings ? '<ul style="font-size:11px;color:var(--amber-800);line-height:1.5;padding-left:1rem;margin:.4rem 0 0">' + warnings + '</ul>' : '') + '</div><div style="flex-shrink:0">' + action + '</div></div>';
      }
      var content = groups.map(function(group,index) {
        var staff = group.staff || [], eligible = staff.filter(function(person) { return person._eligibility && person._eligibility.eligible && !assigned.has(person.id) && !person._isAssigned; }).length;
        var blocked = staff.filter(function(person) { return person._eligibility && !person._eligibility.eligible; }).length;
        return '<section data-allocator-group="' + attr(group.id) + '" style="margin-top:' + (index ? '1rem;border-top:2px solid var(--slate-300);padding-top:.75rem' : '0') + '"><div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:.35rem;margin-bottom:.5rem"><strong style="font-size:12px;color:' + (index ? 'var(--slate-700)' : 'var(--emerald-800)') + '">' + esc(group.label) + '</strong><span style="font-size:11px;color:var(--slate-500)">' + staff.length + ' shown · ' + eligible + ' available · ' + blocked + ' blocked</span></div>' + (staff.length ? staff.map(renderCard).join('') : '<p style="font-size:12px;color:var(--slate-500)">No staff match these browsing filters.</p>') + '</section>';
      }).join('');
      return '<div style="max-height:400px;overflow-y:auto;overflow-x:hidden;padding-right:2px">' + content + '</div>';
    }
  };
}());
