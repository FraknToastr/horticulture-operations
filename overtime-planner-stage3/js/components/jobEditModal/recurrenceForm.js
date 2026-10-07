// Canonical recurrence editor: the cadence control is present in every mode.
(function () {
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
    function field(label, path, value, type, numeric, attrs) {
        return '<label>' + esc(label) + '<input aria-label="' + esc(label) + '" class="form-input" type="' + (type || 'text') + '" value="' + esc(value) + '" ' + (attrs || '') + ' onchange="window.HortOpsJobEditModal.setRecurrenceField(\'' + path + '\', ' + (numeric ? 'Number(this.value)' : 'this.value') + ')" /></label>';
    }
    function select(label, path, value, options, numeric) {
        return '<label>' + esc(label) + '<select aria-label="' + esc(label) + '" class="form-select" onchange="window.HortOpsJobEditModal.setRecurrenceField(\'' + path + '\', ' + (numeric ? 'Number(this.value)' : 'this.value') + ')">' +
            options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(value) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>';
    }
    function days(path, rule) {
        return '<div class="recurrence-days">' + [[6,'Saturday'],[0,'Sunday'],[5,'Friday public holidays'],[1,'Monday public holidays']].map(function (d) {
            return '<label><input type="checkbox"' + ((rule.days || []).indexOf(d[0]) !== -1 ? ' checked' : '') + ' onchange="window.HortOpsJobEditModal.setRecurrenceDay(\'' + path + '.days\',' + d[0] + ',this.checked)" /> ' + d[1] + '</label>';
        }).join('') + '<label><input type="checkbox"' + (rule.includePublicHolidays ? ' checked' : '') + ' onchange="window.HortOpsJobEditModal.setRecurrenceField(\'' + path + '.includePublicHolidays\',this.checked)" /> Also include eligible Friday/Monday public holidays in interval weeks</label></div>';
    }
  function renderDateCalendars(dates, exemptions, exemptionMode) {
    var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var scheduled = {};
    var publicHolidays = {};
    var months = {};
    (dates || []).forEach(function(date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      scheduled[date] = true;
      months[date.slice(0, 7)] = true;
      var year = Number(date.slice(0, 4));
      if (window.HortOpsData && typeof window.HortOpsData.getPublicHolidaysForYear === 'function') {
        var holiday = window.HortOpsData.getPublicHolidaysForYear(year).find(function(item) { return item.date === date; });
        if (holiday) publicHolidays[date] = holiday.name;
      }
    });
    var monthKeys = Object.keys(months).sort();
    if (!monthKeys.length) return '<div class="recurrence-date-preview-empty">No scheduled dates fall within this preview horizon.</div>';
    return '<div class="recurrence-date-calendar-grid" aria-label="Scheduled date preview">' + monthKeys.map(function(key) {
      var parts = key.split('-');
      var year = Number(parts[0]), month = Number(parts[1]) - 1;
      var firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
      var daysInMonth = new Date(year, month + 1, 0).getDate();
      var cells = [];
      for (var blank = 0; blank < firstDay; blank++) cells.push('<span class="recurrence-calendar-day is-empty" aria-hidden="true"></span>');
      for (var day = 1; day <= daysInMonth; day++) {
        var iso = key + '-' + String(day).padStart(2, '0');
        var isScheduled = !!scheduled[iso];
        var holidayName = publicHolidays[iso];
        var isExempt = (exemptions || []).indexOf(iso) !== -1;
        cells.push('<button type="button" class="recurrence-calendar-day' + (isScheduled ? ' is-scheduled' : '') + (holidayName ? ' is-public-holiday' : '') + (isExempt ? ' is-exempt' : '') + (exemptionMode && isScheduled ? ' is-exemption-selectable' : '') + '"' + (isScheduled ? ' aria-label="' + (isExempt ? 'Exempted ' : 'Scheduled ') + esc(iso) + '"' : ' disabled aria-hidden="true"') + (exemptionMode && isScheduled ? ' onclick="window.HortOpsJobEditModal.toggleRecurrenceExemption(\'' + iso + '\')"' : '') + '>' + day + '</button>');
      }
      return '<section class="recurrence-calendar-month" aria-label="' + esc(monthNames[month] + ' ' + year) + '">' +
        '<h4>' + esc(monthNames[month]) + ' ' + year + '</h4>' +
        '<div class="recurrence-calendar-weekdays"><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span></div>' +
        '<div class="recurrence-calendar-days">' + cells.join('') + '</div>' +
      '</section>';
    }).join('') + '</div>';
  }

  function render(ctx) {
        var d = ctx.data, type = d.frequencyType === 'recurring_cadence' ? 'recurring_weeks' : d.frequencyType;
        var html = '<div class="recurrence-editor"><label>Frequency Cadence<select id="job-cadence" class="form-select" onchange="window.HortOpsJobEditModal.setFrequencyType(this.value)">' +
            [['recurring_weeks','Recurring every N weeks'],['annual','Annual date'],['seasonal','Annual seasonal series'],['one_off','One-off shift'],['work_pattern','Multiple days / public holidays']].map(function (o) {
                return '<option value="' + o[0] + '"' + (type === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
            }).join('') + '</select></label><div class="recurrence-fields">';
        var year = (window.HortOpsApp.state.currentYear || new Date().getFullYear()), r;
        if (type === 'one_off') {
            html += field('Overtime date', 'targetDate', d.targetDate, 'date',false,'required');
        } else if (type === 'recurring_weeks') {
            html += field('First occurrence / anchor date', 'anchorDate', d.anchorDate, 'date',false,'required') +
                field('Every N weeks', 'intervalWeeks', d.intervalWeeks || 1, 'number', true, 'min="1" max="520"') +
                select('Operating day', 'preferredDay', d.preferredDay || 'saturday', [['saturday','Saturday'],['sunday','Sunday'],['friday','Friday public holiday'],['monday','Monday public holiday']]);
        } else if (type === 'annual') {
            r = d.annualRule || {};
            html += select('Annual date rule','annualRule.kind',r.kind || 'fixed',[['fixed','Exact month and day'],['weekday','Nth weekend day of month']]) +
                field('First year','annualRule.startYear',r.startYear || year,'number',true,'min="2020" max="2100"') +
                select('Month','annualRule.month',r.month || '', [['','Choose month']].concat(['January','February','March','April','May','June','July','August','September','October','November','December'].map(function (m,i) {return [i+1,m];})),true);
            if (r.kind === 'weekday') {
                html += select('Which occurrence','annualRule.ordinal',r.ordinal || '',[['','Choose occurrence'],[1,'First'],[2,'Second'],[3,'Third'],[4,'Fourth'],[5,'Fifth'],[-1,'Last']],true) +
                    select('Weekend day','annualRule.weekday',r.weekday == null ? '' : r.weekday,[['','Choose day'],[6,'Saturday'],[0,'Sunday']],true);
            } else html += field('Day of month','annualRule.day',r.day,'number',true,'min="1" max="31"');
        } else if (type === 'seasonal') {
            r = d.seasonalRule || {};
            html += field('First season starts in year','seasonalRule.firstYear',r.firstYear || year,'number',true,'min="2020" max="2100"') +
                field('Season starts (MM-DD)','seasonalRule.start',r.start,'text',false,'placeholder="11-01"') +
                field('Season ends, inclusive (MM-DD)','seasonalRule.end',r.end,'text',false,'placeholder="02-28"') +
                field('Interval anchor in season (MM-DD)','seasonalRule.anchor',r.anchor,'text',false,'placeholder="11-07"') +
                field('Every N weeks','seasonalRule.intervalWeeks',r.intervalWeeks || 1,'number',true,'min="1" max="52"');
        } else if (type === 'work_pattern') {
            r = d.workPattern || {};
            html += select('Pattern','workPattern.mode',r.mode || 'weekly',[['weekly','Selected days every N weeks'],['run','One consecutive operating-day run']]) +
                field('First date','workPattern.startDate',r.startDate,'date',false,'required');
            if (r.mode === 'run') html += field('Run length (calendar days)','workPattern.runLength',r.runLength || 1,'number',true,'min="1" max="4"');
            else html += field('Every N weeks','workPattern.intervalWeeks',r.intervalWeeks || 1,'number',true,'min="1" max="52"');
            html += field('Optional final pattern date','workPattern.endDate',r.endDate,'date');
        }
        html += '</div>';
        if (type === 'seasonal' || (type === 'work_pattern' && r.mode !== 'run')) html += days(type === 'seasonal' ? 'seasonalRule' : 'workPattern',r);
        if (type !== 'one_off' && !(type === 'work_pattern' && r.mode === 'run')) {
            var end = d.scheduleEnd || {mode:'never'};
            html += '<div class="recurrence-fields">' + select('End series','scheduleEnd.mode',end.mode,[['never',type === 'seasonal' ? 'At season end, repeat each year' : 'No end'],['on_date','On inclusive date'],['after_count',type === 'seasonal' ? 'After N occurrences per season' : 'After N occurrences']]);
            if (end.mode === 'on_date') html += field('Inclusive end date','scheduleEnd.date',end.date,'date');
            if (end.mode === 'after_count') html += field(type === 'seasonal' ? 'Staffable occurrences per season' : 'Staffable occurrences','scheduleEnd.count',end.count,'number',true,'min="1" max="10000"');
            html += '</div>';
        }
        html += '<p>Operating dates are Saturdays and Sundays, plus Friday/Monday public holidays recognised by the application. Each selected day counts as one occurrence.</p>';
        if (type === 'annual') html += '<p>An exact annual date outside the operating calendar is skipped, not moved. February 29 occurs only in eligible leap years.</p>';
        if (type === 'seasonal') html += '<p>An end month/day earlier than the start means the following year. Interval weeks and occurrence counts continue across New Year; the count starts afresh each season.</p>';
        var recurrence = window.HortOpsRecurrence, check = recurrence.validate(d);
        var range = window.HortOpsApp.state.uiState && window.HortOpsApp.state.uiState.planningRange;
        var from = range ? range.start : String(type === 'annual' ? (d.annualRule || {}).startYear || year : type === 'seasonal' ? (d.seasonalRule || {}).firstYear || year : year) + '-01-01';
        var to = range ? range.end : String(Number(from.slice(0,4))+1) + '-12-31';
        var exemptions = Array.from(new Set([].concat(d.excludedDates || [], (d.workPattern && d.workPattern.excludedDates) || []))).sort();
        var previewData = JSON.parse(JSON.stringify(d)); delete previewData.excludedDates;
        if (previewData.workPattern) previewData.workPattern.excludedDates = [];
        var dates = check.valid ? recurrence.datesInRange(previewData,from,to) : [];
        var exemptionEligible = type !== 'one_off';
        var exemptionMode = exemptionEligible && window.HortOpsJobEditModal.recurrencePreviewMode === 'exemption';
        var slider = exemptionEligible ? '<div class="recurrence-preview-slider"><button type="button" class="' + (!exemptionMode ? 'is-active' : '') + '" onclick="window.HortOpsJobEditModal.setRecurrencePreviewMode(\'preview\')">Preview</button><button type="button" class="' + (exemptionMode ? 'is-active' : '') + '" onclick="window.HortOpsJobEditModal.setRecurrencePreviewMode(\'exemption\')">Exemption</button></div>' : 'Preview dates';
        var exemptionList = exemptions.length ? '<section class="recurrence-exemption-list"><h4>Exemption dates</h4><div>' + exemptions.map(function(date) { return '<button type="button" class="recurrence-exemption-chip" onclick="window.HortOpsJobEditModal.toggleRecurrenceExemption(\'' + esc(date) + '\')">' + esc(date) + ' ×</button>'; }).join('') + '</div></section>' : '';
        html += '<div class="recurrence-preview" role="status"><div class="recurrence-date-preview-heading">' + slider + '<span>' + (check.valid ? dates.length + ' occurrence(s)' : '') + '</span></div>' + (check.valid ? renderDateCalendars(dates,exemptions,exemptionMode) : '<div class="recurrence-date-preview-empty">' + esc(check.error) + '</div>') + exemptionList + '</div></div>';
        return html;
    }
    window.HortOpsJobEditRecurrenceForm = {render:render,renderCanonical:render};
}());
