(function() {
// Imported colours never enter CSS/HTML without token validation.
var safeColor = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.safeColor) || function() { return '#10b981'; };
// Job Registry View & Slideout Inspector Component
window.HortOpsJobRegistry = {
  selectedJobId: null,
  searchTerm: '',
  categoryFilter: 'all',
  teamFilter: 'all',
  statusFilter: 'all',

  render: function(state) {
    var icons = window.HortOpsIcons;
    var jobs = state.jobs;
    var self = this;
    function esc(str) {
      if (window.HortOpsSecurityUtils && typeof window.HortOpsSecurityUtils.escapeHtml === 'function') {
        return window.HortOpsSecurityUtils.escapeHtml(str);
      }
      if (str == null) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }
    function escAttr(str) {
      if (window.HortOpsSecurityUtils && typeof window.HortOpsSecurityUtils.escapeHtmlAttr === 'function') {
        return window.HortOpsSecurityUtils.escapeHtmlAttr(str);
      }
      return esc(str);
    }

    // Filter jobs
    var filtered = jobs.filter(function(job) {
      var primary = job.primaryTeam || job.defaultTeam || '';
      if (self.categoryFilter !== 'all' && job.category !== self.categoryFilter) return false;
      if (self.statusFilter !== 'all' && job.status !== self.statusFilter) return false;

      if (self.teamFilter !== 'all') {
        var isMatch = primary === self.teamFilter ||
          job.secondaryTeam === self.teamFilter ||
          job.tertiaryTeam === self.teamFilter ||
          (job.exclusiveTeams || []).indexOf(self.teamFilter) !== -1;
        if (!isMatch) return false;
      }

      if (self.searchTerm) {
        var q = self.searchTerm.toLowerCase();
        var mName = job.name.toLowerCase().indexOf(q) !== -1;
        var mLoc = (job.locationDetails || '').toLowerCase().indexOf(q) !== -1;
        var mCat = job.category.toLowerCase().indexOf(q) !== -1;
        var mTeam = primary.toLowerCase().indexOf(q) !== -1;
        if (!mName && !mLoc && !mCat && !mTeam) return false;
      }

      return true;
    });

    // Unique teams for filter
    var allTeamsSet = new Set();
    jobs.forEach(function(j) {
      if (j.primaryTeam) allTeamsSet.add(j.primaryTeam);
      if (j.defaultTeam) allTeamsSet.add(j.defaultTeam);
      if (j.secondaryTeam) allTeamsSet.add(j.secondaryTeam);
      if (j.tertiaryTeam) allTeamsSet.add(j.tertiaryTeam);
      (j.exclusiveTeams || []).forEach(function(t) { allTeamsSet.add(t); });
    });
    var teamOptions = '<option value="all">All Teams</option>' + Array.from(allTeamsSet).sort().map(function(t) {
      return '<option value="' + escAttr(t) + '"' + (self.teamFilter === t ? ' selected' : '') + '>' + esc(t) + '</option>';
    }).join('');

    var categories = ['Parklands', 'CBD Corridor', 'Arterial Road', 'Biodiversity', 'Sports Fields', 'Infrastructure'];
    var catOptions = '<option value="all">All Categories</option>' + categories.map(function(c) {
      return '<option value="' + escAttr(c) + '"' + (self.categoryFilter === c ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');

    // Table rows
    var selectedJob = jobs.find(function(j) { return j.id === self.selectedJobId; });

    var rowsHtml = filtered.length === 0 ?
      '<tr><td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--slate-400);">No jobs match the active search and filter criteria.</td></tr>' :
      filtered.map(function(job) {
        var primary = job.primaryTeam || job.defaultTeam || 'Unassigned';
        var isSelected = self.selectedJobId === job.id;

        var exclusiveTag = (job.isExclusiveTeams && (job.exclusiveTeams || []).length > 0) ?
          '<span class="badge badge-amber" style="font-size: 11px; margin-left: 4px;" title="Exclusive to: ' + escAttr(job.exclusiveTeams.join(', ')) + '">' +
            icons.render('lock', 'w-2.5 h-2.5') + 'Exclusive (' + job.exclusiveTeams.length + ')' +
          '</span>' : '';

        var prefPills = '';
        if (job.secondaryTeam || job.tertiaryTeam) {
          prefPills = '<div style="display: flex; gap: 4px; margin-top: 2px;">' +
            (job.secondaryTeam ? '<span class="badge badge-slate" style="font-size: 11px;">2nd: ' + esc(job.secondaryTeam) + '</span>' : '') +
            (job.tertiaryTeam ? '<span class="badge badge-slate" style="font-size: 11px;">3rd: ' + esc(job.tertiaryTeam) + '</span>' : '') +
          '</div>';
        }

        var cadenceHtml = '';
        if (job.frequencyType === 'recurring_weeks') {
          cadenceHtml = '<span class="badge badge-emerald">Every ' + job.intervalWeeks + ' wks</span>';
        } else if (job.frequencyType === 'annual') {
          cadenceHtml = '<span class="badge badge-sky">Annual</span>';
        } else {
          cadenceHtml = '<span class="badge badge-purple">One-Off</span>';
        }

        var reqQuals = Array.isArray(job.requiredQualifications) ? job.requiredQualifications : [];
        var reqQualPills = '';
        if (reqQuals.length > 0) {
          reqQualPills = '<div style="display: flex; gap: 3px; flex-wrap: wrap; margin-top: 3px;">' +
            reqQuals.map(function(qc) {
              return '<span class="badge" style="background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; font-size: 9px; padding: 1px 4px; font-weight: 700;" title="Required: ' + escAttr(qc) + '">' + esc(qc) + '</span>';
            }).join('') + '</div>';
        }

        return '<tr style="cursor: pointer; background-color: ' + (isSelected ? 'var(--emerald-50)' : 'transparent') + ';" onclick="window.HortOpsJobRegistry.selectJob(\'' + job.id + '\')">' +
          '<td style="padding: 0.6rem 0.8rem;">' +
            '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
              '<span style="width: 10px; height: 10px; border-radius: 50%; background: ' + safeColor(job.color, '#10b981') + '; shrink: 0;"></span>' +
              '<div>' +
                '<div style="font-weight: 700; color: var(--slate-900);">' + esc(job.name) + '</div>' +
                '<div style="font-size: 12px; color: var(--slate-500);">' + esc(job.locationDetails || '') + '</div>' +
                reqQualPills +
              '</div>' +
            '</div>' +
          '</td>' +
          '<td><span class="badge badge-slate">' + esc(job.category) + '</span></td>' +
          '<td>' + cadenceHtml + '</td>' +
          '<td>' +
            '<div style="display: flex; align-items: center; flex-wrap: wrap;">' +
              '<span style="font-weight: 700; color: var(--slate-800);">' + esc(primary) + '</span>' +
              exclusiveTag +
            '</div>' +
            prefPills +
            '<div style="font-size: 12px; color: var(--slate-400);">' + esc(job.defaultDepartment || '') + '</div>' +
          '</td>' +
          '<td style="text-align: center; font-weight: 600;">' + job.crewSize + (job.plantOperatorRequired ? ' <span class="badge badge-amber" style="font-size: 9px; padding: 1px 3px;" title="Plant Operator Required">Plant Op</span>' : '') + '</td>' +
          '<td style="text-align: center; color: var(--slate-600);">' + job.durationHours + 'h @ ' + job.startTime + '</td>' +
          '<td>' +
            '<button class="badge ' + (job.status === 'active' ? 'badge-emerald' : 'badge-slate') + '" style="cursor: pointer;" onclick="event.stopPropagation(); window.HortOpsJobRegistry.toggleStatus(\'' + job.id + '\')">' +
              job.status +
            '</button>' +
          '</td>' +
          '<td style="text-align: right; padding-right: 0.75rem;">' +
            '<button class="btn btn-secondary" style="padding: 0.25rem 0.4rem; margin-right: 4px;" onclick="event.stopPropagation(); window.HortOpsApp.openEditJobModal(\'' + job.id + '\')" title="Edit Job">' +
              icons.render('edit', 'w-3 h-3') +
            '</button>' +
            '<button class="btn btn-danger" style="padding: 0.25rem 0.4rem;" onclick="event.stopPropagation(); window.HortOpsJobRegistry.deleteJob(\'' + job.id + '\')" title="Delete Job">' +
              icons.render('trash', 'w-3 h-3') +
            '</button>' +
          '</td>' +
        '</tr>';
      }).join('');

    // Slideout drawer HTML
    var drawerHtml = selectedJob ?
      '<div class="slideout-drawer">' +
        '<div class="modal-header">' +
          '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
            '<span style="width: 12px; height: 12px; border-radius: 50%; background: ' + safeColor(selectedJob.color, '#10b981') + ';"></span>' +
            '<h3 style="font-size: 16px; font-weight: 800; color: var(--slate-900);">' + esc(selectedJob.name) + '</h3>' +
          '</div>' +
          '<button class="btn btn-secondary" style="padding: 0.25rem 0.4rem;" onclick="window.HortOpsJobRegistry.selectJob(null)">' + icons.render('x', 'w-4 h-4') + '</button>' +
        '</div>' +

        '<div style="padding: 1.25rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem;">' +
          '<div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.4rem;">' +
            '<div style="display: flex; justify-content: space-between;"><span style="color: var(--slate-500);">Category:</span><span style="font-weight: 700;">' + esc(selectedJob.category) + '</span></div>' +
            '<div style="display: flex; justify-content: space-between;"><span style="color: var(--slate-500);">Primary Team:</span><span style="font-weight: 700; color: var(--emerald-800);">' + esc(selectedJob.primaryTeam || selectedJob.defaultTeam || 'Unassigned') + '</span></div>' +
            (selectedJob.secondaryTeam ? '<div style="display: flex; justify-content: space-between;"><span style="color: var(--slate-500);">2nd Preference:</span><span style="font-weight: 600;">' + esc(selectedJob.secondaryTeam) + '</span></div>' : '') +
            (selectedJob.tertiaryTeam ? '<div style="display: flex; justify-content: space-between;"><span style="color: var(--slate-500);">3rd Preference:</span><span style="font-weight: 600;">' + esc(selectedJob.tertiaryTeam) + '</span></div>' : '') +
            '<div style="display: flex; justify-content: space-between; align-items: center;"><span style="color: var(--slate-500);">Exclusive Choices:</span>' +
              (selectedJob.isExclusiveTeams && (selectedJob.exclusiveTeams || []).length > 0 ?
                '<span class="badge badge-amber">' + icons.render('lock', 'w-2.5 h-2.5') + esc(selectedJob.exclusiveTeams.join(', ')) + '</span>' :
                '<span style="color: var(--slate-500);">None (Open to all staff)</span>') +
            '</div>' +
            '<div style="display: flex; justify-content: space-between;"><span style="color: var(--slate-500);">Crew Required:</span><span style="font-weight: 700;">' + selectedJob.crewSize + ' Staff</span></div>' +
            '<div style="display: flex; justify-content: space-between;"><span style="color: var(--slate-500);">Duration:</span><span style="font-weight: 700;">' + selectedJob.durationHours + ' Hours @ ' + selectedJob.startTime + '</span></div>' +
            '<div style="display: flex; justify-content: space-between; align-items: center;"><span style="color: var(--slate-500);">Plant Operator:</span>' +
              (selectedJob.plantOperatorRequired ? '<span class="badge badge-amber" style="font-weight: 700;">Required</span>' : '<span style="color: var(--slate-400);">Not Required</span>') +
            '</div>' +
          '</div>' +

          '<div>' +
            '<div style="font-weight: 700; font-size: 13px; text-transform: uppercase; color: var(--slate-600); margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.3rem;">' +
              icons.render('mapPin', 'w-3.5 h-3.5') + 'Location & Precinct' +
            '</div>' +
            '<div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px; padding: 0.65rem; font-size: 13px; color: var(--slate-700);">' +
              esc(selectedJob.locationDetails || 'No location details provided.') +
            '</div>' +
          '</div>' +

          '<div>' +
            '<div style="font-weight: 700; font-size: 13px; text-transform: uppercase; color: var(--slate-600); margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.3rem;">' +
              icons.render('alertTriangle', 'w-3.5 h-3.5') + 'Regulatory Permits Required' +
            '</div>' +
            '<div style="display: flex; flex-wrap: wrap; gap: 0.35rem;">' +
              (selectedJob.requiresWZTM ? '<span class="badge badge-amber" style="font-weight: 700;">⚠ Work Zone Traffic Management (WZTM)</span>' : '') +
              (selectedJob.requiresTPO ? '<span class="badge" style="background: #f3e8ff; color: #7e22ce; border: 1px solid #d8b4fe; font-weight: 700;">⚠ Tram Protection Order (TPO)</span>' : '') +
              (!selectedJob.requiresWZTM && !selectedJob.requiresTPO ? '<span style="color: var(--slate-400); font-size: 12px;">No special regulatory corridor permits required</span>' : '') +
            '</div>' +
          '</div>' +

          '<div>' +
            '<div style="font-weight: 700; font-size: 13px; text-transform: uppercase; color: var(--slate-600); margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.3rem;">' +
              icons.render('shield', 'w-3.5 h-3.5') + 'Mandatory Qualifications & Tickets' +
            '</div>' +
            '<div style="display: flex; flex-direction: column; gap: 0.35rem;">' +
              (function() {
                var qList = Array.isArray(selectedJob.requiredQualifications) ? selectedJob.requiredQualifications : [];
                if (qList.length === 0) {
                  return '<span style="color: var(--slate-400); font-size: 12px;">No mandatory accreditations specified</span>';
                }
                var defs = (window.HortOpsQualifications && window.HortOpsQualifications.DEFINITIONS) || {};
                return qList.map(function(code) {
                  var def = defs[code];
                  var label = def ? (def.name + ' (' + code + ')') : code;
                  return '<div style="display: flex; align-items: center; justify-content: space-between; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 4px 8px; font-size: 12px;">' +
                    '<span style="font-weight: 600; color: #166534;">' + esc(label) + '</span>' +
                    '<span class="badge badge-emerald" style="font-size: 10px; font-weight: 700;">Mandatory</span>' +
                  '</div>';
                }).join('');
              })() +
            '</div>' +
          '</div>' +

          '<div style="margin-top: auto; padding-top: 1rem;">' +
            '<button class="btn btn-primary" style="width: 100%;" onclick="window.HortOpsApp.openEditJobModal(\'' + selectedJob.id + '\')">' +
              icons.render('edit', 'w-3.5 h-3.5') + 'Edit Job Specifications' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' : '';

    return '<div class="panel-card">' +
      // Filter Toolbar
      '<div class="panel-header">' +
        '<div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">' +
          '<input type="text" class="form-input" style="width: 220px;" placeholder="Search jobs, location, team..." value="' + escAttr(self.searchTerm || '') + '" oninput="window.HortOpsJobRegistry.setSearch(this.value)" />' +
          '<select class="form-select" style="width: 160px;" onchange="window.HortOpsJobRegistry.setCategory(this.value)">' + catOptions + '</select>' +
          '<select class="form-select" style="width: 160px;" onchange="window.HortOpsJobRegistry.setTeam(this.value)">' + teamOptions + '</select>' +
          '<select class="form-select" style="width: 130px;" onchange="window.HortOpsJobRegistry.setStatus(this.value)">' +
            '<option value="all"' + (self.statusFilter === 'all' ? ' selected' : '') + '>All Statuses</option>' +
            '<option value="active"' + (self.statusFilter === 'active' ? ' selected' : '') + '>Active</option>' +
            '<option value="inactive"' + (self.statusFilter === 'inactive' ? ' selected' : '') + '>Inactive</option>' +
          '</select>' +
        '</div>' +

        '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
          '<span style="font-size: 13px; color: var(--slate-500);">' + filtered.length + ' of ' + jobs.length + ' jobs</span>' +
          '<button class="btn btn-primary" onclick="window.HortOpsApp.openAddJobModal()">' +
            icons.render('plus', 'w-3.5 h-3.5') + 'New Job' +
          '</button>' +
        '</div>' +
      '</div>' +

      // Table
      '<div style="overflow-x: auto;">' +
        '<table class="planner-table" style="min-width: 1000px;">' +
          '<thead><tr>' +
            '<th style="width: 260px;">Job Name & Location</th>' +
            '<th style="width: 130px;">Category</th>' +
            '<th style="width: 120px;">Cadence</th>' +
            '<th style="width: 220px;">Team Suitability & Exclusive</th>' +
            '<th style="width: 80px; text-align: center;">Crew</th>' +
            '<th style="width: 130px; text-align: center;">Duration</th>' +
            '<th style="width: 90px;">Status</th>' +
            '<th style="width: 100px; text-align: right;">Actions</th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>' +
    '</div>' +
    drawerHtml;
  },

  selectJob: function(jobId) {
    this.selectedJobId = jobId;
    window.HortOpsApp.renderCurrentView();
  },

  setSearch: function(val) {
    this.searchTerm = val;
    var activeEl = document.activeElement;
    var isSearchInput = activeEl && activeEl.tagName === 'INPUT' && activeEl.placeholder && activeEl.placeholder.indexOf('Search') !== -1;
    var selStart = isSearchInput ? activeEl.selectionStart : null;
    var selEnd = isSearchInput ? activeEl.selectionEnd : null;

    window.HortOpsApp.renderCurrentView();

    if (isSearchInput) {
      var contentMount = document.getElementById('content-mount');
      if (contentMount) {
        var newInput = contentMount.querySelector('input[placeholder*="Search"]');
        if (newInput) {
          newInput.focus();
          if (selStart !== null && selEnd !== null) {
            newInput.setSelectionRange(selStart, selEnd);
          }
        }
      }
    }
  },

  setCategory: function(val) {
    this.categoryFilter = val;
    window.HortOpsApp.renderCurrentView();
  },

  setTeam: function(val) {
    this.teamFilter = val;
    window.HortOpsApp.renderCurrentView();
  },

  setStatus: function(val) {
    this.statusFilter = val;
    window.HortOpsApp.renderCurrentView();
  },

  toggleStatus: function(jobId) {
    var state = window.HortOpsApp.state;
    var job = state.jobs.find(function(j) { return j.id === jobId; });
    if (job) {
      var proposedJob = Object.assign({}, job, {
        status: job.status === 'active' ? 'inactive' : 'active'
      });
      var saveRes = window.HortOpsApp.saveJob(proposedJob);
      if (!saveRes || !saveRes.success) {
        if (saveRes && saveRes.error) {
          alert(saveRes.error);
        }
      }
    }
  },

  deleteJob: function(jobId) {
    if (confirm('Are you sure you want to delete this job definition?')) {
      window.HortOpsApp.deleteJob(jobId);
    }
  }
};

})();
