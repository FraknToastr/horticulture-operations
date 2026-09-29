// Storage Quota & Health Monitoring Modal Component (Stage 2 Mandate)
// Provides real-time capacity estimation against 5MB LocalStorage quota, 80% threshold warnings, active write probes, and storage compaction.

window.HortOpsStorageHealthModal = {
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
    var el = document.getElementById('storage-health-modal-root');
    if (el) el.innerHTML = '';
    if (window.HortOpsModalUtils && typeof window.HortOpsModalUtils.unlockBackgroundScroll === 'function') {
      window.HortOpsModalUtils.unlockBackgroundScroll();
    }
  },

  runHealthProbe: function() {
    var storage = window.HortOpsStorage;
    var health = (storage && typeof storage.getStorageHealth === 'function') ? storage.getStorageHealth() : null;
    this.feedbackMessage = health && health.probeOk
      ? 'Active persistence probe verified operable at ' + new Date().toLocaleTimeString() + '.'
      : 'Persistence probe warning: unable to verify write persistence.';
    this.renderModal();
  },

  executeCompact: function() {
    var storage = window.HortOpsStorage;
    if (storage && typeof storage.compactStorage === 'function') {
      var res = storage.compactStorage();
      var reclaimedKb = (res.reclaimedBytes / 1024).toFixed(1);
      if (res && res.success) {
        this.feedbackMessage = 'Compaction complete: ' + res.prunedCount + ' legacy/temporary key(s) purged, ' + reclaimedKb + ' KB reclaimed.';
      } else {
        this.feedbackMessage = 'Compaction partial/failed: some legacy keys could not be removed (' + (res ? res.prunedCount : 0) + ' purged, ' + reclaimedKb + ' KB reclaimed).';
      }
    } else {
      this.feedbackMessage = 'Storage compaction routine unavailable.';
    }
    this.renderModal();
  },

  openResetModal: function() {
    this.close();
    if (window.HortOpsApp && typeof window.HortOpsApp.openResetWorkspaceModal === 'function') {
      window.HortOpsApp.openResetWorkspaceModal();
    }
  },

  renderModal: function() {
    var el = document.getElementById('storage-health-modal-root');
    if (!el) return;

    var storage = window.HortOpsStorage;
    var health = (storage && typeof storage.getStorageHealth === 'function')
      ? storage.getStorageHealth()
      : { status: 'healthy', probeOk: true, usedBytes: 0, workspaceBytes: 0, quotaEstimate: 5242880, percentUsed: 0, lastSaved: new Date().toISOString() };

    var icons = window.HortOpsIcons;
    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml)
      ? window.HortOpsSecurityUtils.escapeHtml
      : function(s) { return String(s || ''); };

    var totalKb = (health.usedBytes / 1024).toFixed(1);
    var wsKb = ((health.workspaceBytes || health.usedBytes) / 1024).toFixed(1);
    var quotaMb = ((health.quotaEstimate || 5242880) / (1024 * 1024)).toFixed(1);
    var pct = Math.min(100, Math.max(0, health.percentUsed || 0));

    var statusBadgeColor = '#10b981';
    var statusBadgeBg = '#ecfdf5';
    var statusBorder = '#a7f3d0';
    var statusLabel = 'Healthy — Normal Operation';

    if (!health.probeOk || health.status === 'failed') {
      statusBadgeColor = '#ef4444';
      statusBadgeBg = '#fef2f2';
      statusBorder = '#fecaca';
      statusLabel = 'Persistence Failure (Session-Only Mode)';
    } else if (health.percentUsed > 80 || health.status === 'warning') {
      statusBadgeColor = '#f97316';
      statusBadgeBg = '#fff7ed';
      statusBorder = '#fed7aa';
      statusLabel = 'Capacity Warning (> 80% Quota Used)';
    }

    var barColor = pct > 80 ? '#ef4444' : (pct > 60 ? '#f97316' : '#10b981');

    var feedbackHtml = '';
    if (this.feedbackMessage) {
      feedbackHtml = '<div style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 0.6rem 0.85rem; border-radius: 6px; font-size: 12px; margin-bottom: 0.75rem;">' +
        esc(this.feedbackMessage) +
      '</div>';
    }

    var modalHtml = '<div class="modal-overlay" onclick="if(event.target === this) window.HortOpsStorageHealthModal.close()">' +
      '<div class="modal-card modal-md" id="modal-storage-health" role="dialog" aria-modal="true" aria-labelledby="storage-modal-title" style="max-width: 600px; display: flex; flex-direction: column;">' +
        // Modal Header
        '<div class="modal-header" style="background: var(--slate-50); border-bottom: 1px solid var(--slate-200); padding: 1rem 1.25rem;">' +
          '<div style="display: flex; align-items: center; gap: 0.6rem;">' +
            '<span style="display: inline-flex; padding: 6px; border-radius: 8px; background: #e0f2fe; color: #0284c7;">' +
              icons.render('shield', 'w-5 h-5') +
            '</span>' +
            '<div>' +
              '<h3 id="storage-modal-title" style="margin: 0; font-size: 16px; font-weight: 700; color: var(--slate-800);">Storage Quota & Health Monitor</h3>' +
              '<div style="font-size: 12px; color: var(--slate-500);">Real-time capacity tracking & persistence hygiene</div>' +
            '</div>' +
          '</div>' +
          '<button class="modal-close-btn" onclick="window.HortOpsStorageHealthModal.close()" aria-label="Close modal">' +
            icons.render('x', 'w-4 h-4') +
          '</button>' +
        '</div>' +

        // Modal Body
        '<div class="modal-body" style="padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem;">' +
          feedbackHtml +

          // Status Banner
          '<div style="display: flex; justify-content: space-between; align-items: center; background: ' + statusBadgeBg + '; border: 1px solid ' + statusBorder + '; border-radius: 6px; padding: 0.75rem 1rem;">' +
            '<div>' +
              '<div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: ' + statusBadgeColor + ';">Persistence Status</div>' +
              '<div style="font-size: 14px; font-weight: 700; color: ' + statusBadgeColor + ';">' + statusLabel + '</div>' +
            '</div>' +
            '<div style="text-align: right;">' +
              '<div style="font-size: 11px; color: var(--slate-500);">Capacity Used</div>' +
              '<div style="font-size: 18px; font-weight: 800; color: var(--slate-800);">' + pct + '%</div>' +
            '</div>' +
          '</div>' +

          // Capacity Meter
          '<div>' +
            '<div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; color: var(--slate-600);">' +
              '<span><strong>' + totalKb + ' KB</strong> allocated</span>' +
              '<span>' + quotaMb + ' MB browser quota estimate</span>' +
            '</div>' +
            '<div style="width: 100%; height: 10px; background: var(--slate-200); border-radius: 5px; overflow: hidden;">' +
              '<div style="width: ' + pct + '%; height: 100%; background: ' + barColor + '; border-radius: 5px; transition: width 0.3s ease;"></div>' +
            '</div>' +
          '</div>' +

          // Metric Details Grid
          '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">' +
            '<div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.6rem 0.8rem;">' +
              '<div style="font-size: 11px; font-weight: 700; color: var(--slate-500); text-transform: uppercase;">Workspace Envelope</div>' +
              '<div style="font-size: 16px; font-weight: 700; color: var(--slate-800);">' + wsKb + ' KB</div>' +
              '<div style="font-size: 11px; color: var(--slate-500);">Canonical Schema v2</div>' +
            '</div>' +
            '<div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.6rem 0.8rem;">' +
              '<div style="font-size: 11px; font-weight: 700; color: var(--slate-500); text-transform: uppercase;">Active Probe</div>' +
              '<div style="font-size: 16px; font-weight: 700; color: ' + (health.probeOk ? '#10b981' : '#ef4444') + ';">' +
                (health.probeOk ? 'Passed (OK)' : 'Failed') +
              '</div>' +
              '<div style="font-size: 11px; color: var(--slate-500);">Live write/read check</div>' +
            '</div>' +
          '</div>' +

          // Storage Hygiene Controls
          '<div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.85rem 1rem;">' +
            '<div style="font-size: 13px; font-weight: 700; color: var(--slate-800); margin-bottom: 0.25rem;">Storage Hygiene & Optimization</div>' +
            '<p style="font-size: 12px; color: var(--slate-600); margin: 0 0 0.75rem 0; line-height: 1.4;">' +
              'Compact storage safely prunes obsolete legacy buffers and test probe sentinels without modifying active jobs, personnel rosters, or shift commitments.' +
            '</p>' +
            '<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' +
              '<button type="button" class="btn btn-secondary" style="font-size: 12px; padding: 0.35rem 0.75rem;" onclick="window.HortOpsStorageHealthModal.executeCompact()">' +
                icons.render('sparkles', 'w-3.5 h-3.5') +
                '<span style="margin-left: 4px;">Compact Storage</span>' +
              '</button>' +
              '<button type="button" class="btn btn-secondary" style="font-size: 12px; padding: 0.35rem 0.75rem;" onclick="window.HortOpsStorageHealthModal.runHealthProbe()">' +
                icons.render('checkCircle', 'w-3.5 h-3.5') +
                '<span style="margin-left: 4px;">Run Active Probe</span>' +
              '</button>' +
              '<button type="button" class="btn" style="font-size: 12px; padding: 0.35rem 0.75rem; color: #dc2626; background: #fee2e2; border: 1px solid #fecaca; font-weight: 600;" onclick="window.HortOpsStorageHealthModal.openResetModal()">' +
                icons.render('trash', 'w-3.5 h-3.5') +
                '<span style="margin-left: 4px;">Reset Workspace...</span>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Modal Footer
        '<div class="modal-footer" style="padding: 0.85rem 1.25rem; background: var(--slate-50); border-top: 1px solid var(--slate-200); display: flex; justify-content: flex-end;">' +
          '<button type="button" class="btn btn-secondary" onclick="window.HortOpsStorageHealthModal.close()">' +
            'Close' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    el.innerHTML = modalHtml;
  }
};
