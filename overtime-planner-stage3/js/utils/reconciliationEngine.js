// Accretive Workforce Reconciliation Engine (P0-02, P0-03)
// Non-destructive 3-way synchronization: preserves local overtime settings and historical assignments.

window.HortOpsReconciliationEngine = (function() {
  function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
  }

  function normalizeName(name) {
    return (name || '').trim().toLowerCase();
  }

  /**
   * Computes the 3-way reconciliation diff between the current roster and incoming snapshot.
   *
   * @param {Array} currentRoster - Existing staff records
   * @param {Array} incomingParsedStaff - Newly parsed staff records from authoritative CSV
   * @param {Object} [customAssignments] - Map of shiftId -> assignedStaffIds[]
   * @param {Array} [allShifts] - Scheduled shifts to check dates (for future shift detection)
   * @returns {{ added: Array, updated: Array, departed: Array, unchanged: Array, vacatedFutureAssignments: Array }}
   */
  function computeWorkforceReconciliation(currentRoster, incomingParsedStaff, customAssignments, allShifts) {
    var currentById = new Map();
    var currentByEmail = new Map();
    var currentByName = new Map();

    (currentRoster || []).forEach(function(s) {
      if (s.id) currentById.set(s.id.toUpperCase(), s);
      if (s.email) currentByEmail.set(normalizeEmail(s.email), s);
      var n = normalizeName(s.title || s.name);
      if (n) currentByName.set(n, s);
    });

    var incomingHandled = new Set();
    var added = [];
    var updated = [];
    var unchanged = [];

    var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey()
      : new Date().toISOString().slice(0, 10);

    (incomingParsedStaff || []).forEach(function(incoming) {
      var match = null;
      if (incoming.id && currentById.has(incoming.id.toUpperCase())) {
        match = currentById.get(incoming.id.toUpperCase());
      } else if (incoming.email && currentByEmail.has(normalizeEmail(incoming.email))) {
        match = currentByEmail.get(normalizeEmail(incoming.email));
      } else if (incoming.name && currentByName.has(normalizeName(incoming.name))) {
        match = currentByName.get(normalizeName(incoming.name));
      }

      if (!match) {
        // Net-new employee
        added.push({
          id: incoming.id,
          name: incoming.name || incoming.title,
          title: incoming.title || incoming.name,
          userType: incoming.userType || 'Worker',
          email: incoming.email || '',
          department: incoming.department || 'Horticulture',
          team: incoming.team || 'Parks',
          crew: incoming.crew || 'GTL - Horticultural Team Leader',
          jobTitle: incoming.jobTitle || '',
          role: incoming.role || 'Operational Staff',
          isContractor: !!incoming.isContractor,
          isPlantOperator: !!incoming.isPlantOperator,
          skills: incoming.skills || [],
          phone: incoming.phone || '',
          avatarColor: incoming.avatarColor || '#10b981',
          status: incoming.status || 'active',
          willingness: 'available',
          firstSeenDate: todayStr,
          ytdOvertimeHours: 0,
          ytdShiftCount: 0
        });
      } else {
        incomingHandled.add(match.id);
        var changedFields = [];
        var previousValues = {};

        if (incoming.status && match.status !== incoming.status) {
          changedFields.push('status');
          previousValues.status = match.status;
        }
        if (incoming.name && match.name !== incoming.name) {
          changedFields.push('name');
          previousValues.name = match.name;
        }
        if (incoming.title && match.title !== incoming.title) {
          changedFields.push('title');
          previousValues.title = match.title;
        }
        if (incoming.jobTitle && match.jobTitle !== incoming.jobTitle) {
          changedFields.push('jobTitle');
          previousValues.jobTitle = match.jobTitle;
        }
        if (match.team !== incoming.team) {
          changedFields.push('team');
          previousValues.team = match.team;
        }
        if (match.department !== incoming.department) {
          changedFields.push('department');
          previousValues.department = match.department;
        }
        if (match.crew !== incoming.crew) {
          changedFields.push('crew');
          previousValues.crew = match.crew;
        }
        if (match.role !== incoming.role) {
          changedFields.push('role');
          previousValues.role = match.role;
        }
        if (!!match.isPlantOperator !== !!incoming.isPlantOperator) {
          changedFields.push('isPlantOperator');
          previousValues.isPlantOperator = match.isPlantOperator;
        }
        if (!!match.isContractor !== !!incoming.isContractor) {
          changedFields.push('isContractor');
          previousValues.isContractor = match.isContractor;
        }
        if (match.email !== incoming.email && incoming.email) {
          changedFields.push('email');
          previousValues.email = match.email;
        }

        // Reconciled object: update authoritative fields, but STRICTLY PRESERVE local overtime settings
        var reconciledRecord = {
          id: match.id,
          name: incoming.name || incoming.title || match.name,
          title: incoming.title || incoming.name || match.title,
          userType: incoming.userType || match.userType || 'Worker',
          email: incoming.email || match.email,
          department: incoming.department || match.department,
          team: incoming.team || match.team,
          crew: incoming.crew || match.crew,
          jobTitle: incoming.jobTitle || match.jobTitle,
          role: incoming.role || match.role,
          isContractor: !!incoming.isContractor,
          isPlantOperator: !!incoming.isPlantOperator,
        skills: match.skills || [],
        poolTagIds: (match.poolTagIds || []).slice(),
        poolTagHistory: JSON.parse(JSON.stringify(match.poolTagHistory || [])),
        overtimeHoursEvidence: JSON.parse(JSON.stringify(match.overtimeHoursEvidence || [])),
        qualifications: JSON.parse(JSON.stringify(match.qualifications || [])),
          phone: match.phone || '',
          avatarColor: match.avatarColor || '#10b981',
          status: incoming.status || match.status || 'active',

          // STRICTLY PRESERVED LOCAL OVERTIME SETTINGS (P0-03, N-P1-01)
          isOvertimeExempt: !!match.isOvertimeExempt,
          exemptionStartDate: match.exemptionStartDate || '',
          exemptionEndDate: match.exemptionEndDate || '',
          exemptionReason: match.exemptionReason || '',
          willingness: match.willingness || 'available',
          customAvailabilityNotes: match.customAvailabilityNotes || '',
          overtimeStats: match.overtimeStats || { hoursYTD: 0, shiftCount: 0 },
          ytdOvertimeHours: match.ytdOvertimeHours || 0,
          ytdShiftCount: match.ytdShiftCount || 0
        };

        if (match.overtimeHoursEvidence === undefined) delete reconciledRecord.overtimeHoursEvidence;

        if (changedFields.length > 0) {
          updated.push({
            staff: reconciledRecord,
            changedFields: changedFields,
            previousValues: previousValues
          });
        } else {
          unchanged.push(reconciledRecord);
        }
      }
    });

    // Identify departed staff (present in current roster, omitted from snapshot)
    var departed = [];
    (currentRoster || []).forEach(function(s) {
      if (!incomingHandled.has(s.id) && s.status !== 'departed') {
        departed.push(Object.assign({}, s, {
          status: 'departed',
          departedDate: todayStr
        }));
      }
    });

    // Identify future assignments held by departed, inactive, on_leave, or temporarily_unavailable staff
    var ineligibleIds = new Set(departed.map(function(d) { return d.id; }));
    function markIfIneligible(st, id) {
      var s = (st || '').toLowerCase();
      if (s === 'departed' || s === 'inactive' || s === 'on_leave' || s === 'temporarily_unavailable') {
        ineligibleIds.add(id);
      }
    }
    updated.forEach(function(u) {
      if (u.staff) markIfIneligible(u.staff.status, u.staff.id);
    });
    unchanged.forEach(function(s) {
      if (s) markIfIneligible(s.status, s.id);
    });
    var vacatedFutureAssignments = [];

    if (allShifts && Array.isArray(allShifts)) {
      allShifts.forEach(function(sh) {
        if (sh.date >= todayStr) {
          var assigned = (customAssignments && (customAssignments[sh.shiftId] || customAssignments[sh.jobId + '@' + sh.date])) || sh.assignedStaffIds || [];
          assigned.forEach(function(sid) {
            if (ineligibleIds.has(sid)) {
              var rec = currentById.get(sid.toUpperCase());
              vacatedFutureAssignments.push({
                shiftId: sh.shiftId,
                date: sh.date,
                staffId: sid,
                staffName: rec ? rec.name : sid
              });
            }
          });
        }
      });
    }

    return {
      added: added,
      updated: updated,
      departed: departed,
      unchanged: unchanged,
      vacatedFutureAssignments: vacatedFutureAssignments
    };
  }

  /**
   * Applies the reconciliation diff to master roster and assignment ledger.
   *
   * @param {Array} currentRoster - Existing staff records
   * @param {Object} diff - Computed diff
   * @param {Object} [customAssignments] - Map of shiftId -> assignedStaffIds[]
   * @param {Array} [allShifts] - Scheduled shifts
   * @returns {{ reconciledRoster: Array, reconciledAssignments: Object, vacatedCount: number }}
   */
  function applyWorkforceReconciliation(currentRoster, diff, customAssignments, allShifts) {
    var staffMap = new Map();

    // 1. Unchanged
    (diff.unchanged || []).forEach(function(s) { staffMap.set(s.id, s); });

    // 2. Updated
    (diff.updated || []).forEach(function(u) { staffMap.set(u.staff.id, u.staff); });

    // 3. Added
    (diff.added || []).forEach(function(s) { staffMap.set(s.id, s); });

    // 4. Departed (marked departed, not deleted)
    (diff.departed || []).forEach(function(d) { staffMap.set(d.id, d); });

    // 5. Keep all previously departed staff who were not in this snapshot
    (currentRoster || []).forEach(function(s) {
      if (s.status === 'departed' && !staffMap.has(s.id)) {
        staffMap.set(s.id, s);
      }
    });

    // 6. Prune non-active (departed, inactive, on_leave, temporarily_unavailable) staff from ALL future assignments (custom and explicit), leaving historical records intact
    var ineligibleStaffIds = new Set();
    function checkIneligible(s) {
      if (!s) return;
      var st = (s.status || '').toLowerCase();
      if (st === 'departed' || st === 'inactive' || st === 'on_leave' || st === 'temporarily_unavailable') {
        ineligibleStaffIds.add(s.id);
      }
    }
    (diff.departed || []).forEach(checkIneligible);
    (diff.updated || []).forEach(function(u) { if (u.staff) checkIneligible(u.staff); });
    (diff.unchanged || []).forEach(checkIneligible);
    (diff.added || []).forEach(checkIneligible);
    staffMap.forEach(checkIneligible);

    var reconciledAssignments = {};
    if (customAssignments) {
      Object.keys(customAssignments).forEach(function(k) {
        reconciledAssignments[k] = (customAssignments[k] || []).slice();
      });
    }

    var todayStr = (window.HortOpsDateUtils && typeof window.HortOpsDateUtils.getLocalDateKey === 'function')
      ? window.HortOpsDateUtils.getLocalDateKey()
      : new Date().toISOString().slice(0, 10);
    if (allShifts && Array.isArray(allShifts)) {
      allShifts.forEach(function(sh) {
        if (sh.date >= todayStr) {
          var currentAssigned = reconciledAssignments[sh.shiftId] || sh.assignedStaffIds || [];
          var hasIneligible = currentAssigned.some(function(sid) { return ineligibleStaffIds.has(sid); });
          if (hasIneligible) {
            reconciledAssignments[sh.shiftId] = currentAssigned.filter(function(sid) {
              return !ineligibleStaffIds.has(sid);
            });
          }
        }
      });
    }

    return {
      reconciledRoster: Array.from(staffMap.values()),
      reconciledAssignments: reconciledAssignments,
      vacatedCount: (diff.vacatedFutureAssignments || []).length
    };
  }

  return {
    computeWorkforceReconciliation: computeWorkforceReconciliation,
    applyWorkforceReconciliation: applyWorkforceReconciliation
  };
})();
