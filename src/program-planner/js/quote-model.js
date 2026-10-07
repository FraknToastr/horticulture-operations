(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var STATUSES = ["Draft", "Issued", "Accepted", "Declined", "Superseded"];
  var IMMUTABLE = ["Issued", "Accepted", "Declined", "Superseded"];
  var PAYABLE_STATUSES = ["Draft", "Issued", "Accepted", "Declined"];
  var PAYMENT_METHODS = ["Bank transfer", "Card", "Cash", "EFT", "Purchase order", "Council Operational Budget", "Paid with Deposit", "Other"];

  function object(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function text(value) { return String(value == null ? "" : value).trim(); }
  function money(value) { var number = Number(value); return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0; }
  function validPaymentDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var parsed = new Date(value + "T00:00:00Z");
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }
  function model() { if (!UOS.ProgramModel) throw new Error("ProgramModel must load before ProgramQuotes."); return UOS.ProgramModel; }
  function workspace(input) { return model().normalize(clone(input)); }
  function find(values, id, label) {
    var result = values.find(function (item) { return item.id === id; });
    if (!result) throw new Error(label + ' "' + id + '" was not found.');
    return result;
  }
  function auditYear(value) {
    var match = /^(\d{4})-/.exec(text(value));
    return match ? match[1] : String(new Date().getFullYear());
  }
  function nextAuditRoot(workspaceValue, owner, quoteDate) {
    var year = auditYear(quoteDate);
    var prefix = owner + "-Q-" + year + "-";
    var highest = 0;
    workspaceValue.entities.quotes.forEach(function (quote) {
      var value = text(quote.auditRootNumber || quote.auditNumber);
      if (value.indexOf(prefix) !== 0) return;
      var match = new RegExp("^" + prefix + "(\\d{4})(?:-R\\d{2,})?$").exec(value);
      if (match) highest = Math.max(highest, Number(match[1]) || 0);
    });
    return prefix + String(highest + 1).padStart(4, "0");
  }
  function revisionAuditNumber(rootNumber, revision) {
    return text(rootNumber) + "-R" + String(Math.max(1, Number(revision) || 1)).padStart(2, "0");
  }
  function inheritedLine(line) {
    var sourceAreaSqM = Number(line.sourceAreaSqM);
    return {
      id: line.id, costingLineId: line.id, projectId: line.projectId, jobId: line.jobId, catalogId: line.catalogId || null,
      rateItemId: text(line.rateItemId) || null, sourceGeometryId: text(line.sourceGeometryId) || null,
      sourceAreaSqM: Number.isFinite(sourceAreaSqM) ? Math.max(0, sourceAreaSqM) : null,
      sourceWorkTypeKey: text(line.sourceWorkTypeKey) || null,
      kind: text(line.kind), category: text(line.category) || "General", description: text(line.description || line.title), unit: text(line.unit) || "item",
      quantity: Math.max(0, Number(line.quantity) || 0), rate: Math.max(0, Number(line.unitRate) || 0),
      total: Math.max(0, money(line.estimatedTotal)), paid: line.paid === true, sourceKind: "costingLine", readOnly: true
    };
  }
  function inheritProject(inputWorkspace, projectId) {
    var result = workspace(inputWorkspace);
    var project = find(result.entities.projects, text(projectId), "Project");
    var jobIds = {};
    result.entities.jobs.forEach(function (job) {
      var status = text(job.status).toLowerCase();
      if (job.projectId === project.id && ["cancelled", "canceled", "archived", "superseded"].indexOf(status) < 0) jobIds[job.id] = true;
    });
    var seen = {};
    return result.entities.costingLines.filter(function (line) {
 if (line.projectId !== project.id || line.jobId && !jobIds[line.jobId] || seen[line.id]) return false;
      seen[line.id] = true;
      return true;
    }).map(inheritedLine);
  }
  function totals(lines, discountRate, contingencyRate, discountAmount) {
    var subtotal = money(lines.reduce(function (sum, line) { return sum + Math.max(0, Number(line.total) || 0); }, 0));
    var suppliedDiscount = discountAmount !== undefined && discountAmount !== null && discountAmount !== "";
    var discount = money(suppliedDiscount ? Math.max(0, Number(discountAmount) || 0) : subtotal * Math.max(0, Number(discountRate) || 0) / 100);
    discount = Math.min(subtotal, discount);
    var effectiveDiscountRate = subtotal > 0 ? money(discount / subtotal * 100) : 0;
    var contingency = money(subtotal * Math.max(0, Number(contingencyRate) || 0) / 100);
    var beforeGst = money(subtotal + contingency - discount);
    var gst = money(beforeGst * 0.1);
    return { subtotal: subtotal, discountRate: effectiveDiscountRate, discount: discount, discountAmount: discount, contingency: contingency, subtotalExGst: beforeGst, gst: gst, grandTotal: money(beforeGst + gst) };
  }
  // Work estimates remain independent of the amount offered to the customer.
  function customerAmounts(quote) {
    quote = quote || {};
    var mode = text(quote.fundingMode);
    var contribution = mode === "city" ? 0 : mode === "mixed"
      ? Math.max(0, money(quote.proposedCustomerContribution))
      : Math.max(0, money(Number(quote.grandTotal) - Number(quote.gst)));
    var gst = mode === "city" ? 0 : mode === "mixed" ? money(contribution * 0.1) : money(quote.gst);
    return { contribution: contribution, gst: gst, payable: mode === "city" ? 0 : mode === "mixed" ? money(contribution + gst) : money(quote.grandTotal) };
  }
  function suggestedContribution(quote, cityAllocation) {
    return Math.max(0, money(Number(quote.grandTotal) - Number(quote.gst) - Number(cityAllocation || 0)));
  }
  function agreementStatus(quote) {
    if (!quote) return "No customer agreement";
    if (quote.fundingMode === "city") return "No customer payment required";
    if (text(quote.supersededByQuoteId) || quote.status === "Superseded") return "Superseded";
    return { Draft: "Proposed", Issued: "Awaiting acceptance", Accepted: "Accepted", Declined: "Declined" }[quote.status] || "Proposed";
  }
  function customLines(input) {
    return (Array.isArray(input) ? input : []).map(function (line, index) {
      var quantity = Math.max(0, Number(line.quantity) || 0), rate = Math.max(0, Number(line.rate == null ? line.unitRate : line.rate) || 0);
      return {
        id: text(line.id) || "custom-" + index, kind: text(line.kind) || "Sundry", category: text(line.category) || "Adjustment", description: text(line.description) || "Quote adjustment",
        unit: text(line.unit) || "item", quantity: quantity, rate: rate, total: money(quantity * rate), paid: line.paid === true, sourceKind: "custom", readOnly: false
      };
    });
}

function currentQuoteLines(result, quoteId) {
  return result.entities.quoteLines.filter(function (line) { return line.quoteId === quoteId; }).map(function (line) {
    return {
      id: line.costingLineId || line.customLineKey || line.id,
      costingLineId: line.costingLineId || null,
      jobId: line.jobId || null,
      rateItemId: line.rateItemId || null,
      catalogId: line.catalogId || null,
      sourceGeometryId: line.sourceGeometryId || null,
      sourceAreaSqM: Number.isFinite(Number(line.sourceAreaSqM)) ? Math.max(0, Number(line.sourceAreaSqM)) : null,
      sourceWorkTypeKey: text(line.sourceWorkTypeKey) || null,
      kind: text(line.kind), category: line.category,
      description: line.description,
      unit: line.unit,
      quantity: line.quantity,
      rate: line.unitRate,
      total: line.total,
      paid: line.paid === true,
      sourceKind: line.sourceKind || (line.costingLineId ? "costingLine" : "custom")
    };
  });
}

function valueOrExisting(input, name, existing) {
  return input[name] === undefined && existing ? existing[name] : input[name];
}
  function commerciallyLocked(result, quoteId) {
    return result.entities.payments.some(function (payment) { return payment.quoteId === quoteId && payment.status !== "Reversed"; }) ||
      (result.entities.paymentAllocations || []).some(function (allocation) { return allocation.quoteId === quoteId && allocation.status === "Active"; });
  }
  function saveDraft(inputWorkspace, input) {
    var result = workspace(inputWorkspace);
    input = object(input) ? input : {};
    var project = find(result.entities.projects, text(input.projectId), "Project");
    var existing = text(input.id) ? find(result.entities.quotes, text(input.id), "Quote") : null;
    if (existing && IMMUTABLE.indexOf(text(existing.status)) >= 0) throw new Error("Issued and resolved Quotes are a stable snapshot; create a new revision from current costs.");
    if (existing && existing.projectId !== project.id) throw new Error("Quote Project cannot be changed.");
    var revision = Math.max(1, Number(input.revision || (existing && existing.revision)) || 1);
    var quoteNumber = text(input.quoteNumber || (existing && existing.quoteNumber)) || "DRAFT";
    var auditRootNumber = text(input.auditRootNumber || (existing && existing.auditRootNumber)) || nextAuditRoot(result, project.owner, input.quoteDate || existing && existing.quoteDate);
    var quoteId = existing ? existing.id : model().stableId(project.owner, "quote", project.id + ":" + auditRootNumber + ":r" + revision);
    var rootQuoteId = text(input.rootQuoteId || (existing && existing.rootQuoteId)) || quoteId;
    var previousQuoteId = text(input.previousQuoteId || (existing && existing.previousQuoteId)) || null;
    var auditNumber = text(input.auditNumber || (existing && existing.auditNumber)) || revisionAuditNumber(auditRootNumber, revision);
  var financialLock = Boolean(existing && commerciallyLocked(result, existing.id));
  var fundingMode = input.fundingMode === undefined ? (existing ? existing.fundingMode : "customer") : input.fundingMode;
  if (fundingMode != null && fundingMode !== "" && ["city", "customer", "mixed"].indexOf(fundingMode) < 0) throw new Error("Unsupported funding arrangement.");
  fundingMode = fundingMode || null;
  var proposed = valueOrExisting(input, "proposedCustomerContribution", existing);
  if (proposed != null && proposed !== "" && (!Number.isFinite(Number(proposed)) || Number(proposed) < 0)) throw new Error("Proposed customer contribution must be a non-negative number.");
  var suppressCouncilDisclosure = input.suppressCouncilDisclosure === undefined
    ? Boolean(existing && existing.suppressCouncilDisclosure)
    : input.suppressCouncilDisclosure === true;
  if (fundingMode !== "mixed") suppressCouncilDisclosure = false;
  if (financialLock && (fundingMode !== (existing.fundingMode || null) || (input.proposedCustomerContribution !== undefined && money(proposed) !== money(existing.proposedCustomerContribution)) || suppressCouncilDisclosure !== Boolean(existing && existing.suppressCouncilDisclosure))) throw new Error("Reverse active payments and payment allocations before changing the funding arrangement, customer contribution or Council PDF disclosure.");
  var lines;
  if (financialLock) lines = [];
  else if (!existing || input.refreshCosts === true) {
    var customs = input.customLines === undefined && existing
      ? currentQuoteLines(result, existing.id).filter(function (line) { return line.sourceKind === "custom"; })
      : customLines(input.customLines);
    lines = inheritProject(result, project.id).concat(customs);
  } else if (input.customLines !== undefined) {
    lines = currentQuoteLines(result, existing.id).filter(function (line) { return line.sourceKind !== "custom"; }).concat(customLines(input.customLines));
  } else {
    lines = currentQuoteLines(result, existing.id);
  }
    var requestedDiscountRate = input.discountRate === undefined && existing ? existing.discountRate : input.discountRate;
    var requestedDiscountAmount = input.discountAmount === undefined && existing ? existing.discountAmount : input.discountAmount;
    var calculated = totals(lines, requestedDiscountRate, input.contingencyRate === undefined && existing ? existing.contingencyRate : input.contingencyRate, requestedDiscountAmount);
    if (fundingMode === "mixed" && (proposed == null || proposed === "")) {
      var allocation = UOS.ProjectFunding ? UOS.ProjectFunding.operationalAmount(project, result) : 0;
      proposed = suggestedContribution(calculated, allocation);
    }
    var quote = {
      id: quoteId, owner: project.owner, type: "quote", projectId: project.id, quoteNumber: quoteNumber, revision: revision,
      auditNumber: auditNumber, auditRootNumber: auditRootNumber, rootQuoteId: rootQuoteId, previousQuoteId: previousQuoteId,
    clientName: text(valueOrExisting(input, "clientName", existing)), address: text(valueOrExisting(input, "address", existing)), phone: text(valueOrExisting(input, "phone", existing)), email: text(valueOrExisting(input, "email", existing)), preparedBy: text(valueOrExisting(input, "preparedBy", existing)),
    quoteDate: text(valueOrExisting(input, "quoteDate", existing)), expiryDate: text(valueOrExisting(input, "expiryDate", existing)), discountRate: calculated.discountRate, discountAmount: calculated.discount,
    contingencyRate: Math.max(0, Number(valueOrExisting(input, "contingencyRate", existing)) || 0), scopeNotes: text(valueOrExisting(input, "scopeNotes", existing)), terms: text(valueOrExisting(input, "terms", existing)),
      status: "Draft", subtotal: calculated.subtotal, gst: calculated.gst, grandTotal: calculated.grandTotal,
      fundingMode: fundingMode, proposedCustomerContribution: proposed == null || proposed === "" ? null : money(proposed), suppressCouncilDisclosure: suppressCouncilDisclosure,
      updatedAt: new Date().toISOString(), provenance: { owner: project.owner, sourceApp: "uos.quote-builder", sourceVersion: 1, sourceId: quoteId }
    };
    if (financialLock) {
      quote.discountRate = existing.discountRate;
      quote.discountAmount = existing.discountAmount;
      quote.contingencyRate = existing.contingencyRate;
      quote.subtotal = existing.subtotal;
      quote.gst = existing.gst;
      quote.grandTotal = existing.grandTotal;
}

    var quoteIndex = result.entities.quotes.findIndex(function (item) { return item.id === quote.id; });
    if (quoteIndex >= 0) result.entities.quotes[quoteIndex] = quote; else result.entities.quotes.push(quote);
    var canonical = financialLock ? result.entities.quoteLines.filter(function (line) { return line.quoteId === quote.id; }).map(clone) : lines.map(function (line, index) {
      var sourceKey = line.costingLineId || text(line.id) || "custom-" + index;
      return {
        id: model().stableId(project.owner, "quoteLine", quote.id + ":" + sourceKey), owner: project.owner, type: "quoteLine",
        quoteId: quote.id, quoteAuditNumber: quote.auditNumber, projectId: project.id, jobId: line.jobId || null, costingLineId: line.costingLineId || null,
        rateItemId: line.rateItemId || null, catalogId: line.catalogId || null, sourceGeometryId: line.sourceGeometryId || null,
        sourceAreaSqM: Number.isFinite(Number(line.sourceAreaSqM)) ? Math.max(0, Number(line.sourceAreaSqM)) : null,
        sourceWorkTypeKey: text(line.sourceWorkTypeKey) || null,
        kind: text(line.kind), category: line.category, description: line.description, unit: line.unit, quantity: line.quantity,
        unitRate: line.rate, total: line.total, sourceKind: line.sourceKind, customLineKey: line.sourceKind === "custom" ? sourceKey : null,
        paid: line.paid === true,
        provenance: { owner: project.owner, sourceApp: "uos.quote-builder", sourceVersion: 1, sourceId: sourceKey }
      };
    });
    result.entities.quoteLines = result.entities.quoteLines.filter(function (line) { return line.quoteId !== quote.id; }).concat(canonical);
 return model().normalize(result);
 }

 function refreshDraftFromCurrentCosts(inputWorkspace, quoteId, options) {
  options = object(options) ? options : {};
  if (options.confirmed !== true) throw new Error("Refreshing a Quote from current costs requires explicit confirmation.");
  var result = workspace(inputWorkspace);
  var quote = find(result.entities.quotes, text(quoteId), "Quote");
  if (text(quote.status) !== "Draft") throw new Error("Only a Draft Quote can be refreshed from current costs.");
  return saveDraft(result, { id: quote.id, projectId: quote.projectId, refreshCosts: true });
 }

  function commercialProjection(inputWorkspace, quoteId) {
  var snapshot = quoteSnapshot(inputWorkspace, quoteId);
  var quote = snapshot.quote;
    var projection = {
   quote: {
    id: quote.id, projectId: quote.projectId, quoteNumber: quote.quoteNumber,
    revision: quote.revision, auditNumber: quote.auditNumber,
    clientName: quote.clientName, address: quote.address, email: quote.email,
    preparedBy: quote.preparedBy, quoteDate: quote.quoteDate, expiryDate: quote.expiryDate,
    discountRate: quote.discountRate, discountAmount: quote.discountAmount,
    contingencyRate: quote.contingencyRate, scopeNotes: quote.scopeNotes, terms: quote.terms,
    subtotal: quote.subtotal, gst: quote.gst, grandTotal: quote.grandTotal
    }, lines: snapshot.lines
    };
    if (quote.fundingMode) {
      projection.quote.fundingMode = quote.fundingMode;
      projection.quote.proposedCustomerContribution = quote.proposedCustomerContribution;
      if (quote.suppressCouncilDisclosure !== undefined) projection.quote.suppressCouncilDisclosure = quote.suppressCouncilDisclosure === true;
      if (quote.cityFundingAmount !== undefined) projection.quote.cityFundingAmount = quote.cityFundingAmount;
      if (quote.estimatedDeliveryCost !== undefined) projection.quote.estimatedDeliveryCost = quote.estimatedDeliveryCost;
    }
    return projection;
 }

 function projectionFingerprint(projection) {
  var value = JSON.stringify(projection);
  var hash = 2166136261;
  for (var index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return "fnv1a32:" + (hash >>> 0).toString(16).padStart(8, "0");
 }
  function logEvent(result, quoteId, eventType, actor, reason, payload) {
    result.entities.quoteEvents = Array.isArray(result.entities.quoteEvents) ? result.entities.quoteEvents : [];
    var quote = result.entities.quotes.find(function (q) { return q.id === quoteId; });
    var owner = quote ? quote.owner : "NSA";
    var id = model().stableId(owner, "quoteEvent", quoteId + ":" + Date.now().toString(36) + ":" + Math.random().toString(36).slice(2));
    result.entities.quoteEvents.push({
      id: id, owner: owner, type: "quoteEvent", quoteId: quoteId, eventType: eventType,
      actor: text(actor) || "Officer", timestamp: new Date().toISOString(), reason: text(reason) || "", payload: payload || {}
    });
  }

  function evaluateReadiness(inputWorkspace, quoteId) {
    var result = workspace(inputWorkspace);
    var quote = find(result.entities.quotes, text(quoteId), "Quote");
    var lines = (result.entities.quoteLines || []).filter(function (line) { return line.quoteId === quote.id; });
    var material = lines.filter(function (line) { return Math.abs(Number(line.total) || 0) > 0.004; });
    var costingIds = {};
    (result.entities.costingLines || []).forEach(function (line) { costingIds[text(line.id)] = true; });
    var scopeSources = [];
    if (text(quote.scopeNotes)) scopeSources.push({ type: "quote.scopeNotes", id: quote.id });
    material.forEach(function (line) { if (text(line.description)) scopeSources.push({ type: "quoteLine.description", id: line.id }); });
    var costSources = [], failures = [];
    if (["city", "customer", "mixed"].indexOf(quote.fundingMode) < 0) failures.push({ code: "FUNDING_MODE_REQUIRED", message: "Choose a funding arrangement before issuing this Quote." });
    material.forEach(function (line) {
      if (text(line.sourceKind) === "costingLine" && costingIds[text(line.costingLineId)]) costSources.push({ type: "costingLine", id: text(line.costingLineId) });
      else if (text(line.rateItemId) || text(line.catalogId)) costSources.push({ type: "approvedRate", id: text(line.rateItemId || line.catalogId) });
      else if (text(line.sourceKind) === "custom" && text(line.costBasis) === "authorised-manual" && text(line.costBasisReason || line.description)) costSources.push({ type: "authorisedManual", id: line.id });
      else failures.push({ code: "COST_BASIS_MISSING", lineId: line.id, message: "A material Quote line has no recognised cost basis." });
    });
    if (!material.length) failures.push({ code: "SCOPE_MISSING", message: "Add at least one material Quote line before Issue." });
    if (!text(quote.scopeNotes) && material.some(function (line) { return !text(line.description); })) failures.push({ code: "SCOPE_MISSING", message: "Describe the proposed scope or each material Quote line." });
    var funding = UOS.ProjectFunding && typeof UOS.ProjectFunding.position === "function" ? UOS.ProjectFunding.position(result, quote.projectId, { quote: quote }) : null;
    if (!funding) failures.push({ code: "FUNDING_EVIDENCE_MISSING", message: "Funding position cannot be evaluated." });
    else if (Number(funding.fundingGap) > 0.004) failures.push({ code: "FUNDING_GAP", message: "Resolve the funding gap before issuing this Quote." });
    var snapshot = { evaluatedAt: new Date().toISOString(), quoteId: quote.id, projectId: quote.projectId, ready: failures.length === 0, evidence: { scope: scopeSources, costBasis: costSources, funding: funding ? { calculatedDeliveryCost: funding.calculatedDeliveryCost, customerQuote: funding.customerQuote, operationalAmount: funding.operationalAmount, totalFunding: funding.totalFunding, fundingGap: funding.fundingGap, fundingStatus: funding.fundingStatus } : null }, failures: failures };
    return { ready: snapshot.ready, failures: failures, evidence: snapshot.evidence, snapshot: snapshot };
  }
  function setStatus(inputWorkspace, quoteId, status) {
    var result = workspace(inputWorkspace);
    var quote = find(result.entities.quotes, text(quoteId), "Quote");
    var target = text(status);
    var oldStatus = quote.status;
    if (STATUSES.indexOf(target) < 0) throw new Error("Unsupported Quote status.");
 if (target === oldStatus) return result;
 var allowed = { Draft: ["Issued"], Issued: ["Accepted", "Declined"], Accepted: [], Declined: [], Superseded: [] };
    if (allowed[text(quote.status) || "Draft"].indexOf(target) < 0) throw new Error("Invalid Quote status transition.");
    if (target === "Issued") {
      var lines = (result.entities.quoteLines || []).filter(function (l) { return l.quoteId === quote.id; });
      if (!lines.length) throw new Error("Quote must contain at least one line item before being issued.");
      if (!text(quote.quoteDate)) throw new Error("Quote date is required before issuing a Quote.");
      var readiness = evaluateReadiness(result, quote.id);
      if (!readiness.ready) throw new Error("Quote readiness failed: " + readiness.failures.map(function (failure) { return failure.message; }).join(" "));
      quote.readinessSnapshot = readiness.snapshot;
      if (quote.fundingMode) {
        quote.cityFundingAmount = readiness.evidence.funding.operationalAmount;
        quote.estimatedDeliveryCost = readiness.evidence.funding.calculatedDeliveryCost;
      }
    }
 if (target === "Issued") {
 quote.commercialFingerprint = projectionFingerprint(commercialProjection(result, quote.id));
 if (text(quote.previousQuoteId)) {
 var predecessor = find(result.entities.quotes, text(quote.previousQuoteId), "Predecessor Quote");
 if (predecessor.projectId !== quote.projectId || predecessor.auditRootNumber !== quote.auditRootNumber) throw new Error("Replacement Quote must share its predecessor's Project and audit root.");
 if (["Issued", "Accepted", "Declined"].indexOf(text(predecessor.status)) < 0) throw new Error("Replacement Quote predecessor must be issued or resolved.");
 if (text(predecessor.supersededByQuoteId) && text(predecessor.supersededByQuoteId) !== quote.id) throw new Error("Predecessor Quote is already superseded by another replacement.");
 quote.supersedesQuoteId = predecessor.id;
 predecessor.supersededByQuoteId = quote.id;
 predecessor.status = "Superseded";
 predecessor.statusChangedAt = new Date().toISOString();
 logEvent(result, predecessor.id, "superseded", quote.preparedBy, "Superseded by issued replacement " + quote.auditNumber, { supersededByQuoteId: quote.id });
 }
 }
 quote.status = target;
    quote.statusChangedAt = new Date().toISOString();
    logEvent(result, quote.id, "status_changed", quote.preparedBy, "Status changed from " + oldStatus + " to " + target, { oldStatus: oldStatus, newStatus: target });
    return model().normalize(result);
  }
  function createRevision(inputWorkspace, quoteId) {
    var result = workspace(inputWorkspace);
    var source = find(result.entities.quotes, text(quoteId), "Quote");
    if (text(source.status) === "Draft") throw new Error("A Draft Quote can be updated without creating a revision.");
    if (text(source.status) === "Superseded") throw new Error("Create a revision from the latest non-superseded Quote.");
    if (result.entities.quotes.some(function (quote) { return quote.previousQuoteId === source.id || quote.auditRootNumber === source.auditRootNumber && Number(quote.revision || 1) > Number(source.revision || 1); })) throw new Error("A later revision already exists for this Quote root.");
    var adjustments = result.entities.quoteLines.filter(function (line) { return line.quoteId === source.id && line.sourceKind === "custom"; }).map(function (line) {
      return { id: text(line.customLineKey || line.provenance && line.provenance.sourceId || line.id), kind: text(line.kind), category: line.category, description: line.description, unit: line.unit, quantity: line.quantity, rate: line.unitRate };
    });
    return saveDraft(result, {
      projectId: source.projectId, quoteNumber: source.quoteNumber, revision: Math.max(1, Number(source.revision) || 1) + 1,
      auditRootNumber: source.auditRootNumber, rootQuoteId: source.rootQuoteId || source.id, previousQuoteId: source.id,
      clientName: source.clientName, address: source.address, phone: source.phone, email: source.email, preparedBy: source.preparedBy,
      quoteDate: new Date().toISOString().slice(0, 10), expiryDate: source.expiryDate,
      discountRate: source.discountRate, discountAmount: source.discountAmount, contingencyRate: source.contingencyRate, scopeNotes: source.scopeNotes, terms: source.terms, customLines: adjustments,
      fundingMode: source.fundingMode || null, proposedCustomerContribution: source.proposedCustomerContribution,
      suppressCouncilDisclosure: source.suppressCouncilDisclosure === true
    });
  }

function lifecycleActions(inputWorkspace, quoteId) {
 var result = workspace(inputWorkspace);
 var quote = find(result.entities.quotes, text(quoteId), "Quote");
 var status = text(quote.status) || "Draft";
 if (status === "Draft") return ["refresh", "issue", "remove"];
 if (status === "Issued") return ["accept", "decline", "createRevision"];
 if (status === "Accepted" || status === "Declined") return text(quote.supersededByQuoteId) ? [] : ["createRevision"];
 return [];
}

function issue(inputWorkspace, quoteId) { return setStatus(inputWorkspace, quoteId, "Issued"); }
function accept(inputWorkspace, quoteId) { return setStatus(inputWorkspace, quoteId, "Accepted"); }
function decline(inputWorkspace, quoteId) { return setStatus(inputWorkspace, quoteId, "Declined"); }

function recordPayment(inputWorkspace, input) {
    var result = workspace(inputWorkspace);
    input = object(input) ? input : {};
    var quote = find(result.entities.quotes, text(input.quoteId), "Quote");
    if (quote.fundingMode === "city") throw new Error("No customer payment required. Customer payments and deposits are disabled for City-funded Quotes.");
    if (PAYABLE_STATUSES.indexOf(text(quote.status)) < 0) throw new Error("Payments cannot be recorded against a Superseded Quote.");
    var value = money(input.amount);
    if (!(value > 0)) throw new Error("Payment amount must be greater than zero.");
    var paymentDate = text(input.paymentDate);
    if (!validPaymentDate(paymentDate)) throw new Error("Payment date must be a valid date.");
    var method = text(input.method) || "Other";
    if (PAYMENT_METHODS.indexOf(method) < 0) throw new Error("Payment method is not supported.");
    var reference = text(input.reference);
    if (!reference) throw new Error("Payment reference is required.");
    var id = model().stableId(quote.owner, "payment", quote.id + ":" + Date.now().toString(36) + ":" + Math.random().toString(36).slice(2));
    result.entities.payments.push({
      id: id, owner: quote.owner, type: "payment", quoteId: quote.id, quoteAuditNumber: quote.auditNumber, projectId: quote.projectId, amount: value,
      paymentDate: paymentDate,
      method: method, reference: reference, notes: text(input.notes),
      status: "Recorded", provenance: { owner: quote.owner, sourceApp: "uos.quote-builder", sourceVersion: 1, sourceId: id }
    });
    var allocations = Array.isArray(input.allocations) ? input.allocations : [];
    var allocated = allocations.reduce(function (sum, allocation) { return sum + Math.max(0, money(allocation.amount)); }, 0);
    if (allocated > value) throw new Error("Payment allocations cannot exceed the Payment amount.");
    result.entities.paymentAllocations = Array.isArray(result.entities.paymentAllocations) ? result.entities.paymentAllocations : [];
    allocations.forEach(function (allocation, index) {
      var line = find(result.entities.quoteLines, text(allocation.quoteLineId), "Quote line");
      if (line.quoteId !== quote.id || line.projectId !== quote.projectId || line.owner !== quote.owner) throw new Error("Payment allocation must remain within its Quote revision.");
      var allocationAmount = money(allocation.amount); if (!(allocationAmount > 0)) throw new Error("Payment allocation amount must be greater than zero.");
      var allocationId = model().stableId(quote.owner, "paymentAllocation", id + ":" + line.id + ":" + index);
      result.entities.paymentAllocations.push({ id: allocationId, owner: quote.owner, type: "paymentAllocation", paymentId: id, quoteId: quote.id, quoteLineId: line.id, projectId: quote.projectId, amount: allocationAmount, status: "Active", createdAt: new Date().toISOString(), provenance: { owner: quote.owner, sourceApp: "uos.quote-builder", sourceVersion: 4, sourceId: allocationId } });
    });
    return model().normalize(result);
  }

  function reversePayment(inputWorkspace, paymentId, reason) {
    var result = workspace(inputWorkspace);
    var payment = find(result.entities.payments, text(paymentId), "Payment");
    if (payment.status === "Reversed") return result;
    var reversalReason = text(reason);
    if (!reversalReason) throw new Error("A reversal reason is required.");
    payment.status = "Reversed";
    payment.reversedAt = new Date().toISOString();
    payment.reversalReason = reversalReason;
    (result.entities.paymentAllocations || []).forEach(function (allocation) { if (allocation.paymentId === payment.id && allocation.status !== "Reversed") { allocation.status = "Reversed"; allocation.reversedAt = payment.reversedAt; allocation.reversalReason = reversalReason; } });
    return model().normalize(result);
  }

  function paymentSummary(inputWorkspace, quoteId) {
    var result = workspace(inputWorkspace);
    var quote = find(result.entities.quotes, text(quoteId), "Quote");
    var payments = result.entities.payments.filter(function (payment) { return payment.quoteId === quote.id; });
    var activePayments = {}; payments.filter(function (payment) { return payment.status !== "Reversed"; }).forEach(function (payment) { activePayments[payment.id] = payment; });
    var allocations = (result.entities.paymentAllocations || []).filter(function (allocation) { return allocation.quoteId === quote.id && allocation.status !== "Reversed" && activePayments[allocation.paymentId]; });
    var paid = money(Object.keys(activePayments).reduce(function (sum, id) { return sum + activePayments[id].amount; }, 0));
    var depositPaid = money(Object.keys(activePayments).reduce(function (sum, id) { return sum + (activePayments[id].method === "Paid with Deposit" ? activePayments[id].amount : 0); }, 0));
    var linePaid = {}; allocations.forEach(function (allocation) { linePaid[allocation.quoteLineId] = money((linePaid[allocation.quoteLineId] || 0) + allocation.amount); });
    var customer = customerAmounts(quote);
    var balance = quote.fundingMode === "city" ? 0 : money(customer.payable - paid);
    return { total: customer.payable, paid: paid, depositPaid: depositPaid, balance: balance, balanceDue: Math.max(0, balance), credit: Math.max(0, money(-balance)), status: quote.fundingMode === "city" ? "No customer payment required" : paid <= 0 ? "Unpaid" : balance > 0 ? "Partially Paid" : balance < 0 ? "Overpaid" : "Paid", payments: payments, allocations: allocations, linePaid: linePaid };
  }

  function projectQuotes(inputWorkspace, projectId) {
    var result = workspace(inputWorkspace), project = find(result.entities.projects, text(projectId), "Project");
    return clone(result.entities.quotes.filter(function (quote) { return quote.projectId === project.id && quote.owner === project.owner; }).sort(function (a, b) { return text(b.auditRootNumber).localeCompare(text(a.auditRootNumber)) || Number(b.revision || 1) - Number(a.revision || 1); }));
  }
  function quoteRoots(inputWorkspace, projectId) {
    var quotes = projectQuotes(inputWorkspace, projectId), roots = {};
    quotes.forEach(function (quote) { var key = text(quote.auditRootNumber); if (!roots[key]) roots[key] = { auditRootNumber: key, rootQuoteId: quote.rootQuoteId || quote.id, quoteNumber: quote.quoteNumber, latest: quote, revisions: [] }; roots[key].revisions.push(quote); if (Number(quote.revision || 1) > Number(roots[key].latest.revision || 1)) roots[key].latest = quote; });
    return Object.keys(roots).sort().reverse().map(function (key) { roots[key].revisions.sort(function (a, b) { return Number(b.revision || 1) - Number(a.revision || 1); }); return clone(roots[key]); });
  }
  function quoteSnapshot(inputWorkspace, quoteId) {
    var result = workspace(inputWorkspace), quote = find(result.entities.quotes, text(quoteId), "Quote");
    var lines = result.entities.quoteLines.filter(function (line) { return line.quoteId === quote.id && line.owner === quote.owner && line.projectId === quote.projectId; });
    if (lines.length !== result.entities.quoteLines.filter(function (line) { return line.quoteId === quote.id; }).length) throw new Error("Quote snapshot contains cross-project or cross-owner lines.");
    return { quote: clone(quote), lines: clone(lines), payments: paymentSummary(result, quote.id), readOnly: IMMUTABLE.indexOf(text(quote.status)) >= 0 };
  }
  function quoteViewModel(inputWorkspace, quoteId) {
    var snapshot = quoteSnapshot(inputWorkspace, quoteId), quote = snapshot.quote, summary = snapshot.payments;
    return { quote: quote, lines: snapshot.lines, readOnly: snapshot.readOnly, discountRate: money(quote.discountRate), discountAmount: money(quote.discountAmount), depositPaid: summary.depositPaid, paymentsPaid: summary.paid, balanceDue: summary.balanceDue, credit: summary.credit, paymentStatus: summary.status };
  }

  function deletionImpact(inputWorkspace, quoteId) {
    var result = workspace(inputWorkspace);
    var target = find(result.entities.quotes, text(quoteId), "Quote");
    var quoteIds = {};
    quoteIds[target.id] = true;
    var changed = true;
    while (changed) {
      changed = false;
      result.entities.quotes.forEach(function (quote) {
        if (quoteIds[quote.id]) return;
        if (quoteIds[text(quote.previousQuoteId)]) {
          quoteIds[quote.id] = true;
          changed = true;
        }
      });
    }
    var lineIds = result.entities.quoteLines.filter(function (line) { return quoteIds[line.quoteId]; }).map(function (line) { return line.id; });
    var paymentIds = result.entities.payments.filter(function (payment) { return quoteIds[payment.quoteId]; }).map(function (payment) { return payment.id; });
    return { quoteId: target.id, quoteIds: Object.keys(quoteIds), quoteLineIds: lineIds, paymentIds: paymentIds };
  }

  function removeQuote(inputWorkspace, quoteId) {
    var result = workspace(inputWorkspace);
    var target = find(result.entities.quotes, text(quoteId), "Quote");
 if (IMMUTABLE.indexOf(text(target.status)) >= 0) throw new Error("Issued and resolved Quote history cannot be deleted.");
 var impact = deletionImpact(result, quoteId);
 if (impact.quoteIds.length > 1) throw new Error("Draft Quote has dependent revisions and cannot be deleted.");
 if (impact.paymentIds.length || (result.entities.paymentAllocations || []).some(function (allocation) { return allocation.quoteId === target.id; })) throw new Error("Draft Quote has payment history and cannot be deleted.");
 if (result.entities.quotes.some(function (quote) { return text(quote.supersedesQuoteId) === target.id || text(quote.supersededByQuoteId) === target.id; })) throw new Error("Draft Quote has lifecycle dependencies and cannot be deleted.");
 result.entities.quotes = result.entities.quotes.filter(function (quote) { return quote.id !== target.id; });
 result.entities.quoteLines = result.entities.quoteLines.filter(function (line) { return line.quoteId !== target.id; });
 if (Array.isArray(result.entities.quoteEvents)) result.entities.quoteEvents = result.entities.quoteEvents.filter(function (event) { return event.quoteId !== target.id; });
 return { workspace: model().normalize(result), impact: impact };
  }

  UOS.ProgramQuotes = { statuses: STATUSES.slice(), paymentMethods: PAYMENT_METHODS.slice(), inheritProject: inheritProject, evaluateReadiness: evaluateReadiness, commerciallyLocked: function (inputWorkspace, quoteId) { return commerciallyLocked(workspace(inputWorkspace), text(quoteId)); }, saveDraft: saveDraft, updateDraft: saveDraft, refreshDraftFromCurrentCosts: refreshDraftFromCurrentCosts, commercialProjection: commercialProjection, setStatus: setStatus, issue: issue, accept: accept, decline: decline, createRevision: createRevision, lifecycleActions: lifecycleActions, projectQuotes: projectQuotes, quoteRoots: quoteRoots, quoteSnapshot: quoteSnapshot, quoteViewModel: quoteViewModel, recordPayment: recordPayment, reversePayment: reversePayment, paymentSummary: paymentSummary, deletionImpact: deletionImpact, removeQuote: removeQuote, totals: totals };
  UOS.ProgramQuotes.customerAmounts = customerAmounts;
  UOS.ProgramQuotes.suggestedContribution = suggestedContribution;
  UOS.ProgramQuotes.agreementStatus = agreementStatus;
}());
