const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function load() {
  const context = { console, structuredClone, TextEncoder, TextDecoder, Uint8Array, DataView, ArrayBuffer, URLSearchParams, crypto };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: "uos.horticulture.nsa", workspaceKind: "NSA", owner: "NSA" }) } };
  vm.createContext(context);
  ["status.js", "default-rate-catalog.js", "model.js", "funding-model.js", "quote-model.js", "product-contracts.js"].forEach((file) => vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file }));
  return context.UOS;
}

function readyWorkspace(UOS) {
  const ws = UOS.ProgramModel.blank("2026-09-14T00:00:00.000Z");
  ws.entities.applications.push({ id: "NSA-APP-READY", owner: "NSA", type: "application", dateReceived: "2026-09-14", status: "received" });
  ws.entities.projects.push({ id: "NSA-PROJ-READY", owner: "NSA", type: "project", applicationId: "NSA-APP-READY", funding: { operationalAmount: 100 }, status: "planning" });
  ws.entities.jobs.push({ id: "NSA-JOB-READY", owner: "NSA", type: "job", projectId: "NSA-PROJ-READY", status: "Draft", sourceKind: "calculator", sourceEntityId: "rate-1" });
  ws.entities.costingLines.push({ id: "NSA-COST-READY", owner: "NSA", type: "costingLine", projectId: "NSA-PROJ-READY", jobId: "NSA-JOB-READY", description: "Tree work", quantity: 1, unitRate: 100, estimatedTotal: 100 });
  return UOS.ProgramQuotes.saveDraft(ws, { projectId: "NSA-PROJ-READY", quoteDate: "2026-09-14", scopeNotes: "Remove one tree", refreshCosts: true });
}

test("PC-001 through PC-028 are represented once in executable governance", () => {
  const UOS = load();
  const ids = Array.from(UOS.ProductContracts.catalog).map((contract) => contract.id);
  const declared = Array.from(fs.readFileSync("src/governance/PRODUCT_CONTRACTS.md", "utf8").matchAll(/\|\s*(PC-\d{3})\s*\|/g)).map((match) => match[1]);
  assert.deepEqual(ids, declared);
  assert.deepEqual(ids, Array.from({ length: 28 }, (_, index) => `PC-${String(index + 1).padStart(3, "0")}`));
  assert.equal(new Set(ids).size, ids.length);
});

test("PC-013 blocks an unfunded Quote and snapshots readiness at Issue", () => {
  const UOS = load();
  let ws = readyWorkspace(UOS);
  let quote = ws.entities.quotes[0];
  // New customer-funded Quotes exclude the available City allocation: exact coverage.
  assert.equal(UOS.ProgramQuotes.evaluateReadiness(ws, quote.id).ready, true);

  // Introduce an underfunded position (delivery cost $150, quote $100 ex-GST, operationalAmount $0 -> funding gap $50)
  ws.entities.projects[0].funding.operationalAmount = 0;
  ws.entities.costingLines.push({
    id: "NSA-COST-GAP",
    owner: "NSA",
    type: "costingLine",
    projectId: "NSA-PROJ-READY",
    jobId: "NSA-JOB-READY",
    description: "Additional tree maintenance",
    quantity: 1,
    unitRate: 50,
    estimatedTotal: 50
  });
  const unfundedReadiness = UOS.ProgramQuotes.evaluateReadiness(ws, quote.id);
  assert.equal(unfundedReadiness.ready, false);
  assert.ok(unfundedReadiness.failures.some((f) => f.code === "FUNDING_GAP"));
  assert.equal(unfundedReadiness.evidence.funding.fundingGap, 50);
  assert.throws(() => UOS.ProgramQuotes.issue(ws, quote.id), /funding gap/i);

  // Resolve the funding gap via operational amount ($50 council + $100 customer = $150)
  ws.entities.projects[0].funding.operationalAmount = 50;
  ws = UOS.ProgramQuotes.saveDraft(ws, { id: quote.id, projectId: quote.projectId, fundingMode: "mixed", proposedCustomerContribution: 100 });
  assert.equal(UOS.ProgramQuotes.evaluateReadiness(ws, quote.id).ready, true);
  ws = UOS.ProgramQuotes.issue(ws, quote.id);
  quote = ws.entities.quotes.find((item) => item.id === quote.id);
  assert.equal(quote.status, "Issued");
  assert.equal(quote.readinessSnapshot.ready, true);
  assert.ok(quote.readinessSnapshot.evidence.costBasis.length > 0);
  assert.equal(quote.readinessSnapshot.evidence.funding.fundingGap, 0);
});

test("PC-013 C2: Fully customer-funded candidate Quote satisfies readiness and issues with $0 council funding", () => {
  const UOS = load();
  const ws = UOS.ProgramModel.blank("2026-09-14T00:00:00.000Z");
  ws.entities.applications.push({ id: "NSA-APP-C2-FULL", owner: "NSA", type: "application", dateReceived: "2026-09-14", status: "received" });
  ws.entities.projects.push({ id: "NSA-PROJ-C2-FULL", owner: "NSA", type: "project", applicationId: "NSA-APP-C2-FULL", funding: { operationalAmount: 0 }, status: "planning" });
  ws.entities.jobs.push({ id: "NSA-JOB-C2-FULL", owner: "NSA", type: "job", projectId: "NSA-PROJ-C2-FULL", status: "Draft", sourceKind: "calculator", sourceEntityId: "rate-1" });
  ws.entities.costingLines.push({ id: "NSA-COST-C2-FULL", owner: "NSA", type: "costingLine", projectId: "NSA-PROJ-C2-FULL", jobId: "NSA-JOB-C2-FULL", description: "Arborist works", quantity: 1, unitRate: 250, estimatedTotal: 250 });

  // Candidate draft quote generated from costing lines ($250 ex-GST, $25 GST, $275 grand total)
  let updatedWs = UOS.ProgramQuotes.saveDraft(ws, { projectId: "NSA-PROJ-C2-FULL", quoteDate: "2026-09-14", scopeNotes: "Full arborist scope", refreshCosts: true });
  const draftQuote = updatedWs.entities.quotes[0];
  assert.equal(draftQuote.status, "Draft");

  // Prospective readiness check: candidate customer contribution ($250) satisfies delivery cost ($250)
  const readiness = UOS.ProgramQuotes.evaluateReadiness(updatedWs, draftQuote.id);
  assert.equal(readiness.ready, true, "Fully customer-funded candidate must satisfy readiness");
  assert.equal(readiness.evidence.funding.calculatedDeliveryCost, 250);
  assert.equal(readiness.evidence.funding.customerQuote, 250);
  assert.equal(readiness.evidence.funding.operationalAmount, 0);
  assert.equal(readiness.evidence.funding.totalFunding, 250);
  assert.equal(readiness.evidence.funding.fundingGap, 0);
  assert.equal(readiness.evidence.funding.fundingStatus, "balanced");

  // Candidate quote issues successfully
  updatedWs = UOS.ProgramQuotes.issue(updatedWs, draftQuote.id);
  const issuedQuote = updatedWs.entities.quotes.find((q) => q.id === draftQuote.id);
  assert.equal(issuedQuote.status, "Issued");
  assert.equal(issuedQuote.readinessSnapshot.ready, true);
});

