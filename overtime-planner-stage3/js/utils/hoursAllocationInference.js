// Non-persistent, allocation-derived worked-hours coverage for the proposal only.
(function(root) {
  var service = root.HortOpsHoursAllocation;
  if (!service || typeof service.build !== 'function') return;
  var originalBuild = service.build;
  service.build = function(input) {
    var ctx = JSON.parse(JSON.stringify(input || {}));
    var state = ctx.state || {}, target = ctx.occurrence || ctx.shift || {};
    var today = ctx.currentDate || (root.HortOpsDateUtils && root.HortOpsDateUtils.getLocalDateKey && root.HortOpsDateUtils.getLocalDateKey());
    var year = Number(String(target.date || '').slice(0, 4));
    var roster = state.staffList || state.roster || ctx.roster || [], shifts = ctx.allShifts || state.allShifts || [];
    var inferred = Object.create(null), seen = Object.create(null), coverage = Object.create(null);
    roster.forEach(function(staff) { coverage[staff.id] = root.HortOpsHoursEvidence && root.HortOpsHoursEvidence.latest ? root.HortOpsHoursEvidence.latest(staff.overtimeHoursEvidence || [], year) : null; });
    shifts.forEach(function(shift) {
      if (!shift || !shift.shiftId || seen[shift.shiftId]) return; seen[shift.shiftId] = true;
      if (!shift.date || Number(String(shift.date).slice(0, 4)) !== year || shift.date > today || shift.unverifiedSchedule || typeof shift.durationHours !== 'number' || !isFinite(shift.durationHours) || shift.durationHours <= 0) return;
      Array.from(new Set(shift.assignedStaffIds || [])).forEach(function(id) { if (!coverage[id] || shift.date > coverage[id].throughDate) inferred[id] = (inferred[id] || 0) + shift.durationHours; });
    });
    var cloneRoster = roster.map(function(staff) {
      var person = Object.assign({}, staff), prior = (staff.overtimeHoursEvidence || []).slice();
      var latest = coverage[staff.id];
      var total = (latest ? latest.hours : 0) + (inferred[staff.id] || 0);
      var source = latest ? 'Verified evidence plus assigned hours through ' + today : 'Inferred from assigned hours through ' + today;
      prior.push({ id: 'HOURS-INFERRED-' + staff.id + '-' + year, year: year, throughDate: today, hours: total, source: source, recordedAt: '9999-12-31T23:59:59Z', verification: 'allocation_inferred' });
      person.overtimeHoursEvidence = prior;
      return person;
    });
    ctx.state = Object.assign({}, state, { staffList: cloneRoster, roster: cloneRoster });
    ctx.roster = cloneRoster;
    var result = originalBuild(ctx);
    (result.staffRows || []).forEach(function(row) { row.inferredHours = inferred[row.id] || 0; });
    result.policy.actual = 'verified_evidence_plus_assigned_hours_through_today';
    result.messages = ['Hours worked are inferred from assigned past/current occurrences where verified coverage is absent; future commitments remain planned hours.'].concat(result.messages || []);
    return result;
  };
}(typeof window !== 'undefined' ? window : globalThis));
