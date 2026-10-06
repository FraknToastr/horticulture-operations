// Browsing slicers never change job restrictions or staged allocation authority.
window.HortOpsStaffAssignFilterBar = {
  render: function(ctx) {
    var self = ctx.self, hierarchy = ctx.hierarchy || [], groups = ctx.allocatorGroups || [];
    var staff = groups.length ? [].concat.apply([], groups.map(function(g) { return g.staff || []; })) : ctx.filteredStaff || [];
    var tags = ctx.poolTags || [], icons = ctx.icons || window.HortOpsIcons;
    var esc = window.HortOpsSecurityUtils.escapeHtml, attr = window.HortOpsSecurityUtils.escapeHtmlAttr;
    var deptOptions = '<option value="all">All Departments</option>' + hierarchy.map(function(d) {
      return '<option value="' + attr(d.name) + '"' + (self.selectedDept === d.name ? ' selected' : '') + '>' + esc(d.name) + '</option>';
    }).join('');
    var teams = [];
    hierarchy.forEach(function(d) { if (self.selectedDept === 'all' || d.name === self.selectedDept) teams = teams.concat(d.teams || []); });
    var teamOptions = '<option value="all">All Teams</option>' + teams.map(function(t) {
      return '<option value="' + attr(t.name) + '"' + (self.selectedTeam === t.name ? ' selected' : '') + '>' + esc(t.name) + ' (' + t.count + ')</option>';
    }).join('');
    var roster = ctx.roster || ctx.staffList || window.HortOpsApp.state.staffList || [];
    var poolOptions = '<option value="all">All pool tags</option>' + tags.filter(function(tag) { return tag.active; }).map(function(tag) {
      var count = roster.filter(function(person) { return (person.poolTagIds || []).indexOf(tag.id) >= 0; }).length;
      return '<option value="' + attr(tag.id) + '"' + (self.selectedPoolTag === tag.id ? ' selected' : '') + '>#' + esc(tag.label) + ' (' + count + ')</option>';
    }).join('');
    var eligible = staff.filter(function(person) { return person._eligibility && person._eligibility.eligible && !person._isAssigned; }).length;
    var banner = ctx.isExclusive ? '<div style="background:var(--amber-50);border:1px solid var(--amber-300);border-radius:6px;padding:.5rem .75rem;margin-bottom:.65rem;font-size:12px;color:var(--amber-900)"><strong>Exclusive team restriction:</strong> ' + (ctx.exclusiveTeams || []).map(esc).join(', ') + '. Staff outside these teams remain visible with their exclusion reasons.</div>' : '';
    var rules = window.HortOpsPlanningRules, job = ctx.matchingJob || {};
    if (rules && rules.source(job) === 'tags') {
      var selected = (job.exclusivePoolTagIds || []).map(function(id) {
        return tags.find(function(tag) { return tag.id === id && tag.active; });
      }).filter(Boolean);
      banner = '<div data-allocator-pool-restriction style="background:var(--amber-50);border:1px solid var(--amber-300);border-radius:6px;padding:.5rem .75rem;margin-bottom:.65rem;font-size:12px;color:var(--amber-900)"><strong>Tagged staff only:</strong> ' +
        (selected.length ? selected.map(function(tag) { return '#' + esc(tag.label); }).join(', ') + '. Membership in any selected pool is required; all safety checks apply.' : 'No active exclusive pool is selected. No staff can be added.') +
        ' Other staff remain visible with their exclusion reasons.</div>';
    }
    return '<div style="display:flex;flex-wrap:wrap;gap:.5rem;justify-content:space-between;margin-bottom:.65rem"><strong style="font-size:13px;color:var(--slate-700)">Workforce Directory &amp; Slicers</strong><span style="font-size:12px;color:var(--slate-500)">' + staff.length + ' shown · ' + eligible + ' available and eligible</span></div>' + banner +
      '<div class="slicer-container"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr));gap:.5rem">' +
      '<input type="text" class="form-input" style="min-width:0;width:100%" aria-label="Search workforce and pool tags" placeholder="Search name, ID, team, role or #tag…" value="' + attr(self.searchTerm || '') + '" oninput="window.HortOpsStaffAssignModal.setSearch(this.value)">' +
      '<select id="assign-filter-dept" class="form-select" style="min-width:0;width:100%" aria-label="Browse department" onchange="window.HortOpsStaffAssignModal.setDept(this.value)">' + deptOptions + '</select>' +
      '<select id="assign-filter-team" class="form-select" style="min-width:0;width:100%" aria-label="Browse team" onchange="window.HortOpsStaffAssignModal.setTeam(this.value)">' + teamOptions + '</select>' +
      '<select id="assign-filter-pool" data-assign-filter-pool class="form-select" style="min-width:0;width:100%" aria-label="Browse pool tag" onchange="window.HortOpsStaffAssignModal.setPoolTag(this.value)">' + poolOptions + '</select>' +
      (!ctx.allocatorGroups ? '<button type="button" class="btn ' + (self.onlyPreferredCrew ? 'btn-primary' : 'btn-secondary') + '"' + (ctx.teamsEnabled === false ? ' disabled title="Team Suitability is disabled for this job"' : '') + ' style="justify-content:space-between;white-space:normal" onclick="window.HortOpsStaffAssignModal.togglePreferred()">' + (ctx.isExclusive ? 'Exclusive teams' : 'Preferred teams') + ' <span class="badge badge-slate">' + (ctx.preferredCrewCount || 0) + '</span></button>' : '') + '</div>' +
      '<p style="font-size:11px;color:var(--slate-500);margin:.5rem 0">Slicers browse staff; they do not override eligibility or job restrictions.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:.5rem;border-top:1px solid var(--slate-200);padding-top:.5rem"><button type="button" data-auto-add-eligible class="btn btn-primary" style="padding:.3rem .6rem;font-size:12px;white-space:normal" title="Uses all eligible staff for this job; search and slicers only change the directory."' + (!(ctx.vacancies > 0) ? ' disabled' : '') + ' onclick="window.HortOpsStaffAssignModal.autoAddEligible()">Auto-add eligible / preferred staff</button>' +
      (ctx.vacancies > 0 && ctx.primaryTeam && ctx.teamsEnabled !== false ? '<button type="button" class="btn btn-secondary btn-autofill-team" style="padding:.3rem .6rem;font-size:12px;white-space:normal" data-team="' + attr(ctx.primaryTeam) + '">' + icons.render('sparkles', 'w-3 h-3') + 'Fill from ' + esc(ctx.primaryTeam) + '</button>' : '') + '</div>' +
      '<p style="font-size:11px;color:var(--slate-500);margin:.5rem 0 0">Auto-add uses all eligible staff for this job. Search and slicers only change the directory.</p>' +
      (ctx.autoAddStatus ? '<p data-auto-add-status role="status" style="font-size:12px;color:var(--slate-700);margin:.5rem 0 0">' + esc(String(ctx.autoAddStatus)) + '</p>' : '') + '</div>';
  }
};
