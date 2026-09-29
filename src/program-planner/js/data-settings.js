(function () {
  "use strict";
  var UOS = window.UOS = window.UOS || {};
  function text(value) { return String(value == null ? "" : value); }
  function appIdentity() {
    return UOS.ProgramAppConfig && typeof UOS.ProgramAppConfig.current === "function" ? UOS.ProgramAppConfig.current() : null;
  }
  function create(options) {
    options = options || {};
    var root = options.root || document;
    var getWorkspace = options.getWorkspace;
    var commit = options.commit;
    if (!UOS.ProgramData || typeof getWorkspace !== "function" || typeof commit !== "function") throw new Error("ProgramDataSettings requires ProgramData, getWorkspace, and commit.");
    var staged = null;
    var deletionBackupRevision = null;
    function backupSessionKey() {
      var identity = appIdentity() || {};
      return "uos.program.backup-reminder:" + text(identity.owner || identity.workspaceKind || "workspace");
    }
 function workspaceHasOperationalRecords(workspace) {
      var entities = workspace && workspace.entities || {};
      return Object.keys(entities).some(function (collection) {
        if (collection === "rateItems" || collection === "catalogs") return false;
        return Array.isArray(entities[collection]) && entities[collection].length > 0;
  });
 }
 function backupLastSavedLabel() {
   var workspace = getWorkspace() || {};
   var revision = Math.max(0, Number(workspace.workspaceRevision) || 0);
   var savedAt = workspace.updatedAt ? new Date(workspace.updatedAt) : null;
   if (!revision || !savedAt || Number.isNaN(savedAt.valueOf())) return "No workspace save has been recorded.";
   var timeZone = workspace.context && workspace.context.timeZone || "Australia/Adelaide";
   var dateText = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: timeZone }).format(savedAt).replace(",", "");
   var timeText = new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: timeZone }).format(savedAt).replace(/\s/g, "").toLowerCase();
   return "Last workspace save: " + dateText + ", " + timeText;
 }
 function updateBackupLastSaved() {
   var node = one("[data-program-backup-last-saved]");
   if (node) node.textContent = backupLastSavedLabel();
 }
 function setBackupReminder(hidden) {
   var reminder = one("[data-program-backup-reminder]");
   if (!reminder) return;
   if (hidden) {
     if (reminder.open && typeof reminder.close === "function") reminder.close();
     return;
   }
   updateBackupLastSaved();
   if (typeof reminder.showModal === "function" && !reminder.open) reminder.showModal();
 }
    function acknowledgeBackupReminder() {
      try { window.sessionStorage.setItem(backupSessionKey(), "acknowledged"); } catch (_) {}
      setBackupReminder(true);
    }
    function showBackupReminder() {
      var acknowledged = false;
      try { acknowledged = window.sessionStorage.getItem(backupSessionKey()) === "acknowledged"; } catch (_) {}
      setBackupReminder(acknowledged || !workspaceHasOperationalRecords(getWorkspace()));
    }
    function one(selector) { return root.querySelector(selector); }
    function many(selector) { return root.querySelectorAll ? Array.prototype.slice.call(root.querySelectorAll(selector)) : [one(selector)].filter(Boolean); }
    function set(selector, value) { var node = one(selector); if (node) node.textContent = text(value); }
    function list(selector, values, formatter) {
      var node = one(selector); if (!node) return; node.replaceChildren();
      (values || []).forEach(function (value) { var item = document.createElement("li"); item.textContent = formatter ? formatter(value) : text(value); node.appendChild(item); });
    }
    function showListSection(selector, values) {
      var node = one(selector), section = node && node.closest("section");
      if (section) section.hidden = !(values && values.length);
    }
    function showPreview(value) {
      var legacy = value.preview.legacyMigration;
      var legacySection = one("[data-program-import-legacy-summary]");
      if (legacySection) legacySection.hidden = !legacy;
      if (legacy) {
        set("[data-program-import-legacy-message]", "V" + legacy.sourceSchemaVersion + " combined NSA/Events workspace will be converted to V" + legacy.targetSchemaVersion + ". Applying replaces the current " + legacy.targetLabel + " workspace; the other app is unchanged.");
        var foreignTotal = Object.keys(legacy.discarded.foreignOwner || {}).reduce(function (sum, name) { return sum + Number(legacy.discarded.foreignOwner[name] || 0); }, 0);
        var retainedDetails = Object.keys(legacy.retainedCounts || {}).filter(function (name) { return Number(legacy.retainedCounts[name]) > 0; }).sort().map(function (name) { return name.replace(/([a-z])([A-Z])/g, "$1 $2") + ": " + legacy.retainedCounts[name]; });
        var unresolvedCount = (legacy.unresolvedCatalogAssignments || []).length;
        var details = [legacy.retainedTotal + " app records retained for " + legacy.targetLabel + ".", legacy.discarded.total + " records discarded (" + foreignTotal + " from the other app; " + legacy.discarded.excludedLegacy + " excluded legacy-module records).", "Retained collections — " + retainedDetails.join(", ") + ".", unresolvedCount + " catalogue assignments require review after migration."];
        list("[data-program-import-legacy-details]", details);
      } else list("[data-program-import-legacy-details]", []);
      var warnings = value.preview.warnings || [], conflicts = value.preview.conflicts || [];
      list("[data-program-import-warnings]", warnings);
      showListSection("[data-program-import-warnings]", warnings);
      list("[data-program-import-conflicts]", conflicts, function (item) { return item.id + " — " + item.resolution; });
      showListSection("[data-program-import-conflicts]", conflicts);
      var applyButton = one("[data-program-import-apply]");
      if (applyButton) {
        applyButton.disabled = value.preview.blocked === true;
        if (value.preview.blocked === true) applyButton.setAttribute("aria-describedby", "program-import-blocked-status");
        else applyButton.removeAttribute("aria-describedby");
      }
      var blockedStatus = one("[data-program-import-blocked]");
      if (blockedStatus) {
        blockedStatus.hidden = value.preview.blocked !== true;
        blockedStatus.textContent = value.preview.blocked === true ? "This import is blocked. Resolve the reported errors before applying it." : "";
      }
      var dialog = one("[data-program-import-modal]");
      if (dialog && typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    }
    function runHealth() {
      if (!UOS.ProgramDataHealth) return null;
      var result = UOS.ProgramDataHealth.check(getWorkspace());
      var contractText = result.contracts && result.contracts.total ? " · " + result.contracts.enforced + " enforced product contracts checked" + (result.contracts.deferred ? " · " + result.contracts.deferred + " lifecycle contract deferred" : "") : "";
      set("[data-program-health-summary]", (result.status === "healthy" ? "Healthy — no relationship issues found." : result.counts.error + " errors · " + result.counts.warning + " warnings") + contractText);
      var mutation = UOS.ProgramObservability && UOS.ProgramObservability.latest ? UOS.ProgramObservability.latest() : null;
      var changedCollections = mutation ? Object.keys(mutation.changed || {}).sort() : [];
      var changedCount = mutation ? changedCollections.reduce(function (sum, name) { return sum + mutation.changed[name].length; }, 0) : 0;
      set("[data-program-mutation-summary]", mutation
        ? "Latest successful mutation: " + mutation.command + " · revision " + mutation.revision + " · " + changedCount + " changed IDs across " + changedCollections.length + " collections · " + mutation.durationMs.toFixed(1) + " ms."
        : "No successful workspace mutation recorded in this document.");
      list("[data-program-health-issues]", result.issues, function (item) { return (item.contractId ? item.contractId + " · " : "") + item.code + (item.entityId ? " · " + item.entityId : "") + " — " + item.message; });
      return result;
    }
    async function inspectFile(file) {
      set("[data-program-data-status]", "Inspecting " + text(file && file.name) + "…");
      try {
        staged = await UOS.ProgramData.stage(file, getWorkspace(), options.stageOptions);
        showPreview(staged);
        set("[data-program-data-status]", "Import ready for review. Nothing changes until Apply import is selected.");
        return staged;
      } catch (error) {
        staged = null;
        set("[data-program-data-status]", error.message);
        if (window.console && console.error) console.error("Smart Import inspection failed:", error);
        throw error;
      }
    }
    async function apply() {
      if (!staged) throw new Error("Inspect a supported file before applying an import.");
      if (staged.preview && staged.preview.blocked === true) throw new Error("This import is blocked and cannot be applied.");
      var result = await UOS.ProgramData.apply(staged, { commit: commit, currentWorkspace: getWorkspace() });
      set("[data-program-data-status]", "Import applied atomically.");
      var dialog = one("[data-program-import-modal]"); if (dialog && typeof dialog.close === "function") dialog.close();
      staged = null; return result;
    }
    function cancel() { staged = null; var dialog = one("[data-program-import-modal]"); if (dialog && typeof dialog.close === "function") dialog.close(); set("[data-program-data-status]", "Import cancelled. No data was changed."); }
    function exportName(kind, extension) {
      var exportedAt = new Date();
      var pad = function (value) { return String(value).padStart(2, "0"); };
      var dateStamp = exportedAt.getFullYear() + pad(exportedAt.getMonth() + 1) + pad(exportedAt.getDate());
      var timeStamp = pad(exportedAt.getHours()) + pad(exportedAt.getMinutes()) + pad(exportedAt.getSeconds());
      var identity = appIdentity() || {};
      var owner = text(identity.owner || identity.workspaceKind || "workspace").toLowerCase();
      return "horticulture-" + owner + "-" + kind + "-" + dateStamp + "-" + timeStamp + "-v5." + extension;
    }
    function downloadJson() {
      var workspace = getWorkspace();
      UOS.imports.download(exportName("workspace-backup", "json"), UOS.ProgramData.exportJson(workspace, appIdentity()), "application/json;charset=utf-8");
      acknowledgeBackupReminder();
      set("[data-program-data-status]", "Portable schema-v5 JSON workspace backup downloaded."); closeExport();
      return Math.max(0, Number(workspace && workspace.workspaceRevision) || 0);
    }
    function downloadBundle() {
      UOS.imports.download(exportName("handoff", "zip"), UOS.ProgramData.exportBundle(getWorkspace(), appIdentity()), "application/zip");
      set("[data-program-data-status]", "Verified CSV and GeoJSON handoff bundle exported."); closeExport();
    }
    function openExport() { var dialog = one("[data-program-export-modal]"); if (dialog && typeof dialog.showModal === "function" && !dialog.open) dialog.showModal(); }
    function closeExport() { var dialog = one("[data-program-export-modal]"); if (dialog && typeof dialog.close === "function") dialog.close(); }
    var input = one("[data-program-import-input]"); if (input) input.addEventListener("change", function () { if (input.files && input.files[0]) inspectFile(input.files[0]).catch(function () {}); input.value = ""; });
    var choose = one("[data-program-smart-import]"); if (choose && input) choose.addEventListener("click", function (e) { e.stopPropagation(); input.click(); });
    var dropzone = one("[data-program-dropzone]");
    if (dropzone) {
      ["dragenter", "dragover"].forEach(function (eventName) {
        dropzone.addEventListener(eventName, function (e) { e.preventDefault(); e.stopPropagation(); dropzone.classList.add("is-dragover"); });
      });
      ["dragleave", "dragend"].forEach(function (eventName) {
        dropzone.addEventListener(eventName, function (e) { e.preventDefault(); e.stopPropagation(); dropzone.classList.remove("is-dragover"); });
      });
      dropzone.addEventListener("drop", function (e) {
        e.preventDefault(); e.stopPropagation(); dropzone.classList.remove("is-dragover");
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) inspectFile(e.dataTransfer.files[0]).catch(function () {});
      });
      dropzone.addEventListener("click", function (e) {
        if (e.target.closest("[data-program-smart-import]")) return;
        if (input) input.click();
      });
    }
    var pendingClearType = null;

    function openClearConfirmation(clearType) {
      pendingClearType = clearType;
      var labels = {
        users: "Clear Users",
        rates: "Clear Rates Catalog",
        nsa: "Clear Nature Strip Register",
        evt: "Clear Remediation Register",
        payments: "Clear Payment Ledger",
        all: "Clear All Data"
      };
      var targetLabel = labels[clearType] || clearType;
      set("[data-program-clear-title]", clearType === "all" ? "Confirm Clear Session Data?" : "Confirm " + targetLabel + "?");
      set("[data-program-clear-message]", clearType === "all" ? "Are you sure you want to clear active session data? Stored browser data remains available and can be restored at any time." : "Are you sure you want to " + targetLabel.toLowerCase() + " for the current session? Active in-memory data will be cleared immediately.");
      var dialog = one("[data-program-clear-dialog]");
      if (dialog && typeof dialog.showModal === "function" && !dialog.open) {
        dialog.showModal();
      }
    }

    function closeClearConfirmation() {
      pendingClearType = null;
      var dialog = one("[data-program-clear-dialog]");
      if (dialog && typeof dialog.close === "function") dialog.close();
    }

    function confirmClear() {
      if (!pendingClearType) return;
      var clearType = pendingClearType;
      closeClearConfirmation();
      if (UOS.ProgramApp && typeof UOS.ProgramApp.clearInMemory === "function") {
        UOS.ProgramApp.clearInMemory(clearType);
        var labels = { users: "Users cleared", rates: "Rates Catalog cleared", nsa: "Nature Strip Register cleared", evt: "Remediation Register cleared", payments: "Payment Ledger cleared", all: "All data cleared" };
        set("[data-program-data-status]", "Session clearance applied: " + (labels[clearType] || clearType) + " (in-memory only).");
      }
    }

    many("[data-program-clear]").forEach(function (button) {
      button.addEventListener("click", function () {
        var clearType = button.getAttribute("data-program-clear");
        openClearConfirmation(clearType);
      });
    });

    function openDeleteConfirmation() {
      deletionBackupRevision = null;
      var confirm = one("[data-program-delete-confirm]");
      if (confirm) confirm.disabled = true;
      var dialog = one("[data-program-delete-dialog]");
      if (dialog && typeof dialog.showModal === "function" && !dialog.open) {
        dialog.showModal();
      }
    }

    function closeDeleteConfirmation() {
      deletionBackupRevision = null;
      var confirm = one("[data-program-delete-confirm]");
      if (confirm) confirm.disabled = true;
      var dialog = one("[data-program-delete-dialog]");
      if (dialog && typeof dialog.close === "function") dialog.close();
    }

    function backupBeforeDelete() {
      deletionBackupRevision = downloadJson();
      var confirm = one("[data-program-delete-confirm]");
      if (confirm) { confirm.disabled = false; confirm.removeAttribute("aria-describedby"); }
      set("[data-program-data-status]", "Backup downloaded. You may now confirm deletion of this exact workspace revision.");
    }

    function confirmDelete() {
      if (deletionBackupRevision == null) return;
      var expectedRevision = deletionBackupRevision;
      closeDeleteConfirmation();
      if (UOS.ProgramApp && typeof UOS.ProgramApp.deleteStoredWorkspace === "function") {
        set("[data-program-data-status]", "Deleting stored workspace data...");
        UOS.ProgramApp.deleteStoredWorkspace(expectedRevision).then(function () {
          set("[data-program-data-status]", "Stored workspace deleted. Initialized fresh empty workspace.");
        }).catch(function (err) {
          set("[data-program-data-status]", "Failed to delete stored workspace: " + (err.message || err));
        });
      }
    }

    var deleteBtn = one("[data-program-delete-stored]");
    if (deleteBtn) deleteBtn.addEventListener("click", openDeleteConfirmation);
    var deleteBackupBtn = one("[data-program-delete-backup]");
    if (deleteBackupBtn) deleteBackupBtn.addEventListener("click", backupBeforeDelete);
    var deleteConfirmBtn = one("[data-program-delete-confirm]");
    if (deleteConfirmBtn) deleteConfirmBtn.addEventListener("click", confirmDelete);
    many("[data-program-delete-cancel]").forEach(function (button) {
      button.addEventListener("click", closeDeleteConfirmation);
    });

    var restoreBtn = one("[data-program-restore-stored]");
    if (restoreBtn) {
      restoreBtn.addEventListener("click", function () {
        if (UOS.ProgramApp && typeof UOS.ProgramApp.restoreStoredData === "function") {
          set("[data-program-data-status]", "Restoring stored workspace data...");
          UOS.ProgramApp.restoreStoredData().then(function () {
            set("[data-program-data-status]", "Stored data successfully restored to active session.");
          }).catch(function (err) {
            set("[data-program-data-status]", "Failed to restore data: " + (err.message || err));
          });
        }
      });
    }

    var clearConfirmBtn = one("[data-program-clear-confirm]");
    if (clearConfirmBtn) clearConfirmBtn.addEventListener("click", confirmClear);
    many("[data-program-clear-cancel]").forEach(function (button) {
      button.addEventListener("click", closeClearConfirmation);
    });
    var applyButton = one("[data-program-import-apply]"); if (applyButton) applyButton.addEventListener("click", function () { apply().catch(function (error) { set("[data-program-data-status]", error.message); }); });
    var healthButton = one("[data-program-health-run]"); if (healthButton) healthButton.addEventListener("click", runHealth);
    many("[data-program-import-cancel]").forEach(function (button) { button.addEventListener("click", cancel); });
    var jsonButton = one("[data-program-export-json]"); if (jsonButton) jsonButton.addEventListener("click", downloadJson);
    var backupNow = one("[data-program-backup-now]"); if (backupNow) backupNow.addEventListener("click", downloadJson);
    var backupLater = one("[data-program-backup-later]"); if (backupLater) backupLater.addEventListener("click", acknowledgeBackupReminder);
    var bundleButton = one("[data-program-export-bundle]"); if (bundleButton) bundleButton.addEventListener("click", downloadBundle);
    var exportOpen = one("[data-program-export-open]"); if (exportOpen) exportOpen.addEventListener("click", openExport);
    many("[data-program-export-cancel]").forEach(function (button) { button.addEventListener("click", closeExport); });
 if (root && typeof root.addEventListener === "function") root.addEventListener("uos:program-ready", showBackupReminder);
    showBackupReminder();
    return { inspectFile: inspectFile, apply: apply, cancel: cancel, runHealth: runHealth, openExport: openExport, closeExport: closeExport, downloadJson: downloadJson, downloadBundle: downloadBundle, showBackupReminder: showBackupReminder, getStaged: function () { return staged; } };
  }
  function mount() {
    if (UOS.ProgramDataSettings.controller) return UOS.ProgramDataSettings.controller;
    var reader = UOS.xlsxReader || window.UOS.xlsxReader;
    var getWorkspace = function () {
      if (UOS.ProgramApp && typeof UOS.ProgramApp.workspace === "function") {
        return UOS.ProgramApp.workspace();
      }
      return {};
    };
    var commit = function (workspace, commitOptions) {
      if (!UOS.ProgramApp) return Promise.reject(new Error("The program application is not ready."));
      if (typeof UOS.ProgramApp.adoptWorkspace === "function") {
        return UOS.ProgramApp.adoptWorkspace(workspace, commitOptions).then(function (saved) {
          if (!saved) throw new Error("The imported workspace could not be saved. No import was applied.");
          return saved;
        });
      }
      if (typeof UOS.ProgramApp.updateWorkspace === "function") {
        return UOS.ProgramApp.updateWorkspace(function () { return workspace; }).then(function (saved) {
          if (!saved) throw new Error("The imported workspace could not be saved. No import was applied.");
          return saved;
        });
      }
      return Promise.reject(new Error("The program application is not ready."));
    };
    UOS.ProgramDataSettings.controller = create({
      getWorkspace: getWorkspace,
      stageOptions: Object.assign(reader ? {
        inspectOptions: { extractSpreadsheetHeaders: reader.headers },
        extractSpreadsheetRows: reader.rows,
        extractRateSpreadsheetRows: reader.rateRows
      } : {}, { expectedApp: appIdentity(), allowLegacy: true }),
      commit: commit
    });
    return UOS.ProgramDataSettings.controller;
  }
  UOS.ProgramDataSettings = {
    create: create,
    mount: mount,
    controller: null,
    inspectFile: function (file) {
      if (UOS.ProgramDataSettings.controller && typeof UOS.ProgramDataSettings.controller.inspectFile === "function") {
        return UOS.ProgramDataSettings.controller.inspectFile(file);
      }
      return Promise.reject(new Error("Data settings controller is not mounted."));
    }
  };
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { mount(); }, { once: true });
    } else {
      mount();
    }
    document.addEventListener("uos:program-ready", function (event) {
      var workspace = event.detail && event.detail.workspace;
      var active = workspace && workspace.workspace && workspace.workspace.destination === "data";
      if (!active) return;
      var controller = mount();
      if (controller && controller.runHealth) controller.runHealth();
    });
  }
})();
