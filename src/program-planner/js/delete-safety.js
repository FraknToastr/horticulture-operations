(function (root, factory) {
  "use strict";
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.UOS = root.UOS || {};
  root.UOS.ProgramDeleteSafety = api;
}(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";
  var pending = false;
  function app() { return root.UOS && root.UOS.ProgramApp; }
  function report(error) {
    if (root.UOS && typeof root.UOS.toast === "function") root.UOS.toast(error.message || String(error), "error");
    return null;
  }
  function context(workspace) {
    var ui = workspace && workspace.workspace || {};
    return JSON.stringify([ui.selectedEntityId || "", ui.selectedProjectId || ""]);
  }
  function captureGuard(validate) {
    var controller = app();
    if (!controller || typeof controller.workspace !== "function") throw new Error("Deletion is unavailable: the workspace could not be checked.");
    var original = controller.workspace(), fingerprint = JSON.stringify(original.entities), selected = context(original);
    return function (candidate) {
      var live = controller.workspace();
      if (!candidate || context(live) !== selected || JSON.stringify(candidate.entities) !== fingerprint ||
          (validate && !validate(candidate))) {
        throw new Error("The deletion target or workspace changed. Review it and try again.");
      }
      return candidate;
    };
  }
  function confirm(options) {
    options = options || {};
    if (pending) return Promise.resolve(null);
    var dialogs = root.UOS && root.UOS.dialogs, guard;
    if (!dialogs || typeof dialogs.confirm !== "function") {
      report(new Error("Deletion is unavailable: the warning dialog could not be opened."));
      return Promise.resolve(null);
    }
    try { guard = captureGuard(options.validate); }
    catch (error) { report(error); return Promise.resolve(null); }
    pending = true;
    return Promise.resolve().then(function () {
      return dialogs.confirm({ title: options.title, message: options.message,
        confirmLabel: options.confirmLabel || "Delete", cancelLabel: "Cancel", danger: true });
    }).then(function (confirmed) {
      if (!confirmed) return null;
      guard(app().workspace());
      return options.apply(guard);
    }).catch(report).finally(function () { pending = false; });
  }
  return { confirm: confirm, captureGuard: captureGuard };
}));
