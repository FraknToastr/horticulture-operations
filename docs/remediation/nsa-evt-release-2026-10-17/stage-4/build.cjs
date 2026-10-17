'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { root, evidence, buildRoot } = require('./prepare.cjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function build() {
  const packageEvidence = JSON.parse(fs.readFileSync(path.join(evidence, 'stage-4-pdf-package.json')));
  for (const [name, identity] of Object.entries(packageEvidence.selectedFiles)) {
    assert.equal(sha(fs.readFileSync(path.join(buildRoot, name))), identity.sha256, `Package file changed: ${name}`);
  }
  const sourceRuntime = fs.readFileSync(path.join(root, 'src/shared/js/program-runtime.js'), 'utf8');
  const sourceImports = fs.readFileSync(path.join(root, 'src/shared/js/imports.js'), 'utf8');
  const baseline = JSON.parse(fs.readFileSync(path.join(evidence, 'stage-4-preservation-baseline.json')));
  assert.equal(sha(sourceRuntime), baseline.protectedFiles['src/shared/js/program-runtime.js']);
  assert.equal(sha(sourceImports), baseline.protectedFiles['src/shared/js/imports.js']);
  const original = 'ensurePdf: function () { return load("PDF import", "../vendor/pdfjs/pdf.min.js", "pdfjsLib"); }';
  assert.equal(sourceRuntime.split(original).length, 2, 'PDF loader shape changed; review the proposal');
  const proposed = `ensurePdf: function () {
      if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
      if (pending["PDF import"]) return pending["PDF import"];
      var attempt = UOS.ProgramRuntime.pdfLoadAttempt = (UOS.ProgramRuntime.pdfLoadAttempt || 0) + 1;
      return load("PDF import", "../vendor/pdfjs/pdf.min.mjs?attempt=" + attempt, "pdfjsLib", "module");
    }`;
  const runtime = sourceRuntime
    .replace('function load(name, path, globalName) {', 'function load(name, path, globalName, type) {')
    .replace('script.src = new URL(path, source).href;', 'script.src = new URL(path, source).href;\n      if (type) script.type = type;')
    .replace(original, proposed);
  assert.ok(runtime.includes('if (type) script.type = type;'));
  const originalOpen = 'return pdf.getDocument({ data: bytes, isEvalSupported: false }).promise;';
  assert.equal(sourceImports.split(originalOpen).length, 2, 'PDF consumer shape changed; review the proposal');
  const imports = sourceImports.replace('../vendor/pdfjs/pdf.worker.min.js', '../vendor/pdfjs/pdf.worker.min.mjs')
    .replace(originalOpen, `var task = pdf.getDocument({ data: bytes, isEvalSupported: false });
      return task.promise.then(function (document) {
        // PDF.js 6 removed PDFDocumentProxy.destroy; existing import consumers
        // still call it to release the document and its dedicated worker.
        if (typeof document.destroy !== "function") document.destroy = function () { return task.destroy(); };
        return document;
      }, function (error) {
        // Rejected documents have no proxy to destroy; release the task's worker.
        return Promise.resolve(task.destroy()).catch(function () {}).then(function () { throw error; });
      });`);
  assert.notEqual(imports, sourceImports);
  assert.ok(imports.includes('isEvalSupported: false'));
  fs.writeFileSync(path.join(__dirname, 'program-runtime.candidate.js'), runtime);
  fs.writeFileSync(path.join(__dirname, 'imports.candidate.js'), imports);
  const report = {
    pdfVersion: packageEvidence.version, variant: 'official legacy ESM build', shippedFilesChanged: false,
    api: 'package/legacy/build/pdf.min.mjs', worker: 'package/legacy/build/pdf.worker.min.mjs',
    sources: { runtime: sha(sourceRuntime), imports: sha(sourceImports) },
    candidate: { runtime: sha(runtime), imports: sha(imports) },
    contract: { functionName: 'ensurePdf', inFlightDeduplication: true, successfulModuleReuse: true,
      failedModuleRetry: 'new module URL per explicit retry', timeoutMs: 8000, isEvalSupported: false,
      documentDestroy: 'compatibility bridge to PDFDocumentLoadingTask.destroy',
      rejectedDocumentCleanup: 'destroy the loading task before propagating its error' },
    limits: ['HTTP desktop assessment only; module scripts can change file:// compatibility',
      'No viewer, scripting manager, CMaps, standard fonts, WASM decoders or image PDF corpus certification']
  };
  fs.writeFileSync(path.join(evidence, 'stage-4-build.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
if (require.main === module) console.log(JSON.stringify(build()));
module.exports = { build };