test("PC-013 C2: Partial customer contribution maintains accurate funding gap", () => {
  const UOS = load();
  const ws = UOS.ProgramModel.blank("2026-09-14T00:00:00.000Z");
  ws.entities.applications.push({ id: "NSA-APP-C2-PART", owner: "NSA", type: "application", dateReceived: "2026-09-14", status: "received" });
  ws.entities.projects.push({ id: "NSA-PROJ-C2-PART", owner: "NSA", type: "project", applicationId: "NSA-APP-C2-PART", funding: { operationalAmount: 0 }, status: "planning" });
  ws.entities.jobs.push({ id: "NSA-JOB-C2-PART", owner: "NSA", type: "job", projectId: "NSA-PROJ-C2-PART", status: "Draft", sourceKind: "calculator", sourceEntityId: "rate-1" });
  ws.entities.costingLines.push({ id: "NSA-COST-C2-PART", owner: "NSA", type: "costingLine", projectId: "NSA-PROJ-C2-PART", jobId: "NSA-JOB-C2-PART", description: "Horticultural work", quantity: 1, unitRate: 200, estimatedTotal: 200 });

  // Quote with $80 discount -> $120 ex-GST contribution against $200 delivery cost
  const updatedWs = UOS.ProgramQuotes.saveDraft(ws, { projectId: "NSA-PROJ-C2-PART", quoteDate: "2026-09-14", scopeNotes: "Partial scope", refreshCosts: true, discountAmount: 80 });
  const draftQuote = updatedWs.entities.quotes[0];

  const readiness = UOS.ProgramQuotes.evaluateReadiness(updatedWs, draftQuote.id);
  assert.equal(readiness.ready, false);
  assert.equal(readiness.evidence.funding.calculatedDeliveryCost, 200);
  assert.equal(readiness.evidence.funding.customerQuote, 120);
  assert.equal(readiness.evidence.funding.fundingGap, 80);
  assert.throws(() => UOS.ProgramQuotes.issue(updatedWs, draftQuote.id), /funding gap/i);
});

test("PC-013 C2: Unrelated Draft Quotes in workspace do not count as committed funding", () => {
  const UOS = load();
  const ws = UOS.ProgramModel.blank("2026-09-14T00:00:00.000Z");
  ws.entities.applications.push({ id: "NSA-APP-C2-UNRELATED", owner: "NSA", type: "application", dateReceived: "2026-09-14", status: "received" });
  ws.entities.projects.push({ id: "NSA-PROJ-C2-UNRELATED", owner: "NSA", type: "project", applicationId: "NSA-APP-C2-UNRELATED", funding: { operationalAmount: 0 }, status: "planning" });
  ws.entities.jobs.push({ id: "NSA-JOB-C2-UNRELATED", owner: "NSA", type: "job", projectId: "NSA-PROJ-C2-UNRELATED", status: "Draft", sourceKind: "calculator", sourceEntityId: "rate-1" });
  ws.entities.costingLines.push({ id: "NSA-COST-C2-UNRELATED", owner: "NSA", type: "costingLine", projectId: "NSA-PROJ-C2-UNRELATED", jobId: "NSA-JOB-C2-UNRELATED", description: "Tree work", quantity: 1, unitRate: 150, estimatedTotal: 150 });

  // Save a draft quote
  const updatedWs = UOS.ProgramQuotes.saveDraft(ws, { projectId: "NSA-PROJ-C2-UNRELATED", quoteDate: "2026-09-14", scopeNotes: "Draft work", refreshCosts: true });

  // Query general position WITHOUT candidate option
  const position = UOS.ProjectFunding.position(updatedWs, "NSA-PROJ-C2-UNRELATED");
  assert.equal(position.customerQuote, 0, "Unrelated Draft Quote must not be treated as committed funding");
  assert.equal(position.customerQuoteId, null);
  assert.equal(position.customerQuoteStatus, null);
  assert.equal(position.fundingGap, 150);
});

test("PC-013 C2: Superseded candidate quotes cannot contribute to funding", () => {
  const UOS = load();
  const ws = UOS.ProgramModel.blank("2026-09-14T00:00:00.000Z");
  ws.entities.applications.push({ id: "NSA-APP-C2-SUPER", owner: "NSA", type: "application", dateReceived: "2026-09-14", status: "received" });
  ws.entities.projects.push({ id: "NSA-PROJ-C2-SUPER", owner: "NSA", type: "project", applicationId: "NSA-APP-C2-SUPER", funding: { operationalAmount: 0 }, status: "planning" });
  ws.entities.jobs.push({ id: "NSA-JOB-C2-SUPER", owner: "NSA", type: "job", projectId: "NSA-PROJ-C2-SUPER", status: "Draft", sourceKind: "calculator", sourceEntityId: "rate-1" });
  ws.entities.costingLines.push({ id: "NSA-COST-C2-SUPER", owner: "NSA", type: "costingLine", projectId: "NSA-PROJ-C2-SUPER", jobId: "NSA-JOB-C2-SUPER", description: "Tree work", quantity: 1, unitRate: 100, estimatedTotal: 100 });

  const updatedWs = UOS.ProgramQuotes.saveDraft(ws, { projectId: "NSA-PROJ-C2-SUPER", quoteDate: "2026-09-14", scopeNotes: "Tree work", refreshCosts: true });
  const draftQuote = updatedWs.entities.quotes[0];
  draftQuote.supersededByQuoteId = "NSA-QUOTE-NEWER";

  const position = UOS.ProjectFunding.position(updatedWs, "NSA-PROJ-C2-SUPER", { quote: draftQuote });
  assert.equal(position.customerQuote, 0, "Superseded quote must not contribute");
  assert.equal(position.fundingGap, 100);
});

