(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var state = { workspace: null, owner: "", year: "", dialog: null, trigger: null, busy: false, approvalDrafts: {} };
  var currency = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

  function text(value) { return String(value == null ? "" : value).trim(); }
  function escapeHtml(value) { return text(value).replace(/[&<>"']/g, function (char) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]; }); }
  function amount(value) { return currency.format(Number(value) || 0); }
  function entities(name) { return state.workspace && state.workspace.entities && state.workspace.entities[name] || []; }
  function budgetApi() { return UOS.ProgramBudget; }
  function app() { return UOS.ProgramApp; }
  function currentYear() { var today = new Date(), first = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1; return first + "-" + String((first + 1) % 100).padStart(2, "0"); }
  function nextYear(year) { var first = Number(text(year).slice(0, 4)) + 1; return first + "-" + String((first + 1) % 100).padStart(2, "0"); }
  function yearLabel(year) { return "FY " + text(year).replace("-", "/"); }
  function recordFor(id) { return entities("applications").concat(entities("events")).find(function (item) { return item.id === id; }); }
  function recordTitle(record) { return text(record && (record.name || record.title || record.eventName || record.applicantName || record.id)) || "Register record"; }
  function budgetFor(owner, year) { return entities("annualBudgets").find(function (item) { return item.owner === owner && item.financialYear === year; }); }
  function selectedBudget() { return budgetFor(state.owner, state.year); }
  function approvalDraftKey() { return state.owner + ":" + state.year; }
  function approvalDraft() {
    var key = approvalDraftKey();
    if (!state.approvalDrafts[key]) state.approvalDrafts[key] = { amount: "", actor: "", approver: "", reason: "", evidence: "", date: new Date().toISOString().slice(0, 10) };
    return state.approvalDrafts[key];
  }
  function rememberApprovalDraft(form) {
    if (!form || !form.matches("[data-budget-inline-approve]")) return;
    var data = new FormData(form), key = approvalDraftKey();
    state.approvalDrafts[key] = { amount: text(data.get("amount")), actor: text(data.get("actor")), approver: text(data.get("approver")), reason: text(data.get("reason")), evidence: text(data.get("evidence")), date: text(data.get("date")) };
  }
  function approvalEntry(budgetId) {
    return entities("budgetEntries").find(function (entry) { return entry.budgetId === budgetId && entry.kind === "approval"; });
  }
  function reopenAuthorisation(budgetId) {
    var requests = entities("budgetChangeRequests");
    return entities("budgetDecisions").find(function (decision) {
      var request = requests.find(function (item) { return item.id === decision.requestId; });
      return decision.budgetId === budgetId && decision.decision === "approved" && request && request.kind === "reopen-authorisation" &&
        !entities("budgetEntries").some(function (entry) { return entry.kind === "reopen" && entry.decisionId === decision.id; });
    });
  }
  function allocationFor(budgetId, recordId) { return entities("registerAllocations").find(function (item) { return item.budgetId === budgetId && item.registerId === recordId; }); }
  function notice(message, error) {
    var node = document.querySelector("[data-budget-notice]");
    if (!node) return;
    node.textContent = message || "";
    node.hidden = !message;
    node.classList.toggle("is-error", !!error);
    var view = document.querySelector('[data-program-view="budget"]');
    if (message && view && view.hidden && UOS.toast) UOS.toast(message, error ? "error" : "success");
  }
  function button(action, label, disabled, attrs) { return '<button type="button" class="uos-button uos-button--secondary uos-button--sm" data-budget-action="' + action + '"' + (disabled ? ' disabled aria-disabled="true"' : '') + (attrs || "") + '>' + label + '</button>'; }
  function render() {
    var view = document.querySelector('[data-program-view="budget"]');
    if (!view || !state.workspace || !budgetApi()) return;
    var owner = text(state.workspace.workspace && state.workspace.workspace.ownerMode) || "NSA";
    if (owner !== state.owner) { state.owner = owner; state.year = ""; }
    var years = entities("annualBudgets").filter(function (item) { return item.owner === owner; }).map(function (item) { return item.financialYear; });
    years.push(currentYear(), nextYear(currentYear()));
    var previousStart = Number(currentYear().slice(0, 4)) - 1;
    years.push(previousStart + "-" + String((previousStart + 1) % 100).padStart(2, "0"));
    years = Array.from(new Set(years)).sort().reverse();
    if (!state.year || years.indexOf(state.year) < 0) state.year = currentYear();
    var yearSelect = view.querySelector("[data-budget-year]");
    if (yearSelect) { yearSelect.innerHTML = years.map(function (year) { return '<option value="' + escapeHtml(year) + '">' + escapeHtml(yearLabel(year)) + '</option>'; }).join(""); yearSelect.value = state.year; }
    var budget = selectedBudget();
    var statusSlot = view.querySelector("[data-budget-status-slot]");
    if (statusSlot) {
      var status = budget ? (budget.reviewRequired ? "review required" : budget.status) : "";
      statusSlot.innerHTML = status ? '<span class="program-budget__status" data-state="' + escapeHtml(status) + '">' + escapeHtml(status) + '</span>' : "";
      statusSlot.hidden = !status;
    }
    var allocate = view.querySelector('[data-budget-action="allocate"]');
    if (allocate) allocate.hidden = true;
    var stateNode = view.querySelector("[data-budget-year-state]");
 renderTables(view, budget);
    if (stateNode) stateNode.innerHTML = budget ? inlineBudgetPanel(budget) : newBudgetPanel();
    var metrics = view.querySelector("[data-budget-metrics]");
    var balance = budget ? budgetApi().budgetBalance(state.workspace, budget.id) : null;
    if (metrics) metrics.innerHTML = [
      ["Approved", balance ? balance.approved : 0], ["Allocated", balance ? balance.allocated : 0], ["Unallocated", balance ? balance.unallocated : 0]
      ].map(function (metric) { return '<div class="program-budget__metric program-island"><span>' + metric[0] + '</span><strong>' + amount(metric[1]) + '</strong></div>'; }).join("");
    var headerAmount = document.querySelector("[data-budget-header-amount]");
    if (headerAmount) headerAmount.textContent = amount(balance ? balance.unallocated : 0);
    var pending = view.querySelector("[data-budget-pending]");
    if (pending) {
      var requests = budget ? entities("budgetChangeRequests").filter(function (item) { return item.budgetId === budget.id && !entities("budgetDecisions").some(function (decision) { return decision.requestId === item.id; }); }) : [];
      pending.innerHTML = requests.length ? requests.map(function (item) {
        return '<li><strong>' + escapeHtml(item.kind) + '</strong> · ' + amount(item.amountCents / 100) + '<p>' + escapeHtml(item.reason) + '</p>' +
          button("decide", "Approve or reject", false, ' data-budget-request="' + escapeHtml(item.id) + '"') + '</li>';
      }).join("") : '<li class="program-budget__empty">No pending changes.</li>';
    }
  }

 function renderTables(view, budget) {
 var body = view.querySelector("[data-budget-allocations]");
 var pending = view.querySelector("[data-budget-pending]");
 var allocations = budget ? entities("registerAllocations").filter(function (item) { return item.budgetId === budget.id; }) : [];
 if (body) body.innerHTML = allocations.length ? allocations.map(function (allocation) {
 var record = recordFor(allocation.registerId), value = budgetApi().allocationBalance(state.workspace, allocation.id);
 return '<tr><th scope="row"><span class="program-budget__record">' + escapeHtml(recordTitle(record)) + '</span><small>' + escapeHtml(allocation.registerId) + '</small></th><td>' + amount(value.allocated) + '</td><td>' + amount(value.openCommitment) + '</td><td>' + amount(value.actual) + '</td><td>' + amount(value.available) + '</td><td><div class="program-budget__row-actions">' + button("allocation-detail", "Details", false, ' data-budget-allocation="' + escapeHtml(allocation.id) + '"') + button("carry", "Year-end review", budget.status !== "closed", ' data-budget-allocation="' + escapeHtml(allocation.id) + '"') + '</div></td></tr>';
 }).join("") : '<tr><td colspan="6" class="program-budget__empty">' + (budget ? "No Register allocations yet." : "Create an annual budget to begin.") + "</td></tr>";
 var requests = budget ? entities("budgetRequests").filter(function (item) { return item.budgetId === budget.id && !entities("budgetDecisions").some(function (decision) { return decision.requestId === item.id; }); }) : [];
 if (pending) { pending.hidden = false; pending.innerHTML = requests.length ? requests.map(function (item) { return '<li><strong>' + escapeHtml(item.kind) + '</strong> · ' + amount(item.amountCents / 100) + '<p>' + escapeHtml(item.reason) + '</p>' + button("decide", "Approve or reject", false, ' data-budget-request="' + escapeHtml(item.id) + '"') + '</li>'; }).join("") : '<li class="program-budget__empty">No pending changes.</li>'; }
 }
 function field(label, name, type, value, extra) {
    return '<label class="program-budget__field"><span>' + label + '</span><input class="uos-input" name="' + name + '" type="' + type + '" value="' + escapeHtml(value || "") + '"' + (extra || "") + ' required></label>';
  }
  function select(label, name, options) {
    return '<label class="program-budget__field"><span>' + label + '</span><select class="uos-select" name="' + name + '" required>' + options.map(function (item) { return '<option value="' + escapeHtml(item.value) + '">' + escapeHtml(item.label) + '</option>'; }).join("") + '</select></label>';
  }
  function authorityFields() { return field("Recording officer", "actor", "text", "", ' autocomplete="name"') + '<label class="program-budget__field"><span>Named approver</span><input class="uos-input" name="approver" autocomplete="name"></label>' + field("Reason", "reason", "text", "") + field("Evidence", "evidence", "text", "") + field("Effective date", "date", "date", new Date().toISOString().slice(0, 10)); }
  function moneyField(value) { return field("Amount (AUD)", "amount", "number", value || "", ' min="0.01" step="0.01" inputmode="decimal"'); }
  function inlineAuthorityFields(values) {
    return field("Recording officer", "actor", "text", values.actor, ' autocomplete="name"') +
      '<label class="program-budget__field"><span>Named approver</span><input class="uos-input" name="approver" value="' + escapeHtml(values.approver) + '" autocomplete="name" required></label>' +
      field("Reason", "reason", "text", values.reason) + field("Evidence", "evidence", "text", values.evidence);
  }
  function detail(label, value) { return '<div><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value || "Not recorded") + '</dd></div>'; }
  function newBudgetPanel() {
    var draft = approvalDraft();
    return '<form class="program-budget__approval-form" data-budget-form="create-and-approve" data-budget-inline-approve>' +
      '<p class="program-budget__approval-intro">Record annual authority for ' + escapeHtml(yearLabel(state.year)) + '.</p>' +
      '<div class="program-budget__approval-fields">' + moneyField(draft.amount) + field("Effective date", "date", "date", draft.date) + inlineAuthorityFields(draft) + '</div>' +
      '<p class="program-budget__dialog-error" data-budget-dialog-error role="alert" hidden></p>' +
      '<div class="program-budget__approval-actions"><button type="submit" class="uos-button uos-button--primary">Approve budget</button></div></form>';
  }
  function inlineBudgetPanel(budget) {
    if (budget.status === "draft") {
      var draft = approvalDraft();
      return '<form class="program-budget__approval-form" data-budget-form="approve" data-budget-inline-approve data-budget-context="' + escapeHtml(JSON.stringify({ budgetId: budget.id })) + '">' +
        '<p class="program-budget__approval-intro">Record the annual authority for ' + escapeHtml(yearLabel(budget.financialYear)) + '.</p>' +
        '<div class="program-budget__approval-fields">' + moneyField(draft.amount) + field("Effective date", "date", "date", draft.date) + inlineAuthorityFields(draft) + '</div>' +
        '<p class="program-budget__dialog-error" data-budget-dialog-error role="alert" hidden></p>' +
        '<div class="program-budget__approval-actions"><button type="submit" class="uos-button uos-button--primary">Approve budget</button></div></form>';
    }
    var entry = approvalEntry(budget.id);
    var details = entry ? '<dl class="program-budget__approval-details">' +
      detail("Approved authority", amount(budget.approvedAmount)) + detail("Recording officer", entry.actor) + detail("Named approver", budget.approvedBy) +
      detail("Reason", entry.reason) + detail("Evidence", entry.evidence) + detail("Effective date", UOS.imports && UOS.imports.formatDate ? UOS.imports.formatDate(entry.effectiveDate || text(entry.createdAt).slice(0, 10)) : (entry.effectiveDate || text(entry.createdAt).slice(0, 10))) + '</dl>' :
      '<p class="program-budget__muted">Recorded approval details are unavailable for this imported year.</p>';
    details = "";
    return details +
      (budget.reviewRequired ? button("reconcile", "Reconcile year", false) : "") +
      (budget.status === "open" ? button("adjust", "Adjust budget", !!budget.reviewRequired) + button("transfer", "Transfer allocation", !!budget.reviewRequired) + button("close", "Close year", !!budget.reviewRequired) : "") +
      (budget.status === "closed" ? (reopenAuthorisation(budget.id) ? button("apply-reopen", "Apply reopen", false) : button("reopen", "Record reopen decision", !!budget.reviewRequired)) : "");
  }
  function closeDialog() { if (state.dialog && state.dialog.open) state.dialog.close(); }
  function showDialog(title, description, content, operation, context) {
    if (!state.dialog) {
      state.dialog = document.createElement("dialog");
      state.dialog.className = "program-budget__dialog";
      state.dialog.setAttribute("aria-labelledby", "program-budget-dialog-title");
      document.body.appendChild(state.dialog);
      state.dialog.addEventListener("close", function () { if (state.trigger && state.trigger.isConnected) state.trigger.focus(); state.trigger = null; });
    }
    if (state.dialog.open) state.dialog.close();
    state.trigger = document.activeElement;
    state.dialog.innerHTML = '<form method="dialog" class="program-budget__dialog-form" data-budget-form="' + operation + '"><div class="program-budget__dialog-head"><h2 id="program-budget-dialog-title">' + escapeHtml(title) + '</h2><button type="button" class="program-budget__dialog-close" data-budget-cancel aria-label="Close dialog">×</button></div><p>' + escapeHtml(description) + '</p><div class="program-budget__dialog-fields">' + content + '</div><p class="program-budget__dialog-error" data-budget-dialog-error role="alert" hidden></p><div class="program-budget__dialog-actions"><button type="button" class="uos-button uos-button--secondary" data-budget-cancel>Cancel</button>' + (operation === "allocate" ? '<button type="submit" name="submitDecision" value="draft" class="uos-button uos-button--secondary">Save draft</button>' : "") + '<button type="submit" name="submitDecision" value="approved" class="uos-button uos-button--primary">Confirm</button></div></form>';
    state.dialog.dataset.context = JSON.stringify(context || {});
    state.dialog.showModal();
  }
  function openAllocation(recordId) {
    if (!state.workspace) return notice("Open a workspace before allocating funds.", true);
    var record = recordId ? recordFor(recordId) : null, owner = record ? record.owner : state.owner;
    var budgets = entities("annualBudgets").filter(function (item) { return item.owner === owner; }).sort(function (a, b) { return b.financialYear.localeCompare(a.financialYear); });
    if (!budgets.length) {
      showDialog("Allocate Register funds", "Create and approve an annual budget for " + owner + " before allocating funds to this Register record.", "", "allocate", {});
      state.dialog.querySelectorAll('[type="submit"]').forEach(function (button) { button.disabled = true; });
      return;
    }
    var records = entities("applications").concat(entities("events")).filter(function (item) { return item.owner === owner; });
    if (!records.length) {
      showDialog("Allocate Register funds", "No " + owner + " Register records are available for allocation.", "", "allocate", {});
      state.dialog.querySelectorAll('[type="submit"]').forEach(function (button) { button.disabled = true; });
      return;
    }
    var selected = budgets.find(function (item) { return item.financialYear === state.year; }) || budgets[0];
    var budgetOptions = budgets.map(function (item) { return { value: item.id, label: yearLabel(item.financialYear) + " · " + amount(budgetApi().budgetBalance(state.workspace, item.id).unallocated) + " unallocated" }; });
    var recordOptions = records.map(function (item) { return { value: item.id, label: recordTitle(item) + " · " + item.id }; });
    var html = select("Annual budget", "budgetId", budgetOptions) + select("Register record", "registerId", recordOptions) + select("Change", "direction", [{ value: "increase", label: "Increase allocation" }, { value: "decrease", label: "Reduce allocation" }]) + moneyField("") + authorityFields();
    showDialog("Allocate Register funds", "Funds are held by the Register record, including records without a Project.", html, "allocate", { budgetId: selected.id, registerId: recordId || "" });
    state.dialog.querySelector('[name="budgetId"]').value = selected.id;
    if (record) state.dialog.querySelector('[name="registerId"]').value = record.id;
    var contextNode = document.createElement("p");
    contextNode.className = "program-budget__allocation-context";
    contextNode.setAttribute("data-budget-allocation-context", "");
    contextNode.setAttribute("aria-live", "polite");
    state.dialog.querySelector(".program-budget__dialog-fields").prepend(contextNode);
    refreshAllocationContext();
  }
  function refreshAllocationContext() {
    var form = state.dialog && state.dialog.querySelector('[data-budget-form="allocate"]');
    if (!form || !state.workspace || !form.elements.budgetId) return;
    var budget = entities("annualBudgets").find(function (item) { return item.id === form.elements.budgetId.value; });
    var allocation = budget && entities("registerAllocations").find(function (item) { return item.budgetId === budget.id && item.registerId === form.elements.registerId.value; });
    var balance = budget && budgetApi().budgetBalance(state.workspace, budget.id);
    var existing = allocation ? budgetApi().allocationBalance(state.workspace, allocation.id) : null;
    var requested = Number(form.elements.amount.value || 0) * (form.elements.direction.value === "decrease" ? -1 : 1);
    var message = balance ? "Approved authority " + amount(balance.approved) + " · Existing Register allocation " + amount(existing ? existing.allocated : 0) + " · Remaining annual funds " + amount(balance.unallocated) : "No approved annual authority.";
    if (budget && budget.status !== "open") message += " · This financial year is " + budget.status + ".";
    else if (budget && budget.reviewRequired) message += " · Review and reconcile this year before financial changes.";
    else if (requested > 0 && balance && requested > balance.unallocated) message += " · Shortfall " + amount(requested - balance.unallocated) + ".";
    else if (requested < 0 && existing && -requested > existing.available) message += " · Reduction exceeds uncommitted funds.";
    form.querySelector("[data-budget-allocation-context]").textContent = message;
    var closed = !budget || budget.status !== "open" || budget.reviewRequired;
    var shortfall = requested > 0 && balance && requested > balance.unallocated || requested < 0 && (!existing || -requested > existing.available);
    form.querySelector('button[value="approved"]').disabled = Boolean(closed || shortfall);
    form.querySelector('button[value="draft"]').disabled = Boolean(closed);
  }
  function carryCandidates(recordId, sourceId) {
    return entities("registerAllocations").filter(function (allocation) { return (!recordId || allocation.registerId === recordId) && (!sourceId || allocation.id === sourceId); }).map(function (allocation) {
      var from = entities("annualBudgets").find(function (item) { return item.id === allocation.budgetId; });
      var to = from && budgetFor(from.owner, nextYear(from.financialYear));
      var balance = budgetApi().allocationBalance(state.workspace, allocation.id);
      return from && from.status === "closed" ? { allocation: allocation, from: from, to: to, available: balance.available } : null;
    }).filter(Boolean);
  }
  function openCarryForward(recordId, sourceId) {
    var candidates = carryCandidates(recordId, sourceId);
    if (!candidates.length) {
      showDialog("Review carry-forward", "No allocation in a closed year is available for this Register record.", "", "detail", {});
      state.dialog.querySelector('[type="submit"]').disabled = true;
      return;
    }
    var options = candidates.map(function (item) { return { value: item.allocation.id, label: recordTitle(recordFor(item.allocation.registerId)) + " · " + yearLabel(item.from.financialYear) + " → " + yearLabel(nextYear(item.from.financialYear)) + " · " + amount(item.available) + " unspent" }; });
    var selected = candidates[0];
    var review = entities("budgetCarryReviews").filter(function (item) { return item.sourceAllocationId === selected.allocation.id; }).slice(-1)[0];
    if (!review || review.answer !== "Yes") {
      showDialog("Year-end carry-forward review", "Record Yes or No. This review does not move funds or change either annual authority.", select("Source allocation", "sourceAllocationId", options) + select("Carry forward?", "answer", [{ value: "No", label: "No" }, { value: "Yes", label: "Yes" }]) + authorityFields(), "carry-review", {});
      return;
    }
    if (!selected.to || selected.to.status !== "open" || selected.available <= 0) {
      showDialog("Carry-forward proposal unavailable", "The review is recorded. A positive unspent balance and an approved open next-year budget are required before a proposal.", "", "detail", {});
      state.dialog.querySelector('[type="submit"]').hidden = true;
      return;
    }
    showDialog("Propose carry-forward", "Verified unspent funds require a recorded approval before next-year authority changes.", select("Source allocation", "sourceAllocationId", options) + moneyField(selected.available) + authorityFields(), "carry", {});
  }
  function openAction(action, element) {
    var budget = selectedBudget(), budgetId = budget && budget.id;
    if (action === "create") {
      var years = [state.year, currentYear(), nextYear(currentYear())].filter(function (year, index, list) { return year && list.indexOf(year) === index && !budgetFor(state.owner, year); });
      showDialog("Create annual budget", "Create a draft for the selected owner and financial year.", select("Financial year", "financialYear", years.map(function (year) { return { value: year, label: yearLabel(year) }; })), "create", {});
      return;
    }
    if (action === "allocate") return openAllocation(element && element.getAttribute("data-budget-record"));
    if (action === "carry") return openCarryForward("", element && element.getAttribute("data-budget-allocation"));
    if (action === "allocation-detail") {
      var selectedAllocation = entities("registerAllocations").find(function (item) { return item.id === element.getAttribute("data-budget-allocation"); });
      if (!selectedAllocation) return;
      var detail = budgetApi().allocationBalance(state.workspace, selectedAllocation.id);
      showDialog("Allocation detail", "Register allocation and Job charges for this financial year.",
        '<p>Planned cost ' + amount(detail.plannedCost) + ' · Allocated ' + amount(detail.allocated) + ' · Committed ' + amount(detail.openCommitment) + ' · Actual ' + amount(detail.actual) + ' · Forecast ' + amount(detail.forecast) + ' · Available ' + amount(detail.available) + '</p>' +
        button("charge", "Record Job charge", selectedBudget().status !== "open", ' data-budget-allocation="' + escapeHtml(selectedAllocation.id) + '"'), "detail", {});
      state.dialog.querySelector('[type="submit"]').hidden = true;
      return;
    }
    if (action === "decide") return showDialog("Decide pending change", "An approval posts the change. A rejection leaves balances unchanged.",
      select("Decision", "decision", [{ value: "approved", label: "Approve" }, { value: "rejected", label: "Reject" }]) +
      field("Named approver", "approver", "text", "") + field("Decision evidence", "evidence", "text", ""), "decide", { requestId: element.getAttribute("data-budget-request") });
    if (!budget) return;
    if (action === "reconcile") return showDialog("Reconcile annual authority", "Record evidence for this legacy year's existing amount before new financial changes.", authorityFields(), "reconcile", { budgetId: budgetId });
    if (action === "apply-reopen") return showDialog("Apply recorded reopen", "The approved reopen decision is already recorded. Applying it opens this year for governed changes.", "", "apply-reopen", { budgetId: budgetId, decisionId: reopenAuthorisation(budgetId).id });
    if (action === "adjust") return showDialog("Adjust annual budget", "A supplement adds funds. A reduction can only use unallocated funds.", select("Change", "kind", [{ value: "supplement", label: "Supplement" }, { value: "reduction", label: "Reduction" }]) + moneyField("") + authorityFields(), "adjust", { budgetId: budgetId });
    if (action === "transfer") {
      var sourceAllocations = entities("registerAllocations").filter(function (item) { return item.budgetId === budgetId; });
      var targetRecords = entities("applications").concat(entities("events")).filter(function (item) { return item.owner === budget.owner; });
      if (!sourceAllocations.length || targetRecords.length < 2) return notice("A transfer needs an existing allocation and another Register record for this owner.", true);
      return showDialog("Transfer allocation", "A linked debit and credit post together after approval. Protected commitments and actuals remain funded.",
        select("From Register", "registerId", sourceAllocations.map(function (item) { return { value: item.registerId, label: recordTitle(recordFor(item.registerId)) + " · " + item.registerId }; })) +
        select("To Register", "targetRegisterId", targetRecords.map(function (item) { return { value: item.id, label: recordTitle(item) + " · " + item.id }; })) + moneyField("") + authorityFields(), "transfer", { budgetId: budgetId });
    }
    if (action === "close" || action === "reopen") return showDialog(action === "close" ? "Close financial year" : "Record reopen decision", action === "close" ? "Closed years cannot receive allocations or Job charges." : "Record a separate approval before reopening this year.", authorityFields(), action, { budgetId: budgetId });
    if (action === "charge") {
      var allocationId = element.getAttribute("data-budget-allocation"), allocation = entities("registerAllocations").find(function (item) { return item.id === allocationId; });
      var projects = entities("projects").filter(function (item) { return item.applicationId === allocation.registerId || item.eventId === allocation.registerId; });
      var jobs = entities("jobs").filter(function (item) { return projects.some(function (project) { return project.id === item.projectId; }); });
      if (!jobs.length) return notice("Create a Job in the linked Project before charging this allocation.", true);
      return showDialog("Charge Job", "Record a commitment, actual charge, or release unused commitment for this Register allocation.", select("Job", "jobId", jobs.map(function (item) {
        var charges = entities("budgetCharges").filter(function (charge) { return charge.allocationId === allocationId && charge.jobId === item.id; });
        var open = charges.reduce(function (total, charge) { return total + (charge.kind === "commitment" ? Number(charge.amount) : charge.kind === "release" ? -Number(charge.amount) : 0); }, 0);
        return { value: item.id, label: text(item.title || item.name || item.id) + " · " + item.id + " · " + amount(open) + " open commitment" };
      })) + select("Charge", "kind", [{ value: "commitment", label: "Commitment" }, { value: "actual", label: "Actual" }, { value: "release", label: "Release commitment" }]) + moneyField("") + authorityFields(), "charge", { allocationId: allocationId });
    }
  }
  function submit(event) {
    event.preventDefault();
    if (state.busy) return;
    var form = event.target, operation = form.getAttribute("data-budget-form"), data = new FormData(form), context = JSON.parse(form.dataset.budgetContext || (state.dialog && state.dialog.dataset.context) || "{}"), actor = text(data.get("actor")), reason = text(data.get("reason")), date = text(data.get("date")), value = Number(data.get("amount"));
    var decision = event.submitter && event.submitter.value === "draft" ? "draft" : "approved";
    var options = { actor: actor, approver: text(data.get("approver")), reason: reason, evidence: text(data.get("evidence")), date: date, amount: value, decision: decision, saveDraft: decision === "draft" }, api = budgetApi();
    var errorNode = form.querySelector("[data-budget-dialog-error]");
    var confirm = form.querySelector('[type="submit"]');
    if (operation !== "create" && operation !== "decide" && operation !== "apply-reopen" && (!actor || !reason || !date || !options.evidence || (decision === "approved" && operation !== "carry-review" && !options.approver))) { errorNode.textContent = "Enter a recording officer, approver, reason, evidence and effective date."; errorNode.hidden = false; return; }
    if (["create-and-approve", "approve", "adjust", "allocate", "charge", "carry", "transfer"].indexOf(operation) >= 0 && (!Number.isFinite(value) || value < 0 || (["approve", "create-and-approve"].indexOf(operation) < 0 && value === 0))) { errorNode.textContent = "Enter a valid amount."; errorNode.hidden = false; return; }
    state.busy = true; confirm.disabled = true; errorNode.hidden = true;
    app().updateWorkspace(function (workspace) {
      if (operation === "create-and-approve") {
        var created = api.createAnnualBudget(workspace, { owner: state.owner, financialYear: state.year });
        var createdBudget = created.entities.annualBudgets.find(function (item) { return item.owner === state.owner && item.financialYear === state.year; });
        return api.approveAnnualBudget(created, createdBudget.id, options);
      }
      if (operation === "create") return api.createAnnualBudget(workspace, { owner: state.owner, financialYear: text(data.get("financialYear")) });
      if (operation === "decide") return api.decideRequest(workspace, context.requestId, { decision: text(data.get("decision")), approver: text(data.get("approver")), evidence: text(data.get("evidence")) });
      if (operation === "reconcile") return api.reconcileYear(workspace, context.budgetId, options);
      if (operation === "carry-review") return api.recordCarryReview(workspace, text(data.get("sourceAllocationId")), text(data.get("answer")), options);
      if (operation === "transfer") return api.transferAllocation(workspace, context.budgetId, text(data.get("registerId")), text(data.get("targetRegisterId")), options);
      if (operation === "approve") return api.approveAnnualBudget(workspace, context.budgetId, options);
      if (operation === "adjust") { options.kind = text(data.get("kind")); options.amount *= options.kind === "reduction" ? -1 : 1; return api.adjustAnnualBudget(workspace, context.budgetId, options); }
      if (operation === "allocate") {
        options.amount *= text(data.get("direction")) === "decrease" ? -1 : 1;
        return api.allocateOrDraft(workspace, text(data.get("budgetId")), text(data.get("registerId")), options);
      }
      if (operation === "charge") {
        options.kind = text(data.get("kind"));
        if (options.kind === "release") return api.releaseJobCommitment(workspace, context.allocationId, text(data.get("jobId")), options);
        return api.chargeJob(workspace, context.allocationId, text(data.get("jobId")), options);
      }
      if (operation === "close") return api.closeYear(workspace, context.budgetId, options);
      if (operation === "reopen") return api.recordReopenDecision(workspace, context.budgetId, options);
      if (operation === "apply-reopen") return api.reopenYear(workspace, context.budgetId, { decisionId: context.decisionId });
      if (operation === "carry") {
        var sourceId = text(data.get("sourceAllocationId")), source = workspace.entities.registerAllocations.find(function (item) { return item.id === sourceId; });
        var from = workspace.entities.annualBudgets.find(function (item) { return item.id === source.budgetId; });
        var destination = workspace.entities.annualBudgets.find(function (item) { return item.owner === from.owner && item.financialYear === nextYear(from.financialYear); });
        return api.carryForward(workspace, sourceId, destination.id, options);
      }
      return workspace;
    }, { command: "budget." + operation }).then(function () {
      if (operation === "create") state.year = text(data.get("financialYear"));
      if (operation === "approve" && form.matches("[data-budget-inline-approve]")) delete state.approvalDrafts[approvalDraftKey()];
      closeDialog(); notice("Budget change saved.", false);
    }).catch(function (error) { errorNode.textContent = error && error.message || "Budget change could not be saved."; errorNode.hidden = false; }).finally(function () { state.busy = false; confirm.disabled = false; });
  }
  function bind() {
    if (!document.querySelector('[data-program-view="budget"]')) return;
    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-budget-cancel]")) { closeDialog(); return; }
      var control = event.target.closest("[data-budget-action]");
      if (control && !control.disabled) { event.preventDefault(); openAction(control.getAttribute("data-budget-action"), control); }
    });
    document.addEventListener("submit", function (event) { if (event.target.matches("[data-budget-form]")) submit(event); });
    document.addEventListener("change", function (event) {
      if (event.target.matches("[data-budget-year]")) { state.year = event.target.value; notice(""); render(); }
      if (event.target.closest('[data-budget-form="allocate"]')) refreshAllocationContext();
    });
    document.addEventListener("input", function (event) {
      if (event.target.closest("[data-budget-inline-approve]")) rememberApprovalDraft(event.target.closest("[data-budget-inline-approve]"));
      if (event.target.closest('[data-budget-form="allocate"]')) refreshAllocationContext();
    });
    document.addEventListener("uos:program-ready", function (event) { if (event.detail && event.detail.workspace) { state.workspace = event.detail.workspace; render(); } });
    if (app() && typeof app().workspace === "function") { state.workspace = app().workspace(); render(); }
  }
  UOS.ProgramBudgetUI = { openAllocation: openAllocation, openCarryForward: openCarryForward, render: render, hasConfirmedCarryForward: function (recordId) {
    return entities("allocationEntries").some(function (entry) { return entry.kind === "carryForward" && entities("registerAllocations").some(function (allocation) { return allocation.id === entry.allocationId && allocation.registerId === recordId; }); });
  } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true }); else bind();
}());
