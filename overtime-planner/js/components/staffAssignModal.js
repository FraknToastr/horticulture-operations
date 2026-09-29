// Crew Allocator / Staff Assignment Modal Component
// Sole Public Facade for Staff Assignment: delegates UI rendering to sub-modules while retaining state and action handlers.
function getHumanIneligibleReason(code) {
  if (window.HortOpsEligibilityEngine && typeof window.HortOpsEligibilityEngine.getHumanIneligibleReason === 'function') {
    return window.HortOpsEligibilityEngine.getHumanIneligibleReason(code);
  }
  var map = {
    'EMPLOYMENT_DEPARTED': 'Departed',
    'EMPLOYMENT_INACTIVE': 'Inactive',
    'EMPLOYMENT_UNAVAILABLE': 'Unavailable',
    'EMPLOYMENT_ON_LEAVE': 'On Leave',
    'UNKNOWN_EMPLOYMENT_STATUS': 'Unknown Status',
    'OVERTIME_EXEMPT': 'Exemption Active',
    'TEAM_NOT_ALLOWED': 'Non-Exclusive Team',
    'OVERLAPPING_SHIFT': 'Double-Booked',
    'INSUFFICIENT_REST': 'Insufficient Rest (< 10h)',
    'STAFF_NOT_FOUND': 'Staff Not Found',
    'NOT_PLANT_OPERATOR': 'Plant Operator Required'
  };
  return map[code] || code || 'Ineligible';
}

function getEffectiveShiftsForModal(shift) {
  var state = (window.HortOpsApp && window.HortOpsApp.state) || {};
  var allShifts = state.allShifts || [];
  if (!shift || !shift.date) return allShifts;
  var monthDay = (typeof shift.date === 'string' && shift.date.length >= 10) ? shift.date.slice(5, 10) : '';
  var isBoundary = (monthDay <= '01-03' || monthDay >= '12-29');

  if (isBoundary) {
    if (!window.HortOpsScheduler || typeof window.HortOpsScheduler.getAdjacentBoundaryShifts !== 'function') {
      var unavailShifts = allShifts.slice();
      unavailShifts.lookupFailed = true;
      unavailShifts.errorMessage = 'HortOpsScheduler boundary lookup service is unavailable';
      return unavailShifts;
    }
    var adj = window.HortOpsScheduler.getAdjacentBoundaryShifts(shift.date, state.jobs, state.customAssignments, state.staffList, state.historicalSnapshots);
    if (adj && adj.lookupFailed) {
      // Forward fail-closed status so modal validation blocks allocation
      var errShifts = allShifts.slice();
      errShifts.lookupFailed = true;
      errShifts.errorMessage = adj.errorMessage;
      return errShifts;
    }
    if (adj && adj.length > 0) {
      var existing = {};
      for (var i = 0; i < allShifts.length; i++) {
        if (allShifts[i] && allShifts[i].shiftId) existing[allShifts[i].shiftId] = true;
      }
      var merged = allShifts.slice();
      for (var j = 0; j < adj.length; j++) {
        if (adj[j] && adj[j].shiftId && !existing[adj[j].shiftId]) {
          merged.push(adj[j]);
        }
      }
      return merged;
    }
  }
  return allShifts;
}

