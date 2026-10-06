// Discoverable Stage 4B work-pattern editor. Keeps the existing canonical pattern contract unchanged.
(function () {
  'use strict';
  var job = window.HortOpsJobEditModal;
  var recurrence = window.HortOpsJobEditRecurrenceForm;
  if (!job || !recurrence) return;

  var dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var originalRecurrence = recurrence.render;
  var originalRenderModal = job.renderModal;

  function esc(value) { return window.HortOpsSecurityUtils.escapeHtml(String(value == null ? '' : value)); }
  function attr(value) { return window.HortOpsSecurityUtils.escapeHtmlAttr(String(value == null ? '' : value)); }
  function defaultPattern() {
    return { mode: 'weekly', startDate: new Date().getFullYear() + '-01-01', days: [6, 0], runLength: 1, includePublicHolidays: false, excludedDates: [] };
  }
  function pattern(data) {
    if (!data.workPattern) data.workPattern = defaultPattern();
    return data.workPattern;
  }
  function consecutiveDays(start, count) {
    var days = [];
    for (var index = 0; index < count; index++) days.push((start + index) % 7);
    return days;
  }
  function selectedStart(current) {
    return Array.isArray(current.days) && current.days.length ? Number(current.days[0]) : 6;
  }
  function previewDates(data, current) {
    var year = Number(String(current.startDate || '').slice(0, 4));
    if (!Number.isInteger(year)) year = new Date().getFullYear();
    var generated = window.HortOpsPlanningRules.dates(data, year);
    var today = window.HortOpsDateUtils.getLocalDateKey();
    var upcoming = generated.filter(function (date) { return date >= today; }).slice(0, 8);
    return { year: year, count: generated.length, upcoming: upcoming };
  }
  function dateList(values) {
    if (!values.length) return '<span class="work-pattern-empty">No upcoming dates in this year.</span>';
    return values.map(function (date) { return '<time class="work-pattern-date" datetime="' + attr(date) + '">' + esc(date) + '</time>'; }).join('');
  }

  job.setConsecutivePattern = function (start, count) {
    if (!this.formData) return;
    var current = pattern(this.formData);
    current.mode = 'weekly';
    current.days = consecutiveDays(Number(start), Number(count));
    current.runLength = 1;
    this.formData.workPattern = current;
    this.renderModal();
  };

  recurrence.render = function (ctx) {
    var data = ctx.data;
    if (data.frequencyType !== 'work_pattern') return originalRecurrence.call(this, ctx);
    var current = pattern(data);
    var start = selectedStart(current);
    var length = Math.max(1, Math.min(4, Array.isArray(current.days) ? current.days.length : 1));
    var preview = previewDates(data, current);
    var scheduleLabel = current.mode === 'run'
      ? 'One consecutive run of ' + Number(current.runLength || 1) + ' day' + (Number(current.runLength || 1) === 1 ? '' : 's')
      : 'Repeats every ' + (length === 1 ? dayNames[start] : dayNames[start] + '–' + dayNames[(start + length - 1) % 7]);

    return '<section class="work-pattern-editor" aria-labelledby="work-pattern-heading">' +
      '<div class="work-pattern-heading"><div><p class="work-pattern-kicker">Job schedule</p><h3 id="work-pattern-heading">Multi-day pattern</h3><p>Choose when this job occurs. Each selected date becomes a separate, staffable occurrence.</p></div><output class="work-pattern-summary">' + esc(scheduleLabel) + '</output></div>' +
      '<label class="work-pattern-select">Schedule type<select class="form-select" data-pattern="mode"><option value="weekly"' + (current.mode === 'weekly' ? ' selected' : '') + '>Repeating consecutive days</option><option value="run"' + (current.mode === 'run' ? ' selected' : '') + '>One consecutive run</option></select><small>' + (current.mode === 'weekly' ? 'Use the same one-to-four-day run each week.' : 'Create a single one-to-four-day job.') + '</small></label>' +
      '<div class="work-pattern-fields">' +
        '<label>Starts<input class="form-input" type="date" data-pattern="startDate" value="' + attr(current.startDate || '') + '"></label>' +
        (current.mode === 'weekly'
          ? '<label>Ends <span class="work-pattern-optional">optional</span><input class="form-input" type="date" data-pattern="endDate" value="' + attr(current.endDate || '') + '"></label>' +
            '<label>First day<select class="form-select" data-consecutive-start>' + dayNames.map(function (name, index) { return '<option value="' + index + '"' + (index === start ? ' selected' : '') + '>' + name + '</option>'; }).join('') + '</select></label>' +
            '<label>Consecutive days<select class="form-select" data-consecutive-length>' + [1, 2, 3, 4].map(function (value) { return '<option value="' + value + '"' + (value === length ? ' selected' : '') + '>' + value + ' day' + (value === 1 ? '' : 's') + '</option>'; }).join('') + '</select></label>' +
            '<label class="work-pattern-checkbox"><input type="checkbox" data-pattern="includePublicHolidays"' + (current.includePublicHolidays ? ' checked' : '') + '> Include full-day public holidays inside the date range</label>'
          : '<label>Consecutive days<input class="form-input" type="number" min="1" max="4" data-pattern="runLength" value="' + attr(Number(current.runLength || 1)) + '"></label>') +
      '</div>' +
      '<div class="work-pattern-days" aria-label="Selected operational days">' + (current.mode === 'weekly' ? consecutiveDays(start, length).map(function (day) { return '<span>' + esc(dayNames[day].slice(0, 3)) + '</span>'; }).join('') : '<span>Daily occurrences are created from the start date for the selected run length.</span>') + '</div>' +
      '<label class="work-pattern-exclusions">Dates to exclude <span class="work-pattern-optional">one per line</span><textarea class="form-input" rows="2" data-pattern="excludedDates" placeholder="YYYY-MM-DD">' + esc((current.excludedDates || []).join('\n')) + '</textarea></label>' +
      '<aside class="work-pattern-preview"><div><strong>' + preview.count + ' occurrence' + (preview.count === 1 ? '' : 's') + ' in ' + preview.year + '</strong><span>Preview uses the current form only; saving is still required.</span></div><div class="work-pattern-date-list">' + dateList(preview.upcoming) + '</div></aside>' +
      '<p class="work-pattern-helper">To limit how long a repeating job exists, set an end date. Staff continuity is configured later in the Staff Allocator with Fixed or Rotation and an occurrence count.</p>' +
    '</section>';
  };

  job.renderModal = function () {
    originalRenderModal.apply(this, arguments);
    if (!this.formData || this.formData.frequencyType !== 'work_pattern') return;
    var root = document.getElementById('job-edit-modal-root');
    if (!root) return;
    var priorChange = root.onchange;
    root.onchange = function (event) {
      var target = event.target;
      if (target && (target.hasAttribute('data-consecutive-start') || target.hasAttribute('data-consecutive-length'))) {
        var current = pattern(job.formData);
        var start = target.hasAttribute('data-consecutive-start') ? Number(target.value) : selectedStart(current);
        var length = target.hasAttribute('data-consecutive-length') ? Number(target.value) : Math.max(1, Math.min(4, (current.days || []).length || 1));
        job.setConsecutivePattern(start, length);
        return;
      }
      if (typeof priorChange === 'function') priorChange.call(this, event);
    };
  };
}());
