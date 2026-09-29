# Horticulture Operations Suite — Project Test Profile

**Profile status:** Completed from current governance and repository inspection; unresolved approvals are identified below, not assumed.  
**Product package:** `uos-horticulture-program-planner` v5.0.0 (`package.json`); canonical workspace schema v5 (`src/program-planner/js/model.js`).  
**Governance baseline:** v1.5-draft Constitution, Contracts, Canonical Model and Release Gates; UX Rules v1.4-draft. Draft status is not release approval.  
**Use with:** `Horticulture_Applications_Universal_Engineering_Test_and_Review_Standard_v1.1.md`; use `COMPREHENSIVE_BASELINE_REVIEW_PROTOCOL.md` for a whole-codebase review.  
**Snapshot rule:** A reviewer must record the exact commit or content hashes, included dirty/untracked files and review date in each evidence report. This living profile does not itself pin a code revision.

## Authority and risk

Product authority follows `../README_GOVERNANCE.md`: `PRODUCT_CONSTITUTION.md` → `PRODUCT_CONTRACTS.md` → `CANONICAL_MODEL.md` → `DECISIONS.md` → `UX_RULES.md` → `RELEASE_GATES.md` → `../AI_INSTRUCTIONS.md`. HORT-ENG-TEST-001 governs review method, not product truth. A conflict is escalated under the Constitution amendment/decision pathway; a test cannot silently redefine a contract.

**Baseline/release audit risk: R4 — Critical.** This product holds persistent Register/Project relationships, annual financial authority and commercial history, creates Jobs through three origins, and imports/restores user data. A narrower change receives its own R1–R4 classification under the universal standard. R4 here does not assert that a release gate passed.

## Architecture, operating modes and data

| Profile field | Current evidence / review instruction |
|---|---|
| Runtime | Portable, framework-free browser HTML/CSS/JavaScript; static-server entry via `npm start`. Inspect actual `src/program-planner/index.html`, `nsa.html`, `events.html`, shared assets and any submitted portable distribution. No repository build command is declared in `package.json`. |
| Workspaces | NSA Nature Strip Applications and Events/EVT are separate operational owners; test ownership and state isolation in both modes. |
| Canonical data | Workspace schema v5, canonical model in `src/program-planner/js/model.js`; `CANONICAL_MODEL.md` describes Register → Delivery Project → Tasks/Jobs/Geometry/Quotes and financial lineage. |
| Persistence | `src/program-planner/js/storage.js` uses shared `src/shared/js/storage.js` (IndexedDB); shared UI preferences may use `localStorage`. Review unavailable/quota/corrupt storage and last-verified recovery, not only save success. |
| Import/export | Inspect `src/program-planner/js/data-workspace.js`, `migration.js`, backup/restore and Rate Library/Quote exports; verify real bytes, schema compatibility and rejection atomicity. |
| External/offline | Portable/offline operation is a product claim in the governance/readme/runtime. Exact first-launch, browser-file and network-blocked support matrix is **OPEN** pending artifact-level verification and owner approval. |
| Browser/device support | Automated browser configuration uses headless Chromium in `playwright.config.cjs`. Other supported browsers, OSs, touch devices, minimum widths and zoom target are **OPEN**; test coverage must not be described as multi-browser support. |
| Accessibility target | Keyboard, focus, semantics, contrast and zoom/reflow are required review surfaces under the standard and UX Rules. Formal conformance level and assistive-technology matrix are **OPEN** for approval. |

## Critical invariants and owners

The authoritative wording and exceptions remain in the named governance files. These groups route review and tests; they do not paraphrase away contract details.

| Group | IDs / authority | Canonical review focus |
|---|---|---|
| Register and lineage | T-001–T-007; PC-001–PC-006 | Register root, one active Project, ownership, independent Location/Work Geometry, deliberate geometry-to-Job promotion and immutable Job origin. Model and Planner/Map boundaries. |
| Commercial history | T-008–T-011; PC-007–PC-010, PC-013 | Cost snapshots, Quote draft versus Issue readiness, issued revision immutability, payment traceability and protected dependencies. Costing/Quote/model boundaries. |
| Persistence and lifecycle | T-012–T-014; PC-011–PC-012 | Complete graph recovery, rejection of corrupt states, owner isolation and separate domain lifecycles. Storage, migration, import/export and UI projection boundaries. |
| UI/operability | PC-014–PC-019; `UX_RULES.md` | Sidebar surfaces, Location/Polygon cards, Scheduler routing/signalling, accordion floor and Register drawer growth; accessible Rate Item Category/Description sorting; inline Register budget rows in the Delivery Project grid. Shared CSS/JS and browser-delivery boundaries. |
| Annual budget | T-015–T-018; PC-021–PC-025 | NSA/EVT July–June owner/year authority, Register allocations, approved append-only signed adjustments, atomic transfers, closed-year history and carry-forward decisions without automatic money movement. Budget/model/persistence/UI boundaries. |
| Three Job paths | T-019; PC-020, PC-026–PC-028 | Planner Task, Calculator work or Map geometry as exactly one origin; idempotent Operational Task Draft Job creation; separate scheduling, costing and Quote inclusion decisions. Planner/Calculator/Scheduler/Map/Quote boundaries. |

