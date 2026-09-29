// Job Edit Modal Recurrence & Frequency Form Sub-module
// Renders cadence selectors, annual targets, one-off dates, and recurring interval / anchor controls.
window.HortOpsJobEditRecurrenceForm = {
  render: function(ctx) {
    var data = ctx.data;
    var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) || function(s) { return s || ''; };

    if (data.frequencyType === 'annual') {
      return '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">' +
        '<div>' +
          '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Frequency Cadence</label>' +
          '<select class="form-select" onchange="window.HortOpsJobEditModal.updateField(\'frequencyType\', this.value); window.HortOpsJobEditModal.renderModal();">' +
            '<option value="recurring_weeks">Recurring Every N Weeks</option>' +
            '<option value="annual" selected>Annual Shift</option>' +
            '<option value="one_off">One-off Shift</option>' +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Target Month *</label>' +
          '<select class="form-select" onchange="window.HortOpsJobEditModal.updateField(\'targetMonth\', parseInt(this.value, 10))">' +
            ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(function(mName, mIdx) {
              var mVal = mIdx + 1;
              return '<option value="' + mVal + '"' + ((data.targetMonth || 2) === mVal ? ' selected' : '') + '>' + mName + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
      '</div>';
    }

    if (data.frequencyType === 'one_off') {
      return '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">' +
        '<div>' +
          '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Frequency Cadence</label>' +
          '<select class="form-select" onchange="window.HortOpsJobEditModal.updateField(\'frequencyType\', this.value); window.HortOpsJobEditModal.renderModal();">' +
            '<option value="recurring_weeks">Recurring Every N Weeks</option>' +
            '<option value="annual">Annual Shift</option>' +
            '<option value="one_off" selected>One-off Shift</option>' +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Target Overtime Date *</label>' +
          '<input type="date" class="form-input" required value="' + escAttr(data.targetDate || '') + '" onchange="window.HortOpsJobEditModal.updateField(\'targetDate\', this.value)" />' +
        '</div>' +
      '</div>';
    }

    // Default: Recurring Every N Weeks
    return '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">' +
      '<div>' +
        '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Frequency Cadence</label>' +
        '<select class="form-select" onchange="window.HortOpsJobEditModal.updateField(\'frequencyType\', this.value); window.HortOpsJobEditModal.renderModal();">' +
          '<option value="recurring_weeks" selected>Recurring Every N Weeks</option>' +
          '<option value="annual">Annual Shift</option>' +
          '<option value="one_off">One-off Shift</option>' +
        '</select>' +
      '</div>' +
      '<div>' +
        '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Interval (Every N Weeks)</label>' +
        '<input type="number" min="1" max="52" class="form-input" value="' + (data.intervalWeeks || 4) + '" oninput="window.HortOpsJobEditModal.updateField(\'intervalWeeks\', parseInt(this.value, 10))" />' +
      '</div>' +
    '</div>' +
    '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: var(--slate-50); padding: 0.5rem; border-radius: 6px; border: 1px solid var(--slate-200);">' +
      '<div>' +
        '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Anchor Start Date (Required for recurring)</label>' +
        '<input type="date" class="form-input" required value="' + escAttr(data.anchorDate || '') + '" onchange="window.HortOpsJobEditModal.handleAnchorDateChange(this.value)" />' +
        '<span style="font-size: 11px; color: var(--slate-500);">Specific date job must start from</span>' +
      '</div>' +
      '<div>' +
        '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Anchor Week</label>' +
        '<input type="number" min="1" max="53" class="form-input" id="jem-anchor-week" value="' + (data.anchorWeek || 1) + '" oninput="window.HortOpsJobEditModal.updateField(\'anchorWeek\', parseInt(this.value, 10))" />' +
        '<span style="font-size: 11px; color: var(--slate-500);">Starting baseline week</span>' +
      '</div>' +
    '</div>';
  }
};
