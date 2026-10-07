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

  inspectParentEvidence: function(txId) {
    var storage = window.HortOpsStorageDriver || window.HortOpsStorage;
    if (!storage || (typeof storage.prepareParentEvidenceInspection !== 'function' && typeof storage.inspectParentPriorEvidence !== 'function')) {
      alert('Storage driver does not support parent evidence inspection.');
      return;
    }
    // Prepare inspection data without committing inspection completion flag before presentation (Review 51 R51-P03)
    var prepFn = (typeof storage.prepareParentEvidenceInspection === 'function')
      ? storage.prepareParentEvidenceInspection
      : function(id) { return storage.inspectParentPriorEvidence(id, { prepareOnly: true }); };
    var res = prepFn.call(storage, txId);
    if (!res.success) {
      alert('Parent evidence inspection failed: ' + (res.error || res.status));
      return;
    }
    this.inspectedParentTxId = txId;
    this.feedbackMessage = 'Inspected parent transaction ' + txId + '. Prior recovery evidence is available for review.';

    // Call renderModal() to present evidence to operator FIRST!
    var renderResult = null;
    try {
      renderResult = this.renderModal();
    } catch (e) {
      renderResult = { success: false, reason: 'render_threw_exception', error: e.message || String(e) };
    }

    // Verify successful DOM presentation BEFORE committing inspection authority (Review 52 R52-01 / R52-P01 / R52-P02)
    if (!renderResult || !renderResult.success || !renderResult.parentPresented || !renderResult.evidencePresented) {
      this.inspectedParentTxId = null;
      var failMsg = (renderResult && (renderResult.error || renderResult.reason)) ? (renderResult.error || renderResult.reason) : 'Evidence could not be presented in modal.';
      this.feedbackMessage = 'Inspection display failed: ' + failMsg;
      if (typeof alert === 'function') {
        alert(this.feedbackMessage);
      }
      return;
    }

    var receipt = (renderResult && renderResult.receipt) ? renderResult.receipt : {
      transactionId: txId,
      presented: true,
      rawBytes: res.rawBytes,
      evidenceDisplayed: true,
      inspectedAt: new Date().toISOString()
    };

    // Commit inspection flag ONLY AFTER renderModal() succeeds and evidence is verified displayed in DOM (Review 51 R51-P03, Review 52 R52-01, Review 53 R53-01)
    if (typeof storage.recordParentEvidenceInspected === 'function') {
      var recRes = storage.recordParentEvidenceInspected(txId, receipt);
      if (!recRes || !recRes.success) {
        this.feedbackMessage = 'Failed to record evidence inspection: ' + ((recRes && (recRes.error || recRes.status)) || 'Authority check failed');
        return;
      }
    } else if (storage.resolvedBundles && storage.resolvedBundles[txId]) {
      storage.resolvedBundles[txId].priorEvidenceInspected = true;
      storage.resolvedBundles[txId].priorEvidenceInspectedAt = receipt.inspectedAt;
      storage.resolvedBundles[txId].inspectionReceipt = receipt;
    }
  },

  exportParentEvidence: function(txId) {
    var storage = window.HortOpsStorageDriver || window.HortOpsStorage;
    if (!storage || (typeof storage.prepareParentEvidenceExport !== 'function' && typeof storage.exportParentPriorEvidence !== 'function')) {
      alert('Storage driver does not support parent evidence export.');
      return;
    }
    var prepFn = (typeof storage.prepareParentEvidenceExport === 'function') ? storage.prepareParentEvidenceExport : storage.exportParentPriorEvidence;
    var res = prepFn.call(storage, txId);
    if (!res.success) {
      alert('Parent evidence export failed: ' + (res.error || res.status));
      return;
    }
    try {
      var blob = new Blob([res.exportData], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = res.filename || ('parent_evidence_' + txId + '.json');
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      // Record export initiated ONLY AFTER synchronous browser download operations succeed (Review 50 R50-B)
      if (typeof storage.recordParentEvidenceExportInitiated === 'function') {
        storage.recordParentEvidenceExportInitiated(txId);
      } else if (storage.resolvedBundles && storage.resolvedBundles[txId]) {
        storage.resolvedBundles[txId].priorEvidenceExported = true;
        storage.resolvedBundles[txId].priorEvidenceExportedAt = new Date().toISOString();
      }

      this.feedbackMessage = 'Export of parent transaction recovery bundle ' + txId + ' initiated. Download has started.';
      this.renderModal();
    } catch(e) {
      alert('Export download failed: ' + e.message);
    }
  },

  acknowledgeParentEvidence: function(txId) {
    var storage = window.HortOpsStorageDriver || window.HortOpsStorage;
    if (!storage || typeof storage.acknowledgeParentPriorEvidence !== 'function') {
      alert('Storage driver does not support parent evidence acknowledgement.');
      return;
    }
    var confirmed = confirm('ACKNOWLEDGE PRIOR EVIDENCE:\n\nConfirm that you have inspected or exported the older emergency recovery evidence for transaction ' + txId + ' and acknowledge its replacement.');
    if (!confirmed) return;

    var res = storage.acknowledgeParentPriorEvidence(txId, { operatorConfirmed: true });
    if (!res.success) {
      alert('Acknowledgement failed: ' + (res.error || res.status));
      return;
    }
    this.feedbackMessage = 'Successfully acknowledged prior recovery evidence for transaction ' + txId + '. Bundle is now eligible for retirement.';
    this.renderModal();
  },

  retireParentEvidence: function(txId) {
    var storage = window.HortOpsStorageDriver || window.HortOpsStorage;
    if (!storage || typeof storage.retireCompositeParentBundle !== 'function') {
      alert('Storage driver does not support parent bundle retirement.');
      return;
    }
    var confirmed = confirm('RETIRE PARENT RECOVERY BUNDLE:\n\nThis will permanently purge transaction composite evidence ' + txId + ' from session storage.\n\nProceed with retirement?');
    if (!confirmed) return;

    var res = storage.retireCompositeParentBundle(txId);
    if (!res.success) {
      alert('Retirement failed: ' + (res.error || res.status));
      return;
    }
    var inv = (storage && typeof storage._reconcileRecoveryInventory === 'function') ? storage._reconcileRecoveryInventory() : { ok: true, count: 0 };
    if (!inv.ok || inv.count > 0) {
      this.feedbackMessage = 'Parent recovery bundle ' + txId + ' retired. ' + inv.count + ' other recovery item(s) remain in session storage.';
      this.renderModal();
    } else {
      this.feedbackMessage = 'All emergency recovery evidence successfully resolved and retired! Application restored to normal operation.';
      this.renderModal();
      setTimeout(function() {
        if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
          window.location.reload();
        }
      }, 500);
    }
  },

  restoreEmergencyArtifact: function() {
    var state = (window.HortOpsApp && window.HortOpsApp.state) ? window.HortOpsApp.state : {};
    var payload = state.emergencyRecoveryPayload;
    if (!payload && (window.HortOpsClientStorage || window).sessionStorage) {
      try {
        payload = (window.HortOpsClientStorage || window).sessionStorage.getItem('hort_ops_emergency_recovery_v2');
      } catch(e) {}
    }

    if (!payload) {
      alert('No emergency recovery artifact found to restore.');
      return;
    }

    var parentTxId = null;
    var isDirectParentComposite = false;
    try {
      var parsed = (typeof payload === 'string') ? JSON.parse(payload) : payload;
      if (parsed) {
        if (parsed.artifactType === 'hort_ops_reset_transaction_recovery' || parsed.bundleType === 'hort_ops_reset_transaction_recovery') {
          isDirectParentComposite = true;
        }
        if (parsed.transactionId) parentTxId = parsed.transactionId;
        if (parsed.artifactType === 'hort_ops_reset_transaction_recovery' || parsed.currentWorkspaceRecoveryArtifact) {
          if (parsed.currentWorkspaceRecoveryArtifact) {
            payload = JSON.stringify(parsed.currentWorkspaceRecoveryArtifact);
          }
        }
      }
    } catch(e) {}

    var validator = window.HortOpsRecoveryArtifact;
    if (validator && typeof validator.validateEmergencyRecoveryArtifact === 'function') {
      var valRes = validator.validateEmergencyRecoveryArtifact(payload);
      if (!valRes.valid) {
        alert('Cannot restore invalid emergency recovery artifact: ' + (valRes.error || 'Validation failed'));
        return;
      }
    }

    var confirmed = confirm('RESTORE EMERGENCY RECOVERY ARTIFACT:\n\nThis will overwrite existing local application data with the emergency pre-reset snapshot.\n\nAre you sure you want to proceed?');
    if (!confirmed) return;

    var storage = window.HortOpsStorage;
    if (!storage || typeof storage.restoreEmergencyRecoveryArtifact !== 'function') {
      alert('Storage system does not support emergency recovery restore.');
      return;
    }

    if (!parentTxId && (window.HortOpsClientStorage || window).sessionStorage) {
      try {
        var sLen = (typeof (window.HortOpsClientStorage || window).sessionStorage.length === 'number') ? (window.HortOpsClientStorage || window).sessionStorage.length : 0;
        var pChildId = null;
        try { var pArt = (typeof payload === 'string') ? JSON.parse(payload) : payload; pChildId = pArt && pArt.recoveryId; } catch(eArt) {}
        if (pChildId) {
          for (var si = 0; si < sLen; si++) {
            var sk = (window.HortOpsClientStorage || window).sessionStorage.key(si);
            if (sk && sk.indexOf('hort_ops_emergency_recovery_v2:transaction:') === 0) {
              var pRaw = (window.HortOpsClientStorage || window).sessionStorage.getItem(sk);
              if (pRaw) {
                var pBundle = JSON.parse(pRaw);
                var pChild = pBundle.currentWorkspaceRecoveryArtifact || pBundle.targetRecoveryArtifact;
                if (pChild && pChild.recoveryId === pChildId) {
                  parentTxId = pBundle.transactionId;
                  break;
                }
              }
            }
          }
        }
      } catch(e) {}
    }

    var res = null;
    try {
      res = storage.restoreEmergencyRecoveryArtifact(payload, { parentTransactionId: parentTxId });
    } catch (uiErr) {
      res = { success: false, status: 'unexpected_restore_exception', error: uiErr.message || String(uiErr) };
    }
    if (res && res.success) {
      var driver = window.HortOpsStorageDriver || storage;
      // Indirect child restore must NEVER silently retire parent bundle (Review 48 R48-A, R48-P05)

      var inv = (driver && typeof driver._reconcileRecoveryInventory === 'function') ? driver._reconcileRecoveryInventory() : { ok: true, count: 0 };
      var evidenceRemains = (!inv.ok || inv.count > 0);
      if (typeof window !== 'undefined' && window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.recoveryRequired === true) {
        evidenceRemains = true;
      }

      if (evidenceRemains) {
        this.feedbackMessage = 'Workspace restored from emergency snapshot. Note: Older emergency recovery evidence remains in session storage. Auto-save remains suspended until older evidence is exported or acknowledged.';
        this.renderModal();
      } else {
        this.feedbackMessage = 'Emergency recovery artifact successfully restored! Reloading application...';
        this.renderModal();
        setTimeout(function() {
          if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
            window.location.reload();
          }
        }, 500);
      }
    } else {
      var errMgs = (res && res.error) ? res.error : (res && res.status ? res.status : 'Restore failed');
      this.feedbackMessage = 'Emergency restore failed: ' + errMgs;
      this.renderModal();
      alert('Emergency restore failed: ' + errMgs);
    }
  },

  renderModal: function() {
    var el = document.getElementById('quarantine-viewer-modal-root');
    if (!el) {
      return {
        success: false,
        reason: 'missing_modal_root',
        error: 'Missing quarantine-viewer-modal-root DOM container',
        parentPresented: false,
        evidencePresented: false
      };
    }

    var state = (window.HortOpsApp && window.HortOpsApp.state) ? window.HortOpsApp.state : {};
    var storage = window.HortOpsStorage;
    var rawPayload = state.emergencyRecoveryPayload || ((storage && typeof storage.getRawQuarantinePayload === 'function')
      ? storage.getRawQuarantinePayload()
      : '');

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

        var driver = window.HortOpsStorageDriver || storage;
    var inv = (driver && typeof driver._reconcileRecoveryInventory === 'function')
      ? driver._reconcileRecoveryInventory()
      : { ok: true, compositeKeys: [], count: 0 };

    var parentPresented = false;
    var evidencePresented = false;
    var presentedReceipt = null;

    var parentCardsHtml = '';
    if (inv && inv.ok && inv.compositeKeys && inv.compositeKeys.length > 0) {
      parentCardsHtml += '<div style="background: #f8fafc; border: 1px solid var(--slate-300); border-radius: 6px; padding: 0.85rem 1rem;">' +
        '<div style="font-size: 13px; font-weight: 700; color: var(--slate-800); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">' +
          icons.render('shieldAlert', 'w-4 h-4') +
          '<span>Transaction Composite Recovery Bundles (' + inv.compositeKeys.length + ')</span>' +
        '</div>' +
        '<div style="display: flex; flex-direction: column; gap: 0.6rem;">';

      for (var ci = 0; ci < inv.compositeKeys.length; ci++) {
        var compKey = inv.compositeKeys[ci];
        var compRaw = '';
        var compReadError = null;
        try {
          compRaw = (window.HortOpsClientStorage || window).sessionStorage.getItem(compKey) || '';
        } catch(e) {
          compReadError = e;
        }
        var compParsed = null;
        if (compRaw) {
          try { compParsed = JSON.parse(compRaw); } catch(e) {}
        }
        var txId = (compParsed && compParsed.transactionId) ? compParsed.transactionId : compKey.replace('hort_ops_emergency_recovery_v2:transaction:', '').replace('hort_ops_emergency_recovery_v2:restore_transaction:', '');
        var resRec = (driver && driver.resolvedBundles) ? driver.resolvedBundles[txId] : null;
        var wsRecovered = Boolean(resRec && resRec.workspaceRecovered === true);
        var priorCount = (compParsed && compParsed.previousEmergencyRecoveryMetadata) ? Object.keys(compParsed.previousEmergencyRecoveryMetadata).length : 0;
        var inspected = Boolean(resRec && resRec.priorEvidenceInspected);
        var exported = Boolean(resRec && resRec.priorEvidenceExported);
        var acknowledged = Boolean(resRec && resRec.priorEvidenceAcknowledged);

        parentCardsHtml += '<div style="background: #ffffff; border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.75rem; font-size: 12px;">' +
          '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">' +
            '<span style="font-family: monospace; font-weight: 700; color: var(--slate-800);">' + esc(compKey) + '</span>' +
            '<span style="padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; ' + (wsRecovered ? 'background: #dcfce7; color: #166534;' : 'background: #fee2e2; color: #991b1b;') + '">' +
              (wsRecovered ? 'Workspace Recovered' : 'Workspace Pending') +
            '</span>' +
          '</div>' +
          '<div style="color: var(--slate-600); margin-bottom: 0.5rem;">' +
            'Prior Evidence Keys: <strong>' + priorCount + '</strong> | Inspected: <strong>' + (inspected ? 'Yes' : 'No') + '</strong> | Exported: <strong>' + (exported ? 'Yes' : 'No') + '</strong> | Acknowledged: <strong>' + (acknowledged ? 'Yes' : 'No') + '</strong>' +
          '</div>' +
          '<div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">' +
            '<button type="button" class="btn btn-secondary btn-inspect-parent" style="font-size: 11px; padding: 0.25rem 0.55rem;" onclick="window.HortOpsQuarantineModal.inspectParentEvidence(\'' + esc(txId) + '\')">' +
              icons.render('eye', 'w-3 h-3') + '<span style="margin-left: 4px;">Inspect Evidence</span>' +
            '</button>' +
            '<button type="button" class="btn btn-secondary btn-export-parent" style="font-size: 11px; padding: 0.25rem 0.55rem;" onclick="window.HortOpsQuarantineModal.exportParentEvidence(\'' + esc(txId) + '\')">' +
              icons.render('download', 'w-3 h-3') + '<span style="margin-left: 4px;">Export Evidence</span>' +
            '</button>' +
            '<button type="button" class="btn btn-secondary btn-ack-parent" style="font-size: 11px; padding: 0.25rem 0.55rem;" onclick="window.HortOpsQuarantineModal.acknowledgeParentEvidence(\'' + esc(txId) + '\')">' +
              icons.render('check', 'w-3 h-3') + '<span style="margin-left: 4px;">Acknowledge Prior Evidence</span>' +
            '</button>' +
            '<button type="button" id="btn-retire-parent-bundle" class="btn btn-retire-parent-bundle" style="font-size: 11px; padding: 0.25rem 0.55rem; background: #fee2e2; border: 1px solid #fecaca; color: #dc2626; font-weight: 600;" onclick="window.HortOpsQuarantineModal.retireParentEvidence(\'' + esc(txId) + '\')">' +
              icons.render('trash', 'w-3 h-3') + '<span style="margin-left: 4px;">Retire Parent Bundle</span>' +
            '</button>' +
          '</div>';

        // Render visible inspection view when inspected or when this parent was selected for inspect (Review 50 R50-A / R50-P01, Review 52 R52-01)
        if (this.inspectedParentTxId === txId || inspected) {
          if (compParsed && !compReadError) {
            var matchesBound = (!resRec || !resRec.boundRawBytes || resRec.boundRawBytes === compRaw);
            if (matchesBound) {
              var priorMeta = compParsed.previousEmergencyRecoveryMetadata || {};
              var priorMetaKeys = Object.keys(priorMeta);
              parentCardsHtml += '<div class="parent-evidence-inspection-view" style="margin-top: 0.6rem; padding: 0.6rem; background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 4px;">' +
                '<div style="font-weight: 700; font-size: 11px; color: var(--slate-700); margin-bottom: 0.35rem;">Inspected Historical Prior Recovery Evidence:</div>';
              
              if (priorMetaKeys.length > 0) {
                for (var pk = 0; pk < priorMetaKeys.length; pk++) {
                  var pKey = priorMetaKeys[pk];
                  var pVal = priorMeta[pKey];
                  var pValStr = (typeof pVal === 'string') ? pVal : JSON.stringify(pVal, null, 2);
                  parentCardsHtml += '<div style="margin-bottom: 0.4rem;">' +
                    '<div style="font-family: monospace; font-size: 10px; font-weight: 700; color: var(--slate-600);">' + esc(pKey) + ':</div>' +
                    '<pre class="prior-evidence-content" style="font-family: monospace; font-size: 11px; background: #ffffff; border: 1px solid var(--slate-200); border-radius: 4px; padding: 0.4rem; margin: 0.2rem 0; white-space: pre-wrap; word-break: break-all; max-height: 120px; overflow-y: auto;">' + esc(pValStr) + '</pre>' +
                  '</div>';
                }
              } else {
                parentCardsHtml += '<div style="font-size: 11px; color: var(--slate-500); font-style: italic;">No previous emergency recovery metadata was captured in this composite bundle. Composite holds transaction envelope, workspace recovery bytes, and compensation outcome.</div>';
              }
              parentCardsHtml += '</div>';

              if (this.inspectedParentTxId === txId) {
                parentPresented = true;
                evidencePresented = true;
                presentedReceipt = {
                  transactionId: txId,
                  parentKey: compKey,
                  rawBytes: compRaw,
                  presented: true,
                  evidenceDisplayed: true,
                  priorEvidenceKeysCount: priorMetaKeys.length,
                  inspectedAt: new Date().toISOString()
                };
              }
            }
          }
        }

        parentCardsHtml += '</div>';
      }

      parentCardsHtml += '</div></div>';
    } else if (inv && !inv.ok) {
      parentCardsHtml += '<div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 6px; padding: 0.85rem 1rem; color: #991b1b; font-size: 12px;">' +
        '<strong>Storage Read Exception:</strong> Recovery inventory could not be verified (' + esc(inv.error ? (inv.error.message || String(inv.error)) : 'Scan failed') + '). Inspection cards suppressed.' +
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
          parentCardsHtml +

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
              ((state.recoverySource === 'emergency_session_backup' || state.emergencyRecoveryPayload || (function(){ {try { return !!((window.HortOpsClientStorage || window).sessionStorage && (window.HortOpsClientStorage || window).sessionStorage.getItem('hort_ops_emergency_recovery_v2')); } catch(e){ return false; }}})()) ? ('<button type="button" id="btn-restore-emergency-artifact" class="btn" style="font-size: 12px; padding: 0.4rem 0.85rem; background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; font-weight: 700;" onclick="window.HortOpsQuarantineModal.restoreEmergencyArtifact()">' +
                icons.render('rotateCcw', 'w-3.5 h-3.5') +
                '<span style="margin-left: 5px;">Restore Emergency Recovery Artifact</span>' +
              '</button>') : '') +
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

    try {
      el.innerHTML = modalHtml;
    } catch (renderErr) {
      return {
        success: false,
        reason: 'dom_render_failed',
        error: renderErr.message || String(renderErr),
        rootPresent: true,
        parentPresented: false,
        evidencePresented: false
      };
    }

    if (this.inspectedParentTxId) {
      var domHtml = (el && typeof el.innerHTML === 'string') ? el.innerHTML : '';
      var hasInspectionView = domHtml.indexOf('parent-evidence-inspection-view') !== -1;
      var hasContent = (presentedReceipt && presentedReceipt.priorEvidenceKeysCount > 0)
        ? (domHtml.indexOf('prior-evidence-content') !== -1)
        : (domHtml.indexOf('No previous emergency recovery metadata') !== -1);
      if (!parentPresented || !evidencePresented || !hasInspectionView || !hasContent) {
        return {
          success: false,
          reason: 'evidence_presentation_unverified',
          error: 'Evidence view was not verified in rendered DOM',
          rootPresent: true,
          inventoryOk: Boolean(inv && inv.ok),
          parentPresented: false,
          evidencePresented: false
        };
      }
    }

    return {
      success: true,
      rootPresent: true,
      inventoryOk: Boolean(inv && inv.ok),
      inspectedParentTxId: this.inspectedParentTxId,
      parentPresented: Boolean(parentPresented),
      evidencePresented: Boolean(evidencePresented),
      receipt: presentedReceipt
    };
  }
};

window.HortOpsQuarantineViewerModal = window.HortOpsQuarantineModal;