test("PC-013 C2: Existing Issued and Accepted quotes retain established committed funding behavior", () => {
  const UOS = load();
  const ws = UOS.ProgramModel.blank("2026-09-14T00:00:00.000Z");
  ws.entities.applications.push({ id: "NSA-APP-C2-COMMITTED", owner: "NSA", type: "application", dateReceived: "2026-09-14", status: "received" });
  ws.entities.projects.push({ id: "NSA-PROJ-C2-COMMITTED", owner: "NSA", type: "project", applicationId: "NSA-APP-C2-COMMITTED", funding: { operationalAmount: 0 }, status: "planning" });
  ws.entities.jobs.push({ id: "NSA-JOB-C2-COMMITTED", owner: "NSA", type: "job", projectId: "NSA-PROJ-C2-COMMITTED", status: "Draft", sourceKind: "calculator", sourceEntityId: "rate-1" });
  ws.entities.costingLines.push({ id: "NSA-COST-C2-COMMITTED", owner: "NSA", type: "costingLine", projectId: "NSA-PROJ-C2-COMMITTED", jobId: "NSA-JOB-C2-COMMITTED", description: "Work", quantity: 1, unitRate: 100, estimatedTotal: 100 });

  let updatedWs = UOS.ProgramQuotes.saveDraft(ws, { projectId: "NSA-PROJ-C2-COMMITTED", quoteDate: "2026-09-14", scopeNotes: "Work", refreshCosts: true });
  const quoteId = updatedWs.entities.quotes[0].id;
  updatedWs = UOS.ProgramQuotes.issue(updatedWs, quoteId);

  // Position query without options should find the Issued quote
  const posIssued = UOS.ProjectFunding.position(updatedWs, "NSA-PROJ-C2-COMMITTED");
  assert.equal(posIssued.customerQuote, 100);
  assert.equal(posIssued.customerQuoteId, quoteId);
  assert.equal(posIssued.customerQuoteStatus, "Issued");
  assert.equal(posIssued.fundingGap, 0);

  // Accept quote
  updatedWs = UOS.ProgramQuotes.accept(updatedWs, quoteId, { actor: "Customer Acceptance" });
  const posAccepted = UOS.ProjectFunding.position(updatedWs, "NSA-PROJ-C2-COMMITTED");
  assert.equal(posAccepted.customerQuote, 100);
  assert.equal(posAccepted.customerQuoteId, quoteId);
  assert.equal(posAccepted.customerQuoteStatus, "Accepted");
  assert.equal(posAccepted.fundingGap, 0);
});
test("PC-013 Draft-first Quote contract allows creating and saving Draft without Jobs or Costing Lines, but blocks Issue", () => {
  const UOS = load();
  const ws = UOS.ProgramModel.blank("2026-09-14T00:00:00.000Z");
  ws.entities.applications.push({ id: "NSA-APP-DRAFT-FIRST", owner: "NSA", type: "application", dateReceived: "2026-09-14", status: "received" });
  ws.entities.projects.push({ id: "NSA-PROJ-DRAFT-FIRST", owner: "NSA", type: "project", applicationId: "NSA-APP-DRAFT-FIRST", funding: { operationalAmount: 0 }, status: "planning" });

  // Precondition: 0 Jobs, 0 Costing Lines
  assert.equal(ws.entities.jobs.filter((j) => j.projectId === "NSA-PROJ-DRAFT-FIRST").length, 0);
  assert.equal(ws.entities.costingLines.filter((c) => c.projectId === "NSA-PROJ-DRAFT-FIRST").length, 0);

  // Draft Quote can be created and saved
  const updatedWs = UOS.ProgramQuotes.saveDraft(ws, {
    projectId: "NSA-PROJ-DRAFT-FIRST",
    quoteDate: "2026-09-14",
    clientName: "Test Applicant",
    scopeNotes: ""
  });

  const quote = updatedWs.entities.quotes.find((q) => q.projectId === "NSA-PROJ-DRAFT-FIRST");
  assert.ok(quote, "Draft quote must be created");
  assert.equal(quote.status, "Draft");
  assert.equal(quote.subtotal, 0);
  assert.equal(quote.grandTotal, 0);

  // Issue remains governed and strictly blocked by PC-013
  const readiness = UOS.ProgramQuotes.evaluateReadiness(updatedWs, quote.id);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.failures.some((f) => f.code === "SCOPE_MISSING"));
  assert.throws(() => UOS.ProgramQuotes.issue(updatedWs, quote.id), /line item|readiness/i);
});

test("PC-013 navigation rules allow Quote Builder entry when Project exists with 0 Jobs", () => {
  const context = {
    console, structuredClone, TextEncoder, TextDecoder, URLSearchParams,
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
      readyState: "loading",
      addEventListener: () => {}
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("src/program-planner/js/app.js", "utf8"), context);

  // Project exists without saved Quotes: available, but not yet in use.
  const ruleWithProject = context.UOS.ProgramApp.evaluateShortcutRule("quotes", {
    hasProject: true,
    hasJobs: false,
    hasCostedJobs: false,
    currentModule: "register"
  });
  assert.equal(ruleWithProject.isDisabled, false);
  assert.equal(ruleWithProject.isLinked, false);
  assert.equal(ruleWithProject.usage, "unused");
  assert.equal(ruleWithProject.tooltip, "Open Quote Builder — no saved work yet");

  // No project -> Quote Builder must be disabled
  const ruleWithoutProject = context.UOS.ProgramApp.evaluateShortcutRule("quotes", {
    hasProject: false,
    hasJobs: false,
    hasCostedJobs: false,
    currentModule: "register"
  });
  assert.equal(ruleWithoutProject.isDisabled, true);
  assert.equal(ruleWithoutProject.isLinked, false);
  assert.equal(ruleWithoutProject.tooltip, "Create a linked delivery project first to open Quote Builder");
});
function loadMapSuite() {
  const context = {
    console, structuredClone, TextEncoder, TextDecoder, Uint8Array, DataView, ArrayBuffer,
    URLSearchParams, setTimeout, clearTimeout, crypto
  };
  context.window = context;
  context.root = context;
  context.UOS = {
    ProgramAppConfig: { current: () => ({ appId: "uos.horticulture.nsa", workspaceKind: "NSA", owner: "NSA" }) }
  };
  vm.createContext(context);
  ["src/shared/js/rate-library.js", "src/shared/js/map-costing.js"].forEach((file) =>
    vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file })
  );
  [
    "status.js",
    "default-rate-catalog.js",
    "model.js",
    "funding-model.js",
    "quote-model.js",
    "status-model.js",
    "scheduler-model.js",
    "costing-model.js",
    "costing.js",
    "program-map.js",
    "work-area-service.js",
    "data-health.js"
  ].forEach((file) =>
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file })
  );
  return { UOS: context.UOS, context };
}

function setupCanonicalProject(UOS, ws) {
  ws.entities.applications.push({
    id: "NSA-APP-CANONICAL",
    owner: "NSA",
    type: "application",
    status: "received",
    dateReceived: "2026-09-18",
    title: "Canonical App",
    provenance: {}
  });
  ws.entities.projects.push({
    id: "NSA-PROJ-CANONICAL",
    owner: "NSA",
    type: "project",
    applicationId: "NSA-APP-CANONICAL",
    title: "Canonical Turf Project",
    status: "planning",
    provenance: {}
  });
  return UOS.ProgramStatus.migrate(UOS.ProgramModel.normalize(ws));
}

const squarePolygonCoords = [
  [138.6000, -34.9200],
  [138.6000, -34.9201],
  [138.6001, -34.9201],
  [138.6001, -34.9200],
  [138.6000, -34.9200]
];

