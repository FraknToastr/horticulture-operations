// Header Component with High-Quality SVG Icon Buttons, Hover Tips & Reactive Warnings Modal Trigger
window.HortOpsHeader = {
  render: function(state) {
    var icons = window.HortOpsIcons;
    var activeView = state.activeView;
        var currentYear = state.currentYear;
        var range = state.uiState && state.uiState.planningRange;
        var programmeStart = range && window.HortOpsRecurrence.isRealDate(range.start) ? range.start : currentYear + '-11-01';
        var programmeEnd = range && window.HortOpsRecurrence.isRealDate(range.end) ? range.end : (currentYear + 1) + '-02-28';
    var clashCount = state.clashCount || 0;

    var tabs = [
      { id: 'forward_planner', label: 'Forward Planner', icon: 'calendar' },
      { id: 'calendar', label: 'Overtime Calendar', icon: 'calendar' },
      { id: 'job_manager', label: 'Job Registry', icon: 'layers' },
      { id: 'staff_registry', label: 'Workforce Registry', icon: 'users' },
      { id: 'peak_weekends', label: 'Peak Weekends & Clashes', icon: 'alertTriangle', badge: clashCount > 0 ? clashCount : null },
      { id: 'analytics', label: 'Analytics & Budget', icon: 'fileText' }
    ];

    var tabsHtml = tabs.map(function(t) {
      var isActive = t.id === activeView;
      var badgeHtml = t.badge ? '<span class="badge badge-amber" style="margin-left: 4px;">' + t.badge + '</span>' : '';
      return '<button class="nav-tab-btn ' + (isActive ? 'active' : '') + '" onclick="window.HortOpsApp.setActiveView(\'' + t.id + '\')">' +
        icons.render(t.icon, 'w-3.5 h-3.5') +
        '<span>' + t.label + '</span>' +
        badgeHtml +
      '</button>';
    }).join('');

    var minYear = 2025;
    var maxYear = Math.max(2028, currentYear + 3);
    var yearOptionsHtml = '';
    for (var y = minYear; y <= maxYear; y++) {
      yearOptionsHtml += '<option value="' + y + '"' + (currentYear === y ? ' selected' : '') + '>' + y + '</option>';
    }

    var storageStatus = state.storageStatus || 'saved';
    var health = (window.HortOpsStorage && window.HortOpsStorage.getStorageHealth) ? window.HortOpsStorage.getStorageHealth() : { status: 'healthy' };

    var dotColor = '#10b981';
    var statusText = 'Saved';
    var titleText = 'Storage Health: Normal. Changes are automatically saved to this workspace.';

    if (state.recoveryRequired) {
      dotColor = '#f59e0b';
      statusText = 'Recovery Required';
      titleText = 'Storage quarantine active: Auto-save is suspended. Workspace loaded in recovery mode (' + (state.recoverySource || 'Schema v2 failure') + '). Restore a valid backup JSON to restore persistent auto-saving.';
    } else if (health.status === 'read-only') {
      dotColor = 'var(--slate-400)';
      statusText = 'Read-only';
      titleText = 'This tab cannot save. Request exclusive editing with Try editing.';
    } else if (storageStatus === 'save_failed' || health.status === 'failed') {
      dotColor = '#ef4444';
      statusText = 'Save failed';
      titleText = 'Persistence failure: Unable to write to localStorage. Operating in temporary session mode.';
    } else if (storageStatus === 'session_only') {
      dotColor = '#f59e0b';
      statusText = 'Session only';
      titleText = 'Session-only mode: Changes will not persist across browser reloads.';
    } else if (storageStatus === 'saving') {
      dotColor = '#3b82f6';
      statusText = 'Saving…';
      titleText = 'Saving workspace changes…';
    } else if (health.status === 'warning') {
      dotColor = '#f97316';
      statusText = 'Storage warning';
      titleText = 'Storage capacity above 80% (' + health.percentUsed + '% used).';
    }

    // Reactive Warnings Detection (Hidden when 0 warnings)
    var warnings = (window.HortOpsWarningUtils && typeof window.HortOpsWarningUtils.getWarnings === 'function')
      ? window.HortOpsWarningUtils.getWarnings(state)
      : [];

    var warningBtnHtml = '';
    if (warnings.length > 0) {
      var warnTooltip = warnings.length + ' Operational Warning' + (warnings.length !== 1 ? 's' : '') + ' — Click to view';
      warningBtnHtml = '<button class="btn-header-action btn-header-icon-action btn-header-warning-action has-tooltip" id="btn-header-warnings" onclick="window.HortOpsApp.openWarningsModal()" title="' + warnTooltip + '" data-tooltip="' + warnTooltip + '" aria-label="Warnings">' +
        icons.render('alertTriangle', 'w-4 h-4 text-amber-300') +
        '<span class="header-warning-count-badge">' + warnings.length + '</span>' +
        '<span class="sr-only">Warnings (' + warnings.length + ')</span>' +
      '</button>';
    }

    return '<header class="app-header">' +
      '<div class="header-container">' +
        '<div class="brand-area">' +
          '<div class="brand-logo">' + icons.render('sun', 'w-5 h-5') + '</div>' +
          '<div>' +
            '<div class="brand-title">Horticulture Operations</div>' +
            '<div class="brand-subtitle">Overtime & Workforce Planner (Offline Edition)</div>' +
          '</div>' +
        '</div>' +

        '<nav class="nav-tabs">' + tabsHtml + '</nav>' +

        '<div class="header-actions">' +

          '<div class="header-health-pill" id="btn-header-storage-health" role="button" tabindex="0" onclick="window.HortOpsApp.handleHealthPillClick()" title="' + titleText + ' (Click to inspect storage health)" style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--slate-200); font-size: 11px; color: var(--slate-600); background: #ffffff; cursor: pointer;">' +
            '<span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:' + dotColor + ';"></span>' +
            '<span style="font-family: monospace; font-weight: 600;">' + statusText + '</span>' +
          '</div>' +

          warningBtnHtml +

          '<button class="btn-header-action btn-header-icon-action has-tooltip" id="btn-header-export" onclick="window.HortOpsApp.openExportModal()" title="Export CSV & Backup (JSON)" data-tooltip="Export Data (CSV & JSON)" aria-label="Export">' +
            icons.render('download', 'w-4 h-4') +
            '<span class="sr-only">Export</span>' +
          '</button>' +

          '<button class="btn-header-action btn-header-icon-action has-tooltip" id="btn-header-reset-workspace" onclick="window.HortOpsApp.openResetWorkspaceModal()" title="Reset Workspace (Clear Storage)" data-tooltip="Reset Workspace" aria-label="Reset Workspace">' +
            icons.render('trash', 'w-4 h-4') +
            '<span class="sr-only">Reset Workspace</span>' +
          '</button>' +

          '<button class="btn-header-action btn-header-icon-action has-tooltip" id="btn-header-import" onclick="window.HortOpsApp.openImportModal()" title="Import Custom Staff CSV & Restore" data-tooltip="Import Staff CSV / Restore" aria-label="Import Staff">' +
            icons.render('userPlus', 'w-4 h-4') +
            '<span class="sr-only">Import Staff</span>' +
          '</button>' +

          '<button class="btn-add-job-header btn-header-icon-action has-tooltip" id="btn-header-add-job" onclick="window.HortOpsApp.openAddJobModal()" title="Add New Job" data-tooltip="Add New Job" aria-label="Add Job">' +
            icons.render('plus', 'w-4 h-4') +
            '<span class="sr-only">Add Job</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div class="programme-toolbar" aria-label="Planning period">' +
        '<div class="programme-year"><label for="planning-year">Calendar year</label><select id="planning-year" class="year-select" aria-label="Calendar year" onchange="window.HortOpsApp.setYear(parseInt(this.value, 10))">' + yearOptionsHtml + '</select></div>' +
        '<div class="planning-range-controls"><span class="programme-toolbar-title">Programme</span><label for="planning-range-start">From</label><input type="date" id="planning-range-start" value="' + programmeStart + '"><label for="planning-range-end">To</label><input type="date" id="planning-range-end" value="' + programmeEnd + '"><button class="btn btn-secondary" id="planning-range-apply" onclick="window.HortOpsApp.applyPlanningRange()">View programme</button></div>' +
      '</div>' +
      '</header>';
  },

  updateStorageHealthIndicator: function() {
    if (typeof document === 'undefined') return;
    var mount = document.getElementById('header-mount');
    if (mount && window.HortOpsApp && window.HortOpsApp.state) {
      mount.innerHTML = this.render(window.HortOpsApp.state);
    }
  },

  updateStorageHealth: function(saveResult) {
    if (window.HortOpsApp && window.HortOpsApp.state) {
      if (!saveResult || !saveResult.ok) {
        window.HortOpsApp.state.storageStatus = 'save_failed';
      } else {
        window.HortOpsApp.state.storageStatus = 'saved';
      }
    }
    this.updateStorageHealthIndicator();
  }
};
