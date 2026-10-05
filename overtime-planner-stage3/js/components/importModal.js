// CSV Import & Accretive Workforce Synchronization / JSON Workspace Restore Modal Component (Mandate Sections 2.3, 5)
// 100% Offline, Zero Server, RFC-4180 Compliant with Interactive Reconciliation Diff Preview and Atomic JSON Restore.

window.HortOpsImportModal = {
  currentDiff: null,
  pendingJsonBackup: null,
  isJsonMode: false,
  activeTab: 'overview',
  fileName: '',

  open: function() {
    this.currentDiff = null;
    this.pendingJsonBackup = null;
    this.isJsonMode = false;
    this.activeTab = 'overview';
    this.fileName = '';
    if (window.HortOpsModalUtils) window.HortOpsModalUtils.lockBackgroundScroll();
    this.renderModal();
  },

  close: function() {
    this.currentDiff = null;
    this.pendingJsonBackup = null;
    this.isJsonMode = false;
    var el = document.getElementById('import-modal-root');
    if (el) el.innerHTML = '';
    if (window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll();
  },

  renderModal: function() {
    var el = document.getElementById('import-modal-root');
    if (!el) return;
    var icons = window.HortOpsIcons;
    var diff = this.currentDiff;
    var jsonBackup = this.pendingJsonBackup;

    var modalHtml = '<div class="modal-overlay" onclick="if(event.target === this) window.HortOpsImportModal.close()">' +
      '<div class="modal-card modal-lg" style="max-width: 850px; max-height: 90vh; display: flex; flex-direction: column;">' +
        // Header
        '<div class="modal-header">' +
          '<div>' +
            '<h2 style="font-size: 16px; font-weight: 800; color: var(--slate-900); display: flex; align-items: center; gap: 0.5rem;">' +
              (this.isJsonMode ? (icons.render('download', 'w-5 h-5 text-emerald-700') + ' Restore Full Workspace (JSON)') : (icons.render('users', 'w-5 h-5 text-emerald-700') + ' Accretive Workforce Synchronization (users.csv)')) +
            '</h2>' +
            '<p style="font-size: 12px; color: var(--slate-500); margin: 0.15rem 0 0 0;">' +
              (this.isJsonMode ? 'Atomically restores all jobs, workforce directory, shift assignments, and permit states.' : 'Non-destructive 3-way reconciliation: preserves historical actuals, audits departed personnel, and protects local overtime preferences.') +
            '</p>' +
          '</div>' +
          '<button class="btn btn-secondary" style="padding: 0.25rem 0.4rem;" onclick="window.HortOpsImportModal.close()">' +
            icons.render('x', 'w-4 h-4') +
          '</button>' +
        '</div>' +

        // Body
        '<div class="modal-body" style="overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem;">' +
          // Operational Banner
          '<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.75rem 1rem; display: flex; gap: 0.6rem; align-items: flex-start;">' +
            '<div style="color: #16a34a; flex-shrink: 0; margin-top: 1px;">' + icons.render('check', 'w-4 h-4') + '</div>' +
            '<div style="font-size: 12px; color: #166534; line-height: 1.45;">' +
              (this.isJsonMode ?
                '<strong>Complete Workspace Envelope:</strong> Restoring this JSON file will re-hydrate jobs, roster, custom shift allocations, permit notes, and settings atomically.' :
                '<strong>Historical Integrity Invariant:</strong> Synchronizing a fresh user table will <strong>never erase past overtime records</strong>. Missing staff are marked <em>Departed</em> so past shift rosters remain auditable, while future shifts are vacated for dispatcher reassignment.') +
            '</div>' +
          '</div>' +

          // Upload Dropzone
          '<div style="border: 2px dashed ' + (diff || jsonBackup ? 'var(--emerald-400)' : 'var(--slate-300)') + '; border-radius: 8px; padding: 1.25rem; text-align: center; background: ' + (diff || jsonBackup ? 'var(--emerald-50)' : 'var(--slate-50)') + '; cursor: pointer;" onclick="document.getElementById(\'staff-csv-file-input\').click()">' +
            '<input type="file" id="staff-csv-file-input" accept=".csv,.json" style="display: none;" onchange="window.HortOpsImportModal.handleFileSelect(event)" />' +
            '<div style="margin-bottom: 0.4rem; color: var(--emerald-700);">' + icons.render('upload', 'w-6 h-6') + '</div>' +
            '<div style="font-size: 13px; font-weight: 700; color: var(--slate-800);">' +
              (this.fileName ? this.fileName : 'Click to select or drop users.csv or workspace.json backup') +
            '</div>' +
            '<div style="font-size: 11px; color: var(--slate-500); margin-top: 0.2rem;">' +
              'Supported formats: .CSV (authoritative workforce table) or .JSON (full workspace system backup)' +
            '</div>' +
          '</div>' +

          // Error Area
          '<div id="import-error-area" style="display: none; background: var(--rose-50); border: 1px solid var(--rose-200); border-radius: 6px; padding: 0.75rem 1rem; font-size: 12px; color: var(--rose-700);"></div>' +

          // Previews
          (this.isJsonMode && jsonBackup ? this.renderJsonPreviewHtml(jsonBackup) : (diff ? this.renderDiffPreviewHtml(diff) : '')) +
        '</div>' +

        // Footer
        '<div class="modal-footer" style="display: flex; justify-content: space-between; align-items: center;">' +
          '<button class="btn btn-secondary" onclick="window.HortOpsImportModal.close()">Cancel</button>' +
          (this.isJsonMode && jsonBackup ?
            '<button class="btn btn-primary" style="background: #059669; border-color: #047857; font-weight: 700; padding: 0.45rem 1rem; display: inline-flex; align-items: center; gap: 0.4rem;" onclick="window.HortOpsImportModal.confirmJsonRestore()">' +
              icons.render('check', 'w-4 h-4') + ' Confirm & Restore Workspace' +
            '</button>' :
            (diff ?
              '<button class="btn btn-primary" style="background: #059669; border-color: #047857; font-weight: 700; padding: 0.45rem 1rem; display: inline-flex; align-items: center; gap: 0.4rem;" onclick="window.HortOpsImportModal.confirmSync()">' +
                icons.render('check', 'w-4 h-4') + ' Confirm & Synchronize Workforce' +
              '</button>' : '')) +
        '</div>' +
      '</div>' +
    '</div>';

    el.innerHTML = modalHtml;
  },

  renderJsonPreviewHtml: function(backup) {
    var jobsCount = Array.isArray(backup.jobs) ? backup.jobs.length : 0;
    var rosterCount = Array.isArray(backup.roster) ? backup.roster.length : 0;
    var assignmentsCount = backup.assignments ? Object.keys(backup.assignments).length : 0;
    var permitsCount = backup.permits ? Object.keys(backup.permits).length : 0;
    var lastSaved = backup.lastSaved ? new Date(backup.lastSaved).toLocaleString() : 'Unknown';

    return '<div style="display: flex; flex-direction: column; gap: 1rem;">' +
      '<div style="font-weight: 700; font-size: 13px; color: var(--slate-800);">Workspace Backup Content Summary</div>' +
      '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;">' +
        '<div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 0.6rem 0.8rem;">' +
          '<div style="font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase;">Jobs</div>' +
          '<div style="font-size: 20px; font-weight: 800; color: #065f46;">' + jobsCount + '</div>' +
          '<div style="font-size: 11px; color: #047857;">Defined operations</div>' +
        '</div>' +
        '<div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 0.6rem 0.8rem;">' +
          '<div style="font-size: 11px; font-weight: 700; color: #0369a1; text-transform: uppercase;">Workforce</div>' +
          '<div style="font-size: 20px; font-weight: 800; color: #0c4a6e;">' + rosterCount + '</div>' +
          '<div style="font-size: 11px; color: #0369a1;">Depot personnel</div>' +
        '</div>' +
        '<div style="background: #fdf4ff; border: 1px solid #f0abfc; border-radius: 6px; padding: 0.6rem 0.8rem;">' +
          '<div style="font-size: 11px; font-weight: 700; color: #86198f; text-transform: uppercase;">Assignments</div>' +
          '<div style="font-size: 20px; font-weight: 800; color: #701a75;">' + assignmentsCount + '</div>' +
          '<div style="font-size: 11px; color: #86198f;">Shift rosters</div>' +
        '</div>' +
        '<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 0.6rem 0.8rem;">' +
          '<div style="font-size: 11px; font-weight: 700; color: #b45309; text-transform: uppercase;">Permits</div>' +
          '<div style="font-size: 20px; font-weight: 800; color: #78350f;">' + permitsCount + '</div>' +
          '<div style="font-size: 11px; color: #b45309;">WZTM / TPO records</div>' +
        '</div>' +
      '</div>' +
      '<div style="font-size: 12px; color: var(--slate-600); background: var(--slate-100); padding: 0.6rem 0.8rem; border-radius: 6px;">' +
        '<strong>Backup Timestamp:</strong> ' + lastSaved + ' | <strong>Schema Version:</strong> ' + (this.backupSourceVersion ? this.backupSourceVersion + (this.backupMigrated ? ' (Migrated to v2)' : '') : (backup.schemaVersion || 2)) +
      '</div>' +
    '</div>';
  },

  renderDiffPreviewHtml: function(diff) {
    var icons = window.HortOpsIcons;
    var tab = this.activeTab;

    var statCardsHtml = '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem;">' +
      '<div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 0.6rem 0.8rem;">' +
        '<div style="font-size: 11px; font-weight: 700; color: #047857; text-transform: uppercase;">Added</div>' +
        '<div style="font-size: 20px; font-weight: 800; color: #065f46;">+' + diff.added.length + '</div>' +
        '<div style="font-size: 11px; color: #047857;">New depot staff</div>' +
      '</div>' +
      '<div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 0.6rem 0.8rem;">' +
        '<div style="font-size: 11px; font-weight: 700; color: #0369a1; text-transform: uppercase;">Updated</div>' +
        '<div style="font-size: 20px; font-weight: 800; color: #0c4a6e;">' + diff.updated.length + '</div>' +
        '<div style="font-size: 11px; color: #0369a1;">Role / status changes</div>' +
      '</div>' +
      '<div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 0.6rem 0.8rem;">' +
        '<div style="font-size: 11px; font-weight: 700; color: #be123c; text-transform: uppercase;">Departed</div>' +
        '<div style="font-size: 20px; font-weight: 800; color: #881337;">' + diff.departed.length + '</div>' +
        '<div style="font-size: 11px; color: #be123c;">Missing from file</div>' +
      '</div>' +
      '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.6rem 0.8rem;">' +
        '<div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Unchanged</div>' +
        '<div style="font-size: 20px; font-weight: 800; color: #1e293b;">' + diff.unchanged.length + '</div>' +
        '<div style="font-size: 11px; color: #64748b;">Identical active records</div>' +
      '</div>' +
    '</div>';

    var vacatedNoticeHtml = '';
    if (diff.vacatedFutureAssignments && diff.vacatedFutureAssignments.length > 0) {
      vacatedNoticeHtml = '<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 0.6rem 0.8rem; font-size: 12px; color: #92400e; display: flex; align-items: center; gap: 0.5rem;">' +
        icons.render('alertTriangle', 'w-4 h-4 text-amber-600') +
        '<span><strong>' + diff.vacatedFutureAssignments.length + ' future shift assignment(s)</strong> held by departed staff will be vacated for immediate dispatcher reassignment.</span>' +
      '</div>';
    }

    var tabsHtml = '<div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--slate-200); padding-bottom: 0.5rem; margin-top: 0.5rem;">' +
      '<button class="btn ' + (tab === 'overview' ? 'btn-primary' : 'btn-secondary') + '" style="padding: 0.3rem 0.75rem; font-size: 12px;" onclick="window.HortOpsImportModal.setTab(\'overview\')">Summary</button>' +
      '<button class="btn ' + (tab === 'added' ? 'btn-primary' : 'btn-secondary') + '" style="padding: 0.3rem 0.75rem; font-size: 12px;" onclick="window.HortOpsImportModal.setTab(\'added\')">New Starters (' + diff.added.length + ')</button>' +
      '<button class="btn ' + (tab === 'updated' ? 'btn-primary' : 'btn-secondary') + '" style="padding: 0.3rem 0.75rem; font-size: 12px;" onclick="window.HortOpsImportModal.setTab(\'updated\')">Modifications (' + diff.updated.length + ')</button>' +
      '<button class="btn ' + (tab === 'departed' ? 'btn-primary' : 'btn-secondary') + '" style="padding: 0.3rem 0.75rem; font-size: 12px;" onclick="window.HortOpsImportModal.setTab(\'departed\')">Departures (' + diff.departed.length + ')</button>' +
    '</div>';

    var tabContentHtml = '';
    if (tab === 'overview') {
      tabContentHtml = '<div style="font-size: 12px; color: var(--slate-600); line-height: 1.5;">' +
        '<p style="margin: 0 0 0.5rem 0;">Review the preview categories above. Applying this synchronization will update the operational staff directory while retaining all historical overtime allocations and local exemption rules.</p>' +
      '</div>';
    } else if (tab === 'added') {
      tabContentHtml = this.renderStaffTable(diff.added, 'green');
    } else if (tab === 'updated') {
      tabContentHtml = this.renderUpdatedTable(diff.updated);
    } else if (tab === 'departed') {
      tabContentHtml = this.renderStaffTable(diff.departed, 'red');
    }

    return '<div style="display: flex; flex-direction: column; gap: 0.75rem;">' +
      statCardsHtml +
      vacatedNoticeHtml +
      tabsHtml +
      '<div style="max-height: 250px; overflow-y: auto;">' + tabContentHtml + '</div>' +
    '</div>';
  },

  renderStaffTable: function(staffList, themeColor) {
    if (!staffList || staffList.length === 0) {
      return '<div style="text-align: center; color: var(--slate-400); font-size: 12px; padding: 1rem;">No records in this category.</div>';
    }
    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s; };
    var rows = staffList.map(function(s) {
      return '<tr style="border-bottom: 1px solid var(--slate-100); font-size: 12px;">' +
        '<td style="padding: 0.4rem; font-weight: 600;">' + esc(s.name) + '</td>' +
        '<td style="padding: 0.4rem;">' + esc(s.email || '—') + '</td>' +
        '<td style="padding: 0.4rem;">' + esc(s.department) + '</td>' +
        '<td style="padding: 0.4rem;">' + esc(s.team) + '</td>' +
        '<td style="padding: 0.4rem;">' + esc(s.role) + '</td>' +
      '</tr>';
    }).join('');

    return '<table style="width: 100%; border-collapse: collapse;">' +
      '<thead><tr style="background: var(--slate-50); font-size: 11px; text-transform: uppercase; color: var(--slate-600); text-align: left;"><th style="padding: 0.4rem;">Name</th><th style="padding: 0.4rem;">Email</th><th style="padding: 0.4rem;">Department</th><th style="padding: 0.4rem;">Team</th><th style="padding: 0.4rem;">Role</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';
  },

  renderUpdatedTable: function(updatedList) {
    if (!updatedList || updatedList.length === 0) {
      return '<div style="text-align: center; color: var(--slate-400); font-size: 12px; padding: 1rem;">No updated records.</div>';
    }
    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s; };
    var rows = updatedList.map(function(u) {
      var s = u.staff;
      var changes = u.changedFields.map(function(f) {
        return '<strong>' + esc(f) + ':</strong> ' + esc(u.previousValues[f]) + ' &rarr; ' + esc(s[f]);
      }).join(', ');

      return '<tr style="border-bottom: 1px solid var(--slate-100); font-size: 12px;">' +
        '<td style="padding: 0.4rem; font-weight: 600;">' + esc(s.name) + '</td>' +
        '<td style="padding: 0.4rem;">' + esc(s.team) + '</td>' +
        '<td style="padding: 0.4rem; color: #0369a1;">' + changes + '</td>' +
      '</tr>';
    }).join('');

    return '<table style="width: 100%; border-collapse: collapse;">' +
      '<thead><tr style="background: var(--slate-50); font-size: 11px; text-transform: uppercase; color: var(--slate-600); text-align: left;"><th style="padding: 0.4rem;">Name</th><th style="padding: 0.4rem;">Team</th><th style="padding: 0.4rem;">Changed Attributes</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
    '</table>';
  },

  setTab: function(tab) {
    this.activeTab = tab;
    this.renderModal();
  },

  handleFileSelect: function(e) {
    var file = e.target.files[0];
    if (!file) return;

    this.fileName = file.name + ' (' + Math.round(file.size / 1024) + ' KB)';
    var self = this;

    var reader = new FileReader();
    var writerGeneration = window.HortOpsWriterSession && window.HortOpsWriterSession.status().generation;
    if (file.name.toLowerCase().endsWith('.json')) {
      this.isJsonMode = true;
      reader.onload = function(evt) {
        if (window.HortOpsWriterSession && (!window.HortOpsWriterSession.canWrite() || window.HortOpsWriterSession.status().generation !== writerGeneration)) return;
        self.processJsonContent(evt.target.result);
      };
      reader.readAsText(file);
    } else {
      this.isJsonMode = false;
      reader.onload = function(evt) {
        if (window.HortOpsWriterSession && (!window.HortOpsWriterSession.canWrite() || window.HortOpsWriterSession.status().generation !== writerGeneration)) return;
        self.processCsvContent(evt.target.result);
      };
      reader.readAsText(file);
    }
  },

  processJsonContent: function(jsonText) {
    var errEl = document.getElementById('import-error-area');
    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s || ''; };
    try {
      // Canonical JSON import preparation pipeline (Mandate Pass 10, Section 14)
      if (window.HortOpsStorage && window.HortOpsStorage.prepareWorkspaceJsonImport) {
        var prepRes = window.HortOpsStorage.prepareWorkspaceJsonImport(jsonText);
        if (!prepRes.success) {
          throw new Error(prepRes.error);
        }
        if (errEl) errEl.style.display = 'none';
        this.pendingJsonBackup = prepRes.data;
        this.backupMigrated = prepRes.migrated;
        this.backupSourceVersion = prepRes.sourceSchemaVersion;
        this.currentDiff = null;
        this.renderModal();
        return;
      }

      var parsed = JSON.parse(jsonText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Workspace backup root must be a valid JSON object.');
      }
      var sourceVersion = parsed.schemaVersion;
      if (sourceVersion === undefined || sourceVersion === null || typeof sourceVersion !== 'number' || !Number.isInteger(sourceVersion)) {
        throw new Error('Workspace backup missing or invalid integer schemaVersion: ' + sourceVersion);
      }
      if (sourceVersion !== 1 && sourceVersion !== 2) {
        throw new Error('Unsupported workspace schema version ' + sourceVersion + '. This version of the planner supports Schema 1 and Schema 2 only.');
      }
      if (sourceVersion === 1 && window.HortOpsStorage && window.HortOpsStorage.migrateWorkspaceV1toV2) {
        parsed = window.HortOpsStorage.migrateWorkspaceV1toV2(parsed);
      }
      if (window.HortOpsStorage && window.HortOpsStorage.validateWorkspaceSchema) {
        var valRes = window.HortOpsStorage.validateWorkspaceSchema(parsed);
        if (!valRes.valid) throw new Error(valRes.error);
      }
      if (errEl) errEl.style.display = 'none';
      this.pendingJsonBackup = parsed;
      this.backupMigrated = (sourceVersion === 1);
      this.backupSourceVersion = sourceVersion;
      this.currentDiff = null;
      this.renderModal();
    } catch(e) {
      this.pendingJsonBackup = null;
      if (errEl) {
        errEl.style.display = 'block';
        errEl.innerHTML = '<strong>JSON Backup Error:</strong><br/>' + esc(e.message || String(e));
      }
      this.renderModal();
    }
  },

  processCsvContent: function(csvText) {
    var currentRoster = window.HortOpsApp.state.staffList || [];
    var customAssignments = window.HortOpsApp.state.customAssignments || {};
    var allShifts = window.HortOpsApp.state.allShifts || [];

    var parsedResult = window.HortOpsUserCsvParser.parseUserCsv(csvText, currentRoster);

    var errEl = document.getElementById('import-error-area');
    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s || ''; };
    if (!parsedResult.success) {
      if (errEl) {
        errEl.style.display = 'block';
        errEl.innerHTML = '<strong>Parsing Errors:</strong><br/>' + (parsedResult.errors || []).map(esc).join('<br/>');
      }
      this.currentDiff = null;
      this.pendingJsonBackup = null;
    this.renderModal();
      return;
    }

    if (errEl) errEl.style.display = 'none';

    var diff = window.HortOpsReconciliationEngine.computeWorkforceReconciliation(
      currentRoster,
      parsedResult.staff,
      customAssignments,
      allShifts
    );

    this.currentDiff = diff;
    this.pendingJsonBackup = null;
    this.activeTab = 'overview';
    this.renderModal();
  },

  confirmSync: function() {
    if (!this.currentDiff) return;
    var res = window.HortOpsApp.reconcileStaffSnapshot(this.currentDiff);
    if (res && !res.success) {
      alert('Workforce synchronization failed: ' + (res.error || 'Storage error. Roster unchanged.'));
      return;
    }
    var added = this.currentDiff.added.length;
    var updated = this.currentDiff.updated.length;
    var departed = this.currentDiff.departed.length;
    this.close();
    alert('Workforce synchronized successfully:\n' +
      '+ ' + added + ' added\n' +
      '* ' + updated + ' updated\n' +
      '- ' + departed + ' marked departed');
  },

  confirmJsonRestore: function() {
    if (!this.pendingJsonBackup) return;
    if (!window.confirm("Warning: Restoring this JSON workspace backup will replace your current jobs, personnel roster, shift assignments, and permit states. Are you sure you want to proceed?")) {
      return;
    }
    var success = window.HortOpsApp.restoreWorkspaceJson(this.pendingJsonBackup);
    this.close();
    if (success) {
      alert('Workspace successfully restored from backup.');
    } else {
      alert('Error: Failed to restore workspace. Storage persistence failed or state is invalid.');
    }
  }
};
