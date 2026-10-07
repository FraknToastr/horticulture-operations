// Export Modal Component (100% Client-side Blob download, Mandate Sections 2.2 & 13.2)
window.HortOpsExportModal = {
  downloadFile: function(content, filename, mimeType) {
    mimeType = mimeType || 'text/plain;charset=utf-8;';
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() {
      URL.revokeObjectURL(url);
    }, 1000);
  },

  downloadCsv: function(filename, content) {
    this.downloadFile(content, filename, 'text/csv;charset=utf-8;');
  },

  exportBackupJson: function() {
    var state = (window.HortOpsApp && window.HortOpsApp.state) ? window.HortOpsApp.state : {};
    var validator = window.HortOpsSchemaValidator;
    var storage = window.HortOpsStorage;

    function abortBackup(errText) {
      console.error('Cannot export backup: ' + errText);
      if (typeof alert === 'function') {
        alert('Cannot export backup: ' + errText);
      }
      return false;
    }

    if (!storage || typeof storage.readVerifiedCommittedV2 !== 'function') {
      return abortBackup('Storage baseline reader is unavailable');
    }

    // 1. Build explicit live projection (Gate B1: no masking || {} fallbacks on evidence maps)
    var liveProjection = {
      schemaVersion: 2,
      lastSaved: new Date().toISOString(),
      jobs: state.jobs,
      roster: state.staffList,
      assignments: state.customAssignments,
      rostering: state.rostering,
      permits: state.customPermits,
      budgetSettings: state.budgetSettings,
      historicalSnapshots: state.historicalSnapshots,
      absences: Array.isArray(state.absences) ? state.absences : [],
      refusalHistory: Array.isArray(state.refusalHistory) ? state.refusalHistory : [],
      uiState: {
        activeView: state.activeView,
        currentYear: state.currentYear
      }
    };

    // 2. Validate live candidate before writing via canonical constructor (Gate B1 consolidation)
    if (!storage || typeof storage.createWorkspaceEnvelope !== 'function') {
      return abortBackup('Canonical workspace envelope constructor is unavailable');
    }
    var liveEnvelope;
    try {
      liveEnvelope = storage.createWorkspaceEnvelope(liveProjection);
    } catch (errEnvelope) {
      return abortBackup(errEnvelope.message || String(errEnvelope));
    }
    var liveCheck = { valid: true, data: liveEnvelope };

    // 3. Read previous verified committed baseline (R11-01)
    var previous = storage.readVerifiedCommittedV2();
    if (!previous || !previous.ok) {
      return abortBackup((previous && previous.error) || 'Committed baseline unreadable or invalid');
    }

    // 4. Mandatory evidence key retention check (Gate B1 consolidation)
    if (!validator || typeof validator.checkEvidenceKeyRetention !== 'function') {
      return abortBackup('Evidence key retention validator is unavailable');
    }
    if (previous.exists && previous.data) {
      var retained = validator.checkEvidenceKeyRetention(previous.data, liveCheck.data);
      if (!retained.valid) {
        return abortBackup(retained.error);
      }
    }

    // 5. Checked saveCurrentWorkspace call (R11-02)
    if (!window.HortOpsApp || typeof window.HortOpsApp.saveCurrentWorkspace !== 'function' ||
        window.HortOpsApp.saveCurrentWorkspace() !== true) {
      return abortBackup('Current workspace could not be saved; backup cancelled');
    }

    // 6. Re-read confirmed committed bytes and download
    var confirmed = storage.readVerifiedCommittedV2();
    if (!confirmed || !confirmed.ok || !confirmed.exists || !confirmed.raw) {
      return abortBackup('Newly committed backup could not be verified');
    }

    var year = state.currentYear || 2026;
    var filename = 'hort-ops-workspace-backup-' + year + '.json';
    this.downloadFile(confirmed.raw, filename, 'application/json');
    return true;
  },

  open: function() {
    if (window.HortOpsModalUtils) window.HortOpsModalUtils.lockBackgroundScroll();
    this.renderModal();
  },

  close: function() {
    var el = document.getElementById('export-modal-root');
    if (el) el.innerHTML = '';
    if (window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll();
  },

  renderModal: function() {
    var el = document.getElementById('export-modal-root');
    if (!el) return;
    var icons = window.HortOpsIcons;

    var modalHtml = '<div class="modal-overlay" onclick="if(event.target === this) window.HortOpsExportModal.close()">' +
      '<div class="modal-card modal-md">' +
        '<div class="modal-header">' +
          '<h2 style="font-size: 15px; font-weight: 800; color: var(--slate-900);">' +
            icons.render('download', 'w-4 h-4 text-emerald-700') + ' Export Operations Data (CSV & JSON)' +
          '</h2>' +
          '<button class="btn btn-secondary" style="padding: 0.25rem 0.4rem;" onclick="window.HortOpsExportModal.close()">' +
            icons.render('x', 'w-4 h-4') +
          '</button>' +
        '</div>' +

        '<div class="modal-body" style="display: flex; flex-direction: column; gap: 1rem;">' +
          '<div style="padding: 0.75rem; border: 1px solid var(--slate-200); border-radius: 6px; display: flex; align-items: center; justify-content: space-between; background: var(--emerald-50);">' +
            '<div>' +
              '<div style="font-weight: 700; font-size: 0.8rem; color: var(--emerald-900);">Full Workspace System Backup (JSON)</div>' +
              '<div style="font-size: 12px; color: var(--emerald-700);">Complete state backup (jobs, roster, custom assignments, permit statuses, budget).</div>' +
            '</div>' +
            '<button class="btn btn-primary" onclick="window.HortOpsExportModal.exportBackupJson()">' +
              icons.render('download', 'w-3 h-3') + ' Backup (JSON)' +
            '</button>' +
          '</div>' +

          '<div style="padding: 0.75rem; border: 1px solid var(--slate-200); border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">' +
            '<div>' +
              '<div style="font-weight: 700; font-size: 0.8rem;">Scheduled Shifts Roster (CSV)</div>' +
              '<div style="font-size: 12px; color: var(--slate-500);">All scheduled shifts with assigned staff, duration, and penalty multipliers.</div>' +
            '</div>' +
            '<button class="btn btn-primary" onclick="window.HortOpsExportModal.exportShifts()">' +
              icons.render('download', 'w-3 h-3') + ' Export Shifts' +
            '</button>' +
          '</div>' +

          '<div style="padding: 0.75rem; border: 1px solid var(--slate-200); border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">' +
            '<div>' +
              '<div style="font-weight: 700; font-size: 0.8rem;">Job Definitions Registry (CSV)</div>' +
              '<div style="font-size: 12px; color: var(--slate-500);">Job parameters, Primary/Secondary/Tertiary team preferences, and exclusive choices.</div>' +
            '</div>' +
            '<button class="btn btn-primary" onclick="window.HortOpsExportModal.exportJobs()">' +
              icons.render('download', 'w-3 h-3') + ' Export Jobs' +
            '</button>' +
          '</div>' +

          '<div style="padding: 0.75rem; border: 1px solid var(--slate-200); border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">' +
            '<div>' +
              '<div style="font-weight: 700; font-size: 0.8rem;">Workforce Master Directory (CSV)</div>' +
              '<div style="font-size: 12px; color: var(--slate-500);">Full staff listing with roles, plant tickets, and skill competencies.</div>' +
            '</div>' +
            '<button class="btn btn-primary" onclick="window.HortOpsExportModal.exportStaff()">' +
              icons.render('download', 'w-3 h-3') + ' Export Staff' +
            '</button>' +
          '</div>' +
        '</div>' +

        '<div class="modal-footer">' +
          '<button class="btn btn-secondary" onclick="window.HortOpsExportModal.close()">Close</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    el.innerHTML = modalHtml;
  },

  exportShifts: function() {
    var shifts = (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.allShifts) || [];
    var headers = ['ShiftID', 'JobID', 'JobName', 'Date', 'DayOfWeek', 'WeekNumber', 'StartTime', 'DurationHours', 'CrewSize', 'AssignedStaffCount', 'AssignedStaffIDs'];
    var rows = shifts.map(function(s) {
      var staffIds = (s.assignedStaffIds || []).join(';');
      return [
        s.shiftId,
        s.jobId,
        s.jobName,
        s.date,
        s.dayOfWeek,
        s.weekNumber,
        s.startTime,
        s.durationHours,
        s.crewSize,
        (s.assignedStaffIds || []).length,
        staffIds
      ];
    });

    var csv = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.serializeCsv) ?
      window.HortOpsSecurityUtils.serializeCsv(headers, rows) :
      (headers.join(',') + '\n' + rows.map(function(r) { return r.join(','); }).join('\n'));

    var year = (window.HortOpsApp && window.HortOpsApp.state) ? window.HortOpsApp.state.currentYear : 2026;
    this.downloadCsv('Hort_Ops_Shifts_' + year + '.csv', csv);
  },

  exportJobs: function() {
    var jobs = (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.jobs) || [];
    var headers = ['ID', 'Name', 'Category', 'FrequencyType', 'IntervalWeeks', 'AnchorDate', 'PrimaryTeam', 'SecondaryTeam', 'TertiaryTeam', 'IsExclusive', 'ExclusiveTeams', 'CrewSize', 'DurationHours', 'StartTime', 'Status', 'TeamSuitabilityEnabled', 'PoolsEnabled', 'TargetDate', 'AnnualRule', 'SeasonalRule', 'WorkPattern', 'ScheduleEnd'];
    var rows = jobs.map(function(j) {
      var excl = (j.exclusiveTeams || []).join(';');
      return [
        j.id,
        j.name,
        j.category,
        j.frequencyType,
        j.intervalWeeks || '',
        j.anchorDate || '',
        j.primaryTeam || j.defaultTeam || '',
        j.secondaryTeam || '',
        j.tertiaryTeam || '',
        j.isExclusiveTeams ? 'YES' : 'NO',
        excl,
        j.crewSize,
        j.durationHours,
        j.startTime,
        j.status,
        !window.HortOpsPlanningRules || window.HortOpsPlanningRules.sectionEnabled(j, 'teams') ? 'YES' : 'NO',
      !window.HortOpsPlanningRules || window.HortOpsPlanningRules.sectionEnabled(j, 'pools') ? 'YES' : 'NO',
      j.targetDate || '',
      JSON.stringify(j.annualRule || null),
      JSON.stringify(j.seasonalRule || null),
      JSON.stringify(j.workPattern || null),
      JSON.stringify(j.scheduleEnd || null)
      ];
    });

    var csv = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.serializeCsv) ?
      window.HortOpsSecurityUtils.serializeCsv(headers, rows) :
      (headers.join(',') + '\n' + rows.map(function(r) { return r.join(','); }).join('\n'));

    this.downloadCsv('Hort_Ops_Jobs.csv', csv);
  },

  exportStaff: function() {
    var staff = (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.staffList) || [];
    var headers = ['ID', 'Title', 'UserType', 'Email', 'Department', 'Team', 'Crew', 'JobTitle', 'Role', 'IsContractor', 'IsPlantOperator', 'Status', 'YTDOvertimeHours'];
    var rows = staff.map(function(s) {
      return [
        s.id,
        s.title || s.name,
        s.userType || 'App',
        s.email || '',
        s.department || '',
        s.team || '',
        s.crew || '',
        s.jobTitle || '',
        s.role || '',
        s.isContractor ? 'TRUE' : 'FALSE',
        s.isPlantOperator ? 'TRUE' : 'FALSE',
        s.status || 'active',
        s.ytdOvertimeHours || (s.overtimeStats ? s.overtimeStats.hoursYTD : 0)
      ];
    });

    var csv = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.serializeCsv) ?
      window.HortOpsSecurityUtils.serializeCsv(headers, rows) :
      (headers.join(',') + '\n' + rows.map(function(r) { return r.join(','); }).join('\n'));

    this.downloadCsv('Hort_Ops_Workforce.csv', csv);
  }
};
