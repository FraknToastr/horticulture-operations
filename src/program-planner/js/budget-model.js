(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {};
  function text(value) { return String(value == null ? "" : value).trim(); }
  function cents(value) { var n = Number(value); return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) : NaN; }
  function money(value) { return cents(value) / 100; }
  function sum(values, field) { return values.reduce(function (total, item) { return total + cents(item[field] || 0); }, 0); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function model() { return UOS.ProgramModel; }
  function workspace(input) { return model().normalize(clone(input)); }
  function at(options) { return text(options && options.at) || new Date().toISOString(); }
  function date(options) { return text(options && options.date) || at(options).slice(0, 10); }
  function authority(options) {
    if (!text(options && options.actor) || !text(options && options.reason)) throw new Error("A named operator and reason are required.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date(options))) throw new Error("Effective date must be YYYY-MM-DD.");
  }
  function find(items, id, label) { var item = items.find(function (entry) { return entry.id === text(id); }); if (!item) throw new Error(label + " not found."); return item; }
  function recordFor(ws, id) { return ws.entities.applications.concat(ws.entities.events).find(function (item) { return item.id === id; }); }
  function budgetFor(ws, owner, financialYear) { return ws.entities.annualBudgets.find(function (item) { return item.owner === owner && item.financialYear === financialYear; }) || null; }
  function nextId(ws, owner, type, seed) {
    var index = 0, id;
    do { id = model().stableId(owner, type, seed + ":" + index); index += 1; }
    while (Object.keys(ws.entities).some(function (key) { return ws.entities[key].some(function (item) { return item.id === id; }); }));
    return id;
  }
  function entry(ws, collection, type, owner, values, options) {
    var createdAt = at(options);
    var item = Object.assign({
      id: nextId(ws, owner, type, [collection, values.budgetId || values.allocationId, createdAt, values.kind, values.amount].join(":")),
      owner: owner, type: type, actor: text(options.actor), reason: text(options.reason),
      effectiveDate: date(options), createdAt: createdAt,
      provenance: { owner: owner, sourceApp: model().appId, sourceVersion: model().schemaVersion, sourceId: collection, importedAt: createdAt }
    }, values);
    ws.entities[collection].push(item);
    return item;
  }
  function budgetBalance(ws, budgetId) {
    var budget = find(ws.entities.annualBudgets, budgetId, "Annual budget");
    var entries = ws.entities.budgetEntries.filter(function (item) { return item.budgetId === budget.id && ["supplement", "reduction", "carryForward"].indexOf(item.kind) >= 0; });
    var allocations = ws.entities.registerAllocations.filter(function (item) { return item.budgetId === budget.id; });
    var allocated = allocations.reduce(function (total, allocation) { return total + allocationCents(ws, allocation.id); }, 0);
    var approved = cents(budget.approvedAmount) + sum(entries, "amount");
    return { budgetId: budget.id, owner: budget.owner, financialYear: budget.financialYear, status: budget.status, approved: approved / 100, allocated: allocated / 100, unallocated: (approved - allocated) / 100 };
  }
  function allocationCents(ws, allocationId) {
    return sum(ws.entities.allocationEntries.filter(function (item) { return item.allocationId === allocationId; }), "amount");
  }
  function carriedCents(ws, allocationId) {
    return sum(ws.entities.allocationEntries.filter(function (item) { return item.kind === "carryForward" && item.sourceAllocationId === allocationId; }), "amount");
  }
  function allocationBalance(ws, allocationId) {
    var allocation = find(ws.entities.registerAllocations, allocationId, "Register allocation");
    var charges = ws.entities.budgetCharges.filter(function (item) { return item.allocationId === allocation.id; });
    var openCommitment = sum(charges.filter(function (item) { return item.kind === "commitment"; }), "amount") - sum(charges.filter(function (item) { return item.kind === "release"; }), "amount");
    var actual = sum(charges.filter(function (item) { return item.kind === "actual"; }), "amount");
    var allocated = allocationCents(ws, allocation.id), carried = carriedCents(ws, allocation.id);
    return { allocationId: allocation.id, budgetId: allocation.budgetId, registerId: allocation.registerId,
      allocated: allocated / 100, openCommitment: openCommitment / 100, actual: actual / 100,
      carriedForward: carried / 100, available: (allocated - openCommitment - actual - carried) / 100 };
  }
  function commit(ws) { ws.updatedAt = new Date().toISOString(); return model().normalize(ws); }
  function createAnnualBudget(input, options) {
    var ws = workspace(input), owner = text(options.owner), year = text(options.financialYear);
    if (["NSA", "EVT"].indexOf(owner) < 0 || !/^\d{4}-\d{2}$/.test(year) || Number(year.slice(5)) !== (Number(year.slice(0, 4)) + 1) % 100) throw new Error("Choose an owner and consecutive July–June financial year.");
    if (model().owner && owner !== model().owner) throw new Error("Budget owner is outside this workspace.");
    if (budgetFor(ws, owner, year)) throw new Error("An annual budget already exists for this owner and year.");
    var createdAt = at(options);
    ws.entities.annualBudgets.push({ id: nextId(ws, owner, "annualBudget", year), owner: owner, type: "annualBudget", financialYear: year,
      status: "draft", approvedAmount: 0, approvedBy: "", approvedAt: "", createdAt: createdAt,
      provenance: { owner: owner, sourceApp: model().appId, sourceVersion: model().schemaVersion, sourceId: year, importedAt: createdAt } });
    return commit(ws);
  }
  function approveAnnualBudget(input, budgetId, options) {
    var ws = workspace(input), budget = find(ws.entities.annualBudgets, budgetId, "Annual budget"), amount = cents(options.amount);
    authority(options);
    if (budget.status !== "draft") throw new Error("Only a draft budget can be approved.");
    if (!Number.isInteger(amount) || amount < 0) throw new Error("Approved amount must be non-negative.");
    budget.approvedAmount = amount / 100; budget.approvedAmountCents = amount; budget.approvedBy = text(options.actor); budget.approvedAt = at(options); budget.status = "open";
    entry(ws, "budgetEntries", "budgetEntry", budget.owner, { budgetId: budget.id, kind: "approval", amount: 0 }, options);
    return commit(ws);
  }
  function adjustAnnualBudget(input, budgetId, options) {
    var ws = workspace(input), budget = find(ws.entities.annualBudgets, budgetId, "Annual budget"), amount = cents(options.amount);
    authority(options);
    if (budget.status !== "open") throw new Error("Only an open budget can be adjusted.");
    if (!Number.isInteger(amount) || !amount || ["supplement", "reduction"].indexOf(options.kind) < 0 || (options.kind === "supplement" && amount < 0) || (options.kind === "reduction" && amount > 0)) throw new Error("Enter a signed supplement or reduction.");
    if (budgetBalance(ws, budget.id).unallocated * 100 + amount < 0) throw new Error("Budget reduction would exceed unallocated funds.");
    entry(ws, "budgetEntries", "budgetEntry", budget.owner, { budgetId: budget.id, kind: options.kind, amount: amount / 100 }, options);
    return commit(ws);
  }
  function adjustAllocation(input, budgetId, registerId, options) {
    var ws = workspace(input), budget = find(ws.entities.annualBudgets, budgetId, "Annual budget"), record = recordFor(ws, text(registerId)), amount = cents(options.amount);
    authority(options);
    if (budget.status !== "open") throw new Error("Allocations require an open budget.");
    if (!record || record.owner !== budget.owner) throw new Error("Register record must belong to the budget owner.");
    if (!Number.isInteger(amount) || !amount) throw new Error("Allocation change must be non-zero.");
    if (amount > 0 && budgetBalance(ws, budget.id).unallocated * 100 < amount) throw new Error("Allocation exceeds unallocated annual funds.");
    var allocation = ws.entities.registerAllocations.find(function (item) { return item.budgetId === budget.id && item.registerId === record.id; });
    if (!allocation && amount < 0) throw new Error("No allocation exists to reduce.");
    if (!allocation) {
      var createdAt = at(options);
      allocation = { id: nextId(ws, budget.owner, "registerAllocation", budget.id + ":" + record.id), owner: budget.owner, type: "registerAllocation", budgetId: budget.id, registerId: record.id, createdAt: createdAt,
        provenance: { owner: budget.owner, sourceApp: model().appId, sourceVersion: model().schemaVersion, sourceId: record.id, importedAt: createdAt } };
      ws.entities.registerAllocations.push(allocation);
    }
    if (amount < 0 && allocationBalance(ws, allocation.id).available * 100 + amount < 0) throw new Error("Reduction exceeds uncommitted allocation.");
    entry(ws, "allocationEntries", "allocationEntry", budget.owner, { budgetId: budget.id, allocationId: allocation.id, kind: amount > 0 ? "increase" : "decrease", amount: amount / 100, sourceAllocationId: "" }, options);
    return commit(ws);
  }
  function chargeJob(input, allocationId, jobId, options) {
    var ws = workspace(input), allocation = find(ws.entities.registerAllocations, allocationId, "Register allocation"), budget = find(ws.entities.annualBudgets, allocation.budgetId, "Annual budget"), job = find(ws.entities.jobs, jobId, "Job"), amount = cents(options.amount), kind = text(options.kind);
    authority(options);
    if (budget.status !== "open") throw new Error("Charges require an open budget.");
    if (!["commitment", "actual"].includes(kind) || !Number.isInteger(amount) || amount <= 0) throw new Error("Choose a positive commitment or actual charge.");
    var project = find(ws.entities.projects, job.projectId, "Project");
    if (text(project.applicationId || project.eventId) !== allocation.registerId || job.owner !== allocation.owner) throw new Error("Job and allocation must belong to the same Register record.");
    var jobCharges = ws.entities.budgetCharges.filter(function (item) { return item.allocationId === allocation.id && item.jobId === job.id; });
    var jobOutstanding = sum(jobCharges.filter(function (item) { return item.kind === "commitment"; }), "amount") - sum(jobCharges.filter(function (item) { return item.kind === "release"; }), "amount");
    var old = allocationBalance(ws, allocation.id), release = kind === "actual" ? Math.min(jobOutstanding, amount) : 0;
    if (cents(old.available) + release < amount) throw new Error("Charge exceeds available Register allocation.");
    var priorActual = sum(ws.entities.budgetCharges.filter(function (item) { return item.jobId === job.id && item.kind === "actual"; }), "amount");
    if (kind === "actual" && (job.actualCost == null || priorActual + amount > cents(job.actualCost))) throw new Error("Actual charges require a recorded Job actual cost and cannot exceed it.");
    if (kind === "commitment") {
      var priorCommitment = sum(ws.entities.budgetCharges.filter(function (item) { return item.jobId === job.id && item.kind === "commitment"; }), "amount");
      if (priorCommitment + amount > cents(job.estimate)) throw new Error("Commitments cannot exceed the Job estimate.");
    }
    if (release) entry(ws, "budgetCharges", "budgetCharge", budget.owner, { allocationId: allocation.id, jobId: job.id, kind: "release", amount: release / 100 }, options);
    entry(ws, "budgetCharges", "budgetCharge", budget.owner, { allocationId: allocation.id, jobId: job.id, kind: kind, amount: amount / 100 }, options);
    return commit(ws);
  }
  function releaseJobCommitment(input, allocationId, jobId, options) {
    var ws = workspace(input), allocation = find(ws.entities.registerAllocations, allocationId, "Register allocation"), budget = find(ws.entities.annualBudgets, allocation.budgetId, "Annual budget"), job = find(ws.entities.jobs, jobId, "Job"), amount = cents(options.amount);
    authority(options);
    if (budget.status !== "open") throw new Error("Commitment releases require an open budget.");
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("Release amount must be positive.");
    var charges = ws.entities.budgetCharges.filter(function (item) { return item.allocationId === allocation.id && item.jobId === job.id; });
    var open = sum(charges.filter(function (item) { return item.kind === "commitment"; }), "amount") - sum(charges.filter(function (item) { return item.kind === "release"; }), "amount");
    if (amount > open) throw new Error("Release exceeds the Job's open commitment in this year.");
    entry(ws, "budgetCharges", "budgetCharge", budget.owner, { allocationId: allocation.id, jobId: job.id, kind: "release", amount: amount / 100 }, options);
    return commit(ws);
  }
  function changeYearState(input, budgetId, options, reopen) {
    var ws = workspace(input), budget = find(ws.entities.annualBudgets, budgetId, "Annual budget");
    authority(options);
    if (budget.status !== (reopen ? "closed" : "open")) throw new Error("Budget is not in the required state.");
    budget.status = reopen ? "open" : "closed";
    entry(ws, "budgetEntries", "budgetEntry", budget.owner, { budgetId: budget.id, kind: reopen ? "reopen" : "close", amount: 0 }, options);
    return commit(ws);
  }
  function carryForward(input, sourceAllocationId, destinationBudgetId, options) {
    var ws = workspace(input), source = find(ws.entities.registerAllocations, sourceAllocationId, "Source allocation"), from = find(ws.entities.annualBudgets, source.budgetId, "Source budget"), to = find(ws.entities.annualBudgets, destinationBudgetId, "Destination budget"), amount = cents(options.amount);
    authority(options);
    if (from.status !== "closed" || to.status !== "open" || from.owner !== to.owner || Number(to.financialYear.slice(0, 4)) !== Number(from.financialYear.slice(0, 4)) + 1) throw new Error("Carry-forward requires a closed source year and the next open year for the same owner.");
    if (!Number.isInteger(amount) || amount <= 0 || amount > cents(allocationBalance(ws, source.id).available)) throw new Error("Carry-forward exceeds verified unused prior-year funds.");
    var target = ws.entities.registerAllocations.find(function (item) { return item.budgetId === to.id && item.registerId === source.registerId; });
    if (!target) {
      var createdAt = at(options);
      target = { id: nextId(ws, to.owner, "registerAllocation", to.id + ":" + source.registerId), owner: to.owner, type: "registerAllocation", budgetId: to.id, registerId: source.registerId, createdAt: createdAt,
        provenance: { owner: to.owner, sourceApp: model().appId, sourceVersion: model().schemaVersion, sourceId: source.registerId, importedAt: createdAt } };
      ws.entities.registerAllocations.push(target);
    }
    var carryOptions = Object.assign({}, options, { at: at(options) });
    entry(ws, "budgetEntries", "budgetEntry", to.owner, { budgetId: to.id, kind: "carryForward", amount: amount / 100, sourceAllocationId: source.id }, carryOptions);
    entry(ws, "allocationEntries", "allocationEntry", to.owner, { budgetId: to.id, allocationId: target.id, kind: "carryForward", amount: amount / 100, sourceAllocationId: source.id }, carryOptions);
    var record = recordFor(ws, source.registerId);
    if (record) { record.carryForward = true; record.raw = record.raw || {}; record.raw.carryForward = true; }
    return commit(ws);
  }
  function recordAmount(input, registerId) {
    var ws = workspace(input);
    return ws.entities.registerAllocations.filter(function (item) { return item.registerId === registerId; }).reduce(function (total, item) { return total + allocationCents(ws, item.id) - carriedCents(ws, item.id); }, 0) / 100;
  }
  function projectAmount(input, projectId) {
    var ws = workspace(input), project = find(ws.entities.projects, projectId, "Project");
    return recordAmount(ws, text(project.applicationId || project.eventId));
  }
  function validationErrors(ws) {
    var errors = [], seenBudgets = {}, seenAllocations = {}, budgets = {}, allocations = {}, records = {}, jobs = {};
    ws.entities.applications.concat(ws.entities.events).forEach(function (item) { records[item.id] = item; });
    ws.entities.jobs.forEach(function (item) { jobs[item.id] = item; });
    ws.entities.annualBudgets.forEach(function (item) {
      var key = item.owner + ":" + item.financialYear;
      if (seenBudgets[key] || !/^\d{4}-\d{2}$/.test(item.financialYear) || Number(item.financialYear.slice(5)) !== (Number(item.financialYear.slice(0, 4)) + 1) % 100 || !["draft", "open", "closed"].includes(item.status)) errors.push(item.id + " invalid or duplicate annual budget.");
      seenBudgets[key] = true; budgets[item.id] = item;
      if (item.status !== "draft" && (!item.approvedBy || !item.approvedAt)) errors.push(item.id + " requires recorded approval.");
    });
    ws.entities.registerAllocations.forEach(function (item) {
      var budget = budgets[item.budgetId], record = records[item.registerId], key = item.budgetId + ":" + item.registerId;
      if (!budget || !record || budget.owner !== item.owner || record.owner !== item.owner || seenAllocations[key]) errors.push(item.id + " invalid or duplicate Register allocation.");
      seenAllocations[key] = true; allocations[item.id] = item;
    });
    ws.entities.budgetEntries.forEach(function (item) {
      if (!budgets[item.budgetId] || budgets[item.budgetId].owner !== item.owner || !item.actor || !item.reason || !/^\d{4}-\d{2}-\d{2}$/.test(item.effectiveDate) || !["approval", "supplement", "reduction", "carryForward", "close", "reopen"].includes(item.kind)) errors.push(item.id + " invalid budget entry.");
      if ((item.kind === "supplement" || item.kind === "carryForward") && item.amount <= 0 || item.kind === "reduction" && item.amount >= 0) errors.push(item.id + " invalid signed budget adjustment.");
    });
    ws.entities.allocationEntries.forEach(function (item) {
      var allocation = allocations[item.allocationId];
      if (!allocation || allocation.budgetId !== item.budgetId || allocation.owner !== item.owner || !item.actor || !item.reason || !["increase", "decrease", "carryForward"].includes(item.kind)) errors.push(item.id + " invalid allocation entry.");
      if ((item.kind === "increase" || item.kind === "carryForward") && item.amount <= 0 || item.kind === "decrease" && item.amount >= 0) errors.push(item.id + " invalid signed allocation adjustment.");
    });
    ws.entities.budgetCharges.forEach(function (item) {
      var allocation = allocations[item.allocationId], job = jobs[item.jobId];
      if (!allocation || !job || allocation.owner !== item.owner || job.owner !== item.owner || !["commitment", "release", "actual"].includes(item.kind) || item.amount <= 0 || !item.actor || !item.reason) errors.push(item.id + " invalid budget charge.");
      if (allocation && job) {
        var project = ws.entities.projects.find(function (record) { return record.id === job.projectId; });
        if (!project || text(project.applicationId || project.eventId) !== allocation.registerId) errors.push(item.id + " Job and allocation Register lineage differ.");
      }
    });
    ws.entities.registerAllocations.forEach(function (allocation) {
      var charges = ws.entities.budgetCharges.filter(function (item) { return item.allocationId === allocation.id; });
      if (sum(charges.filter(function (item) { return item.kind === "release"; }), "amount") > sum(charges.filter(function (item) { return item.kind === "commitment"; }), "amount")) errors.push(allocation.id + " released commitments exceed recorded commitments.");
    });
    ws.entities.budgetEntries.filter(function (item) { return item.kind === "carryForward"; }).forEach(function (item) {
      var source = allocations[item.sourceAllocationId], target = budgets[item.budgetId];
      var matches = ws.entities.allocationEntries.filter(function (candidate) { return candidate.kind === "carryForward" && candidate.budgetId === item.budgetId && candidate.sourceAllocationId === item.sourceAllocationId && candidate.amount === item.amount && candidate.createdAt === item.createdAt; });
      if (!source || !target || !budgets[source.budgetId] || Number(target.financialYear.slice(0, 4)) !== Number(budgets[source.budgetId].financialYear.slice(0, 4)) + 1 || matches.length !== 1) errors.push(item.id + " carry-forward must pair source and destination ledger entries in consecutive years.");
    });
    ws.entities.annualBudgets.forEach(function (item) { if (budgetBalance(ws, item.id).unallocated < -0.001) errors.push(item.id + " allocations exceed approved budget."); });
    ws.entities.registerAllocations.forEach(function (item) { if (allocationBalance(ws, item.id).available < -0.001) errors.push(item.id + " charges or carry-forward exceed allocation."); });
    return errors;
  }
  function assertTransition(before, after) {
    ["budgetEntries", "allocationEntries", "budgetCharges"].forEach(function (collection) {
      var previous = before.entities[collection] || [], next = after.entities[collection] || [];
      previous.forEach(function (item) {
        var current = next.find(function (entry) { return entry.id === item.id; });
        if (!current || JSON.stringify(current) !== JSON.stringify(item)) throw new Error(collection + " history is immutable.");
      });
    });
    (before.entities.annualBudgets || []).forEach(function (item) {
      var current = (after.entities.annualBudgets || []).find(function (entry) { return entry.id === item.id; });
      if (!current || current.financialYear !== item.financialYear || current.owner !== item.owner || (item.status !== "draft" && current.approvedAmount !== item.approvedAmount)) throw new Error("Approved annual budget identity and base amount are immutable.");
      var newEntries = (after.entities.budgetEntries || []).filter(function (entry) { return entry.budgetId === item.id && !(before.entities.budgetEntries || []).some(function (old) { return old.id === entry.id; }); });
      var newAllocations = (after.entities.allocationEntries || []).filter(function (entry) { return entry.budgetId === item.id && !(before.entities.allocationEntries || []).some(function (old) { return old.id === entry.id; }); });
      var newCharges = (after.entities.budgetCharges || []).filter(function (entry) { return (after.entities.registerAllocations || []).some(function (allocation) { return allocation.id === entry.allocationId && allocation.budgetId === item.id; }) && !(before.entities.budgetCharges || []).some(function (old) { return old.id === entry.id; }); });
      if (item.status === "closed" && current.status === "closed" && (newEntries.length || newAllocations.length || newCharges.length)) throw new Error("Closed financial years cannot be changed.");
      if (item.status !== current.status) {
        var required = item.status === "draft" && current.status === "open" ? "approval" : item.status === "open" && current.status === "closed" ? "close" : item.status === "closed" && current.status === "open" ? "reopen" : "";
        if (!required || newEntries.filter(function (entry) { return entry.kind === required; }).length !== 1) throw new Error("Budget state change requires its recorded approval, close, or reopen entry.");
      }
    });
    (before.entities.registerAllocations || []).forEach(function (item) {
      var current = (after.entities.registerAllocations || []).find(function (entry) { return entry.id === item.id; });
      if (!current || JSON.stringify(current) !== JSON.stringify(item)) throw new Error("Register allocation lineage is immutable.");
    });
  }
  UOS.ProgramBudget = {
    createAnnualBudget: createAnnualBudget, approveAnnualBudget: approveAnnualBudget, adjustAnnualBudget: adjustAnnualBudget,
    adjustAllocation: adjustAllocation, chargeJob: chargeJob, releaseJobCommitment: releaseJobCommitment, closeYear: function (ws, id, options) { return changeYearState(ws, id, options, false); },
    reopenYear: function (ws, id, options) { return changeYearState(ws, id, options, true); }, carryForward: carryForward,
    budgetBalance: budgetBalance, allocationBalance: allocationBalance, budgetFor: budgetFor,
    recordAmount: recordAmount, projectAmount: projectAmount, validationErrors: validationErrors, assertTransition: assertTransition
  };
}());
