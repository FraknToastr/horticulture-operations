// Stage 4F bounded absence-impact approval modal.
(function () {
  'use strict';
  var context = null, opener = null, locked = false;
  function root() { return document.getElementById('absence-impact-modal-root'); }
  function esc(value) { return window.HortOpsSecurityUtils.escapeHtml(String(value == null ? '' : value)); }
  function staffName(id) {
    var roster = context && context.state && (context.state.staffList || context.state.roster) || [];
    var person = roster.find(function (item) { return item.id === id; });
    return person ? person.name : id;
  }
  function render(error) {
    var el = root();
    if (!el) return;
    var model = context && context.model, rows = model && model.affected || [];
    var content = error ? '<div class="hours-error" role="alert">' + esc(error) + '</div>' :
      '<section class="hours-policy"><strong>Absence impact review</strong><p>Affected saved assignments remain visible until approval. Each proposed replacement is a one-off manual assignment. Fixed and rotation instructions continue unchanged.</p></section>' +
      (rows.length ? '<div class="hours-table-wrap"><table class="hours-table"><thead><tr><th>Date / job</th><th>Affected assignment</th><th>Proposed replacement</th><th>Result</th></tr></thead><tbody>' + rows.map(function (row) {
        var instruction = row.instructionId ? '<br><span class="text-muted">' + esc(row.instructionId) + '</span>' : '';
        return '<tr data-absence-impact-shift="' + esc(row.shiftId) + '"><td><strong>' + esc(row.date) + '</strong><br>' + esc(row.jobName) + '</td><td>' + esc(staffName(row.affectedStaffId)) + '<br><span class="hours-status">' + esc(row.assignmentType) + '</span>' + instruction + '</td><td>' + (row.replacementId ? '<strong>' + esc(staffName(row.replacementId)) + '</strong><br><span class="text-muted">One-off manual</span>' : '<span class="hours-unknown">No eligible replacement</span>') + '</td><td>' + esc(row.explanation) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="hours-empty">No saved future assignment is affected by the changed absence dates.</div>') +
      '<p class="hours-note">Scope: changed absence date ranges only. Regular working hours are excluded. ' + (model.shortages.length ? model.shortages.length + ' assignment conflict' + (model.shortages.length === 1 ? '' : 's') + ' will remain visible for manual resolution.' : 'Every affected occurrence has a proposed replacement.') + '</p>';
    el.innerHTML = '<div class="modal-overlay hours-allocation-overlay"><div class="modal-card modal-lg hours-modal hours-allocation-modal absence-impact-modal" role="dialog" aria-modal="true" aria-labelledby="absence-impact-title" tabindex="-1"><header class="modal-header hours-modal-header"><div><h2 id="absence-impact-title">Review absence impact</h2><p>' + esc(context && context.staff && context.staff.name || '') + '</p></div><button type="button" class="btn btn-secondary" data-absence-impact-action="close">Close</button></header><div class="modal-body hours-modal-body">' + content + '</div><footer class="modal-footer hours-modal-footer"><p>Saving is atomic: the absence and reviewed replacements are committed together.</p><button type="button" class="btn btn-secondary" data-absence-impact-action="refresh">Refresh</button><button type="button" class="btn btn-secondary" data-absence-impact-action="absence-only">Save absence only</button><button type="button" class="btn btn-primary" data-absence-impact-action="approve"' + (error || !model || !model.success ? ' disabled' : '') + '>Approve replacements &amp; save</button></footer></div></div>';
    if (el.firstElementChild) el.firstElementChild.style.zIndex = '1200';
  }
  function refresh() {
    try { context = window.HortOpsApp.getAbsenceImpactDraft(); if (!context.model.success) throw new Error(context.model.errors[0] || 'Impact review unavailable.'); render(); return true; }
    catch (error) { context = null; render(error.message); return false; }
  }
  function open() {
    opener = document.activeElement;
    if (window.HortOpsModalUtils) { window.HortOpsModalUtils.lockBackgroundScroll(); locked = true; }
    refresh();
    var panel = root() && root().querySelector('.absence-impact-modal'); if (panel) panel.focus();
    return { success: !!context };
  }
  function close() {
    if (root()) root().innerHTML = '';
    context = null;
    if (locked && window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll();
    locked = false;
    if (opener && opener.isConnected && !opener.disabled) opener.focus({ preventScroll: true });
    opener = null;
  }
  function approve() {
    if (!context) return false;
    var result = window.HortOpsApp.saveAbsenceImpactPlan(context.signature);
    if (!result || !result.success) { render(result && result.error || 'Unable to save reviewed plan.'); return false; }
    close(); window.HortOpsStaffAbsenceModal.close(); return true;
  }
  function absenceOnly() {
    var result = window.HortOpsStaffAbsenceModal.saveDirect();
    if (result && result.success === false) { render(result.error || 'Unable to save absence.'); return false; }
    close(); return true;
  }
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-absence-impact-action]'); if (!button) return;
    event.preventDefault(); var action = button.getAttribute('data-absence-impact-action');
    if (action === 'close') close(); if (action === 'refresh') refresh(); if (action === 'approve') approve(); if (action === 'absence-only') absenceOnly();
  });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && context) { event.preventDefault(); close(); } });
  window.HortOpsAbsenceImpactModal = { open: open, close: close, refresh: refresh, approve: approve, saveAbsenceOnly: absenceOnly };
}());
