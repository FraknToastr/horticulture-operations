(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {};
  var base = UOS.ProgramBudget;
  var postingDepth = 0;
  if (!base) return;
  function text(value) { return String(value == null ? "" : value).trim(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function rows(ws, name) { return ws.entities[name] || (ws.entities[name] = []); }
  function cents(value) {
    var valueText = text(value);
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(valueText)) throw new Error("Amount must be in exact cents.");
    var parts = valueText.split("."), result = Number(parts[0]) * 100 + (parts[0][0] === "-" ? -1 : 1) * Number((parts[1] || "").padEnd(2, "0"));
    if (!Number.isSafeInteger(result)) throw new Error("Amount exceeds the exact-cent range.");
    return result;
  }
  function storedCents(entry) { return entry.amountCents == null ? Math.round(Number(entry.amount || 0) * 100) : entry.amountCents; }
  function sumCents(list) { return list.reduce(function (sum, entry) { return sum + storedCents(entry); }, 0); }
  function id(ws, owner, type, seed) {
    var index = 0, candidate;
    do { candidate = UOS.ProgramModel.stableId(owner, type, seed + ":" + index++); }
    while (Object.keys(ws.entities).some(function (name) { return rows(ws, name).some(function (row) { return row.id === candidate; }); }));
    return candidate;
  }
  function get(ws, collection, value) {
    var found = rows(ws, collection).find(function (row) { return row.id === text(value); });
    if (!found) throw new Error(collection + " record not found.");
    return found;
  }
  function reference(ws, registerId) {
    var record = rows(ws, "applications").concat(rows(ws, "events")).find(function (row) { return row.id === registerId; });
    if (!record) return { registerId: "", referenceNumber: "", referenceNumberStatus: "not applicable" };
    var raw = record.raw || {}, payload = record.payload || {};
    var keys = record.owner === "EVT" ? ["jobId", "job_id", "jobNumber", "job_number", "job", "eventNumber"] : ["receipt", "receiptNumber"];
    var number = record.owner === "EVT" ? record.jobId : record.receipt;
    keys.some(function (key) { if (!text(number)) number = raw[key] || payload[key]; return Boolean(text(number)); });
    return { registerId: record.id, referenceNumber: text(number), referenceNumberStatus: text(number) ? "captured" : "missing at event time" };
  }
  function year(ws, budgetId) { return get(ws, "annualBudgets", budgetId); }
  function reviewRequired(ws, budget) {
    return budget.status !== "draft" && !budget.approvalDecisionId && !budget.reconciliationDecisionId;
  }
  function writable(ws, budgetId) {
    var budget = year(ws, budgetId);
    if (reviewRequired(ws, budget) || budget.reviewRequired) throw new Error("Annual budget review required before financial changes.");
    if (budget.status !== "open") throw new Error("Financial changes require an open year.");
    return budget;
  }
  function optionsFor(options, request) {
    return { actor: request.recorder, reason: request.reason, date: request.effectiveDate, at: options.decisionAt || options.at || new Date().toISOString(), amount: request.amountCents / 100,
      kind: request.kind === "annual-adjustment" ? request.adjustmentKind : request.kind };
  }
  function request(input, spec) {
    var ws = UOS.ProgramModel.normalize(clone(input)), budget = year(ws, spec.budgetId);
    var recorder = text(spec.recorder || spec.actor), reason = text(spec.reason), evidence = text(spec.evidence || spec.evidenceRef);
    var effectiveDate = text(spec.effectiveDate || spec.date || new Date().toISOString().slice(0, 10));
    if (!recorder || !reason || !evidence) throw new Error("Recorder, reason, and evidence are required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) throw new Error("Effective date must be YYYY-MM-DD.");
    var amountCents = cents(spec.amount);
    if (spec.kind !== "annual-approval" && spec.kind !== "carry-forward" && spec.kind !== "annual-adjustment" && spec.kind !== "reconciliation" && spec.kind !== "allocation" && spec.kind !== "transfer" && spec.kind !== "charge" && spec.kind !== "release" && spec.kind !== "close" && spec.kind !== "reopen-authorisation") throw new Error("Unknown budget change kind.");
    if (["allocation", "transfer", "annual-adjustment", "charge", "release", "carry-forward"].indexOf(spec.kind) >= 0 && !amountCents) throw new Error("Change amount must be non-zero.");
    if (["allocation", "transfer", "annual-adjustment", "charge", "release", "carry-forward"].indexOf(spec.kind) >= 0) writable(ws, budget.id);
    if (spec.kind === "carry-forward") {
      var sourceAllocation = get(ws, "registerAllocations", spec.sourceAllocationId), priorYear = year(ws, sourceAllocation.budgetId);
      var latestReview = rows(ws, "budgetCarryReviews").filter(function (row) { return row.sourceAllocationId === sourceAllocation.id; }).slice(-1)[0];
      if (priorYear.status !== "closed" || reviewRequired(ws, priorYear) || sourceAllocation.owner !== budget.owner ||
          Number(budget.financialYear.slice(0, 4)) !== Number(priorYear.financialYear.slice(0, 4)) + 1 || !latestReview || latestReview.answer !== "Yes") throw new Error("Carry-forward requires a reconciled closed source year and recorded Yes review.");
      if (amountCents <= 0 || amountCents > newAllocationBalance(ws, sourceAllocation.id).availableCents) throw new Error("Carry-forward exceeds verified unused prior-year funds.");
    }
    var now = text(spec.createdAt || spec.at) || new Date().toISOString();
    var predecessorId = text(spec.predecessorId);
    if (!predecessorId && spec.kind === "allocation") {
      var priorAllocation = rows(ws, "registerAllocations").find(function (row) { return row.budgetId === budget.id && row.registerId === text(spec.registerId); });
      var priorEntries = rows(ws, "allocationEntries").filter(function (row) { return priorAllocation && row.allocationId === priorAllocation.id; });
      predecessorId = priorEntries.length ? priorEntries[priorEntries.length - 1].id : "";
    }
    if (!predecessorId && spec.kind === "annual-adjustment") {
      var priorBudgetEntries = rows(ws, "budgetEntries").filter(function (row) { return row.budgetId === budget.id; });
      predecessorId = priorBudgetEntries.length ? priorBudgetEntries[priorBudgetEntries.length - 1].id : "";
    }
    var item = { id: id(ws, budget.owner, "budgetChangeRequest", budget.id + ":" + now), owner: budget.owner, type: "budgetChangeRequest", budgetId: budget.id,
      kind: spec.kind, amountCents: amountCents, registerId: text(spec.registerId), targetRegisterId: text(spec.targetRegisterId), allocationId: text(spec.allocationId), jobId: text(spec.jobId), sourceAllocationId: text(spec.sourceAllocationId),
      adjustmentKind: text(spec.adjustmentKind), chargeKind: text(spec.chargeKind), predecessorId: predecessorId, recorder: recorder, reason: reason, evidence: evidence,
      effectiveDate: effectiveDate, createdAt: now, status: "pending", provenance: { owner: budget.owner, sourceApp: UOS.ProgramModel.appId, sourceVersion: UOS.ProgramModel.schemaVersion, sourceId: budget.id, importedAt: now } };
    rows(ws, "budgetChangeRequests").push(item);
    return UOS.ProgramModel.normalize(ws);
  }
  function enrich(ws, before, decision, requestRow) {
    ["budgetEntries", "allocationEntries", "budgetCharges"].forEach(function (collection) {
      var prior = new Set(rows(before, collection).map(function (row) { return row.id; }));
      rows(ws, collection).forEach(function (entry) {
        if (prior.has(entry.id)) return;
        entry.amountCents = collection === "budgetEntries" && entry.kind === "approval" ? requestRow.amountCents : cents(entry.amount);
        if (entry.kind === "approval") entry.amount = entry.amountCents / 100;
        entry.requestId = requestRow.id;
        entry.decisionId = decision.id;
        entry.decisionAt = decision.decidedAt;
        entry.decisionSequence = decision.sequence;
        entry.recorder = requestRow.recorder;
        entry.approver = decision.approver;
        entry.evidence = decision.evidence;
        entry.predecessorId = requestRow.predecessorId;
        var allocation = entry.allocationId && rows(ws, "registerAllocations").find(function (row) { return row.id === entry.allocationId; });
        var snapshot = reference(ws, (allocation && allocation.registerId) || requestRow.registerId || "");
        entry.registerId = snapshot.registerId;
        entry.referenceNumber = snapshot.referenceNumber;
        entry.referenceNumberStatus = snapshot.referenceNumberStatus;
        entry.governanceVersion = 1;
      });
    });
  }
  function decide(input, requestId, decisionOptions) {
    var ws = UOS.ProgramModel.normalize(clone(input)), req = get(ws, "budgetChangeRequests", requestId), budget = year(ws, req.budgetId);
    if (rows(ws, "budgetDecisions").some(function (row) { return row.requestId === req.id; })) throw new Error("Change request already decided.");
    var approved = decisionOptions.decision === "approved" || decisionOptions.approved === true;
    if (!approved && decisionOptions.decision !== "rejected") throw new Error("Record an approval or rejection decision.");
    var approver = text(decisionOptions.approver || decisionOptions.actor), evidence = text(decisionOptions.evidence || req.evidence);
    if (!approver || !evidence) throw new Error("Named approver and decision evidence required.");
    var when = text(decisionOptions.decisionAt || decisionOptions.at) || new Date().toISOString();
    var sequence = rows(ws, "budgetDecisions").filter(function (row) { return row.budgetId === budget.id; }).reduce(function (max, row) { return Math.max(max, Number(row.sequence) || 0); }, 0) + 1;
    var decision = { id: id(ws, budget.owner, "budgetDecision", req.id + ":" + when), owner: budget.owner, type: "budgetDecision", budgetId: budget.id,
      requestId: req.id, decision: approved ? "approved" : "rejected", sequence: sequence, approver: approver, recorder: req.recorder, reason: text(decisionOptions.reason || req.reason), evidence: evidence,
      decidedAt: when, predecessorId: req.predecessorId, provenance: { owner: budget.owner, sourceApp: UOS.ProgramModel.appId, sourceVersion: UOS.ProgramModel.schemaVersion, sourceId: req.id, importedAt: when } };
    if (!approved) { rows(ws, "budgetDecisions").push(decision); return UOS.ProgramModel.normalize(ws); }
    var before = clone(ws), opts = optionsFor(decisionOptions, req), updated;
    postingDepth += 1;
    try {
    if (req.kind === "annual-approval") updated = base.approveAnnualBudget(ws, req.budgetId, opts);
    else if (req.kind === "annual-adjustment") updated = base.adjustAnnualBudget(ws, req.budgetId, opts);
    else if (req.kind === "allocation") updated = base.adjustAllocation(ws, req.budgetId, req.registerId, opts);
    else if (req.kind === "charge") updated = base.chargeJob(ws, req.allocationId, req.jobId, Object.assign(opts, { kind: req.chargeKind }));
    else if (req.kind === "release") updated = base.releaseJobCommitment(ws, req.allocationId, req.jobId, opts);
    else if (req.kind === "close") updated = base.closeYear(ws, req.budgetId, opts);
    else if (req.kind === "reopen-authorisation") {
      if (budget.status !== "closed") throw new Error("Reopen decision requires a closed year.");
      updated = ws;
    }
    else if (req.kind === "carry-forward") {
      var source = get(ws, "registerAllocations", req.sourceAllocationId);
      var sourceYear = get(ws, "annualBudgets", source.budgetId);
      if (sourceYear.status !== "closed") throw new Error("Carry-forward source year must remain closed.");
      if (reviewRequired(ws, sourceYear)) throw new Error("Reconcile the source year before carry-forward approval.");
      var latestReview = rows(ws, "budgetCarryReviews").filter(function (row) { return row.sourceAllocationId === source.id; }).slice(-1)[0];
      if (!latestReview || latestReview.answer !== "Yes") throw new Error("Carry-forward needs a current Yes review.");
      updated = base.carryForward(ws, req.sourceAllocationId, req.budgetId, opts);
    } else if (req.kind === "transfer") {
      var sourceAllocation = rows(ws, "registerAllocations").find(function (row) { return row.budgetId === req.budgetId && row.registerId === req.registerId; });
      if (!sourceAllocation) throw new Error("Transfer source allocation not found.");
      if (req.amountCents <= 0 || req.registerId === req.targetRegisterId) throw new Error("Transfer requires a positive amount and different Register records.");
      updated = base.adjustAllocation(ws, req.budgetId, req.registerId, Object.assign({}, opts, { amount: -req.amountCents / 100 }));
      updated = base.adjustAllocation(updated, req.budgetId, req.targetRegisterId, Object.assign({}, opts, { amount: req.amountCents / 100 }));
    } else if (req.kind === "reconciliation") {
      if (!reviewRequired(ws, budget)) throw new Error("This annual budget does not require reconciliation.");
      updated = ws;
    } else throw new Error("Unsupported budget change request.");
    } finally { postingDepth -= 1; }
    rows(updated, "budgetDecisions").push(decision);
    if (req.kind === "annual-approval") { year(updated, req.budgetId).approvalDecisionId = decision.id; year(updated, req.budgetId).approvedAmountCents = req.amountCents; }
    if (req.kind === "reconciliation") { year(updated, req.budgetId).reconciliationDecisionId = decision.id; year(updated, req.budgetId).reviewRequired = false; }
    if (req.kind === "transfer") {
      var newEntries = rows(updated, "allocationEntries").filter(function (row) { return !rows(before, "allocationEntries").some(function (old) { return old.id === row.id; }); });
      if (newEntries.length !== 2 || cents(newEntries[0].amount) + cents(newEntries[1].amount) !== 0) throw new Error("Transfer legs did not balance.");
      newEntries.forEach(function (entry, index) { entry.transferId = decision.id; entry.counterpartEntryId = newEntries[1 - index].id; });
    }
    enrich(updated, before, decision, req);
    updated.migration = updated.migration || {};
    updated.migration.budgetGovernanceVersion = 1;
    var fy = budget.financialYear, updatedYear = year(updated, req.budgetId);
    updatedYear.yearStart = fy.slice(0, 4) + "-07-01";
    updatedYear.yearEnd = "20" + fy.slice(5) + "-06-30";
    updatedYear.approvalState = updatedYear.status === "draft" ? "draft" : "approved";
    updatedYear.yearState = updatedYear.status === "closed" ? "closed" : "open";
    updatedYear.reviewRequired = reviewRequired(updated, updatedYear);
    return UOS.ProgramModel.normalize(updated);
  }
  function oneForm(input, kind, budgetId, details) {
    var spec = Object.assign({}, details, { kind: kind, budgetId: budgetId, recorder: details.recorder || details.actor, evidence: details.evidence || details.reason,
      effectiveDate: details.effectiveDate || details.date, amount: details.amount == null ? 0 : details.amount });
    var pending = request(input, spec);
    if (details.saveDraft || details.decision === "draft") return pending;
    var req = rows(pending, "budgetChangeRequests").slice(-1)[0];
    return decide(pending, req.id, { decision: details.decision === "rejected" ? "rejected" : "approved", approver: details.approver || details.actor,
      evidence: details.evidence || details.reason, decisionAt: details.decisionAt || details.at });
  }
  function reviewCarry(input, sourceAllocationId, answer, options) {
    var ws = UOS.ProgramModel.normalize(clone(input)), source = get(ws, "registerAllocations", sourceAllocationId), sourceYear = year(ws, source.budgetId);
    if (sourceYear.status !== "closed") throw new Error("Carry-forward review requires a closed source year.");
    if (answer !== "Yes" && answer !== "No") throw new Error("Record Yes or No for carry-forward.");
    if (!text(options.actor || options.recorder) || !text(options.reason)) throw new Error("Named recorder and reason required.");
    var at = text(options.at) || new Date().toISOString();
    rows(ws, "budgetCarryReviews").push({ id: id(ws, source.owner, "budgetCarryReview", source.id + ":" + at), owner: source.owner, type: "budgetCarryReview",
      sourceBudgetId: source.budgetId, sourceAllocationId: source.id, registerId: source.registerId, answer: answer, recorder: text(options.recorder || options.actor), reason: text(options.reason),
      evidence: text(options.evidence), recordedAt: at, provenance: { owner: source.owner, sourceApp: UOS.ProgramModel.appId, sourceVersion: UOS.ProgramModel.schemaVersion, sourceId: source.id, importedAt: at } });
    return UOS.ProgramModel.normalize(ws);
  }
  function carry(input, sourceAllocationId, destinationBudgetId, options) {
    var ws = UOS.ProgramModel.normalize(clone(input)), source = get(ws, "registerAllocations", sourceAllocationId);
    if (reviewRequired(ws, year(ws, source.budgetId))) throw new Error("Reconcile the source year before proposing carry-forward.");
    var review = rows(ws, "budgetCarryReviews").filter(function (row) { return row.sourceAllocationId === source.id; }).slice(-1)[0];
    if (!review || review.answer !== "Yes") throw new Error("Record a Yes carry-forward review before proposing funds.");
    if (!text(options.verifiedUnspentEvidence || options.evidence)) throw new Error("Verified unspent evidence is required.");
    return oneForm(ws, "carry-forward", destinationBudgetId, Object.assign({}, options, { sourceAllocationId: source.id, registerId: source.registerId, evidence: options.verifiedUnspentEvidence || options.evidence }));
  }
  function reopen(input, budgetId, options) {
    var ws = UOS.ProgramModel.normalize(clone(input)), budget = year(ws, budgetId);
    if (budget.status !== "closed") throw new Error("Only a closed year can reopen.");
    if (reviewRequired(ws, budget)) throw new Error("Reconcile the legacy year before reopening.");
    var decision = rows(ws, "budgetDecisions").find(function (row) { return row.id === text(options.decisionId) && row.budgetId === budget.id && row.decision === "approved" &&
      get(ws, "budgetChangeRequests", row.requestId).kind === "reopen-authorisation"; });
    if (!decision) throw new Error("A separately recorded reopen decision is required.");
    if (rows(ws, "budgetEntries").some(function (row) { return row.kind === "reopen" && row.decisionId === decision.id; })) throw new Error("Reopen decision already used.");
    var req = get(ws, "budgetChangeRequests", decision.requestId), before = clone(ws);
    var updated = ws, postedAt = new Date().toISOString();
    year(updated, budget.id).status = "open";
    rows(updated, "budgetEntries").push({ id: id(updated, budget.owner, "budgetEntry", budget.id + ":reopen:" + postedAt), owner: budget.owner, type: "budgetEntry",
      budgetId: budget.id, kind: "reopen", amount: 0, actor: req.recorder, reason: req.reason, effectiveDate: req.effectiveDate, createdAt: postedAt,
      provenance: { owner: budget.owner, sourceApp: UOS.ProgramModel.appId, sourceVersion: UOS.ProgramModel.schemaVersion, sourceId: budget.id, importedAt: postedAt } });
    year(updated, budget.id).reopenDecisionId = decision.id;
    enrich(updated, before, decision, req);
    updated.migration = updated.migration || {};
    updated.migration.budgetGovernanceVersion = 1;
    return UOS.ProgramModel.normalize(updated);
  }
  function newBalance(input, budgetId) {
    var budget = year(input, budgetId);
    var adjustments = rows(input, "budgetEntries").filter(function (row) { return row.budgetId === budgetId && ["supplement", "reduction", "carryForward"].includes(row.kind); });
    var approved = (budget.approvedAmountCents == null ? Math.round(Number(budget.approvedAmount || 0) * 100) : budget.approvedAmountCents) + sumCents(adjustments);
    var ids = rows(input, "registerAllocations").filter(function (row) { return row.budgetId === budgetId; }).map(function (row) { return row.id; });
    var allocated = sumCents(rows(input, "allocationEntries").filter(function (row) { return ids.includes(row.allocationId); }));
    return { budgetId: budget.id, owner: budget.owner, financialYear: budget.financialYear, status: budget.status,
      approved: approved / 100, allocated: allocated / 100, unallocated: (approved - allocated) / 100, approvedCents: approved, allocatedCents: allocated, unallocatedCents: approved - allocated,
      availableCents: approved - allocated, available: (approved - allocated) / 100, reviewRequired: reviewRequired(input, year(input, budgetId)) };
  }
  function newAllocationBalance(input, allocationId) {
    var allocation = get(input, "registerAllocations", allocationId);
    var allocated = sumCents(rows(input, "allocationEntries").filter(function (row) { return row.allocationId === allocationId; }));
    var charges = rows(input, "budgetCharges").filter(function (row) { return row.allocationId === allocationId; });
    var committed = sumCents(charges.filter(function (row) { return row.kind === "commitment"; })) - sumCents(charges.filter(function (row) { return row.kind === "release"; }));
    var actual = sumCents(charges.filter(function (row) { return row.kind === "actual"; }));
    var carried = sumCents(rows(input, "allocationEntries").filter(function (row) { return row.kind === "carryForward" && row.sourceAllocationId === allocationId; }));
    var projectIds = rows(input, "projects").filter(function (row) { return row.owner === allocation.owner && (row.applicationId === allocation.registerId || row.eventId === allocation.registerId); }).map(function (row) { return row.id; });
    var plannedCostCents = 0, forecastCents = 0;
    var allocationYear = year(input, allocation.budgetId).financialYear;
    rows(input, "jobs").filter(function (job) {
      return job.owner === allocation.owner && projectIds.includes(job.projectId) &&
        (job.financialYear === allocationYear || charges.some(function (charge) { return charge.jobId === job.id; }));
    }).forEach(function (job) {
      var estimate = Math.round(Number(job.estimate || 0) * 100);
      plannedCostCents += estimate;
      var jobCharges = charges.filter(function (row) { return row.jobId === job.id; });
      var outstanding = sumCents(jobCharges.filter(function (row) { return row.kind === "commitment"; })) - sumCents(jobCharges.filter(function (row) { return row.kind === "release"; }));
      var bookedActual = sumCents(jobCharges.filter(function (row) { return row.kind === "actual"; }));
      forecastCents += Math.max(0, estimate - outstanding - bookedActual);
    });
    return { allocationId: allocation.id, budgetId: allocation.budgetId, registerId: allocation.registerId,
      allocated: allocated / 100, openCommitment: committed / 100, actual: actual / 100, carriedForward: carried / 100, forecast: forecastCents / 100, plannedCost: plannedCostCents / 100,
      allocatedCents: allocated, committedCents: committed, actualCents: actual, forecastCents: forecastCents, plannedCostCents: plannedCostCents,
      availableCents: allocated - committed - actual - carried, available: (allocated - committed - actual - carried) / 100 };
  }
  function errors(ws) {
    var result = base.validationErrors(ws), requests = rows(ws, "budgetChangeRequests"), decisions = rows(ws, "budgetDecisions");
    var legacyIds = new Set(ws.migration && ws.migration.legacyBudgetEntryIds || []);
    if (!postingDepth) ["budgetEntries", "allocationEntries", "budgetCharges"].forEach(function (name) {
      rows(ws, name).forEach(function (entry) {
        if (!entry.governanceVersion && !legacyIds.has(entry.id)) result.push(entry.id + " new ledger entry lacks an approved decision.");
      });
    });
    rows(ws, "annualBudgets").forEach(function (budget) {
      if (!Number.isSafeInteger(budget.approvedAmountCents) || budget.approvedAmountCents !== Math.round(Number(budget.approvedAmount || 0) * 100)) result.push(budget.id + " approved authority cents mismatch.");
      if (budget.approvalDecisionId) {
        var approval = decisions.find(function (row) { return row.id === budget.approvalDecisionId && row.decision === "approved"; });
        var approvalRequest = approval && requests.find(function (row) { return row.id === approval.requestId && row.kind === "annual-approval" && row.budgetId === budget.id; });
        if (!approvalRequest || approvalRequest.amountCents !== budget.approvedAmountCents) result.push(budget.id + " approval decision mismatch.");
      }
      var balance = newBalance(ws, budget.id);
      if (balance.approvedCents < 0 || balance.unallocatedCents < 0) result.push(budget.id + " exceeds exact-cent annual authority.");
    });
    rows(ws, "registerAllocations").forEach(function (allocation) {
      var balance = newAllocationBalance(ws, allocation.id);
      if (balance.availableCents < 0 || balance.committedCents < 0) result.push(allocation.id + " violates protected commitment or actual cents.");
    });
    rows(ws, "annualBudgets").forEach(function (budget) {
      var stateEntries = rows(ws, "budgetEntries").filter(function (row) { return row.budgetId === budget.id && row.governanceVersion && ["close", "reopen"].includes(row.kind); }).sort(function (a, b) { return a.decisionSequence - b.decisionSequence; });
      var allocationIds = rows(ws, "registerAllocations").filter(function (row) { return row.budgetId === budget.id; }).map(function (row) { return row.id; });
      var financialEntries = rows(ws, "budgetEntries").filter(function (row) { return row.budgetId === budget.id && !["close", "reopen"].includes(row.kind); })
        .concat(rows(ws, "allocationEntries").filter(function (row) { return row.budgetId === budget.id; }), rows(ws, "budgetCharges").filter(function (row) { return allocationIds.includes(row.allocationId); }));
      financialEntries.filter(function (row) { return row.governanceVersion && Number.isInteger(row.decisionSequence); }).forEach(function (entry) {
        var prior = stateEntries.filter(function (row) { return row.decisionSequence < entry.decisionSequence; }).slice(-1)[0];
        if (prior && prior.kind === "close") result.push(entry.id + " posted during closed year.");
      });
      var allStateEntries = rows(ws, "budgetEntries").filter(function (row) { return row.budgetId === budget.id && ["close", "reopen"].includes(row.kind); });
      if (allStateEntries.length && budget.status !== (allStateEntries[allStateEntries.length - 1].kind === "close" ? "closed" : "open")) result.push(budget.id + " closure history disagrees with year state.");
    });
    requests.forEach(function (req) {
      if (!rows(ws, "annualBudgets").some(function (row) { return row.id === req.budgetId && row.owner === req.owner; }) || !Number.isSafeInteger(req.amountCents) || !req.recorder || !req.reason || !req.evidence || !req.effectiveDate) result.push(req.id + " invalid budget request.");
      if (decisions.filter(function (row) { return row.requestId === req.id; }).length > 1) result.push(req.id + " has multiple decisions.");
    });
    decisions.forEach(function (decision) {
      var req = requests.find(function (row) { return row.id === decision.requestId; });
      if (!req || req.owner !== decision.owner || !["approved", "rejected"].includes(decision.decision) || !decision.approver || !decision.decidedAt) result.push(decision.id + " invalid budget decision.");
    });
    ["budgetEntries", "allocationEntries", "budgetCharges"].forEach(function (name) {
      rows(ws, name).forEach(function (entry) {
        if (!entry.governanceVersion) return;
        var decision = decisions.find(function (row) { return row.id === entry.decisionId && row.decision === "approved"; });
        if (!decision || decision.requestId !== entry.requestId || decision.sequence !== entry.decisionSequence || !Number.isSafeInteger(entry.amountCents) || cents(entry.amount) !== entry.amountCents || !entry.requestId || !entry.referenceNumberStatus) result.push(entry.id + " invalid governed ledger entry.");
        if (entry.registerId && !rows(ws, "applications").concat(rows(ws, "events")).some(function (row) { return row.id === entry.registerId && row.owner === entry.owner; })) result.push(entry.id + " invalid Register reference.");
      });
    });
    rows(ws, "allocationEntries").filter(function (row) { return row.transferId; }).forEach(function (entry) {
      var other = rows(ws, "allocationEntries").find(function (row) { return row.id === entry.counterpartEntryId; });
      if (!other || other.counterpartEntryId !== entry.id || other.transferId !== entry.transferId || entry.amountCents + other.amountCents !== 0) result.push(entry.id + " incomplete transfer.");
    });
    var jobs = {};
    rows(ws, "budgetCharges").forEach(function (entry) {
      var key = entry.allocationId + ":" + entry.jobId;
      var balance = jobs[key] || (jobs[key] = { committed: 0, released: 0 });
      if (entry.kind === "commitment") balance.committed += entry.amountCents == null ? cents(entry.amount) : entry.amountCents;
      if (entry.kind === "release") balance.released += entry.amountCents == null ? cents(entry.amount) : entry.amountCents;
    });
    Object.keys(jobs).forEach(function (key) {
      if (jobs[key].released > jobs[key].committed) result.push(key + " Job release exceeds its commitment.");
    });
    return result;
  }
  function transition(before, after) {
    base.assertTransition(before, after);
    if (JSON.stringify(before.migration && before.migration.legacyBudgetEntryIds || []) !== JSON.stringify(after.migration && after.migration.legacyBudgetEntryIds || [])) throw new Error("Legacy budget ledger baseline is immutable.");
    ["budgetEntries", "allocationEntries", "budgetCharges"].forEach(function (name) {
      rows(after, name).filter(function (row) { return !rows(before, name).some(function (old) { return old.id === row.id; }); }).forEach(function (row) {
        if (!row.governanceVersion) throw new Error(name + " posting requires an approved decision.");
      });
    });
    ["budgetChangeRequests", "budgetDecisions", "budgetCarryReviews"].forEach(function (name) {
      rows(before, name).forEach(function (old) {
        var current = rows(after, name).find(function (row) { return row.id === old.id; });
        if (!current || JSON.stringify(current) !== JSON.stringify(old)) throw new Error(name + " history is immutable.");
      });
    });
    rows(before, "annualBudgets").forEach(function (old) {
      if (!reviewRequired(before, old)) return;
      var next = rows(after, "annualBudgets").find(function (row) { return row.id === old.id; });
      var newDecision = rows(after, "budgetDecisions").find(function (row) { return row.id === next.reconciliationDecisionId && row.decision === "approved" && !rows(before, "budgetDecisions").some(function (prior) { return prior.id === row.id; }); });
      if (!newDecision && JSON.stringify(next) !== JSON.stringify(old)) throw new Error("Review required year cannot change before recorded reconciliation.");
    });
  }
  UOS.ProgramBudget = Object.assign({}, base, {
    cents: cents, referenceSnapshot: reference, reviewRequired: reviewRequired, proposeChange: request, decideRequest: decide,
    allocateOrDraft: function (ws, budgetId, registerId, options) { return oneForm(ws, "allocation", budgetId, Object.assign({}, options, { registerId: registerId })); },
    transferAllocation: function (ws, budgetId, sourceId, targetId, options) { return oneForm(ws, "transfer", budgetId, Object.assign({}, options, { registerId: sourceId, targetRegisterId: targetId })); },
    recordCarryReview: reviewCarry, carryForward: carry,
    approveAnnualBudget: function (ws, budgetId, options) { return oneForm(ws, "annual-approval", budgetId, options); },
    adjustAnnualBudget: function (ws, budgetId, options) { return oneForm(ws, "annual-adjustment", budgetId, Object.assign({}, options, { adjustmentKind: options.kind })); },
    adjustAllocation: function (ws, budgetId, registerId, options) { return oneForm(ws, "allocation", budgetId, Object.assign({}, options, { registerId: registerId })); },
    chargeJob: function (ws, allocationId, jobId, options) { var allocation = get(ws, "registerAllocations", allocationId); return oneForm(ws, "charge", allocation.budgetId, Object.assign({}, options, { allocationId: allocationId, jobId: jobId, chargeKind: options.kind })); },
    releaseJobCommitment: function (ws, allocationId, jobId, options) { var allocation = get(ws, "registerAllocations", allocationId); return oneForm(ws, "release", allocation.budgetId, Object.assign({}, options, { allocationId: allocationId, jobId: jobId })); },
    closeYear: function (ws, budgetId, options) { return oneForm(ws, "close", budgetId, options); },
    recordReopenDecision: function (ws, budgetId, options) { return oneForm(ws, "reopen-authorisation", budgetId, options); },
    reopenYear: reopen,
    reconcileYear: function (ws, budgetId, options) { return oneForm(ws, "reconciliation", budgetId, options); },
    budgetBalance: newBalance, allocationBalance: newAllocationBalance, validationErrors: errors, assertTransition: transition
  });
}());
