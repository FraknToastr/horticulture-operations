(function() {
// Imported colours never enter CSS/HTML without token validation.
var safeColor = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.safeColor) || function() { return '#10b981'; };
// Standalone Offline - Staff Absence & Refusal Management Modal Component (Stage 3 Gate 3D & Review 56 R56-P1-06 & Review 57 R57-P2-07)
// Provides supervisor-facing operational Full CRUD (Create, Read, Update, Delete) with identity retention
// for dated absence intervals (annual, sick, RDO, training) and refusal history logging with fair-share score impact and live shift conflict detection.
(function() {
  'use strict';

  var HortOpsStaffAbsenceModal = {
    activeStaff: null,
    activeTab: 'absences', // 'absences' | 'refusals'
    workingAbsences: [],
    workingRefusals: [],
    editingAbsenceId: null,
    editingRefusalId: null,
    errorMessage: '',

    open: function(staffId) {
      var state = (window.HortOpsApp && window.HortOpsApp.state) || {};
      var staff = (state.staffList || []).find(function(s) { return s.id === staffId; });
      if (!staff) return;

      this.activeStaff = {
        id: staff.id,
        name: staff.name,
        department: staff.department,
        team: staff.team,
        crew: staff.crew,
        role: staff.role,
        avatarColor: staff.avatarColor || '#10b981',
        ytdOvertimeHours: (typeof staff.ytdOvertimeHours === 'number') ? staff.ytdOvertimeHours : ((typeof staff.ytdHours === 'number') ? staff.ytdHours : 0)
      };

      this.activeTab = 'absences';
      this.editingAbsenceId = null;
      this.editingRefusalId = null;
      this.errorMessage = '';
      this.removedAbsenceIds = new Set();
      this.removedRefusalIds = new Set();
      this.baseAbsences = Array.isArray(state.absences) ? JSON.parse(JSON.stringify(state.absences)) : [];
      this.baseRefusals = Array.isArray(state.refusalHistory) ? JSON.parse(JSON.stringify(state.refusalHistory)) : [];
      this.workingAbsences = Array.isArray(state.absences) ? JSON.parse(JSON.stringify(state.absences)) : [];
      this.workingRefusals = Array.isArray(state.refusalHistory) ? JSON.parse(JSON.stringify(state.refusalHistory)) : [];

      if (window.HortOpsModalUtils && typeof window.HortOpsModalUtils.lockBackgroundScroll === 'function') {
        window.HortOpsModalUtils.lockBackgroundScroll();
      }
      this.render();
    },

    close: function() {
      this.activeStaff = null;
      this.editingAbsenceId = null;
      this.editingRefusalId = null;
      this.errorMessage = '';
      this.removedAbsenceIds = new Set();
      this.removedRefusalIds = new Set();
      this.baseAbsences = null;
      this.baseRefusals = null;
      this.workingAbsences = [];
      this.workingRefusals = [];
      var root = document.getElementById('staff-absence-modal-root');
      if (root) root.innerHTML = '';
      if (window.HortOpsModalUtils && typeof window.HortOpsModalUtils.unlockBackgroundScroll === 'function') {
        window.HortOpsModalUtils.unlockBackgroundScroll();
      }
    },

    switchTab: function(tab) {
      this.activeTab = tab;
      this.editingAbsenceId = null;
      this.editingRefusalId = null;
      this.errorMessage = '';
      this.render();
    },

    addAbsence: function() {
      if (!this.activeStaff) return;
      var typeEl = document.getElementById('new-absence-type');
      var startEl = document.getElementById('new-absence-start');
      var endEl = document.getElementById('new-absence-end');
      var notesEl = document.getElementById('new-absence-notes');

      var type = typeEl ? typeEl.value.trim() : '';
      var startDate = startEl ? startEl.value.trim() : '';
      var endDate = endEl ? endEl.value.trim() : '';
      var notes = notesEl ? notesEl.value.trim() : '';

      var engine = window.HortOpsAbsences;
      if (!type) {
        this.showError('Please select an absence type.');
        return;
      }
      if (!engine || !engine.isRealYmd(startDate)) {
        this.showError('Start date must be a valid calendar date (YYYY-MM-DD).');
        return;
      }
      if (!engine || !engine.isRealYmd(endDate)) {
        this.showError('End date must be a valid calendar date (YYYY-MM-DD).');
        return;
      }
      if (endDate < startDate) {
        this.showError('End date cannot precede start date.');
        return;
      }

      var newRec = {
        id: 'abs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        staffId: this.activeStaff.id,
        type: type,
        startDate: startDate,
        endDate: endDate,
        notes: notes
      };

      if (engine && typeof engine.validateAbsenceRecord === 'function') {
        var v = engine.validateAbsenceRecord(newRec);
        if (!v.valid) {
          this.showError(v.error);
          return;
        }
      }

      this.workingAbsences.push(newRec);
      this.errorMessage = '';
      this.render();
    },

    startEditAbsence: function(recId) {
      if (!this.activeStaff) return;
      var rec = this.workingAbsences.find(function(r) { return r.id === recId; });
      if (!rec) return;
      this.editingAbsenceId = recId;
      this.errorMessage = '';
      this.render();
    },

    cancelEditAbsence: function() {
      this.editingAbsenceId = null;
      this.errorMessage = '';
      this.render();
    },

    updateAbsence: function() {
      if (!this.activeStaff || !this.editingAbsenceId) return;
      var rec = this.workingAbsences.find(function(r) { return r.id === HortOpsStaffAbsenceModal.editingAbsenceId; });
      if (!rec) return;

      var typeEl = document.getElementById('edit-absence-type');
      var startEl = document.getElementById('edit-absence-start');
      var endEl = document.getElementById('edit-absence-end');
      var notesEl = document.getElementById('edit-absence-notes');

      var type = typeEl ? typeEl.value.trim() : '';
      var startDate = startEl ? startEl.value.trim() : '';
      var endDate = endEl ? endEl.value.trim() : '';
      var notes = notesEl ? notesEl.value.trim() : '';

      var engine = window.HortOpsAbsences;
      if (!type) {
        this.showError('Please select an absence type.');
        return;
      }
      if (!engine || !engine.isRealYmd(startDate)) {
        this.showError('Start date must be a valid calendar date (YYYY-MM-DD).');
        return;
      }
      if (!engine || !engine.isRealYmd(endDate)) {
        this.showError('End date must be a valid calendar date (YYYY-MM-DD).');
        return;
      }
      if (endDate < startDate) {
        this.showError('End date cannot precede start date.');
        return;
      }

      var candidateUpdate = {
        id: rec.id, // Mandatory identity retention (R57-P2-07)
        staffId: rec.staffId,
        type: type,
        startDate: startDate,
        endDate: endDate,
        notes: notes
      };

      if (engine && typeof engine.validateAbsenceRecord === 'function') {
        var v = engine.validateAbsenceRecord(candidateUpdate);
        if (!v.valid) {
          this.showError(v.error);
          return;
        }
      }

      rec.type = type;
      rec.startDate = startDate;
      rec.endDate = endDate;
      rec.notes = notes;

      this.editingAbsenceId = null;
      this.errorMessage = '';
      this.render();
    },

    removeAbsence: function(recId) {
      if (!this.activeStaff) return;
      if (this.editingAbsenceId === recId) {
        this.editingAbsenceId = null;
      }
      if (recId) {
        if (!this.removedAbsenceIds) this.removedAbsenceIds = new Set();
        this.removedAbsenceIds.add(recId);
      }
      this.workingAbsences = this.workingAbsences.filter(function(r) {
        return r.id !== recId;
      });
      this.errorMessage = '';
      this.render();
    },

    addRefusal: function() {
      if (!this.activeStaff) return;
      var dateEl = document.getElementById('new-refusal-date');
      var shiftEl = document.getElementById('new-refusal-shift');
      var notesEl = document.getElementById('new-refusal-notes');

      var dateStr = dateEl ? dateEl.value.trim() : '';
      var shiftId = shiftEl ? shiftEl.value.trim() : '';
      var reason = notesEl ? notesEl.value.trim() : '';

      var engine = window.HortOpsAbsences;
      if (!engine || !engine.isRealYmd(dateStr)) {
        this.showError('Refusal date must be a valid calendar date (YYYY-MM-DD).');
        return;
      }

      var newRef = {
        id: 'ref_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        staffId: this.activeStaff.id,
        date: dateStr,
        reason: reason || 'Declined overtime offering'
      };
      if (shiftId) {
        newRef.shiftId = shiftId;
      }

      this.workingRefusals.push(newRef);
      this.errorMessage = '';
      this.render();
    },

    startEditRefusal: function(refId) {
      if (!this.activeStaff) return;
      var ref = this.workingRefusals.find(function(r) { return r.id === refId; });
      if (!ref) return;
      this.editingRefusalId = refId;
      this.errorMessage = '';
      this.render();
    },

    cancelEditRefusal: function() {
      this.editingRefusalId = null;
      this.errorMessage = '';
      this.render();
    },

    updateRefusal: function() {
      if (!this.activeStaff || !this.editingRefusalId) return;
      var ref = this.workingRefusals.find(function(r) { return r.id === HortOpsStaffAbsenceModal.editingRefusalId; });
      if (!ref) return;

      var dateEl = document.getElementById('edit-refusal-date');
      var shiftEl = document.getElementById('edit-refusal-shift');
      var notesEl = document.getElementById('edit-refusal-notes');

      var dateStr = dateEl ? dateEl.value.trim() : '';
      var shiftId = shiftEl ? shiftEl.value.trim() : '';
      var reason = notesEl ? notesEl.value.trim() : '';

      var engine = window.HortOpsAbsences;
      if (!engine || !engine.isRealYmd(dateStr)) {
        this.showError('Refusal date must be a valid calendar date (YYYY-MM-DD).');
        return;
      }

      // Mandatory identity retention (R57-P2-07)
      ref.date = dateStr;
      if (shiftId) {
        ref.shiftId = shiftId;
      } else {
        delete ref.shiftId;
      }
      ref.reason = reason || 'Declined overtime offering';

      this.editingRefusalId = null;
      this.errorMessage = '';
      this.render();
    },

    removeRefusal: function(refId) {
      if (!this.activeStaff) return;
      if (this.editingRefusalId === refId) {
        this.editingRefusalId = null;
      }
      if (refId) {
        if (!this.removedRefusalIds) this.removedRefusalIds = new Set();
        this.removedRefusalIds.add(refId);
      }
      this.workingRefusals = this.workingRefusals.filter(function(r) {
        return r.id !== refId;
      });
      this.errorMessage = '';
      this.render();
    },

    showError: function(msg) {
      this.errorMessage = msg;
      var errEl = document.getElementById('absence-modal-error');
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
    },

    saveDirect: function() {
      if (!this.activeStaff) return;
      if (!window.HortOpsApp || typeof window.HortOpsApp.saveAbsenceAndRefusalData !== 'function') {
        this.showError('Canonical application persistence handler unavailable.');
        return { success: false, error: 'Canonical persistence unavailable.' };
      }

      var options = {
        deletedAbsenceIds: Array.from(this.removedAbsenceIds || []),
        deletedRefusalIds: Array.from(this.removedRefusalIds || []),
        baseAbsences: this.baseAbsences,
        baseRefusals: this.baseRefusals
      };
      var res = window.HortOpsApp.saveAbsenceAndRefusalData(this.workingAbsences, this.workingRefusals, options);
      if (res && !res.success) {
        this.showError('Failed to save absence and refusal data: ' + (res.error || 'Validation error'));
        return res;
      }

      this.close();
      return { success: true };
    },

    save: function() {
      if (!this.activeStaff) return;
      if (!window.HortOpsApp || typeof window.HortOpsApp.getAbsenceImpactDraft !== 'function' || !window.HortOpsAbsenceImpactModal) return this.saveDirect();
      try {
        var draft = window.HortOpsApp.getAbsenceImpactDraft();
        if (draft.model && draft.model.affected && draft.model.affected.length) return window.HortOpsAbsenceImpactModal.open();
      } catch (error) {
        this.showError('Cannot review absence impact: ' + error.message);
        return { success: false, error: error.message };
      }
      return this.saveDirect();
    },

    render: function() {
      var root = document.getElementById('staff-absence-modal-root');
      if (!root) {
        root = document.createElement('div');
        root.id = 'staff-absence-modal-root';
        document.body.appendChild(root);
      }

      var staff = this.activeStaff;
      if (!staff) {
        root.innerHTML = '';
        return;
      }

      var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) ? window.HortOpsSecurityUtils.escapeHtml : function(s) { return String(s || ''); };
      var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) ? window.HortOpsSecurityUtils.escapeHtmlAttr : function(s) { return String(s || ''); };
      var icons = window.HortOpsIcons;
      var absEngine = window.HortOpsAbsences;
      var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
        ? window.HortOpsDateUtils.getLocalDateKey()
        : new Date().toISOString().slice(0, 10);

      var staffAbsences = this.workingAbsences.filter(function(a) { return a.staffId === staff.id; });
      var staffRefusals = this.workingRefusals.filter(function(r) { return r.staffId === staff.id; });

      var fairShareScore = 1000;
      if (absEngine && typeof absEngine.calculateFairShareScore === 'function') {
        fairShareScore = absEngine.calculateFairShareScore(staff, { refusalHistory: this.workingRefusals, asOfDate: todayStr });
      }

      var html = '<div class="modal-backdrop" style="position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1050; padding: 1rem;">' +
        '<div class="modal-card" style="background: #ffffff; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1); width: 100%; max-width: 780px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #cbd5e1;">' +

        // Modal Header
        '<div class="modal-header" style="padding: 1.25rem 1.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex: 0 0 auto;">' +
          '<div style="display: flex; align-items: center; gap: 0.75rem;">' +
            '<div style="width: 40px; height: 40px; border-radius: 50%; background: ' + escAttr(safeColor(staff.avatarColor, '#10b981')) + '; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px;">' +
              esc(staff.name.slice(0, 2).toUpperCase()) +
            '</div>' +
            '<div>' +
              '<h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #0f172a;">' + esc(staff.name) + ' — Operational Leave & Refusal Ledger</h3>' +
              '<div style="font-size: 12px; color: #64748b; margin-top: 2px;">' +
                esc(staff.role) + ' &bull; ' + esc(staff.department) + ' &bull; ' + esc(staff.team) + ' (' + esc(staff.crew) + ')' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn btn-secondary" style="padding: 0.35rem 0.6rem; font-size: 13px; font-weight: 700; color: #64748b; background: transparent; border: none; cursor: pointer;" onclick="window.HortOpsStaffAbsenceModal.close()">&times;</button>' +
        '</div>' +

        // Tab Navigation
        '<div style="display: flex; border-bottom: 1px solid #e2e8f0; background: #ffffff; padding: 0 1.5rem; gap: 1rem; flex: 0 0 auto;">' +
          '<button type="button" style="padding: 0.75rem 0.5rem; font-size: 13px; font-weight: 700; border: none; background: transparent; cursor: pointer; border-bottom: 3px solid ' + (this.activeTab === 'absences' ? '#0284c7' : 'transparent') + '; color: ' + (this.activeTab === 'absences' ? '#0284c7' : '#64748b') + ';" onclick="window.HortOpsStaffAbsenceModal.switchTab(\'absences\')">' +
            '📅 Leave & Absences (' + staffAbsences.length + ')' +
          '</button>' +
          '<button type="button" style="padding: 0.75rem 0.5rem; font-size: 13px; font-weight: 700; border: none; background: transparent; cursor: pointer; border-bottom: 3px solid ' + (this.activeTab === 'refusals' ? '#0284c7' : 'transparent') + '; color: ' + (this.activeTab === 'refusals' ? '#0284c7' : '#64748b') + ';" onclick="window.HortOpsStaffAbsenceModal.switchTab(\'refusals\')">' +
            '⚖️ Overtime Refusal History (' + staffRefusals.length + ')' +
          '</button>' +
        '</div>' +

        // Error message banner
        '<div id="absence-modal-error" style="display: ' + (this.errorMessage ? 'block' : 'none') + '; margin: 0.75rem 1.5rem 0 1.5rem; padding: 0.6rem 0.9rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; color: #dc2626; font-size: 12px; font-weight: 600;">' +
          esc(this.errorMessage) +
        '</div>' +

        // Modal Body
        '<div class="modal-body" style="padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1 1 auto;">';

      if (this.activeTab === 'absences') {
        // Existing Absences Table
        html += '<div style="margin-bottom: 1.5rem;">' +
          '<div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Logged Leave & Absence Intervals</div>';

        if (staffAbsences.length === 0) {
          html += '<div style="padding: 1.25rem; text-align: center; color: #94a3b8; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; font-size: 13px;">' +
            'No absence intervals recorded for ' + esc(staff.name) + '. Officer is available for assignment.' +
          '</div>';
        } else {
          html += '<div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">' +
            '<table class="table" style="width: 100%; border-collapse: collapse; font-size: 12px;">' +
              '<thead><tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; text-align: left;">' +
                '<th style="padding: 0.5rem 0.75rem;">Type</th>' +
                '<th style="padding: 0.5rem 0.75rem;">Start Date</th>' +
                '<th style="padding: 0.5rem 0.75rem;">End Date</th>' +
                '<th style="padding: 0.5rem 0.75rem;">Notes</th>' +
                '<th style="padding: 0.5rem 0.75rem; text-align: right;">Action</th>' +
              '</tr></thead>' +
              '<tbody>' +
              staffAbsences.map(function(rec) {
                var typeBadgeColor = '#64748b';
                if (rec.type === 'annual_leave') typeBadgeColor = '#0284c7';
                if (rec.type === 'sick_leave') typeBadgeColor = '#ea580c';
                if (rec.type === 'rdo') typeBadgeColor = '#7c3aed';
                if (rec.type === 'training') typeBadgeColor = '#059669';

                var isEditing = HortOpsStaffAbsenceModal.editingAbsenceId === rec.id;
                var rowBg = isEditing ? '#f0f9ff' : 'transparent';

                return '<tr style="border-bottom: 1px solid #f1f5f9; background: ' + rowBg + ';">' +
                  '<td style="padding: 0.5rem 0.75rem;"><span class="badge" style="background: ' + typeBadgeColor + '; color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase;">' + esc(rec.type) + '</span></td>' +
                  '<td style="padding: 0.5rem 0.75rem; font-weight: 600;">' + esc(rec.startDate) + '</td>' +
                  '<td style="padding: 0.5rem 0.75rem; font-weight: 600;">' + esc(rec.endDate) + '</td>' +
                  '<td style="padding: 0.5rem 0.75rem; color: #475569;">' + esc(rec.notes || '—') + '</td>' +
                  '<td style="padding: 0.5rem 0.75rem; text-align: right; white-space: nowrap;">' +
                    '<button type="button" class="btn btn-secondary" data-action="edit-absence" data-id="' + escAttr(rec.id) + '" style="padding: 0.2rem 0.45rem; font-size: 11px; color: #0284c7; border-color: #bae6fd; background: #fff; margin-right: 0.25rem;" title="Edit Absence">✎ Edit</button>' +
                    '<button type="button" class="btn btn-secondary" data-action="remove-absence" data-id="' + escAttr(rec.id) + '" style="padding: 0.2rem 0.45rem; font-size: 11px; color: #dc2626; border-color: #fecaca; background: #fff;" title="Remove Absence">&times; Remove</button>' +
                  '</td>' +
                '</tr>';
              }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>';
        }
        html += '</div>';

        // Add or Edit Absence Form
        var editingAbs = this.editingAbsenceId ? staffAbsences.find(function(a) { return a.id === HortOpsStaffAbsenceModal.editingAbsenceId; }) : null;

        if (editingAbs) {
          // Edit Absence Form (Full CRUD - Identity Retention)
          html += '<div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 1rem 1.25rem;">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">' +
              '<div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0369a1; letter-spacing: 0.05em;">✎ Edit Leave Interval (Identity: ' + esc(editingAbs.id) + ')</div>' +
              '<button type="button" class="btn btn-secondary" style="padding: 0.15rem 0.45rem; font-size: 11px;" onclick="window.HortOpsStaffAbsenceModal.cancelEditAbsence()">Cancel Edit</button>' +
            '</div>' +
            '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Absence Type *</label>' +
                '<select id="edit-absence-type" class="form-select" style="width: 100%; font-size: 12px; height: 34px;">' +
                  '<option value="annual_leave"' + (editingAbs.type === 'annual_leave' ? ' selected' : '') + '>Annual Leave</option>' +
                  '<option value="sick_leave"' + (editingAbs.type === 'sick_leave' ? ' selected' : '') + '>Sick / Carer\'s Leave</option>' +
                  '<option value="rdo"' + (editingAbs.type === 'rdo' ? ' selected' : '') + '>Rostered Day Off (RDO)</option>' +
                  '<option value="training"' + (editingAbs.type === 'training' ? ' selected' : '') + '>Training / Offsite</option>' +
                  '<option value="long_service"' + (editingAbs.type === 'long_service' ? ' selected' : '') + '>Other Approved Leave</option>' +
                '</select>' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Start Date (YYYY-MM-DD) *</label>' +
                '<input type="date" id="edit-absence-start" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" value="' + escAttr(editingAbs.startDate) + '" />' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">End Date (YYYY-MM-DD) *</label>' +
                '<input type="date" id="edit-absence-end" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" value="' + escAttr(editingAbs.endDate) + '" />' +
              '</div>' +
            '</div>' +
            '<div style="display: flex; gap: 0.75rem; align-items: flex-end;">' +
              '<div style="flex: 1;">' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Notes / Authorisation Reference</label>' +
                '<input type="text" id="edit-absence-notes" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" value="' + escAttr(editingAbs.notes || '') + '" />' +
              '</div>' +
              '<button type="button" class="btn btn-primary" style="height: 34px; padding: 0 1rem; font-size: 12px; font-weight: 700; background: #0284c7; color: #fff; border-color: #0284c7;" onclick="window.HortOpsStaffAbsenceModal.updateAbsence()">✓ Update Interval</button>' +
            '</div>' +
          '</div>';
        } else {
          // Add Absence Form
          html += '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem;">' +
            '<div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #334155; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Log New Leave / Absence Interval</div>' +
            '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Absence Type *</label>' +
                '<select id="new-absence-type" class="form-select" style="width: 100%; font-size: 12px; height: 34px;">' +
                  '<option value="annual_leave">Annual Leave</option>' +
                  '<option value="sick_leave">Sick / Carer\'s Leave</option>' +
                  '<option value="rdo">Rostered Day Off (RDO)</option>' +
                  '<option value="training">Training / Offsite</option>' +
                  '<option value="long_service">Other Approved Leave</option>' +
                '</select>' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Start Date (YYYY-MM-DD) *</label>' +
                '<input type="date" id="new-absence-start" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" value="' + escAttr(todayStr) + '" />' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">End Date (YYYY-MM-DD) *</label>' +
                '<input type="date" id="new-absence-end" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" value="' + escAttr(todayStr) + '" />' +
              '</div>' +
            '</div>' +
            '<div style="display: flex; gap: 0.75rem; align-items: flex-end;">' +
              '<div style="flex: 1;">' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Notes / Authorisation Reference (Optional)</label>' +
                '<input type="text" id="new-absence-notes" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" placeholder="e.g. Leave booking ref #8410..." />' +
              '</div>' +
              '<button type="button" class="btn btn-secondary" style="height: 34px; padding: 0 1rem; font-size: 12px; font-weight: 700; background: #0284c7; color: #fff; border-color: #0284c7;" onclick="window.HortOpsStaffAbsenceModal.addAbsence()">+ Add Absence</button>' +
            '</div>' +
          '</div>';
        }

      } else {
        // Refusals Tab
        html += '<div style="margin-bottom: 1.25rem; padding: 0.9rem 1.1rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534; font-size: 12px;">' +
          '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.35rem;">' +
            '<span style="font-weight: 800; font-size: 13px;">⚖️ Fair-Share Overtime Distribution Metric</span>' +
            '<span class="badge" style="background: #15803d; color: #fff; font-size: 12px; font-weight: 800; padding: 0.2rem 0.6rem;">Score: ' + fairShareScore + ' pts</span>' +
          '</div>' +
          '<div>' +
            'Current ranking algorithm: <code>1000 - (ytdHours * 2) + (refusalCount * 5) - fatiguePenalty</code>.<br/>' +
            'This officer has accumulated <strong>' + esc(staff.ytdOvertimeHours) + ' YTD hours</strong> and <strong>' + staffRefusals.length + ' recorded refusal(s)</strong>. ' +
            'Each refusal increases dispatch priority by +5 pts to ensure equitable rotation opportunity.' +
          '</div>' +
          '<div style="margin-top: 0.4rem; font-size: 11px; color: #15803d; font-style: italic;">' +
            'Note: Authorised leave (annual, sick, RDO) is recorded on the Leave tab and does not penalise or alter refusal counts.' +
          '</div>' +
        '</div>';

        // Existing Refusals Table
        html += '<div style="margin-bottom: 1.5rem;">' +
          '<div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 0.5rem;">Recorded Overtime Refusals</div>';

        if (staffRefusals.length === 0) {
          html += '<div style="padding: 1.25rem; text-align: center; color: #94a3b8; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; font-size: 13px;">' +
            'No overtime refusals logged for ' + esc(staff.name) + '.' +
          '</div>';
        } else {
          html += '<div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">' +
            '<table class="table" style="width: 100%; border-collapse: collapse; font-size: 12px;">' +
              '<thead><tr style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; text-align: left;">' +
                '<th style="padding: 0.5rem 0.75rem;">Date</th>' +
                '<th style="padding: 0.5rem 0.75rem;">Shift ID</th>' +
                '<th style="padding: 0.5rem 0.75rem;">Reason / Governance Notes</th>' +
                '<th style="padding: 0.5rem 0.75rem; text-align: right;">Action</th>' +
              '</tr></thead>' +
              '<tbody>' +
              staffRefusals.map(function(ref) {
                var isEditing = HortOpsStaffAbsenceModal.editingRefusalId === ref.id;
                var rowBg = isEditing ? '#f0fdf4' : 'transparent';

                return '<tr style="border-bottom: 1px solid #f1f5f9; background: ' + rowBg + ';">' +
                  '<td style="padding: 0.5rem 0.75rem; font-weight: 600;">' + esc(ref.date) + '</td>' +
                  '<td style="padding: 0.5rem 0.75rem; color: #64748b;">' + esc(ref.shiftId || '—') + '</td>' +
                  '<td style="padding: 0.5rem 0.75rem; color: #334155;">' + esc(ref.reason || 'Declined') + '</td>' +
                  '<td style="padding: 0.5rem 0.75rem; text-align: right; white-space: nowrap;">' +
                    '<button type="button" class="btn btn-secondary" data-action="edit-refusal" data-id="' + escAttr(ref.id) + '" style="padding: 0.2rem 0.45rem; font-size: 11px; color: #059669; border-color: #a7f3d0; background: #fff; margin-right: 0.25rem;" title="Edit Refusal">✎ Edit</button>' +
                    '<button type="button" class="btn btn-secondary" data-action="remove-refusal" data-id="' + escAttr(ref.id) + '" style="padding: 0.2rem 0.45rem; font-size: 11px; color: #dc2626; border-color: #fecaca; background: #fff;" title="Remove Refusal">&times; Remove</button>' +
                  '</td>' +
                '</tr>';
              }).join('') +
              '</tbody>' +
            '</table>' +
          '</div>';
        }
        html += '</div>';

        // Add or Edit Refusal Form
        var editingRef = this.editingRefusalId ? staffRefusals.find(function(r) { return r.id === HortOpsStaffAbsenceModal.editingRefusalId; }) : null;

        if (editingRef) {
          // Edit Refusal Form (Full CRUD - Identity Retention)
          html += '<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 1rem 1.25rem;">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">' +
              '<div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #166534; letter-spacing: 0.05em;">✎ Edit Overtime Offering Refusal (Identity: ' + esc(editingRef.id) + ')</div>' +
              '<button type="button" class="btn btn-secondary" style="padding: 0.15rem 0.45rem; font-size: 11px;" onclick="window.HortOpsStaffAbsenceModal.cancelEditRefusal()">Cancel Edit</button>' +
            '</div>' +
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Offering Date (YYYY-MM-DD) *</label>' +
                '<input type="date" id="edit-refusal-date" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" value="' + escAttr(editingRef.date) + '" />' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Shift ID (Optional)</label>' +
                '<input type="text" id="edit-refusal-shift" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" value="' + escAttr(editingRef.shiftId || '') + '" />' +
              '</div>' +
            '</div>' +
            '<div style="display: flex; gap: 0.75rem; align-items: flex-end;">' +
              '<div style="flex: 1;">' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Refusal Reason / Details</label>' +
                '<input type="text" id="edit-refusal-notes" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" value="' + escAttr(editingRef.reason || '') + '" />' +
              '</div>' +
              '<button type="button" class="btn btn-primary" style="height: 34px; padding: 0 1rem; font-size: 12px; font-weight: 700; background: #059669; color: #fff; border-color: #059669;" onclick="window.HortOpsStaffAbsenceModal.updateRefusal()">✓ Update Refusal</button>' +
            '</div>' +
          '</div>';
        } else {
          // Add Refusal Form
          html += '<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem 1.25rem;">' +
            '<div style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #334155; margin-bottom: 0.75rem; letter-spacing: 0.05em;">Log Overtime Offering Refusal</div>' +
            '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Offering Date (YYYY-MM-DD) *</label>' +
                '<input type="date" id="new-refusal-date" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" value="' + escAttr(todayStr) + '" />' +
              '</div>' +
              '<div>' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Shift ID (Optional)</label>' +
                '<input type="text" id="new-refusal-shift" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" placeholder="e.g. S-2026-10-10-PARKS..." />' +
              '</div>' +
            '</div>' +
            '<div style="display: flex; gap: 0.75rem; align-items: flex-end;">' +
              '<div style="flex: 1;">' +
                '<label style="display: block; font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 0.25rem;">Refusal Reason / Details</label>' +
                '<input type="text" id="new-refusal-notes" class="form-input" style="width: 100%; font-size: 12px; height: 34px;" placeholder="e.g. Family commitments, short notice..." />' +
              '</div>' +
              '<button type="button" class="btn btn-secondary" style="height: 34px; padding: 0 1rem; font-size: 12px; font-weight: 700; background: #059669; color: #fff; border-color: #059669;" onclick="window.HortOpsStaffAbsenceModal.addRefusal()">+ Log Refusal</button>' +
            '</div>' +
          '</div>';
        }
      }

      html += '</div>'; // modal-body

      // Modal Footer
      html += '<div class="modal-footer" style="padding: 0.9rem 1.5rem; background: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; flex: 0 0 auto;">' +
        '<div style="font-size: 12px; color: #64748b;">' +
          'Officer totals: <strong>' + staffAbsences.length + '</strong> leave interval(s), <strong>' + staffRefusals.length + '</strong> refusal(s)' +
        '</div>' +
        '<div style="display: flex; gap: 0.5rem;">' +
          '<button type="button" class="btn btn-secondary" onclick="window.HortOpsStaffAbsenceModal.close()">Cancel</button>' +
          '<button type="button" class="btn btn-primary" style="background: #0284c7; border-color: #0369a1;" onclick="window.HortOpsStaffAbsenceModal.save()">Save Ledger Changes</button>' +
        '</div>' +
      '</div>' +

      '</div>' + // modal-card
      '</div>';  // modal-backdrop

      root.innerHTML = html;

      if (!root._hasAbsenceClickListener) {
        root._hasAbsenceClickListener = true;
        root.addEventListener('click', function(e) {
          var btn = (e.target && typeof e.target.closest === 'function') ? e.target.closest('button[data-action]') : null;
          if (!btn) return;
          var action = btn.getAttribute('data-action');
          var id = btn.getAttribute('data-id');
          if (action === 'edit-absence') {
            window.HortOpsStaffAbsenceModal.startEditAbsence(id);
          } else if (action === 'remove-absence') {
            window.HortOpsStaffAbsenceModal.removeAbsence(id);
          } else if (action === 'edit-refusal') {
            window.HortOpsStaffAbsenceModal.startEditRefusal(id);
          } else if (action === 'remove-refusal') {
            window.HortOpsStaffAbsenceModal.removeRefusal(id);
          }
        });
      }
    }
  };

  window.HortOpsStaffAbsenceModal = HortOpsStaffAbsenceModal;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HortOpsStaffAbsenceModal;
  }
})();

})();
