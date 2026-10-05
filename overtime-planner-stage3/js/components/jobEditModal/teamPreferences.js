// Job Edit Modal Team Preferences Sub-module
// Handles team suitability hierarchy (Primary, Secondary, Tertiary) and exclusive team constraints.
window.HortOpsJobEditTeamPreferences = {
  renderTeamOptionsGrouped: function(ctx, selectedVal) {
    var depts = ctx.depts;
    var deptMap = ctx.deptMap;
    var allKnownTeams = ctx.allKnownTeams;
    var escHtml = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s || ''; };
    var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) || function(s) { return s || ''; };

    var groupsHtml = depts.map(function(dept) {
      var teams = deptMap[dept] || [];
      return '<optgroup label="' + escAttr(dept) + '">' +
        teams.map(function(t) {
          return '<option value="' + escAttr(t) + '"' + (selectedVal === t ? ' selected' : '') + '>' + escHtml(t) + '</option>';
        }).join('') +
      '</optgroup>';
    }).join('');

    if (selectedVal && allKnownTeams.indexOf(selectedVal) === -1) {
      groupsHtml += '<optgroup label="Preserved Historical Team">' +
        '<option value="' + escAttr(selectedVal) + '" selected>' + escHtml(selectedVal) + ' (Historical)</option>' +
      '</optgroup>';
    }
    return groupsHtml;
  },

  render: function(ctx) {
    var data = ctx.data;
    var depts = ctx.depts;
    var deptMap = ctx.deptMap;
    var availableTeams = ctx.availableTeams;
    var icons = ctx.icons || window.HortOpsIcons;
    var escHtml = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s || ''; };
    var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) || function(s) { return s || ''; };
    var self = this;

    // Exclusive team chips (P0 Security: data-team attribute, no inline JS evaluation)
    var chipsHtml = depts.map(function(dept) {
      var teams = deptMap[dept] || [];
      var chips = teams.map(function(t) {
        var isSelected = (data.exclusiveTeams || []).indexOf(t) !== -1;
        return '<button type="button" class="team-chip btn-exclusive-chip ' + (isSelected ? 'active' : '') + '" data-team="' + escAttr(t) + '">' +
          (isSelected ? icons.render('check', 'w-3 h-3') : '') +
          '<span>' + escHtml(t) + '</span>' +
        '</button>';
      }).join(' ');

      return '<div style="margin-bottom: 0.5rem;">' +
        '<span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--slate-400); margin-right: 0.5rem;">' + escHtml(dept.split(' ')[0]) + ':</span>' +
        chips +
      '</div>';
    }).join('');

    return '<div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.75rem;">' +
      '<div style="font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--slate-800); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">' +
        icons.render('building', 'w-3.5 h-3.5 text-emerald-700') +
        '<span>Team Suitability & Preference Hierarchy</span>' +
      '</div>' +

      '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 0.75rem;">' +
        '<div>' +
          '<label style="display: block; font-size: 12px; font-weight: 700; color: var(--slate-600); margin-bottom: 0.2rem;">Department</label>' +
          '<select id="job-dept-target" class="form-select" onchange="window.HortOpsJobEditModal.handleDeptChange(this.value)">' +
            depts.map(function(dept) {
              return '<option value="' + escAttr(dept) + '"' + (data.defaultDepartment === dept ? ' selected' : '') + '>' + escHtml(dept) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label style="display: block; font-size: 12px; font-weight: 700; color: var(--emerald-800); margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.2rem;">' +
            icons.render('star', 'w-3 h-3 text-amber-500') + 'Primary (1st Tier)' +
          '</label>' +
          '<select id="job-team-target" class="form-select" style="font-weight: 700; border-color: var(--emerald-300);" onchange="window.HortOpsJobEditModal.updateField(\'primaryTeam\', this.value)">' +
            availableTeams.map(function(t) {
              return '<option value="' + escAttr(t) + '"' + ((data.primaryTeam || data.defaultTeam) === t ? ' selected' : '') + '>' + escHtml(t) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label style="display: block; font-size: 12px; font-weight: 700; color: var(--slate-600); margin-bottom: 0.2rem;">Secondary (2nd Tier)</label>' +
          '<select id="job-sec-team-target" class="form-select" onchange="window.HortOpsJobEditModal.updateField(\'secondaryTeam\', this.value)">' +
            '<option value="">None (Optional)</option>' +
            self.renderTeamOptionsGrouped(ctx, data.secondaryTeam) +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label style="display: block; font-size: 12px; font-weight: 700; color: var(--slate-600); margin-bottom: 0.2rem;">Tertiary (3rd Tier)</label>' +
          '<select id="job-tert-team-target" class="form-select" onchange="window.HortOpsJobEditModal.updateField(\'tertiaryTeam\', this.value)">' +
            '<option value="">None (Optional)</option>' +
            self.renderTeamOptionsGrouped(ctx, data.tertiaryTeam) +
          '</select>' +
        '</div>' +
      '</div>' +

      // Exclusive constraint toggle + chips
      '<div style="padding-top: 0.65rem; border-top: 1px solid var(--slate-200);">' +
        '<label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; margin-bottom: 0.35rem;">' +
          '<input type="checkbox" ' + (data.isExclusiveTeams ? 'checked' : '') + ' onchange="window.HortOpsJobEditModal.toggleExclusiveCheck(this.checked)" />' +
          '<span style="font-weight: 800; font-size: 13px; color: var(--slate-800); display: flex; align-items: center; gap: 0.3rem;">' +
            icons.render('lock', 'w-3.5 h-3.5 text-amber-700') +
            'Enforce Exclusive Teams Only' +
          '</span>' +
        '</label>' +
        '<div style="font-size: 12px; color: var(--slate-500); margin-bottom: 0.5rem;">' +
          'When enabled, staff from outside the selected exclusive teams cannot be assigned and are hidden from the Crew Allocator.' +
        '</div>' +

        (data.isExclusiveTeams ?
          '<div style="background: #ffffff; padding: 0.5rem; border-radius: 6px; border: 1px solid var(--slate-200);">' +
            chipsHtml +
            '<div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; padding-top: 0.4rem; border-top: 1px solid var(--slate-100);">' +
              '<button type="button" class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 12px;" onclick="window.HortOpsJobEditModal.addPreferredToExclusive()">+ Add Preferred Teams</button>' +
              '<button type="button" class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 12px;" onclick="window.HortOpsJobEditModal.clearExclusive()">Clear All</button>' +
            '</div>' +
          '</div>' : '') +
      '</div>' +
    '</div>';
  }
};