function addCanonicalPolygon(UOS, ws, workTypeKey, id) {
  return UOS.WorkAreaService.createGeometry(ws, "NSA-PROJ-CANONICAL", {
    id,
    workTypeKey,
    geometryKind: "polygon",
    geometry: { type: "Polygon", coordinates: [squarePolygonCoords] },
    payload: { type: workTypeKey, workTypeKey, visible: true, valid: true }
  });
}

test("PC-005 C3: Fresh workspace contains canonical referenceData turfing -> RATE-TURFING mapping", () => {
  const { UOS } = loadMapSuite();
  assert.deepEqual(Array.from(UOS.ProgramModel.canonicalWorkTypeRateItems.turfing.eligibleRateItemIds), ["RATE-TURFING", "RATE-TURFING-HA"]);
  assert.ok(Object.isFrozen(UOS.ProgramModel.canonicalWorkTypeRateItems));
  // Exact reference equality: WorkAreaService consumes ProgramModel's authority rather than a local copy
  assert.equal(UOS.WorkAreaService.canonicalWorkTypeRateItems(), UOS.ProgramModel.canonicalWorkTypeRateItems);

  // Source-level invariant: work-area-service.js contains no duplicate hardcoded rate items
  const wasSource = fs.readFileSync("src/program-planner/js/work-area-service.js", "utf8");
  assert.doesNotMatch(wasSource, /RATE-TURFING/, "work-area-service.js must not carry duplicate hardcoded canonical rate items");

  // Dynamic authority delegation check: WorkAreaService dynamically queries ProgramModel
  const customCanonical = Object.freeze({
    turfing: Object.freeze({ eligibleRateItemIds: Object.freeze(["RATE-TURFING", "RATE-TURFING-HA"]), defaultRateItemId: "RATE-TURFING" }),
    aerate: Object.freeze({ eligibleRateItemIds: Object.freeze(["RATE-AERATION", "RATE-AERATION-HA"]), defaultRateItemId: "RATE-AERATION" })
  });
  const originalCanonical = UOS.ProgramModel.canonicalWorkTypeRateItems;
  try {
    UOS.ProgramModel.canonicalWorkTypeRateItems = customCanonical;
    assert.equal(UOS.WorkAreaService.canonicalWorkTypeRateItems(), customCanonical);
  } finally {
    UOS.ProgramModel.canonicalWorkTypeRateItems = originalCanonical;
  }

  const ws = UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z");
  assert.deepEqual(JSON.parse(JSON.stringify(ws.referenceData.shared.workTypeRateItems.turfing)), {
    eligibleRateItemIds: ["RATE-TURFING", "RATE-TURFING-HA"], defaultRateItemId: "RATE-TURFING"
  });
  const turfRate = UOS.WorkAreaService.resolveWorkTypeRate(ws, "turfing");
  assert.ok(turfRate, "Rate Item for turfing must be resolved");
  assert.equal(turfRate.id, "RATE-TURFING");
  assert.equal(turfRate.unitRate, 45);
  assert.equal(turfRate.unit, "m²");
});

test("PC-005 C3: Supported turfing polygon deterministically resolves to RATE-TURFING and explicitly promotes to Job & Costing Line", () => {
  const { UOS } = loadMapSuite();
  let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z"));
  ws = UOS.WorkAreaService.createGeometry(ws, "NSA-PROJ-CANONICAL", {
    workTypeKey: "turfing",
    geometryKind: "polygon",
    geometry: { type: "Polygon", coordinates: [squarePolygonCoords] },
    payload: { type: "turfing", workTypeKey: "turfing", visible: true, valid: true }
  });
  const geom = ws.entities.geometries[0];
  const synced = UOS.WorkAreaService.syncGeometry(ws, geom.id, { explicit: true });
  const updatedGeom = synced.entities.geometries.find((g) => g.id === geom.id);
  assert.equal(updatedGeom.syncState.code, "synced");
  assert.equal(updatedGeom.rateItemId, "RATE-TURFING");

  const job = synced.entities.jobs.find((j) => j.sourceGeometryId === geom.id);
  assert.ok(job, "Mapped Job must exist");
  assert.equal(job.sourceKind, "space-map");
  assert.equal(job.sourceGeometryId, geom.id);
  assert.equal(job.projectId, "NSA-PROJ-CANONICAL");
  assert.equal(job.title, "Turfing");

  const line = synced.entities.costingLines.find((l) => l.sourceGeometryId === geom.id);
  assert.ok(line, "Mapped CostingLine must exist");
  assert.equal(line.jobId, job.id);
  assert.equal(line.rateItemId, "RATE-TURFING");
  assert.equal(line.unit, "m²");
  assert.equal(line.unitRate, 45);
  assert.ok(line.quantity > 0);
  assert.equal(line.estimatedTotal, Math.round(line.quantity * 45 * 100) / 100);
});

test("PC-005 C3: Configured referenceData workTypeRateItems override default canonical mapping", () => {
  const { UOS } = loadMapSuite();
  let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z"));
  ws.referenceData.shared.workTypeRateItems.turfing = "RATE-TURF-RENOVATION";
  ws = UOS.WorkAreaService.createGeometry(ws, "NSA-PROJ-CANONICAL", {
    workTypeKey: "turfing",
    geometryKind: "polygon",
    geometry: { type: "Polygon", coordinates: [squarePolygonCoords] },
    payload: { type: "turfing", workTypeKey: "turfing", visible: true, valid: true }
  });
  const geom = ws.entities.geometries[0];
  const synced = UOS.WorkAreaService.syncGeometry(ws, geom.id);
  const line = synced.entities.costingLines.find((l) => l.sourceGeometryId === geom.id);
  assert.equal(line.rateItemId, "RATE-TURF-RENOVATION");
  assert.equal(line.unitRate, 35);
});

test("PC-005 C3: Unsafe work-type fallback is eliminated and unknown work types reject on sync", () => {
  const { UOS } = loadMapSuite();
  const mapSrc = fs.readFileSync("src/program-planner/js/program-map.js", "utf8");
  assert.doesNotMatch(mapSrc, /return WORK_TYPE_ALIASES\[text\(value\)\.toLowerCase\(\)\] \|\| "turfing";/);

  let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z"));
  ws = UOS.WorkAreaService.createGeometry(ws, "NSA-PROJ-CANONICAL", {
    workTypeKey: "unknown_work_kind",
    geometryKind: "polygon",
    geometry: { type: "Polygon", coordinates: [squarePolygonCoords] },
    payload: { type: "unknown_work_kind", workTypeKey: "unknown_work_kind", visible: true, valid: true }
  });
  const geom = ws.entities.geometries[0];
  assert.throws(() => {
    UOS.WorkAreaService.syncGeometry(ws, geom.id);
  }, (err) => {
    return err.code === "WORK_LINEAGE_RATE_NOT_FOUND" && /unknown_work_kind/.test(err.message);
  });
});

