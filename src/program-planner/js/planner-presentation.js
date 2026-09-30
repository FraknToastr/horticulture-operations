(function () {
  "use strict";
 var inertIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="1"></circle><circle cx="6" cy="12" r="1"></circle><circle cx="6" cy="17" r="1"></circle><path d="M10 7h8M10 12h8M10 17h8"></path></svg>';
  var jobIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4l-3.1 3.1-2.7-.7-.7-2.7 3.5-2.7Z"></path></svg>';
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
      var type = document.createElement('span');
      var maintenance = document.createElement('span');
      cell.setAttribute('data-planner-presented', '');
      type.className = 'planner-task-type-group' + (label === 'Scheduled Job' || label === 'Draft Planner Job' ? ' is-linked-job' : '');
path.innerHTML = (label === 'Inert' ? inertIcon : label === 'Scheduled Job' ? scheduledIcon : label === 'Draft Planner Job' ? calendarIcon : jobIcon) + '<span class="uos-sr-only">' + label + '</span>';
path.setAttribute('data-uos-tooltip', label === 'Inert' ? 'Reminder item' : label === 'Scheduled Job' ? 'Open scheduled job in Scheduler' : label === 'Draft Planner Job' ? 'Open draft Planner Job in Scheduler' : label);
if (label === 'Scheduled Job' || label === 'Draft Planner Job') path.setAttribute('aria-label', label === 'Scheduled Job' ? 'Open scheduled job in Scheduler' : 'Open draft Planner Job in Scheduler');
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
