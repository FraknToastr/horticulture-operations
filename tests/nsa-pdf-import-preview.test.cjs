const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const RECEIPT_TEXT = [
  "Apply for nature strip",
  "Application details",
  "Submitted on 13 September 2026",
  "Receipt number A9001",
  "Given name Alex",
  "Family name Citizen",
  "Email alex@example.test",
  "Preferred phone number 0400000000",
  "Property address 1 Test Street Adelaide SA 5000 Map (-34.9285, 138.6007)",
  "Do you have a sketch or diagram? Yes",
  "Please provide any information relevant to your application None",
  "Please indicate your preference for your nature strip Lawn",
  "Preferred plant type Native",
  "Consent Yes"
].join(" ");

function load(diagnostics) {
  const targets = [{ id: "nature-workspace" }];
  const context = {
    console,
    structuredClone,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    DataView,
    ArrayBuffer,
    URLSearchParams,
    DecompressionStream,
    crypto
  };
  context.window = context;
  context.UOS = {
    ProgramAppConfig: {
      current: () => ({ appId: "uos.horticulture.nsa", workspaceKind: "NSA", owner: "NSA" })
    },
    imports: {
      parseCsv: () => [],
      openPdf: async () => ({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({ items: RECEIPT_TEXT.split(" ").map((str) => ({ str })) })
        }),
        destroy: async () => {}
      })
    },
    smartImport: {
      inspect: async (file) => ({
        kind: "pdf",
        targetId: "nature-workspace",
        diagnostics: diagnostics || [],
        source: { name: file.name, size: file.size, lastModified: 0 }
      }),
      listTargets: () => targets.slice(),
      registerTarget: (target) => targets.push(target)
    }
  };
  vm.createContext(context);
  for (const file of ["status.js", "default-rate-catalog.js", "model.js", "status-model.js", "data-workspace.js"]) {
    vm.runInContext(fs.readFileSync(`src/program-planner/js/${file}`, "utf8"), context, { filename: file });
  }
  return context.UOS;
}

function pdfFile() {
  return {
    name: "A9001.pdf",
    size: 128,
    arrayBuffer: async () => new ArrayBuffer(8)
  };
}

test("first valid NSA PDF import reports only the imported Register delta", async () => {
  const UOS = load();
  const workspace = UOS.ProgramModel.blank("2026-09-13T00:00:00.000Z");
  const staged = await UOS.ProgramData.stage(pdfFile(), workspace);

  assert.equal(workspace.entities.applications.length, 0);
  assert.equal(workspace.entities.rateItems.length, 47);
  assert.deepEqual(Array.from(staged.preview.warnings), []);
  assert.deepEqual(Array.from(staged.preview.conflicts), []);
  assert.equal(staged.preview.counts.applications, 1);
  assert.equal(staged.preview.counts.statusEvents, 1);
  assert.equal(staged.preview.counts.rateItems, 0);
  assert.equal(staged.preview.ownership.NSA, 2);
});

test("genuine PDF inspection diagnostics remain visible in the import preview", async () => {
  const warning = "PDF text quality is low; verify the extracted address.";
  const UOS = load([warning]);
  const staged = await UOS.ProgramData.stage(pdfFile(), UOS.ProgramModel.blank("2026-09-13T00:00:00.000Z"));

  assert.deepEqual(Array.from(staged.preview.warnings), [warning]);
  assert.deepEqual(Array.from(staged.preview.conflicts), []);
});
