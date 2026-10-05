(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {}, renderPending = false, focusReturns = new WeakMap(), lifecycleTargetId = "", legacyReasons = {};
  document.documentElement.classList.add("program-status-v5");
  function text(value) { return String(value == null ? "" : value).trim(); }
  function esc(value) { return text(value).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function workspace() { return UOS.ProgramApp && UOS.ProgramApp.workspace ? UOS.ProgramApp.workspace() : null; }
  function operator() { try { return text(sessionStorage.getItem("uos.program.statusOperator")); } catch (error) { return ""; } }
  function setOperator(value) { try { sessionStorage.setItem("uos.program.statusOperator", text(value)); } catch (error) {} }
  function announce(message) { var live = document.querySelector("[data-program-live-region], #programLiveRegion, [aria-live]"); if (live) live.textContent = message; if (UOS.toast) UOS.toast(message, "success"); }
  function entity(ws, id) { var result = null; ["applications", "events", "projects", "jobs", "tasks"].some(function (name) { var record = (ws.entities[name] || []).find(function (item) { return item.id === id; }); if (record) result = { record: record, collection: name, domain: UOS.ProgramStatus.domainFor(record, name) }; return Boolean(record); }); return result; }
  function dialogMarkup() {
    if (document.querySelector("[data-status-confirm-dialog]")) return;
    document.body.insertAdjacentHTML("beforeend", '<dialog class="program-rate-dialog program-status-dialog" data-status-operator-dialog aria-labelledby="statusOperatorTitle"><form method="dialog" class="program-data-dialog__frame"><header><div><p class="uos-eyebrow">Officer attribution</p><h2 id="statusOperatorTitle">Who is operating this session?</h2></div></header><div class="program-data-dialog__body"><label class="uos-field"><span>Operator name</span><input class="uos-input" name="operator" autocomplete="name" required></label><p class="program-status-error" data-status-operator-error role="alert" hidden></p></div><footer><button class="uos-button uos-button--secondary" type="button" data-status-cancel>Cancel</button><button class="uos-button uos-button--primary" value="confirm">Continue</button></footer></form></dialog>' +
      '<dialog class="program-rate-dialog program-status-dialog" data-status-confirm-dialog aria-labelledby="statusConfirmTitle"><form method="dialog" class="program-data-dialog__frame"><header><div><p class="uos-eyebrow">Governed status action</p><h2 id="statusConfirmTitle" data-status-confirm-title>Confirm transition</h2></div></header><div class="program-data-dialog__body"><p data-status-confirm-summary></p><label class="uos-field" data-status-reason-field><span>Reason</span><textarea class="uos-textarea" name="reason" rows="4"></textarea></label><p class="program-status-error" data-status-confirm-error role="alert" hidden></p></div><footer><button class="uos-button uos-button--secondary" type="button" data-status-cancel>Cancel</button><button class="uos-button uos-button--primary" value="confirm">Confirm</button></footer></form></dialog>' +
      '<dialog class="program-rate-dialog program-status-dialog program-status-reason-dialog" data-status-reason-dialog aria-labelledby="statusReasonTitle"><div class="program-data-dialog__frame"><header><div><p class="uos-eyebrow">Recorded reason</p><h2 id="statusReasonTitle" data-status-reason-action>Status action</h2></div><button class="uos-button uos-button--secondary uos-button--icon" type="button" data-status-reason-close aria-label="Close reason"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="program-data-dialog__body"><p data-status-reason-text></p><dl class="program-status-reason-meta"><div><dt>Actor</dt><dd data-status-reason-actor></dd></div><div><dt>Timestamp</dt><dd data-status-reason-time></dd></div></dl></div><footer><button class="uos-button uos-button--secondary" type="button" data-status-reason-close>Close</button></footer></div></dialog>');
  }
  function ensureLifecycleDialog() {
    if (document.querySelector("[data-status-lifecycle-dialog]")) return;
    document.body.insertAdjacentHTML("beforeend", '<dialog id="statusLifecycleDialog" class="program-rate-dialog program-status-dialog program-status-lifecycle-dialog" data-status-lifecycle-dialog aria-labelledby="statusLifecycleTitle"><div class="program-data-dialog__frame"><header><div><p class="uos-eyebrow">Status governance</p><h2 id="statusLifecycleTitle" data-status-lifecycle-title tabindex="-1">Governed Lifecycle</h2></div><button type="button" class="uos-button uos-button--secondary uos-button--icon" data-status-lifecycle-close aria-label="Close Governed Lifecycle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="program-data-dialog__body program-status-lifecycle-content" data-status-lifecycle-content></div><footer><button type="button" class="uos-button uos-button--secondary" data-status-lifecycle-close>Close</button></footer></div></dialog>');
  }
  function showModal(dialog, returnTarget, fallbackSelector) {
    focusReturns.set(dialog, { node: returnTarget || document.activeElement, fallbackSelector: fallbackSelector || "" });
    if (!dialog.open) dialog.showModal();
    setTimeout(function () { var first = dialog.querySelector("input, textarea, button, [tabindex='0'], [tabindex='-1']"); if (first) first.focus(); }, 0);
  }
  function closeModal(dialog) {
    if (!dialog) return;
    if (dialog.open) dialog.close();
    var target = focusReturns.get(dialog), node = target && target.node;
    if ((!node || !node.isConnected) && target && target.fallbackSelector) node = document.querySelector(target.fallbackSelector);
    focusReturns.delete(dialog);
    if (node && node.focus) node.focus();
  }
  function ensureOperator() {
    if (operator()) return Promise.resolve(operator());
    var dialog = document.querySelector("[data-status-operator-dialog]"), form = dialog.querySelector("form"), input = form.elements.operator, error = dialog.querySelector("[data-status-operator-error]"), cancelButton = dialog.querySelector("[data-status-cancel]");
    return new Promise(function (resolve, reject) {
      function done(event) { event.preventDefault(); var value = text(input.value); if (!value) { error.textContent = "Enter an operator name."; error.hidden = false; return; } cleanup(); setOperator(value); closeModal(dialog); resolve(value); }
      function cancelled() { cleanup(); closeModal(dialog); reject(new Error("Status action cancelled.")); }
      function cleanup() { form.removeEventListener("submit", done); dialog.removeEventListener("cancel", cancelled); cancelButton.removeEventListener("click", cancelled); }
      form.addEventListener("submit", done); dialog.addEventListener("cancel", cancelled, { once: true }); cancelButton.addEventListener("click", cancelled, { once: true }); showModal(dialog);
    });
  }
  function confirmTransition(target, to) {
    return ensureOperator().then(function (actor) {
      var ws = workspace(), found = entity(ws, target), from = UOS.ProgramStatus.codeFor(found.domain, found.record.status);
      var dialog = document.querySelector("[data-status-confirm-dialog]"), form = dialog.querySelector("form"), cancelButton = dialog.querySelector("[data-status-cancel]"), required = UOS.ProgramStatus.reasonRequired(found.domain, from, to);
      dialog.querySelector("[data-status-confirm-title]").textContent = to === "complete" || to === "completed" ? "Confirm completion" : "Confirm status transition";
      dialog.querySelector("[data-status-confirm-summary]").textContent = UOS.ProgramStatus.labelFor(found.domain, from) + " → " + UOS.ProgramStatus.labelFor(found.domain, to);
      dialog.querySelector("[data-status-reason-field]").hidden = !required; form.elements.reason.required = required; form.elements.reason.value = "";
      return new Promise(function (resolve, reject) {
        function submit(event) { event.preventDefault(); var reason = text(form.elements.reason.value); if (required && !reason) { var err = dialog.querySelector("[data-status-confirm-error]"); err.textContent = "A reason is required."; err.hidden = false; return; } cleanup(); closeModal(dialog); UOS.ProgramApp.executeStatusCommand({ entityId: target, entityType: found.record.type, to: to, actor: actor, reason: reason }).then(function () { announce("Status changed to " + UOS.ProgramStatus.labelFor(found.domain, to) + "."); resolve(); }, reject); }
        function cancel() { cleanup(); closeModal(dialog); reject(new Error("Status action cancelled.")); }
        function cleanup() { form.removeEventListener("submit", submit); dialog.removeEventListener("cancel", cancel); cancelButton.removeEventListener("click", cancel); }
        form.addEventListener("submit", submit); dialog.addEventListener("cancel", cancel, { once: true }); cancelButton.addEventListener("click", cancel, { once: true }); showModal(dialog);
      });
    });
  }
  function nextCodes(domain, code) {
    var def = UOS.ProgramStatus.definitions[domain], result = [];
    (def.order || []).forEach(function (candidate) { if (UOS.ProgramStatus.canHumanTransition(domain, code, candidate)) result.push(candidate); });
    if (["project", "task"].indexOf(domain) >= 0 && code !== "on_hold" && def.terminal.indexOf(code) < 0) result.push("on_hold");
    if (def.labels.cancelled && def.terminal.indexOf(code) < 0) result.push("cancelled");
    return result.filter(function (value, index, values) { return value !== code && values.indexOf(value) === index; });
  }
  function reasonButton(event) { return event.reason ? '<button type="button" class="program-status-reason-button" data-status-reason-id="' + esc(event.id) + '" aria-label="View reason for ' + esc(event.action) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/></svg></button>' : ""; }
  function controlHtml(found, ws) {
    var code = UOS.ProgramStatus.codeFor(found.domain, found.record.status), recs = (ws.entities.statusRecommendations || []).filter(function (item) { return item.entityId === found.record.id && item.status === "open"; });
    var events = (ws.entities.statusEvents || []).filter(function (item) { return item.entityId === found.record.id; }).sort(function (a, b) { return text(b.timestamp).localeCompare(text(a.timestamp)); });
    var actions = nextCodes(found.domain, code).map(function (next) { var label = found.domain === "project" && code === "draft" && next === "planning" ? "Start planning" : UOS.ProgramStatus.labelFor(found.domain, next); return '<button type="button" class="uos-button uos-button--secondary uos-button--sm" data-status-command="' + esc(next) + '">' + esc(label) + '</button>'; }).join("");
    return '<section class="program-status-controls" data-status-controls-for="' + esc(found.record.id) + '"><header><div><p class="uos-eyebrow">Governed lifecycle</p><h4 class="program-status-current">' + esc(UOS.ProgramStatus.labelFor(found.domain, code)) + '</h4></div><label class="program-status-pause"><input type="checkbox" data-status-pause ' + (found.record.statusAutomationPaused ? "checked" : "") + '><span>Pause automation</span></label></header><div class="program-status-actions">' + actions + '</div>' + recs.map(function (rec) { return '<div class="program-status-recommendation"><p>' + esc(rec.message) + '</p><div><button class="uos-button uos-button--primary uos-button--sm" data-status-recommendation="' + esc(rec.id) + '" data-status-decision="approve">Approve</button><button class="uos-button uos-button--secondary uos-button--sm" data-status-recommendation="' + esc(rec.id) + '" data-status-decision="dismiss">Dismiss</button></div></div>'; }).join("") + (events.length ? '<ol class="program-status-events" aria-label="Status history">' + events.map(function (event) { return '<li><span>' + esc(UOS.ProgramStatus.labelFor(event.domain, event.toStatus)) + '</span><time datetime="' + esc(event.timestamp) + '">' + esc(new Date(event.timestamp).toLocaleString("en-AU")) + '</time>' + reasonButton(event) + '</li>'; }).join("") + '</ol>' : "") + '</section>';
  }
  function attachControls() {
    var ws = workspace(); if (!ws) return;
    var scheduleForm = document.querySelector("[data-scheduler-form]"); if (scheduleForm && scheduleForm.elements.status) { scheduleForm.elements.status.disabled = true; var statusField = scheduleForm.elements.status.closest("label"); if (statusField) statusField.hidden = true; }
    document.querySelectorAll("[data-register-drawer-record], [data-planner-project-id]").forEach(function (host) {
      var id = host.getAttribute("data-register-drawer-record") || host.getAttribute("data-planner-project-id"), found = entity(ws, id);
      if (!found) return; host.querySelectorAll(".program-status-pill").forEach(function (pill) { pill.textContent = UOS.ProgramStatus.labelFor(found.domain, found.record.status); }); var legacyHistory = host.querySelector("[data-register-status-history-list]"); if (legacyHistory) legacyHistory.hidden = true; var old = host.querySelector('[data-status-controls-for="' + CSS.escape(id) + '"]'); if (old) old.remove(); host.insertAdjacentHTML("beforeend", controlHtml(found, ws));
    });
    var scheduler = ws.workspace && ws.workspace.scheduler || {}, detail = document.querySelector("[data-scheduler-detail]");
    if (detail && !detail.hidden && scheduler.selectedId) { var job = entity(ws, scheduler.selectedId), prior = detail.querySelector("[data-status-controls-for]"); if (prior) prior.remove(); if (job) detail.insertAdjacentHTML("beforeend", controlHtml(job, ws)); }
  }
  function renderQueue() {
    var ws = workspace(); if (!ws) return;
    var dashboard = document.querySelector(".program-dashboard__operations");
    if (dashboard) {
      var panel = dashboard.querySelector("[data-status-review-panel]");
      if (!panel) { dashboard.insertAdjacentHTML("beforeend", '<section class="program-dashboard-panel program-island program-status-review" data-status-review-panel aria-labelledby="status-review-title"><header class="program-dashboard-panel__head"><div><p class="uos-eyebrow">Governance</p><h4 id="status-review-title">Status Review <span data-status-review-count aria-live="polite"></span></h4></div></header><div data-status-review-list></div><p data-status-review-empty>No status recommendations require review.</p></section>'); panel = dashboard.querySelector("[data-status-review-panel]"); }
      var open = (ws.entities.statusRecommendations || []).filter(function (item) { return item.status === "open"; }), list = panel.querySelector("[data-status-review-list]");
      panel.querySelector("[data-status-review-count]").textContent = open.length ? "(" + open.length + ")" : ""; panel.querySelector("[data-status-review-empty]").hidden = open.length > 0;
      list.innerHTML = open.map(function (item) { return '<article class="program-status-review-row"><p>' + esc(item.message) + '</p><div><button class="uos-button uos-button--primary uos-button--sm" data-status-recommendation="' + esc(item.id) + '" data-status-decision="approve">Approve</button><button class="uos-button uos-button--secondary uos-button--sm" data-status-recommendation="' + esc(item.id) + '" data-status-decision="dismiss">Dismiss</button></div></article>'; }).join("");
    }
    var dataView = document.querySelector('[data-program-view="data"]');
    if (dataView && !dataView.querySelector("[data-status-automation-card]")) dataView.insertAdjacentHTML("afterbegin", '<section class="program-island program-status-automation" data-status-automation-card><header><div><p class="uos-eyebrow">Status governance</p><h3>Guarded automation</h3></div><label class="program-status-pause"><input type="checkbox" data-status-automation><span>Enable deterministic status automation</span></label></header><p data-status-readiness></p><button class="uos-button uos-button--secondary uos-button--sm" type="button" data-status-bulk-approve>Approve all retrospective recommendations</button></section>');
    var toggle = document.querySelector("[data-status-automation]"); if (toggle) toggle.checked = Boolean(ws.statusControl && ws.statusControl.automationEnabled);
    var readiness = document.querySelector("[data-status-readiness]"); if (readiness) { var report = ws.migration && ws.migration.statusReadiness; readiness.textContent = report ? (report.status === "ready" ? "Migration readiness reviewed by " + report.reviewedBy + ". " : "Migration readiness review required. Automation starts paused. ") + report.unknownStatusCount + " unrecognised status value(s)." : "Automation applies only to new causal signals; resuming does not replay missed transitions."; }
    document.querySelectorAll(".program-payment-ledger__reason").forEach(function (node, index) { var id = "payment-reason-" + index + "-" + text(node.textContent).length; legacyReasons[id] = { action: "Payment reversed", reason: text(node.textContent), actor: "Not recorded", timestamp: "Not recorded" }; node.outerHTML = '<button type="button" class="program-status-reason-button" data-legacy-reason-id="' + id + '" aria-label="View payment reversal reason"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/></svg></button>'; });
  }
  function lifecycleTriggerHtml(found) {
    return '<button type="button" class="uos-button uos-button--secondary uos-button--sm program-status-lifecycle-open program-status-lifecycle-review" data-status-lifecycle-open="' + esc(found.record.id) + '" aria-haspopup="dialog" aria-controls="statusLifecycleDialog" aria-label="Review governed lifecycle for ' + esc(found.record.title || found.record.name || found.record.eventName || found.record.id) + '">Review</button>';
  }
  function renderDrawerHistory(panel, found, ws) {
    var list = panel && panel.querySelector("[data-register-status-history-list]");
    if (!list) return;
    var events = (ws.entities.statusEvents || []).filter(function (item) { return item.entityId === found.record.id; }).sort(function (a, b) { return text(b.timestamp).localeCompare(text(a.timestamp)); });
    if (!events.length) return;
    list.innerHTML = events.map(function (item) {
      var label = UOS.ProgramStatus.labelFor(item.domain || found.domain, item.toStatus);
      var timestamp = item.timestamp ? new Date(item.timestamp).toLocaleString("en-AU") : "Date not recorded";
      return '<div class="program-register-history-item" data-register-timeline-status="' + esc(item.toStatus) + '"><div class="program-register-history-left"><span class="program-status-current">' + esc(label) + '</span><time class="program-register-history-date" datetime="' + esc(item.timestamp) + '">' + esc(timestamp) + '</time></div>' + reasonButton(item) + '</div>';
    }).join("");
  }
  function renderLifecycleDialog() {
    var dialog = document.querySelector("[data-status-lifecycle-dialog]");
    if (!dialog || !dialog.open || !lifecycleTargetId) return;
    var ws = workspace(), found = ws && entity(ws, lifecycleTargetId);
    if (!found) { closeLifecycle(); return; }
    dialog.querySelector("[data-status-lifecycle-title]").textContent = "Governed Lifecycle — " + (found.record.title || found.record.name || found.record.eventName || found.record.id);
    dialog.querySelector("[data-status-lifecycle-content]").innerHTML = controlHtml(found, ws);
  }
  function openLifecycle(id, trigger) {
    var ws = workspace(), found = ws && entity(ws, id), dialog = document.querySelector("[data-status-lifecycle-dialog]");
    if (!found || !dialog) return;
    lifecycleTargetId = id;
    dialog.querySelector("[data-status-lifecycle-title]").textContent = "Governed Lifecycle — " + (found.record.title || found.record.name || found.record.eventName || found.record.id);
    dialog.querySelector("[data-status-lifecycle-content]").innerHTML = controlHtml(found, ws);
    showModal(dialog, trigger, '[data-status-lifecycle-open="' + CSS.escape(id) + '"]');
  }
  function closeLifecycle() {
    var dialog = document.querySelector("[data-status-lifecycle-dialog]");
    closeModal(dialog);
    lifecycleTargetId = "";
  }
  function attachGovernedControls() {
    var ws = workspace();
    if (!ws) return;
    var scheduleForm = document.querySelector("[data-scheduler-form]");
    if (scheduleForm && scheduleForm.elements.status) {
      scheduleForm.elements.status.disabled = true;
      var schedulerStatusField = scheduleForm.elements.status.closest("label");
      if (schedulerStatusField) schedulerStatusField.hidden = true;
    }
    document.querySelectorAll("[data-register-drawer-record], [data-planner-project-id]").forEach(function (host) {
      var id = host.getAttribute("data-register-drawer-record") || host.getAttribute("data-planner-project-id");
      var found = entity(ws, id);
      if (!found) return;
      var panel = host.querySelector("[data-register-status-history-panel], .program-register-nsa-section--timeline.program-register-status-history");
      var legacyLayout = panel && panel.querySelector(".program-register-status-layout");
      var legacyHistory = panel && panel.querySelector("[data-register-status-history-list]");
      if (legacyLayout) legacyLayout.hidden = false;
      if (legacyHistory) legacyHistory.hidden = false;
      var old = host.querySelector('[data-status-governed-mount="' + CSS.escape(id) + '"]');
      if (old) old.remove();
    if (host.hasAttribute("data-register-drawer-record") && panel) {
      panel.hidden = false;
      panel.setAttribute("data-register-status-history-panel", "");
      var heading = panel.querySelector(".program-register-nsa-section__heading, .program-status-history-heading");
      if (!heading) {
        heading = document.createElement("header");
        heading.className = "program-status-history-heading";
        var title = panel.querySelector(".program-register-history-title, .program-register-section-title");
        panel.insertBefore(heading, panel.firstChild);
        if (title) heading.appendChild(title);
      }
      var launcher = host.querySelector('[data-status-lifecycle-launcher="' + CSS.escape(id) + '"]');
      if (!launcher) {
        launcher = document.createElement("div");
        launcher.className = "program-status-lifecycle-launcher";
        launcher.setAttribute("data-status-lifecycle-launcher", id);
      }
      if (launcher.parentNode !== heading) heading.appendChild(launcher);
      var trigger = launcher.querySelector('[data-status-lifecycle-open="' + CSS.escape(id) + '"]');
      if (!trigger) launcher.insertAdjacentHTML("beforeend", lifecycleTriggerHtml(found));
      renderDrawerHistory(panel, found, ws);
      } else {
        var mountRoot = panel || host;
        var mount = mountRoot.querySelector('[data-status-governed-mount="' + CSS.escape(id) + '"]');
        if (!mount) {
          mount = document.createElement("div");
          mount.className = "program-status-governed-mount";
          mount.setAttribute("data-status-governed-mount", id);
          mountRoot.appendChild(mount);
        }
        mount.innerHTML = controlHtml(found, ws);
      }
    });
    var scheduler = ws.workspace && ws.workspace.scheduler, detail = document.querySelector("[data-scheduler-detail]");
    if (detail && !detail.hidden && scheduler && scheduler.selectedId) {
      var job = entity(ws, scheduler.selectedId), trigger = detail.querySelector("[data-scheduler-status]");
      detail.querySelectorAll("[data-status-scheduler-mount], [data-status-controls-for]").forEach(function (node) { node.remove(); });
      if (trigger) {
        trigger.disabled = !job;
        if (job) trigger.setAttribute("data-status-lifecycle-open", job.record.id);
        else trigger.removeAttribute("data-status-lifecycle-open");
      }
    }
  }
  function render() { if (renderPending) return; renderPending = true; requestAnimationFrame(function () { renderPending = false; renderQueue(); attachGovernedControls(); renderLifecycleDialog(); }); }
  function showReason(id) { var ws = workspace(), event = (ws.entities.statusEvents || []).find(function (item) { return item.id === id; }); if (!event || !event.reason) return; var dialog = document.querySelector("[data-status-reason-dialog]"); dialog.querySelector("[data-status-reason-action]").textContent = event.action; dialog.querySelector("[data-status-reason-text]").textContent = event.reason; dialog.querySelector("[data-status-reason-actor]").textContent = event.actor || "Not recorded"; dialog.querySelector("[data-status-reason-time]").textContent = new Date(event.timestamp).toLocaleString("en-AU"); showModal(dialog); }
  function showLegacyReason(id) { var value = legacyReasons[id]; if (!value) return; var dialog = document.querySelector("[data-status-reason-dialog]"); dialog.querySelector("[data-status-reason-action]").textContent = value.action; dialog.querySelector("[data-status-reason-text]").textContent = value.reason; dialog.querySelector("[data-status-reason-actor]").textContent = value.actor; dialog.querySelector("[data-status-reason-time]").textContent = value.timestamp; showModal(dialog); }
  function bind() {
    dialogMarkup();
    ensureLifecycleDialog();
  document.querySelector("[data-status-lifecycle-dialog]").addEventListener("cancel", function (event) { event.preventDefault(); closeLifecycle(); });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var lifecycle = document.querySelector("[data-status-lifecycle-dialog]");
    if (!lifecycle || !lifecycle.open) return;
    if (document.querySelector("[data-status-operator-dialog][open], [data-status-confirm-dialog][open], [data-status-reason-dialog][open]")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeLifecycle();
  }, true);
    document.addEventListener("change", function (event) {
      var taskStatus = event.target.closest && event.target.closest("[data-checklist-status]");
      if (!taskStatus) return;
      event.preventDefault(); event.stopImmediatePropagation();
      var id = taskStatus.getAttribute("data-checklist-status"), found = entity(workspace(), id), requested = found && UOS.ProgramStatus.codeFor("task", taskStatus.value);
      if (!found || requested === UOS.ProgramStatus.reviewCode) { render(); return; }
      confirmTransition(id, requested).catch(function (error) { render(); if (error.message.indexOf("cancelled") < 0) announce(error.message); });
    }, true);
    document.addEventListener("click", function (event) {
      var command = event.target.closest("[data-status-command]"), recommendation = event.target.closest("[data-status-recommendation]"), reason = event.target.closest("[data-status-reason-id]"), legacyReason = event.target.closest("[data-legacy-reason-id]"), close = event.target.closest("[data-status-reason-close]"), lifecycleOpen = event.target.closest("[data-status-lifecycle-open]"), lifecycleClose = event.target.closest("[data-status-lifecycle-close]");
      if (lifecycleOpen) { openLifecycle(lifecycleOpen.getAttribute("data-status-lifecycle-open"), lifecycleOpen); return; }
      if (lifecycleClose) { closeLifecycle(); return; }
      if (reason) { showReason(reason.getAttribute("data-status-reason-id")); return; }
      if (legacyReason) { showLegacyReason(legacyReason.getAttribute("data-legacy-reason-id")); return; }
      if (close) { closeModal(close.closest("dialog")); return; }
      if (command) { var host = command.closest("[data-status-controls-for]"); confirmTransition(host.getAttribute("data-status-controls-for"), command.getAttribute("data-status-command")).catch(function (error) { if (error.message.indexOf("cancelled") < 0) announce(error.message); }); return; }
      if (recommendation) { ensureOperator().then(function (actor) { return UOS.ProgramApp.resolveStatusRecommendation(recommendation.getAttribute("data-status-recommendation"), recommendation.getAttribute("data-status-decision"), { actor: actor }); }).then(function () { announce("Status recommendation reviewed."); }).catch(function (error) { if (error.message.indexOf("cancelled") < 0) announce(error.message); }); }
      var bulk = event.target.closest("[data-status-bulk-approve]");
      if (bulk) ensureOperator().then(function (actor) { var open = (workspace().entities.statusRecommendations || []).filter(function (item) { return item.status === "open" && item.retrospective; }); return open.reduce(function (promise, item) { return promise.then(function () { return UOS.ProgramApp.resolveStatusRecommendation(item.id, "approve", { actor: actor }); }); }, Promise.resolve()); }).then(function () { announce("Retrospective status recommendations approved."); }).catch(function (error) { if (error.message.indexOf("cancelled") < 0) announce(error.message); });
    });
    document.addEventListener("change", function (event) {
      if (event.target.matches("[data-status-pause]")) { var host = event.target.closest("[data-status-controls-for]"); UOS.ProgramApp.setRecordStatusPause(host.getAttribute("data-status-controls-for"), event.target.checked).then(function () { announce(event.target.checked ? "Status automation paused for this record." : "Status automation resumed; missed transitions were not replayed."); }); }
      if (event.target.matches("[data-status-automation]")) { var checked = event.target.checked; ensureOperator().then(function (actor) { return UOS.ProgramApp.setStatusAutomation(checked, actor); }).then(function () { announce(checked ? "Status automation enabled." : "Status automation paused for this workspace."); }).catch(function () { event.target.checked = !checked; }); }
    });
    document.addEventListener("uos:program-ready", render); document.addEventListener("uos:workspace-changed", render); document.addEventListener("click", function (event) { if (event.target.closest("[data-disclosure-toggle], [data-scheduler-job], [data-open-destination]")) setTimeout(render, 0); }); render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true }); else bind();
}());