test("H1-01: Map status filtering normalizes casing and missing-status fallback", () => {
  const { UOS } = loadMapSuite();
  const workspace = { entities: { applications: [
    { id: "NSA-APP-H1-01-A", owner: "NSA", type: "application", status: "received", title: "H1 lowercase" },
    { id: "NSA-APP-H1-01-B", owner: "NSA", type: "application", status: "RECEIVED", title: "H1 uppercase" },
    { id: "NSA-APP-H1-01-C", owner: "NSA", type: "application", title: "H1 fallback" }
  ], events: [], projects: [], geometries: [], locations: [] } };
  const received = UOS.ProgramMapController.resolveFilteredMapDataset(workspace, "applications", "register", "no-location", ["Received"], "");
  const uppercase = UOS.ProgramMapController.resolveFilteredMapDataset(workspace, "applications", "register", "no-location", ["RECEIVED"], "");
  const mismatched = UOS.ProgramMapController.resolveFilteredMapDataset(workspace, "applications", "register", "no-location", ["Quoted"], "");
  assert.deepEqual(Array.from(received.items, (item) => item.id), ["NSA-APP-H1-01-A", "NSA-APP-H1-01-B", "NSA-APP-H1-01-C"]);
  assert.deepEqual(Array.from(uppercase.items, (item) => item.id), ["NSA-APP-H1-01-A", "NSA-APP-H1-01-B", "NSA-APP-H1-01-C"]);
  assert.equal(mismatched.items.length, 0);
});

test("C6-01: Turfing canonical mapping remains valid in the singular authority", () => {
  const { UOS } = loadMapSuite();
  const ws = UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z");
  assert.deepEqual(Array.from(UOS.ProgramModel.canonicalWorkTypeRateItems.turfing.eligibleRateItemIds), ["RATE-TURFING", "RATE-TURFING-HA"]);
  assert.equal(ws.referenceData.shared.workTypeRateItems.turfing.defaultRateItemId, "RATE-TURFING");
  assert.equal(UOS.WorkAreaService.resolveWorkTypeRate(ws, "turfing").id, "RATE-TURFING");
});

test("C6-02: Aeration maps exactly to RATE-AERATION and creates spatial lineage", () => {
  const { UOS } = loadMapSuite();
  let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z"));
  assert.deepEqual(Array.from(ws.referenceData.shared.workTypeRateItems.aerate.eligibleRateItemIds), ["RATE-AERATION", "RATE-AERATION-HA"]);
  ws = addCanonicalPolygon(UOS, ws, "aerate", "NSA-GEO-AERATION-V2");
  const geometry = ws.entities.geometries[0];
  ws = UOS.WorkAreaService.syncGeometry(ws, geometry.id, { explicit: true });
  const job = ws.entities.jobs.find((item) => item.sourceGeometryId === geometry.id);
  const line = ws.entities.costingLines.find((item) => item.sourceGeometryId === geometry.id);
  assert.equal(job.sourceKind, "space-map");
  assert.equal(line.rateItemId, "RATE-AERATION");
  assert.equal(line.jobId, job.id);
  assert.equal(line.unit, "m²");
  assert.equal(line.unitRate, 18);
  assert.ok(line.quantity > 0);
});

test("C6-03: Unknown work type rejects without creating Job or Costing Line", () => {
  const { UOS } = loadMapSuite();
  let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z"));
  ws.referenceData.shared.workTypeRateItems["alien-weeding"] = "RATE-TURFING";
  ws = addCanonicalPolygon(UOS, ws, "alien-weeding");
  const geometry = ws.entities.geometries[0];
  assert.throws(() => UOS.WorkAreaService.syncGeometry(ws, geometry.id), (error) => error.code === "WORK_LINEAGE_RATE_NOT_FOUND");
  assert.equal(ws.entities.jobs.length, 0);
  assert.equal(ws.entities.costingLines.length, 0);
  assert.equal(ws.entities.geometries[0].workTypeKey, "alien-weeding");
});

test("C6-04: Supported but unmapped work type rejects without mutations", () => {
  const { UOS } = loadMapSuite();
  let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z"));
  ws.referenceData.shared.workTypeRateItems.fertilise = "";
  ws = addCanonicalPolygon(UOS, ws, "fertilise");
  const geometry = ws.entities.geometries[0];
  assert.equal(UOS.WorkAreaService.resolveWorkTypeRate(ws, "fertilise"), null);
  assert.throws(() => UOS.WorkAreaService.syncGeometry(ws, geometry.id), (error) => error.code === "WORK_LINEAGE_RATE_NOT_FOUND");
  assert.equal(ws.entities.jobs.length, 0);
  assert.equal(ws.entities.costingLines.length, 0);
});

test("C6-05: Mapping to a nonexistent Rate Item rejects without mutations", () => {
  const { UOS } = loadMapSuite();
  let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z"));
  ws.referenceData.shared.workTypeRateItems.fertilise = "RATE-DOES-NOT-EXIST";
  ws = addCanonicalPolygon(UOS, ws, "fertilise");
  const geometry = ws.entities.geometries[0];
  assert.throws(() => UOS.WorkAreaService.syncGeometry(ws, geometry.id), (error) => error.code === "WORK_LINEAGE_RATE_NOT_FOUND");
  assert.equal(ws.entities.jobs.length, 0);
  assert.equal(ws.entities.costingLines.length, 0);
});

test("C6-06: Inactive and area-incompatible mapping targets reject", () => {
  const { UOS } = loadMapSuite();
  let inactive = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z"));
  inactive.referenceData.shared.workTypeRateItems.fertilise = "RATE-08WUH60";
  inactive = addCanonicalPolygon(UOS, inactive, "fertilise");
  assert.throws(() => UOS.WorkAreaService.syncGeometry(inactive, inactive.entities.geometries[0].id), (error) => error.code === "WORK_LINEAGE_RATE_NOT_FOUND");
  assert.equal(inactive.entities.jobs.length, 0);

  let incompatible = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z"));
  incompatible.referenceData.shared.workTypeRateItems.rolling = "RATE-0GHHJTP";
  incompatible = addCanonicalPolygon(UOS, incompatible, "rolling");
  assert.throws(() => UOS.WorkAreaService.syncGeometry(incompatible, incompatible.entities.geometries[0].id), (error) => error.code === "WORK_LINEAGE_RATE_NOT_FOUND");
  assert.equal(incompatible.entities.costingLines.length, 0);
});

