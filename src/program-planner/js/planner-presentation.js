(function () {
  "use strict";
 var inertIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="1"></circle><circle cx="6" cy="12" r="1"></circle><circle cx="6" cy="17" r="1"></circle><path d="M10 7h8M10 12h8M10 17h8"></path></svg>';
var calendarIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18"></path></svg>';
var scheduledIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M8 3v4M16 3v4M3 10h18M8 16l2.5 2.5L16.5 13"></path></svg>';
  var editIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"></path><path d="m13.5 6.5 4 4"></path></svg>';
  var deleteIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14"></path></svg>';
  function decorate() {
    document.querySelectorAll('.planner-col-action:not([data-planner-presented])').forEach(function (cell) {
      var path = cell.querySelector('.planner-task-path');
      var edit = cell.querySelector('[data-planner-edit-task]');
      var remove = cell.querySelector('[data-delete-item]');
      if (!path) return;
      var label = path.textContent.trim();
      var linked = path.hasAttribute('data-planner-open-scheduled-job');
      var scheduled = linked && path.classList.contains('is-scheduled');
      var operational = linked || path.hasAttribute('data-planner-draft-job');
      var tooltip = linked ? (scheduled ? 'Open scheduled job in Scheduler' : 'Open draft Planner Job in Scheduler')
        : operational ? 'Operational task — create draft Job in Scheduler' : 'Reminder item';
      var type = document.createElement('span');
      var maintenance = document.createElement('span');
      cell.setAttribute('data-planner-presented', '');
      type.className = 'planner-task-type-group' + (linked ? ' is-linked-job' : '');
      path.innerHTML = (scheduled ? scheduledIcon : operational ? calendarIcon : inertIcon) + '<span class="uos-sr-only">' + label + '</span>';
      path.setAttribute('data-planner-job-state', scheduled ? 'scheduled' : linked ? 'draft' : operational ? 'operational' : 'inert');
      path.setAttribute('data-uos-tooltip', tooltip);
      if (operational) path.setAttribute('aria-label', tooltip);
      type.appendChild(path);
      if (edit) { edit.className += ' planner-maintenance-icon'; edit.setAttribute('aria-label', 'Edit task'); edit.setAttribute('data-uos-tooltip', 'Edit task'); edit.innerHTML = editIcon + '<span class="uos-sr-only">Edit task</span>'; maintenance.appendChild(edit); }
      if (remove) { remove.className += ' planner-maintenance-icon'; remove.setAttribute('aria-label', 'Delete task'); remove.setAttribute('data-uos-tooltip', 'Delete task'); remove.innerHTML = deleteIcon + '<span class="uos-sr-only">Delete task</span>'; maintenance.appendChild(remove); }
      maintenance.className = 'planner-task-maintenance-actions';
      cell.innerHTML = '';
      cell.appendChild(type);
      cell.appendChild(maintenance);
    });
  }
  function observe() { var host = document.querySelector('[data-program-view="planner"]'); if (!host || !window.MutationObserver) return; new MutationObserver(decorate).observe(host, { childList:true, subtree:true }); decorate(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once:true }); else observe();
}());
