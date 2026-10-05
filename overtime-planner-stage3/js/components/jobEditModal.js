(function() {
// Imported colours never enter CSS/HTML without token validation.
var safeColor = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.safeColor) || function() { return '#10b981'; };
// Job Add / Edit Modal Component
// Sole Public Facade for Job Editing: delegates UI sections to sub-modules while retaining state and action handlers.
window.HortOpsJobEditModal = {
  editingJobId: null,
  formData: null,

  open: function(jobId, targetDate, preferredDay) {
    this.editingJobId = jobId;
    var state = window.HortOpsApp.state;

    if (jobId) {
      var job = state.jobs.find(function(j) { return j.id === jobId; });
      if (job) {
        this.formData = JSON.parse(JSON.stringify(job));
        this.formData.plantOperatorRequired = !!job.plantOperatorRequired;
        this.formData.requiredQualifications = Array.isArray(job.requiredQualifications) ? JSON.parse(JSON.stringify(job.requiredQualifications)) : [];
      }
    } else {
      this.formData = {
        id: 'job-' + Date.now(),
        name: '',
        frequencyType: targetDate ? 'one_off' : 'recurring_weeks',
        intervalWeeks: 4,
        anchorWeek: 1,
        expectedAnnualShifts: 13,
        startTime: '06:00 AM',
        durationHours: 6,
        crewSize: 3,
        targetDate: targetDate || '',
        preferredDay: preferredDay || 'saturday',
        status: 'active',
        category: 'Parklands',
        color: '#047857',
        plantOperatorRequired: false,
        requiredQualifications: [],
        requiresWZTM: false,
        requiresTPO: false,
        notes: '',
        locationDetails: '',
        defaultDepartment: 'Horticulture',
        defaultTeam: 'Parks',
        primaryTeam: 'Parks',
        secondaryTeam: '',
        tertiaryTeam: '',
        isExclusiveTeams: false,
        exclusiveTeams: []
      };
    }

    if (window.HortOpsModalUtils) window.HortOpsModalUtils.lockBackgroundScroll();
    this.renderModal();
  },

  close: function() {
    this.editingJobId = null;
    this.formData = null;
    var el = document.getElementById('job-edit-modal-root');
    if (el) el.innerHTML = '';
    if (window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll();
  },

  renderModal: function() {
    var el = document.getElementById('job-edit-modal-root');
    if (!el || !this.formData) return;

    var escapeHtml = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s || ''; };
    var escapeAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) || function(s) { return s || ''; };
    var escHtml = escapeHtml;
    var escAttr = escapeAttr;
    var icons = window.HortOpsIcons;
    var data = this.formData;
    var roster = (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.staffList) || [];
    var hierarchy = window.HortOpsData.getDepartmentHierarchy(roster);

    var deptMap = {};
    hierarchy.forEach(function(d) {
      deptMap[d.name] = d.teams.map(function(t) { return t.name; });
    });

    // Section 18: Preserve existing job suitability values if historical department/team no longer in current hierarchy
    if (data.defaultDepartment && !deptMap[data.defaultDepartment]) {
      deptMap[data.defaultDepartment] = [data.primaryTeam || data.defaultTeam || 'General'];
    }
    if (data.primaryTeam && deptMap[data.defaultDepartment] && deptMap[data.defaultDepartment].indexOf(data.primaryTeam) === -1) {
      deptMap[data.defaultDepartment].unshift(data.primaryTeam);
    }

    var depts = Object.keys(deptMap);
    var availableTeams = deptMap[data.defaultDepartment] || ['General'];

    // Team options for secondary/tertiary with selected state & historical preservation (Mandate Pass 10)
    var allKnownTeams = [];
    depts.forEach(function(d) {
      (deptMap[d] || []).forEach(function(t) { allKnownTeams.push(t); });
    });

    var ctx = {
      data: data,
      depts: depts,
      deptMap: deptMap,
      availableTeams: availableTeams,
      allKnownTeams: allKnownTeams,
      icons: icons,
      escHtml: escHtml,
      escAttr: escAttr
    };

    var teamPreferencesHtml = window.HortOpsJobEditTeamPreferences ?
      window.HortOpsJobEditTeamPreferences.render(ctx) : '';
    var recurrenceFormHtml = window.HortOpsJobEditRecurrenceForm ?
      window.HortOpsJobEditRecurrenceForm.render(ctx) : '';

    var qEngine = window.HortOpsQualifications;
    var allQuals = qEngine ? qEngine.getAllDefinitions() : [];
    var reqQualSet = new Set((data.requiredQualifications || []).map(function(q) { return q.toUpperCase(); }));

    var qualCheckboxesHtml = allQuals.map(function(qd) {
      var isChecked = reqQualSet.has(qd.code.toUpperCase());
      return '<label style="display: flex; align-items: flex-start; gap: 0.4rem; padding: 0.4rem 0.5rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-size: 11px;">' +
        '<input type="checkbox" ' + (isChecked ? 'checked' : '') + ' onchange="window.HortOpsJobEditModal.toggleRequiredQualification(\'' + escAttr(qd.code) + '\', this.checked)" style="margin-top: 2px;" />' +
        '<div>' +
          '<div style="font-weight: 700; color: var(--slate-800);">' + escHtml(qd.name) + '</div>' +
          '<div style="font-size: 10px; color: var(--slate-500);">' + escHtml(qd.category) + '</div>' +
        '</div>' +
      '</label>';
    }).join('');

    var modalHtml = '<div class="modal-overlay" onclick="if(event.target === this) window.HortOpsJobEditModal.close()">' +
      '<div class="modal-card modal-lg">' +
        '<div class="modal-header">' +
          '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
            '<span style="width: 12px; height: 12px; border-radius: 50%; background: ' + escapeAttr(safeColor(data.color, '#047857')) + ';"></span>' +
            '<h2 style="font-size: 1.1rem; font-weight: 800; color: var(--slate-900);">' +
              (this.editingJobId ? ('Edit Job: ' + escHtml(data.name || '')) : 'Create New Horticultural Job') +
            '</h2>' +
          '</div>' +
          '<button type="button" class="btn btn-secondary" style="padding: 0.3rem 0.5rem;" onclick="window.HortOpsJobEditModal.close()">' +
            icons.render('x', 'w-4 h-4') +
          '</button>' +
        '</div>' +

        '<form class="modal-form" onsubmit="window.HortOpsJobEditModal.handleSubmit(event)">' +
          '<div class="modal-body" style="display: flex; flex-direction: column; gap: 0.85rem;">' +
            // Row 1: Basic Info
            '<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.75rem;">' +
              '<div>' +
                '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Job Name *</label>' +
                '<input type="text" class="form-input" required value="' + escAttr(data.name || '') + '" oninput="window.HortOpsJobEditModal.updateField(\'name\', this.value)" />' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Category</label>' +
                '<select class="form-select" onchange="window.HortOpsJobEditModal.updateField(\'category\', this.value)">' +
                  ['Parklands', 'CBD Corridor', 'Arterial Road', 'Biodiversity', 'Sports Fields', 'Infrastructure'].map(function(c) {
                    return '<option value="' + c + '"' + (data.category === c ? ' selected' : '') + '>' + c + '</option>';
                  }).join('') +
                '</select>' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Color Tag</label>' +
                '<input type="color" class="form-input" style="height: 32px; padding: 2px;" value="' + escapeAttr(safeColor(data.color, '#047857')) + '" onchange="window.HortOpsJobEditModal.updateField(\'color\', this.value)" />' +
              '</div>' +
            '</div>' +

            // Row 2: Team Preferences & Exclusive Rules
            teamPreferencesHtml +

            // Row 3: Operational Requirements
            '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 0.75rem;">' +
              '<div>' +
                '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Crew Size Required</label>' +
                '<input type="number" min="1" max="20" class="form-input" value="' + (data.crewSize || 3) + '" oninput="window.HortOpsJobEditModal.updateField(\'crewSize\', parseInt(this.value, 10))" />' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Duration (Hours)</label>' +
                '<input type="number" min="1" max="12" class="form-input" value="' + (data.durationHours || 6) + '" oninput="window.HortOpsJobEditModal.updateField(\'durationHours\', parseInt(this.value, 10))" />' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Start Time</label>' +
                '<input type="text" class="form-input" value="' + escapeAttr(data.startTime || '06:00 AM') + '" oninput="window.HortOpsJobEditModal.updateField(\'startTime\', this.value)" />' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Preferred Day</label>' +
                '<select class="form-select" onchange="window.HortOpsJobEditModal.updateField(\'preferredDay\', this.value)">' +
                  '<option value="saturday"' + (data.preferredDay === 'saturday' ? ' selected' : '') + '>Saturday</option>' +
                  '<option value="sunday"' + (data.preferredDay === 'sunday' ? ' selected' : '') + '>Sunday</option>' +
                  '<option value="friday"' + (data.preferredDay === 'friday' ? ' selected' : '') + '>Friday</option>' +
                  '<option value="monday"' + (data.preferredDay === 'monday' ? ' selected' : '') + '>Monday</option>' +
                '</select>' +
              '</div>' +
            '</div>' +

            // Plant Operator Requirement (Mandate Section 10)
            '<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 0.5rem 0.75rem;">' +
              '<label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer;">' +
                '<input type="checkbox" ' + (data.plantOperatorRequired ? 'checked' : '') + ' onchange="window.HortOpsJobEditModal.updateField(\'plantOperatorRequired\', this.checked)" style="margin-top: 2px;" />' +
                '<div>' +
                  '<span style="font-weight: 700; font-size: 13px; color: var(--slate-800); display: flex; align-items: center; gap: 0.35rem;">' +
                    icons.render('shield', 'w-3.5 h-3.5 text-amber-700') +
                    'Requires Certified Plant Operator' +
                  '</span>' +
                  '<div style="font-size: 11px; color: var(--slate-500); margin-top: 1px;">At least one crew member assigned to this job must hold an active plant operator ticket.</div>' +
                '</div>' +
              '</label>' +
            '</div>' +

            // Stage 3 Gate 3A: Mandatory Qualifications & Machinery Tickets
            '<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.6rem 0.75rem;">' +
              '<div style="font-weight: 700; font-size: 12px; color: #166534; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.35rem;">' +
                icons.render('shield', 'w-3.5 h-3.5 text-emerald-600') +
                'Mandatory Municipal Qualifications & Tickets (Stage 3)' +
              '</div>' +
              '<div style="font-size: 11px; color: #15803d; margin-bottom: 0.5rem;">Crew members assigned to this job must hold active accreditations for all checked tickets:</div>' +
              '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">' +
                qualCheckboxesHtml +
              '</div>' +
            '</div>' +

            // Row 4: Cadence & Frequency-Specific Configuration (P0-07)
            recurrenceFormHtml +

            // Row 5: Location Details
            '<div>' +
              '<label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 0.25rem;">Location Details</label>' +
              '<input type="text" class="form-input" value="' + escapeAttr(data.locationDetails || '') + '" oninput="window.HortOpsJobEditModal.updateField(\'locationDetails\', this.value)" />' +
            '</div>' +

            // Row 6: Regulatory Permits & Approvals
            '<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 0.75rem;">' +
              '<label style="display: block; font-weight: 700; font-size: 12px; color: #92400e; margin-bottom: 0.5rem;">Regulatory Permits & Corridor Approvals</label>' +
              '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">' +
                '<label style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.5rem; background: #ffffff; border: 1px solid #fcd34d; border-radius: 6px; cursor: pointer;">' +
                  '<input type="checkbox" ' + (data.requiresWZTM ? 'checked' : '') + ' onchange="window.HortOpsJobEditModal.updateField(\'requiresWZTM\', this.checked)" />' +
                  '<div>' +
                    '<div style="font-weight: 700; font-size: 12px; color: #78350f;">Work Zone Traffic Management (WZTM)</div>' +
                    '<div style="font-size: 11px; color: #92400e;">Mandatory for road medians, arterial corridors, or lane closures</div>' +
                  '</div>' +
                '</label>' +
                '<label style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.5rem; background: #ffffff; border: 1px solid #fcd34d; border-radius: 6px; cursor: pointer;">' +
                  '<input type="checkbox" ' + (data.requiresTPO ? 'checked' : '') + ' onchange="window.HortOpsJobEditModal.updateField(\'requiresTPO\', this.checked)" />' +
                  '<div>' +
                    '<div style="font-weight: 700; font-size: 12px; color: #78350f;">Tram Protection Order (TPO)</div>' +
                    '<div style="font-size: 11px; color: #92400e;">Mandatory for operations within tramline electrical clearance zones</div>' +
                  '</div>' +
                '</label>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" onclick="window.HortOpsJobEditModal.close()">Cancel</button>' +
            '<button type="submit" class="btn btn-primary">Save Job Definition</button>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div>';

    el.innerHTML = modalHtml;

    // Delegated click listener for exclusive team chips (P0 Security: no inline JS evaluation)
    var modalRoot = document.getElementById('job-edit-modal-root');
    if (modalRoot) {
      modalRoot.onclick = function(e) {
        var chip = e.target.closest('button.btn-exclusive-chip[data-team]');
        if (chip) {
          e.preventDefault();
          window.HortOpsJobEditModal.toggleExclusiveTeam(chip.getAttribute('data-team'));
        }
      };
    }
  },

  handleAnchorDateChange: function(val) {
    this.formData.anchorDate = val;
    if (val && window.HortOpsDateUtils && window.HortOpsDateUtils.calculateWeekFromDate) {
      var w = window.HortOpsDateUtils.calculateWeekFromDate(val);
      this.formData.anchorWeek = w;
      var el = document.getElementById('jem-anchor-week');
      if (el) el.value = w;
    }
  },

  updateField: function(field, val) {
    this.formData[field] = val;
  },

  handleDeptChange: function(newDept) {
    this.formData.defaultDepartment = newDept;
    var roster = (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.staffList) || [];
    var hierarchy = window.HortOpsData.getDepartmentHierarchy(roster);
    var dept = hierarchy.find(function(d) { return d.name === newDept; });
    var firstTeam = dept && dept.teams[0] ? dept.teams[0].name : 'General';
    this.formData.defaultTeam = firstTeam;
    this.formData.primaryTeam = firstTeam;
    this.renderModal();
  },

  toggleExclusiveCheck: function(checked) {
    this.formData.isExclusiveTeams = checked;
    if (checked && (!this.formData.exclusiveTeams || this.formData.exclusiveTeams.length === 0)) {
      var primary = this.formData.primaryTeam || this.formData.defaultTeam;
      if (primary) this.formData.exclusiveTeams = [primary];
    }
    this.renderModal();
  },

  toggleExclusiveTeam: function(team) {
    var list = this.formData.exclusiveTeams || [];
    var idx = list.indexOf(team);
    if (idx === -1) {
      list.push(team);
    } else {
      list.splice(idx, 1);
    }
    this.formData.exclusiveTeams = list;
    this.renderModal();
  },

  addPreferredToExclusive: function() {
    var p = this.formData.primaryTeam || this.formData.defaultTeam;
    var s = this.formData.secondaryTeam;
    var t = this.formData.tertiaryTeam;
    var toAdd = [p, s, t].filter(Boolean);
    var list = this.formData.exclusiveTeams || [];
    toAdd.forEach(function(item) {
      if (list.indexOf(item) === -1) list.push(item);
    });
    this.formData.exclusiveTeams = list;
    this.renderModal();
  },

  toggleRequiredQualification: function(code, checked) {
    if (!this.formData) return;
    if (!Array.isArray(this.formData.requiredQualifications)) {
      this.formData.requiredQualifications = [];
    }
    var upper = String(code).trim().toUpperCase();
    var idx = this.formData.requiredQualifications.indexOf(upper);
    if (checked && idx === -1) {
      this.formData.requiredQualifications.push(upper);
    } else if (!checked && idx !== -1) {
      this.formData.requiredQualifications.splice(idx, 1);
    }
  },

  clearExclusive: function() {
    this.formData.exclusiveTeams = [];
    this.renderModal();
  },

  handleSubmit: function(e) {
    if (e) e.preventDefault();
    if (!this.formData) return;

    if (window.HortOpsJobEditFormValidator) {
      var validation = window.HortOpsJobEditFormValidator.validate(this.formData);
      if (!validation.valid) {
        if (validation.message) alert(validation.message);
        return;
      }
      var existingJob = (window.HortOpsApp && window.HortOpsApp.state && window.HortOpsApp.state.jobs)
        ? window.HortOpsApp.state.jobs.find(function(j) { return j.id === this.formData.id; }.bind(this))
        : null;
      var compat = window.HortOpsJobEditFormValidator.validateRecurrenceCompatibility(existingJob, this.formData);
      if (!compat.valid) {
        if (compat.message) alert(compat.message);
        return;
      }
    } else {
      if (!this.formData.name || !this.formData.name.trim()) return;
      var primary = this.formData.primaryTeam || this.formData.defaultTeam || 'Parks';
      this.formData.primaryTeam = primary;
      this.formData.defaultTeam = primary;
      this.formData.preferredTeam = primary;
    }

    var saveRes = window.HortOpsApp.saveJob(this.formData);
    if (saveRes && saveRes.success === false) {
      return;
    }
    this.close();
  }
};

})();
