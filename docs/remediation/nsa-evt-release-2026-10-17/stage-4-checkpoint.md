# Stage 4 — dependency inventory and isolated PDF.js assessment

Completed locally on 17 October 2026 against the working tree based on commit
`8545d675921297349123e9828e62035981d34889`. **Stage 4 is complete; stop before
Stage 5.** No commit, push or production runtime replacement was performed.

The PDF.js 6.4.299 proposal passed seven focused desktop browser checks. The
shipped lazy loader passed its three unit checks. Adoption remains conditional:
the candidate needs module loading and a document-cleanup compatibility bridge,
and Edge `file://` operation has not been verified. The original release audit
verdict remains **UNVERIFIED**.

## Scope and preservation

The accepted Stage 4 scope was an inventory and isolated compatibility proposal,
not an automatic dependency upgrade. Candidate application adapters, preparation
recipes and evidence are confined to this remediation directory. Official PDF.js
payloads are downloaded to `/tmp/nsa-evt-stage4-pdfjs-6.4.299/`; a loopback server
overlays candidate files without modifying `src`.

All 409 protected files from the Stage 4 baseline remain byte-for-byte unchanged,
including shipped source, dependencies, lockfile, earlier stage evidence and the
original audit. The remediation README is the sole permitted existing-file
update. Existing unrelated edits are preserved. Overtime is excluded. There were
no screenshots, mobile/device tests, touch tests, videos or traces.

## Inventory and licence findings

The [machine-readable inventory](stage-4-vendor-inventory.json) records versions,
roles, sizes, SHA-256 hashes and licence evidence for 12 vendored files and seven
dependency roles.

| Dependency | Version | Role | Licence evidence |
| --- | --- | --- | --- |
| MapLibre GL | 5.3.0 | Lazy map fallback | BSD-3-Clause notice and link; full local licence text absent |
| PDF.js | 2.16.105 | Lazy PDF API and worker | Apache-2.0 notices and links; full local licence text absent |
| Three | 0.186.1 | Bundled GPU renderer | Full local MIT text |
| Earcut | 3.2.4 | Bundled triangulation | Full local ISC text |
| esbuild | 0.28.2 | Build only | Local MIT text |
| Playwright test | 1.62.0 | Tests only | Apache-2.0 package metadata |
| fake-indexeddb | 6.2.4 | Tests only | Apache-2.0 package metadata |

Three and Earcut are declared as development dependencies but their code ships in
browser bundles. Their exact pins are supported by the lockfile and build
sources; the Three asset banner identifies revision 186, not its patch version.
The MapLibre CSS version is inferred from its paired directory. Current bundles
have no shipped manifest connecting package versions, build inputs and output
hashes; this assessment does not retroactively certify their provenance.

