// Corrupted Workspace Quarantine Viewer Modal Component (Stage 2 Mandate)
// Allows operators to inspect, export, or safely discard unparseable quarantined workspace data when recoveryRequired is true.

window.HortOpsQuarantineModal = {
  feedbackMessage: '',

  open: function() {
    this.feedbackMessage = '';
    if (window.HortOpsModalUtils && typeof window.HortOpsModalUtils.lockBackgroundScroll === 'function') {
      window.HortOpsModalUtils.lockBackgroundScroll();
    }
    this.renderModal();
  },

  close: function() {
    this.feedbackMessage = '';
    var el = document.getElementById('quarantine-viewer-modal-root');
    if (el) el.innerHTML = '';
    if (window.HortOpsModalUtils && typeof window.HortOpsModalUtils.unlockBackgroundScroll === 'function') {
      window.HortOpsModalUtils.unlockBackgroundScroll();
    }
  },

  copyQuarantinePayload: function() {
    var box = document.getElementById('quarantine-payload-box');
    if (box) {
      box.select();
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(box.value);
        } else {
          document.execCommand('copy');
        }
        this.feedbackMessage = 'Quarantine payload copied to clipboard.';
      } catch(e) {
        this.feedbackMessage = 'Copy failed. Please copy manually from the box below.';
      }
      this.renderModal();
    }
  },

  exportQuarantineFile: function() {
    var storage = window.HortOpsStorage;
    var raw = (storage && typeof storage.getRawQuarantinePayload === 'function')
      ? storage.getRawQuarantinePayload()
      : '';
    if (!raw) {
      alert('No raw quarantine payload available to export.');
      return;
    }

    try {
      var blob = new Blob([raw], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'hort_ops_corrupted_quarantine_backup_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.feedbackMessage = 'Quarantine backup file successfully exported.';
      this.renderModal();
    } catch(e) {
      alert('Failed to export quarantine file: ' + (e.message || String(e)));
    }
  },

  openResetModal: function() {
    this.close();
    if (window.HortOpsApp && typeof window.HortOpsApp.openResetWorkspaceModal === 'function') {
      window.HortOpsApp.openResetWorkspaceModal();
    }
  },

  openRestoreModal: function() {
    this.close();
    if (window.HortOpsApp && typeof window.HortOpsApp.openImportModal === 'function') {
      window.HortOpsApp.openImportModal();
    }
  },

  renderModal: function() {
    var el = document.getElementById('quarantine-viewer-modal-root');
    if (!el) return;

    var state = (window.HortOpsApp && window.HortOpsApp.state) ? window.HortOpsApp.state : {};
    var storage = window.HortOpsStorage;
    var rawPayload = (storage && typeof storage.getRawQuarantinePayload === 'function')
      ? storage.getRawQuarantinePayload()
      : '';

    var icons = window.HortOpsIcons;
    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml)
      ? window.HortOpsSecurityUtils.escapeHtml
      : function(s) { return String(s || ''); };

    var sourceStr = state.recoverySource || 'hort_ops_workspace_v2';
    var errorStr = state.recoveryError || 'Unparseable or schema-invalid workspace envelope';

    var feedbackHtml = '';
    if (this.feedbackMessage) {
      feedbackHtml = '<div style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 0.6rem 0.85rem; border-radius: 6px; font-size: 12px; margin-bottom: 0.75rem;">' +
        esc(this.feedbackMessage) +
      '</div>';
    }

    var modalHtml = '<div class="modal-overlay" onclick="if(event.target === this) window.HortOpsQuarantineModal.close()">' +
      '<div class="modal-card modal-lg" role="dialog" aria-modal="true" aria-labelledby="quarantine-modal-title" style="max-width: 780px; display: flex; flex-direction: column;">' +
        // Modal Header
        '<div class="modal-header" style="background: #fffbeb; border-bottom: 1px solid #fde68a; padding: 1rem 1.25rem;">' +
          '<div style="display: flex; align-items: center; gap: 0.6rem;">' +
            '<span style="display: inline-flex; padding: 6px; border-radius: 8px; background: #fef3c7; color: #b45309;">' +
              icons.render('alertTriangle', 'w-5 h-5') +
            '</span>' +
            '<div>' +
              '<h3 id="quarantine-modal-title" style="margin: 0; font-size: 16px; font-weight: 700; color: #92400e;">Corrupted Workspace Quarantine Viewer</h3>' +
              '<div style="font-size: 12px; color: #b45309;">Inspect, export, or safely discard unparseable data</div>' +
            '</div>' +
          '</div>' +
          '<button class="modal-close-btn" onclick="window.HortOpsQuarantineModal.close()" aria-label="Close modal">' +
            icons.render('x', 'w-4 h-4') +
          '</button>' +
        '</div>' +

        // Modal Body
        '<div class="modal-body" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">' +
          feedbackHtml +

          // Alert banner
          '<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 0.85rem 1rem; font-size: 13px; color: #92400e; line-height: 1.5;">' +
            '<strong>Storage Quarantine Active:</strong> Persistent auto-saving has been automatically suspended to prevent overwriting unparseable client data. The app is running in safe read-only recovery mode.' +
          '</div>' +

          // Diagnostic summary
          '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">' +
            '<div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.6rem 0.8rem;">' +
              '<div style="font-size: 11px; font-weight: 700; color: var(--slate-500); text-transform: uppercase;">Quarantine Source Key</div>' +
              '<div style="font-size: 13px; font-family: monospace; font-weight: 600; color: var(--slate-800);">' + esc(sourceStr) + '</div>' +
            '</div>' +
            '<div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.6rem 0.8rem;">' +
              '<div style="font-size: 11px; font-weight: 700; color: var(--slate-500); text-transform: uppercase;">Diagnostic Exception</div>' +
              '<div style="font-size: 13px; font-weight: 600; color: #b91c1c;">' + esc(errorStr) + '</div>' +
            '</div>' +
          '</div>' +

          // Raw payload box
          '<div>' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">' +
              '<label for="quarantine-payload-box" style="font-size: 12px; font-weight: 700; color: var(--slate-700);">Quarantined Raw Payload (' + (rawPayload ? rawPayload.length : 0) + ' characters):</label>' +
              '<div style="display: flex; gap: 0.4rem;">' +
                '<button type="button" class="btn btn-secondary" style="font-size: 11px; padding: 0.2rem 0.6rem;" onclick="window.HortOpsQuarantineModal.copyQuarantinePayload()">' +
                  icons.render('copy', 'w-3 h-3') +
                  '<span style="margin-left: 4px;">Copy Payload</span>' +
                '</button>' +
                '<button type="button" class="btn btn-secondary" style="font-size: 11px; padding: 0.2rem 0.6rem;" onclick="window.HortOpsQuarantineModal.exportQuarantineFile()">' +
                  icons.render('download', 'w-3 h-3') +
                  '<span style="margin-left: 4px;">Export File</span>' +
                '</button>' +
              '</div>' +
            '</div>' +
            '<textarea id="quarantine-payload-box" readonly style="width: 100%; height: 160px; font-family: monospace; font-size: 11px; padding: 0.6rem; border: 1px solid var(--slate-300); border-radius: 6px; background: #f8fafc; color: var(--slate-800); box-sizing: border-box; resize: vertical;">' +
              esc(rawPayload) +
            '</textarea>' +
          '</div>' +

          // Recovery actions
          '<div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.85rem 1rem;">' +
            '<div style="font-size: 13px; font-weight: 700; color: var(--slate-800); margin-bottom: 0.35rem;">Operator Recovery Options</div>' +
            '<div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">' +
              '<button type="button" class="btn btn-primary" style="font-size: 12px; padding: 0.4rem 0.85rem;" onclick="window.HortOpsQuarantineModal.openRestoreModal()">' +
                icons.render('rotateCcw', 'w-3.5 h-3.5') +
                '<span style="margin-left: 5px;">Restore from Valid Backup JSON</span>' +
              '</button>' +
              '<button type="button" class="btn" style="font-size: 12px; padding: 0.4rem 0.85rem; background: #fee2e2; border: 1px solid #fecaca; color: #dc2626; font-weight: 600;" onclick="window.HortOpsQuarantineModal.openResetModal()">' +
                icons.render('trash', 'w-3.5 h-3.5') +
                '<span style="margin-left: 5px;">Discard Quarantine & Clean Slate Reset...</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Modal Footer
        '<div class="modal-footer" style="padding: 0.85rem 1.25rem; background: var(--slate-50); border-top: 1px solid var(--slate-200); display: flex; justify-content: flex-end;">' +
          '<button type="button" class="btn btn-secondary" onclick="window.HortOpsQuarantineModal.close()">' +
            'Close' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    el.innerHTML = modalHtml;
  }
};

window.HortOpsQuarantineViewerModal = window.HortOpsQuarantineModal;