**Critical user journeys:** (J1) Register matter → optional Project → Planner Task/Job → explicit Scheduler/Calculator/Map/Quote actions; (J2) Rate Library → Resource Calculator → saved costing snapshot → eligible Draft Quote and governed Issue; (J3) Map geometry → explicit Job promotion → costing; (J4) annual budget → same-owner/year Register allocation without Project → adjustment/transfer → close/reopen/carry-forward review; (J5) save/reload → export/backup → import/restore with exact IDs, relationships and owner isolation; (J6) NSA/EVT navigation, sidebar/drawer interaction and accessible error recovery. Use `RELEASE_GATES.md` for complete gate-specific acceptance, not these shorthand descriptions.

## Existing suites and execution

| Layer / affected surface | Current command or suite | Evidence boundary |
|---|---|---|
| Node contracts and model | `npm test` (`node --test tests/*.test.cjs`) | Includes model v5, budget model, Planner Draft Job, Rate Library schema, data round trip, sanitation, status, Register deletion and other root `tests/*.test.cjs`. Verify each assertion/fixture before counting it as a PC proof. |
| Browser workflows | `npm run test:browser` (`playwright test`) | `tests/browser/*.spec.js`; includes budget workflow, calculator UI, Rate Library, Planner/Map promotion, Quote lifecycle, drawer, backup/recovery and navigation. Headless Chromium is the configured runner, not a supported-browser declaration. |
| Automated release launcher | `npm run test:release` (`scripts/run_release_gates.cjs`) | Runs Node then browser suites; reports both failures. Green output is **not** a Critical contract or release-gate sign-off. |
| Static/artifact checks | JavaScript syntax, diff/secret/dependency inspection and actual portable HTML/assets | No single lint/typecheck/build script is declared in `package.json`; record exact checks chosen, and `NOT RUN` for omitted ones. |

**Test mapping requirement:** maintain a separate, revision-specific PC/T/UX-rule → boundary → test ID/assertion → result matrix. Filenames above are *candidate* evidence, not a claim of complete PC-001–PC-028 coverage. Include positive, legitimate exception, negative, failure/rollback, reload and exported-artifact proof as applicable. Never infer acceptance from a passing count alone.

### Prepared Rate Library and Register budget presentation coverage — awaiting execution

`tests/browser/rate-library-interactions.spec.js` prepares acceptance coverage for default Description A–Z order; Category and Description ascending/descending mouse and keyboard activation; direction indicators and `aria-sort`; retention across Kind, search and category filters; deterministic duplicate ordering; and Add/Edit/Delete Rate Item targeting after reorder.

`tests/browser/budget-workflow.spec.js` prepares acceptance coverage for inline placement immediately after Linked Project/Show Project Plan; removal of the standalone Budget card; exact two-column row geometry; Allocate/Adjust and Project action width parity; compact Financial FY/Allocated table header, discrete allocation-row dividers, newest-first separate FY rows without a cross-year total; current-FY `$0.00` fallback; NSA/Event and linked/Project-free variants; and correct Register preselection in the existing allocation form.

`tests/browser/drawer-viewport-floor.spec.js` prepares regression coverage for repeated Preliminaries/Margin saves in NSA and Event calculator drawers: the measured floor, drawer height, outer Register scroll, Rate Library scroll, assigned-line scroll and visible totals footer must remain stable. The breakdown exposes the entered percentages and model-derived AUD Subtotal, Preliminaries, Margin, GST and total.

Register budget coverage also requires the legacy `Council Operational Amount` row to be absent, a compact Financial FY/Allocated table with discrete allocation-row dividers to match the adjacent action width, and carry-forward FY/amount presentation to remain absent through review, pending or rejection. Only an approved carry-forward ledger entry may expose the governed destination-FY amount.

`tests/costing-adjustments.test.cjs` prepares model coverage for the calculation order (subtotal, preliminaries, margin, GST and grand total), decimal percentages, currency rounding and zero-adjustment defaults.

Status: **NOT RUN / awaiting explicit verification approval.** These prepared tests are not release evidence until the focused suites, relevant model tests, complete release suite and `git diff --check` have executed and their results are recorded.

## Release gates, evidence budgets and known limitations

`RELEASE_GATES.md` defines Gates A–Q and is the acceptance authority. Gates O (budget allocation), P (financial audit/closure/carry-forward) and Q (Job origin/Planner delivery) are expressly labelled **release blockers until implemented and proven** there. All Critical contracts require revision-specific evidence even if `npm run test:release` is green. The baseline review records `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, `N/A (reason)` or `UNPROVEN` for each gate; this profile asserts none passed.

**Performance budgets:** representative record/geometry/quote sizes, load latency, action latency, export/import duration and memory thresholds are **OPEN**; set them with product owners before acceptance and measure baseline and candidate in the same environment. Do not invent thresholds after seeing results.

**Security/privacy:** use synthetic NSA/EVT records and isolated browser storage; never run destructive tests on live user data. Inspect every delivered file and review package for secrets/personal information, validate imported text/files and review backup/export sensitivity. No privacy certification is implied by this profile.

**Known baseline failures and deferred issues:** no complete, signed baseline/deferral ledger is established by this profile. Build one at G0 from the exact reviewed revision, including existing release blockers and reproducible test failures. Do not relabel unknown failures as accepted exceptions.

**Approval/ownership decisions still required:** named product and release gate owners; exact browser/device/OS and accessibility targets; offline first-launch guarantee and distribution parity; performance and representative-data budgets; reviewer test-patch integration owner/CI command; authorised baseline exceptions. Until recorded, related review rows remain `UNKNOWN`, `UNPROVEN` or `BLOCKED` as appropriate. Reviewer test patches use the repository's CJS Node tests or Playwright JavaScript convention and require owner approval to merge.
