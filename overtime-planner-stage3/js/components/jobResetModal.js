window.HortOpsJobResetModal = {
  jobId: null, scope: 'current_and_future',
  open: function(jobId) { this.jobId = jobId; this.scope = 'current_and_future'; if (window.HortOpsModalUtils) window.HortOpsModalUtils.lockBackgroundScroll(); this.render(); },
  close: function() { var root = document.getElementById('job-reset-modal-root'); if (root) root.innerHTML = ''; this.jobId = null; if (window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll(); },
  setScope: function(scope) { this.scope = scope === 'all' ? 'all' : 'current_and_future'; this.render(); },
  setConfirmationState: function(confirmed) {
    var button = document.getElementById('job-reset-confirm');
    if (!button) return;
    button.disabled = !confirmed;
    button.setAttribute('aria-disabled', confirmed ? 'false' : 'true');
    // Match the Workspace DANGER-reset affordance: the action is visibly
    // unavailable until the exact confirmation has been typed.
    button.style.setProperty('opacity', confirmed ? '1' : '0.5', 'important');
    button.style.setProperty('cursor', confirmed ? 'pointer' : 'not-allowed', 'important');
    button.style.setProperty('filter', confirmed ? 'none' : 'saturate(0.72)', 'important');
  },
  confirmInput: function(value) { this.setConfirmationState(String(value || '') === 'RESET'); },
  execute: function() {
    var input = document.getElementById('job-reset-confirmation'); if (!input || input.value !== 'RESET') return;
    var feedback = document.getElementById('job-reset-feedback'), result;
    try { result = window.HortOpsApp.resetJobAllocations(this.jobId, this.scope); }
    catch (error) { result = { success: false, error: error && error.message ? error.message : 'Reset could not be completed.' }; }
    if (!result.success) { feedback.style.display = 'block'; feedback.textContent = result.error || 'Reset failed; no data was changed.'; return; }
    feedback.style.display = 'block'; feedback.style.background = 'var(--emerald-50)'; feedback.style.borderColor = 'var(--emerald-200)'; feedback.style.color = 'var(--emerald-800)';
    feedback.textContent = 'Reset complete: cleared ' + result.counts.cleared + ' live record(s); retained ' + result.retainedSnapshots + ' historical snapshot(s).';
    this.setConfirmationState(false);
  },
  render: function() {
    var root = document.getElementById('job-reset-modal-root'), app = window.HortOpsApp; if (!root || !this.jobId) return;
    var job = (app.state.jobs || []).find(function(item) { return item.id === window.HortOpsJobResetModal.jobId; }); if (!job) return this.close();
    var counts = app.getJobAllocationResetPreview(this.jobId, this.scope), danger = this.scope === 'all';
    var esc = window.HortOpsSecurityUtils.escapeHtml;
    root.innerHTML = '<div class="modal-overlay" onclick="if(event.target===this)window.HortOpsJobResetModal.close()"><div class="modal-card modal-md" role="dialog" aria-modal="true" aria-labelledby="job-reset-title" style="max-width:620px"><div class="modal-header" style="'+(danger?'background:#fff1f2;border-bottom:1px solid #fecdd3':'')+'"><div><h3 id="job-reset-title">Reset allocations</h3><div style="font-size:12px;color:var(--slate-500)">'+esc(job.name)+'</div></div><button class="modal-close-btn" aria-label="Close" onclick="window.HortOpsJobResetModal.close()">×</button></div><div class="modal-body" style="display:flex;flex-direction:column;gap:12px"><p style="margin:0">The job definition, staff records, absences, refusals, and historical snapshots remain unchanged.</p><label style="padding:10px;border:1px solid '+(!danger?'var(--emerald-300);background:var(--emerald-50)':'var(--slate-200)')+';border-radius:6px"><input type="radio" name="scope" '+(!danger?'checked':'')+' onchange="window.HortOpsJobResetModal.setScope(\'current_and_future\')"> <strong>Reset current and future allocations</strong><br><small>Clears commitments dated '+counts.today+' or later.</small></label><label style="padding:10px;border:1px solid '+(danger?'#fda4af;background:#fff1f2':'var(--slate-200)')+';border-radius:6px"><input type="radio" name="scope" '+(danger?'checked':'')+' onchange="window.HortOpsJobResetModal.setScope(\'all\')"> <strong style="color:#b91c1c">Reset all allocations — DANGER</strong><br><small>Clears every live commitment; snapshots remain audit history.</small></label><div style="display:grid;grid-template-columns:1fr auto;gap:5px;padding:10px;border:1px solid var(--slate-200);border-radius:6px;background:var(--slate-50);font-size:13px"><span>Assignments</span><b>'+counts.assignments+'</b><span>Permit overrides</span><b>'+counts.permitOverrides+'</b><span>Rostering instructions / provenance</span><b>'+counts.rosteringInstructions+' / '+counts.rosteringProvenance+'</b><span>Snapshots retained</span><b>'+counts.historicalSnapshots+'</b></div><label>Type <code>RESET</code> to enable the reset action<input id="job-reset-confirmation" class="form-input" autocomplete="off" oninput="window.HortOpsJobResetModal.confirmInput(this.value)"></label><div id="job-reset-feedback" role="status" style="display:none;padding:9px;border:1px solid #fecaca;border-radius:6px;color:#b91c1c"></div></div><div class="modal-footer"><button class="btn btn-secondary" onclick="window.HortOpsJobResetModal.close()">Cancel</button><button id="job-reset-confirm" class="btn '+(danger?'btn-danger':'btn-primary')+'" disabled aria-disabled="true" style="opacity:0.5;cursor:not-allowed;filter:saturate(0.72)" onclick="window.HortOpsJobResetModal.execute()">Reset allocations</button></div></div></div>';
  }
};
