// Standalone Offline - Staff Qualification & Accreditation Management Modal Component (Stage 3 Gate 3A)
window.HortOpsStaffQualificationModal = {
  activeStaff: null,

  open: function(staffId) {
    var state = window.HortOpsApp.state;
    var staff = (state.staffList || []).find(function(s) { return s.id === staffId; });
    if (!staff) return;

    this.activeStaff = {
      id: staff.id,
      name: staff.name,
      department: staff.department,
      team: staff.team,
      crew: staff.crew,
      role: staff.role,
      avatarColor: staff.avatarColor,
      qualifications: Array.isArray(staff.qualifications) ? JSON.parse(JSON.stringify(staff.qualifications)) : []
    };

    if (window.HortOpsModalUtils && typeof window.HortOpsModalUtils.lockBackgroundScroll === 'function') {
      window.HortOpsModalUtils.lockBackgroundScroll();
    }
    this.render();
  },

  close: function() {
    this.activeStaff = null;
    var root = document.getElementById('staff-qualification-modal-root');
    if (root) root.innerHTML = '';
    if (window.HortOpsModalUtils && typeof window.HortOpsModalUtils.unlockBackgroundScroll === 'function') {
      window.HortOpsModalUtils.unlockBackgroundScroll();
    }
  },

  onQualCodeSelect: function(code) {
    var engine = window.HortOpsQualifications;
    if (!engine) return;
    var def = engine.getDefinition(code);
    var expiryInput = document.getElementById('new-qual-expiry');
    var issueInput = document.getElementById('new-qual-issued');

    if (def && expiryInput) {
      if (def.isNonExpiring) {
        expiryInput.value = '';
        expiryInput.placeholder = 'Non-expiring accreditation';
      } else {
        var issueDateStr = (issueInput && issueInput.value) ? issueInput.value : (new Date()).toISOString().slice(0, 10);
        if (engine && typeof engine.calculateDefaultExpiry === 'function') {
          expiryInput.value = engine.calculateDefaultExpiry(issueDateStr, code);
        } else {
          var parts = issueDateStr.split('-');
          var dt = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
          var months = def.validityMonths || 36;
          dt.setUTCMonth(dt.getUTCMonth() + months);
          expiryInput.value = dt.toISOString().slice(0, 10);
        }
      }
    }
  },

  addQualification: function() {
    if (!this.activeStaff) return;
    var engine = window.HortOpsQualifications;
    var codeEl = document.getElementById('new-qual-code');
    var issuedEl = document.getElementById('new-qual-issued');
    var expiryEl = document.getElementById('new-qual-expiry');
    var licenseEl = document.getElementById('new-qual-license');
    var verifierEl = document.getElementById('new-qual-verifier');
    var errorBanner = document.getElementById('qual-modal-error');

    if (!codeEl || !codeEl.value) {
      if (errorBanner) {
        errorBanner.style.display = 'block';
        errorBanner.textContent = 'Please select a qualification from the registry.';
      }
      return;
    }

    var code = codeEl.value.trim().toUpperCase();
    var def = engine ? engine.getDefinition(code) : null;
    var issuedDate = issuedEl ? issuedEl.value.trim() : '';
    var expiryDate = expiryEl ? expiryEl.value.trim() : '';
    var licenseNumber = licenseEl ? licenseEl.value.trim() : '';
    var verifiedBy = verifierEl ? verifierEl.value.trim() : 'Supervisor';

    var existingIdx = this.activeStaff.qualifications.findIndex(function(q) {
      return q.code.toUpperCase() === code;
    });

    if (existingIdx !== -1) {
      if (errorBanner) {
        errorBanner.style.display = 'block';
        errorBanner.textContent = 'This staff member already holds accreditation: ' + (def ? def.name : code) + '. Update or delete the existing record below.';
      }
      return;
    }

    var newQual = {
      code: code,
      name: def ? def.name : code,
      issuedDate: issuedDate,
      expiryDate: expiryDate,
      licenseNumber: licenseNumber,
      verifiedBy: verifiedBy || 'Supervisor',
      status: 'active'
    };

    if (engine && typeof engine.validateQualification === 'function') {
      var valCheck = engine.validateQualification(newQual);
      if (!valCheck.valid) {
        if (errorBanner) {
          errorBanner.style.display = 'block';
          errorBanner.textContent = valCheck.error || 'Invalid qualification details.';
        }
        return;
      }
    }

    this.activeStaff.qualifications.push(newQual);
    this.render();
  },

  removeQualification: function(code) {
    if (!this.activeStaff) return;
    var upper = String(code).trim().toUpperCase();
    this.activeStaff.qualifications = this.activeStaff.qualifications.filter(function(q) {
      return q.code.toUpperCase() !== upper;
    });
    this.render();
  },

  save: function() {
    if (!this.activeStaff) return;
    var errorBanner = document.getElementById('qual-modal-error');

    var updated = {
      id: this.activeStaff.id,
      qualifications: this.activeStaff.qualifications
    };

    var res = window.HortOpsApp.updateStaffMember(updated);
    if (res && !res.success) {
      if (errorBanner) {
        errorBanner.style.display = 'block';
        errorBanner.textContent = 'Failed to save qualifications: ' + (res.error || 'Storage error');
      } else {
        alert('Failed to save qualifications: ' + (res.error || 'Storage error'));
      }
      return;
    }

    this.close();
  },

  render: function() {
    var root = document.getElementById('staff-qualification-modal-root');
    if (!root || !this.activeStaff) return;

    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) ? window.HortOpsSecurityUtils.escapeHtml : function(s) { return String(s || ''); };
    var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) ? window.HortOpsSecurityUtils.escapeHtmlAttr : function(s) { return String(s || ''); };
    var icons = window.HortOpsIcons;
    var engine = window.HortOpsQualifications;
    var defs = engine ? engine.getAllDefinitions() : [];

    var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey()
      : (new Date()).toISOString().slice(0, 10);

    var existingCodes = new Set(this.activeStaff.qualifications.map(function(q) { return q.code.toUpperCase(); }));

    var qualOptionsHtml = '<option value="">-- Select Accreditation --</option>' +
      defs.filter(function(d) { return !existingCodes.has(d.code.toUpperCase()); }).map(function(d) {
        return '<option value="' + escAttr(d.code) + '">' + esc(d.name) + ' (' + esc(d.category) + ')</option>';
      }).join('');

    var rowsHtml = '';
    if (this.activeStaff.qualifications.length === 0) {
      rowsHtml = '<tr><td colspan="7" style="text-align: center; color: var(--slate-400); padding: 1.5rem;">No accreditations or machinery tickets currently recorded for this employee.</td></tr>';
    } else {
      rowsHtml = this.activeStaff.qualifications.map(function(q) {
        var def = engine ? engine.getDefinition(q.code) : null;
        var isExpired = engine ? engine.isExpired(q, todayStr) : false;
        var statusBadge = '';

        if (isExpired) {
          statusBadge = '<span class="badge" style="background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-weight: 700; font-size: 11px;">Expired</span>';
        } else {
          statusBadge = '<span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-weight: 700; font-size: 11px;">Active</span>';
        }

        var badgeColor = (def && def.badgeColor) ? def.badgeColor : '#059669';

        return '<tr>' +
          '<td>' +
            '<div style="display: flex; align-items: center; gap: 0.4rem;">' +
              '<span style="width: 8px; height: 8px; border-radius: 50%; background: ' + escAttr(badgeColor) + ';"></span>' +
              '<span style="font-weight: 700; color: var(--slate-900); font-family: monospace;">' + esc(q.code) + '</span>' +
            '</div>' +
            '<div style="font-size: 11px; color: var(--slate-500);">' + esc(def ? def.name : '') + '</div>' +
          '</td>' +
          '<td><span class="badge badge-slate" style="font-size: 11px;">' + esc(def ? def.category : 'General') + '</span></td>' +
          '<td style="font-size: 12px; font-family: monospace;">' + esc(q.licenseNumber || '—') + '</td>' +
          '<td style="font-size: 12px;">' + esc(q.issuedDate || '—') + '</td>' +
          '<td style="font-size: 12px; font-weight: ' + (isExpired ? '700; color: #b91c1c;' : 'normal;') + '">' + esc(q.expiryDate || 'Indefinite') + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="text-align: center;">' +
            '<button type="button" class="btn btn-secondary" style="padding: 2px 6px; font-size: 11px; color: #b91c1c; border-color: #fecaca;" onclick="window.HortOpsStaffQualificationModal.removeQualification(\'' + escAttr(q.code) + '\')" title="Remove ticket">' +
              icons.render('trash', 'w-3 h-3') +
            '</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    var defaultIssued = todayStr;
    var defaultExpiryDate = new Date();
    defaultExpiryDate.setFullYear(defaultExpiryDate.getFullYear() + 3);
    var defaultExpiry = defaultExpiryDate.toISOString().slice(0, 10);

    var modalHtml = '<div class="modal-overlay" onclick="if(event.target === this) window.HortOpsStaffQualificationModal.close()">' +
      '<div class="modal-card modal-lg" id="modal-staff-qualifications" role="dialog" aria-modal="true" style="max-width: 820px; max-height: 90vh; display: flex; flex-direction: column;">' +
        // Header
        '<div class="modal-header" style="background: var(--slate-50); border-bottom: 1px solid var(--slate-200); padding: 1rem 1.25rem;">' +
          '<div style="display: flex; align-items: center; gap: 0.6rem;">' +
            '<span style="display: inline-flex; padding: 6px; border-radius: 8px; background: #ecfdf5; color: #059669;">' +
              icons.render('shield', 'w-5 h-5') +
            '</span>' +
            '<div>' +
              '<h3 style="margin: 0; font-size: 16px; font-weight: 700; color: var(--slate-900);">Workforce Qualifications & Accreditations</h3>' +
              '<div style="font-size: 12px; color: var(--slate-500);">' + esc(this.activeStaff.name) + ' (' + esc(this.activeStaff.role) + ' — ' + esc(this.activeStaff.team) + ')</div>' +
            '</div>' +
          '</div>' +
          '<button class="modal-close-btn" onclick="window.HortOpsStaffQualificationModal.close()" aria-label="Close modal">' +
            icons.render('x', 'w-4 h-4') +
          '</button>' +
        '</div>' +

        // Body
        '<div class="modal-body" style="padding: 1.25rem; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem;">' +
          '<div id="qual-modal-error" style="display: none; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 0.75rem 1rem; font-size: 13px; color: #dc2626; font-weight: 600;"></div>' +

          // Current Accreditations Table
          '<div>' +
            '<div style="font-size: 13px; font-weight: 700; color: var(--slate-800); margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">' +
              '<span>Accredited Tickets & Certifications (' + this.activeStaff.qualifications.length + ')</span>' +
              '<span style="font-size: 11px; font-weight: normal; color: var(--slate-500);">Evaluated against Adelaide Municipal Standard</span>' +
            '</div>' +
            '<div style="overflow-x: auto; border: 1px solid var(--slate-200); border-radius: 6px;">' +
              '<table class="planner-table" style="margin: 0; font-size: 12px;">' +
                '<thead><tr>' +
                  '<th>Accreditation</th>' +
                  '<th>Category</th>' +
                  '<th>Ticket / License #</th>' +
                  '<th>Issued</th>' +
                  '<th>Expiry Date</th>' +
                  '<th>Status</th>' +
                  '<th style="width: 50px; text-align: center;">Action</th>' +
                '</tr></thead>' +
                '<tbody>' + rowsHtml + '</tbody>' +
              '</table>' +
            '</div>' +
          '</div>' +

          // Add Accreditation Section
          '<div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 6px; padding: 1rem;">' +
            '<div style="font-size: 13px; font-weight: 700; color: var(--slate-800); margin-bottom: 0.75rem;">Add New Qualification / Ticket</div>' +
            '<div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: var(--slate-600); margin-bottom: 0.25rem;">Qualification / Ticket</label>' +
                '<select id="new-qual-code" class="form-select" style="width: 100%; font-size: 12px;" onchange="window.HortOpsStaffQualificationModal.onQualCodeSelect(this.value)">' +
                  qualOptionsHtml +
                '</select>' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: var(--slate-600); margin-bottom: 0.25rem;">Issued Date</label>' +
                '<input type="date" id="new-qual-issued" class="form-input" style="width: 100%; font-size: 12px;" value="' + escAttr(defaultIssued) + '" onchange="window.HortOpsStaffQualificationModal.onQualCodeSelect(document.getElementById(\'new-qual-code\').value)" />' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: var(--slate-600); margin-bottom: 0.25rem;">Expiry Date</label>' +
                '<input type="date" id="new-qual-expiry" class="form-input" style="width: 100%; font-size: 12px;" value="' + escAttr(defaultExpiry) + '" />' +
              '</div>' +
            '</div>' +
            '<div style="display: grid; grid-template-columns: 2fr 2fr auto; gap: 0.75rem; align-items: flex-end;">' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: var(--slate-600); margin-bottom: 0.25rem;">Accreditation / License Number</label>' +
                '<input type="text" id="new-qual-license" class="form-input" style="width: 100%; font-size: 12px;" placeholder="e.g. SA-EWP-88492" />' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: var(--slate-600); margin-bottom: 0.25rem;">Verified By (Supervisor / Depot Lead)</label>' +
                '<input type="text" id="new-qual-verifier" class="form-input" style="width: 100%; font-size: 12px;" value="Depot Supervisor" />' +
              '</div>' +
              '<div>' +
                '<button type="button" class="btn btn-secondary" style="font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.3rem;" onclick="window.HortOpsStaffQualificationModal.addQualification()">' +
                  icons.render('plus', 'w-4 h-4') +
                  '<span>Add Ticket</span>' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        // Footer
        '<div class="modal-footer" style="padding: 1rem 1.25rem; background: var(--slate-50); border-top: 1px solid var(--slate-200); display: flex; justify-content: flex-end; gap: 0.75rem;">' +
          '<button type="button" class="btn btn-secondary" onclick="window.HortOpsStaffQualificationModal.close()">Cancel</button>' +
          '<button type="button" class="btn btn-primary" onclick="window.HortOpsStaffQualificationModal.save()">' +
            icons.render('save', 'w-4 h-4') +
            '<span style="margin-left: 6px;">Save Accreditations</span>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';

    root.innerHTML = modalHtml;
  }
};
