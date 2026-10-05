(function() {
// Imported colours never enter CSS/HTML without token validation.
var safeColor = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.safeColor) || function() { return '#10b981'; };
// Workforce Directory Component
window.HortOpsStaffRegistry = {
  searchTerm: '',
  selectedDept: 'all',
  selectedTeam: 'all',
  selectedStatus: 'all',

  render: function(state) {
    var icons = window.HortOpsIcons;
    var staffList = state.staffList;
    var hierarchy = window.HortOpsData.getDepartmentHierarchy(staffList);
    var self = this;

    function esc(str) {
      if (window.HortOpsSecurityUtils && typeof window.HortOpsSecurityUtils.escapeHtml === 'function') {
        return window.HortOpsSecurityUtils.escapeHtml(str);
      }
      if (str == null) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function escAttr(str) {
      if (window.HortOpsSecurityUtils && typeof window.HortOpsSecurityUtils.escapeHtmlAttr === 'function') {
        return window.HortOpsSecurityUtils.escapeHtmlAttr(str);
      }
      return esc(str);
    }

    var filtered = staffList.filter(function(staff) {
      var s = staff.status || 'active';
      if (self.selectedStatus === 'active' && s !== 'active') return false;
      if (self.selectedStatus === 'departed' && s !== 'departed') return false;
      if (self.selectedStatus === 'inactive' && s !== 'inactive') return false;
      if (self.selectedStatus === 'on_leave' && s !== 'on_leave') return false;
      if (self.selectedStatus === 'temporarily_unavailable' && s !== 'temporarily_unavailable') return false;
      if (self.selectedDept !== 'all' && staff.department !== self.selectedDept) return false;
      if (self.selectedTeam !== 'all' && staff.team !== self.selectedTeam) return false;

      if (self.searchTerm) {
        var q = self.searchTerm.toLowerCase();
        var mName = staff.name.toLowerCase().indexOf(q) !== -1;
        var mId = staff.id.toLowerCase().indexOf(q) !== -1;
        var mEmail = (staff.email || '').toLowerCase().indexOf(q) !== -1;
        var mRole = (staff.role || '').toLowerCase().indexOf(q) !== -1;
        var mTeam = (staff.team || '').toLowerCase().indexOf(q) !== -1;
        var mCrew = (staff.crew || '').toLowerCase().indexOf(q) !== -1;
        var mDept = (staff.department || '').toLowerCase().indexOf(q) !== -1;
        if (!mName && !mId && !mEmail && !mRole && !mTeam && !mCrew && !mDept) return false;
      }

      return true;
    });

    var deptOptions = '<option value="all">All Departments</option>' + hierarchy.map(function(d) {
      return '<option value="' + escAttr(d.name) + '"' + (self.selectedDept === d.name ? ' selected' : '') + '>' + esc(d.name) + ' (' + d.totalStaff + ')</option>';
    }).join('');

    var teamsList = [];
    hierarchy.forEach(function(d) {
      if (self.selectedDept === 'all' || d.name === self.selectedDept) {
        d.teams.forEach(function(t) { teamsList.push(t); });
      }
    });

    var teamOptions = '<option value="all">All Teams</option>' + teamsList.map(function(t) {
      return '<option value="' + escAttr(t.name) + '"' + (self.selectedTeam === t.name ? ' selected' : '') + '>' + esc(t.name) + ' (' + t.count + ')</option>';
    }).join('');

    var statusOptions = '<option value="all"' + (self.selectedStatus === 'all' ? ' selected' : '') + '>All Statuses</option>' +
      '<option value="active"' + (self.selectedStatus === 'active' ? ' selected' : '') + '>Active Only</option>' +
      '<option value="departed"' + (self.selectedStatus === 'departed' ? ' selected' : '') + '>Departed Only</option>' +
      '<option value="inactive"' + (self.selectedStatus === 'inactive' ? ' selected' : '') + '>Inactive Only</option>' +
      '<option value="on_leave"' + (self.selectedStatus === 'on_leave' ? ' selected' : '') + '>On Leave Only</option>' +
      '<option value="temporarily_unavailable"' + (self.selectedStatus === 'temporarily_unavailable' ? ' selected' : '') + '>Unavailable Only</option>';

    var rowsHtml = filtered.map(function(staff) {
      var empStatus = staff.status || 'active';
      var statusBadge = '';
      if (empStatus === 'departed') {
        statusBadge = '<span class="badge" style="background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; font-size: 11px; font-weight: 700;">Departed</span>';
      } else if (empStatus === 'inactive') {
        statusBadge = '<span class="badge" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; font-size: 11px; font-weight: 700;">Inactive</span>';
      } else if (empStatus === 'on_leave') {
        statusBadge = '<span class="badge badge-amber" style="font-size: 11px; font-weight: 700;">On Leave</span>';
      } else if (empStatus === 'temporarily_unavailable') {
        statusBadge = '<span class="badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 11px; font-weight: 700;">Unavailable</span>';
      } else {
        statusBadge = '<span class="badge badge-emerald" style="font-size: 11px;">Active</span>';
      }

      var isExempt = (empStatus === 'active') && !!staff.isOvertimeExempt;
      var otStatusHtml = '';
      if (empStatus === 'departed' || empStatus === 'inactive') {
        otStatusHtml = '<span class="badge" style="background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; font-size: 11px;">Ineligible</span>';
      } else if (empStatus === 'on_leave') {
        otStatusHtml = '<span class="badge badge-amber" style="font-size: 11px;">On Leave</span>';
      } else if (empStatus === 'temporarily_unavailable') {
        otStatusHtml = '<span class="badge" style="background: #f1f5f9; color: #94a3b8; border: 1px solid #e2e8f0; font-size: 11px;">Unavailable</span>';
      } else if (isExempt) {
        var dateNote = '';
        if (staff.exemptionStartDate && staff.exemptionEndDate) {
          dateNote = ' (' + staff.exemptionStartDate + ' to ' + staff.exemptionEndDate + ')';
        } else if (staff.exemptionStartDate) {
          dateNote = ' (from ' + staff.exemptionStartDate + ')';
        } else if (staff.exemptionEndDate) {
          dateNote = ' (until ' + staff.exemptionEndDate + ')';
        } else {
          dateNote = ' (Indefinite)';
        }
        var tip = 'Overtime Exempt' + dateNote + (staff.exemptionReason ? ': ' + staff.exemptionReason : '');
        otStatusHtml = '<span class="badge" style="background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; font-size: 11px; font-weight: 700;" title="' + escAttr(tip) + '">Exempt' + (staff.exemptionStartDate ? '*' : '') + '</span>';
      } else {
        otStatusHtml = '<span class="badge badge-emerald" style="font-size: 11px;">Available</span>';
      }

      // Stage 3 Gate 3A: Qualifications rendering
      var quals = Array.isArray(staff.qualifications) ? staff.qualifications : [];
      var qualsHtml = '';
      if (quals.length === 0) {
        qualsHtml = '<span style="color: var(--slate-400); font-size: 12px;">—</span>';
      } else {
        var qEngine = window.HortOpsQualifications;
        var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
          ? window.HortOpsDateUtils.getLocalDateKey()
          : (new Date()).toISOString().slice(0, 10);
        qualsHtml = '<div style="display: flex; gap: 4px; flex-wrap: wrap;">' + quals.map(function(q) {
          var def = qEngine ? qEngine.getDefinition(q.code) : null;
          var isExpired = qEngine ? qEngine.isExpired(q, todayStr) : false;
          var bColor = (def && def.badgeColor) ? def.badgeColor : '#059669';
          if (isExpired) {
            return '<span class="badge" style="background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-size: 10px; font-weight: 700;" title="' + escAttr((def ? def.name : q.code) + ' (EXPIRED ' + (q.expiryDate || '') + ')') + '">⚠️ ' + esc(q.code) + '</span>';
          }
          return '<span class="badge" style="background: #f0fdf4; color: ' + escAttr(bColor) + '; border: 1px solid #bbf7d0; font-size: 10px; font-weight: 600;" title="' + escAttr(def ? def.name : q.code) + '">' + esc(q.code) + '</span>';
        }).join('') + '</div>';
      }

      // Stage 3 Gate 3C: Fatigue status rendering
      var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
        ? window.HortOpsDateUtils.getLocalDateKey()
        : (new Date()).toISOString().slice(0, 10);

      var fatigueHtml = '<span class="badge badge-emerald" style="font-size: 10px;">Low</span>';
      if (window.HortOpsFatigueEngine && typeof window.HortOpsFatigueEngine.evaluateStaffFatigue === 'function') {
        var allShifts = (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.allShifts) || [];
        var fEval = window.HortOpsFatigueEngine.evaluateStaffFatigue(staff, allShifts, todayStr);
        if (fEval.tier === 'CRITICAL') {
          fatigueHtml = '<span class="badge" style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; font-size: 10px; font-weight: 700;" title="' + escAttr(fEval.message) + '">' + icons.render('alertTriangle', 'w-2.5 h-2.5') + 'Rest Req (' + fEval.consecutiveWeekends + 'w)</span>';
        } else if (fEval.tier === 'HIGH') {
          fatigueHtml = '<span class="badge" style="background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; font-size: 10px; font-weight: 700;" title="' + escAttr(fEval.message) + '">High (' + fEval.consecutiveWeekends + 'w)</span>';
        } else if (fEval.tier === 'MODERATE') {
          fatigueHtml = '<span class="badge badge-amber" style="font-size: 10px; font-weight: 700;" title="' + escAttr(fEval.message) + '">Mod (' + fEval.consecutiveWeekends + 'w)</span>';
        } else {
          fatigueHtml = '<span class="badge badge-emerald" style="font-size: 10px; font-weight: 600;" title="' + escAttr(fEval.message) + '">Low (' + fEval.consecutiveWeekends + 'w)</span>';
        }
      }

      var actionHtml = '<div style="display: flex; gap: 0.35rem; justify-content: center;">' +
        '<button type="button" class="btn btn-secondary" style="padding: 0.2rem 0.45rem; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.2rem; border-color: #cbd5e1; background: #ffffff;" onclick="event.stopPropagation(); window.HortOpsStaffQualificationModal.open(\'' + escAttr(staff.id) + '\')" title="Manage Qualifications & Accreditations">' +
          icons.render('shield', 'w-3 h-3 text-emerald-600') +
          '<span>Tickets</span>' +
        '</button>' +
        '<button type="button" class="btn btn-secondary" style="padding: 0.2rem 0.45rem; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.2rem; border-color: #cbd5e1; background: #ffffff;" onclick="event.stopPropagation(); window.HortOpsStaffAbsenceModal.open(\'' + escAttr(staff.id) + '\')" title="Manage Absence Intervals & Refusal History">' +
          icons.render('calendar', 'w-3 h-3 text-amber-600') +
          '<span>Leave</span>' +
        '</button>' +
        '<button type="button" class="btn btn-secondary" style="padding: 0.2rem 0.45rem; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.2rem; border-color: #cbd5e1; background: #ffffff;" onclick="event.stopPropagation(); window.HortOpsStaffExemptionModal.open(\'' + escAttr(staff.id) + '\')" title="Edit Overtime Exemption">' +
          icons.render('edit', 'w-3 h-3 text-slate-500') +
          '<span>Exempt</span>' +
        '</button>' +
      '</div>';

      return '<tr>' +
        '<td style="padding: 0.6rem 0.8rem;">' +
          '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
            '<span style="width: 10px; height: 10px; border-radius: 50%; background: ' + safeColor(staff.avatarColor, '#10b981') + '; shrink: 0;"></span>' +
            '<div>' +
              '<div style="font-weight: 700; color: var(--slate-900);">' + esc(staff.name) + '</div>' +
              '<div style="font-size: 12px; color: var(--slate-400);">' + esc(staff.email || '') + '</div>' +
            '</div>' +
          '</div>' +
        '</td>' +
        '<td>' + esc(staff.department) + '</td>' +
        '<td><span style="font-weight: 600;">' + esc(staff.team) + '</span></td>' +
        '<td><span style="color: var(--slate-700); font-size: 12px;">' + esc(staff.crew || staff.team) + '</span></td>' +
        '<td>' + esc(staff.role) + '</td>' +
        '<td>' + qualsHtml + '</td>' +
        '<td>' + fatigueHtml + '</td>' +
        '<td>' + (staff.isPlantOperator ? '<span class="badge badge-amber">' + icons.render('check', 'w-2.5 h-2.5') + 'Certified Operator</span>' : '<span style="color: var(--slate-400); font-size: 12px;">—</span>') + '</td>' +
        '<td><span class="badge badge-slate" style="font-size: 11px;">' + esc(staff.userType || 'App') + '</span></td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + otStatusHtml + '</td>' +
        '<td style="text-align: center;">' + actionHtml + '</td>' +
      '</tr>';
    }).join('');

    return '<div class="panel-card">' +
      '<div class="panel-header">' +
        '<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' +
          '<input type="text" class="form-input" style="width: 240px;" placeholder="Search name, ID, team, crew, role..." value="' + escAttr(self.searchTerm || '') + '" oninput="window.HortOpsStaffRegistry.setSearch(this.value)" />' +
          '<select class="form-select" style="width: 180px;" onchange="window.HortOpsStaffRegistry.setDept(this.value)">' + deptOptions + '</select>' +
          '<select class="form-select" style="width: 180px;" onchange="window.HortOpsStaffRegistry.setTeam(this.value)">' + teamOptions + '</select>' +
          '<select class="form-select" style="width: 140px;" onchange="window.HortOpsStaffRegistry.setStatus(this.value)">' + statusOptions + '</select>' +
        '</div>' +
        '<span style="font-size: 13px; color: var(--slate-500);">' + filtered.length + ' of ' + staffList.length + ' personnel</span>' +
      '</div>' +

      '<div style="overflow-x: auto;">' +
        '<table class="planner-table">' +
          '<thead><tr>' +
            '<th style="width: 210px;">Employee</th>' +
            '<th style="width: 130px;">Department</th>' +
            '<th style="width: 120px;">Team / Unit</th>' +
            '<th style="width: 120px;">Crew / Depot</th>' +
            '<th style="width: 110px;">Role</th>' +
            '<th style="width: 150px;">Accreditations</th>' +
            '<th style="width: 110px;">Fatigue</th>' +
            '<th style="width: 120px;">Plant Operator</th>' +
            '<th style="width: 80px;">User Type</th>' +
            '<th style="width: 90px;">Status</th>' +
            '<th style="width: 90px;">Overtime</th>' +
            '<th style="width: 130px; text-align: center;">Action</th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>';
  },

  setSearch: function(val) {
    this.searchTerm = val;
    var activeEl = document.activeElement;
    var isSearchInput = activeEl && activeEl.tagName === 'INPUT' && activeEl.placeholder && activeEl.placeholder.indexOf('Search') !== -1;
    var selStart = isSearchInput ? activeEl.selectionStart : null;
    var selEnd = isSearchInput ? activeEl.selectionEnd : null;

    window.HortOpsApp.renderCurrentView();

    if (isSearchInput) {
      var contentMount = document.getElementById('content-mount');
      if (contentMount) {
        var newInput = contentMount.querySelector('input[placeholder*="Search"]');
        if (newInput) {
          newInput.focus();
          if (selStart !== null && selEnd !== null) {
            newInput.setSelectionRange(selStart, selEnd);
          }
        }
      }
    }
  },

  setDept: function(val) {
    this.selectedDept = val;
    this.selectedTeam = 'all';
    window.HortOpsApp.renderCurrentView();
  },

  setTeam: function(val) {
    this.selectedTeam = val;
    window.HortOpsApp.renderCurrentView();
  },

  setStatus: function(val) {
    this.selectedStatus = val;
    window.HortOpsApp.renderCurrentView();
  }
};

})();
