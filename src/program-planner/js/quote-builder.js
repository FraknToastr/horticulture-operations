(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var rootNode = null;
  var initialized = false;
  var quoteSearchQuery = "";
  var quoteJobFilter = "all";
  var quoteStatusFilters = [];
  var preserveProjectListUntil = 0;
  var pendingDraftSaves = 0;


  var state = {
    workspace: null,
    quoteNumber: "",
    quoteDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    preparedBy: "",
    quoteId: "",
    auditNumber: "",
    previousAuditNumber: "",
    status: "Draft",
    revision: 1,
    selectedEntityId: "",
    clientName: "",
    address: "",
    email: "",
    discountRate: 0,
    contingencyRate: 0,
    operationalAmount: 0,
    fundingMode: "customer",
    proposedCustomerContribution: null,
    suppressCouncilDisclosure: false,
    scopeNotes: "",
    terms: "",
    viewMode: "itemised",
    ownerMode: "NSA",
    lines: [],
    payments: []
  };

function workspaceSnapshot() {
    var liveWorkspace = window.UOS && window.UOS.ProgramApp && typeof window.UOS.ProgramApp.workspace === "function"
      ? window.UOS.ProgramApp.workspace()
      : null;
    return liveWorkspace || state.workspace;
}

function customerDetailsForProject(project, workspace) {
  var model = UOS.ProgramModel;
  var source = model && typeof model.registerForProject === "function" ? model.registerForProject(workspace, project) : null;
  source = source || project;
  function first(names) {
    var containers = [source, source && source.raw, source && source.payload];
    for (var i = 0; i < names.length; i += 1) {
      for (var j = 0; j < containers.length; j += 1) {
        var value = containers[j] && containers[j][names[i]];
        if (typeof value === "string" && value.trim()) return value.trim();
      }
    }
    return "";
  }
  return {
    name: first(["customerName", "applicantName", "contactName", "clientName", "contactPerson"]) || text(source && (source.name || source.eventName || source.title)) || text(project.name || project.title),
    address: first(["address", "siteAddress"]) || (model && typeof model.displayAddressForProject === "function" ? model.displayAddressForProject(workspace, project) : text(project.address || project.location)),
    email: first(["customerEmail", "email", "emailAddress", "contactEmail"])
  };
}

function lifecycleActionKeys() {
    var quotes = window.UOS && window.UOS.ProgramQuotes;
    if (!state.quoteId) return state.selectedEntityId ? ["issue"] : [];
  if (!quotes || typeof quotes.lifecycleActions !== "function") return [];
    var result = quotes.lifecycleActions(workspaceSnapshot(), state.quoteId);
    if (Array.isArray(result)) return result.map(text);
    if (result && Array.isArray(result.actions)) return result.actions.map(text);
    if (result && typeof result === "object") {
        return Object.keys(result).filter(function (key) { return result[key] === true; });
    }
    return [];
}

function hasLifecycleAction(actions, names) {
    return names.some(function (name) { return actions.indexOf(name) >= 0; });
}

  function resetProjectListFilters() {
    quoteSearchQuery = "";
    quoteJobFilter = "all";
    quoteStatusFilters = [];
    var searchInput = rootNode && rootNode.querySelector("[data-quote-project-search]");
    if (searchInput) searchInput.value = "";
  }

  function text(val) { return String(val == null ? "" : val).trim(); }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function num(val) { var n = parseFloat(val); return isNaN(n) ? 0 : n; }
  function money(val) {
    try { return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(num(val)); }
    catch (e) { return "$" + num(val).toFixed(2); }
  }

  function ledgerError(error) {
    var message = error && error.message ? error.message : "The payment action could not be completed.";
    if (window.UOS && window.UOS.dialogs && typeof window.UOS.dialogs.alert === "function") {
      return window.UOS.dialogs.alert({ title: "Payment ledger", message: message });
    }
    if (window.UOS && typeof window.UOS.toast === "function") window.UOS.toast(message, "error");
    return Promise.resolve(false);
  }

  function reversePaymentWithReason(paymentId) {
    var dialogs = window.UOS && window.UOS.dialogs;
    var reasonField = document.createElement("label");
    reasonField.className = "program-payment-reversal-field";
    reasonField.textContent = "Reason for reversal";
    var textarea = document.createElement("textarea");
    textarea.className = "uos-textarea uos-textarea--sm";
    textarea.maxLength = 240;
    textarea.required = true;
    reasonField.appendChild(textarea);
    var confirmation = dialogs && typeof dialogs.open === "function"
      ? dialogs.open({ title: "Reverse payment?", node: reasonField, actions: [
          { label: "Keep payment", value: false },
          { label: "Reverse payment", value: true, danger: true }
        ] })
      : Promise.resolve(window.confirm("Reverse this payment?") ? true : false);
    return confirmation.then(function (confirmed) {
      if (!confirmed) return null;
      var reason = text(textarea.value || (typeof window.prompt === "function" ? window.prompt("Reason for reversal") : ""));
      if (!reason) throw new Error("A reversal reason is required.");
      return window.UOS.ProgramApp.updateWorkspace(function (workspace) {
        return window.UOS.ProgramQuotes.reversePayment(workspace, paymentId, reason);
      }).then(function (workspace) {
        state.workspace = workspace || state.workspace;
        var quote = workspace && workspace.entities && (workspace.entities.quotes || []).find(function (item) { return item.id === state.quoteId; });
        var project = quote && (workspace.entities.projects || []).find(function (item) { return item.id === quote.projectId; });
        if (quote && project) loadQuoteRecord(project, quote); else renderBuilder();
        if (window.UOS && window.UOS.toast) window.UOS.toast("Payment reversal recorded in Section 5 Payment Ledger.", "success");
      });
    }).catch(ledgerError);
  }

  function cleanDescription(desc) {
    if (!desc) return "Work Item";
    var str = String(desc).trim();
    if (str.indexOf(" - ") > 0) {
      str = str.split(" - ")[0].trim();
    }
    if (str.indexOf(" (") > 0) {
      str = str.split(" (")[0].trim();
    }
    return str;
  }

  function quoteLineKind(line) {
    if (line.kind) return line.kind;
    var ws = workspaceSnapshot();
    var costing = (ws.entities.costingLines || []).find(function (item) { return item.id === (line.costingLineId || line.id); });
    if (costing && costing.kind) return costing.kind;
    var rateId = line.rateItemId || line.catalogId || costing && (costing.rateItemId || costing.catalogId);
    var rate = (ws.entities.rateItems || []).find(function (item) { return item.id === rateId; });
    if (rate && rate.kind) return rate.kind;
    var legacy = { Material: 'Materials', Materials: 'Materials', Labour: 'Labour', Contractor: 'Contractors', Contractors: 'Contractors', Equipment: 'Equipment', Sundry: 'Sundry' };
    return legacy[line.category] || 'Sundry';
  }

  function getCategoryGroups() {
    var defaultCategories = ["Materials", "Labour", "Contractor", "Sundry"];
    var groups = {};

    defaultCategories.forEach(function (cat) {
      groups[cat.toLowerCase()] = { name: cat, lines: [], total: 0 };
    });

    state.lines.forEach(function (line) {
      var rawCat = text(quoteLineKind(line));
      var key = rawCat.toLowerCase();
      if (key === "material") key = "materials";
      if (key === "labor" || key === "labour") key = "labour";
      if (key === "equipment") key = "sundry";

      if (!groups[key]) {
        groups[key] = { name: rawCat, lines: [], total: 0 };
      }
      groups[key].lines.push(line);
      groups[key].total += num(line.total);
    });

    return groups;
  }

  function calculateTotals() {
    var subtotal = 0;
    var materialsTotal = 0;
    var labourTotal = 0;
    var equipmentTotal = 0;

    state.lines.forEach(function (line) {
      var t = num(line.total);
      subtotal += t;
      var c = text(quoteLineKind(line)).toLowerCase();
      if (c === "materials" || c === "material") materialsTotal += t;
      else if (c === "labour" || c === "labor") labourTotal += t;
      else equipmentTotal += t;
    });

    var discountAmount = Math.round(subtotal * (num(state.discountRate) / 100) * 100) / 100;
    var contingencyAmount = Math.round(subtotal * (num(state.contingencyRate) / 100) * 100) / 100;
    var subtotalExGst = subtotal + contingencyAmount - discountAmount;
    var gstAmount = Math.round(subtotalExGst * 0.10 * 100) / 100;
    var grandTotal = Math.round((subtotalExGst + gstAmount) * 100) / 100;
    var saved = state.quoteId && workspaceSnapshot().entities.quotes.find(function (quote) { return quote.id === state.quoteId; });
    if (saved && ["Issued", "Accepted", "Declined", "Superseded"].indexOf(saved.status) >= 0) {
      subtotal = saved.subtotal; gstAmount = saved.gst; grandTotal = saved.grandTotal;
      subtotalExGst = Math.round((grandTotal - gstAmount) * 100) / 100;
    }

    return {
      subtotal: subtotal,
      materialsTotal: materialsTotal,
      labourTotal: labourTotal,
      equipmentTotal: equipmentTotal,
      discountAmount: discountAmount,
      contingencyAmount: contingencyAmount,
      subtotalExGst: subtotalExGst,
      gstAmount: gstAmount,
      grandTotal: grandTotal
    };
  }

  function customerQuote(totals) {
    totals = totals || calculateTotals();
    return { id: state.quoteId, projectId: state.selectedEntityId, status: state.status,
      fundingMode: state.fundingMode, proposedCustomerContribution: state.proposedCustomerContribution,
      grandTotal: totals.grandTotal, gst: totals.gstAmount };
  }
  function suggestedCustomerAmount() {
    var quote = customerQuote();
    var position = UOS.ProjectFunding.position(workspaceSnapshot(), state.selectedEntityId, { quote: quote });
    return UOS.ProgramQuotes.suggestedContribution(quote, position.availableCityAllocation);
  }
  function renderFundingChoice(locked) {
    Array.prototype.forEach.call(rootNode.querySelectorAll("[data-quote-funding-mode]"), function (input) {
      input.checked = input.value === state.fundingMode; input.disabled = locked || !state.selectedEntityId;
    });
    var note = rootNode.querySelector("[data-funding-choice-note]");
    if (note) note.textContent = !state.fundingMode ? "Choose a funding arrangement" : state.fundingMode === "city" ? "No customer payment required" : "Issuing offers the proposed amount. Customer acceptance confirms agreement.";
    var allocationNote = rootNode.querySelector("[data-city-allocation-note]");
    if (allocationNote) allocationNote.textContent = state.fundingMode === "customer" ? "Available — excluded from this Quote" : "Allocation is managed separately in Budget.";
    var field = rootNode.querySelector("[data-mixed-contribution-field]");
    if (field) field.hidden = state.fundingMode !== "mixed";
    var disclosureField = rootNode.querySelector("[data-council-disclosure-field]");
    if (disclosureField) disclosureField.hidden = state.fundingMode !== "mixed";
    var disclosureInput = rootNode.querySelector("[data-quote-suppress-council-disclosure]");
    if (disclosureInput) {
      disclosureInput.checked = state.suppressCouncilDisclosure === true;
      disclosureInput.disabled = locked || !state.selectedEntityId || state.fundingMode !== "mixed";
    }
    var input = rootNode.querySelector("[data-quote-customer-contribution]");
    if (input) {
      input.disabled = locked || !state.selectedEntityId;
      if (document.activeElement !== input) input.value = state.proposedCustomerContribution == null ? "" : state.proposedCustomerContribution;
    }
    var suggestion = state.selectedEntityId ? suggestedCustomerAmount() : 0;
    var hint = rootNode.querySelector("[data-customer-suggestion]");
    if (hint) hint.textContent = "Suggested contribution: " + money(suggestion) + " ex GST";
    var useButton = rootNode.querySelector("[data-use-suggested-contribution]");
    if (useButton) { useButton.hidden = state.fundingMode !== "mixed" || Math.abs(suggestion - num(state.proposedCustomerContribution)) < 0.005; useButton.disabled = locked; }
    var agreement = UOS.ProgramQuotes.agreementStatus(customerQuote());
    Array.prototype.forEach.call(rootNode.querySelectorAll("[data-customer-agreement]"), function (node) { node.textContent = "— " + agreement; });
    var coverage = rootNode.querySelector("[data-proposed-coverage-note]");
    if (coverage) coverage.replaceChildren(document.createTextNode("Proposed coverage (ex GST)."), document.createElement("br"), document.createTextNode("Customer Agreement: " + agreement + "."));
  }

  function privacyDisplay(value, semanticField) {
    var privacy = window.UOS && window.UOS.ProgramPrivacy;
    return privacy && typeof privacy.privacyDisplay === "function" ? privacy.privacyDisplay(value, semanticField) : value;
  }

  function syncPiiInput(input, value, semanticField, normalType) {
    if (!input) return;
    var privacy = window.UOS && window.UOS.ProgramPrivacy;
    if (privacy && typeof privacy.applyToInput === "function") {
      privacy.applyToInput(input, value, semanticField, { type: normalType || "text" });
      return;
    }
    var masked = privacy && privacy.isEnabled() && Boolean(value) && privacy.isSensitivePiiField(semanticField);
    if (masked) {
      if (document.activeElement === input) input.blur();
      input.type = "text";
      input.value = privacy.MASK;
      input.readOnly = true;
      input.classList.add("is-privacy-masked");
      input.title = "Privacy Mode active - disable Privacy Mode in the header to view or edit this field.";
      return;
    }
    input.type = normalType || "text";
    input.readOnly = false;
    input.classList.remove("is-privacy-masked");
    input.removeAttribute("title");
    if (document.activeElement !== input) input.value = value || "";
  }

  function renderBuilder() {
    if (quoteSectionNavigation) quoteSectionNavigation.schedule();
    // Drawer transitions may replace the form node while persistence is in flight.
    rootNode = document.querySelector("[data-program-view='quotes']") || rootNode;
    if (!rootNode) return;

    var drawerUI = UOS.ProgramDrawerWorkspace;
    var position = drawerUI && drawerUI.captureQuotePosition();
    rootNode.setAttribute("data-quote-position-context", (state.quoteId || "new") + ":" + state.selectedEntityId + ":" + state.revision);
    var numInput = rootNode.querySelector("[data-quote-num]");
    var dateInput = rootNode.querySelector("[data-quote-date]");
    var expiryInput = rootNode.querySelector("[data-quote-expiry]");
    var clientInput = rootNode.querySelector("[data-quote-client]");
    var addrInput = rootNode.querySelector("[data-quote-address]");
    var emailInput = rootNode.querySelector("[data-quote-email]");
    var prepInput = rootNode.querySelector("[data-quote-prepared]");
    var discInput = rootNode.querySelector("[data-quote-discount]");
    var contInput = rootNode.querySelector("[data-quote-contingency]");
    var scopeInput = rootNode.querySelector("[data-quote-scope]");
    var termsInput = rootNode.querySelector("[data-quote-terms]");
    var operationalInput = rootNode.querySelector("[data-operational-amount]");
  var statusInput = rootNode.querySelector("[data-quote-status]");
  var revisionButton = rootNode.querySelector("[data-quote-revision]");
  var refreshButton = rootNode.querySelector("[data-quote-refresh]");
  var lifecycleContainer = rootNode.querySelector("[data-quote-lifecycle-actions]");
  var lifecycleActions = lifecycleActionKeys();
    var immutable = ["Issued", "Accepted", "Declined", "Superseded"].indexOf(state.status) >= 0;
    var financialLocked = Boolean(state.quoteId && window.UOS.ProgramQuotes && typeof window.UOS.ProgramQuotes.commerciallyLocked === "function" && window.UOS.ProgramQuotes.commerciallyLocked(workspaceSnapshot(), state.quoteId));
    renderFundingChoice(immutable || financialLocked);
    var paymentSummary = state.quoteId && window.UOS.ProgramQuotes && window.UOS.ProgramApp
      ? window.UOS.ProgramQuotes.paymentSummary(workspaceSnapshot(), state.quoteId)
      : null;
    var isSettled = Boolean(paymentSummary && (paymentSummary.status === "Paid" || paymentSummary.status === "Overpaid" || (paymentSummary.paid > 0 && paymentSummary.balance <= 0)));

    if (numInput && document.activeElement !== numInput) numInput.value = state.quoteNumber;
    if (dateInput && document.activeElement !== dateInput) dateInput.value = state.quoteDate;
    if (expiryInput && document.activeElement !== expiryInput) expiryInput.value = state.expiryDate;
    syncPiiInput(clientInput, state.clientName, "clientName", "text");
    syncPiiInput(addrInput, state.address, "quoteAddress", "text");
    syncPiiInput(emailInput, state.email, "email", "email");
    if (prepInput && document.activeElement !== prepInput) prepInput.value = state.preparedBy;
    if (discInput && document.activeElement !== discInput) discInput.value = state.discountRate;
    if (contInput && document.activeElement !== contInput) contInput.value = state.contingencyRate;
    if (scopeInput && document.activeElement !== scopeInput) scopeInput.value = state.scopeNotes;
    if (termsInput && document.activeElement !== termsInput) termsInput.value = state.terms;
    var internalNotes = state.fundingMode === "city";
    var section3Link = rootNode.querySelector("[data-quote-section-3-link]");
    if (section3Link) {
      section3Link.textContent = internalNotes ? "3 Notes" : "3 Terms";
      section3Link.setAttribute("aria-label", internalNotes ? "Section 3: Internal Notes" : "Section 3: Scope and Terms");
    }
    var section3Heading = rootNode.querySelector("[data-quote-section-3-heading]");
    if (section3Heading) section3Heading.textContent = internalNotes ? "3. Internal Notes" : "3. Scope and Terms";
    var termsLabel = rootNode.querySelector("[data-quote-terms-label]");
    if (termsLabel) termsLabel.textContent = internalNotes ? "Internal Notes" : "Terms & Conditions";
    if (operationalInput) {
      operationalInput.readOnly = state.fundingMode === "customer" || Boolean(window.UOS.ProgramBudget && workspaceSnapshot().entities.annualBudgets.length);
      operationalInput.title = operationalInput.readOnly ? "Allocated to the Register record in Annual Budget" : "Legacy Project amount; reconcile in Annual Budget";
      if (document.activeElement !== operationalInput) operationalInput.value = state.operationalAmount;
    }
    if (statusInput) {
      if (document.activeElement !== statusInput) statusInput.value = state.status;
      statusInput.disabled = isSettled;
      if (isSettled) statusInput.title = "Account is settled. Status cannot be changed."; else statusInput.removeAttribute("title");
    }
    if (revisionButton) {
      revisionButton.hidden = !state.selectedEntityId;
      revisionButton.disabled = isSettled;
      if (isSettled) revisionButton.title = "Account is settled. Create Revision is disabled."; else revisionButton.removeAttribute("title");
    }
    if (statusInput) {
      var currentQuote = state.quoteId && (workspaceSnapshot().entities.quotes || []).find(function (quote) { return quote.id === state.quoteId; });
      var statusDate = currentQuote && state.status !== "Draft" ? quoteDisplayDate(quoteLifecycleDate(currentQuote, state.status)) : "";
      statusInput.textContent = state.status + (statusDate ? " · " + statusDate : "");
      statusInput.setAttribute("data-quote-state", state.status);
    }
    if (revisionButton) {
      revisionButton.hidden = !hasLifecycleAction(lifecycleActions, ["createRevision", "revise"]);
      revisionButton.disabled = false;
    }
    if (refreshButton) {
      refreshButton.hidden = !hasLifecycleAction(lifecycleActions, ["refreshDraftFromCurrentCosts", "refresh"]);
      refreshButton.disabled = financialLocked;
    }
    if (lifecycleContainer) {
      var issueButton = lifecycleContainer.querySelector("[data-quote-issue]");
      var acceptButton = lifecycleContainer.querySelector("[data-quote-accept]");
      var declineButton = lifecycleContainer.querySelector("[data-quote-decline]");
      if (issueButton) issueButton.hidden = !hasLifecycleAction(lifecycleActions, ["issue"]);
      if (acceptButton) acceptButton.hidden = !hasLifecycleAction(lifecycleActions, ["accept", "Accepted"]);
      if (declineButton) declineButton.hidden = !hasLifecycleAction(lifecycleActions, ["decline", "Declined"]);
      lifecycleContainer.hidden = !(issueButton && !issueButton.hidden) && !(acceptButton && !acceptButton.hidden) && !(declineButton && !declineButton.hidden);
    }
    var saveButton = rootNode.querySelector("[data-quote-save]"); if (saveButton) saveButton.disabled = immutable || !state.selectedEntityId;
    [clientInput, addrInput, emailInput, prepInput, scopeInput, termsInput].forEach(function (input) { if (input) input.disabled = immutable; });
    [numInput, dateInput, expiryInput, discInput, contInput].forEach(function (input) {
      if (!input) return;
      input.disabled = immutable || financialLocked;
      if (financialLocked) input.title = "Financial values are locked while this Draft has active payments.";
      else input.removeAttribute("title");
    });
    var lockNotice = rootNode.querySelector("[data-quote-financial-lock]");
    if (!lockNotice) {
      lockNotice = document.createElement("p");
      lockNotice.className = "program-quote-financial-lock";
      lockNotice.setAttribute("data-quote-financial-lock", "");
      lockNotice.setAttribute("role", "status");
      rootNode.insertBefore(lockNotice, rootNode.firstChild);
    }
    lockNotice.hidden = !financialLocked;
    lockNotice.textContent = financialLocked ? "Financial values and line items are locked while this Draft has active payments. Reverse the transactions or create a new revision to change them." : "";
    Array.prototype.forEach.call(rootNode.querySelectorAll("[data-quote-audit]"), function (node) {
      var key = node.getAttribute("data-quote-audit");
      node.textContent = key === "number" ? (state.auditNumber || "Assigned when saved")
        : key === "project" ? (state.selectedEntityId || "—")
        : key === "revision" ? String(state.revision || 1)
        : (state.previousAuditNumber || "Original revision");
    });

    var tbody = rootNode.querySelector("[data-quote-builder-lines]");
    if (tbody) {
      var linesHtml = state.lines.map(function (line) {
        var locked = line.readOnly || immutable || financialLocked;
        var disabled = locked ? " disabled" : "";
        return '<tr data-line-id="' + esc(line.id) + '">' +
          '<td class="program-quote-builder-table__description"><input type="text" class="uos-input uos-input--sm" data-line-field="description" title="' + esc(line.description) + '" data-uos-tooltip="' + esc(line.description) + '" value="' + esc(line.description) + '"' + disabled + '></td>' +
          '<td class="program-quote-builder-table__category">' +
          (line.readOnly ? '<input type="text" class="uos-input uos-input--sm" value="' + esc(quoteLineKind(line)) + '" readonly aria-label="Kind">' :
            '<select class="uos-select uos-select--sm" data-line-field="kind" aria-label="Kind"' + disabled + '>' +
            ['Materials', 'Labour', 'Contractors', 'Equipment', 'Sundry'].map(function (kind) { return '<option value="' + kind + '"' + (quoteLineKind(line) === kind ? ' selected' : '') + '>' + kind + '</option>'; }).join('') + '</select>') +
          '</td>' +
          '<td class="program-quote-builder-table__quantity"><input type="number" step="0.5" min="0" class="uos-input uos-input--sm" data-line-field="quantity" value="' + line.quantity + '"' + disabled + '></td>' +
          '<td class="program-quote-builder-table__unit"><input type="text" class="uos-input uos-input--sm" data-line-field="unit" value="' + esc(line.unit) + '"' + disabled + '></td>' +
          '<td class="program-quote-builder-table__rate"><input type="number" step="0.5" min="0" class="uos-input uos-input--sm" data-line-field="rate" value="' + line.rate + '"' + disabled + '></td>' +
          '<td class="program-quote-builder-table__total"><input type="text" class="uos-input uos-input--sm" value="' + money(line.total) + '" readonly aria-label="Total"></td>' +
          '<td class="program-quote-builder-table__actions">' + (locked ? '' : '<button type="button" class="uos-button uos-button--subtle uos-button--sm" data-remove-line="' + esc(line.id) + '" title="Remove adjustment">&times;</button>') + '</td>' +
        '</tr>';
      }).join("");
      tbody.innerHTML = linesHtml;
    }
    if (state.selectedEntityId && window.UOS.ProjectFunding && window.UOS.ProgramApp) {
      var activeTotals = calculateTotals();
      var paymentSummary = state.quoteId && window.UOS.ProgramQuotes
        ? window.UOS.ProgramQuotes.paymentSummary(workspaceSnapshot(), state.quoteId)
        : { paid: 0 };
      var activeQuote = {
        id: state.quoteId,
        fundingMode: state.fundingMode, proposedCustomerContribution: state.proposedCustomerContribution,
        status: state.status,
        subtotalExGst: activeTotals.subtotalExGst,
        discount: activeTotals.discountAmount,
        contingency: activeTotals.contingencyAmount,
        grandTotal: activeTotals.grandTotal,
        gst: activeTotals.gstAmount,
        paymentsPaid: paymentSummary ? Number(paymentSummary.paid) || 0 : 0
      };
      var funding = window.UOS.ProjectFunding.position(workspaceSnapshot(), state.selectedEntityId, { quote: activeQuote });
      var fundingNodes = rootNode.querySelectorAll("[data-funding-value]");
      Array.prototype.forEach.call(fundingNodes, function (node) {
        var key = node.getAttribute("data-funding-value");
        var value = key === "delivery" ? funding.calculatedDeliveryCost
          : key === "council" ? funding.operationalAmount
          : key === "discount" ? activeTotals.discountAmount
          : key === "contingency" ? activeTotals.contingencyAmount
          : key === "customer" ? funding.customerQuote
          : key === "total" ? funding.totalFunding
          : key === "gap" ? funding.fundingGap
          : key === "customerTotal" ? funding.customerGrandTotal
          : key === "customerGst" ? UOS.ProgramQuotes.customerAmounts(activeQuote).gst
          : key === "paymentsPaid" ? funding.paymentsPaid
          : key === "customerOutstanding" ? funding.customerOutstanding
          : key === "positionGst" ? Math.max(0, Number(funding.customerOutstanding || 0) - Number(funding.customerOutstanding || 0) / 1.10)
          : key === "positionTotal" ? funding.fundingPosition
          : funding.fundingPosition;

        var numVal = Number(value) || 0;
        var formatted = (numVal < 0 ? "-" : "") + "$" + Math.abs(numVal).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        node.textContent = formatted;
      });

      var fundingLabel = rootNode.querySelector("[data-funding-label]");
      if (fundingLabel) fundingLabel.textContent = funding.label || "Position";

      var metricLabel = rootNode.querySelector("[data-funding-metric-label]");
      if (metricLabel) {
        metricLabel.textContent = funding.label || "Funding Position";
      }

      var fundingCard = rootNode.querySelector("[data-funding-card]");
      if (fundingCard) {
        fundingCard.setAttribute("data-funding-status", funding.fundingStatus || "balanced");
      }
    }

    renderPreview();
    renderPaymentLedger();
    renderQuoteHistory();
    if (position) drawerUI.restoreQuotePosition(position);
  }

  function quoteDocumentMode() {
    return state.fundingMode === "city" ? "city" : state.fundingMode === "mixed" ? "mixed" : "customer";
  }

  function setQuoteDocumentTotals(list, rows) {
    if (!list) return;
    list.innerHTML = rows.map(function (row) {
      return '<dt' + (row.labelClass ? ' class="' + row.labelClass + '"' : '') + '>' + esc(row.label) + '</dt>' +
        '<dd' + (row.valueClass ? ' class="' + row.valueClass + '"' : '') + (row.dataAttribute ? ' ' + row.dataAttribute : '') + '>' + money(row.value) + '</dd>';
    }).join("");
  }

  function applyFundingDocumentPresentation(previewContainer, totals, customer, cityFunding) {
    var mode = quoteDocumentMode();
    if (mode === "customer") return;
    var pages = Array.prototype.slice.call(previewContainer.querySelectorAll(".uos-quote-sheet-page"));
    var isCity = mode === "city";
    var suppressCouncilDisclosure = mode === "mixed" && (state.suppressCouncilDisclosure === true || Math.abs(num(cityFunding)) < 0.005);
    previewContainer.classList.toggle("is-city-funded-estimate", isCity);
    previewContainer.classList.toggle("is-mixed-funded-quote", mode === "mixed");

    pages.forEach(function (page) {
      var table = page.querySelector(".uos-quote-sheet__table");
      if (mode === "mixed" && table) {
        var priceHeader = table.querySelector("thead th:last-child");
        if (priceHeader) priceHeader.remove();
        Array.prototype.forEach.call(table.querySelectorAll("tbody tr"), function (row) {
          var cells = row.querySelectorAll(":scope > td");
          if (cells.length >= 3) cells[cells.length - 1].remove();
        });
        Array.prototype.forEach.call(table.querySelectorAll("[colspan]"), function (cell) { cell.colSpan = 2; });
      }
      if (isCity && table) {
        var totalHeader = table.querySelector("thead th:last-child");
        if (totalHeader) totalHeader.textContent = "Estimated cost (AUD)";
        Array.prototype.forEach.call(table.querySelectorAll("tbody td"), function (cell) {
          if (/quotation/i.test(cell.textContent)) cell.textContent = "No items included in this works estimate.";
        });
      }
    });

    if (mode === "mixed") {
      Array.prototype.forEach.call(previewContainer.querySelectorAll(".uos-quote-sheet__totals-list"), function (list) {
        setQuoteDocumentTotals(list, [
          { label: "Customer contribution (ex GST)", value: customer.contribution, dataAttribute: "data-preview-contribution" },
          { label: "GST (10%)", value: customer.gst, dataAttribute: "data-preview-customer-gst" },
          { label: "Customer amount payable (inc GST)", value: customer.payable, labelClass: "uos-quote-sheet__grand-total-label", valueClass: "uos-quote-sheet__grand-total-val" }
        ]);
      });
      if (suppressCouncilDisclosure) {
        Array.prototype.forEach.call(previewContainer.querySelectorAll("[data-preview-funding-statement]"), function (statement) {
          statement.textContent = "Proposed customer contribution: " + money(customer.contribution) + " ex GST.";
        });
      }
      return;
    }

    Array.prototype.forEach.call(previewContainer.querySelectorAll(".uos-quote-sheet__title"), function (title) { title.textContent = "WORKS ESTIMATE"; });
    Array.prototype.forEach.call(previewContainer.querySelectorAll(".uos-quote-sheet__title-note"), function (note) { note.textContent = "(INTERNAL PLANNING DOCUMENT)"; });
    Array.prototype.forEach.call(previewContainer.querySelectorAll(".uos-quote-sheet__brand"), function (brand) {
      brand.textContent = brand.textContent.replace("QUOTATION", "WORKS ESTIMATE");
    });
    Array.prototype.forEach.call(previewContainer.querySelectorAll(".uos-quote-sheet__subbrand"), function (subbrand) {
      subbrand.textContent = subbrand.textContent.replace("Quote ID:", "Estimate ID:");
    });
    Array.prototype.forEach.call(previewContainer.querySelectorAll(".uos-quote-sheet__meta strong"), function (label) {
      if (label.textContent === "Quote ID:") label.textContent = "Estimate ID:";
    });
    Array.prototype.forEach.call(previewContainer.querySelectorAll(".uos-quote-sheet__party:first-child"), function (party) {
      party.innerHTML = "<h4>Site</h4><strong>" + esc(privacyDisplay(state.address, "address")) + "</strong>";
    });
    Array.prototype.forEach.call(previewContainer.querySelectorAll(".uos-quote-sheet__totals-list"), function (list) {
      setQuoteDocumentTotals(list, [
        { label: "Estimated work cost (ex GST)", value: totals.subtotalExGst },
        { label: "GST (10%)", value: totals.gstAmount },
        { label: "Estimated work cost (inc GST)", value: totals.grandTotal, labelClass: "uos-quote-sheet__grand-total-label", valueClass: "uos-quote-sheet__grand-total-val" }
      ]);
    });
    Array.prototype.forEach.call(previewContainer.querySelectorAll(".uos-quote-sheet__terms"), function (terms) {
      terms.innerHTML = "<h4>Internal notes</h4><p>" + esc(state.terms) + "</p>";
    });
    Array.prototype.forEach.call(previewContainer.querySelectorAll(".uos-quote-sheet__print-meta > span:first-child"), function (footer) {
      footer.textContent = "Works Estimate · City of Adelaide Horticulture Operations";
    });
  }

function renderPreview() {
    if (!rootNode) return;
    var previewContainer = rootNode.querySelector("[data-quote-preview-sheet]");
    if (!previewContainer) return;

    var totals = calculateTotals();
    var customer = UOS.ProgramQuotes.customerAmounts(customerQuote(totals));
    var ledger = state.quoteId && window.UOS && window.UOS.ProgramQuotes ? window.UOS.ProgramQuotes.paymentSummary(workspaceSnapshot(), state.quoteId) : { depositPaid: 0, paid: 0, balanceDue: totals.grandTotal };
    var savedQuote = state.quoteId && workspaceSnapshot().entities.quotes.find(function (quote) { return quote.id === state.quoteId; });
    var documentFunding = state.selectedEntityId ? UOS.ProjectFunding.position(workspaceSnapshot(), state.selectedEntityId, { quote: customerQuote(totals) }) : null;
    var cityFunding = savedQuote && savedQuote.cityFundingAmount !== undefined ? savedQuote.cityFundingAmount : documentFunding ? documentFunding.operationalAmount : 0;
    var deliveryCost = savedQuote && savedQuote.estimatedDeliveryCost !== undefined ? savedQuote.estimatedDeliveryCost : documentFunding ? documentFunding.calculatedDeliveryCost : totals.subtotal;
    var fundingStatement = state.fundingMode === "city" ? "Fully funded by City of Adelaide — no customer payment required."
      : state.fundingMode === "mixed" ? "Co-funded by City of Adelaide and customer. Proposed customer contribution: " + money(customer.contribution) + " ex GST."
      : "Customer-funded work. Proposed customer contribution: " + money(customer.contribution) + " ex GST.";

    var formatDate = window.UOS && window.UOS.imports && window.UOS.imports.formatDate;
    var formattedDate = formatDate ? formatDate(state.quoteDate) : (state.quoteDate || "—");
    var formattedExpiry = formatDate ? formatDate(state.expiryDate) : (state.expiryDate || "—");

    var allRows = [];
    if (!state.lines.length) {
    allRows.push('<tr><td colspan="3" style="text-align: center; color: var(--uos-text-muted); padding: 24px;">No items included in quotation.</td></tr>');
    } else if (state.viewMode === "summary") {
      var groups = getCategoryGroups();
      var summaryIdx = 0;
      Object.keys(groups).forEach(function (key) {
        var grp = groups[key];
        if (!grp.lines.length && grp.total === 0) return;
        summaryIdx++;
        allRows.push(
          '<tr>' +
            '<td>' + summaryIdx + '</td>' +
        '<td><strong>' + esc(grp.name) + '</strong></td>' +
            '<td style="text-align: right; font-weight: 700;">' + money(grp.total) + '</td>' +
          '</tr>'
        );
      });
    } else {
      var groups = getCategoryGroups();
      var itemIdx = 0;
      var renderedCount = 0;
      Object.keys(groups).forEach(function (key) {
        var grp = groups[key];
        if (!grp.lines.length) return;
        allRows.push(
          '<tr class="uos-quote-sheet__section-row">' +
            '<td colspan="3" style="background: #f8fafc; color: #0f172a; font-weight: 800; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; border-top: 2px solid #cbd5e1;">' +
              esc(grp.name.toUpperCase()) +
            '</td>' +
          '</tr>'
        );

        grp.lines.forEach(function (line) {
          itemIdx++;
          renderedCount++;
          allRows.push(
            '<tr>' +
              '<td>' + itemIdx + '</td>' +
              '<td><strong>' + esc(cleanDescription(line.description)) + '</strong></td>' +
              '<td style="text-align: right; font-weight: 700;">' + money(line.total) + '</td>' +
            '</tr>'
          );
        });
      });

      if (renderedCount === 0) {
        allRows = ['<tr><td colspan="3" style="text-align: center; color: var(--uos-text-muted); padding: 24px;">No items included in quotation.</td></tr>'];
      }
    }

    var page1Limit = 10;
    var subsequentLimit = 12;
    var pagesRows = [];

    var cursor = 0;
    var limit = page1Limit;
    while (cursor < allRows.length) {
      var end = Math.min(allRows.length, cursor + limit);
      if (end < allRows.length && end > cursor && /uos-quote-sheet__section-row/.test(allRows[end - 1])) end -= 1;
      if (end <= cursor) end = Math.min(allRows.length, cursor + limit);
      pagesRows.push(allRows.slice(cursor, end));
      cursor = end;
      limit = subsequentLimit;
    }

    var totalPages = pagesRows.length;
    var pagesHtml = [];

    for (var p = 0; p < totalPages; p++) {
      var pageNum = p + 1;
      var pageRows = pagesRows[p];
      var pageHtml = '<div class="uos-quote-sheet-page' + (p > 0 ? ' uos-quote-sheet-page-break' : '') + '">';

      if (p === 0) {
        pageHtml +=
          '<div class="uos-quote-sheet__header">' +
            '<div>' +
              '<h2 class="uos-quote-sheet__brand">CITY OF ADELAIDE</h2>' +
              '<p class="uos-quote-sheet__subbrand">Horticulture & Public Realm Operations</p>' +
            '</div>' +
            '<div style="text-align: right;">' +
              '<h1 class="uos-quote-sheet__title">OFFICIAL QUOTATION</h1>' +
              '<p class="uos-quote-sheet__title-note">(NOT AN OFFICIAL TAX INVOICE)</p>' +
              '<div class="uos-quote-sheet__meta">' +
                '<span><strong>Quote ID:</strong> ' + esc(state.auditNumber || "Pending") + '</span><br>' +
                '<span><strong>Reference:</strong> ' + esc(state.quoteNumber) + '</span><br>' +
                '<span><strong>Date:</strong> ' + esc(formattedDate) + '</span><br>' +
                '<span><strong>Valid Until:</strong> ' + esc(formattedExpiry) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +

          '<div class="uos-quote-sheet__parties">' +
            '<div class="uos-quote-sheet__party">' +
              '<h4>Prepared For</h4>' +
              '<strong>' + esc(privacyDisplay(state.clientName, "clientName") || "—") + '</strong>' +
              '<p>' + esc(privacyDisplay(state.address || "—", "quoteAddress")) + '</p>' +
              '<p>Email: ' + esc(privacyDisplay(state.email, "email") || "—") + '</p>' +
            '</div>' +
            '<div class="uos-quote-sheet__party">' +
              '<h4>Prepared By</h4>' +
              '<strong>' + esc(state.preparedBy) + '</strong>' +
              '<p>City Operations - Horticulture Workgroup</p>' +
              '<p>GPO Box 2252<br>Adelaide SA 5001</p>' +
            '</div>' +
          '</div>';
      } else {
        pageHtml +=
          '<div class="uos-quote-sheet__header" style="margin-bottom: 16px; padding-bottom: 12px;">' +
            '<div>' +
              '<h2 class="uos-quote-sheet__brand" style="font-size: 14px;">CITY OF ADELAIDE · QUOTATION</h2>' +
              '<p class="uos-quote-sheet__subbrand">Quote ID: ' + esc(state.auditNumber || "Pending") + ' · Date: ' + esc(formattedDate) + '</p>' +
            '</div>' +
            '<div style="text-align: right;">' +
              '<span style="font-size: 12px; font-weight: 700; color: #64748b;">Page ' + pageNum + ' of ' + totalPages + '</span>' +
            '</div>' +
          '</div>';
      }

      pageHtml +=
        '<table class="uos-table uos-quote-sheet__table">' +
          '<thead>' +
            '<tr>' +
              '<th>#</th>' +
              '<th>Description</th>' +
              '<th style="text-align: right;">Total (AUD)</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>' +
            pageRows.join("") +
          '</tbody>' +
        '</table>';

      if (pageNum === totalPages) {
        pageHtml +=
          '<div class="uos-quote-sheet__summary-wrap">' +
            '<div class="uos-quote-sheet__notes-col">' +
              '<h4>Scope & Description</h4>' +
              '<p>' + esc(state.scopeNotes) + '</p>' +
            '</div>' +
            '<div class="uos-quote-sheet__totals-col">' +
              '<dl class="uos-quote-sheet__totals-list">' +
                '<dt>Subtotal</dt><dd>' + money(totals.subtotal) + '</dd>';

        if (totals.contingencyAmount > 0) {
          pageHtml += '<dt>Contingency (' + state.contingencyRate + '%)</dt><dd>+' + money(totals.contingencyAmount) + '</dd>';
        }
        if (totals.discountAmount > 0) {
          pageHtml += '<dt>Discount (' + state.discountRate + '%)</dt><dd>-' + money(totals.discountAmount) + '</dd>';
        }

        pageHtml +=
                '<dt>' + (state.fundingMode ? 'Estimated work subtotal after allowances (ex GST)' : 'Subtotal Excl. GST') + '</dt><dd>' + money(totals.subtotalExGst) + '</dd>' +
                (state.fundingMode ? '<dt>Estimated delivery cost (ex GST)</dt><dd>' + money(deliveryCost) + '</dd><dt>Applicable City of Adelaide funding (ex GST)</dt><dd>' + money(cityFunding) + '</dd><dt>Proposed customer contribution (ex GST)</dt><dd data-preview-contribution>' + money(customer.contribution) + '</dd>' : '') +
                '<dt>' + (state.fundingMode ? 'Customer GST (10%)' : 'GST (10%)') + '</dt><dd data-preview-customer-gst>' + money(customer.gst) + '</dd>' +
          '<dt class="uos-quote-sheet__grand-total-label">' + (state.fundingMode ? 'Customer amount payable (inc GST)' : 'Grand Total (Inc. GST)') + '</dt>' +
          '<dd class="uos-quote-sheet__grand-total-val">' + money(customer.payable) + '</dd>' +
          '<dt>Deposits received</dt><dd data-preview-deposits>-' + money(ledger.depositPaid || 0) + '</dd>' +
          '<dt>All payments received</dt><dd data-preview-payments>-' + money(ledger.paid || 0) + '</dd>' +
          '<dt class="uos-quote-sheet__balance-label">Balance due</dt><dd class="uos-quote-sheet__balance-value" data-preview-balance>' + money(state.fundingMode ? Math.max(0, customer.payable - (ledger.paid || 0)) : ledger.balanceDue) + '</dd>' +
          '</dl>' +
            '</div>' +
          '</div>' +

          '<div class="uos-quote-sheet__terms">' +
              (state.fundingMode ? '<p data-preview-funding-statement>' + esc(fundingStatement) + '</p><p>Customer agreement: ' + esc(UOS.ProgramQuotes.agreementStatus(customerQuote(totals))) + '</p>' : '') +
              '<h4>Terms & Conditions</h4>' +
            '<p>' + esc(state.terms) + '</p>' +
          '</div>';
      }

      pageHtml +=
        '<div class="uos-quote-sheet__print-meta">' +
          '<span>Quotation Document · City of Adelaide Horticulture Operations</span>' +
          '<span class="uos-quote-sheet__page-number">Page ' + pageNum + ' of ' + totalPages + '</span>' +
        '</div>' +
      '</div>';

      pagesHtml.push(pageHtml);
    }

    previewContainer.innerHTML = '<div class="uos-quote-sheet-inner">' + pagesHtml.join("") + '</div>';
    applyFundingDocumentPresentation(previewContainer, totals, customer, cityFunding);
  }

  function prepareQuotePrint() {
    var sheet = rootNode && rootNode.querySelector("[data-quote-preview-sheet]");
    if (!sheet || !sheet.querySelector(".uos-quote-sheet-page")) return false;
    var host = document.querySelector("[data-quote-print-host]");
    if (!host) {
      host = document.createElement("div");
      host.className = "program-quote-print-host";
      host.setAttribute("data-quote-print-host", "");
      document.body.appendChild(host);
    }
    // Register drawers and module depots can be hidden or clipped during print.
    // Print the current document at the body root, independent of that UI tree.
    var copy = sheet.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll("[id]"), function (node) { node.removeAttribute("id"); });
    host.replaceChildren(copy);
    document.body.classList.add("is-printing-quote");
    return true;
  }

  function cleanupQuotePrint() {
    var host = document.querySelector("[data-quote-print-host]");
    if (host) host.remove();
    document.body.classList.remove("is-printing-quote");
  }

  function renderPaymentLedger() {
    if (!rootNode) return;
    var rows = rootNode.querySelector("[data-payment-rows]");
    var form = rootNode.querySelector("[data-payment-form]");
    var statusNode = rootNode.querySelector("[data-payment-status]");
    var totalNode = rootNode.querySelector("[data-payment-total]");
    var paidNode = rootNode.querySelector("[data-payment-paid]");
    var balanceNode = rootNode.querySelector("[data-payment-balance]");
    var formNote = rootNode.querySelector("[data-payment-form-note]");
    var summary = state.quoteId && window.UOS.ProgramApp && window.UOS.ProgramQuotes
      ? window.UOS.ProgramQuotes.paymentSummary(workspaceSnapshot(), state.quoteId)
      : { total: 0, paid: 0, balance: 0, status: "Unpaid", payments: [] };
    if (statusNode) { statusNode.textContent = summary.status; statusNode.setAttribute("data-payment-state", summary.status.toLowerCase().replace(/\s+/g, "-")); }
    if (totalNode) totalNode.textContent = money(summary.total);
    if (paidNode) paidNode.textContent = money(summary.paid);
    if (balanceNode) balanceNode.textContent = money(summary.balance);
    var hasSavedQuote = Boolean(state.quoteId);
    var noCustomerPayment = state.fundingMode === "city";
    if (noCustomerPayment && statusNode) statusNode.textContent = "No customer payment required";
    var payable = !noCustomerPayment && hasSavedQuote && ["Issued", "Accepted"].indexOf(state.status) >= 0;
    if (form) {
      Array.prototype.forEach.call(form.elements, function (input) {
        if (input.matches("[data-payment-record]")) input.disabled = !payable;
        else if (input.matches("[data-deposit-record]")) input.disabled = noCustomerPayment || !hasSavedQuote || state.status === "Superseded";
        else input.disabled = noCustomerPayment || !hasSavedQuote;
      });
      var paymentDate = form.elements.paymentDate;
      if (paymentDate && !paymentDate.value) paymentDate.value = new Date().toISOString().slice(0, 10);
    }
    if (formNote) formNote.textContent = noCustomerPayment ? "No customer payment required" : !state.quoteId
      ? "Save the Quote, then issue or accept it before recording payments."
      : payable ? "Payments and deposits are recorded against this Quote revision."
      : state.status === "Superseded" ? "Payments cannot be recorded against a superseded Quote."
      : "Deposits can be recorded now. Issue or accept the Quote before recording other payments.";
    if (!rows) return;
    if (!state.quoteId) { rows.innerHTML = '<tr><td colspan="6">Save the quote before recording payments.</td></tr>'; return; }
    if (!summary.payments.length) { rows.innerHTML = '<tr><td colspan="6">No payments recorded.</td></tr>'; return; }
    rows.innerHTML = summary.payments.slice().sort(function (a, b) { return String(b.paymentDate).localeCompare(String(a.paymentDate)); }).map(function (payment) {
      var reversed = payment.status === "Reversed";
      var reason = reversed && payment.reversalReason ? '<small class="program-payment-ledger__reason">' + esc(payment.reversalReason) + '</small>' : '';
      var formatDate = window.UOS && window.UOS.imports && window.UOS.imports.formatDate;
      var paymentDateLabel = formatDate ? formatDate(payment.paymentDate) : (payment.paymentDate || "—");
      return '<tr' + (reversed ? ' class="is-reversed"' : '') + '><td>' + esc(paymentDateLabel) + '</td><td>' + esc(payment.reference || "—") + '</td><td>' + esc(payment.method) + '</td><td>' + money(payment.amount) + '</td><td>' + esc(payment.status) + reason + '</td><td>' + (reversed ? '—' : '<button type="button" class="uos-button uos-button--secondary uos-button--sm" data-payment-reverse="' + esc(payment.id) + '">Reverse</button>') + '</td></tr>';
    }).join("");
  }

  function projectQuoteHistory() {
    var ws = workspaceSnapshot();
    if (!state.selectedEntityId || !ws || !ws.entities) return [];
    if (window.UOS && window.UOS.ProgramQuotes && typeof window.UOS.ProgramQuotes.projectQuotes === "function") {
      return window.UOS.ProgramQuotes.projectQuotes(ws, state.selectedEntityId);
    }
    return (ws.entities.quotes || []).filter(function (quote) {
      return quote.projectId === state.selectedEntityId;
    }).sort(function (a, b) {
      var rootCompare = String(b.auditRootNumber || b.auditNumber || b.quoteNumber || "").localeCompare(String(a.auditRootNumber || a.auditNumber || a.quoteNumber || ""));
      return rootCompare || Number(b.revision || 1) - Number(a.revision || 1) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    });
  }

  function quoteLifecycleDate(quote, target) {
    var ws = workspaceSnapshot();
    var events = (ws && ws.entities.quoteEvents || []).filter(function (event) {
      return event.quoteId === quote.id && event.payload && event.payload.newStatus === target;
    }).sort(function (a, b) { return text(a.timestamp).localeCompare(text(b.timestamp)); });
    return events.length ? events[0].timestamp : (quote.status === target ? quote.statusChangedAt || "" : "");
  }
  function quoteDisplayDate(value) {
    if (!value) return "";
    var date = new Date(value);
    return isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(date);
  }
  function quoteStatusPill(status) {
    return '<span class="program-quote-status-pill program-quote-status-pill--slim" data-quote-state="' + esc(status) + '">' + esc(status) + '</span>';
  }
  function quoteCardDates(quote) {
    var dates = [];
    if (quote.status === "Draft") {
      var saved = quoteDisplayDate(quote.updatedAt);
      if (saved) dates.push("Saved " + saved);
    } else {
      var issued = quoteDisplayDate(quoteLifecycleDate(quote, "Issued"));
      if (issued) dates.push("Issued " + issued);
      if (["Accepted", "Declined", "Superseded"].indexOf(quote.status) >= 0) {
        var resolved = quoteDisplayDate(quoteLifecycleDate(quote, quote.status));
        if (resolved) dates.push(quote.status + " " + resolved);
      }
    }
    if (!dates.length && quote.quoteDate) dates.push("Quote date " + quoteDisplayDate(quote.quoteDate));
    return dates.join(" • ");
  }
  function renderQuoteHistory() {
    if (!rootNode) return;
    var list = rootNode.querySelector("[data-quote-history-list]");
    var count = rootNode.querySelector("[data-quote-history-count]");
    if (!list) return;
    var quotes = projectQuoteHistory();
    if (count) count.textContent = quotes.length + (quotes.length === 1 ? " quote" : " quotes");
    if (!state.selectedEntityId || !quotes.length) {
      list.innerHTML = '<p class="program-quote-history__empty">' + (state.selectedEntityId ? "No saved quotes for this project yet." : "Select a delivery project to view its quote history.") + '</p>';
      return;
    }
    list.innerHTML = quotes.map(function (quote) {
      var active = quote.id === state.quoteId;
      var label = quote.auditNumber || quote.quoteNumber || quote.id;
      return '<article class="program-quote-history__item' + (active ? ' is-active' : '') + '" role="listitem" data-quote-history-item="' + esc(quote.id) + '"' + (active ? ' aria-current="true"' : '') + '>' +
        '<div class="program-quote-history__row">' + quoteStatusPill(quote.status || "Draft") + '<strong>' + esc(label) + '</strong><span>Revision ' + esc(quote.revision || 1) + '</span><span class="program-quote-history__dates">' + esc(quoteCardDates(quote)) + '</span></div>' +
        '<button class="uos-button uos-button--secondary uos-button--sm" type="button" data-quote-load="' + esc(quote.id) + '"' + (active ? ' disabled aria-label="Currently loaded quote ' + esc(label) + '"' : ' aria-label="Load quote ' + esc(label) + '"') + '>' + (active ? "Loaded" : "Load") + '</button></article>';
    }).join("");
  }

  function loadQuoteRecord(entity, quote) {
    var ws = workspaceSnapshot();
    var customer = customerDetailsForProject(entity, ws);
    state.selectedEntityId = entity.id;
    state.quoteId = quote ? quote.id : "";
    state.auditNumber = quote ? quote.auditNumber || "" : "";
    var previousQuote = quote && quote.previousQuoteId ? (ws.entities.quotes || []).find(function (item) { return item.id === quote.previousQuoteId; }) : null;
    state.previousAuditNumber = previousQuote ? previousQuote.auditNumber || previousQuote.id : "";
    state.status = quote ? quote.status || "Draft" : "Draft";
    state.revision = quote ? Number(quote.revision) || 1 : 1;
    state.quoteNumber = quote ? quote.quoteNumber || entity.id : entity.id;
    state.clientName = quote ? quote.clientName || "" : customer.name;
    state.address = quote ? quote.address || "" : customer.address;
    state.email = quote ? quote.email || "" : customer.email;
    state.preparedBy = quote ? quote.preparedBy || "" : state.preparedBy;
    state.quoteDate = quote ? quote.quoteDate || state.quoteDate : state.quoteDate;
    state.expiryDate = quote ? quote.expiryDate || state.expiryDate : state.expiryDate;
    state.discountRate = quote ? Number(quote.discountRate) || 0 : 0;
    state.contingencyRate = quote ? Number(quote.contingencyRate) || 0 : 0;
    state.fundingMode = quote ? quote.fundingMode || null : "customer";
    state.proposedCustomerContribution = quote && quote.proposedCustomerContribution != null ? Number(quote.proposedCustomerContribution) : null;
    state.suppressCouncilDisclosure = Boolean(quote && quote.suppressCouncilDisclosure);
    state.scopeNotes = quote ? quote.scopeNotes || "" : "";
    state.terms = quote ? quote.terms || "" : "";
    var viewModel = quote && typeof window.UOS.ProgramQuotes.quoteViewModel === "function" ? window.UOS.ProgramQuotes.quoteViewModel(ws, quote.id) : null;
    var immutable = viewModel ? viewModel.readOnly : quote && ["Issued", "Accepted", "Declined", "Superseded"].indexOf(quote.status) >= 0;
    if (quote && immutable) {
      state.lines = (viewModel ? viewModel.lines : (ws.entities.quoteLines || []).filter(function (line) { return line.quoteId === quote.id; })).map(function (line) {
        return Object.assign({}, line, { rate: line.unitRate, readOnly: true });
      });
    } else {
      var inherited = window.UOS.ProgramQuotes.inheritProject(ws, entity.id);
      var custom = quote ? (ws.entities.quoteLines || []).filter(function (line) { return line.quoteId === quote.id && line.sourceKind === "custom"; }).map(function (line) {
        return Object.assign({}, line, { id: line.customLineKey || line.id, rate: line.unitRate, readOnly: false });
      }) : [];
      state.lines = inherited.concat(custom);
    }
    renderBuilder();
  }

  function populateClientFromEntity(entityId, skipSave) {
    if (!window.UOS || !window.UOS.ProgramApp) return;
    var ws = workspaceSnapshot();
    if (!ws || !ws.entities) return;

    var model = window.UOS.ProgramModel;
    var allProjects = model && typeof model.getProjects === "function"
      ? model.getProjects(ws, "EVT").concat(model.getProjects(ws, "NSA"))
      : (ws.entities.projects || []);

    var project = allProjects.find(function (p) { return p.id === entityId; });
    var entity = project;
    if (!entity || !window.UOS.ProgramQuotes) return;

    if (state.selectedEntityId !== entity.id) resetQuoteEditor();
    state.selectedEntityId = entity.id;
    var customer = customerDetailsForProject(entity, ws);
    state.clientName = customer.name;
    state.address = customer.address;
    state.email = customer.email;
    state.operationalAmount = window.UOS.ProgramBudget && ws.entities.annualBudgets.length ? window.UOS.ProgramBudget.projectAmount(ws, entity.id) : entity.funding && Number(entity.funding.operationalAmount) || 0;
    var projectQuotes = (ws.entities.quotes || []).filter(function (quote) { return quote.projectId === entity.id; }).sort(function (a, b) { return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) || Number(b.revision || 1) - Number(a.revision || 1); });
    var latest = projectQuotes[0] || null;
    loadQuoteRecord(entity, latest);
    if (!skipSave && !latest) saveToWorkspace();
    return;
  }

  function addLineItem(categoryOrData, description, unit, quantity, rate) {
    if (state.quoteId && window.UOS.ProgramQuotes && window.UOS.ProgramQuotes.commerciallyLocked(workspaceSnapshot(), state.quoteId)) return ledgerError(new Error("Financial line items are locked while this Draft has active payments."));
    var item = typeof categoryOrData === "object" && categoryOrData !== null ? categoryOrData : {
      category: categoryOrData,
      description: description,
      unit: unit,
      quantity: quantity,
      rate: rate
    };
    var newId = "LINE-" + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
    var qty = item.quantity != null ? num(item.quantity) : 1;
    var r = item.unitRate != null ? num(item.unitRate) : (item.rate != null ? num(item.rate) : 0);
    var tot = Math.round(qty * r * 100) / 100;
    state.lines.push({
      id: newId,
      kind: item.kind || "Sundry", category: item.category || "Adjustment",
      description: item.description || "New Quote Item",
      unit: item.unit || "item",
      quantity: qty,
      rate: r,
      total: tot,
      sourceKind: "custom",
      readOnly: false
    });
    renderBuilder();
    saveToWorkspace();
  }

  function removeLineItem(lineId) {
    if (state.quoteId && window.UOS.ProgramQuotes && window.UOS.ProgramQuotes.commerciallyLocked(workspaceSnapshot(), state.quoteId)) return ledgerError(new Error("Financial line items are locked while this Draft has active payments."));
    var line = state.lines.find(function (item) { return item.id === lineId && !item.readOnly; });
    if (!line) return Promise.resolve(null);
    var projectId = state.selectedEntityId, quoteId = state.quoteId;
    var linesBefore = JSON.stringify(state.lines);
    return window.UOS.ProgramDeleteSafety.confirm({
      title: "Remove Quote adjustment?", confirmLabel: "Remove adjustment",
      message: 'Remove "' + (line.description || "Quote adjustment") + '"? The editable Draft quote and its totals will be updated. Calculator source items remain unchanged.',
      validate: function () { return state.selectedEntityId === projectId && state.quoteId === quoteId; },
      apply: function (guard) {
        if (JSON.stringify(state.lines) !== linesBefore) throw new Error("The Quote adjustment changed. Review it and try again.");
        if (state.quoteId && window.UOS.ProgramQuotes.commerciallyLocked(workspaceSnapshot(), state.quoteId)) throw new Error("Financial line items are locked while Draft has active payments.");
        state.lines = state.lines.filter(function (item) { return item.id !== lineId || item.readOnly; });
        renderBuilder();
        return saveToWorkspace(guard).catch(function (error) {
          if (state.selectedEntityId === projectId) state.lines = JSON.parse(linesBefore);
          renderBuilder();
          throw error;
        });
      }
    });
  }

  function saveToWorkspace(guard) {
    if (!state.selectedEntityId || !window.UOS || !window.UOS.ProgramQuotes || !window.UOS.ProgramApp || typeof window.UOS.ProgramApp.updateWorkspace !== "function") return Promise.resolve(null);
    var custom = state.lines.filter(function (line) { return line.sourceKind === "custom" && !line.readOnly; });
    var draftInput = JSON.parse(JSON.stringify({
        id: state.quoteId || undefined, projectId: state.selectedEntityId, quoteNumber: state.quoteNumber, revision: state.revision,
        clientName: state.clientName, address: state.address, email: state.email, preparedBy: state.preparedBy,
        quoteDate: state.quoteDate, expiryDate: state.expiryDate, discountRate: state.discountRate, contingencyRate: state.contingencyRate,
      scopeNotes: state.scopeNotes, terms: state.terms, customLines: custom,
      fundingMode: state.fundingMode, proposedCustomerContribution: state.proposedCustomerContribution,
      suppressCouncilDisclosure: state.suppressCouncilDisclosure
    }));
    pendingDraftSaves += 1;
    return window.UOS.ProgramApp.updateWorkspace(function (workspace) {
      if (guard) guard(workspace);
      // Capture the user's offer before asynchronous persistence re-renders the form.
      if (!draftInput.id && state.selectedEntityId === draftInput.projectId) draftInput.id = state.quoteId || undefined;
      return window.UOS.ProgramQuotes.saveDraft(workspace, draftInput);
    }).then(function (workspace) {
      state.workspace = workspace;
      var quote = workspace && workspace.entities.quotes.filter(function (item) { return item.projectId === state.selectedEntityId && item.status === "Draft"; }).sort(function (a, b) { return Number(b.revision) - Number(a.revision); })[0];
      if (quote && state.selectedEntityId === draftInput.projectId) {
        state.quoteId = quote.id;
        state.auditNumber = quote.auditNumber || "";
        state.status = quote.status;
        state.revision = quote.revision;
        renderBuilder();
      }
      return workspace;
    }).finally(function () { pendingDraftSaves -= 1; });
  }

  function onInput(event) {
    if (event.target.matches("[data-quote-project-search]")) {
      quoteSearchQuery = event.target.value.trim();
      renderProjectsList();
      return;
    }
    var target = event.target;
    if (!target) return;
    if (!target.isConnected) return;

    if (target.matches("[data-quote-num]")) state.quoteNumber = target.value;
    else if (target.matches("[data-quote-date]")) state.quoteDate = target.value;
    else if (target.matches("[data-quote-expiry]")) state.expiryDate = target.value;
    else if (target.matches("[data-quote-client]")) {
      if (target.value !== (window.UOS && window.UOS.ProgramPrivacy ? window.UOS.ProgramPrivacy.MASK : "**********")) state.clientName = target.value;
    }
    else if (target.matches("[data-quote-address]")) state.address = target.value;
    else if (target.matches("[data-quote-email]")) {
      if (target.value !== (window.UOS && window.UOS.ProgramPrivacy ? window.UOS.ProgramPrivacy.MASK : "**********")) {
        state.email = target.value;
      }
    }
    else if (target.matches("[data-quote-prepared]")) state.preparedBy = target.value;
    else if (target.matches("[data-quote-funding-mode]")) {
      if (["Issued", "Accepted", "Declined", "Superseded"].indexOf(state.status) >= 0 || state.quoteId && UOS.ProgramQuotes.commerciallyLocked(workspaceSnapshot(), state.quoteId)) return;
      state.fundingMode = target.value;
      if (state.fundingMode === "mixed" && state.proposedCustomerContribution == null) state.proposedCustomerContribution = suggestedCustomerAmount();
      if (state.fundingMode !== "mixed") state.suppressCouncilDisclosure = false;
    }
    else if (target.matches("[data-quote-customer-contribution]")) {
      if (!target.validity.valid || target.value === "") return;
      if (["Issued", "Accepted", "Declined", "Superseded"].indexOf(state.status) >= 0 || state.quoteId && UOS.ProgramQuotes.commerciallyLocked(workspaceSnapshot(), state.quoteId)) return;
      state.proposedCustomerContribution = Math.round(Number(target.value) * 100) / 100;
    }
    else if (target.matches("[data-quote-suppress-council-disclosure]")) {
      if (["Issued", "Accepted", "Declined", "Superseded"].indexOf(state.status) >= 0 || state.quoteId && UOS.ProgramQuotes.commerciallyLocked(workspaceSnapshot(), state.quoteId)) return;
      state.suppressCouncilDisclosure = state.fundingMode === "mixed" && target.checked === true;
    }
    else if (target.matches("[data-quote-discount]")) state.discountRate = num(target.value);
    else if (target.matches("[data-quote-contingency]")) state.contingencyRate = num(target.value);
    else if (target.matches("[data-quote-scope]")) state.scopeNotes = target.value;
    else if (target.matches("[data-quote-terms]")) state.terms = target.value;
    else if (target.matches("[data-operational-amount]")) {
      if (window.UOS.ProgramBudget && workspaceSnapshot().entities.annualBudgets.length) return;
      state.operationalAmount = Math.max(0, num(target.value));
      renderBuilder();
      if (state.selectedEntityId && window.UOS.ProjectFunding && window.UOS.ProgramApp) {
        window.UOS.ProgramApp.updateWorkspace(function (workspace) { return window.UOS.ProjectFunding.setOperationalAmount(workspace, state.selectedEntityId, state.operationalAmount); });
      }
      return;
    }
    else if (target.matches("[data-line-field]")) {
      var tr = target.closest("[data-line-id]");
      if (tr) {
        var lineId = tr.getAttribute("data-line-id");
        var field = target.getAttribute("data-line-field");
        var line = state.lines.find(function (l) { return l.id === lineId; });
        if (line && !line.readOnly) {
          if (field === "quantity" || field === "rate") line[field] = num(target.value);
          else line[field] = target.value;
          line.total = Math.round(num(line.quantity) * num(line.rate) * 100) / 100;
        }
      }
    }

    renderBuilder();
    saveToWorkspace();
  }

  var revisionDialogPending = false;
    var acceptDialogPending = false;
    var issueDialogPending = false;
  function confirmQuoteIssue() {
    var node = document.createElement("div");
    var source = document.createElement("div");
    source.className = "program-quote-issue-funding";
    var caption = document.createElement("span"); caption.textContent = "Funding source";
    var value = document.createElement("strong");
    value.textContent = { city: "City of Adelaide", customer: "Customer", mixed: "City of Adelaide and customer" }[state.fundingMode] || "Not selected";
    source.appendChild(caption); source.appendChild(value); node.appendChild(source);
    var missing = [];
    if (!text(state.scopeNotes)) missing.push("Scope/Description is empty.");
    if (!text(state.terms)) missing.push("Terms and Conditions are empty.");
    if (missing.length) {
      var warnings = document.createElement("div"); warnings.className = "program-quote-issue-warnings"; warnings.setAttribute("role", "alert");
      missing.forEach(function (message) { var warning = document.createElement("p"); warning.textContent = message; warnings.appendChild(warning); });
      var advice = document.createElement("p"); advice.textContent = "These sections will be blank on the issued quote. Cancel to complete them, or issue the quote with these sections empty.";
      warnings.appendChild(advice); node.appendChild(warnings);
    }
    var note = document.createElement("p"); note.textContent = "Issuing locks this revision and offers it to the customer. Record acceptance when the customer agrees."; node.appendChild(note);
    return UOS.dialogs.open({ title: "Issue Quote", node: node, modalClass: "program-quote-issue-dialog", actions: [{ label: "Cancel", value: false }, { label: "Issue quote", value: true, primary: true }] });
  }
  function onClick(event) {
    if (event.target.closest("[data-use-suggested-contribution]")) {
      if (["Issued", "Accepted", "Declined", "Superseded"].indexOf(state.status) >= 0 || state.quoteId && UOS.ProgramQuotes.commerciallyLocked(workspaceSnapshot(), state.quoteId)) return;
      state.proposedCustomerContribution = suggestedCustomerAmount();
      renderBuilder(); saveToWorkspace(); return;
    }
    var projectCard = event.target.closest("[data-quote-project-id]");
    // A restored Register drawer may itself carry Quote project context. Only
    // selection rows inside this Quote surface should consume its action clicks.
    if (projectCard && !rootNode.contains(projectCard)) projectCard = null;
    // Match Calculator: expanding a row also selects and loads its project.
    if (projectCard && event.target.closest("[data-disclosure-toggle]")) {
      var quoteDisclosureToggle = event.target.closest("[data-disclosure-toggle]");
      if (quoteDisclosureToggle.getAttribute("aria-expanded") !== "true") return;
      var quoteProjectId = projectCard.getAttribute("data-quote-project-id");
      var quoteWorkspace = workspaceSnapshot();
      var quoteProjectExists = quoteWorkspace && quoteWorkspace.entities && (quoteWorkspace.entities.projects || []).some(function (project) { return project.id === quoteProjectId; });
      if (!quoteProjectExists) return;
      state.selectedEntityId = quoteProjectId;
      Array.prototype.forEach.call(rootNode.querySelectorAll("[data-quote-project-id]"), function (row) {
        row.classList.toggle("is-selected", row.getAttribute("data-quote-project-id") === quoteProjectId);
      });
      /* Shared mini-drawer contract: any save which can rebuild this list runs
         after the one opening motion has settled. */
      populateClientFromEntity(quoteProjectId, true);
      preserveProjectListUntil = Date.now() + 1000;
      var finishQuoteSelection = function () {
        if (state.selectedEntityId === quoteProjectId && !state.quoteId) saveToWorkspace();
      };
      var disclosureApi = window.UOS && window.UOS.ProgramDisclosureRows;
      var disclosureKey = quoteDisclosureToggle.getAttribute("data-disclosure-key");
      if (!disclosureApi || typeof disclosureApi.afterOpen !== "function" || !disclosureApi.afterOpen(disclosureKey, finishQuoteSelection)) finishQuoteSelection();
      return;
    }
    if (projectCard) {
      var projId = projectCard.getAttribute("data-quote-project-id");
      if (projId && projId !== state.selectedEntityId) {
        state.selectedEntityId = projId;
        if (window.UOS && window.UOS.ProgramApp) {
          window.UOS.ProgramApp.updateWorkspace(function (candidate) {
            candidate.workspace = candidate.workspace || {};
            candidate.workspace.selectedProjectId = projId;
            candidate.workspace.selectedEntityId = projId;
            return candidate;
          }).then(function () {
            populateClientFromEntity(projId, false);
            renderProjectsList();
          });
        } else {
          populateClientFromEntity(projId, false);
          renderProjectsList();
        }
      }
      return;
    }
    var loadButton = event.target.closest("[data-quote-load]");
    if (loadButton) {
      var quoteId = loadButton.getAttribute("data-quote-load");
      var ws = workspaceSnapshot();
      var quote = ws && ws.entities && (ws.entities.quotes || []).find(function (item) { return item.id === quoteId; });
      var project = quote && (ws.entities.projects || []).find(function (item) { return item.id === quote.projectId; });
      if (quote && project) loadQuoteRecord(project, quote);
      return;
    }

    var jobFilterBtn = event.target.closest('[data-quote-job-filter]');
    if (jobFilterBtn) {
      var jf = jobFilterBtn.getAttribute("data-quote-job-filter");
      quoteJobFilter = quoteJobFilter === jf ? "all" : jf;
      renderProjectsList();
      return;
    }
    var statusFilterBtn = event.target.closest('[data-quote-status-filter]');
    if (statusFilterBtn) {
      var filterVal = (statusFilterBtn.getAttribute("data-quote-status-filter") || "").toLowerCase();
      var idx = quoteStatusFilters.indexOf(filterVal);
      if (idx >= 0) {
        quoteStatusFilters.splice(idx, 1);
      } else {
        quoteStatusFilters.push(filterVal);
      }
      renderProjectsList();
      return;
    }

    var quoteToolbarJump = event.target.closest("[data-quotes-toolbar-jump]");
    if (quoteToolbarJump && window.UOS && window.UOS.ProgramApp) {
      var jumpDest = quoteToolbarJump.getAttribute("data-quotes-toolbar-jump");
      if (typeof window.UOS.ProgramApp.navigateWithContext === "function") {
        window.UOS.ProgramApp.navigateWithContext(jumpDest, state.selectedEntityId);
        return;
      }
      window.UOS.ProgramApp.updateWorkspace(function (candidate) {
        candidate.workspace = candidate.workspace || {};
        if (state.selectedEntityId) {
          candidate.workspace.selectedProjectId = state.selectedEntityId;
          candidate.workspace.selectedEntityId = state.selectedEntityId;
          if (jumpDest === "costing") {
            candidate.workspace.costing = candidate.workspace.costing || {};
            candidate.workspace.costing.selectedProjectId = state.selectedEntityId;
          } else if (jumpDest === "scheduler") {
            candidate.workspace.scheduler = candidate.workspace.scheduler || {};
            candidate.workspace.scheduler.selectedProjectId = state.selectedEntityId;
          }
        }
        return candidate;
      }).then(function () {
        window.UOS.ProgramApp.navigate(jumpDest);
      });
      return;
    }
    var removeBtn = event.target.closest("[data-remove-line]");
    var addBtn = event.target.closest("[data-add-line]");
    var revisionBtn = event.target.closest("[data-quote-revision]");
    var refreshBtn = event.target.closest("[data-quote-refresh]");
    var issueBtn = event.target.closest("[data-quote-issue]");
    var acceptBtn = event.target.closest("[data-quote-accept]");
    var declineBtn = event.target.closest("[data-quote-decline]");
    var printBtn = event.target.closest("[data-quote-print]");
    var quoteJump = event.target.closest("[data-quotes-jump]");
    if (quoteJump && window.UOS && window.UOS.ProgramApp) {
      var jumpDest = quoteJump.getAttribute("data-quotes-jump");
      window.UOS.ProgramApp.updateWorkspace(function (candidate) {
        candidate.workspace = candidate.workspace || {};
        if (state.selectedEntityId) {
          candidate.workspace.selectedProjectId = state.selectedEntityId;
          candidate.workspace.selectedEntityId = state.selectedEntityId;
          if (jumpDest === "costing") {
            candidate.workspace.costing = candidate.workspace.costing || {};
            candidate.workspace.costing.selectedProjectId = state.selectedEntityId;
          }
        }
        return candidate;
      }).then(function () {
        window.UOS.ProgramApp.navigate(jumpDest);
      });
      return;
    }
    var saveBtn = event.target.closest("[data-quote-save]");
    var reverseBtn = event.target.closest("[data-payment-reverse]");

    if (reverseBtn) {
      reversePaymentWithReason(reverseBtn.getAttribute("data-payment-reverse"));
    } else if (removeBtn) {
      removeLineItem(removeBtn.getAttribute("data-remove-line"));
    } else if (addBtn) {
      addLineItem("Adjustment", "Quote adjustment", "item", 1, 0);
    } else if (refreshBtn && state.quoteId && !refreshBtn.disabled) {
      window.UOS.ProgramApp.updateWorkspace(function (workspace) {
          return window.UOS.ProgramQuotes.refreshDraftFromCurrentCosts(workspace, state.quoteId, { confirmed: true });
      }).then(function () { populateClientFromEntity(state.selectedEntityId, true); });
    } else if (issueBtn && state.selectedEntityId) {
      if (issueDialogPending) return;
      issueDialogPending = true;
      saveToWorkspace().then(function () { return confirmQuoteIssue(); }).then(function (confirmed) {
        if (!confirmed) return;
        var quoteId = state.quoteId;
        return window.UOS.ProgramApp.updateWorkspace(function (workspace) {
          return window.UOS.ProgramQuotes.issue(workspace, quoteId);
        }).then(function () {
          populateClientFromEntity(state.selectedEntityId, true);
          window.UOS.dialogs.alert({ title: "Quote Issued", message: "The quote has been issued and is awaiting customer acceptance. When the customer agrees to this quote, click Accept to record their acceptance. Issuing does not record payment or schedule the work." });
        });
      }).catch(function (error) {
        window.UOS.dialogs.alert({ title: "Quote Not Issued", message: error.message || "The quote could not be issued." });
      }).finally(function () { issueDialogPending = false; });
    } else if (acceptBtn && state.quoteId) {
      if (acceptDialogPending) return;
      acceptDialogPending = true;
      UOS.dialogs.open({ title: "Accept Quote", message: "Record acceptance only when the customer has agreed to this quote. Payments and scheduling are recorded separately.", actions: [{ label: "Cancel", value: false }, { label: "Accept quote", value: true, variant: "primary" }] }).then(function (confirmed) {
        if (!confirmed) return;
        return window.UOS.ProgramApp.updateWorkspace(function (workspace) {
        return window.UOS.ProgramQuotes.setStatus(workspace, state.quoteId, "Accepted");
      }).then(function () {
        populateClientFromEntity(state.selectedEntityId, true);
        window.UOS.dialogs.alert({ title: "Customer Acceptance Recorded", message: "Customer acceptance has been recorded for this quote. This confirms agreement to the quote; payments and scheduling are recorded separately." });
      }).catch(function (error) {
        window.UOS.dialogs.alert({ title: "Acceptance Not Recorded", message: error.message || "Customer acceptance could not be recorded." });
      });
      }).finally(function () { acceptDialogPending = false; });
    } else if (declineBtn && state.quoteId) {
      window.UOS.ProgramApp.updateWorkspace(function (workspace) {
        return window.UOS.ProgramQuotes.setStatus(workspace, state.quoteId, "Declined");
      }).then(function () { populateClientFromEntity(state.selectedEntityId, true); });
    } else if (revisionBtn && state.selectedEntityId && !revisionBtn.disabled) {
      if (revisionDialogPending) return;
      revisionDialogPending = true;
      var hasIssuedQuote = (workspaceSnapshot().entities.quotes || []).some(function (quote) { return quote.projectId === state.selectedEntityId && quote.status === "Issued"; });
      var revisionConfirmation = hasIssuedQuote ? UOS.dialogs.open({ title: "Create Quote Revision", message: "This Project has an issued quote. Creating a revision leaves that quote issued. If you issue the new revision, the existing issued quote can become Superseded.", actions: [{ label: "Cancel", value: false }, { label: "Create revision", value: true, variant: "primary" }] }) : Promise.resolve(true);
      revisionConfirmation.then(function (confirmed) {
        if (!confirmed) return;
        return window.UOS.ProgramApp.updateWorkspace(function (workspace) {
        var entityQuotes = (workspace.entities.quotes || []).filter(function (q) { return q.projectId === state.selectedEntityId; });
        var latestQuote = entityQuotes.sort(function (a, b) { return Number(b.revision || 1) - Number(a.revision || 1); })[0];

        if (!latestQuote) {
          workspace = window.UOS.ProgramQuotes.saveDraft(workspace, {
            projectId: state.selectedEntityId, quoteNumber: state.quoteNumber, revision: state.revision,
            clientName: state.clientName, address: state.address, email: state.email, preparedBy: state.preparedBy,
            quoteDate: state.quoteDate, expiryDate: state.expiryDate, discountRate: state.discountRate,
            contingencyRate: state.contingencyRate, scopeNotes: state.scopeNotes, terms: state.terms,
            customLines: state.lines.filter(function (line) { return line.sourceKind === "custom" && !line.readOnly; })
          });
          latestQuote = (workspace.entities.quotes || []).filter(function (q) { return q.projectId === state.selectedEntityId && q.status === "Draft"; })[0];
          if (!latestQuote) throw new Error("The initial Quote draft could not be created.");
        }

        if (latestQuote.status === "Draft") workspace = window.UOS.ProgramQuotes.issue(workspace, latestQuote.id);
        return window.UOS.ProgramQuotes.createRevision(workspace, latestQuote.id);
      }).then(function () {
        populateClientFromEntity(state.selectedEntityId, true);
        if (window.UOS && window.UOS.toast) window.UOS.toast("New Quote revision created.", "success");
      });
      }).finally(function () { revisionDialogPending = false; });
    } else if (printBtn) {
      if (!prepareQuotePrint()) return;
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          window.print();
        });
      });
    } else if (saveBtn) {
      saveToWorkspace().then(function () {
        window.UOS.dialogs.alert({ title: "Quote Saved", message: "Quotation " + state.quoteNumber + " has been saved into workspace." });
      }).catch(function (error) {
        window.UOS.dialogs.alert({ title: "Quote Not Saved", message: error.message || "The quote could not be saved." });
      });
    } else {
      var viewModeBtn = event.target.closest("[data-quote-view-mode]");
      if (viewModeBtn) {
        var selectedMode = viewModeBtn.getAttribute("data-quote-view-mode");
        state.viewMode = selectedMode;
        var allModeBtns = rootNode.querySelectorAll("[data-quote-view-mode]");
        Array.prototype.forEach.call(allModeBtns, function (btn) {
          var isActive = btn.getAttribute("data-quote-view-mode") === selectedMode;
          btn.classList.toggle("is-active", isActive);
          btn.setAttribute("aria-pressed", String(isActive));
          btn.style.background = isActive ? "#ffffff" : "transparent";
          btn.style.color = isActive ? "var(--uos-brand, #2563eb)" : "var(--uos-text-muted, #64748b)";
          btn.style.boxShadow = isActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none";
        });
        renderPreview();
      }
    }
  }


  function renderProjectsList() {
    var ws = workspaceSnapshot();
    if (!ws || !ws.entities) return;

    var list = rootNode ? rootNode.querySelector("[data-quote-projects-list]") : document.querySelector("[data-quote-projects-list]");
    if (!list) return;
    list.innerHTML = "";

    var contextProjectId = ws.workspace && ws.workspace.selectedProjectId || state.selectedEntityId;
    var contextProject = (ws.entities.projects || []).find(function (project) { return project.id === contextProjectId; });
    var targetOwner = contextProject && contextProject.owner === "EVT" ? "EVT" : (contextProject && contextProject.owner === "NSA" ? "NSA" : (state.ownerMode === "EVT" ? "EVT" : "NSA"));
    state.ownerMode = targetOwner;
    var modeLabel = targetOwner === "EVT" ? "Remediation" : "Nature Strip";

    var eyebrowEl = rootNode ? rootNode.querySelector("[data-quote-projects-eyebrow]") : document.querySelector("[data-quote-projects-eyebrow]");
    if (eyebrowEl) eyebrowEl.textContent = modeLabel + " Projects";

    var headingEl = rootNode ? rootNode.querySelector("[data-quote-projects-heading]") : document.querySelector("[data-quote-projects-heading]");
    if (headingEl) headingEl.textContent = targetOwner === "EVT" ? "Remediation Delivery Projects" : "Nature Strip Delivery Projects";

    var model = window.UOS.ProgramModel;
    var allProjects = model && typeof model.getProjects === "function"
      ? model.getProjects(ws, targetOwner)
      : (ws.entities.projects || []).filter(function (p) { return p.owner === targetOwner; });

    // Sync Quote Builder mini toolbar prerequisites
    var quoteToolbar = rootNode ? rootNode.querySelector("[data-quote-mini-toolbar]") : document.querySelector("[data-quote-mini-toolbar]");
    if (quoteToolbar && window.UOS && window.UOS.ProgramApp && typeof window.UOS.ProgramApp.syncToolbarPrerequisites === "function") {
      var selectedPrj = (allProjects || []).find(function (p) { return p.id === state.selectedEntityId; });
      var hasGeom = false;
      var hasJb = false;
      if (selectedPrj && ws && ws.entities) {
        var projId = selectedPrj.id;
        hasGeom = (ws.entities.geometries || []).some(function (g) { return g.projectId === projId || (g.payload && g.payload.projectId === projId); });
        hasJb = (ws.entities.jobs || []).some(function (j) { return j.projectId === projId; });
      }
      var hasCosted = false;
      if (selectedPrj && ws && ws.entities) {
        var prjJobs = (ws.entities.jobs || []).filter(function (j) { return j.projectId === selectedPrj.id; });
        if (prjJobs.length) {
          var jIds = {};
          prjJobs.forEach(function (j) { jIds[j.id] = true; });
          hasCosted = (ws.entities.costingLines || []).some(function (cl) {
            return cl.projectId === selectedPrj.id || jIds[cl.jobId];
          });
        }
      }
      window.UOS.ProgramApp.syncToolbarPrerequisites(quoteToolbar, {
        currentModule: "quotes",
        hasProject: Boolean(selectedPrj),
        hasMap: hasGeom,
        hasJobs: hasJb,
        hasCostedJobs: hasCosted,
        linkedProject: selectedPrj
      });
    }

    var projects = allProjects.slice().sort(function (a, b) {
      return (a.title || a.name || a.id).localeCompare(b.title || b.name || b.id);
    });

    function getProjectJobs(p) {
      if (!ws || !ws.entities || !Array.isArray(ws.entities.jobs)) return [];
      return ws.entities.jobs.filter(function (j) {
        return j.projectId === p.id || (j.payload && j.payload.projectId === p.id);
      });
    }

    // Render Unified Status Filter Pills matching Planner, Space Map, Costing, and Scheduler
    var container = rootNode ? (rootNode.querySelector("#quoteStatusFilterPills") || rootNode.querySelector('[data-status-filter-pills="quotes"]')) : document.querySelector('[data-status-filter-pills="quotes"]');
    if (container) {
      var allCount = projects.length;
      var withJobsCount = projects.filter(function (p) { return getProjectJobs(p).length > 0; }).length;
      var noJobsCount = projects.filter(function (p) { return getProjectJobs(p).length === 0; }).length;

      var possibleStatuses = ["Draft", "Quoted", "Planned", "In Progress", "Complete", "On Hold", "Approved", "Received", "Submitted", "Under Review"];
      projects.forEach(function (p) {
        var s = text(p.status || "").trim();
        if (s && possibleStatuses.indexOf(s) < 0) possibleStatuses.push(s);
      });

      var pillsHtml = '';
      pillsHtml += '<button type="button" class="program-status-pill-filter' + (quoteJobFilter === "all" || !quoteJobFilter ? ' is-active' : '') + '" data-quote-job-filter="all" aria-pressed="' + String(quoteJobFilter === "all" || !quoteJobFilter) + '">' +
        '<span>All</span><span class="program-status-pill-count">' + allCount + '</span></button>';
      pillsHtml += '<button type="button" class="program-status-pill-filter status--planned' + (quoteJobFilter === "with-jobs" ? ' is-active' : '') + '" data-quote-job-filter="with-jobs" aria-pressed="' + String(quoteJobFilter === "with-jobs") + '">' +
        '<span>With Labour</span><span class="program-status-pill-count">' + withJobsCount + '</span></button>';
      pillsHtml += '<button type="button" class="program-status-pill-filter status--draft' + (quoteJobFilter === "no-jobs" ? ' is-active' : '') + '" data-quote-job-filter="no-jobs" aria-pressed="' + String(quoteJobFilter === "no-jobs") + '">' +
        '<span>No Labour</span><span class="program-status-pill-count">' + noJobsCount + '</span></button>';

      possibleStatuses.forEach(function (statusVal) {
        var slug = statusVal.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        var isActive = quoteStatusFilters.indexOf(statusVal.toLowerCase()) >= 0;
        var count = projects.filter(function (p) {
          var s = text(p.status || "").trim();
          return s.toLowerCase() === statusVal.toLowerCase();
        }).length;
        if (count > 0 || isActive) {
          pillsHtml += '<button type="button" class="program-status-pill-filter status--' + esc(slug) + (isActive ? ' is-active' : '') + '" data-quote-status-filter="' + esc(statusVal) + '" aria-pressed="' + String(isActive) + '">' +
            '<span>' + esc(statusVal) + '</span><span class="program-status-pill-count">' + count + '</span></button>';
        }
      });

      container.innerHTML = pillsHtml;
      var badge = document.querySelector('[data-filter-drawer-badge="quotes"]');
      if (badge) {
        var actCount = (quoteSearchQuery ? 1 : 0) + (quoteJobFilter && quoteJobFilter !== "all" ? 1 : 0) + (quoteStatusFilters || []).length;
        badge.textContent = String(actCount);
        badge.hidden = (actCount === 0);
      }
    }

    // Filter projects by job presence, search, and status
    var filtered = projects.filter(function (p) {
      if (quoteJobFilter === "with-jobs" && getProjectJobs(p).length === 0) return false;
      if (quoteJobFilter === "no-jobs" && getProjectJobs(p).length > 0) return false;
      if (quoteStatusFilters.length > 0) {
        var pStatus = (p.status || "Draft").toLowerCase();
        if (quoteStatusFilters.indexOf(pStatus) < 0) return false;
      }
      if (quoteSearchQuery) {
        var q = quoteSearchQuery.toLowerCase();
        var matchTitle = (p.title || p.name || "").toLowerCase().indexOf(q) >= 0;
        var matchId = (p.id || "").toLowerCase().indexOf(q) >= 0;
        var matchReg = ((p.applicationId || p.eventId || "")).toLowerCase().indexOf(q) >= 0;
        var matchClient = ((p.applicantName || p.location || "")).toLowerCase().indexOf(q) >= 0;
        if (!matchTitle && !matchId && !matchReg && !matchClient) return false;
      }
      return true;
    });

    if (!filtered.length) {
      var emptyNotice = document.createElement("div");
      emptyNotice.className = "program-cost-empty";
      emptyNotice.innerHTML = "<strong>No " + modeLabel.toLowerCase() + " projects found</strong><p>Promote " + (targetOwner === "EVT" ? "EVT events" : "NSA applications") + " in the Register or adjust your search filter.</p>";
      list.appendChild(emptyNotice);
      return;
    }

    if (!state.selectedEntityId || !projects.some(function (p) { return p.id === state.selectedEntityId; })) {
      state.selectedEntityId = filtered[0].id;
    }

    filtered.forEach(function (project) {
      var isSelected = project.id === state.selectedEntityId;
      var owner = project.owner === "EVT" ? "EVT" : "NSA";
      var card = document.createElement("div");
      card.className = "program-quote-project-card" + (isSelected ? " is-selected" : "");
      card.setAttribute("data-quote-project-id", project.id);
      card.setAttribute("data-owner", owner);
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      var projectQuotes = (ws.entities.quotes || []).filter(function (q) { return q.projectId === project.id; });
      var latestQuote = projectQuotes.sort(function (a, b) { return Number(b.revision || 1) - Number(a.revision || 1); })[0];
      var quoteStatus = latestQuote ? latestQuote.status : "Unquoted";
      var statusSlug = (project.status || "Draft").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      var regIdVal = project.applicationId || project.eventId || "";
      var modelApi = window.UOS && window.UOS.ProgramModel;
      var locText = text(modelApi && typeof modelApi.displayAddressForProject === "function" ? modelApi.displayAddressForProject(ws, project) : (project.location || project.address)) || "No location specified";

      var iconSvg = owner === "EVT"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m12 13 1 2 2 .3-1.5 1.5.4 2.2-1.9-1-1.9 1 .4-2.2-1.5-1.5 2-.3Z"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>';

      var cardHtml = '<div class="program-quote-project-card__head">' +
        '<div class="program-quote-project-card__head-left">' +
          '<div class="program-quote-project-card__icon-badge program-quote-project-card__icon-badge--' + owner.toLowerCase() + '">' + iconSvg + '</div>' +
          '<strong class="program-quote-project-card__title">' + esc(project.title || project.name || project.id) + '</strong>' +
        '</div>' +
        '<span class="program-status-pill status--' + esc(statusSlug) + '">' +
          '<span>' + esc(project.status || "Draft") + '</span>' +
        '</span>' +
      '</div>' +
      '<div class="program-quote-project-card__divider"></div>' +
      '<div class="program-quote-project-card__ids">' +
        (regIdVal ?
          '<div class="program-quote-project-card__id-row">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true" class="program-quote-project-card__id-icon"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>' +
            '<span class="program-quote-project-card__id-label">Register ID:</span>' +
            '<span class="program-quote-project-card__id-value">' + esc(regIdVal) + '</span>' +
          '</div>' : '') +
        '<div class="program-quote-project-card__id-row">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true" class="program-quote-project-card__id-icon"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>' +
          '<span class="program-quote-project-card__id-label">Project ID:</span>' +
          '<span class="program-quote-project-card__id-value">' + esc(project.id) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="program-quote-project-card__divider"></div>' +
      '<div class="program-quote-project-card__loc-section">' +
        '<div class="program-quote-project-card__loc-row">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true" class="program-quote-project-card__loc-pin"><path d="M12 21.7C17.3 17 20 13 20 9a8 8 0 1 0-16 0c0 4 2.7 8 8 12.7z"/><circle cx="12" cy="9" r="3"/></svg>' +
          '<span class="program-quote-project-card__loc-text">' + esc(locText) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="program-quote-project-card__meta">' + quoteStatusPill(quoteStatus) +
        '<span>' + esc(latestQuote ? quoteCardDates(latestQuote) : "No saved quote") + '</span>' +
      '</div>';

      card.innerHTML = cardHtml;
      list.appendChild(card);
    });
  }

  function populateClientPicker() {
    var picker = rootNode ? rootNode.querySelector("[data-client-picker]") : null;
    if (!picker) return;

    picker.innerHTML = '<option value="">-- Select Delivery Project --</option>';
    if (window.UOS && window.UOS.ProgramApp) {
      var ws = workspaceSnapshot();
      var model = window.UOS.ProgramModel;
      if (ws && ws.entities) {
        var evtProjects = state.ownerMode === "EVT" ? (model && typeof model.getProjects === "function" ? model.getProjects(ws, "EVT") : (ws.entities.projects || []).filter(function(p){ return p.owner === "EVT"; })) : [];
        var nsaProjects = state.ownerMode === "NSA" ? (model && typeof model.getProjects === "function" ? model.getProjects(ws, "NSA") : (ws.entities.projects || []).filter(function(p){ return p.owner === "NSA"; })) : [];

        if (evtProjects.length) {
          var evtGrp = document.createElement("optgroup");
          evtGrp.label = "Remediation Projects";
          evtProjects.forEach(function (proj) {
            var opt = document.createElement("option");
            opt.value = proj.id;
            opt.textContent = proj.id + " · " + (proj.title || proj.name || "Remediation Project");
            if (state.selectedEntityId === proj.id) opt.selected = true;
            evtGrp.appendChild(opt);
          });
          picker.appendChild(evtGrp);
        }

        if (nsaProjects.length) {
          var nsaGrp = document.createElement("optgroup");
          nsaGrp.label = "Nature Strip Projects";
          nsaProjects.forEach(function (proj) {
            var opt = document.createElement("option");
            opt.value = proj.id;
            opt.textContent = proj.id + " · " + (proj.title || proj.name || "Nature Strip Project");
            if (state.selectedEntityId === proj.id) opt.selected = true;
            nsaGrp.appendChild(opt);
          });
          picker.appendChild(nsaGrp);
        }
      }
    }
  }

  function renderUI() {
    rootNode = document.querySelector("[data-program-view='quotes']") || rootNode;
    if (!rootNode) return;

    renderProjectsList();
    populateClientPicker();
    renderBuilder();
  }

  function resetQuoteEditor() {
    state.selectedEntityId = "";
    state.quoteId = "";
    state.auditNumber = "";
    state.previousAuditNumber = "";
    state.quoteNumber = "";
    state.status = "Draft";
    state.revision = 1;
    state.clientName = "";
    state.address = "";
    state.email = "";
    state.preparedBy = "";
    state.scopeNotes = "";
    state.terms = "";
    state.quoteDate = new Date().toISOString().slice(0, 10);
    state.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    state.discountRate = 0;
    state.contingencyRate = 0;
    state.operationalAmount = 0;
    state.fundingMode = "customer";
    state.proposedCustomerContribution = null;
    state.suppressCouncilDisclosure = false;
    state.lines = [];
    state.payments = [];
  }

  function clearSelectedClient() {
    resetQuoteEditor();
    renderBuilder();
  }

  var quoteSectionNavigation = null;
  function initQuoteSectionNavigation() {
    var body = rootNode.querySelector(".program-quote-pane-body");
    var rail = rootNode.querySelector(".program-quote-section-rail");
    if (!body || !rail) return;
    var headings = [1, 2, 3, 4, 5, 6].map(function (number) { return rootNode.querySelector("#quote-section-" + number); });
    var buttons = Array.prototype.slice.call(rail.querySelectorAll("[data-quote-section-link]"));
    var spacer = document.createElement("div");
    spacer.className = "program-quote-section-scroll-space";
    spacer.setAttribute("aria-hidden", "true");
    body.appendChild(spacer);
    var frame = null;
    function reveal(button) {
      var viewport = rail.getBoundingClientRect(), bounds = button.getBoundingClientRect();
      if (bounds.left < viewport.left + 6) rail.scrollLeft -= viewport.left + 6 - bounds.left;
      else if (bounds.right > viewport.right - 6) rail.scrollLeft += bounds.right - viewport.right + 6;
    }
    function update() {
      frame = null;
      if (!body.getClientRects().length || !body.clientHeight) return;
      var last = headings[5], lastCard = last.closest(".program-quote-card");
      var style = getComputedStyle(body);
      var tail = Math.max(0, body.clientHeight - 12 - (lastCard.getBoundingClientRect().bottom - last.getBoundingClientRect().top) - (parseFloat(style.paddingBottom) || 0) - (parseFloat(style.rowGap) || 0));
      var height = Math.ceil(tail) + "px";
      if (spacer.style.height !== height) spacer.style.height = height;
      var marker = body.getBoundingClientRect().top + body.clientTop + 12;
      var current = 0;
      headings.forEach(function (heading, index) {
        if (heading.getBoundingClientRect().top <= marker + 1) current = index;
      });
      buttons.forEach(function (button, index) {
        if (index === current) button.setAttribute("aria-current", "location");
        else button.removeAttribute("aria-current");
      });
      reveal(buttons[current]);
    }
    function schedule() {
      if (frame === null) frame = window.requestAnimationFrame(update);
    }
    rail.addEventListener("click", function (event) {
      var button = event.target.closest("[data-quote-section-link]");
      if (!button || !rail.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      update();
      var heading = headings[Number(button.getAttribute("data-quote-section-link")) - 1];
      var top = body.scrollTop + heading.getBoundingClientRect().top - body.getBoundingClientRect().top - body.clientTop - 12;
      body.scrollTo({ top: Math.max(0, top), behavior: "instant" });
      schedule();
    });
    body.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    if (typeof ResizeObserver === "function") {
      var observer = new ResizeObserver(schedule);
      observer.observe(body);
      observer.observe(rail);
      headings.forEach(function (heading) { observer.observe(heading.closest(".program-quote-card")); });
    }
    quoteSectionNavigation = { schedule: schedule };
    schedule();
  }

  function init() {
    if (initialized) return;
    rootNode = document.querySelector("[data-program-view='quotes']");
    if (!rootNode) return;
    initialized = true;
    initQuoteSectionNavigation();
    window.addEventListener("beforeprint", function () {
      var workspace = workspaceSnapshot();
      if (workspace && workspace.workspace.destination === "quotes") prepareQuotePrint();
    });
    window.addEventListener("afterprint", cleanupQuotePrint);

    document.addEventListener("input", function (event) {
      if (event.target.closest("[data-program-view='quotes']")) onInput(event);
    }, true);
    document.addEventListener("change", function (event) {
      if (!event.target.closest("[data-program-view='quotes']")) return;
      if (event.target.matches("[data-client-picker]")) {
        if (event.target.value) {
          populateClientFromEntity(event.target.value, false);
        } else {
          clearSelectedClient();
        }
      } else if (event.target.matches("select")) {
        onInput(event);
      }
    }, true);
    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-program-view='quotes']")) onClick(event);
    }, true);
    document.addEventListener("uos:privacy-changed", renderBuilder);
    document.addEventListener("submit", function (event) {
      if (!event.target.closest("[data-program-view='quotes']")) return;
      var form = event.target.closest("[data-payment-form]");
      if (!form) return;
      event.preventDefault();
      var quoteId = state.quoteId;
      if (!quoteId) return;
      var values = new FormData(form);
      var method = event.submitter && event.submitter.matches("[data-deposit-record]") ? "Paid with Deposit" : values.get("method");
      window.UOS.ProgramApp.updateWorkspace(function (workspace) {
        return window.UOS.ProgramQuotes.recordPayment(workspace, { quoteId: quoteId, amount: values.get("amount"), paymentDate: values.get("paymentDate"), method: method, reference: values.get("reference"), notes: values.get("notes") });
      }).then(function (workspace) {
        state.workspace = workspace || state.workspace;
        var quote = workspace && workspace.entities && (workspace.entities.quotes || []).find(function (item) { return item.id === quoteId; });
        var project = quote && (workspace.entities.projects || []).find(function (item) { return item.id === quote.projectId; });
        var isDeposit = method === "Paid with Deposit";
        form.reset();
        if (quote && project) loadQuoteRecord(project, quote); else renderBuilder();
        if (window.UOS && window.UOS.toast) {
          window.UOS.toast(isDeposit ? "Deposit recorded in Section 5 Payment Ledger." : "Payment recorded in Section 5 Payment Ledger.", "success");
        }
      }).catch(ledgerError);
    });

    document.addEventListener("uos:program-ready", function (event) {
      var ws = event.detail && event.detail.workspace;
      if (!ws || !ws.workspace) return;
    state.workspace = ws;
    // Clear stale editor memory even when the Quote Builder is not open.
    if (state.selectedEntityId && !(ws.entities && ws.entities.projects || []).some(function (project) { return project.id === state.selectedEntityId; })) {
      resetQuoteEditor();
      renderUI();
    }
    if (ws.workspace.destination !== "quotes") return;
      if (pendingDraftSaves && ws.workspace.selectedProjectId === state.selectedEntityId) { renderBuilder(); return; }
      if (ws.entities) {
        var contextProjectId = ws.workspace && ws.workspace.selectedProjectId || "";
        var contextProject = (ws.entities.projects || []).find(function (project) { return project.id === contextProjectId; });
        var nextOwnerMode = contextProject && (contextProject.owner === "EVT" || contextProject.owner === "NSA")
          ? contextProject.owner
          : (ws.workspace && ws.workspace.ownerMode === "EVT" ? "EVT" : "NSA");
        if (nextOwnerMode !== state.ownerMode || contextProjectId && contextProjectId !== state.selectedEntityId) resetProjectListFilters();
        state.ownerMode = nextOwnerMode;
        var selectedProject = (ws.entities.projects || []).find(function (project) { return project.id === state.selectedEntityId; });
        if (selectedProject && selectedProject.owner !== state.ownerMode) clearSelectedClient();
        if (contextProjectId && contextProjectId !== state.selectedEntityId) {
          populateClientFromEntity(contextProjectId, true);
        } else if (state.selectedEntityId) {
          populateClientFromEntity(state.selectedEntityId, true);
        } else {
          state.lines = [];
          state.clientName = "";
          state.address = "";
          state.email = "";
        }
      }
      var disclosureApi = window.UOS && window.UOS.ProgramDisclosureRows;
      var activeDisclosureKey = disclosureApi && typeof disclosureApi.activeKey === "function" ? disclosureApi.activeKey() : "";
      var preserveOpenProjectList = contextProjectId && (
        activeDisclosureKey === "quote-project:" + contextProjectId ||
        Date.now() < preserveProjectListUntil && state.selectedEntityId === contextProjectId
      );
      if (preserveOpenProjectList) {
        populateClientPicker();
        renderBuilder();
      } else {
        renderUI();
      }
    });

  }

  UOS.QuoteBuilderController = {
    init: init,
    renderUI: renderUI,
    addLineItem: addLineItem,
    removeLineItem: removeLineItem,
    calculateTotals: calculateTotals,
    getState: function () { return state; }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}());
