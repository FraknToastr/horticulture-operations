(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {};
  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function money(value) { var number = Number(value); return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0; }
  function model() { if (!UOS.ProgramModel) throw new Error("ProgramModel must load before ProjectFunding."); return UOS.ProgramModel; }
  function workspace(input) { return model().normalize(clone(input)); }
  function find(values, id, label) { var result = values.find(function (item) { return item.id === id; }); if (!result) throw new Error(label + ' "' + id + '" was not found.'); return result; }
  function operationalAmount(project, workspaceValue) {
    if (workspaceValue && UOS.ProgramBudget && workspaceValue.entities && workspaceValue.entities.annualBudgets.length) {
      return UOS.ProgramBudget.projectAmount(workspaceValue, project.id);
    }
    return Math.max(0, money(object(project && project.funding) ? project.funding.operationalAmount : 0));
  }
  function activeJob(job, projectId) { return job.projectId === projectId && ["cancelled", "canceled", "archived", "superseded"].indexOf(text(job.status).toLowerCase()) < 0; }
  function deliveryCostFor(workspaceValue, projectId) {
    var jobIds = {}, seen = {};
    workspaceValue.entities.jobs.forEach(function (job) { if (activeJob(job, projectId)) jobIds[job.id] = true; });
    return money(workspaceValue.entities.costingLines.reduce(function (sum, line) {
      if (line.projectId !== projectId || (line.jobId && !jobIds[line.jobId]) || seen[line.id]) return sum;
      seen[line.id] = true;
      return sum + Math.max(0, money(line.estimatedTotal));
    }, 0));
  }
  function quoteRank(quote) { return text(quote.status) === "Accepted" ? 2 : text(quote.status) === "Issued" ? 1 : 0; }
  function applicableQuoteFor(workspaceValue, projectId) {
    var quotes = workspaceValue.entities.quotes.filter(function (quote) { return quote.projectId === projectId && !text(quote.supersededByQuoteId) && quoteRank(quote) > 0; });
    quotes.sort(function (left, right) {
      return quoteRank(right) - quoteRank(left) || Number(right.revision || 1) - Number(left.revision || 1) || text(right.auditNumber).localeCompare(text(left.auditNumber)) || text(right.id).localeCompare(text(left.id));
    });
    return quotes.length ? quotes[0] : null;
  }
  function quoteContribution(quote, isCandidate) {
    if (!quote || text(quote.supersededByQuoteId)) return 0;
    if (quote.fundingMode && isCandidate && text(quote.status) !== "Superseded") return UOS.ProgramQuotes.customerAmounts(quote).contribution;
    if (quoteRank(quote) > 0 || (isCandidate && text(quote.status) === "Draft")) {
      return UOS.ProgramQuotes.customerAmounts(quote).contribution;
    }
    return 0;
  }
  function activePayments(workspaceValue, quoteId) {
    if (!quoteId) return 0;
    return money((workspaceValue.entities.payments || []).reduce(function (sum, payment) { return payment.quoteId === quoteId && text(payment.status).toLowerCase() !== "reversed" ? sum + Math.max(0, Number(payment.amount) || 0) : sum; }, 0));
  }
  function receivablesFor(workspaceValue, quote) {
    var grandTotal = quote ? UOS.ProgramQuotes.customerAmounts(quote).payable : 0;
    var paid = quote ? activePayments(workspaceValue, quote.id) : 0;
    var depositPaid = quote ? money((workspaceValue.entities.payments || []).reduce(function (sum, payment) {
      return payment.quoteId === quote.id && payment.method === "Paid with Deposit" && text(payment.status).toLowerCase() !== "reversed" ? sum + Math.max(0, Number(payment.amount) || 0) : sum;
    }, 0)) : 0;
    return { quoteId: quote ? quote.id : null, customerGrandTotal: grandTotal, paymentsPaid: paid, depositPaid: depositPaid, customerOutstanding: quote && quote.fundingMode === "city" ? 0 : Math.max(0, money(grandTotal - paid)) };
  }
  function position(inputWorkspace, projectId, options) {
    var result = workspace(inputWorkspace);
    var project = find(result.entities.projects, text(projectId), "Project");
    var supplied = object(options) && object(options.quote) ? options.quote : null;
    if (supplied && supplied.projectId && text(supplied.projectId) !== project.id) supplied = null;
    var isCandidate = Boolean(supplied);
    var quote = supplied || applicableQuoteFor(result, project.id);
    var delivery = deliveryCostFor(result, project.id);
    var availableCouncil = operationalAmount(project, result);
    var council = quote && quote.fundingMode === "customer" ? 0 : availableCouncil;
    var customer = quoteContribution(quote, isCandidate);
    var total = money(customer + council);
    var signedPosition = money(total - delivery);
    var receivables = receivablesFor(result, quote);
    return {
      projectId: project.id, basis: "ex-GST", calculatedDeliveryCost: delivery, operationalAmount: council,
      availableCityAllocation: availableCouncil, fundingMode: quote ? quote.fundingMode || null : null,
      customerAgreementStatus: UOS.ProgramQuotes ? UOS.ProgramQuotes.agreementStatus(quote) : "No customer agreement",
      confirmedCustomerFunding: quote && quote.status === "Accepted" && !text(quote.supersededByQuoteId) ? customer : 0,
      customerQuote: customer, customerQuoteId: quote && (quoteRank(quote) > 0 || isCandidate) ? quote.id : null, customerQuoteStatus: quote && (quoteRank(quote) > 0 || isCandidate) ? quote.status : null,
      totalFunding: total, fundingPosition: signedPosition, fundingGap: Math.max(0, money(-signedPosition)), fundingSurplus: Math.max(0, signedPosition),
      fundingStatus: signedPosition < 0 ? "gap" : signedPosition > 0 ? "surplus" : "balanced", label: signedPosition < 0 ? "Funding Gap" : signedPosition > 0 ? "Funding Surplus" : "Balanced",
      customerGrandTotal: receivables.customerGrandTotal, paymentsPaid: receivables.paymentsPaid, depositPaid: receivables.depositPaid, customerOutstanding: receivables.customerOutstanding,
      customerGst: quote ? UOS.ProgramQuotes.customerAmounts(quote).gst : 0
    };
  }
  function setOperationalAmount(inputWorkspace, projectId, value) {
    var result = workspace(inputWorkspace), project = find(result.entities.projects, text(projectId), "Project"), parsed = Number(value);
    if (UOS.ProgramBudget && result.entities.annualBudgets.length) throw new Error("City Operational Amount is allocated to the Register record in Annual Budget.");
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Operational Amount must be a non-negative number.");
    project.funding = object(project.funding) ? project.funding : {};
    project.funding.operationalAmount = money(parsed);
    project.funding.updatedAt = new Date().toISOString();
    return model().normalize(result);
  }
  function legacyNumber(value) { if (value === null || value === undefined || value === "") return null; var parsed = Number(value); return Number.isFinite(parsed) && parsed >= 0 ? money(parsed) : null; }
  function migrateApprovedBudgets(inputWorkspace) {
    var result = workspace(inputWorkspace), unresolved = [], parents = result.entities.applications.concat(result.entities.events);
    result.entities.projects.forEach(function (project) {
      var parentId = text(project.applicationId || project.eventId), parent = parents.find(function (item) { return item.id === parentId; });
      var canonicalPresent = object(project.funding) && project.funding.operationalAmount !== null && project.funding.operationalAmount !== undefined && project.funding.operationalAmount !== "";
      var canonical = canonicalPresent ? legacyNumber(project.funding.operationalAmount) : null;
      var projectPresent = Object.prototype.hasOwnProperty.call(project, "approvedBudget"), parentPresent = Boolean(parent && Object.prototype.hasOwnProperty.call(parent, "approvedBudget"));
      var candidates = [];
      if (projectPresent) candidates.push({ source: project.id + ".approvedBudget", value: legacyNumber(project.approvedBudget), raw: project.approvedBudget });
      if (parentPresent) candidates.push({ source: parent.id + ".approvedBudget", value: legacyNumber(parent.approvedBudget), raw: parent.approvedBudget });
      var valid = candidates.filter(function (candidate) { return candidate.value !== null; }).map(function (candidate) { return candidate.value; });
      var distinct = valid.filter(function (value, index) { return valid.indexOf(value) === index; });
      var safe = canonicalPresent && canonical !== null ? distinct.every(function (value) { return value === canonical; }) : candidates.length > 0 && candidates.every(function (candidate) { return candidate.value !== null; }) && distinct.length === 1;
      var linked = parent ? result.entities.projects.filter(function (item) { return text(item.applicationId || item.eventId) === parent.id; }) : [];
      if (parentPresent && linked.length !== 1) safe = false;
      var chosen = canonicalPresent ? canonical : distinct[0];
      if (safe && chosen !== null) {
        project.funding = object(project.funding) ? project.funding : {};
        project.funding.operationalAmount = chosen;
        if (candidates.length) project.funding.migratedFrom = candidates.map(function (candidate) { return candidate.source; }).sort();
        if (projectPresent) delete project.approvedBudget;
        if (parentPresent) {
          delete parent.approvedBudget;
        }
      } else if (candidates.length) {
        unresolved.push({ code: "FUNDING_MIGRATION_UNRESOLVED", projectId: project.id, parentId: parentId || null, reason: parentPresent && linked.length !== 1 ? "parent-value-has-multiple-linked-projects" : canonicalPresent && canonical === null ? "invalid-canonical-value" : distinct.length > 1 ? "conflicting-values" : "invalid-legacy-value", candidates: clone(candidates) });
      }
    });
    result.migration = object(result.migration) ? result.migration : {};
    result.migration.unresolvedFunding = unresolved.sort(function (left, right) { return text(left.projectId).localeCompare(text(right.projectId)) || text(left.reason).localeCompare(text(right.reason)); });
    return model().normalize(result);
  }
  function finances(inputWorkspace) {
    var result = workspace(inputWorkspace), linesByJob = {}, committed = 0, actual = 0;
    result.entities.costingLines.forEach(function (line) { if (line.jobId) linesByJob[line.jobId] = money((linesByJob[line.jobId] || 0) + Math.max(0, money(line.estimatedTotal))); });
    var hasAnnualBudget = Boolean(UOS.ProgramBudget && result.entities.annualBudgets.length);
    var operational = hasAnnualBudget ? result.entities.registerAllocations.reduce(function (sum, allocation) {
      return money(sum + UOS.ProgramBudget.allocationBalance(result, allocation.id).allocated - UOS.ProgramBudget.allocationBalance(result, allocation.id).carriedForward);
    }, 0) : result.entities.projects.reduce(function (sum, project) { return money(sum + operationalAmount(project)); }, 0);
    var annualApproved = hasAnnualBudget ? result.entities.annualBudgets.reduce(function (sum, budget) { return money(sum + UOS.ProgramBudget.budgetBalance(result, budget.id).approved); }, 0) : 0;
    result.entities.jobs.forEach(function (job) {
      var status = text(job.status).toLowerCase().replace(/[-_]+/g, " "), estimate = Math.max(0, money(job.estimate || linesByJob[job.id]));
      if (["draft", "scheduled", "in progress"].indexOf(status) >= 0) committed = money(committed + estimate);
      if (status === "completed") actual = money(actual + Math.max(0, money(job.actualCost == null ? estimate : job.actualCost)));
    });
    if (hasAnnualBudget) {
      committed = money(result.entities.budgetCharges.filter(function (item) { return item.kind === "commitment"; }).reduce(function (sum, item) { return sum + item.amount; }, 0) - result.entities.budgetCharges.filter(function (item) { return item.kind === "release"; }).reduce(function (sum, item) { return sum + item.amount; }, 0));
      actual = money(result.entities.budgetCharges.filter(function (item) { return item.kind === "actual"; }).reduce(function (sum, item) { return sum + item.amount; }, 0));
    }
    return { operationalAmount: operational, approvedBudget: annualApproved, committedBudget: committed, actualSpend: actual, spareFunds: money(annualApproved - committed - actual) };
  }
  UOS.ProjectFunding = {
    operationalAmount: operationalAmount,
    deliveryCost: function (input, projectId) { return deliveryCostFor(workspace(input), text(projectId)); },
    applicableQuote: function (input, projectId) { return clone(applicableQuoteFor(workspace(input), text(projectId))); },
    position: position,
    receivables: function (input, quoteId) { var result = workspace(input); return receivablesFor(result, quoteId ? find(result.entities.quotes, text(quoteId), "Quote") : null); },
    finances: finances, setOperationalAmount: setOperationalAmount, migrateApprovedBudgets: migrateApprovedBudgets
  };
}());