test("C6-07: Governed editor command saves an exact override and preserves manual lineage", () => {
  const { UOS } = loadMapSuite();
  let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z"));
  ws = UOS.ProgramCosting.upsertRateItemWithWorkType(ws, {
    id: "RATE-ROLLING-C6", kind: "Labour", category: "Maintenance", description: "Rolling", unit: "m²", unitRate: 12, quantityMode: "m2", active: true
  }, { enabled: true, workTypeKey: "rolling" });
  assert.deepEqual(JSON.parse(JSON.stringify(ws.referenceData.shared.workTypeRateItems.rolling)), {
    eligibleRateItemIds: ["RATE-ROLLING-C6"], defaultRateItemId: "RATE-ROLLING-C6"
  });
  assert.equal(UOS.WorkAreaService.resolveWorkTypeRate(ws, "rolling").id, "RATE-ROLLING-C6");
  ws = UOS.ProgramCosting.createJob(ws, "NSA-PROJ-CANONICAL", { title: "Manual rolling", sourceKind: "calculator" });
  const job = ws.entities.jobs.find((item) => item.title === "Manual rolling");
  ws = UOS.ProgramCosting.createLine(ws, "RATE-ROLLING-C6", { areaSqM: 10 }, { owner: "NSA", jobId: job.id });
  const line = ws.entities.costingLines.find((item) => item.jobId === job.id);
  assert.equal(line.sourceKind, "manual");
  assert.equal(line.sourceGeometryId, null);
  assert.equal(line.estimatedTotal, 120);
});

test("C6-08: Mapping changes affect future polygons without rewriting or reverting old snapshots", () => {
  const { UOS } = loadMapSuite();
  let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z"));
  ws = addCanonicalPolygon(UOS, ws, "aerate");
  const firstGeometry = ws.entities.geometries[0];
  ws = UOS.WorkAreaService.syncGeometry(ws, firstGeometry.id);
  const firstLine = ws.entities.costingLines.find((item) => item.sourceGeometryId === firstGeometry.id);
  const snapshot = { rateItemId: firstLine.rateItemId, description: firstLine.description, unit: firstLine.unit, unitRate: firstLine.unitRate, estimatedTotal: firstLine.estimatedTotal };

  ws = UOS.ProgramCosting.upsertRateItemWithWorkType(ws, {
    id: "RATE-AERATION-V2", kind: "Labour", category: "Maintenance", description: "Aeration V2", unit: "m²", unitRate: 24, quantityMode: "m2", active: true
  }, { enabled: true, workTypeKey: "aerate" });
  assert.deepEqual(JSON.parse(JSON.stringify(ws.referenceData.shared.workTypeRateItems.aerate)), {
    eligibleRateItemIds: ["RATE-AERATION", "RATE-AERATION-HA", "RATE-AERATION-V2"], defaultRateItemId: "RATE-AERATION"
  });
  ws = UOS.WorkAreaService.syncGeometry(ws, firstGeometry.id);
  const preserved = ws.entities.costingLines.find((item) => item.id === firstLine.id);
  assert.deepEqual(JSON.parse(JSON.stringify({ rateItemId: preserved.rateItemId, description: preserved.description, unit: preserved.unit, unitRate: preserved.unitRate, estimatedTotal: preserved.estimatedTotal })), snapshot);
  assert.deepEqual(JSON.parse(JSON.stringify(ws.referenceData.shared.workTypeRateItems.aerate)), {
    eligibleRateItemIds: ["RATE-AERATION", "RATE-AERATION-HA", "RATE-AERATION-V2"], defaultRateItemId: "RATE-AERATION"
  }, "old geometry resync must not overwrite global eligibility");

  ws = addCanonicalPolygon(UOS, ws, "aerate", "NSA-GEO-AERATION-FUTURE");
  const secondGeometry = ws.entities.geometries.find((item) => item.id !== firstGeometry.id);
  ws = UOS.WorkAreaService.updateGeometry(ws, secondGeometry.id, { rateItemId: "RATE-AERATION-V2" });
  ws = UOS.WorkAreaService.syncGeometry(ws, secondGeometry.id);
  assert.equal(ws.entities.costingLines.find((item) => item.sourceGeometryId === secondGeometry.id).rateItemId, "RATE-AERATION-V2");
});

test("C6-09: Explicit mapping survives current-schema normalization reload", () => {
  const { UOS } = loadMapSuite();
  let ws = UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z");
  ws = UOS.ProgramCosting.upsertRateItemWithWorkType(ws, {
    id: "RATE-TOPDRESS-C6", kind: "Labour", category: "Maintenance", description: "Topdressing C6", unit: "ha", unitRate: 300, quantityMode: "m2", active: true
  }, { enabled: true, workTypeKey: "topdressing" });
  const reloaded = UOS.ProgramModel.normalize(JSON.parse(JSON.stringify(ws)));
  assert.deepEqual(JSON.parse(JSON.stringify(reloaded.referenceData.shared.workTypeRateItems.topdressing)), {
    eligibleRateItemIds: ["RATE-TOPDRESS-C6"], defaultRateItemId: "RATE-TOPDRESS-C6"
  });
  assert.equal(UOS.WorkAreaService.resolveWorkTypeRate(reloaded, "topdressing").id, "RATE-TOPDRESS-C6");
});

test("C6-10: Explicit mapping and Rate Item survive supported JSON export/import", () => {
  const { UOS } = loadMapSuite();
  let ws = UOS.ProgramModel.blank("2026-09-22T00:00:00.000Z");
  ws = UOS.ProgramCosting.upsertRateItemWithWorkType(ws, {
    id: "RATE-FERTILISE-C6", kind: "Labour", category: "Maintenance", description: "Fertilising C6", unit: "m²", unitRate: 4.5, quantityMode: "m2", active: true
  }, { enabled: true, workTypeKey: "fertilise" });
  const restored = UOS.ProgramModel.importJson(UOS.ProgramModel.exportJson(ws));
  assert.deepEqual(JSON.parse(JSON.stringify(restored.referenceData.shared.workTypeRateItems.fertilise)), {
    eligibleRateItemIds: ["RATE-FERTILISE-C6"], defaultRateItemId: "RATE-FERTILISE-C6"
  });
  assert.equal(restored.entities.rateItems.find((item) => item.id === "RATE-FERTILISE-C6").unitRate, 4.5);
  assert.equal(UOS.WorkAreaService.resolveWorkTypeRate(restored, "fertilise").id, "RATE-FERTILISE-C6");
});

test("PC-013 C4: Manual Costing Line creation and deletion cycle removes line and syncs Job estimate", () => {
  const { UOS } = loadMapSuite();
  let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z"));
  ws = UOS.ProgramCosting.createJob(ws, "NSA-PROJ-CANONICAL", {
    title: "Grounds Maintenance Job",
    status: "Draft",
    sourceKind: "calculator"
  });
  const job = ws.entities.jobs.find((j) => j.projectId === "NSA-PROJ-CANONICAL");
  assert.ok(job, "Job should exist");

  ws = UOS.ProgramCosting.createLine(ws, "RATE-TURFING", { quantity: 10, areaSqM: 10 }, {
    owner: "NSA",
    jobId: job.id
  });
  assert.equal(ws.entities.costingLines.length, 1);
  const line = ws.entities.costingLines[0];
  assert.equal(line.rateItemId, "RATE-TURFING");
  assert.equal(line.quantity, 10);
  assert.equal(line.unitRate, 45);
  assert.equal(line.estimatedTotal, 450);

  const updatedJob = ws.entities.jobs.find((j) => j.id === job.id);
  // Job estimate is updated with GST: 450 + 45 = 495
  assert.equal(updatedJob.estimate, 495);

  const totals = UOS.ProgramCosting.totals(ws.entities.costingLines);
  assert.equal(totals.subtotal, 450);
  assert.equal(totals.grandTotal, 495);

  // Deletion cycle
  ws = UOS.ProgramCosting.removeLine(ws, line.id);
  assert.equal(ws.entities.costingLines.length, 0);

  const finalJob = ws.entities.jobs.find((j) => j.id === job.id);
  assert.equal(finalJob.estimate, 0);

  const finalTotals = UOS.ProgramCosting.totals(ws.entities.costingLines);
  assert.equal(finalTotals.subtotal, 0);
  assert.equal(finalTotals.grandTotal, 0);
});

