const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function loadSuite() {
  const context = {
    console, structuredClone, TextEncoder, TextDecoder, Uint8Array, DataView,
    ArrayBuffer, URL, URLSearchParams, setTimeout, clearTimeout, crypto,
    document: { currentScript: { src: "http://example.test/src/shared/js/imports.js" } }
  };
  context.window = context;
  context.root = context;
  context.UOS = {
    ProgramAppConfig: { current: () => ({ appId: "uos.horticulture.nsa", workspaceKind: "NSA", owner: "NSA" }) }
  };
  vm.createContext(context);
 ["src/shared/js/imports.js", "src/shared/js/smart-import.js", "src/shared/js/rate-library.js", "src/shared/js/map-costing.js"].forEach((file) => {
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
  });
  [
    "status.js", "default-rate-catalog.js", "model.js", "funding-model.js",
    "quote-model.js", "status-model.js", "scheduler-model.js", "costing-model.js", "moasure-geometry.js",
    "work-area-service.js", "data-health.js", "data-workspace.js"
  ].forEach((file) => {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  });
  return context.UOS;
}

function workspaceWithProject(UOS) {
  const ws = UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z");
  ws.entities.applications.push({
    id: "NSA-APP-C6-CORRECTIVE", owner: "NSA", type: "application",
    status: "received", dateReceived: "2026-09-22", title: "C6 corrective"
  });
  ws.entities.projects.push({
    id: "NSA-PROJ-C6-CORRECTIVE", owner: "NSA", type: "project",
    applicationId: "NSA-APP-C6-CORRECTIVE", title: "C6 corrective",
    status: "planning", funding: { operationalAmount: 1000000000 }
  });
  return UOS.ProgramStatus.migrate(UOS.ProgramModel.normalize(ws));
}

function rateInput(id, unit, unitRate, options = {}) {
  return {
    id, kind: "Labour", category: "Maintenance", description: options.description || id,
    unit, unitRate, quantityMode: options.quantityMode || "m2", active: options.active !== false
  };
}

function addEligibleRate(UOS, ws, workTypeKey, input) {
  return UOS.ProgramCosting.upsertRateItemWithWorkType(ws, input, { enabled: true, workTypeKey });
}

function addPolygon(UOS, ws, workTypeKey, id, rateItemId) {
  return UOS.WorkAreaService.createGeometry(ws, "NSA-PROJ-C6-CORRECTIVE", {
    id,
    geometryKind: "polygon",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [138.6000, -34.9200], [138.6000, -34.9201], [138.6001, -34.9201],
        [138.6001, -34.9200], [138.6000, -34.9200]
      ]]
    },
    workTypeKey,
    rateItemId: rateItemId || "",
    payload: { type: workTypeKey, workTypeKey, rateItemId: rateItemId || "", valid: true }
  });
}


module.exports = { loadSuite, workspaceWithProject, rateInput, addEligibleRate, addPolygon };
