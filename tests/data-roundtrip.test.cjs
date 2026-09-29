const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function parseCsv(value) {
  const rows = []; let row = [], field = "", quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) { if (character === '"' && value[index + 1] === '"') { field += '"'; index += 1; } else if (character === '"') quoted = false; else field += character; }
    else if (character === '"') quoted = true;
    else if (character === ",") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function load() {
  const context = { console, structuredClone, TextEncoder, TextDecoder, Uint8Array, DataView, ArrayBuffer, URLSearchParams, DecompressionStream, crypto };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: "uos.horticulture.nsa", workspaceKind: "NSA", owner: "NSA" }) }, imports: { parseCsv } };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "status-model.js", "data-workspace.js"]) vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  return context.UOS;
}

test("schema-v5 JSON and ZIP exports round-trip audit narratives and governance", () => {
  const UOS = load(); let ws = UOS.ProgramModel.blank("2026-09-12T00:00:00.000Z");
  ws.entities.applications.push({ id: "NSA-APP-ROUNDTRIP", owner: "NSA", type: "application", status: "received", title: "Round trip", provenance: {} });
  ws = UOS.ProgramStatus.transition(ws, { entityId: "NSA-APP-ROUNDTRIP", to: "cancelled", actor: "Export Officer", reason: "Full retained narrative", at: "2026-09-12T01:00:00.000Z" });
  ws.statusControl.enabledBy = "Export Officer"; ws.statusControl.enabledAt = "2026-09-12T00:30:00.000Z"; ws = UOS.ProgramModel.normalize(ws);
  const json = UOS.ProgramData.exportJson(ws, { owner: "NSA" });
  const jsonRestored = UOS.ProgramModel.normalize(JSON.parse(json));
  assert.equal(jsonRestored.entities.statusEvents[0].reason, "Full retained narrative");
  const zip = UOS.ProgramData.exportBundle(ws, { owner: "NSA" });
  const zipRestored = UOS.ProgramData.importBundle(zip, null, { expectedApp: { owner: "NSA" } });
  assert.equal(zipRestored.schemaVersion, 5);
  assert.equal(zipRestored.entities.statusEvents[0].actor, "Export Officer");
  assert.equal(zipRestored.entities.statusEvents[0].reason, "Full retained narrative");
  assert.equal(zipRestored.statusControl.enabledBy, "Export Officer");
});