test("C4-WA-01: scheduled Planned mapped Job and lifecycle evidence are protected", () => {
 const { UOS } = loadMapSuite();
 let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z"));
 ws = UOS.WorkAreaService.createGeometry(ws, "NSA-PROJ-CANONICAL", {
  workTypeKey: "turfing",
  geometryKind: "polygon",
  geometry: { type: "Polygon", coordinates: [squarePolygonCoords] },
  payload: { type: "turfing", workTypeKey: "turfing", visible: true, valid: true }
 });
 const geometryId = ws.entities.geometries[0].id;
 ws = UOS.WorkAreaService.syncGeometry(ws, geometryId, { explicit: true });
 const jobId = ws.entities.jobs[0].id;
 const lineId = ws.entities.costingLines[0].id;
 ws.entities.statusEvents.push({ id: "NSA-SEVT-C4-WA-01", owner: "NSA", type: "statusEvent", entityId: jobId, entityType: "job", domain: "job", fromStatus: "", toStatus: "draft", action: "Initial status established", source: "automatic" });
 ws = UOS.ProgramSchedulerModel.scheduleJob(ws, jobId, {
  startDate: "2026-09-22",
  endDate: "2026-09-22",
  allDay: true,
  durationMinutes: 1440,
  crewId: "CREW-1",
  locationId: "LOC-1",
  location: "Park"
 }, "2026-09-21T01:00:00.000Z");
 const scheduledJob = ws.entities.jobs.find((item) => item.id === jobId);
  assert.equal(scheduledJob.status, "scheduled");
 assert.throws(() => UOS.WorkAreaService.removeGeometryWork(ws, geometryId), (error) => error.code === "WORK_LINEAGE_SCHEDULE_DEPENDENCY");
 assert.ok(ws.entities.geometries.some((item) => item.id === geometryId));
 assert.ok(ws.entities.jobs.some((item) => item.id === jobId && item.crewId === "CREW-1" && item.durationMinutes === 1440));
 assert.ok(ws.entities.costingLines.some((item) => item.id === lineId));
 assert.ok(ws.entities.statusEvents.some((item) => item.id === "NSA-SEVT-C4-WA-01"));
});

test("C4-WA-02: completed mapped Job and lifecycle evidence are protected", () => {
 const { UOS } = loadMapSuite();
 let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z"));
 ws = UOS.WorkAreaService.createGeometry(ws, "NSA-PROJ-CANONICAL", {
  workTypeKey: "turfing",
  geometryKind: "polygon",
  geometry: { type: "Polygon", coordinates: [squarePolygonCoords] },
  payload: { type: "turfing", workTypeKey: "turfing", visible: true, valid: true }
 });
 const geometryId = ws.entities.geometries[0].id;
 ws = UOS.WorkAreaService.syncGeometry(ws, geometryId, { explicit: true });
 const jobId = ws.entities.jobs[0].id;
 const lineId = ws.entities.costingLines[0].id;
  ws = UOS.ProgramSchedulerModel.scheduleJob(ws, jobId, { startDate: "2026-09-22", endDate: "2026-09-22", allDay: true, durationMinutes: 1440 }, "2026-09-22T00:00:00.000Z");
  ws = UOS.ProgramStatus.transition(ws, { entityId: jobId, to: "in_progress", actor: "C4 Test Operator", at: "2026-09-22T01:00:00.000Z" });
 ws = UOS.ProgramStatus.transition(ws, { entityId: jobId, to: "completed", actor: "C4 Test Operator", at: "2026-09-22T02:00:00.000Z" });
 assert.equal(ws.entities.jobs.find((item) => item.id === jobId).status, "completed");
 const completionEvents = ws.entities.statusEvents.filter((item) => item.entityId === jobId);
 assert.ok(completionEvents.some((item) => item.toStatus === "completed"));
 assert.throws(() => UOS.WorkAreaService.removeGeometryWork(ws, geometryId), (error) => error.code === "WORK_LINEAGE_SCHEDULE_DEPENDENCY");
 assert.ok(ws.entities.geometries.some((item) => item.id === geometryId));
 assert.ok(ws.entities.jobs.some((item) => item.id === jobId && item.status === "completed"));
 assert.ok(ws.entities.costingLines.some((item) => item.id === lineId));
 assert.deepEqual(ws.entities.statusEvents.filter((item) => item.entityId === jobId), completionEvents);
});

test("C4-WA-03: genuinely disposable mapped lineage deletes atomically", () => {
  const { UOS } = loadMapSuite();
  let ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z"));
  ws = UOS.WorkAreaService.createGeometry(ws, "NSA-PROJ-CANONICAL", {
    workTypeKey: "turfing",
    geometryKind: "polygon",
    geometry: { type: "Polygon", coordinates: [squarePolygonCoords] },
    payload: { type: "turfing", workTypeKey: "turfing", visible: true, valid: true }
  });
  const geom = ws.entities.geometries[0];
  ws = UOS.WorkAreaService.syncGeometry(ws, geom.id, { explicit: true });
  assert.equal(ws.entities.geometries.length, 1);
  assert.equal(ws.entities.costingLines.length, 1);
 assert.equal(ws.entities.jobs.length, 1);
 const mappedJob = ws.entities.jobs[0];
 ws.entities.statusEvents.push({ id: "NSA-SEVT-C4-MAPPED", owner: "NSA", type: "statusEvent", entityId: mappedJob.id, entityType: "job", domain: "job", fromStatus: "", toStatus: "draft" });
 ws.entities.statusRecommendations.push({ id: "NSA-SREC-C4-MAPPED", owner: "NSA", type: "statusRecommendation", entityId: mappedJob.id, entityType: "job", status: "open" });

  // Deletion of geometry cleanly removes mapped work lineage
  ws = UOS.WorkAreaService.removeGeometry(ws, geom.id);
  assert.equal(ws.entities.geometries.length, 0);
  assert.equal(ws.entities.costingLines.length, 0);
 assert.equal(ws.entities.jobs.length, 0);
 assert.equal(ws.entities.statusEvents.length, 0);
 assert.equal(ws.entities.statusRecommendations.length, 0);
 UOS.ProgramModel.assertValid(UOS.ProgramStatus.migrate(ws, { at: "2026-09-22T03:00:00.000Z" }));
});

