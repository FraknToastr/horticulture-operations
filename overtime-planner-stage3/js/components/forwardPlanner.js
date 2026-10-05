// Forward Planner Component
// Full feature parity: Saturday & Sunday day columns (plus holiday overtime),
// grouped Vacancy Rows, and Assigned Only toggle.
window.HortOpsForwardPlanner = {
  selectedStaffId: null,
  selectedDept: 'all',
  selectedTeam: 'all',
  searchTerm: '',
  hideUnassigned: true,
  filterDrawerOpen: false,
  selectedJobId: null,
  startWeek: 1,
  windowSize: (typeof window !== 'undefined' && window.innerWidth < 1600) ? 4 : 6,

  render: function(state) {
    var icons = window.HortOpsIcons;
    var dateUtils = window.HortOpsDateUtils;
    var esc = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtml) ? window.HortOpsSecurityUtils.escapeHtml : function(s) { return String(s || ''); };
    var escAttr = (window.HortOpsSecurityUtils && window.HortOpsSecurityUtils.escapeHtmlAttr) ? window.HortOpsSecurityUtils.escapeHtmlAttr : function(s) { return String(s || ''); };
    var staffList = state.staffList;
    var slots = state.slots;
    var allShifts = state.allShifts;
    var self = this;

    var hierarchy = window.HortOpsData.getDepartmentHierarchy(staffList);

    // 1. Resolve current week and auto-initialize
    var totalWeeks = (slots && slots.length) ? slots.length : 52;
    var currentWeekNum = (dateUtils && dateUtils.getCurrentWeekNumber) ? dateUtils.getCurrentWeekNumber(slots) : 36;
    if (!self.startWeekInitialized) {
      self.startWeek = Math.min(totalWeeks - self.windowSize + 1, Math.max(1, currentWeekNum));
      self.startWeekInitialized = true;
    }

    // Sliced slots in window
    var endWeek = Math.min(totalWeeks, self.startWeek + self.windowSize - 1);
    var visibleSlots = slots.filter(function(s) {
      return s.weekNumber >= self.startWeek && s.weekNumber <= endWeek;
    });
    var visibleWeekNumbers = new Set(visibleSlots.map(function(s) { return s.weekNumber; }));

    // 2. Build Slot Day Columns (Split into Saturday & Sunday, plus Friday / Monday if holiday)
    var slotDayMap = {};
    var totalActiveColumns = 0;

    visibleSlots.forEach(function(slot) {
      var satDate = slot.saturdayDate;
      var sunDate = slot.sundayDate;

      var satShifts = slot.shifts.filter(function(s) { return s.dayOfWeek === 'Saturday'; });
      var sunShifts = slot.shifts.filter(function(s) { return s.dayOfWeek === 'Sunday'; });
      var friShifts = slot.shifts.filter(function(s) { return s.dayOfWeek === 'Friday'; });
      var monShifts = slot.shifts.filter(function(s) { return s.dayOfWeek === 'Monday'; });
      var weekendShifts = slot.shifts.filter(function(s) { return s.dayOfWeek === 'Weekend'; });

      var satHoliday = slot.publicHolidays.find(function(h) { return h.date === satDate; });
      var sunHoliday = slot.publicHolidays.find(function(h) { return h.date === sunDate; });
      var friHoliday = slot.publicHolidays.find(function(h) { return h.date === slot.fridayDate; });
      var monHoliday = slot.publicHolidays.find(function(h) { return h.date === slot.mondayDate; });

      var days = [];

      // Friday Pre-Holiday overtime: ONLY show if it has scheduled jobs
      if (friShifts.length > 0) {
        days.push({
          day: 'Friday',
          dateStr: slot.fridayDate,
          label: dateUtils.formatDisplayDate(slot.fridayDate),
          holiday: friHoliday,
          availableShifts: friShifts,
          isFirstInWeekend: true,
          hasOvertime: true
        });
      }

      // Saturday: Core weekend column; only show holiday badge/styling if it has scheduled jobs
      var satHasJobs = satShifts.length > 0 || weekendShifts.length > 0;
      days.push({
        day: 'Saturday',
        dateStr: satDate,
        label: dateUtils.formatDisplayDate(satDate),
        holiday: satHasJobs ? satHoliday : undefined,
        availableShifts: satShifts.concat(weekendShifts),
        isFirstInWeekend: days.length === 0,
        hasOvertime: satHasJobs
      });

      // Sunday: Core weekend column; only show holiday badge/styling if it has scheduled jobs
      var sunHasJobs = sunShifts.length > 0 || weekendShifts.length > 0;
      days.push({
        day: 'Sunday',
        dateStr: sunDate,
        label: dateUtils.formatDisplayDate(sunDate),
        holiday: sunHasJobs ? sunHoliday : undefined,
        availableShifts: sunShifts.concat(weekendShifts),
        isFirstInWeekend: false,
        hasOvertime: sunHasJobs
      });

      // Monday Post-Holiday overtime: ONLY show if it has scheduled jobs
      if (monShifts.length > 0) {
        days.push({
          day: 'Monday',
          dateStr: slot.mondayDate,
          label: dateUtils.formatDisplayDate(slot.mondayDate),
          holiday: monHoliday,
          availableShifts: monShifts,
          isFirstInWeekend: false,
          hasOvertime: true
        });
      }

      slot.shifts.forEach(function(shift) {
        if (!days.some(function(d) { return d.dateStr === shift.date; })) {
          days.push({day:shift.dayOfWeek,dateStr:shift.date,label:dateUtils.formatDisplayDate(shift.date),
            holiday:slot.publicHolidays.find(function(h) { return h.date === shift.date; }),
            availableShifts:slot.shifts.filter(function(s) { return s.date === shift.date; }),hasOvertime:true});
        }
      });
      days.sort(function(a,b) { return a.dateStr.localeCompare(b.dateStr); });
      days.forEach(function(d,i) { d.isFirstInWeekend = i === 0; });
      slotDayMap[slot.weekNumber] = days;
      totalActiveColumns += days.length;
    });

    // 3. Build Staff Schedule Map (indexed by staffId -> weekNumber -> { satShifts, sunShifts, allShifts })
    var staffScheduleMap = {};
    allShifts.forEach(function(shift) {
      (shift.assignedStaffIds || []).forEach(function(staffId) {
        if (!staffScheduleMap[staffId]) staffScheduleMap[staffId] = {};
        if (!staffScheduleMap[staffId][shift.weekNumber]) {
          staffScheduleMap[staffId][shift.weekNumber] = {
            satShifts: [],
            sunShifts: [],
            allShifts: []
          };
        }
        var alloc = staffScheduleMap[staffId][shift.weekNumber];
        alloc.allShifts.push(shift);
        if (shift.dayOfWeek === 'Saturday') alloc.satShifts.push(shift);
        else if (shift.dayOfWeek === 'Sunday') alloc.sunShifts.push(shift);
      });
    });

    // 4. Calculate Vacancies across visible slots
    var visibleVacancies = [];
    visibleSlots.forEach(function(slot) {
      slot.shifts.forEach(function(shift) {
        if (self.selectedJobId && shift.jobId !== self.selectedJobId) return;
        var assignedCount = (shift.assignedStaffIds || []).length;
        var deficit = shift.crewSize - assignedCount;
        if (deficit > 0) {
          for (var i = 1; i <= deficit; i++) {
            visibleVacancies.push({
              id: 'vacancy-' + shift.shiftId + '-' + i,
              shift: shift,
              vacancyNumber: i,
              totalShiftVacancies: deficit
            });
          }
        }
      });
    });

    // 5. Filter Staff by Dept, Team, Search, and HideUnassigned
    var filteredStaff = staffList.filter(function(staff) {
      if (self.selectedDept !== 'all' && staff.department !== self.selectedDept) return false;
      if (self.selectedTeam !== 'all' && staff.team !== self.selectedTeam) return false;

      if (self.searchTerm) {
        var term = self.searchTerm.toLowerCase();
        var mName = (staff.name || '').toLowerCase().indexOf(term) !== -1;
        var mRole = (staff.role || '').toLowerCase().indexOf(term) !== -1;
        var mTeam = (staff.team || '').toLowerCase().indexOf(term) !== -1;
        if (!mName && !mRole && !mTeam) return false;
      }

      if (self.selectedJobId) {
        var staffWeeks = staffScheduleMap[staff.id];
        if (!staffWeeks) return false;
        var hasJobShiftInWindow = false;
        visibleWeekNumbers.forEach(function(wn) {
          var alloc = staffWeeks[wn];
          if (alloc && alloc.allShifts) {
            alloc.allShifts.forEach(function(s) {
              if (s.jobId === self.selectedJobId) hasJobShiftInWindow = true;
            });
          }
        });
        if (!hasJobShiftInWindow) return false;
      }

      if (self.hideUnassigned) {
        var staffWeeks = staffScheduleMap[staff.id];
        if (!staffWeeks) return false;
        var hasShiftInWindow = false;
        visibleWeekNumbers.forEach(function(wn) {
          var alloc = staffWeeks[wn];
          if (alloc && alloc.allShifts.length > 0) {
            hasShiftInWindow = true;
          }
        });
        return hasShiftInWindow;
      }

      return true;
    });

    // Count total assigned in window
    var totalAssignedInWindowCount = 0;
    staffList.forEach(function(staff) {
      var staffWeeks = staffScheduleMap[staff.id];
      if (staffWeeks) {
        var hasShift = false;
        visibleWeekNumbers.forEach(function(wn) {
          var alloc = staffWeeks[wn];
          if (alloc && alloc.allShifts.length > 0) hasShift = true;
        });
        if (hasShift) totalAssignedInWindowCount++;
      }
    });

    // 6. Optimal Grouping: Group Table Rows by Job / Shift across visible slots
    var tableRows = [];
    var placedStaffIds = new Set();
    var placedVacancyIds = new Set();

    // Collect all shifts in the visible slots (filtered by selectedJobId if active)
    var visibleShifts = [];
    visibleSlots.forEach(function(slot) {
      slot.shifts.forEach(function(sh) {
        if (!self.selectedJobId || sh.jobId === self.selectedJobId) {
          visibleShifts.push(sh);
        }
      });
    });

    // Group assigned staff and vacancies together by shift
    visibleShifts.forEach(function(shift) {
      var shiftAssignedStaff = [];
      (shift.assignedStaffIds || []).forEach(function(id) {
        var s = filteredStaff.find(function(item) { return item.id === id; });
        if (s) shiftAssignedStaff.push(s);
      });

      var shiftVacancies = visibleVacancies.filter(function(v) {
        return v.shift.shiftId === shift.shiftId && !placedVacancyIds.has(v.id);
      });

      var unplacedStaff = shiftAssignedStaff.filter(function(s) {
        return !placedStaffIds.has(s.id);
      });

      // Check if some teammates from this shift are ALREADY placed in tableRows
      var existingIndices = [];
      tableRows.forEach(function(row, idx) {
        if (row.type === 'staff' && (shift.assignedStaffIds || []).indexOf(row.staff.id) !== -1) {
          existingIndices.push(idx);
        }
      });

      var itemsToInsert = [];
      unplacedStaff.forEach(function(s) {
        itemsToInsert.push({ type: 'staff', staff: s });
        placedStaffIds.add(s.id);
      });
      shiftVacancies.forEach(function(v) {
        itemsToInsert.push({ type: 'vacancy', vacancy: v });
        placedVacancyIds.add(v.id);
      });

      if (itemsToInsert.length === 0) return;

      if (existingIndices.length > 0) {
        // Bridge crew shared across jobs: insert unplaced staff & vacancies directly adjacent
        // to the earliest teammate to maintain contiguous blocks of job cards
        var insertIdx = Math.min.apply(null, existingIndices);
        tableRows.splice.apply(tableRows, [insertIdx, 0].concat(itemsToInsert));
      } else {
        tableRows = tableRows.concat(itemsToInsert);
      }
    });

    // Add remaining filtered staff
    filteredStaff.forEach(function(staff) {
      if (!placedStaffIds.has(staff.id)) {
        tableRows.push({ type: 'staff', staff: staff });
        placedStaffIds.add(staff.id);
      }
    });

    // Fallback check for any vacancies not already inserted
    visibleVacancies.forEach(function(vac) {
      if (!placedVacancyIds.has(vac.id)) {
        tableRows.push({ type: 'vacancy', vacancy: vac });
        placedVacancyIds.add(vac.id);
      }
    });


    var ctx = {
      self: self,
      hierarchy: hierarchy,
      filteredStaff: filteredStaff,
      staffList: staffList,
      visibleVacancies: visibleVacancies,
      visibleSlots: visibleSlots,
      slotDayMap: slotDayMap,
      staffScheduleMap: staffScheduleMap,
      tableRows: tableRows,
      endWeek: endWeek,
      totalWeeks: totalWeeks,
      totalActiveColumns: totalActiveColumns,
      totalAssignedInWindowCount: totalAssignedInWindowCount,
      currentWeekNum: currentWeekNum,
      icons: icons,
      esc: esc,
      escAttr: escAttr
    };

    var toolbarHtml = window.HortOpsForwardPlannerControls ?
      window.HortOpsForwardPlannerControls.renderToolbar(ctx) : '';
    var theadHtml = window.HortOpsForwardPlannerHeader ?
      window.HortOpsForwardPlannerHeader.renderThead(ctx) : '';
    var tbodyRowsHtml = window.HortOpsForwardPlannerMatrix ?
      window.HortOpsForwardPlannerMatrix.renderTbody(ctx) : '';

    return toolbarHtml +
      '<div class="planner-table-wrapper">' +
        '<table class="planner-table">' +
          theadHtml +
          '<tbody>' +
            tbodyRowsHtml +
          '</tbody>' +
        '</table>' +
      '</div>';
  },


  handleDeptChange: function(val) {
    this.selectedDept = val;
    this.selectedTeam = 'all';
    window.HortOpsApp.renderCurrentView();
  },

  handleTeamChange: function(val) {
    this.selectedTeam = val;
    window.HortOpsApp.renderCurrentView();
  },

  handleSearch: function(val) {
    this.searchTerm = val;
    var activeEl = document.activeElement;
    var isSearchInput = activeEl && activeEl.tagName === 'INPUT' && activeEl.placeholder && activeEl.placeholder.indexOf('Search') !== -1;
    var selStart = isSearchInput ? activeEl.selectionStart : null;
    var selEnd = isSearchInput ? activeEl.selectionEnd : null;

    if (window.HortOpsApp) window.HortOpsApp.renderCurrentView();

    if (isSearchInput) {
      var contentMount = document.getElementById('view-content');
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

  toggleHideUnassigned: function() {
    // Deprecated in Offline15.2: Former 'Assigned Only' mode is now the permanent default view
    this.hideUnassigned = true;
    window.HortOpsApp.renderCurrentView();
  },

  toggleSelectStaff: function(staffId) {
    this.selectedStaffId = this.selectedStaffId === staffId ? null : staffId;
    window.HortOpsApp.renderCurrentView();
  },

  jumpToCurrentWeek: function() {
    var dateUtils = window.HortOpsDateUtils;
    var slots = (window.HortOpsApp && window.HortOpsApp.state) ? window.HortOpsApp.state.slots : [];
    var totalWeeks = (slots && slots.length) ? slots.length : 52;
    var currentWeekNum = (dateUtils && dateUtils.getCurrentWeekNumber) ? dateUtils.getCurrentWeekNumber(slots) : 36;
    this.startWeek = Math.min(totalWeeks - this.windowSize + 1, Math.max(1, currentWeekNum));
    window.HortOpsApp.renderCurrentView();
  },

  prevWeeks: function() {
    this.startWeek = Math.max(1, this.startWeek - this.windowSize);
    window.HortOpsApp.renderCurrentView();
  },

  nextWeeks: function() {
    var slots = (window.HortOpsApp && window.HortOpsApp.state) ? window.HortOpsApp.state.slots : [];
    var totalWeeks = (slots && slots.length) ? slots.length : 52;
    this.startWeek = Math.min(totalWeeks - this.windowSize + 1, this.startWeek + this.windowSize);
    window.HortOpsApp.renderCurrentView();
  },

  setWindowSize: function(sz) {
    this.windowSize = sz;
    window.HortOpsApp.renderCurrentView();
  },

  toggleFilterDrawer: function(forceState) {
    if (typeof forceState === 'boolean') {
      this.filterDrawerOpen = forceState;
    } else {
      this.filterDrawerOpen = !this.filterDrawerOpen;
    }
    window.HortOpsApp.renderCurrentView();
  },

  handleJobFilter: function(jobId) {
    if (this.selectedJobId === jobId) {
      this.selectedJobId = null;
    } else {
      this.selectedJobId = jobId;
    }
    window.HortOpsApp.renderCurrentView();
  },

  clearAllFilters: function() {
    this.selectedDept = 'all';
    this.selectedTeam = 'all';
    this.searchTerm = '';
    this.selectedJobId = null;
    window.HortOpsApp.renderCurrentView();
  }
};
