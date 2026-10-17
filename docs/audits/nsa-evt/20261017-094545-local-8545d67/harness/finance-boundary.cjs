"use strict";
// Read-only release-audit supplement. All business data is synthetic and in memory.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const root = process.argv[2] || process.cwd();
const sourceFiles = ["status.js", "default-rate-catalog.js", "model.js", "funding-model.js", "quote-model.js"];
const sha256 = value => crypto.createHash("sha256").update(value).digest("hex");
const sourceHashes = Object.fromEntries(sourceFiles.map(file => {
  const name = "src/program-planner/js/" + file;
  return [name, sha256(fs.readFileSync(path.join(root, name)))];
}));
function setup(owner) {
  const context = { console, structuredClone, URLSearchParams, crypto: crypto.webcrypto };
  context.window = context;
  context.UOS = { ProgramAppConfig: { current: () => ({ appId: owner === "NSA" ? "uos.horticulture.nsa" : "uos.horticulture.events", owner, workspaceKind: owner }) } };
  vm.createContext(context);
  for (const file of sourceFiles) vm.runInContext(fs.readFileSync(path.join(root, "src/program-planner/js", file), "utf8"), context, { filename: file });
  const api = context.UOS;
  let workspace = api.ProgramModel.blank();
  workspace.statusControl = { ...(workspace.statusControl || {}), operatorName: "Synthetic reversing officer" };
  const parentId = owner + (owner === "NSA" ? "-APP-AUDIT-FINANCE" : "-EVENT-AUDIT-FINANCE");
  const projectId = owner + "-PROJ-AUDIT-FINANCE";
  workspace.entities[owner === "NSA" ? "applications" : "events"].push({ id: parentId, owner, type: owner === "NSA" ? "application" : "event", title: "Synthetic financial audit", status: owner === "NSA" ? "received" : "enquiry", dateReceived: "2026-10-17" });
  workspace.entities.projects.push({ id: projectId, owner, type: "project", [owner === "NSA" ? "applicationId" : "eventId"]: parentId, funding: { operationalAmount: 0 } });
  workspace.entities.costingLines.push({ id: owner + "-COST-AUDIT-FINANCE", owner, type: "costingLine", projectId, jobId: null, kind: "Material", description: "Synthetic financial audit material", quantity: 1, unitRate: 100, estimatedTotal: 100 });
  workspace = api.ProgramQuotes.saveDraft(workspace, { projectId, fundingMode: "customer", preparedBy: "Synthetic recording officer", quoteDate: "2026-10-17" });
  return { api, workspace, quote: workspace.entities.quotes[0], projectId };
}
const results = [];
for (const owner of ["NSA", "EVT"]) {
  const { api, workspace, quote, projectId } = setup(owner);
  const original = JSON.stringify(workspace);
  const eligibility = api.ProgramQuotes.receiptEligibility(quote);
  const input = { quoteId: quote.id, amount: 20, paymentDate: "2026-10-17", reference: "SYNTHETIC-AUDIT-DEPOSIT", method: "Paid with Deposit" };
  let paid;
  try {
    paid = api.ProgramQuotes.recordPayment(workspace, input);
    const payment = paid.entities.payments[0];
    results.push({ id: owner + "-DRAFT-DEPOSIT", owner, status: "PASS", expected: "Draft Customer permits a deposit with exact Quote/Project linkage", actual: { amount: payment.amount, method: payment.method, ownerMatches: payment.owner === owner, quoteMatches: payment.quoteId === quote.id, projectMatches: payment.projectId === projectId, inputPreserved: original === JSON.stringify(workspace) } });
  } catch (error) {
    results.push({ id: owner + "-DRAFT-DEPOSIT", owner, status: "FAIL", error: error.message });
  }
  let regularAccepted = false, regularError = null;
  try { regularAccepted = api.ProgramQuotes.recordPayment(workspace, { ...input, reference: "SYNTHETIC-AUDIT-REGULAR", method: "Bank transfer" }).entities.payments.some(payment => payment.reference === "SYNTHETIC-AUDIT-REGULAR"); }
  catch (error) { regularError = error.message; }
  results.push({ id: owner + "-DRAFT-REGULAR-PAYMENT-BOUNDARY", owner, classification: "public API consistency observation; ordinary UI path has its own guard", status: eligibility.paymentAllowed === false && regularAccepted ? "FAIL" : "PASS", sourceExpectation: "quote-model.js receiptEligibility.paymentAllowed false and quote-builder.js:1927 blocks regular payments until Issued/Accepted", actual: { quoteStatus: quote.status, eligibility: JSON.parse(JSON.stringify(eligibility)), canonicalCommandAcceptedBankTransfer: regularAccepted, rejection: regularError, inputPreserved: original === JSON.stringify(workspace) } });
  if (paid) {
    const before = JSON.stringify(paid), paymentId = paid.entities.payments[0].id;
    const reversed = api.ProgramQuotes.reversePayment(paid, paymentId, "Synthetic audit reversal reason");
    const payment = reversed.entities.payments.find(item => item.id === paymentId);
    const twice = api.ProgramQuotes.reversePayment(reversed, paymentId, "Different repeated reason");
    const retained = payment.quoteId === quote.id && payment.projectId === projectId && payment.owner === owner && payment.status === "Reversed" && payment.reversalReason === "Synthetic audit reversal reason" && Number.isFinite(new Date(payment.reversedAt).getTime()) && JSON.stringify(paid) === before && JSON.stringify(twice) === JSON.stringify(reversed);
    results.push({ id: owner + "-REVERSAL-TRACEABILITY", owner, status: retained ? "PASS" : "FAIL", expected: "PC-009 reversal preserves exact revision/Project/owner, reason, timestamp and original input; repeat reversal preserves original evidence", actual: { status: payment.status, reasonPresent: Boolean(payment.reversalReason), validTimestamp: Number.isFinite(new Date(payment.reversedAt).getTime()), idempotent: JSON.stringify(twice) === JSON.stringify(reversed), inputPreserved: JSON.stringify(paid) === before } });
    results.push({ id: owner + "-REVERSAL-ATTRIBUTION", owner, status: "OBSERVATION", authority: "Audit scenario requests correct actor/timestamp evidence; PC-009 requires retained reversal evidence but does not explicitly require a named reversing officer. No login authentication is assumed.", actual: { quotePreparedBy: quote.preparedBy, sessionOperatorName: reversed.statusControl.operatorName, paymentReversedBy: payment.reversedBy || null, viewerActorTextFromSource: payment.reversedBy || "Not recorded", reversalCreatesStatusEvent: reversed.entities.statusEvents.length > paid.entities.statusEvents.length, reversalCreatesQuoteEvent: reversed.entities.quoteEvents.length > paid.entities.quoteEvents.length }, limitation: "A session operator name is available but ignored; a prepared-by officer is not proof of who reversed a payment. Absence of actor must not be replaced by invented attribution. No mandatory named-actor rule is established by this observation alone." });
  }
}
console.log(JSON.stringify({ harness: "nsa-evt-finance-audit.cjs", timestamp: new Date().toISOString(), environment: { node: process.version, protocol: "in-memory Node VM", storage: "none", externalRequests: "none" }, sourceHashes, results }, null, 2));