test("PC-013 C4: uos:workspace-changed canonical event payload contract", () => {
  const { UOS, context } = loadMapSuite();
  vm.runInContext(fs.readFileSync("src/program-planner/js/observability.js", "utf8"), context, { filename: "observability.js" });

  const dispatchedEvents = [];
  const mockDocument = {
    dispatchEvent: (evt) => { dispatchedEvents.push(evt); },
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    readyState: "loading"
  };

  const beforeWs = UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z");
  const afterWs = structuredClone(beforeWs);
  afterWs.workspaceRevision = 1;
  afterWs.entities.projects.push({ id: "TEST-PROJ-1", type: "project", owner: "NSA", title: "Test" });

  const appSrc = fs.readFileSync("src/program-planner/js/app.js", "utf8");
  const startIdx = appSrc.indexOf("function publishWorkspaceChange(");
  assert.ok(startIdx >= 0, "publishWorkspaceChange should be defined");
  const endIdx = appSrc.indexOf("function resolveDeepLink(", startIdx);
  const publishCode = appSrc.slice(startIdx, endIdx).trim();

  const publishFn = new Function("UOS", "clone", "document", "CustomEvent", "before", "after", "command", "started", `
    var window = { performance: { now: () => 100 } };
    ${publishCode}
    return publishWorkspaceChange(before, after, command, started);
  `);

  const record = publishFn(UOS, structuredClone, mockDocument, class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } }, beforeWs, afterWs, "TestMutation", 50);
  assert.ok(record, "Observability record should be created");
  assert.equal(dispatchedEvents.length, 1);

  const event = dispatchedEvents[0];
  assert.equal(event.type, "uos:workspace-changed");
  assert.ok(event.detail, "event.detail should be present");
  assert.ok(event.detail.workspace, "detail.workspace canonical snapshot must be present");
  assert.ok(event.detail.after, "detail.after canonical snapshot must be present");
  assert.ok(event.detail.before, "detail.before must be present");
  assert.ok(event.detail.mutation, "detail.mutation observability record must be present");
  assert.equal(event.detail.revision, 1);
  assert.equal(event.detail.command, "TestMutation");
  assert.deepEqual(JSON.parse(JSON.stringify(event.detail.changed)), { projects: ["TEST-PROJ-1"] });
  assert.deepEqual(JSON.parse(JSON.stringify(event.detail.operations.projects)), { added: ["TEST-PROJ-1"], updated: [], removed: [] });
  assert.equal(event.detail.workspace.entities.projects.length, 1);
});

test("PC-013 C4: Resource Calculator preflight guard prevents fatal error when line is already absent", async () => {
  const { UOS, context } = loadMapSuite();
  const ws = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z"));

  let currentWs = structuredClone(ws);
  context.UOS.ProgramApp = {
    workspace: () => structuredClone(currentWs),
    updateWorkspace: (mutator) => {
      currentWs = mutator(structuredClone(currentWs));
      return Promise.resolve(currentWs);
    }
  };

  // Initialize costing controller
  UOS.ProgramCostingController.update(currentWs);

  // Attempt removing a non-existent or already deleted line
  const result = await UOS.ProgramCostingController.removeCalculatorLine("NON-EXISTENT-LINE-ID");
  assert.equal(result, null, "Should resolve to null gracefully without throwing");
});

test("PC-013 C4: explicit canonical empty costing context clears the controller", async () => {
  const { UOS } = loadMapSuite();
  let currentWs = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z"));
  currentWs.entities.jobs.push({ id: "NSA-JOB-C4-CLEAR", owner: "NSA", type: "job", projectId: "NSA-PROJ-CANONICAL", status: "Draft" });
  currentWs.entities.costingLines.push({ id: "NSA-COST-C4-CLEAR", owner: "NSA", type: "costingLine", projectId: "NSA-PROJ-CANONICAL", jobId: "NSA-JOB-C4-CLEAR", quantity: 1, unitRate: 10, estimatedTotal: 10 });
  currentWs.workspace.selectedProjectId = "NSA-PROJ-CANONICAL";
  currentWs.workspace.costing = { selectedProjectId: "NSA-PROJ-CANONICAL", jobId: "NSA-JOB-C4-CLEAR", section: "Labour", mode: "applications" };
  UOS.ProgramApp = {
    workspace: () => structuredClone(currentWs),
    updateWorkspace: (mutator) => { currentWs = mutator(structuredClone(currentWs)); return Promise.resolve(currentWs); }
  };
  UOS.ProgramCostingController.update(currentWs);
  currentWs.workspace.selectedProjectId = "";
  currentWs.workspace.costing.selectedProjectId = "";
  currentWs.workspace.costing.jobId = "";
  UOS.ProgramCostingController.update(currentWs);
  await UOS.ProgramCostingController.removeCalculatorLine("NSA-COST-C4-CLEAR");
  assert.equal(currentWs.workspace.selectedProjectId, "");
  assert.equal(currentWs.workspace.costing.selectedProjectId, "");
  assert.equal(currentWs.workspace.costing.jobId, "");
});

test("PC-013 C4: local/canonical costing divergence emits a diagnostic and reconciles", async () => {
  const { UOS, context } = loadMapSuite();
  let currentWs = setupCanonicalProject(UOS, UOS.ProgramModel.blank("2026-09-18T00:00:00.000Z"));
  currentWs.entities.jobs.push({ id: "NSA-JOB-C4-DIVERGED", owner: "NSA", type: "job", projectId: "NSA-PROJ-CANONICAL", status: "Draft" });
  currentWs.entities.costingLines.push({ id: "NSA-COST-C4-DIVERGED", owner: "NSA", type: "costingLine", projectId: "NSA-PROJ-CANONICAL", jobId: "NSA-JOB-C4-DIVERGED", quantity: 1, unitRate: 10, estimatedTotal: 10 });
  UOS.ProgramApp = {
    workspace: () => structuredClone(currentWs),
    updateWorkspace: (mutator) => { currentWs = mutator(structuredClone(currentWs)); return Promise.resolve(currentWs); }
  };
  UOS.ProgramCostingController.update(currentWs);
  const events = [];
  context.document = { dispatchEvent: (event) => events.push(event), querySelector: () => null, querySelectorAll: () => [] };
  context.CustomEvent = function CustomEvent(type, init) { this.type = type; this.detail = init.detail; };
  currentWs.entities.costingLines = [];
  const result = await UOS.ProgramCostingController.removeCalculatorLine("NSA-COST-C4-DIVERGED");
  assert.equal(result, null);
  assert.deepEqual(events.map((event) => ({ type: event.type, detail: JSON.parse(JSON.stringify(event.detail)) })), [{
    type: "uos:costing-sync-anomaly",
    detail: { lineId: "NSA-COST-C4-DIVERGED", reason: "local-line-missing-from-canonical-workspace" }
  }]);
});
