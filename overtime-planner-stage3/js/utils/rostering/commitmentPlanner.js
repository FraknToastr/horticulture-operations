/**
 * Horticulture Operations Overtime Planner — Scheduled Commitment Delta Planner
 * Module: js/utils/rostering/commitmentPlanner.js
 *
 * Implements authoritative pure scheduled-commitment delta planning for Stage 1 Gate B2.
 * Pure ES5: no live state mutation, no localStorage access, no DOM references, and no
 * un-injected clock calls.
 */
(function(root) {
  'use strict';

  var own = Object.prototype.hasOwnProperty;
  var toString = Object.prototype.toString;

  function isObject(val) {
    return val !== null && typeof val === 'object' && toString.call(val) === '[object Object]';
  }

  function cloneStrictJson(obj) {
    if (!isObject(obj)) return {};
    return JSON.parse(JSON.stringify(obj));
  }

  function fail(message) {
    return {
      ok: false,
      error: message,
      snapshots: null,
      permittedSnapshotRemovals: [],
      affectedShiftIds: [],
      errors: [message]
    };
  }

  function resolveValidator() {
    if (typeof window !== 'undefined' && window.HortOpsSchemaValidator) {
      return window.HortOpsSchemaValidator;
    }
    if (typeof require !== 'undefined') {
      try {
        return require('../storage/schemaValidator.js');
      } catch (e) {
        try {
          return require('./js/utils/storage/schemaValidator.js');
        } catch (e2) {
          return null;
        }
      }
    }
    return null;
  }

  function extractDate(shiftId, fallbackDate) {
    if (fallbackDate && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)) {
      return fallbackDate;
    }
    if (typeof shiftId === 'string') {
      var atIdx = shiftId.indexOf('@');
      if (atIdx !== -1) {
        var cand = shiftId.slice(atIdx + 1);
        if (/^\d{4}-\d{2}-\d{2}$/.test(cand)) return cand;
      }
      var match = shiftId.match(/\d{4}-\d{2}-\d{2}/);
      if (match) return match[0];
    }
    return null;
  }

  function isVerifiedOperationalOccurrence(occ, shiftId, validator) {
    if (!occ || typeof occ !== 'object' || Array.isArray(occ)) return false;
    var sId = occ.shiftId || shiftId;
    if (!sId || typeof sId !== 'string') return false;
    if (shiftId && occ.shiftId && occ.shiftId !== shiftId) return false;

    var atIdx = sId.indexOf('@');
    if (atIdx <= 0 || atIdx === sId.length - 1 || sId.indexOf('@', atIdx + 1) !== -1) return false;

    var expectedJobId = sId.slice(0, atIdx);
    var expectedDate = sId.slice(atIdx + 1);

    var isRealYmd = (validator && typeof validator.isRealYmd === 'function')
      ? function(d) { return validator.isRealYmd(d); }
      : function(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); };

    var isRealClock = (validator && typeof validator.isRealClock === 'function')
      ? function(c) { return validator.isRealClock(c); }
      : function(c) { return /^([01]?\d|2[0-3]):[0-5]\d(\s?[AP]M)?$/i.test(c); };

    if (!isRealYmd(expectedDate)) return false;
    if (occ.date && (occ.date !== expectedDate || !isRealYmd(occ.date))) return false;
    if (occ.jobId && occ.jobId !== expectedJobId) return false;

    if (!occ.startTime || !isRealClock(occ.startTime)) return false;
    var dur = Number(occ.durationHours);
    if (!isFinite(dur) || dur <= 0) return false;

    return true;
  }

  function makeScheduledCommitment(occ, afterStaff, nowIso) {
    var sId = occ.shiftId;
    var jId = occ.jobId || (sId.indexOf('@') !== -1 ? sId.split('@')[0] : '');
    var dStr = occ.date || (sId.indexOf('@') !== -1 ? sId.split('@')[1] : '');
    var commitment = {
      shiftId: sId,
      jobId: jId,
      date: dStr,
      startTime: occ.startTime,
      durationHours: Number(occ.durationHours),
      assignedStaffIds: afterStaff.slice(),
      recordType: 'scheduled_commitment'
    };
    if (typeof nowIso === 'string' && nowIso.length > 0) {
      commitment.recordedAt = nowIso;
    }
    if (occ.crewSize !== undefined && occ.crewSize !== null) {
      commitment.crewSize = Number(occ.crewSize);
    }
    return commitment;
  }

  function withUpdatedAssignedStaff(oldSnapshot, afterStaff) {
    var updated = {
      shiftId: oldSnapshot.shiftId,
      jobId: oldSnapshot.jobId,
      date: oldSnapshot.date,
      startTime: oldSnapshot.startTime,
      durationHours: Number(oldSnapshot.durationHours),
      assignedStaffIds: afterStaff.slice(),
      recordType: oldSnapshot.recordType || 'scheduled_commitment'
    };
    if (own.call(oldSnapshot, 'recordedAt') && oldSnapshot.recordedAt !== undefined && oldSnapshot.recordedAt !== null) {
      updated.recordedAt = oldSnapshot.recordedAt;
    }
    if (oldSnapshot.crewSize !== undefined && oldSnapshot.crewSize !== null) {
      updated.crewSize = Number(oldSnapshot.crewSize);
    }
    return updated;
  }

  function canAuthoriseFutureRemoval(operation, row, beforeRostering, afterRostering, prunedProvenance, authoritativeOccurrences) {
    if (!operation || typeof operation !== 'object' || !row || typeof row !== 'object') return false;
    if (row.afterStaff && row.afterStaff.length !== 0) return false;
    if (operation.todayKey && row.date < operation.todayKey) return false;

    var opType = operation.type || 'allocation_reconciliation';
    if (opType !== 'allocation_reconciliation' && opType !== 'future_unassignment') {
      return false;
    }

    // Case 1: Source shift unassignment (modal explicitly unassigns the active shift itself)
    if (operation.sourceShiftId === row.shiftId) {
      return true;
    }

    // Case 2: Descendant shift unassignment
    // Must prove that EVERY removed employee was previously assigned by an instruction owned by operation.sourceShiftId,
    // is recorded in prunedProvenance, and is absent from afterRostering.provenance.
    if (!isObject(beforeRostering) || !isObject(beforeRostering.provenance) ||
        !isObject(beforeRostering.instructions) || !isObject(afterRostering) ||
        !isObject(afterRostering.provenance) || !Array.isArray(prunedProvenance)) {
      return false;
    }
    var beforeStaff = row.beforeStaff || [];
    if (beforeStaff.length === 0) return false;

    for (var i = 0; i < beforeStaff.length; i++) {
      var empId = beforeStaff[i];
      var pKey = row.shiftId + ':' + empId;
      var oldProv = beforeRostering.provenance[pKey];
      if (!oldProv) {
        return false; // unprovenanced / manual assignment cannot be pruned by another source
      }

      var inst = (oldProv && oldProv.instructionId) ?
        beforeRostering.instructions[oldProv.instructionId] : null;
      var isOwned = oldProv.source === 'rostering-rule' && !!inst &&
        oldProv.sourceShiftId === operation.sourceShiftId &&
        inst.sourceShiftId === operation.sourceShiftId;
      if (!isOwned) {
        return false;
      }

      // Must be absent from afterRostering.provenance
      if (own.call(afterRostering.provenance, pKey)) {
        return false;
      }

      // Engine-reported exact pruning is mandatory, never optional.
      if (prunedProvenance.indexOf(pKey) === -1) return false;
    }

    return true;
  }

  function diffCanonicalAssignmentMaps(beforeAssignments, afterAssignments, occurrences, nextSnapshots) {
    var allKeys = Object.create(null);
    var k;
    if (isObject(beforeAssignments)) {
      for (k in beforeAssignments) {
        if (own.call(beforeAssignments, k)) allKeys[k] = true;
      }
    }
    if (isObject(afterAssignments)) {
      for (k in afterAssignments) {
        if (own.call(afterAssignments, k)) allKeys[k] = true;
      }
    }

    var changed = [];
    for (k in allKeys) {
      var before = (isObject(beforeAssignments) && Array.isArray(beforeAssignments[k])) ? beforeAssignments[k] : [];
      var after = (isObject(afterAssignments) && Array.isArray(afterAssignments[k])) ? afterAssignments[k] : [];

      var isDifferent = false;
      if (before.length !== after.length) {
        isDifferent = true;
      } else {
        for (var idx = 0; idx < before.length; idx++) {
          if (before[idx] !== after[idx]) {
            isDifferent = true;
            break;
          }
        }
      }

      if (isDifferent) {
        var seenStaff = Object.create(null);
        for (var sIdx = 0; sIdx < after.length; sIdx++) {
          var stId = after[sIdx];
          if (typeof stId !== 'string' || !stId.trim()) {
            return { error: 'Invalid staff ID in assignment for shift ' + k };
          }
          if (seenStaff[stId]) {
            return { error: 'Duplicate staff ID "' + stId + '" in assignment for shift ' + k };
          }
          seenStaff[stId] = true;
        }

        var occDate = (occurrences && occurrences[k] && occurrences[k].date) ? occurrences[k].date : null;
        var snapDate = (nextSnapshots && nextSnapshots[k] && nextSnapshots[k].date) ? nextSnapshots[k].date : null;
        var d = extractDate(k, occDate || snapDate);
        if (!d) {
          return { error: 'Cannot determine operational date for changed shift: ' + k };
        }

        changed.push({
          shiftId: k,
          date: d,
          beforeStaff: before.slice(),
          afterStaff: after.slice()
        });
      }
    }

    return { changed: changed };
  }

  function plan(input) {
    input = input || {};
    var beforeAssignments = input.beforeAssignments || {};
    var afterAssignments = input.afterAssignments || {};
    var beforeSnapshots = input.beforeSnapshots || {};
    var beforeRostering = input.beforeRostering;
    var afterRostering = input.afterRostering;
    var prunedProvenance = input.prunedProvenance;
    var authoritativeOccurrences = input.authoritativeOccurrences || {};
    var validator = resolveValidator();
    var todayKey = input.todayKey;
    if (!validator || typeof validator.isRealYmd !== 'function' ||
        !validator.isRealYmd(todayKey)) {
      return fail('Valid caller-injected todayKey and canonical date validator are required.');
    }
    var nowIso = input.nowIso || (input.operation && input.operation.recordedAtIso) || null;
    var operationInput = input.operation || { type: 'allocation_reconciliation' };
    var operation = {};
    for (var opKey in operationInput) {
      if (own.call(operationInput, opKey)) operation[opKey] = operationInput[opKey];
    }
    operation.todayKey = todayKey;

    if (!isObject(beforeSnapshots)) {
      return fail('Invalid beforeSnapshots: expected key-value object map.');
    }
    if (!isObject(beforeAssignments) || !isObject(afterAssignments)) {
      return fail('Invalid assignments: expected key-value object maps.');
    }

    var next = cloneStrictJson(beforeSnapshots);
    var diffRes = diffCanonicalAssignmentMaps(beforeAssignments, afterAssignments, authoritativeOccurrences, next);
    if (diffRes.error) {
      return fail(diffRes.error);
    }

    var changed = diffRes.changed;
    var authorisedRemovals = [];
    for (var i = 0; i < changed.length; i++) {
      var row = changed[i];
      var oldSnapshot = own.call(next, row.shiftId) ? next[row.shiftId] : null;

      if (todayKey && row.date < todayKey) {
        return fail('historical commitment would be changed: ' + row.shiftId);
      }

      if (row.afterStaff.length === 0) {
        if (oldSnapshot) {
          if (canAuthoriseFutureRemoval(operation, row, beforeRostering, afterRostering, prunedProvenance, authoritativeOccurrences)) {
            delete next[row.shiftId];
            authorisedRemovals.push(row.shiftId);
          } else {
            return fail('unauthorised evidence removal: ' + row.shiftId);
          }
        }
        continue;
      }

      if (oldSnapshot) {
        next[row.shiftId] = withUpdatedAssignedStaff(oldSnapshot, row.afterStaff);
      } else {
        var occurrence = authoritativeOccurrences[row.shiftId];
        if (!isVerifiedOperationalOccurrence(occurrence, row.shiftId, validator)) {
          return fail('new assignment lacks authoritative timing: ' + row.shiftId);
        }
        next[row.shiftId] = makeScheduledCommitment(occurrence, row.afterStaff, nowIso);
      }
    }

    // Output schema validation
    if (validator && typeof validator.validateScheduledCommitment === 'function') {
      var nextKeys = Object.keys(next);
      for (var vIdx = 0; vIdx < nextKeys.length; vIdx++) {
        var k = nextKeys[vIdx];
        var valRes = validator.validateScheduledCommitment(k, next[k]);
        if (!valRes.valid) {
          return fail('Generated snapshot failed schema validation (' + k + '): ' + valRes.error);
        }
      }
    }

    return {
      ok: true,
      snapshots: next,
      permittedSnapshotRemovals: authorisedRemovals,
      affectedShiftIds: changed.map(function(r) { return r.shiftId; }),
      errors: []
    };
  }

  var commitmentPlanner = {
    plan: plan,
    diffCanonicalAssignmentMaps: diffCanonicalAssignmentMaps,
    isVerifiedOperationalOccurrence: isVerifiedOperationalOccurrence,
    canAuthoriseFutureRemoval: canAuthoriseFutureRemoval
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = commitmentPlanner;
  }
  if (root) {
    root.HortOpsCommitmentPlanner = commitmentPlanner;
  }
})(typeof window !== 'undefined' ? window : this);
