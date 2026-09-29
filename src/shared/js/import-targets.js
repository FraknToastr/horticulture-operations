(function () {
  "use strict";

  var UOS = window.UOS = window.UOS || {};
  var smart = UOS.smartImport;
  if (!smart) throw new Error("Smart Import targets require shared/js/smart-import.js.");
  var pageTextCache = typeof WeakMap === "function" ? new WeakMap() : null;

  function register(definition) {
    if (!smart.listTargets().some(function (target) { return target.id === definition.id; })) smart.registerTarget(definition);
  }

  function isolatedWorkspace(appId, workspaceKind) {
    return {
      predicate: function (value) {
        var version = Number(value && value.schemaVersion);
        var canonical = value && value.app === appId && version === 4 && (value.exportAppId === appId || !value.exportAppId);
        var legacyIsolated = value && value.app === "uos.horticulture" && value.exportAppId === appId && (!version || version === 2 || version === 3);
        return Boolean(canonical || legacyIsolated) && String(value.workspaceKind || "").toUpperCase() === workspaceKind;
      },
      required: ["entities", "context", "workspace", "exportAppId", "workspaceKind"]
    };
  }

  async function pdfText(pdf) {
    if (pageTextCache && pageTextCache.has(pdf)) return pageTextCache.get(pdf);
    var pending = (async function () {
      var pages = [];
      for (var pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        var page = await pdf.getPage(pageNumber);
        var content = await page.getTextContent();
        pages.push(content.items.map(function (item) { return String(item.str || ""); }).join(" "));
      }
      return pages.join("\n").replace(/\s+/g, " ").trim();
    })();
    if (pageTextCache) pageTextCache.set(pdf, pending);
    return pending;
  }

  function pdfLayout(required, excluded) {
    return async function (pdf) {
      var text = (await pdfText(pdf)).toLocaleLowerCase();
      var matched = required.every(function (value) { return text.indexOf(value) >= 0; }) &&
        !(excluded || []).some(function (value) { return text.indexOf(value) >= 0; });
      return { match: matched, pageCount: pdf.numPages };
    };
  }

  register({
    id: "unified-workspace", label: "Unified Horticulture workspace", promotionTarget: "workspace",
    json: { app: "uos.horticulture", schemaVersions: [1], required: ["entities", "referenceData"] },
    zip: { required: ["manifest.json"], any: ["applications.csv", "events.csv", "jobs.csv", "costingLines.csv", "costing-lines.csv", "rateItems.csv", "rate-items.csv", "catalogs.csv", "paymentAllocations.csv"], excluded: ["geometries.geojson"] }
  });
  register({
    id: "program-workspace-nsa", label: "Nature Strip Program workspace", promotionTarget: "workspace",
    json: isolatedWorkspace("uos.horticulture.nsa", "NSA")
  });
  register({
    id: "program-workspace-events", label: "Events Program workspace", promotionTarget: "workspace",
    json: isolatedWorkspace("uos.horticulture.events", "EVT")
  });
  register({
    id: "program-workspace-legacy-manual", label: "Legacy unified Program workspace (manual migration)", promotionTarget: "workspace",
    json: {
      predicate: function (value) {
        return Boolean(value) && value.app === "uos.horticulture" &&
          (Number(value.schemaVersion) === 2 || Number(value.schemaVersion) === 3) &&
          !value.exportAppId && !value.workspaceKind;
      },
      required: ["entities", "referenceData"]
    }
  });
  register({
    id: "nature-workspace", label: "Nature Strip workspace", promotionTarget: "entities.applications",
    json: { app: "uos.nature-strip", schemaVersions: [2], required: ["applications", "projects", "scheduleItems"] },
    zip: { any: ["nature-strip.json", "nature-strip-applications.csv"] },
    tabular: { required: ["kind", "application id"], any: ["address", "receipt no", "schedule id"] },
    pdf: pdfLayout(["apply for nature strip", "receipt number", "application details"])
  });
  register({
    id: "nature-legacy", label: "Legacy Nature Strip records", promotionTarget: "entities.applications",
    json: { predicate: function (value) { return !value.app && Array.isArray(value.rows); }, required: ["rows"] }
  });
  register({
    id: "remediation-workspace", label: "Remediation workspace", promotionTarget: "entities.events",
    json: { app: "uos.remediation", schemaVersions: [2], required: ["events", "workspace"] }
  });
  register({
    id: "remediation-legacy", label: "Legacy Remediation workspace", promotionTarget: "entities.events",
    json: { predicate: function (value) { return !value.app && Array.isArray(value.events) && (value.version !== undefined || value.schemaVersion !== undefined); }, required: ["events"] }
  });
  register({
    id: "remediation-rates", label: "Remediation rate catalogue", promotionTarget: "entities.rateItems",
    tabular: { required: ["section", "label", "unit", "rate", "active"], any: ["effectivedate", "supplier", "density"] }
  });
  register({
    id: "overtime-source", label: "Overtime source", promotionTarget: "overtime.source",
    json: { app: "uos.overtime-source", schemaVersions: [2, 3], required: ["coverage"] }
  });
  register({
    id: "overtime-workspace", label: "Overtime workspace", promotionTarget: "overtime.workspace",
    json: { app: "uos.overtime-workspace", schemaVersions: [2, 3], required: ["source", "workspace"] }
  });
  register({
    id: "overtime-roster-v1", label: "Legacy overtime roster", promotionTarget: "overtime.workspace",
    tabular: { required: ["record_type", "schema_version", "save_state_json"] }
  });
  register({
    id: "users", label: "Users reference table", promotionTarget: "referenceData.users",
    tabular: { required: ["title", "team", "crew", "is plant operator"] }
  });
})();
