(function() {
// Imported colours never enter CSS/HTML without token validation.
var safeColor = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.safeColor) || function() { return '#10b981'; };
// Forward Planner Controls & Toolbar Sub-module
// Manages filter drawer toggle, week window controls, and slideout filter drawer with monochrome job pills.
window.HortOpsForwardPlannerControls = {
  renderToolbar: function(ctx) {
    var self = ctx.self;
    var hierarchy = ctx.hierarchy;
    var filteredStaff = ctx.filteredStaff;
    var staffList = ctx.staffList;
    var visibleVacancies = ctx.visibleVacancies;
    var visibleSlots = ctx.visibleSlots;
    var endWeek = ctx.endWeek;
    var totalWeeks = ctx.totalWeeks;
    var totalActiveColumns = ctx.totalActiveColumns;
    var totalAssignedInWindowCount = ctx.totalAssignedInWindowCount;
        var currentWeekNum = ctx.currentWeekNum;
        var isSeasonView = self.viewMode === 'season' && !!ctx.programme;
        var canPrevious = self.startWeek > (ctx.scopeStartWeek || 1);
        var canNext = endWeek < (ctx.scopeEndWeek || totalWeeks);
    var icons = ctx.icons || window.HortOpsIcons;
    var esc = ctx.esc;
    var escAttr = ctx.escAttr;

    // Collect all unique active jobs across visible slots
    var activeJobsMap = new Map();
    (visibleSlots || []).forEach(function(slot) {
      (slot.shifts || []).forEach(function(sh) {
        if (sh.jobId && !activeJobsMap.has(sh.jobId)) {
          activeJobsMap.set(sh.jobId, {
            id: sh.jobId,
            name: sh.jobName || (sh.job && sh.job.name) || 'Job',
            color: sh.color || (sh.job && sh.job.color) || '#10b981',
            shiftCount: 0
          });
        }
        if (sh.jobId && activeJobsMap.has(sh.jobId)) {
          activeJobsMap.get(sh.jobId).shiftCount++;
        }
      });
    });
    var activeJobs = Array.from(activeJobsMap.values()).sort(function(a, b) {
      return a.name.localeCompare(b.name);
    });

    var selectedJob = self.selectedJobId ? activeJobs.find(function(j) { return j.id === self.selectedJobId; }) : null;

    // Calculate active filter count
    var activeFilterCount = 0;
    if (self.selectedDept && self.selectedDept !== 'all') activeFilterCount++;
    if (self.selectedTeam && self.selectedTeam !== 'all') activeFilterCount++;
    if (self.searchTerm && self.searchTerm.trim().length > 0) activeFilterCount++;
    if (self.selectedJobId) activeFilterCount++;

    var isFilterActive = activeFilterCount > 0 || self.filterDrawerOpen;

    // 1. Toolbar Filter Button & Active Filter Chips
    var leftControlsHtml = '<div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">' +
      '<button class="btn ' + (isFilterActive ? 'btn-primary' : 'btn-secondary') + '" id="fp-filter-drawer-toggle" onclick="window.HortOpsForwardPlanner.toggleFilterDrawer()" style="display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.35rem 0.75rem; font-size: 12px; font-weight: 600;" title="Open Filter Drawer">' +
        icons.render('filter', 'w-3.5 h-3.5') +
        '<span>Filters</span>' +
        (activeFilterCount > 0 ?
          '<span class="badge" style="background: #ffffff; color: var(--emerald-900); font-weight: 800; font-size: 10px; padding: 0 5px; border-radius: 9999px;">' + activeFilterCount + '</span>' : '') +
      '</button>' +
      (selectedJob ?
        ('<div style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.6rem; background: #ffffff; border: 1.5px solid ' + escAttr(safeColor(selectedJob.color, '#047857')) + '; border-radius: 9999px; font-size: 11px; font-weight: 700; color: ' + escAttr(safeColor(selectedJob.color, '#047857')) + ';" title="Isolating ' + escAttr(selectedJob.name) + '">' +
          '<span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background-color: ' + escAttr(safeColor(selectedJob.color, '#047857')) + ';"></span>' +
          '<span>' + esc(selectedJob.name) + '</span>' +
          '<button onclick="window.HortOpsForwardPlanner.handleJobFilter(null)" style="background: none; border: none; cursor: pointer; color: ' + escAttr(safeColor(selectedJob.color, '#047857')) + '; font-weight: 800; padding: 0 0 0 2px; line-height: 1; font-size: 13px;" title="Clear Job Filter">×</button>' +
        '</div>') : '') +
      (self.searchTerm ?
        ('<div style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.55rem; background: var(--slate-100); border: 1px solid var(--slate-300); border-radius: 9999px; font-size: 11px; color: var(--slate-700);">' +
          '<span>\"' + esc(self.searchTerm) + '\"</span>' +
          '<button onclick="window.HortOpsForwardPlanner.handleSearch(\'\')" style="background: none; border: none; cursor: pointer; color: var(--slate-500); font-weight: 700; padding: 0; line-height: 1; font-size: 12px;">×</button>' +
        '</div>') : '') +
    '</div>';

    // 2. Main Toolbar HTML
    var toolbarHtml = '<div class="panel-card forward-planner-controls" style="margin-bottom: 0.75rem;">' +
      '<div class="panel-body" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; padding: 0.65rem 1rem;">' +
        leftControlsHtml +
        // Right Window Controls
        '<div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">' +
          (visibleVacancies.length > 0 ?
            '<span class="badge badge-amber" style="padding: 0.35rem 0.6rem; font-size: 11px; font-weight: 700;">' +
              icons.render('alertTriangle', 'w-3.5 h-3.5 text-amber-600') +
              visibleVacancies.length + ' Vacanc' + (visibleVacancies.length === 1 ? 'y' : 'ies') + ' Detected' +
            '</span>' : '') +
          '<span style="font-size: 12px; color: var(--slate-600);">' +
            'Weeks <strong style="color: var(--slate-900);">' + self.startWeek + ' - ' + endWeek + '</strong> of ' + totalWeeks + ' (' + totalActiveColumns + ' active days) • ' +
            '<strong style="color: var(--emerald-700);">' + totalAssignedInWindowCount + ' Rostered</strong>' +
          '</span>' +
                    '<div style="display: ' + (isSeasonView ? 'none' : 'flex') + '; align-items: center; gap: 0.25rem;">' +
            '<button class="btn btn-secondary" id="fp-current-week" style="padding: 0.25rem 0.5rem; font-size: 11px; font-weight: 700; color: var(--emerald-700);" onclick="window.HortOpsForwardPlanner.returnToCurrentWeek()">' +
                'Current week (Week ' + currentWeekNum + ')' +
            '</button>' +
            '<button class="btn btn-secondary" style="padding: 0.3rem 0.5rem;" onclick="window.HortOpsForwardPlanner.prevWeeks()"' + (!canPrevious ? ' disabled' : '') + '>' +
              icons.render('chevronLeft', 'w-3.5 h-3.5') +
            '</button>' +
            '<button class="btn btn-secondary" style="padding: 0.3rem 0.5rem;" onclick="window.HortOpsForwardPlanner.nextWeeks()"' + (!canNext ? ' disabled' : '') + '>' +
              icons.render('chevronRight', 'w-3.5 h-3.5') +
            '</button>' +
          '</div>' +
            '<div style="display: flex; align-items: center; gap: 0.2rem;">' +
            [4, 6, 8].map(function(sz) {
              return '<button class="btn ' + (self.windowSize === sz ? 'btn-primary' : 'btn-secondary') + '" style="padding: 0.25rem 0.5rem; font-size: 11px;" onclick="window.HortOpsForwardPlanner.setWindowSize(' + sz + ')">' + sz + ' Wks</button>';
            }).join('') + (ctx.programme ? '<button class="btn ' + (isSeasonView ? 'btn-primary' : 'btn-secondary') + '" style="padding: 0.25rem 0.5rem; font-size: 11px; margin-left: 0.35rem;" onclick="window.HortOpsForwardPlanner.setSeasonView(' + (!isSeasonView ? 'true' : 'false') + ')" title="Recommended for Super-wide monitors">' + (isSeasonView ? 'Use week view' : 'Entire season') + ' <span style="font-weight: 500;">(Recommended for Super-wide monitors)</span></button>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    // 3. Render Filter Drawer (if open)
    var drawerHtml = '';
    if (self.filterDrawerOpen) {
      var deptOptions = '<option value="all">All Departments</option>' + hierarchy.map(function(d) {
        return '<option value="' + escAttr(d.name) + '"' + (self.selectedDept === d.name ? ' selected' : '') + '>' + esc(d.name) + ' (' + d.totalStaff + ')</option>';
      }).join('');

      var teamsList = [];
      hierarchy.forEach(function(d) {
        if (self.selectedDept === 'all' || d.name === self.selectedDept) {
          d.teams.forEach(function(t) { teamsList.push(t); });
        }
      });

      var teamOptions = '<option value="all">All Teams in Department</option>' + teamsList.map(function(t) {
        return '<option value="' + escAttr(t.name) + '"' + (self.selectedTeam === t.name ? ' selected' : '') + '>' + esc(t.name) + ' (' + t.count + ' Staff)</option>';
      }).join('');

      var jobPillsHtml = activeJobs.map(function(job) {
        var isSelected = self.selectedJobId === job.id;
        if (isSelected) {
          return '<button type="button" class="job-filter-pill is-selected" style="border: 2px solid ' + escAttr(safeColor(job.color, '#047857')) + '; color: ' + escAttr(safeColor(job.color, '#047857')) + '; background-color: #ffffff; box-shadow: 0 0 0 1px ' + escAttr(safeColor(job.color, '#047857')) + ';" onclick="window.HortOpsForwardPlanner.handleJobFilter(\'' + escAttr(job.id) + '\')" title="Click to clear filter">' +
            '<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ' + escAttr(safeColor(job.color, '#047857')) + ';"></span>' +
            '<span>' + esc(job.name) + '</span>' +
            '<span style="font-size: 10px; opacity: 0.85;">(' + job.shiftCount + ')</span>' +
          '</button>';
        } else {
          return '<button type="button" class="job-filter-pill" onclick="window.HortOpsForwardPlanner.handleJobFilter(\'' + escAttr(job.id) + '\')" title="Filter to ' + escAttr(job.name) + '">' +
            '<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: var(--slate-400);"></span>' +
            '<span>' + esc(job.name) + '</span>' +
            '<span style="font-size: 10px; color: var(--slate-400);">(' + job.shiftCount + ')</span>' +
          '</button>';
        }
      }).join('');

      drawerHtml = '<div class="planner-drawer-backdrop" onclick="window.HortOpsForwardPlanner.toggleFilterDrawer(false)"></div>' +
        '<div class="planner-filter-drawer" id="planner-filter-drawer" onclick="event.stopPropagation()">' +
          '<div class="planner-filter-drawer-header">' +
            '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
              '<span style="color: var(--emerald-700);">' + icons.render('filter', 'w-4 h-4') + '</span>' +
              '<h3 style="margin: 0; font-size: 15px; font-weight: 800; color: var(--slate-900);">Forward Planner Filters</h3>' +
            '</div>' +
            '<button class="btn-close" style="background: none; border: none; cursor: pointer; font-size: 18px; color: var(--slate-500); padding: 0.25rem;" onclick="window.HortOpsForwardPlanner.toggleFilterDrawer(false)" title="Close Filters">✕</button>' +
          '</div>' +
          '<div class="planner-filter-drawer-body">' +
            // Search Input
            '<div>' +
              '<label style="font-size: 11px; font-weight: 700; color: var(--slate-700); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem; display: block;">Search Staff & Roles</label>' +
              '<input type="text" class="form-input" placeholder="Search name, role, team..." value="' + escAttr(self.searchTerm || '') + '" oninput="window.HortOpsForwardPlanner.handleSearch(this.value)" style="width: 100%;" />' +
            '</div>' +
            // Department Select
            '<div>' +
              '<label style="font-size: 11px; font-weight: 700; color: var(--slate-700); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem; display: block;">Department</label>' +
              '<select class="form-select" style="width: 100%;" onchange="window.HortOpsForwardPlanner.handleDeptChange(this.value)">' + deptOptions + '</select>' +
            '</div>' +
            // Team Select
            (self.selectedDept !== 'all' ?
              ('<div>' +
                '<label style="font-size: 11px; font-weight: 700; color: var(--slate-700); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.35rem; display: block;">Team in ' + esc(self.selectedDept) + '</label>' +
                '<select class="form-select" style="width: 100%;" onchange="window.HortOpsForwardPlanner.handleTeamChange(this.value)">' + teamOptions + '</select>' +
              '</div>') : '') +
            // Active Map Jobs (Monochrome Pills)
            '<div>' +
              '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">' +
                '<label style="font-size: 11px; font-weight: 700; color: var(--slate-700); text-transform: uppercase; letter-spacing: 0.04em; margin: 0;">Jobs on Active View (' + activeJobs.length + ')</label>' +
                (self.selectedJobId ?
                  '<button type="button" onclick="window.HortOpsForwardPlanner.handleJobFilter(null)" style="background: none; border: none; color: var(--emerald-700); font-size: 11px; font-weight: 700; cursor: pointer; padding: 0;">Show All</button>' : '') +
              '</div>' +
              '<p style="font-size: 11px; color: var(--slate-500); margin: 0 0 0.5rem 0;">Click a monochrome pill to isolate that job across the 4/6/8-week map:</p>' +
              '<div class="job-pills-container">' +
                jobPillsHtml +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="planner-filter-drawer-footer">' +
            '<button class="btn btn-secondary" onclick="window.HortOpsForwardPlanner.clearAllFilters()" style="font-size: 12px;">Reset All</button>' +
            '<button class="btn btn-primary" onclick="window.HortOpsForwardPlanner.toggleFilterDrawer(false)" style="font-size: 12px;">Apply &amp; Close</button>' +
          '</div>' +
        '</div>';
    }

    return toolbarHtml + drawerHtml;
  }
};

})();
