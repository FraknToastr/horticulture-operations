// An operator's verified YTD actual-hours record is appended; existing evidence is never edited here.
(function() {
  'use strict';
  var activeStaffId = null, activeYear = null, opener = null, locked = false;
  function esc(value) { return window.HortOpsSecurityUtils.escapeHtml(String(value == null ? '' : value)); }
  function root() { return document.getElementById('hours-evidence-modal-root'); }
  function today() { return window.HortOpsDateUtils.getLocalDateKey(); }
  function staff() {
    var roster = window.HortOpsApp.state.staffList || [];
    return roster.find(function(person) { return person.id === activeStaffId; });
  }
  function error(message) {
    var el = root() && root().querySelector('[data-hours-evidence-error]');
    if (el) { el.textContent = message; el.hidden = !message; }
  }
  function open(staffId) {
    var el = root();
    if (!el || !staffId) return false;
    if (activeStaffId) close();
    activeStaffId = staffId; activeYear = Number(window.HortOpsApp.state.currentYear);
    var person = staff();
    if (!person) { activeStaffId = null; activeYear = null; return false; }
    opener = document.activeElement;
    if (window.HortOpsModalUtils) { window.HortOpsModalUtils.lockBackgroundScroll(); locked = true; }
    var date = today(), year = String(activeYear), currentYear = Number(date.slice(0,4));
    var through = activeYear === currentYear ? date : activeYear < currentYear ? year + '-12-31' : '';
    var records = (person.overtimeHoursEvidence || []).filter(function(record) { return record.year === activeYear; });
    var history = records.map(function(record) {
      return '<tr><td>' + esc(record.throughDate) + '</td><td>' + esc(record.hours) + '</td><td>' + esc(record.source) + '</td><td>' + esc(record.recordedAt) + '</td></tr>';
    }).join('');
    el.innerHTML = '<div class="modal-overlay hours-evidence-overlay"><div class="modal-card hours-modal hours-evidence-modal" role="dialog" aria-modal="true" aria-labelledby="hours-evidence-title" tabindex="-1"><header class="modal-header hours-modal-header"><div><h2 id="hours-evidence-title">Verified overtime hours</h2><p>' + esc(person.name || person.id) + ' · ' + esc(year) + ' year to date</p></div><button type="button" class="btn btn-secondary" data-hours-evidence-action="close">Close</button></header>' +
      '<div class="modal-body hours-modal-body"><p>Record verified actual overtime from 1 January through the selected date. Planned commitments are counted separately. A verified zero is valid; an imported default zero is not evidence.</p><p>Verification is your confirmation of the source record. The planner does not verify payroll automatically.</p><p data-hours-evidence-error role="alert" class="hours-modal-error" hidden></p>' +
      '<form id="hours-evidence-form"><div class="hours-evidence-fields"><label>Year<input id="hours-evidence-year" class="form-input" type="number" readonly value="' + esc(year) + '"></label>' +
      '<label>Actual hours through date<input id="hours-evidence-through-date" class="form-input" type="date" required min="' + esc(year) + '-01-01" max="' + esc(activeYear < currentYear ? year + '-12-31' : date) + '" value="' + esc(through) + '"></label>' +
      '<label>YTD actual overtime hours<input id="hours-evidence-hours" class="form-input" type="number" min="0" step="any" required placeholder="Including explicit verified zero"></label>' +
      '<label>Source / reference<input id="hours-evidence-source" class="form-input" type="text" required placeholder="Payroll report or verified source reference"></label></div>' +
      '<label class="hours-review"><input id="hours-evidence-verified" type="checkbox" required><span>I have verified the stated actual overtime hours for this officer from 1 January through this date against the identified source.</span></label></form>' +
      '<section class="hours-modal-section"><h3>Existing ' + esc(year) + ' evidence</h3><p>Earlier records are retained. Add a corrected cumulative record when necessary.</p>' + (history ? '<div class="hours-table-wrap"><table class="hours-table"><thead><tr><th>Through date</th><th>YTD actual hours</th><th>Source</th><th>Recorded at</th></tr></thead><tbody>' + history + '</tbody></table></div>' : '<p class="hours-muted">No verified actual-hours evidence recorded for this year.</p>') + '</section></div>' +
      '<footer class="modal-footer hours-modal-footer"><p>Saving appends an evidence record to this officer.</p><button type="button" class="btn btn-secondary" data-hours-evidence-action="close">Cancel</button><button type="button" class="btn btn-primary" data-hours-evidence-action="save">Save verified hours</button></footer></div></div>';
    if (activeYear > currentYear) error('A future year has no actual year-to-date hours to verify. Select the relevant year in the planner before recording evidence.');
    el.querySelector('.hours-evidence-modal').focus({preventScroll:true});
    document.addEventListener('keydown', keydown, true);
    return true;
  }
  function save() {
    if (!activeStaffId || !root()) return false;
    if (Number(window.HortOpsApp.state.currentYear) !== activeYear || !staff()) { error('Workspace or selected year changed. Close and reopen to review current values.'); return false; }
    var form = document.getElementById('hours-evidence-form');
    if (!form || !form.reportValidity()) return false;
    var date = document.getElementById('hours-evidence-through-date').value;
    var value = document.getElementById('hours-evidence-hours').value;
    var source = document.getElementById('hours-evidence-source').value.trim();
    var verified = document.getElementById('hours-evidence-verified').checked;
    var hours = Number(value);
    if (!verified || !source || value === '' || !isFinite(hours) || hours < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number(date.slice(0,4)) !== activeYear || date > today()) {
      error('Provide nonnegative actual hours, a date in the selected year no later than today, a source and your verification.'); return false;
    }
    try {
      var result = window.HortOpsApp.recordOvertimeHoursEvidence(activeStaffId, {year:activeYear,throughDate:date,hours:hours,source:source});
      if (!result || result.success === false || result.ok === false) { error(result && result.error || 'The evidence could not be saved. Existing records remain unchanged.'); return false; }
      close(); return true;
    } catch (failure) { error(failure.message || 'The evidence could not be saved.'); return false; }
  }
  function close() {
    activeStaffId = null; activeYear = null;
    if (root()) root().replaceChildren();
    document.removeEventListener('keydown', keydown, true);
    if (locked && window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll();
    locked = false;
    if (opener && opener.isConnected && !opener.disabled) opener.focus({preventScroll:true});
    opener = null;
  }
  function keydown(event) {
    var panel = activeStaffId && root() && root().querySelector('.hours-evidence-modal');
    if (!panel) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); return; }
    if (event.key === 'Tab') {
      var items = Array.prototype.slice.call(panel.querySelectorAll('input:not([disabled]):not([readonly]), button:not([disabled])'));
      var index = items.indexOf(document.activeElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length-1].focus(); }
      if (!event.shiftKey && (index === items.length-1 || index < 0)) { event.preventDefault(); items[0].focus(); }
    }
  }
  document.addEventListener('click', function(event) {
    var launcher = event.target.closest && event.target.closest('[data-hours-evidence-staff]');
    if (launcher) {
      event.preventDefault(); event.stopPropagation();
      open(launcher.getAttribute('data-hours-evidence-staff'));
      return;
    }
    var el = root(); if (!activeStaffId || !el || !el.contains(event.target)) return;
    var button = event.target.closest('button[data-hours-evidence-action]');
    if (button && button.dataset.hoursEvidenceAction === 'save') save();
    else if (button && button.dataset.hoursEvidenceAction === 'close' || event.target.classList.contains('hours-evidence-overlay')) close();
  });
  document.addEventListener('submit', function(event) { if (event.target.id === 'hours-evidence-form') { event.preventDefault(); save(); } });
  window.HortOpsHoursEvidenceModal = {open:open,save:save,close:close};
}());
