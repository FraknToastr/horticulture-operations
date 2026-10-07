// Stage 4E bounded multi-occurrence review modal.
(function () {
  'use strict';
  var shiftId = null, context = null, model = null, opener = null, locked = false, timer = null;
  function root() { return document.getElementById('mixed-policy-plan-modal-root'); }
  function esc(value) { return window.HortOpsSecurityUtils.escapeHtml(String(value == null ? '' : value)); }
  function staffName(id) {
    var roster = context && context.state && (context.state.staffList || context.state.roster) || [];
    var person = roster.find(function (item) { return item.id === id; });
    return person ? person.name : id;
  }
  function names(ids) { return (ids || []).length ? ids.map(function (id) { return esc(staffName(id)); }).join(', ') : '<span class="text-muted">Vacant</span>'; }
  function fresh() {
    if (!shiftId || !context) return false;
    try { return window.HortOpsApp.getMixedPolicyPlanSignature(shiftId) === context.signature; }
    catch (error) { return false; }
  }
  function render(error) {
    var el = root(); if (!el) return;
    var rows = model && model.occurrences || [];
    var repairs = model && model.repairs || [];
    var content = error ? '<div class="hours-error" role="alert">' + esc(error) + '</div>' :
      '<section class="hours-policy"><strong>Bounded mixed-policy plan</strong><p>Manual assignments stay protected. Fixed and rotation policies stop after their occurrence count. An ineligible fixed officer remains a visible conflict; any replacement shown here is a separate manual proposal requiring this approval and the allocator’s normal save action.</p></section>' +
      '<div class="hours-table-wrap"><table class="hours-table"><thead><tr><th>Date</th><th>Projected policy crew</th><th>Manual substitute proposal</th><th>Conflicts / vacancies</th></tr></thead><tbody>' +
      rows.map(function (row) {
        var conflictText = (row.conflicts || []).map(function (item) { return esc(item.message || item.reason || item.action); }).join('<br>');
        if (row.vacancies) conflictText += (conflictText ? '<br>' : '') + esc(row.vacancies + ' vacanc' + (row.vacancies === 1 ? 'y' : 'ies') + ' remaining');
        return '<tr data-mixed-shift="' + esc(row.shiftId) + '"><td><strong>' + esc(row.date) + '</strong></td><td>' + names(row.assignedIds) + '</td><td>' + names(row.repairIds) + '</td><td>' + (conflictText || '<span class="text-muted">None</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<p class="hours-note">Scope: ' + esc(model.maxRepeat) + ' occurrence' + (model.maxRepeat === 1 ? '' : 's') + '. ' + repairs.length + ' manual substitute proposal' + (repairs.length === 1 ? '' : 's') + '. Later occurrences remain unstaffed unless another saved policy covers them.</p>';
    el.innerHTML = '<div class="modal-overlay hours-allocation-overlay"><div class="modal-card modal-lg hours-modal hours-allocation-modal mixed-policy-plan-modal" role="dialog" aria-modal="true" aria-labelledby="mixed-policy-title" tabindex="-1"><header class="modal-header hours-modal-header"><div><h2 id="mixed-policy-title">Mixed-policy occurrence plan</h2><p>Review fixed, rotation and manual outcomes before saving</p></div><button type="button" class="btn btn-secondary" data-mixed-action="close">Close</button></header><div class="modal-body hours-modal-body">' + content + '</div><footer class="modal-footer hours-modal-footer"><p>Approval stages repairs only; Confirm &amp; Save Allocation persists the plan.</p><button type="button" class="btn btn-secondary" data-mixed-action="refresh">Refresh</button><button type="button" class="btn btn-secondary" data-mixed-action="close">Cancel</button><button type="button" class="btn btn-primary" data-mixed-action="approve"' + (error || !model || !model.success ? ' disabled' : '') + '>Approve plan</button></footer></div></div>';
  }
  function refresh() {
    try {
      context = window.HortOpsApp.getMixedPolicyPlanDraft(shiftId);
      model = context.model;
      if (!model || !model.success) throw new Error(model && model.errors && model.errors[0] || 'Mixed-policy plan unavailable.');
      render(); return true;
    } catch (error) { context = null; model = null; render(error.message); return false; }
  }
  function approve() {
    if (!fresh()) { context = null; model = null; render('The workspace or staged policies changed. Refresh the proposal.'); return false; }
    var result = window.HortOpsStaffAssignModal.approveMixedPolicyPlan(context.signature);
    if (!result || result.success === false) { render(result && result.error || 'Plan approval failed.'); return false; }
    close(); return true;
  }
  function open(id) {
    shiftId = id; opener = document.activeElement;
    if (window.HortOpsModalUtils) { window.HortOpsModalUtils.lockBackgroundScroll(); locked = true; }
    refresh();
    var panel = root() && root().querySelector('.mixed-policy-plan-modal'); if (panel) panel.focus();
    timer = window.setInterval(function () { if (context && !fresh()) { context = null; model = null; render('The workspace or staged policies changed. Refresh the proposal.'); } }, 1000);
  }
  function close() {
    shiftId = null; context = null; model = null;
    if (timer) window.clearInterval(timer); timer = null;
    if (root()) root().innerHTML = '';
    if (locked && window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll(); locked = false;
    if (opener && opener.isConnected && !opener.disabled) opener.focus({ preventScroll: true }); opener = null;
  }
  document.addEventListener('click', function (event) {
    var action = event.target.closest('[data-mixed-action]');
    if (!action || !root() || !root().contains(action)) return;
    event.preventDefault();
    if (action.getAttribute('data-mixed-action') === 'close') close();
    if (action.getAttribute('data-mixed-action') === 'refresh') refresh();
    if (action.getAttribute('data-mixed-action') === 'approve') approve();
  });
  document.addEventListener('keydown', function (event) { if (shiftId && event.key === 'Escape') { event.preventDefault(); close(); } });
  window.HortOpsMixedPolicyPlanModal = { open: open, close: close, refresh: refresh, approve: approve };
})();