window.HortOpsStaffAssignModal = {
  getHumanIneligibleReason: getHumanIneligibleReason,
  activeShiftId: null,
  searchTerm: '',
  selectedDept: 'all',
  selectedTeam: 'all',
  onlyPreferredCrew: false,
  stagedAssignedStaffIds: [],
  stagedSlots: [],
  stagedSlotStrategies: {},

  open: function(shiftId) {
    this.activeShiftId = shiftId;
    this.searchTerm = '';
    this.selectedDept = 'all';
    this.selectedTeam = 'all';
    this.onlyPreferredCrew = false;

    var state = window.HortOpsApp.state;
    var shift = state.allShifts.find(function(s) { return s.shiftId === shiftId; });
    this.stagedAssignedStaffIds = shift ? (shift.assignedStaffIds || []).slice() : [];

    // Offline17.1: Initialize staged slots with stable slotId and strategy
    this.stagedSlots = [];
    this.stagedSlotStrategies = {};
    var rostering = state.rostering || {};
    var instructions = rostering.instructions || {};
    var provenance = rostering.provenance || {};
    var self = this;

    var usedSlotIndices = new Set();
    // Pass 1: Pre-collect known slot IDs from instructions or provenance to avoid collisions
    this.stagedAssignedStaffIds.forEach(function(staffId) {
      var pKey = shiftId + ':' + staffId;
      var prov = provenance[pKey];
      var sid = null;
      if (prov && prov.instructionId && instructions[prov.instructionId]) {
        sid = instructions[prov.instructionId].slotId || prov.slotId;
      } else if (prov && prov.slotId) {
        sid = prov.slotId;
      }
      if (sid) {
        var m = sid.match(/SLOT-(\d+)/i);
        if (m) usedSlotIndices.add(parseInt(m[1], 10));
      }
    });

    // Pass 2: Initialize staged slots preserving durable slotId for Manual & Fixed/Rotation
    this.stagedAssignedStaffIds.forEach(function(staffId, idx) {
      var pKey = shiftId + ':' + staffId;
      var prov = provenance[pKey];
      var slotId = null;
      var mode = 'manual';
      var repeatCount = 1;
      var isInherited = false;
      var sourceDate = shift ? shift.date : '';
      var instructionId = null;

      var isSealedHistorical = false;
      var activeContinuationShiftId = null;
      var activeContinuationDate = null;

      if (prov && prov.instructionId && instructions[prov.instructionId]) {
        var inst = instructions[prov.instructionId];
        instructionId = prov.instructionId;
        slotId = inst.slotId || prov.slotId;
        mode = inst.mode || 'manual';
        repeatCount = inst.repeatCount || 1;
        sourceDate = inst.startDate || (prov.sourceShiftId ? prov.sourceShiftId.split('@')[1] : (shift ? shift.date : ''));
        var sourceShiftId = prov.sourceShiftId || (inst.startDate ? (inst.jobId + '@' + inst.startDate) : null);
        isInherited = !!(sourceShiftId && sourceShiftId !== shiftId);

        // Offline17.5b: Permanent Historical Sealing
        // Any instruction with status === 'historical' is permanently sealed,
        // regardless of whether an active continuation currently exists downstream!
        if (inst.status === 'historical') {
          isSealedHistorical = true;
          var activeCont = Object.values(instructions).find(function(other) {
            return other &&
              other.status === 'active' &&
              other.jobId === inst.jobId &&
              other.slotId === inst.slotId &&
              (other.predecessorInstructionId === inst.id || other.lineageRootId === (inst.lineageRootId || inst.id));
          });
          if (activeCont) {
            activeContinuationShiftId = activeCont.sourceShiftId || (activeCont.jobId + '@' + activeCont.startDate);
            activeContinuationDate = activeCont.startDate || (activeContinuationShiftId ? activeContinuationShiftId.split('@')[1] : '');
          } else {
            activeContinuationShiftId = null;
            activeContinuationDate = null;
          }
        }
      } else if (prov && prov.slotId) {
        slotId = prov.slotId;
        mode = 'manual';
        repeatCount = 1;
      }

      if (!slotId) {
        var nextIdx = 1;
        while (usedSlotIndices.has(nextIdx)) {
          nextIdx++;
        }
        slotId = 'SLOT-' + nextIdx;
        usedSlotIndices.add(nextIdx);
      }

      self.stagedSlots.push({
        slotId: slotId,
        staffId: staffId,
        mode: mode,
        repeatCount: repeatCount,
        isInherited: isInherited,
        sourceDate: sourceDate,
        instructionId: instructionId,
        isSealedHistorical: isSealedHistorical,
        activeContinuationShiftId: activeContinuationShiftId,
        activeContinuationDate: activeContinuationDate
      });

      self.stagedSlotStrategies[staffId] = {
        mode: mode,
        repeatCount: repeatCount
      };
    });

    if (window.HortOpsModalUtils) window.HortOpsModalUtils.lockBackgroundScroll();
    this.renderModal();
  },

  close: function() {
    this.activeShiftId = null;
    var el = document.getElementById('staff-assign-modal-root');
    if (el) el.innerHTML = '';
    if (window.HortOpsModalUtils) window.HortOpsModalUtils.unlockBackgroundScroll();
  },

  renderModal: function() {
    var el = document.getElementById('staff-assign-modal-root');
    if (!el) return;
    if (!this.activeShiftId) {
      el.innerHTML = '';
      return;
    }

    var state = window.HortOpsApp.state;
    var escapeHtml = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) || function(s) { return s || ''; };
    var escapeAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) || function(s) { return s || ''; };
    var escHtml = escapeHtml;
    var escAttr = escapeAttr;
    var icons = window.HortOpsIcons;
    var dateUtils = window.HortOpsDateUtils;

    var shift = state.allShifts.find(function(s) { return s.shiftId === window.HortOpsStaffAssignModal.activeShiftId; });
    if (!shift) {
      this.close();
      return;
    }

    var jobs = state.jobs || [];
    var matchingJob = jobs.find(function(j) {
      return j.id === shift.jobId || (j.name && shift.jobName && j.name.toLowerCase() === shift.jobName.toLowerCase());
    }) || {};

    var primaryTeam = matchingJob.primaryTeam || matchingJob.defaultTeam || matchingJob.preferredTeam || '';
    var secondaryTeam = matchingJob.secondaryTeam || '';
    var tertiaryTeam = matchingJob.tertiaryTeam || '';
    var isExclusive = !!(matchingJob.isExclusiveTeams && matchingJob.exclusiveTeams && matchingJob.exclusiveTeams.length > 0);
    var exclusiveTeams = matchingJob.exclusiveTeams || [];

    var assignedIds = this.stagedAssignedStaffIds || [];
    var assignedIdsSet = new Set(assignedIds);
    var roster = state.staffList || [];
    var hierarchy = window.HortOpsData.getDepartmentHierarchy(roster);

    // Candidate Model Resolution (Delegated to window.HortOpsStaffAssignCandidateModel per Offline15.1)
    var self = this;
    var allShifts = getEffectiveShiftsForModal(shift);
    var jobPreferences = {
      primaryTeam: primaryTeam,
      secondaryTeam: secondaryTeam,
      tertiaryTeam: tertiaryTeam,
      isExclusive: isExclusive,
      exclusiveTeams: exclusiveTeams
    };

    var candidateModelRes;
    if (window.HortOpsStaffAssignCandidateModel && typeof window.HortOpsStaffAssignCandidateModel.resolveCandidateModel === 'function') {
      candidateModelRes = window.HortOpsStaffAssignCandidateModel.resolveCandidateModel(roster, {
        shift: shift,
        allShifts: allShifts,
        stagedAssignedStaffIds: self.stagedAssignedStaffIds,
        searchTerm: self.searchTerm,
        selectedDept: self.selectedDept,
        selectedTeam: self.selectedTeam,
        onlyPreferredCrew: self.onlyPreferredCrew,
        jobPreferences: jobPreferences,
        assignedIdsSet: assignedIdsSet,
        matchingJob: matchingJob
      });
    } else {
      candidateModelRes = { filteredStaff: [], preferredCrewCount: 0 };
    }

    var filteredStaff = candidateModelRes.filteredStaff;
    var preferredCrewCount = candidateModelRes.preferredCrewCount;

    var vacancies = Math.max(0, shift.crewSize - assignedIds.length);

    // Build Assigned Staff List
    var assignedStaffList = assignedIds.map(function(id) {
      return roster.find(function(s) { return s.id === id; });
    }).filter(Boolean);

    // Uses component-scoped getHumanIneligibleReason

    var isPlantOpReq = !!(shift.plantOperatorRequired || matchingJob.plantOperatorRequired);
    var plantOpCount = assignedStaffList.filter(function(s) { return s.isPlantOperator; }).length;
    var isPlantOpPresent = plantOpCount > 0;

    var ineligibleAssignees = [];
    assignedStaffList.forEach(function(staff) {
      if (window.HortOpsEligibilityEngine && typeof window.HortOpsEligibilityEngine.validateStaffEligibility === 'function') {
        var res = window.HortOpsEligibilityEngine.validateStaffEligibility(staff, shift, allShifts, assignedIds);
        var strictReasons = res.reasons.filter(function(r) { return r !== 'ALREADY_ASSIGNED_HERE'; });
        if (strictReasons.length > 0) {
          ineligibleAssignees.push({ staff: staff, reason: strictReasons[0] });
        }
      } else {
        ineligibleAssignees.push({ staff: staff, reason: 'ELIGIBILITY_ENGINE_UNAVAILABLE' });
      }
    });

    var maxRepeat = (window.HortOpsRosteringEngine && typeof window.HortOpsRosteringEngine.resolveRepeatMax === 'function')
      ? window.HortOpsRosteringEngine.resolveRepeatMax(shift.shiftId, allShifts, matchingJob, jobs)
      : 1;

    var ctx = {
      self: self,
      shift: shift,
      matchingJob: matchingJob,
      stagedSlots: this.stagedSlots || [],
      stagedSlotStrategies: this.stagedSlotStrategies || {},
      stagedAssignedStaffIds: this.stagedAssignedStaffIds || [],
      staffList: roster,
      allShifts: allShifts,
      maxRepeat: maxRepeat,
      primaryTeam: primaryTeam,
      secondaryTeam: secondaryTeam,
      tertiaryTeam: tertiaryTeam,
      isExclusive: isExclusive,
      exclusiveTeams: exclusiveTeams,
      assignedIds: assignedIds,
      assignedIdsSet: assignedIdsSet,
      assignedStaffList: assignedStaffList,
      filteredStaff: filteredStaff,
      roster: roster,
      hierarchy: hierarchy,
      vacancies: vacancies,
      preferredCrewCount: preferredCrewCount,
      ineligibleAssignees: ineligibleAssignees,
      isPlantOpReq: isPlantOpReq,
      isPlantOpPresent: isPlantOpPresent,
      getHumanIneligibleReason: getHumanIneligibleReason,
      getStaffPriority: function(staff) {
        if (window.HortOpsStaffAssignCandidateModel && typeof window.HortOpsStaffAssignCandidateModel.getStaffPriority === 'function') {
          return window.HortOpsStaffAssignCandidateModel.getStaffPriority(staff, jobPreferences);
        }
        return 5;
      },
      icons: icons,
      escHtml: escHtml,
      escAttr: escAttr
    };

    var permitComplianceHtml = window.HortOpsStaffAssignStagedCrew ?
      window.HortOpsStaffAssignStagedCrew.renderPermits(ctx) : '';
    var stagedCrewHtml = window.HortOpsStaffAssignStagedCrew ?
      window.HortOpsStaffAssignStagedCrew.render(ctx) : '';
    var filterBarHtml = window.HortOpsStaffAssignFilterBar ?
      window.HortOpsStaffAssignFilterBar.render(ctx) : '';
    var candidateListHtml = window.HortOpsStaffAssignCandidateList ?
      window.HortOpsStaffAssignCandidateList.render(ctx) : '';

    var modalHtml = '<div class="modal-overlay" onclick="if(event.target === this) window.HortOpsStaffAssignModal.close()">' +
      '<div class="modal-card modal-staff-assign modal-xl">' +
        // Header (Mandate Section 21: Targeted security audit and escaping)
        '<div class="modal-header">' +
          '<div>' +
            '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
              '<span style="width: 12px; height: 12px; border-radius: 50%; background: ' + escAttr(shift.color || '#10b981') + ';"></span>' +
              '<h2 style="font-size: 1rem; font-weight: 800; color: var(--slate-900);">' + escHtml(shift.jobName || '') + '</h2>' +
              '<span class="badge badge-slate">' + escHtml(shift.category || '') + '</span>' +
              (isExclusive ? '<span class="badge badge-amber">' + icons.render('lock', 'w-2.5 h-2.5') + 'Exclusive</span>' : '') +
            '</div>' +
            '<div style="font-size: 12px; color: var(--slate-500); margin-top: 0.25rem; font-family: var(--font-mono);">' +
              escHtml(dateUtils.formatDisplayDate(shift.date)) + ' (' + escHtml(shift.dayOfWeek || '') + ') • ' + escHtml(shift.startTime || '') + ' (' + escHtml(shift.durationHours || '') + 'h) • Requires ' + escHtml(shift.crewSize || '') + ' Crew' +
            '</div>' +
          '</div>' +
          '<button class="btn btn-secondary" style="padding: 0.3rem 0.5rem;" onclick="window.HortOpsStaffAssignModal.close()">' +
            icons.render('x', 'w-4 h-4') +
          '</button>' +
        '</div>' +

        // Body
        '<div class="modal-body" style="padding: 1rem;">' + permitComplianceHtml +
          '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">' +
            // LEFT COLUMN: Assigned Staff (P1-05, P1-10, P1-12)
            '<div>' +
              stagedCrewHtml +
            '</div>' +

            // RIGHT COLUMN: Workforce Directory & Slicers
            '<div>' +
              filterBarHtml +
              candidateListHtml +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

    el.innerHTML = modalHtml;

    // Delegated click listener for auto-fill team (P0 Security: no inline JS evaluation)
    var modalRoot = document.getElementById('staff-assign-modal-root');
    if (modalRoot) {
      modalRoot.onclick = function(e) {
        var autoBtn = e.target.closest('button.btn-autofill-team[data-team]');
        if (autoBtn) {
          e.preventDefault();
          window.HortOpsStaffAssignModal.autoFillTeam(autoBtn.getAttribute('data-team'));
        }
      };
    }
  },

  setSearch: function(val) {
    this.searchTerm = val;
    var activeEl = document.activeElement;
    var isSearchInput = activeEl && activeEl.tagName === 'INPUT' && activeEl.placeholder && activeEl.placeholder.indexOf('Search') !== -1;
    var selStart = isSearchInput ? activeEl.selectionStart : null;
    var selEnd = isSearchInput ? activeEl.selectionEnd : null;

    this.renderModal();

    if (isSearchInput) {
      var modal = document.getElementById('staff-assign-modal-root');
      if (modal) {
        var newInput = modal.querySelector('input[placeholder*="Search"]');
        if (newInput) {
          newInput.focus();
          if (selStart !== null && selEnd !== null) {
            newInput.setSelectionRange(selStart, selEnd);
          }
        }
      }
    }
  },

  setDept: function(val) {
    this.selectedDept = val;
    this.selectedTeam = 'all';
    this.renderModal();
  },

  setTeam: function(val) {
    this.selectedTeam = val;
    this.renderModal();
  },

  togglePreferred: function() {
    this.onlyPreferredCrew = !this.onlyPreferredCrew;
    this.renderModal();
  },

  addStaff: function(staffId) {
    if (!this.stagedAssignedStaffIds) this.stagedAssignedStaffIds = [];
    if (!this.stagedSlots) this.stagedSlots = [];
    if (this.stagedAssignedStaffIds.indexOf(staffId) === -1) {
      var state = window.HortOpsApp.state;
      var shift = state.allShifts.find(function(s) { return s.shiftId === window.HortOpsStaffAssignModal.activeShiftId; });
      var staff = (state.staffList || []).find(function(s) { return s.id === staffId; });
      var jobs = state.jobs || [];
      var matchingJob = jobs.find(function(j) { return j.id === shift.jobId || (j.name && shift.jobName && j.name.toLowerCase() === shift.jobName.toLowerCase()); });
      if (staff && shift) {
        if (!window.HortOpsEligibilityEngine || typeof window.HortOpsEligibilityEngine.validateEmployeeForOccurrence !== 'function') {
          alert('Cannot assign staff: Eligibility Engine unavailable');
          return;
        }
        var evalRes = window.HortOpsEligibilityEngine.validateEmployeeForOccurrence({
          employee: staff,
          occurrence: shift,
          job: matchingJob,
          allAssignments: state.allShifts,
          currentShiftAssignedIds: this.stagedAssignedStaffIds
        });
        if (!evalRes.eligible) {
          alert('Cannot assign ' + staff.name + ':\n- ' + evalRes.message);
          return;
        }
      }

      // Allocate next unused stable slot index
      var usedIndices = new Set();
      this.stagedSlots.forEach(function(s) {
        var m = s.slotId && s.slotId.match(/SLOT-(\d+)/);
        if (m) usedIndices.add(parseInt(m[1], 10));
      });
      var nextIdx = 1;
      while (usedIndices.has(nextIdx)) {
        nextIdx++;
      }
      var newSlotId = 'SLOT-' + nextIdx;

      this.stagedAssignedStaffIds.push(staffId);
      this.stagedSlots.push({
        slotId: newSlotId,
        staffId: staffId,
        mode: 'manual',
        repeatCount: 1,
        isInherited: false,
        sourceDate: shift ? shift.date : ''
      });
      if (!this.stagedSlotStrategies) this.stagedSlotStrategies = {};
      this.stagedSlotStrategies[staffId] = { mode: 'manual', repeatCount: 1 };
      this.renderModal();
    }
  },

  openActiveContinuation: function(targetShiftId) {
    if (!targetShiftId) return;
    var state = window.HortOpsApp ? window.HortOpsApp.state : null;
    var targetDate = (typeof targetShiftId === 'string' && targetShiftId.indexOf('@') !== -1) ? targetShiftId.split('@')[1] : null;
    var targetYear = targetDate ? parseInt(targetDate.slice(0, 4), 10) : null;

    if (targetYear && window.HortOpsApp && typeof window.HortOpsApp.setYear === 'function') {
      if (state && state.currentYear !== targetYear) {
        window.HortOpsApp.setYear(targetYear);
      }
    }

    var appState = window.HortOpsApp ? window.HortOpsApp.state : state;
    var targetShift = (appState && appState.allShifts) ? appState.allShifts.find(function(s) { return s.shiftId === targetShiftId; }) : null;

    if (!targetShift) {
      alert("Rostering Continuation Problem\n\nThe active future rostering instruction could not be opened.\nNo future assignments were changed.");
      return;
    }

    if (targetShift.date && appState) {
      appState.selectedDate = targetShift.date;
      if (window.HortOpsApp && typeof window.HortOpsApp.renderCurrentView === 'function') {
        window.HortOpsApp.renderCurrentView();
      }
    }
    this.open(targetShiftId);
  },

  removeStaff: function(staffId) {
    if (!this.stagedAssignedStaffIds) return;
    var slot = (this.stagedSlots || []).find(function(s) { return s.staffId === staffId; });
    if (slot && slot.isSealedHistorical) {
      alert("Cannot remove assignment from a sealed historical record. Future rostering continues from " + (slot.activeContinuationDate || "its active start date") + ".");
      return;
    }
    if (slot && slot.isInherited) {
      alert("Cannot remove inherited assignment directly from downstream shift. Please edit the source shift on " + (slot.sourceDate || "source") + " to modify this instruction.");
      return;
    }
    this.stagedAssignedStaffIds = this.stagedAssignedStaffIds.filter(function(id) { return id !== staffId; });
    if (this.stagedSlots) {
      this.stagedSlots = this.stagedSlots.filter(function(s) { return s.staffId !== staffId; });
    }
    if (this.stagedSlotStrategies) {
      delete this.stagedSlotStrategies[staffId];
    }
    this.renderModal();
  },

  removeAllIneligible: function() {
    if (!this.stagedAssignedStaffIds || !this.activeShiftId) return;
    var state = window.HortOpsApp.state;
    var shift = state.allShifts.find(function(s) { return s.shiftId === window.HortOpsStaffAssignModal.activeShiftId; });
    var roster = state.staffList || [];
    var allShifts = state.allShifts || [];
    var current = this.stagedAssignedStaffIds;
    var retainedIds = current.filter(function(id) {
      var staff = roster.find(function(s) { return s.id === id; });
      if (!staff) return false;
      if (window.HortOpsEligibilityEngine && typeof window.HortOpsEligibilityEngine.validateStaffEligibility === 'function') {
        var res = window.HortOpsEligibilityEngine.validateStaffEligibility(staff, shift, allShifts, current);
        var strictReasons = res.reasons.filter(function(r) { return r !== 'ALREADY_ASSIGNED_HERE'; });
        return strictReasons.length === 0;
      }
      return false;
    });
    this.stagedAssignedStaffIds = retainedIds;
    var retainedSet = new Set(retainedIds);
    if (this.stagedSlots) {
      this.stagedSlots = this.stagedSlots.filter(function(s) { return retainedSet.has(s.staffId); });
    }
    if (this.stagedSlotStrategies) {
      var self = this;
      Object.keys(this.stagedSlotStrategies).forEach(function(id) {
        if (!retainedSet.has(id)) delete self.stagedSlotStrategies[id];
      });
    }
    this.renderModal();
  },

  autoFillTeam: function(teamName) {
    var state = window.HortOpsApp.state;
    var shift = state.allShifts.find(function(s) { return s.shiftId === window.HortOpsStaffAssignModal.activeShiftId; });
    if (!shift) return;

    var roster = state.staffList || [];
    var current = this.stagedAssignedStaffIds || [];
    var vacancies = Math.max(0, shift.crewSize - current.length);
    if (vacancies <= 0) return;

    var jobs = state.jobs || [];
    var matchingJob = jobs.find(function(j) { return j.id === shift.jobId || j.name.toLowerCase() === shift.jobName.toLowerCase(); });

    var candidates = roster.filter(function(s) {
      if (s.team.toLowerCase() !== teamName.toLowerCase()) return false;
      if (current.indexOf(s.id) !== -1) return false;
      if (!window.HortOpsEligibilityEngine || typeof window.HortOpsEligibilityEngine.validateEmployeeForOccurrence !== 'function') {
        return false;
      }
      var evalRes = window.HortOpsEligibilityEngine.validateEmployeeForOccurrence({
        employee: s,
        occurrence: shift,
        job: matchingJob,
        allAssignments: state.allShifts,
        currentShiftAssignedIds: current
      });
      return evalRes.eligible;
    });

    // Prioritize eligible Plant Operators if required and not currently staffed
    var isPlantOpReq = Boolean(shift.plantOperatorRequired || (matchingJob && matchingJob.plantOperatorRequired));
    if (isPlantOpReq) {
      var currentHasOp = current.some(function(id) {
        var m = roster.find(function(s) { return s.id === id; });
        return m && m.isPlantOperator;
      });
      if (!currentHasOp) {
        candidates.sort(function(a, b) {
          if (a.isPlantOperator !== b.isPlantOperator) {
            return a.isPlantOperator ? -1 : 1;
          }
          return 0;
        });
      }
    }

    var toAdd = candidates.slice(0, vacancies).map(function(s) { return s.id; });
    if (toAdd.length > 0) {
      var self = this;
      toAdd.forEach(function(staffId) {
        var usedIndices = new Set();
        (self.stagedSlots || []).forEach(function(s) {
          var m = s.slotId && s.slotId.match(/SLOT-(\d+)/);
          if (m) usedIndices.add(parseInt(m[1], 10));
        });
        var nextIdx = 1;
        while (usedIndices.has(nextIdx)) {
          nextIdx++;
        }
        var newSlotId = 'SLOT-' + nextIdx;
        if (!self.stagedSlots) self.stagedSlots = [];
        self.stagedSlots.push({
          slotId: newSlotId,
          staffId: staffId,
          mode: 'manual',
          repeatCount: 1,
          isInherited: false,
          sourceDate: shift ? shift.date : ''
        });
        if (!self.stagedSlotStrategies) self.stagedSlotStrategies = {};
        self.stagedSlotStrategies[staffId] = { mode: 'manual', repeatCount: 1 };
      });
      this.stagedAssignedStaffIds = current.concat(toAdd);
      this.renderModal();
    }
  },

  updatePermit: function(type, status) {
    if (!this.activeShiftId) return;
    var updates = {};
    if (type === 'wztm') updates.wztmStatus = status;
    if (type === 'tpo') updates.tpoStatus = status;
    var res = window.HortOpsApp.updatePermit(this.activeShiftId, updates);
    if (res && !res.success) {
      if (typeof alert === 'function') alert('Failed to update permit: ' + (res.error || 'Storage error'));
      return;
    }
    this.renderModal();
  },

  updatePermitNotes: function(type, notes) {
    if (!this.activeShiftId) return;
    var updates = {};
    if (type === 'wztm') updates.wztmNotes = notes;
    if (type === 'tpo') updates.tpoNotes = notes;
    var res = window.HortOpsApp.updatePermit(this.activeShiftId, updates);
    if (res && !res.success) {
      if (typeof alert === 'function') alert('Failed to update permit notes: ' + (res.error || 'Storage error'));
    }
  },

  updateSlotMode: function(staffId, mode) {
    var slot = (this.stagedSlots || []).find(function(s) { return s.staffId === staffId; });
    if (slot && slot.isSealedHistorical) return;
    if (!this.stagedSlotStrategies) this.stagedSlotStrategies = {};
    this.stagedSlotStrategies[staffId] = this.stagedSlotStrategies[staffId] || { mode: 'manual', repeatCount: 1 };
    this.stagedSlotStrategies[staffId].mode = mode;
    if (slot) slot.mode = mode;
    this.renderModal();
  },

  updateSlotRepeat: function(staffId, repeatCount) {
    var slot = (this.stagedSlots || []).find(function(s) { return s.staffId === staffId; });
    if (slot && slot.isSealedHistorical) return;
    var count = parseInt(repeatCount, 10) || 1;
    if (!this.stagedSlotStrategies) this.stagedSlotStrategies = {};
    this.stagedSlotStrategies[staffId] = this.stagedSlotStrategies[staffId] || { mode: 'manual', repeatCount: 1 };
    this.stagedSlotStrategies[staffId].repeatCount = count;
    if (slot) slot.repeatCount = count;
    this.renderModal();
  },

  saveAllocation: function() {
    if (!this.activeShiftId) return;
    var state = window.HortOpsApp.state;
    var shift = state.allShifts.find(function(s) { return s.shiftId === window.HortOpsStaffAssignModal.activeShiftId; });
    if (!shift) return;

    var jobs = state.jobs || [];
    var matchingJob = jobs.find(function(j) {
      if (!j) return false;
      if (shift.jobId && j.id === shift.jobId) return true;
      if (shift.jobName && j.name && typeof shift.jobName === 'string' && typeof j.name === 'string') {
        return j.name.toLowerCase() === shift.jobName.toLowerCase();
      }
      return false;
    }) || {};

    var roster = state.staffList || [];
    var current = this.stagedAssignedStaffIds || [];

    // Canonical crew-level integrity validation (Mandate Section 3, 4, 5, 26)
    if (!window.HortOpsEligibilityEngine || typeof window.HortOpsEligibilityEngine.validateCrewForOccurrence !== 'function') {
      alert("Cannot save allocation: Eligibility Engine unavailable.");
      return;
    }
    var effectiveModalShifts = getEffectiveShiftsForModal(shift);
    if (effectiveModalShifts && effectiveModalShifts.lookupFailed) {
      alert("Cannot save allocation: " + (effectiveModalShifts.errorMessage || "Adjacent-year schedule lookup failed.") + " Allocation blocked fail-closed.");
      return;
    }
    var crewVal = window.HortOpsEligibilityEngine.validateCrewForOccurrence({
      occurrence: shift,
      job: matchingJob,
      assignedStaffIds: current,
      roster: roster,
      allAssignments: effectiveModalShifts
    });
    if (!crewVal.valid && crewVal.hardBlock) {
      var firstIssue = crewVal.issues[0];
      alert("Cannot save allocation: " + (firstIssue ? firstIssue.message : "Crew violates hard integrity requirements.") + " Please assign an eligible certified Plant Operator before saving.");
      return;
    }

    // Hard ineligible assignee check (N-P0-01, P0-10) - NO "save anyway" override for hard rules
    var hardViolations = [];
    current.forEach(function(id) {
      var s = roster.find(function(m) { return m.id === id; });
      if (!s) {
        hardViolations.push({ id: id, name: id, reason: 'Staff record not found' });
        return;
      }
      if (!window.HortOpsEligibilityEngine || typeof window.HortOpsEligibilityEngine.validateStaffEligibility !== 'function') {
        hardViolations.push({ id: s.id, name: s.name || id, reason: 'Eligibility Engine unavailable' });
        return;
      }
      var res = window.HortOpsEligibilityEngine.validateStaffEligibility(s, shift, matchingJob, effectiveModalShifts, current);
      var hardReasons = res.reasons.filter(function(r) { return r !== 'ALREADY_ASSIGNED_HERE'; });
      if (hardReasons.length > 0) {
        hardViolations.push({ id: s.id, name: s.name, reason: getHumanIneligibleReason(hardReasons[0]) });
      }
    });

    if (hardViolations.length > 0) {
      var violationMsg = "Cannot save allocation: The following assigned staff violate hard eligibility constraints:\n\n" +
        hardViolations.map(function(v) { return "• " + v.name + ": " + v.reason; }).join("\n") +
        "\n\nPlease remove ineligible staff before saving.";
      alert(violationMsg);
      return;
    }

    if (!window.HortOpsRosteringEngine || typeof window.HortOpsRosteringEngine.applyRostering !== 'function') {
      alert('Cannot save allocation: Rostering engine is unavailable.');
      return;
    }

    var rosterRes = window.HortOpsRosteringEngine.applyRostering({
      job: matchingJob,
      currentShift: shift,
      stagedStaffIds: current,
      stagedSlots: this.stagedSlots || [],
      stagedStrategies: this.stagedSlotStrategies,
      allShifts: effectiveModalShifts,
      roster: roster,
      customAssignments: state.customAssignments,
      rosteringState: state.rostering,
      jobs: state.jobs || []
    });

    if (!rosterRes || !rosterRes.success) {
      alert('Cannot save allocation: Rostering engine failed to process assignment.');
      return;
    }

    // Pure scheduled-commitment delta planning (Stage 1 Gate B2)
    if (!window.HortOpsCommitmentPlanner || typeof window.HortOpsCommitmentPlanner.plan !== 'function') {
      alert('Cannot save allocation: Scheduled commitment planner unavailable.');
      return;
    }

    var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey()
      : null;

    var isUnassignment = (!current || current.length === 0);
    var opType = isUnassignment ? 'future_unassignment' : 'allocation_reconciliation';

    var planRes = window.HortOpsCommitmentPlanner.plan({
      beforeAssignments: state.customAssignments || {},
      afterAssignments: rosterRes.customAssignments,
      beforeSnapshots: state.historicalSnapshots || {},
      beforeRostering: state.rostering || { instructions: {}, provenance: {} },
      afterRostering: rosterRes.rosteringState,
      prunedProvenance: rosterRes.prunedProvenance || [],
      prunedInstructions: rosterRes.prunedInstructions || [],
      authoritativeOccurrences: rosterRes.affectedOccurrences || {},
      todayKey: todayStr,
      nowIso: new Date().toISOString(),
      operation: {
        type: opType,
        sourceShiftId: shift.shiftId,
        targetShiftId: shift.shiftId
      }
    });

    if (!planRes || !planRes.ok) {
      var planErr = (planRes && planRes.error) ? planRes.error : 'Failed to plan scheduled commitment delta.';
      console.error('Commitment planner error:', planErr);
      alert('Cannot save allocation: ' + planErr);
      return;
    }

    // Stage-before-commit: build proposed Schema v2 envelope using canonical constructor
    if (!window.HortOpsStorage || typeof window.HortOpsStorage.createWorkspaceEnvelope !== 'function') {
      alert('Cannot save allocation: Canonical storage envelope constructor unavailable.');
      return;
    }

    var proposedEnvelope = window.HortOpsStorage.createWorkspaceEnvelope({
      schemaVersion: 2,
      jobs: state.jobs,
      roster: state.staffList,
      assignments: rosterRes.customAssignments,
      rostering: rosterRes.rosteringState,
      historicalSnapshots: planRes.snapshots,
      permits: state.customPermits,
      budgetSettings: state.budgetSettings,
      uiState: {
        activeView: state.activeView,
        currentYear: state.currentYear
      }
    });

    // Strict mandatory baseline reader and evidence key retention check
    var storage = window.HortOpsStorage;
    var validator = window.HortOpsSchemaValidator;
    if (!storage || typeof storage.readVerifiedCommittedV2 !== 'function') {
      alert('Cannot save allocation: verified storage baseline reader is unavailable.');
      return;
    }
    var committed = storage.readVerifiedCommittedV2();
    if (!committed || !committed.ok) {
      alert('Cannot save allocation: committed workspace failed verification (' +
            (committed && committed.error ? committed.error : 'unreadable') + ').');
      return;
    }

    var baselineEnvelope;
    if (!committed.exists) {
      baselineEnvelope = {
        historicalSnapshots: {},
        rostering: { instructions: {}, provenance: {} }
      };
    } else {
      baselineEnvelope = committed.data;
    }

    if (!validator || typeof validator.checkEvidenceKeyRetention !== 'function') {
      alert('Cannot save allocation: evidence retention validator is unavailable.');
      return;
    }

    var retentionCheck = validator.checkEvidenceKeyRetention(
      baselineEnvelope,
      proposedEnvelope,
      {
        snapshots: planRes.permittedSnapshotRemovals,
        instructions: rosterRes.prunedInstructions,
        provenance: rosterRes.prunedProvenance
      }
    );
    if (!retentionCheck.valid) {
      console.error('Cannot save allocation: evidence retention check failed:', retentionCheck.error);
      alert('Cannot save allocation: ' + retentionCheck.error);
      return;
    }

    // Persist proposed envelope through storage facade
    var saveRes = storage.saveWorkspace(proposedEnvelope);
    if (!saveRes || !saveRes.ok) {
      var saveErr = (saveRes && saveRes.error) ? saveRes.error : 'Storage persistence failed';
      console.error('Cannot save allocation: ' + saveErr);
      alert('Cannot save allocation: The resulting workspace could not be persisted. Live state remains unchanged.');
      return;
    }

    // Atomic adoption only AFTER successful verified commit
    state.customAssignments = rosterRes.customAssignments;
    state.rostering = rosterRes.rosteringState;
    state.historicalSnapshots = planRes.snapshots;
    state.lastRosteringAudit = rosterRes.auditLog;
    state.storageStatus = (saveRes && saveRes.storageMode === 'session-only') ? 'session_only' : 'saved';
    window.HortOpsApp._authoritativeSnapshotCount = Object.keys(planRes.snapshots).length;

    // Invalidate relevant boundary caches, recompute digest and refresh view
    window.HortOpsApp.recomputeDigest();
    window.HortOpsApp.renderCurrentView();
    this.close();
  }
};
