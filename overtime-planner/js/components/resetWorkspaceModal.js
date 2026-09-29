// Confirmed Destructive Workspace Reset Modal Component (Stage 2 Mandate)
// Requires explicit two-step typed confirmation ('RESET') to wipe persistent local storage and re-initialize clean slate.

window.HortOpsResetWorkspaceModal = {
  open: function() {
    if (window.HortOpsModalUtils && typeof window.HortOpsModalUtils.lockBackgroundScroll === 'function') {
      window.HortOpsModalUtils.lockBackgroundScroll();
    }
    this.renderModal();
  },

  close: function() {
    var el = document.getElementById('reset-workspace-modal-root');
    if (el) el.innerHTML = '';
    if (window.HortOpsModalUtils && typeof window.HortOpsModalUtils.unlockBackgroundScroll === 'function') {
      window.HortOpsModalUtils.unlockBackgroundScroll();
    }
  },

  handleInput: function(val) {
    var btn = document.getElementById('btn-confirm-destructive-reset');
    if (!btn) return;
    var isConfirmed = String(val || '') === 'RESET';
    btn.disabled = !isConfirmed;
    if (isConfirmed) {
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.backgroundColor = '#dc2626';
    } else {
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.style.backgroundColor = '#ef4444';
    }
  },

  exportEmergencyBackup: function() {
    var raw = '';
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        raw = window.sessionStorage.getItem('hort_ops_emergency_recovery_v2') || '';
      }
    } catch(e) {}
    if (!raw && window.HortOpsApp && typeof window.HortOpsApp.exportWorkspaceJson === 'function') {
      raw = window.HortOpsApp.exportWorkspaceJson();
    }
    if (!raw) {
      alert('No emergency backup data found.');
      return;
    }
    try {
      var blob = new Blob([raw], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'hort_ops_emergency_recovery_' + (new Date()).toISOString().replace(/[:.]/g, '-') + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch(err) {
      console.error('Export emergency backup failed:', err);
      alert('Export failed. Raw payload:\n' + raw.slice(0, 500));
    }
  },

  executeReset: function() {
    var input = document.getElementById('input-confirm-reset');
    var val = input ? input.value : '';
    if (String(val || '') !== 'RESET') {
      alert('Confirmation word mismatch. Please type RESET in all caps to confirm.');
      return;
    }

    var app = window.HortOpsApp;
    var success = false;
    if (app && typeof app.resetToCleanSlate === 'function') {
      success = app.resetToCleanSlate();
    }

    if (!success) {
      var errorBanner = document.getElementById('reset-modal-error-banner');
      var details = (app && app.state && app.state.lastResetDetails) ? app.state.lastResetDetails : null;
      var msg = '';
      if (details && details.rolledBack) {
        msg = '<div style="font-weight: 700; color: #b91c1c; margin-bottom: 4px;">Reset Aborted & Durably Rolled Back</div>' +
              '<div style="font-size: 12px; color: #7f1d1d; line-height: 1.4;">' +
              'Persistent deletion failed on item <code>' + (details.failedKey || 'storage') + '</code>. ' +
              'Compensating rollback successfully restored all persistent keys to localStorage. ' +
              'Your pre-reset workspace is durably intact and will survive a page reload.' +
              '</div>';
      } else if (details && details.unrecoveredKeys && details.unrecoveredKeys.length > 0) {
        msg = '<div style="font-weight: 700; color: #b91c1c; margin-bottom: 4px;">Emergency: Partial Reset Failure</div>' +
              '<div style="font-size: 12px; color: #7f1d1d; line-height: 1.4;">' +
              'Deletion failed and compensating rollback could not restore keys: <code>' + details.unrecoveredKeys.join(', ') + '</code>. ' +
              'To prevent data loss, please export your emergency backup before closing this tab.' +
              '</div>' +
              '<div style="margin-top: 8px;">' +
              '<button type="button" class="btn btn-secondary" style="font-size: 12px; padding: 4px 8px;" onclick="window.HortOpsResetWorkspaceModal.exportEmergencyBackup()">Export Emergency Backup</button>' +
              '</div>';
      } else {
        msg = '<div style="font-weight: 700; color: #b91c1c;">Storage reset failed</div>' +
              '<div style="font-size: 12px; color: #7f1d1d;">Persistent storage could not be wiped. Your live data has been preserved.</div>';
      }

      if (errorBanner) {
        errorBanner.style.display = 'block';
        errorBanner.innerHTML = msg;
      } else {
        alert('Storage reset failed. Your data has been preserved.');
      }
      return; // Suppress reload and keep modal open on failure (Review 37 R37-01, Review 38 R38-01)
    }

    this.close();

    // Reload page if running in a standard browser environment to guarantee full clean state
    if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
      window.location.reload();
    } else {
      alert('Workspace reset complete. All localStorage data purged and clean slate initialized.');
    }
  },

  renderModal: function() {
    var el = document.getElementById('reset-workspace-modal-root');
    if (!el) return;

    var icons = window.HortOpsIcons;

    var modalHtml = '<div class="modal-overlay" onclick="if(event.target === this) window.HortOpsResetWorkspaceModal.close()">' +
      '<div class="modal-card modal-md" id="modal-reset-workspace" role="dialog" aria-modal="true" aria-labelledby="reset-modal-title" style="max-width: 620px; display: flex; flex-direction: column;">' +
        // Modal Header
        '<div class="modal-header" style="background: #fff1f2; border-bottom: 1px solid #fecdd3; padding: 1rem 1.25rem;">' +
          '<div style="display: flex; align-items: center; gap: 0.6rem;">' +
            '<span style="display: inline-flex; padding: 6px; border-radius: 8px; background: #ffe4e6; color: #e11d48;">' +
              icons.render('alertTriangle', 'w-5 h-5') +
            '</span>' +
            '<div>' +
              '<h3 id="reset-modal-title" style="margin: 0; font-size: 16px; font-weight: 700; color: #9f1239;">Confirmed Destructive Reset</h3>' +
              '<div style="font-size: 12px; color: #be123c;">Permanent workspace wipe & clean-slate initialization</div>' +
            '</div>' +
          '</div>' +
          '<button class="modal-close-btn" onclick="window.HortOpsResetWorkspaceModal.close()" aria-label="Close modal">' +
            icons.render('x', 'w-4 h-4') +
          '</button>' +
        '</div>' +

        // Modal Body
        '<div class="modal-body" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">' +
          '<div id="reset-modal-error-banner" style="display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 0.75rem 1rem; font-size: 13px; color: #dc2626; font-weight: 600;"></div>' +
          '<div style="background: #fff5f5; border: 1px solid #fed7d7; border-radius: 6px; padding: 0.85rem 1rem; font-size: 13px; color: #c53030; line-height: 1.5;">' +
            '<strong>Warning: This action cannot be undone.</strong> Executing a destructive reset permanently purges all saved client data from this browser\'s <code>localStorage</code>, including:' +
            '<ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; font-size: 12px; color: #9b2c2c;">' +
              '<li>All active and archived Jobs, recurrence rules, and operational definitions</li>' +
              '<li>All staff personnel records, team memberships, and custom shift assignments</li>' +
              '<li>All rostering instructions and candidate rotation provenance history</li>' +
              '<li>All compliance permits, TPO exemptions, and budget configuration targets</li>' +
              '<li>All authoritative historical scheduled-commitment snapshots</li>' +
              '<li>All legacy and current <code>hort_ops_*</code> storage keys and cached digests</li>' +
            '</ul>' +
          '</div>' +

          '<div style="font-size: 13px; color: var(--slate-700); line-height: 1.5;">' +
            'After reset, the client will immediately return to a verified clean-slate state (0 Jobs, 0 Personnel, clean defaults) ready for a fresh configuration or JSON backup restore.' +
          '</div>' +

          '<div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px; padding: 1rem;">' +
            '<label for="input-confirm-reset" style="display: block; font-size: 12px; font-weight: 700; color: var(--slate-800); margin-bottom: 0.5rem;">' +
              'To confirm destructive reset, type <span style="font-family: monospace; background: #fee2e2; color: #b91c1c; padding: 2px 6px; border-radius: 4px; font-weight: 800;">RESET</span> below:' +
            '</label>' +
            '<input type="text" id="input-confirm-reset" class="form-input" placeholder="Type RESET to confirm" autocomplete="off" style="font-family: monospace; font-size: 14px; text-transform: uppercase;" oninput="window.HortOpsResetWorkspaceModal.handleInput(this.value)" />' +
          '</div>' +
        '</div>' +

        // Modal Footer
        '<div class="modal-footer" style="padding: 1rem 1.25rem; background: var(--slate-50); border-top: 1px solid var(--slate-200); display: flex; justify-content: flex-end; gap: 0.75rem;">' +
          '<button type="button" class="btn btn-secondary" onclick="window.HortOpsResetWorkspaceModal.close()">' +
            'Cancel' +
          '</button>' +
          '<button type="button" id="btn-confirm-destructive-reset" class="btn" disabled style="background: #ef4444; color: #ffffff; font-weight: 700; opacity: 0.5; cursor: not-allowed; transition: all 0.15s ease;" onclick="window.HortOpsResetWorkspaceModal.executeReset()">' +
            icons.render('trash', 'w-4 h-4') +
            '<span style="margin-left: 6px;">Permanently Reset Workspace</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    el.innerHTML = modalHtml;

    setTimeout(function() {
      var input = document.getElementById('input-confirm-reset');
      if (input) input.focus();
    }, 50);
  }
};
