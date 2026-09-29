(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var pending = false;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function historyMarkup(record, workspace) {
    var events = ((workspace.entities && workspace.entities.statusEvents) || [])
      .filter(function (event) { return event.entityId === record.id; })
      .sort(function (a, b) { return text(b.timestamp).localeCompare(text(a.timestamp)); });

    if (!events.length) return "";
    return '<ol class="program-status-events" aria-label="Status history">' + events.map(function (event) {
      var domain = event.domain || UOS.ProgramStatus.domainFor(record, record.owner === "EVT" ? "events" : "applications");
      var timestamp = new Date(event.timestamp);
      var dateLabel = Number.isNaN(timestamp.getTime()) ? text(event.timestamp) : timestamp.toLocaleString("en-AU");
      var reasonButton = event.reason
        ? '<button type="button" class="program-status-reason-button" data-status-reason-id="' + escapeHtml(event.id) + '" aria-label="View reason for ' + escapeHtml(event.action || "status change") + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/></svg></button>'
        : "";
        return '<li data-register-timeline-status="' + escapeHtml(event.toStatus) + '"><span>' + escapeHtml(UOS.ProgramStatus.labelFor(domain, event.toStatus)) + '</span><time datetime="' + escapeHtml(event.timestamp) + '">' + escapeHtml(dateLabel) + '</time>' + reasonButton + '</li>';
    }).join("") + "</ol>";
  }

  function render() {
    pending = false;
    if (!UOS.ProgramApp || !UOS.ProgramStatus) return;
    var workspace = UOS.ProgramApp.workspace();
    if (!workspace || !workspace.entities) return;

    document.querySelectorAll("[data-register-drawer-record]").forEach(function (host) {
      var id = host.getAttribute("data-register-drawer-record");
      var record = (workspace.entities.applications || []).concat(workspace.entities.events || []).find(function (item) { return item.id === id; });
      if (!record) return;

      var panel = host.querySelector("[data-register-status-history-panel], .program-register-status-history");
      var list = host.querySelector("[data-register-status-history-list], .program-register-history-list");
      if (!panel || !list) return;
      panel.hidden = false;
      list.hidden = false;

      var markup = historyMarkup(record, workspace);
      if (markup && list.innerHTML !== markup) list.innerHTML = markup;
    });
  }

  function scheduleRender() {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(render);
  }

  document.addEventListener("uos:program-ready", scheduleRender);
  document.addEventListener("uos:workspace-changed", scheduleRender);
  if (document.body && typeof MutationObserver === "function") {
    new MutationObserver(scheduleRender).observe(document.body, { childList: true, subtree: true });
  }
  scheduleRender();
}());
