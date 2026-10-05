// Staff Assignment Filter Bar Sub-module
// Manages team filter chips, department dropdown, search query input, and preferred/exclusive toggle.
window.HortOpsStaffAssignFilterBar = {
  render: function(ctx) {
    var self = ctx.self;
    var hierarchy = ctx.hierarchy;
    var filteredStaff = ctx.filteredStaff || [];
    var isExclusive = ctx.isExclusive;
    var exclusiveTeams = ctx.exclusiveTeams || [];
    var preferredCrewCount = ctx.preferredCrewCount;
    var vacancies = ctx.vacancies;
    var primaryTeam = ctx.primaryTeam;
    var icons = ctx.icons || window.HortOpsIcons;
    var escHtml = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s || ''; };
    var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) || function(s) { return s || ''; };

    // Slicers HTML (Mandate Section 19, 20: Option value and text escaping)
    var deptOptions = '<option value="all">All Departments</option>' + hierarchy.map(function(d) {
      return '<option value="' + escAttr(d.name) + '"' + (self.selectedDept === d.name ? ' selected' : '') + '>' + escHtml(d.name) + '</option>';
    }).join('');

    var teamsList = [];
    hierarchy.forEach(function(d) {
      if (self.selectedDept === 'all' || d.name === self.selectedDept) {
        d.teams.forEach(function(t) { teamsList.push(t); });
      }
    });

    var teamOptions = '<option value="all">All Teams</option>' + teamsList.map(function(t) {
      return '<option value="' + escAttr(t.name) + '"' + (self.selectedTeam === t.name ? ' selected' : '') + '>' + escHtml(t.name) + ' (' + t.count + ')</option>';
    }).join('');

    // Exclusive restriction alert
    var exclusiveBannerHtml = isExclusive ?
      '<div style="background: var(--amber-50); border: 1px solid var(--amber-300); border-radius: 6px; padding: 0.5rem 0.75rem; display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.65rem; font-size: 13px; color: var(--amber-900);">' +
        '<div style="display: flex; align-items: center; gap: 0.4rem;">' +
          icons.render('lock', 'w-4 h-4 text-amber-700') +
          '<div>' +
            '<span style="font-weight: 800;">Exclusive Teams Constraint:</span> ' +
            'Restricted strictly to <strong>' + exclusiveTeams.map(escHtml).join(', ') + '</strong>. Ineligible staff are removed.' +
          '</div>' +
        '</div>' +
        '<span class="badge badge-amber">' + filteredStaff.length + ' Eligible</span>' +
      '</div>' : '';

    var headerHtml = '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">' +
      '<span style="font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--slate-700); display: flex; align-items: center; gap: 0.35rem;">' +
        icons.render('filter', 'w-3.5 h-3.5') + 'Workforce Directory & Slicers' +
      '</span>' +
      '<span style="font-size: 12px; color: var(--slate-500);">' + filteredStaff.length + ' candidate' + (filteredStaff.length === 1 ? '' : 's') + '</span>' +
    '</div>';

    var slicerGridHtml = '<div class="slicer-container">' +
      '<div class="slicer-grid">' +
        '<div class="col-span-3">' +
          '<input type="text" class="form-input" placeholder="Search by name, ID, team, crew, role..." value="' + escAttr(self.searchTerm || '') + '" oninput="window.HortOpsStaffAssignModal.setSearch(this.value)" />' +
        '</div>' +
        '<div class="col-span-3">' +
          '<select id="assign-filter-dept" class="form-select" onchange="window.HortOpsStaffAssignModal.setDept(this.value)">' + deptOptions + '</select>' +
        '</div>' +
        '<div class="col-span-3">' +
          '<select id="assign-filter-team" class="form-select" onchange="window.HortOpsStaffAssignModal.setTeam(this.value)">' + teamOptions + '</select>' +
        '</div>' +
        '<div class="col-span-3">' +
          '<button type="button" class="btn ' + (self.onlyPreferredCrew ? 'btn-primary' : 'btn-secondary') + '" style="width: 100%; justify-content: space-between; padding: 0.4rem 0.6rem;" onclick="window.HortOpsStaffAssignModal.togglePreferred()">' +
            '<span style="display: flex; align-items: center; gap: 0.3rem;">' +
              icons.render('star', 'w-3 h-3 ' + (self.onlyPreferredCrew ? 'text-amber-300' : 'text-amber-500')) +
              (isExclusive ? 'Exclusive' : 'Preferred') +
            '</span>' +
            '<span class="badge" style="background: rgba(0,0,0,0.1); font-size: 12px;">' + preferredCrewCount + '</span>' +
          '</button>' +
        '</div>' +
      '</div>' +

      // Autofill action when vacancies remain (P0 Security: data-team, no inline JS evaluation)
      (vacancies > 0 && primaryTeam ?
        '<div style="display: flex; justify-content: flex-end; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--slate-200);">' +
          '<button type="button" class="btn btn-primary btn-autofill-team" style="padding: 0.3rem 0.6rem; font-size: 12px;" data-team="' + escAttr(primaryTeam) + '">' +
            icons.render('sparkles', 'w-3 h-3 text-amber-300') +
            'Fill ' + vacancies + ' vacancies from ' + escHtml(primaryTeam) +
          '</button>' +
        '</div>' : '') +
    '</div>';

    return headerHtml + exclusiveBannerHtml + slicerGridHtml;
  }
};
