// Review an overtime-hours proposal before staging it in the existing allocator.
(function () {
  'use strict';
  var shiftId = null, context = null, model = null, timer = null;
  var opener = null, locked = false, stale = false;
  function esc(value) { return window.HortOpsSecurityUtils.escapeHtml(String(value == null ? '' : value)); }
  function attr(value) { return window.HortOpsSecurityUtils.escapeHtmlAttr(String(value == null ? '' : value)); }
  function root() { return document.getElementById('hours-allocation-modal-root'); }
  function number(value) { return typeof value === 'number' && isFinite(value) ? esc(value) : 'Unknown'; }
  function message(value) { return value && typeof value === 'object' ? value.message || value.code || '' : value; }
  function messages(values) {
    return (values || []).map(function (value) { return '<li>' + esc(message(value)) + '</li>'; }).join('');
  }
  function rowsHtml() {
    return (model.staffRows || []).map(function (row) {
      var record = row.evidence;
      var selected = (model.selectedIds || []).indexOf(row.id) !== -1;
      var status = row.assigned ? 'Preserved saved / staged crew' : selected ? 'Proposed addition' :
        row.unknown ? 'Unknown verified actual hours' : row.eligible ? 'Available, not selected' : 'Excluded by current hard checks';
      var reasons = messages(row.reasons), warnings = messages(row.warnings);
      return '<tr data-hours-staff="' + attr(row.id) + '"><td><strong>' + esc(row.name || row.id) + '</strong>' +
        '<div class="hours-muted">' + esc(status) + '</div>' +
        (reasons ? '<ul class="hours-row-reasons">' + reasons + '</ul>' : '') +
        (warnings ? '<ul class="hours-row-warnings">' + warnings + '</ul>' : '') + '</td>' +
        '<td>' + (row.unknown ? 'Unknown' : number(row.actualHours)) +
        (record ? '<div class="hours-muted">1 January–' + esc(record.throughDate) + '<br>' + esc(record.source) + '</div>' :
          '<div class="hours-muted">No verified same-year actual-hours record</div>') + '</td>' +
        '<td>' + number(row.plannedHours) + '</td><td>' + number(row.baseHours) + '</td><td>' + number(row.projectedHours) + '</td></tr>';
    }).join('');
  }
  function render(error) {
    var el = root();
    if (!el || !shiftId) return;
    var body = el.querySelector('.hours-modal-body');
    var scroll = body ? body.scrollTop : 0;
    var focusedAction = document.activeElement && document.activeElement.getAttribute('data-hours-allocation-action');
    var occurrence = context && context.occurrence || {};
    var title = occurrence.jobName || context && context.job && context.job.name || '';
    var selected = model && model.selectedIds || [];
    var preserved = context && context.stagedIds || [];
    var content;
    if (stale || error) {
      content = '<div class="hours-allocation-stale hours-modal-limit" role="alert"><h3>' +
        (stale ? 'Proposal needs refreshing' : 'Proposal unavailable') + '</h3><p>' +
        esc(error || 'Saved data, staged crew or viewing context changed. Refresh to rebuild the proposal.') + '</p></div>';
    } else {
      content = '<section class="hours-modal-summary"><h3>' + esc(title) + '</h3><p>' + esc(occurrence.date) + ' · ' +
        esc(occurrence.startTime || 'Unrecorded timing') + ' · ' + number(occurrence.durationHours) + ' hours · ' +
        number(occurrence.crewSize) + ' required crew</p><p>' + preserved.length + ' saved / staged officers preserved · ' +
        selected.length + ' proposed additions · ' + number(model.shortage) + ' vacancies remain</p></section>' +
        '<section class="hours-modal-limit"><h3>Overtime-hours policy</h3><p>Existing pool and team preferences are preserved. ' +
        'Eligible candidates are compared using verified year-to-date actual overtime plus saved future overtime commitments. ' +
        'Raw hours have no refusal bonus. Regular hours are not considered or factored.</p><ul>' + messages(model.messages) + '</ul></section>' +
        '<section class="hours-modal-section"><h3>Hours and selection</h3><p class="hours-muted">Actual and planned overtime remain separate. ' +
        'Unknown evidence is never treated as zero. After proposal includes this occurrence only for proposed additions.</p>' +
        '<div class="hours-table-wrap"><table class="hours-table"><thead><tr><th scope="col">Officer / proposal</th>' +
        '<th scope="col">Verified YTD actual / evidence</th><th scope="col">Future planned</th>' +
        '<th scope="col">Actual + planned</th><th scope="col">After proposal</th></tr></thead><tbody>' + rowsHtml() +
        '</tbody></table></div></section>';
    }
    el.innerHTML = '<div class="modal-overlay hours-allocation-overlay"><div class="modal-card hours-modal hours-allocation-modal" ' +
      'role="dialog" aria-modal="true" aria-labelledby="hours-allocation-title" tabindex="-1"><header class="modal-header hours-modal-header">' +
      '<div><h2 id="hours-allocation-title">Hours allocation proposal</h2><p>Review before staging in the current occurrence</p></div>' +
      '<button type="button" class="btn btn-secondary" data-hours-allocation-action="close">Close</button></header>' +
      '<div class="modal-body hours-modal-body">' + content + '</div><footer class="modal-footer hours-modal-footer">' +
      '<p>Staging changes the open editor only. Use Confirm &amp; Save Allocation to persist.</p>' +
      '<button type="button" class="btn btn-secondary" data-hours-allocation-action="refresh">Refresh proposal</button>' +
      '<button type="button" class="btn btn-secondary" data-hours-allocation-action="close">Cancel</button>' +
      '<button type="button" class="btn btn-primary" data-hours-allocation-action="apply"' +
      (stale || error || !model || model.success === false ? ' disabled' : '') + '>Stage proposal</button></footer></div></div>';
    var nextBody = el.querySelector('.hours-modal-body');
    if (nextBody) nextBody.scrollTop = scroll;
    if (focusedAction) {
      var focused = el.querySelector('[data-hours-allocation-action="' + focusedAction + '"]');
      if (focused && !focused.disabled) focused.focus({ preventScroll: true });
    }
  }
  function refresh() {
    if (!shiftId) return false;
    try {
      var next = window.HortOpsApp.getHoursAllocationDraftContext(shiftId);
      if (!next || next.error || !next.model) {
        throw new Error(next && (next.error || next.model && next.model.messages && next.model.messages.slice(-1)[0]) ||
          'Hours allocation proposal could not be built.');
      }
      context = next; model = next.model; stale = false; render(); return true;
    } catch (failure) {
      context = null; model = null; stale = false; render(failure.message || 'Hours allocation proposal unavailable.'); return false;
    }
  }
  function checkFreshness() {
    if (!shiftId) return;
    if (!root() || !root().firstChild) { close(); return; }
    if (stale || !context) return;
    try { if (window.HortOpsApp.getHoursAllocationSignature(shiftId) === context.signature) return; }
    catch (error) { /* Any unreadable source invalidates current claims. */ }
    stale = true; context = null; model = null; render();
  }
  function apply() {
    checkFreshness();
    if (!shiftId || stale || !context || !model) return false;
    try {
      var result = window.HortOpsStaffAssignModal.applyHoursProposal(context.signature);
      if (!result || result.success === false || result.ok === false) {
        stale = true; context = null; model = null;
        render(result && result.error || 'Proposal could not be staged. Refresh current information.'); return false;
      }
      close(); return true;
    } catch (failure) {
      stale = true; context = null; model = null; render(failure.message || 'Proposal could not be staged.'); return false;
    }
  }
  function open(id) {
    if (!root() || typeof id !== 'string' || !id) return false;
    if (shiftId) close();
    opener = document.activeElement; shiftId = id;
    if (window.HortOpsModalUtils) { window.HortOpsModalUtils.lockBackgroundScroll(); locked = true; }
    var ok = refresh();
    var panel = root().querySelector('.hours-allocation-modal');
    if (panel) panel.focus({ preventScroll: true });
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('focus', checkFreshness);
    document.addEventListener('visibilitychange', checkFreshness);
    timer = window.setInterval(checkFreshness, 1000);
    return ok;
  }
  function close() {
    shiftId = null; context = null; model = null; stale = false;
    if (timer) window.clearInterval(timer); timer = null;
    document.removeEventListener('keydown', keydown, true);
    window.removeEventListener('focus', checkFreshness);
    document.removeEventListener('visibilitychange', checkFreshness);
    if (root()) root().replaceChildren();
    if (locked && window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll();
    locked = false;
    if (opener && opener.isConnected && !opener.disabled) opener.focus({ preventScroll: true });
    opener = null;
  }
  function keydown(event) {
    var panel = shiftId && root() && root().querySelector('.hours-allocation-modal');
    if (!panel) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
    if (event.key === 'Tab') {
      var items = Array.prototype.slice.call(panel.querySelectorAll('button:not([disabled])'));
      var index = items.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length - 1].focus(); }
      if (!event.shiftKey && (index < 0 || index === items.length - 1)) { event.preventDefault(); items[0].focus(); }
    }
  }
  document.addEventListener('click', function (event) {
    var el = root();
    if (!shiftId || !el || !el.contains(event.target)) return;
    var button = event.target.closest('button[data-hours-allocation-action]');
    if (button && button.dataset.hoursAllocationAction === 'refresh') refresh();
    else if (button && button.dataset.hoursAllocationAction === 'apply') apply();
    else if (button && button.dataset.hoursAllocationAction === 'close' || event.target.classList.contains('hours-allocation-overlay')) close();
  });
  window.HortOpsHoursAllocationModal = { open: open, refresh: refresh, apply: apply, close: close, checkFreshness: checkFreshness };
}());
