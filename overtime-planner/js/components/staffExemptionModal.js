// Standalone Offline - Staff Overtime Exemption Modal Component
window.HortOpsStaffExemptionModal = {
  activeStaff: null,

  open: function(staffId) {
    var state = window.HortOpsApp.state;
    var staff = (state.staffList || []).find(function(s) { return s.id === staffId; });
    if (!staff) return;

    // Clone staff data for editing
    this.activeStaff = {
      id: staff.id,
      name: staff.name,
      department: staff.department,
      team: staff.team,
      crew: staff.crew,
      role: staff.role,
      avatarColor: staff.avatarColor,
      isOvertimeExempt: !!staff.isOvertimeExempt,
      exemptionStartDate: staff.exemptionStartDate || '',
      exemptionEndDate: staff.exemptionEndDate || '',
      exemptionReason: staff.exemptionReason || ''
    };

    if (window.HortOpsModalUtils) window.HortOpsModalUtils.lockBackgroundScroll();
    this.render();
  },

  close: function() {
    this.activeStaff = null;
    var root = document.getElementById('staff-exemption-modal-root');
    if (root) root.innerHTML = '';
    if (window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll();
  },

  toggleExempt: function(checked) {
    if (!this.activeStaff) return;
    this.activeStaff.isOvertimeExempt = checked;
    var toggle = document.getElementById('exemption-toggle');
    if (toggle && toggle.checked !== checked) {
      toggle.checked = checked;
    }
    var dateSection = document.getElementById('exemption-dates-section');
    if (dateSection) {
      dateSection.style.opacity = checked ? '1' : '0.4';
      dateSection.style.pointerEvents = checked ? 'auto' : 'none';
    }
  },

  setPreset: function(days) {
    if (!this.activeStaff) return;
    var startInput = document.getElementById('exemption-start-date');
    var endInput = document.getElementById('exemption-end-date');

    if (days === 'clear') {
      if (startInput) startInput.value = '';
      if (endInput) endInput.value = '';
      this.activeStaff.exemptionStartDate = '';
      this.activeStaff.exemptionEndDate = '';
      return;
    }

    var toggle = document.getElementById('exemption-toggle');
    if (toggle && !toggle.checked) {
      toggle.checked = true;
      this.toggleExempt(true);
    }

    var now = new Date();
    var sStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey(now)
      : now.toISOString().split('T')[0];

    if (days === 'indefinite') {
      if (startInput) startInput.value = sStr;
      if (endInput) endInput.value = '';
      this.activeStaff.exemptionStartDate = sStr;
      this.activeStaff.exemptionEndDate = '';
      return;
    }

    var endDateObj = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    var eStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey(endDateObj)
      : endDateObj.toISOString().split('T')[0];

    if (startInput) startInput.value = sStr;
    if (endInput) endInput.value = eStr;
    this.activeStaff.exemptionStartDate = sStr;
    this.activeStaff.exemptionEndDate = eStr;
  },

  save: function() {
    if (!this.activeStaff) return;

    var toggle = document.getElementById('exemption-toggle');
    var startInput = document.getElementById('exemption-start-date');
    var endInput = document.getElementById('exemption-end-date');
    var reasonInput = document.getElementById('exemption-reason');

    var isExempt = toggle ? toggle.checked : this.activeStaff.isOvertimeExempt;
    var startDate = startInput ? startInput.value.trim() : this.activeStaff.exemptionStartDate;
    var endDate = endInput ? endInput.value.trim() : this.activeStaff.exemptionEndDate;
    var reason = reasonInput ? reasonInput.value.trim() : this.activeStaff.exemptionReason;

    // Validate date sequence if both set
    if (startDate && endDate && startDate > endDate) {
      alert('Start date cannot be after end date.');
      return;
    }

    var updated = {
      id: this.activeStaff.id,
      isOvertimeExempt: isExempt,
      exemptionStartDate: isExempt ? startDate : '',
      exemptionEndDate: isExempt ? endDate : '',
      exemptionReason: isExempt ? reason : ''
    };

    var res = window.HortOpsApp.updateStaffMember(updated);
    if (res && !res.success) {
      if (typeof alert === 'function') alert('Failed to update staff member: ' + (res.error || 'Storage error'));
      return;
    }
    this.close();
  },

  render: function() {
    var root = document.getElementById('staff-exemption-modal-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'staff-exemption-modal-root';
      document.body.appendChild(root);
    }

    var staff = this.activeStaff;
    if (!staff) {
      root.innerHTML = '';
      return;
    }

    var icons = window.HortOpsIcons;
    var isExempt = staff.isOvertimeExempt;

    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    };
    var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) || esc;

    var html = 
      '<div class="modal-overlay" onclick="if(event.target === this) window.HortOpsStaffExemptionModal.close()">' +
        '<div class="modal-card" style="max-width: 520px; width: 95%;" onclick="event.stopPropagation()">' +
          
          // Header
          '<div class="modal-header" style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 1.25rem 1.5rem; color: #ffffff; display: flex; justify-content: space-between; align-items: flex-start; flex: 0 0 auto;">' +
            '<div>' +
              '<div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">' +
                '<span style="background: rgba(255, 255, 255, 0.15); padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;">Overtime Governance</span>' +
                '<span style="background: rgba(255, 255, 255, 0.1); padding: 0.2rem 0.45rem; border-radius: 4px; font-size: 11px;">' + esc(staff.id) + '</span>' +
              '</div>' +
              '<h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #ffffff;">' + esc(staff.name) + '</h3>' +
              '<div style="font-size: 12px; color: #c7d2fe; margin-top: 0.2rem;">' + esc(staff.department) + ' • ' + esc(staff.team) + ' • ' + esc(staff.role) + '</div>' +
            '</div>' +
            '<button class="btn btn-secondary" style="background: rgba(255, 255, 255, 0.1); border: none; color: #ffffff; padding: 0.35rem; border-radius: 6px; cursor: pointer;" onclick="window.HortOpsStaffExemptionModal.close()" title="Close">' +
              (icons ? icons.render('x', 'w-4 h-4') : '✕') +
            '</button>' +
          '</div>' +

          // Body
          '<div class="modal-body" style="padding: 1.25rem 1.5rem; background: #ffffff;">' +
            
            // Toggle Switch (Repaired interactive toggle control)
            '<div style="display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 1.25rem;">' +
              '<div>' +
                '<div style="font-weight: 700; font-size: 13px; color: #0f172a;">Exempt from Weekend Overtime</div>' +
                '<div style="font-size: 11px; color: #64748b; margin-top: 0.15rem;">Staff will be excluded from the candidate pool in Crew Allocator</div>' +
              '</div>' +
              '<label class="toggle-switch" title="Toggle Overtime Exemption">' +
                '<input type="checkbox" id="exemption-toggle" ' + (isExempt ? 'checked' : '') + ' onchange="window.HortOpsStaffExemptionModal.toggleExempt(this.checked)" />' +
                '<span class="toggle-switch-slider"></span>' +
              '</label>' +
            '</div>' +

            // Date Range Section
            '<div id="exemption-dates-section" style="opacity: ' + (isExempt ? '1' : '0.4') + '; pointer-events: ' + (isExempt ? 'auto' : 'none') + '; transition: opacity 0.2s;">' +
              
              // Preset buttons
              '<div style="margin-bottom: 1rem;">' +
                '<div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 0.4rem; letter-spacing: 0.05em;">Quick Window Presets</div>' +
                '<div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">' +
                  '<button type="button" class="btn btn-secondary" style="padding: 0.25rem 0.55rem; font-size: 11px; font-weight: 600;" onclick="window.HortOpsStaffExemptionModal.setPreset(30)">Next 30 Days</button>' +
                  '<button type="button" class="btn btn-secondary" style="padding: 0.25rem 0.55rem; font-size: 11px; font-weight: 600;" onclick="window.HortOpsStaffExemptionModal.setPreset(90)">Next 90 Days</button>' +
                  '<button type="button" class="btn btn-secondary" style="padding: 0.25rem 0.55rem; font-size: 11px; font-weight: 600;" onclick="window.HortOpsStaffExemptionModal.setPreset(\'indefinite\')">Permanent / Indefinite</button>' +
                '</div>' +
              '</div>' +

              // Date inputs
              '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem;">' +
                '<div>' +
                  '<label style="display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 0.3rem;">Start Date (Optional)</label>' +
                  '<input type="date" id="exemption-start-date" class="form-input" style="width: 100%; font-size: 12px;" value="' + escAttr(staff.exemptionStartDate || '') + '" />' +
                  '<span style="display: block; font-size: 10px; color: #94a3b8; margin-top: 0.2rem;">Leave blank for immediate</span>' +
                '</div>' +
                '<div>' +
                  '<label style="display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 0.3rem;">End Date (Optional)</label>' +
                  '<input type="date" id="exemption-end-date" class="form-input" style="width: 100%; font-size: 12px;" value="' + escAttr(staff.exemptionEndDate || '') + '" />' +
                  '<span style="display: block; font-size: 10px; color: #94a3b8; margin-top: 0.2rem;">Leave blank for indefinite</span>' +
                '</div>' +
              '</div>' +

              // Reason
              '<div style="margin-bottom: 1rem;">' +
                '<label style="display: block; font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 0.3rem;">Reason / Governance Notes</label>' +
                '<input type="text" id="exemption-reason" class="form-input" style="width: 100%; font-size: 12px;" placeholder="e.g. Medical restriction, Study leave, Personal opt-out..." value="' + escAttr(staff.exemptionReason || '') + '" />' +
              '</div>' +

              // Explanatory Banner
              '<div style="background: #fdf4ff; border: 1px solid #f0abfc; border-radius: 8px; padding: 0.75rem 0.9rem; font-size: 11px; color: #701a75; display: flex; align-items: flex-start; gap: 0.5rem;">' +
                '<span style="font-weight: 700; font-size: 13px;">ℹ️</span>' +
                '<div>' +
                  '<strong>Exemption Enforcement:</strong> When active, this employee will be suppressed from the candidate pool in the Crew Allocator for any shifts occurring within the specified date window.' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          // Footer
          '<div class="modal-footer" style="padding: 0.9rem 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 0.5rem; flex: 0 0 auto;">' +
            '<button type="button" class="btn btn-secondary" onclick="window.HortOpsStaffExemptionModal.close()">Cancel</button>' +
            '<button type="button" class="btn btn-primary" style="background: #7c3aed; border-color: #6d28d9;" onclick="window.HortOpsStaffExemptionModal.save()">Save Exemption</button>' +
          '</div>' +

        '</div>' +
      '</div>';

    root.innerHTML = html;
  }
};
