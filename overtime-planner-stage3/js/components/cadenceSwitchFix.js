// One explicit change path for every cadence; keep drafts while switching.
(function () {
  var modal = window.HortOpsJobEditModal;
  modal.recurrencePreviewMode = 'preview';
  modal.setRecurrencePreviewMode = function(mode) {
    this.recurrencePreviewMode = mode === 'exemption' ? 'exemption' : 'preview';
    this.renderModal();
  };
  modal.toggleRecurrenceExemption = function(date) {
    var d = this.formData || this.data;
    if (!d || d.frequencyType === 'one_off' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    var dates = Array.from(new Set([].concat(d.excludedDates || [], (d.workPattern && d.workPattern.excludedDates) || [])));
    var index = dates.indexOf(date);
    if (index === -1) dates.push(date); else dates.splice(index, 1);
    d.excludedDates = dates.sort();
    if (d.workPattern) d.workPattern.excludedDates = [];
    this.renderModal();
  };
    window.HortOpsJobEditRecurrenceForm.render = window.HortOpsJobEditRecurrenceForm.renderCanonical;
    modal.setFrequencyType = function (type) {
        if (['one_off','annual','seasonal','recurring_weeks','work_pattern'].indexOf(type) === -1) return;
        var d = this.formData || this.data;
        if (!d) return;
        this._cadenceDrafts = this._cadenceDrafts || {};
        this._cadenceDrafts[d.frequencyType] = JSON.parse(JSON.stringify(d.scheduleEnd || {mode:'never'}));
        d.frequencyType = type;
        d.scheduleEnd = this._cadenceDrafts[type] || {mode:'never'};
        var year = window.HortOpsApp.state.currentYear;
        if (type === 'annual' && !d.annualRule) d.annualRule = {kind:'fixed',startYear:year};
        if (type === 'seasonal' && !d.seasonalRule) d.seasonalRule = {firstYear:year,start:'',end:'',anchor:'',intervalWeeks:1,days:[6],includePublicHolidays:false};
        if (type === 'work_pattern' && !d.workPattern) d.workPattern = {mode:'weekly',startDate:'',intervalWeeks:1,runLength:1,days:[6,0],includePublicHolidays:false,excludedDates:[]};
        this.renderModal();
    };
    modal.setRecurrenceField = function (path, value) {
        if (!/^(targetDate|anchorDate|intervalWeeks|preferredDay|annualRule\.(kind|startYear|month|day|weekday|ordinal)|seasonalRule\.(firstYear|start|end|anchor|intervalWeeks|includePublicHolidays)|workPattern\.(mode|startDate|endDate|intervalWeeks|runLength|includePublicHolidays)|scheduleEnd\.(mode|date|count))$/.test(path)) return;
        var d = this.formData || this.data, parts = path.split('.');
        if (!d) return;
        if (parts.length === 1) d[path] = value;
        else { d[parts[0]] = d[parts[0]] || {}; d[parts[0]][parts[1]] = value; }
        this.renderModal();
    };
    modal.setRecurrenceDay = function (path, day, checked) {
        if (['seasonalRule.days','workPattern.days'].indexOf(path) === -1 || [0,1,5,6].indexOf(day) === -1) return;
        var d = this.formData || this.data, r = d && d[path.split('.')[0]];
        if (!r) return;
        r.days = (r.days || []).filter(function (v) { return v !== day; });
        if (checked) r.days.push(day);
        this.renderModal();
    };
    var open = modal.open;
    modal.open = function () { this._cadenceDrafts = {}; return open.apply(this,arguments); };
}());
