// Occurrence explanations use detached saved-domain snapshots and have no allocation callback.
(function () {
  'use strict';
  var activeShiftId = null, signature = null, timer = null, locked = false, opener = null;
  var snapshot = null, model = null, stale = false;
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function root() { return document.getElementById('candidate-preview-modal-root'); }
  function savedContext() {
    var app = window.HortOpsApp;
    if (!app || typeof app.getSavedCandidatePreviewContext !== 'function') throw new Error('Saved occurrence reader is unavailable.');
    var result = app.getSavedCandidatePreviewContext(activeShiftId);
    if (!result || result.error || !result.occurrence) throw new Error(result && result.error || 'This occurrence is no longer available in the saved workspace.');
    return result;
  }
  function list(values, empty) {
    if (!values || !values.length) return esc(empty || 'None');
    return values.map(function (v) {
      var label = v && typeof v === 'object' ? v.label || v.name || v.message || v.id || v.code || 'Unknown' : v;
      return esc(label) + (v && typeof v === 'object' && v.active === false ? ' (inactive)' : '');
    }).join(', ');
  }
  function messages(values) {
    return (values || []).map(function (v) {
      return '<li>' + esc(typeof v === 'object' ? v.message || v.code : v) + (v && v.code ? ' <span class="candidate-preview-code">' + esc(v.code) + '</span>' : '') + '</li>';
    }).join('');
  }
  function number(value) { return typeof value === 'number' && isFinite(value) ? String(value) : 'Unknown'; }
  function teamPreferences(prefs) {
    if (!prefs || typeof prefs !== 'object') return 'None';
    if (Array.isArray(prefs)) return list(prefs);
    var parts = [];
    ['primaryTeam', 'secondaryTeam', 'tertiaryTeam'].forEach(function (key, i) {
      if (prefs[key]) parts.push(['Primary', 'Secondary', 'Tertiary'][i] + ': ' + prefs[key]);
    });
    if (prefs.isExclusive) parts.push('Exclusive teams: ' + (prefs.exclusiveTeams || []).join(', '));
    return list(parts);
  }
  function rowFactors(row) {
    if (!row.ranking) return '<p class="candidate-preview-muted">Workforce ranking inputs unavailable.</p>';
    var r = row.ranking || {};
    var hourLabels = { 'stored-zero-unverified': 'Stored zero, unverified (may be import default)', 'stored-hours-unverified': 'Stored hours, unverified', 'default-zero-unverified': 'Missing hours, zero fallback (unverified)' };
    return '<dl class="candidate-preview-factors">' +
      '<div><dt>Preferred pool</dt><dd>' + (r.preferredPoolMatch ? 'Matches' : 'No match') + '</dd></div>' +
      '<div><dt>Team tier</dt><dd>' + (r.teamPreferenceApplied === false ? 'Team Suitability disabled' : esc(number(r.teamTier)) + ' · ' + esc({ 1: 'Primary', 2: 'Secondary', 3: 'Tertiary', 4: 'Exclusive', 5: 'Other' }[r.teamTier] || 'Unknown')) + '</dd></div>' +
      '<div><dt>Fatigue tier</dt><dd>' + esc(r.fatigueTier || 'Unknown') + ' · ' + esc(number(r.consecutiveWeekends)) + ' consecutive weekends</dd></div>' +
      '<div><dt>Plant operator</dt><dd>' + (r.plantOperator ? 'Yes' : 'No') + ' · ordering preference ' + (r.plantOperatorPreferenceApplied ? 'applies' : 'not applied') + '</dd></div>' +
      '<div><dt>Fair-share score</dt><dd>' + (r.mode === 'hours-fallback' ? 'Unavailable; hours fallback applies' : esc(number(r.fairShareScore))) + '</dd></div>' +
      '<div><dt>Overtime input</dt><dd>' + esc(number(r.overtimeHours)) + ' hours · ' + esc(hourLabels[r.hoursSource] || 'Unverified input') + '</dd></div>' +
      '<div><dt>Refusals / fatigue penalty</dt><dd>' + esc(number(r.refusalCount)) + ' / ' + esc(number(r.fatiguePenalty)) + '</dd></div></dl>';
  }
  function rowsSection(kind, title, rows, ranked) {
    var content = (rows || []).map(function (row, index) {
      var checks = messages(row.reasons);
      var warnings = messages(row.warnings);
      var gaps = messages(row.evidenceGaps);
      return '<tr data-candidate-preview-staff="' + esc(row.id) + '">' +
        '<td>' + (ranked ? '<span class="candidate-preview-rank">' + (index + 1) + '</span>' : '') + '<strong>' + esc(row.name || row.id) + '</strong><div class="candidate-preview-muted">' + esc(row.team || 'No team') + ' · ' + esc(row.role || 'No role recorded') + '</div></td>' +
        '<td><span class="candidate-preview-status ' + (row.eligible ? 'candidate-preview-status-eligible' : '') + '">' + (row.eligible ? 'Current individual checks pass' : 'Excluded by current checks') + '</span>' +
        (checks ? '<ul class="candidate-preview-reasons">' + checks + '</ul>' : '') +
        (warnings ? '<ul class="candidate-preview-warnings">' + warnings + '</ul>' : '') +
        (gaps ? '<ul class="candidate-preview-gaps">' + gaps + '</ul>' : '') + '</td><td>' + rowFactors(row) + '</td></tr>';
    }).join('');
    return '<section class="candidate-preview-section" id="candidate-preview-' + kind + '"><h3>' + esc(title) + ' <span class="candidate-preview-count">' + (rows || []).length + '</span></h3>' +
      (content ? '<div class="candidate-preview-table-wrap"><table class="candidate-preview-table"><caption class="candidate-preview-sr-only">' + esc(title) + '</caption><thead><tr><th scope="col">Officer' + (ranked ? ' / order' : '') + '</th><th scope="col">Individual checks and evidence</th><th scope="col">Current ranking inputs</th></tr></thead><tbody>' + content + '</tbody></table></div>' : '<p class="candidate-preview-empty">No ' + esc(title.toLowerCase()) + ' for this occurrence.</p>') + '</section>';
  }
  function previewContent() {
    var s = model.summary || {}, c = model.crew || {};
    var exclusiveTeams = s.exclusiveTeams || snapshot && snapshot.occurrence && snapshot.occurrence.exclusiveTeams;
    if (!exclusiveTeams || !exclusiveTeams.length) exclusiveTeams = snapshot && snapshot.job && snapshot.job.exclusiveTeams || [];
    var exclusiveDescription = s.exclusivePoolSource === 'teams'
      ? 'Exclusive teams: ' + list(exclusiveTeams)
      : s.exclusivePoolSource === 'tags' ? 'Exclusive tags: ' + list(s.exclusivePoolTags) : 'None';
    return '<section class="candidate-preview-context" aria-label="Saved occurrence"><dl>' +
      '<div><dt>Job</dt><dd>' + esc(s.jobName) + '</dd></div><div><dt>Date</dt><dd>' + esc(s.date) + '</dd></div>' +
      '<div><dt>Timing</dt><dd>' + esc(s.startTime || 'Unrecorded') + ' · ' + esc(number(s.durationHours)) + ' hours</dd></div>' +
      '<div><dt>Required crew</dt><dd>' + esc(number(s.crewSize)) + '</dd></div>' +
      '<div><dt>Qualifications</dt><dd>' + list(s.requiredQualifications) + '</dd></div>' +
      '<div><dt>Staffing sections</dt><dd>Team Suitability: ' + (s.staffingSections && s.staffingSections.teams === false ? 'disabled' : 'enabled') + '; Pools: ' + (s.staffingSections && s.staffingSections.pools === false ? 'disabled' : 'enabled') + '</dd></div>' +
      '<div><dt>Preferred pools</dt><dd>' + list(s.preferredPoolTags) + ' (ordering preference)</dd></div>' +
      '<div><dt>Hard pool restriction</dt><dd>' + exclusiveDescription + '</dd></div>' +
      '<div><dt>Team preferences / restrictions</dt><dd>' + teamPreferences(s.preferences) + '</dd></div></dl></section>' +
      '<section class="candidate-preview-section candidate-preview-crew"><h3>Saved crew compliance</h3><p>' + esc(number(c.assignedCount)) + ' assigned / ' + esc(number(c.requiredCount)) + ' required · ' + esc(number(c.vacancies)) + ' vacancies. ' +
      (c.plantOperatorRequired ? 'Plant operator required: ' + (c.plantOperatorPresent ? 'present in saved crew.' : 'missing from saved crew.') : 'No crew plant-operator requirement.') + '</p><ul>' + messages(c.messages) + '</ul><p class="candidate-preview-muted">Individual eligibility and saved crew compliance are separate checks. This preview does not approve or allocate a crew.</p></section>' +
      '<section class="candidate-preview-section candidate-preview-ranking"><h3>How the current order is determined</h3><ol>' + messages(model.rankingOrder) + '</ol><p>' + esc(model.rankingFormula || '') + '</p><p class="candidate-preview-muted">Preferences affect order; hard restrictions exclude candidates. These are the existing ranking inputs, not a new hours-based fairness policy.</p></section>' +
      '<section class="candidate-preview-section candidate-preview-evidence"><h3>Evidence limits</h3><ul>' + messages(model.evidenceGaps) + '</ul></section>' +
      rowsSection('eligible', 'Eligible candidates', model.eligible, true) +
      rowsSection('excluded', 'Excluded staff', model.excluded, false) +
      rowsSection('assigned', 'Already assigned staff', model.assigned, false);
  }
  function render(error) {
    var el = root();
    if (!el || !activeShiftId) return;
    var previous = document.activeElement && document.activeElement.getAttribute('data-candidate-preview-action');
    var body = el.querySelector('.candidate-preview-body');
    var scroll = body ? body.scrollTop : 0;
    el.innerHTML = '<div class="modal-overlay candidate-preview-overlay"><div class="modal-card candidate-preview-modal" role="dialog" aria-modal="true" aria-labelledby="candidate-preview-title" aria-describedby="candidate-preview-description" tabindex="-1">' +
      '<header class="modal-header candidate-preview-header"><div><h2 id="candidate-preview-title">Candidate preview</h2><p id="candidate-preview-description">One saved occurrence · read-only explanation</p></div><button type="button" class="btn btn-secondary" data-candidate-preview-action="close">Close</button></header>' +
      '<div class="modal-body candidate-preview-body">' + (stale || error ? '<div class="candidate-preview-stale" role="alert"><h3>' + (stale ? 'Preview needs refreshing' : 'Preview unavailable') + '</h3><p>' + esc(error || 'Saved workspace or viewing context changed. Refresh to inspect current saved information.') + '</p></div>' : previewContent()) + '</div>' +
      '<footer class="modal-footer candidate-preview-footer"><p>Allocation commands validate independently when saving.</p><button type="button" class="btn btn-secondary" data-candidate-preview-action="refresh">Refresh saved preview</button><button type="button" class="btn btn-secondary" data-candidate-preview-action="close">Close</button></footer></div></div>';
    el.querySelector('.candidate-preview-body').scrollTop = scroll;
    if (previous) {
      var focused = el.querySelector('[data-candidate-preview-action="' + previous + '"]');
      if (focused) focused.focus({ preventScroll: true });
    }
  }
  function close() {
    var el = root();
    activeShiftId = null; signature = null; model = null; snapshot = null; stale = false;
    if (timer) window.clearInterval(timer);
    timer = null;
    document.removeEventListener('keydown', onKeydown, true);
    window.removeEventListener('focus', checkFreshness);
    document.removeEventListener('visibilitychange', checkFreshness);
    if (el) el.replaceChildren();
    if (locked && window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll();
    locked = false;
    if (opener && opener.isConnected && !opener.disabled) opener.focus({ preventScroll: true });
    opener = null;
  }
  function refresh() {
    if (!activeShiftId) return false;
    try {
      var next = savedContext();
      if (!window.HortOpsCandidatePreview || typeof window.HortOpsCandidatePreview.build !== 'function') throw new Error('Candidate explanation model is unavailable.');
      model = window.HortOpsCandidatePreview.build(next);
      if (!model || model.error) throw new Error(model && model.error || 'Candidate explanation could not be built.');
      snapshot = next; signature = next.signature; stale = false;
      render();
      return true;
    } catch (error) {
      snapshot = null; model = null; signature = null; stale = false;
      render(error.message || 'Saved preview could not be read safely.');
      return false;
    }
  }
  function checkFreshness() {
    if (!activeShiftId) return;
    var el = root();
    // Ownership release can remove modal DOM; release our own lock and listeners once.
    if (!el || !el.firstChild) { close(); return; }
    if (stale || !snapshot) return;
    try {
      var app = window.HortOpsApp;
      var currentSignature = app && typeof app.getSavedCandidatePreviewSignature === 'function'
        ? app.getSavedCandidatePreviewSignature(activeShiftId) : savedContext().signature;
      if (currentSignature === signature) return;
    } catch (error) { /* Unreadable saved data invalidates every current claim. */ }
    stale = true; snapshot = null; model = null;
    render();
  }
  function onKeydown(event) {
    if (!activeShiftId) return;
    var el = root(), panel = el && el.querySelector('.candidate-preview-modal');
    if (!panel) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key !== 'Tab') return;
    var buttons = Array.prototype.slice.call(panel.querySelectorAll('button:not([disabled]), [tabindex="0"]'));
    if (!buttons.length) { event.preventDefault(); panel.focus(); return; }
    var index = buttons.indexOf(document.activeElement);
    if (event.shiftKey && index <= 0) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
    else if (!event.shiftKey && (index < 0 || index === buttons.length - 1)) { event.preventDefault(); buttons[0].focus(); }
  }
  function open(shiftId) {
    var el = root();
    if (!el || typeof shiftId !== 'string' || !shiftId) return false;
    if (activeShiftId) close();
    opener = document.activeElement;
    activeShiftId = shiftId;
    if (window.HortOpsModalUtils) { window.HortOpsModalUtils.lockBackgroundScroll(); locked = true; }
    var ok = refresh();
    var panel = el.querySelector('.candidate-preview-modal');
    if (panel) panel.focus({ preventScroll: true });
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('focus', checkFreshness);
    document.addEventListener('visibilitychange', checkFreshness);
    timer = window.setInterval(checkFreshness, 1000);
    return ok;
  }
  document.addEventListener('click', function (event) {
    var el = root();
    if (!activeShiftId || !el || !el.contains(event.target)) return;
    var button = event.target.closest('button[data-candidate-preview-action]');
    if (button) {
      if (button.dataset.candidatePreviewAction === 'close') close();
      if (button.dataset.candidatePreviewAction === 'refresh') refresh();
    } else if (event.target.classList.contains('candidate-preview-overlay')) close();
  });
  window.HortOpsCandidatePreviewModal = Object.freeze({ open: open, refresh: refresh, close: close, checkFreshness: checkFreshness });
}());
