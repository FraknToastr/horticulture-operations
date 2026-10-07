(function () {
  "use strict";

  var inertIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="1"></circle><circle cx="6" cy="12" r="1"></circle><circle cx="6" cy="17" r="1"></circle><path d="M10 7h8M10 12h8M10 17h8"></path></svg>';
  var calendarIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18"></path></svg>';
  var scheduledIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18M8 16l2.5 2.5L16.5 13"></path></svg>';
  var editIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"></path><path d="m13.5 6.5 4 4"></path></svg>';
  var deleteIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14"></path></svg>';

  function iconButton(button, label, icon) {
    if (!button) return null;
    button.classList.add("commercial-icon-button");
    button.setAttribute("aria-label", label);
    button.setAttribute("data-uos-tooltip", label);
    button.setAttribute("title", label);
    button.innerHTML = icon + '<span class="uos-sr-only">' + label + '</span>';
    return button;
  }

  function decorate() {
    document.querySelectorAll(".planner-col-action:not([data-planner-presented])").forEach(function (cell) {
      var sourceRail = cell.querySelector(".planner-action-rail") || cell;
      var path = sourceRail.querySelector(".planner-task-path");
      var info = sourceRail.querySelector("[data-planner-task-info]");
      var edit = sourceRail.querySelector("[data-planner-edit-task]");
      var remove = sourceRail.querySelector("[data-delete-item]");
      if (!path || !info || !remove) return;

      var linked = path.hasAttribute("data-planner-open-scheduled-job");
      var scheduled = linked && path.classList.contains("is-scheduled");
      var draft = linked && !scheduled;
      var operational = path.hasAttribute("data-planner-draft-job");
      var jobLabel = scheduled ? "Scheduled Job — open in Scheduler" : draft ? "Draft Planner Job — open in Scheduler" : operational ? "Operational task — create draft Job in Scheduler" : "Reminder task";
      iconButton(path, jobLabel, scheduled ? scheduledIcon : (draft || operational) ? calendarIcon : inertIcon);
      path.setAttribute("data-planner-job-state", scheduled ? "scheduled" : draft ? "draft" : operational ? "operational" : "inert");
      iconButton(info, "View task information", '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v6m0-10v.1"></path></svg>');
      iconButton(edit, "Edit task", editIcon);
      iconButton(remove, "Delete task", deleteIcon);

      var rail = document.createElement("div");
      var type = document.createElement("span");
      var maintenance = document.createElement("span");
      rail.className = "commercial-action-rail planner-action-rail";
      type.className = "planner-task-type-group" + (linked ? " is-linked-job" : "");
      maintenance.className = "planner-task-maintenance-actions";
      type.appendChild(path);
      maintenance.appendChild(info);
      if (edit) maintenance.appendChild(edit);
      maintenance.appendChild(remove);
      rail.appendChild(type);
      rail.appendChild(maintenance);
      cell.innerHTML = "";
      cell.appendChild(rail);
      cell.setAttribute("data-planner-presented", "true");
    });
  }

  function observe() {
    decorate();
    var host = document.querySelector('[data-program-view="planner"]');
    if (!host || !window.MutationObserver) return;
    new MutationObserver(decorate).observe(host, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observe, { once: true });
  else observe();
}());