Include the complete, version-matched [MapLibre licence](https://github.com/maplibre/maplibre-gl-js/blob/v5.3.0/LICENSE.txt)
and [PDF.js licence](https://github.com/mozilla/pdfjs-dist/blob/v2.16.105/LICENSE)
in a scoped vendor update. The official PDF.js 6.4.299 package includes its
Apache-2.0 LICENSE but no root NOTICE file; no NOTICE requirement is invented.
The font OFL text is present. No full ArcGIS SDK is bundled.

The separate GeoForge conversion tool contains JSZip 3.10.1 and remote MapLibre
references. These are recorded as auxiliary inventory, outside NSA/EVT runtime
verification. This is an exact top-level inventory, not a complete bundled
transitive SBOM.

## Advisory findings and priority

The [advisory snapshot](stage-4-advisories.json) records eight successful exact
package/version queries to the public GitHub Global Security Advisories API.
There were no omitted pagination pages. No matches were returned for candidate
PDF.js 6.4.299 or the checked Three, Earcut, esbuild, Playwright and fake-indexeddb
versions. This is a dated snapshot, not a claim that those dependencies are
vulnerability-free.

1. **MapLibre needs a separate scoped upgrade.** Shipped 5.3.0 matches critical
   GHSA-jrc7-96c5-q579 / CVE-2026-85061. The advisory affects versions through
   6.4.0 and identifies 6.4.1 as fixed. Removing attributes while iterating a live
   attribute collection can skip dangerous attributes in HTML sanitization.
   [Maintainer advisory](https://github.com/maplibre/maplibre-gl-js/security/advisories/GHSA-jrc7-96c5-q579),
   [patched release](https://github.com/maplibre/maplibre-gl-js/releases/tag/v6.4.1).
2. **Shipped PDF.js remains an affected version with the documented mitigation.**
   Version 2.16.105 matches high-severity GHSA-wgrm-67xf-hhpq / CVE-2024-4367.
   The first patched release is 4.2.67. Current imports explicitly set
   `isEvalSupported: false`, the maintainer's workaround; real baseline and
   candidate calls were checked. A workaround is not a library patch.
   [Mozilla advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq).

Read-only applicability review found the affected MapLibre sanitizer in the
shipped fallback, with attribution HTML as its identified sink. Current raster
providers supply curated attribution strings and explicit tile URLs. No
workspace/import/UI route to attacker-controlled attribution was identified, and
no application Popup/setHTML use was found. GPU attribution and tree labels use
`textContent`. Host-provided map configuration remains a code/configuration
surface. This reduces the demonstrated application exposure; it neither removes
the vulnerable library nor proves the application safe. No exploit test or
MapLibre upgrade was performed in Stage 4.

PDF.js 6.4.299 also postdates the 6.2.108 fix described in the maintainer's
[2026 scripting advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j).
The assessment loads the API and worker, not the standalone viewer or scripting
manager.

## PDF.js 6.4.299 proposal

The [official release](https://github.com/mozilla/pdf.js/releases/tag/v6.4.299)
and npm publisher package were checked. The preparation script pins 6.4.299,
validates metadata and verifies the archive against npm's SHA-512 integrity
value. [Package evidence](stage-4-pdf-package.json) retains source URLs, integrity,
archive hash and selected-file hashes. No npm install or lockfile change occurs.
Node 22.23.2 satisfies the package's Node engine requirement.

The candidate uses the unmodified official **legacy ESM** API and matching module
worker. It is not a drop-in replacement for the shipped classic scripts. The
[isolated build manifest](stage-4-build.json) and candidate source record these
required adapter changes:

- Load the API as a module on the first `ensurePdf()` call. Share the in-flight
  promise, retain the successfully loaded library and preserve the existing
  eight-second timeout and rejection cleanup.
- On an explicit retry, use a new module URL to avoid a browser-cached failed
  module evaluation. Do not automatically retry in a loop.
- Point `GlobalWorkerOptions.workerSrc` to the matching local `.mjs` worker.
  Keep `isEvalSupported: false` explicit.
- Preserve document cleanup: PDF.js 6 no longer supplies the old document
  `destroy()` method. The candidate bridges it to the loading task's `destroy()`
  method and destroys rejected loading tasks before propagating their error.
- Account for `getFieldObjects()` returning a Map instead of the old object.
  Current application consumers do not use this API, so only the parity harness
  normalizes it; no production field-object shim is proposed.

The assessed legacy API plus worker total 1,845,081 uncompressed bytes, compared
with 1,352,986 for the shipped pair: an increase of 492,095 bytes (about 36%).
These are file sizes, not compressed transfer or performance benchmark results.
Both remain lazy. Optional CMaps, standard fonts and WASM decoders were not added
or assessed; a larger supported-document corpus must determine their necessity.

## Focused verification

| Check | Result |
| --- | --- |
| Shipped runtime loader unit cases | 3 passed, 0 failed |
| NSA and EVT extraction parity, lazy promise sharing, real workers, local-only requests | Passed for both modules |
| NSA and EVT failed module load, deduplicated explicit retry | Passed for both modules |
| Real NSA Register PDF import, staging and application | Passed |
| Eight-second load timeout and explicit retry | Passed |
| Malformed PDF cleanup and reuse of successfully loaded module | Passed |
| Final browser run | 7 passed, 0 failed, 0 skipped; 13.3 seconds |

The parity corpus is the existing two-page flattened sample plus a small
source-generated AcroForm with one Receipt field. Normalized extraction matched
across both libraries and both module entry points:
`e0ca6caec86196df30b028fafe02ada7c796b49d96852737223aefdd7cf891b9`.
Each parity run observed one API load and two worker loads for two documents,
two actual workers created, zero workers remaining after cleanup, shared pending
promises and successful library reuse. Both observed `getDocument()` calls used
`isEvalSupported: false`. External browser requests were blocked. The real NSA
import produced one received application, receipt A3330 and 47 catalogue rates.

Earlier browser attempts are retained transparently. Attempt 1 exposed an
incorrect harness assumption that the existing flattened PDF had form fields;
the separate synthetic form now verifies that path. Attempt 2 exposed the real
removed `destroy()` API and led to the isolated cleanup bridge. Attempt 3 exposed
the Map return shape, which the parity harness now normalizes. The final run
passed after those corrections. There was no production source amendment.

See [loader TAP](stage-4-runtime-tests.tap), [final browser results](stage-4-browser-results.json),
[aggregate results](stage-4-results.json) and [preservation results](stage-4-preservation-results.json).

## Reproduction after shutdown

All assessment source, configuration, hashes and results are on disk. Temporary
package payloads can be recreated from the pinned official package; they need
not survive a shutdown. Preparation requires registry/API network access. Run
from the repository root with the existing development dependencies and browser
runtime available:

```sh
rtk proxy node docs/remediation/nsa-evt-release-2026-10-17/stage-4/prepare.cjs
rtk proxy node docs/remediation/nsa-evt-release-2026-10-17/stage-4/build.cjs
rtk proxy node docs/remediation/nsa-evt-release-2026-10-17/stage-4/inventory.cjs
rtk proxy node --test tests/program-runtime.test.cjs
rtk proxy node node_modules/@playwright/test/cli.js test --config=docs/remediation/nsa-evt-release-2026-10-17/stage-4/playwright.config.cjs
```

The browser configuration starts fresh loopback servers on 4199 and 4204. It uses
the desktop runtime guard and disables screenshots, video and traces. The
isolated suite is not added to the default release selection and does not make
normal application tests depend on a temporary candidate package.

## Adoption limits and next stage

Evidence covers current desktop Chromium over local HTTP. Edge `file://`, other
browsers and GitHub Pages remain unverified. Actual Register import was exercised
for NSA only; EVT extraction and loader behavior were checked. Image-heavy,
encrypted, signed, XFA and complex-font PDFs were not assessed. Dedicated
worker-load failures and late module completion after timeout need checks before
adoption. Local-only worker execution was demonstrated for the assessed corpus,
not a complete offline asset certification.

Therefore the recommendation is a **conditional PDF.js upgrade proposal**, with
the compatibility changes above and further entry-point/document checks before
deployment. Address the MapLibre advisory and missing full licence files in a
separately scoped vendor update. The current shipped libraries remain unchanged.

Stage 3's three owner decisions remain pending, and its reviewed workspace has
not been adopted. Stage 5 remains unstarted: governance reconciliation, required
reversal attribution, bounded CSS cleanup, and the final Markdown plus
self-contained interactive HTML remediation assessment. Resume only on request.
