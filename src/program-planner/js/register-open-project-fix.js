(function () {
  "use strict";
  document.addEventListener("click", function (event) {
    var button = event.target.closest && event.target.closest('[data-register-action="open-project"]');
    if (!button) return;
    var projectId = button.getAttribute("data-register-project-id");
    var app = window.UOS && window.UOS.ProgramApp;
    if (!projectId || !app || typeof app.updateWorkspace !== "function") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    app.updateWorkspace(function (workspace) {
      workspace.workspace = workspace.workspace || {};
      var project = (workspace.entities.projects || []).find(function (item) { return item.id === projectId; });
      workspace.workspace.selectedEntityId = projectId;
      workspace.workspace.selectedProjectId = projectId;
      workspace.workspace.planner = workspace.workspace.planner || {};
      workspace.workspace.planner.selectedProjectId = projectId;
      workspace.workspace.destination = "planner";
      if (project && project.owner) workspace.workspace.ownerMode = project.owner;
      return workspace;
    }).then(function () { if (typeof app.navigate === "function") app.navigate("planner"); });
  }, true);
}());
