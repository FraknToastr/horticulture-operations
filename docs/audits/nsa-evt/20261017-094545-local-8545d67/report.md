# NSA / EVT release-readiness assessment

**Recommendation: UNVERIFIED.** No P0/P1 application defect or demonstrated product release blocker was established. Complete mandatory release evidence is still missing: current full release assertions, accepted complete desktop Budget action proof and production browser/distribution sign-off. Passing counts cannot turn missing evidence into a production GO.

Run 20261017-094545-local-8545d67. Completed 2026-10-17T04:19:35.222Z.

## Candidate, scope and environment

Local main at 8545d675921297349123e9828e62035981d34889, with the uncommitted radial-menu fix. SHA256 946c8be894acc2ecb100745da276b88e6af7ec7718d1732975f22cf07eace2ae. 381 files fingerprinted; [exact manifest](evidence/candidate-manifest.json).
Node v22.23.2; Playwright 1.62.0; effective Chromium 151.0.7922.34; Linux WSL2; local HTTP. Desktop widths 1024–2600, typically 1600×1000.
Seven modules: Register, Project Planner, Space Map, Resource Calculator, Job Scheduler, Quote Builder, Annual Budget. Cost Library and workspace/settings are supporting surfaces. Independent Overtime and other launcher apps are excluded. Published readiness remains unverified.
Only this audit package was added. Application/configuration/schema/governance/existing tests were preserved. No commit, push, release or remediation was performed.

## Executive assessment

Distinct latest selected checks: {"PASS":429,"BLOCKED":1,"FAIL":2}; model {"PASS":301}; browser {"PASS":128,"BLOCKED":1,"FAIL":2}.
Independent recovery {"PASS":10}; finance {"PASS":4,"FAIL":2,"OBSERVATION":2}; current inspector {"PASS":2}. These groups are not summed into an invented coverage percentage. All earlier attempts remain documented.
The two original desktop failures are stale inspector test steps. The Budget block is the owner's exclusion guard. The reproduced payment mismatch is an internal API inconsistency with no ordinary UI bypass established.

## Release-readiness scorecard

| Category | Rating | Reason | Counts / scope |
| --- | --- | --- | --- |
| Functional completeness | PARTIALLY VERIFIED | All seven modules have selected source/runtime evidence; the full feature/state space is not enumerated. | {"applicableSelected":432,"verified":429,"failed":2,"blocked":1,"notTested":"Unknown outside declared inventory/exclusions"} |
| NSA/EVT parity | PARTIALLY VERIFIED | Shared implementations and representative both-mode checks agree; intentional differences are explicit. | {"applicableSelected":182,"verified":180,"failed":2,"blocked":0,"notTested":"Unknown outside declared inventory/exclusions"} |
| Data integrity | PARTIALLY VERIFIED | Canonical ownership/revisions/IDs/deletion pass; converted fixture warnings need review. | {"applicableSelected":79,"verified":79,"failed":0,"blocked":0,"notTested":"Unknown outside declared inventory/exclusions"} |
| Financial correctness | PARTIALLY VERIFIED | Money/readiness/receipt UI checks pass; canonical Draft-payment eligibility is inconsistent. | {"applicableSelected":112,"verified":111,"failed":0,"blocked":1,"notTested":"Unknown outside declared inventory/exclusions"} |
| Storage and recovery | PARTIALLY VERIFIED | Latest NSA plus synthetic EVT import, round-trip, reload and permanent deletion pass in isolated contexts. | {"applicableSelected":41,"verified":41,"failed":0,"blocked":0,"notTested":"Unknown outside declared inventory/exclusions"} |
| Security and privacy | PARTIALLY VERIFIED | Privacy and importer safeguards inspected; no exploit proved. Vendored dependency and full attack coverage remain limited. | {"applicableSelected":30,"verified":30,"failed":0,"blocked":0,"notTested":"Unknown outside declared inventory/exclusions"} |
| UI/UX consistency | PARTIALLY VERIFIED | Desktop DOM/focus/layout checks pass broadly; stale tests are classified separately. | {"applicableSelected":131,"verified":128,"failed":2,"blocked":1,"notTested":"Unknown outside declared inventory/exclusions"} |
| Supported desktop compatibility | PARTIALLY VERIFIED | Chromium 151 on Linux WSL2/local HTTP only; production browser/distribution sign-off is incomplete. | {"applicableSelected":131,"verified":128,"failed":2,"blocked":1,"notTested":"Unknown outside declared inventory/exclusions"} |
| Architectural maintainability | PARTIALLY VERIFIED | Shared services/tokens exist; large CSS override density deserves incremental cleanup. | {"applicableSelected":34,"verified":34,"failed":0,"blocked":0,"notTested":"Unknown outside declared inventory/exclusions"} |
| Governance compliance | PARTIALLY VERIFIED | Later accepted decisions resolve runtime intent; superseded cross-references remain. | {"applicableSelected":74,"verified":73,"failed":0,"blocked":1,"notTested":"Unknown outside declared inventory/exclusions"} |
| Test coverage and reliability | PARTIALLY VERIFIED | One model baseline and scoped desktop execution; obsolete assertions and a policy-blocked Budget case prevent complete release proof. | {"applicableSelected":432,"verified":429,"failed":2,"blocked":1,"notTested":"Unknown outside declared inventory/exclusions"} |

## Mandatory release gates

| Gate | Requirement | Result | Evidence | Limit |
| --- | --- | --- | --- | --- |
| G-A | Constitutional integrity | BLOCKED | B-NODE-1, B-CORE-2 | PROJECT_TEST_PROFILE still leaves production browser/distribution and named release acceptance decisions open. This local desktop audit does not formally sign off the unexecuted full contract matrix. |
| G-B | Core Project, evidence and Quote pathway | PASS | B-CORE-2, evidence/integrated-workflow.json |  |
| G-C | Evidence-based Quote readiness | PASS | B-NODE-1, B-CORE-2 |  |
| G-D | Commercial immutability and revision | PASS | B-NODE-1, B-CORE-2, evidence/finance-boundary.json |  |
| G-E | Dependency protection | PASS | B-NODE-1, B-CORE-2 |  |
| G-F | Persistence, import and recovery | PASS | B-NODE-1, B-CORE-2, evidence/recovery-summary.json |  |
| G-G | NSA/EVT isolation | PASS | B-NODE-1, B-CORE-2, evidence/recovery-summary.json |  |
| G-H | Usable controls and truthful workspace locks | BLOCKED | B-CORE-2, B-BUDGET-2 | One eight-action Budget case was stopped before its prohibited 480px stage; other selected operability cases passed. |
| G-I | Retired sidebar architecture remains inactive | PASS | B-NODE-1, B-CORE-2 |  |
| G-J | Location and polygon surfaces | PASS | B-MAP-DRAFT-2, B-GPU-2, evidence/inspector-undo.json | Two original deep Undo tests are stale; the independent current three-level procedure passes. Original failures remain recorded. |
| G-K | Scheduler ownership and routing | PASS | B-NODE-1, B-CORE-2 |  |
| G-L | Active-project calendar signals | PASS | B-CORE-2 |  |
| G-M | Drawer viewport containment | PASS | B-CORE-2 |  |
| G-N | Unified drawer scroll ownership | PASS | B-CORE-2 |  |
| G-O | Annual budget authority and allocation | BLOCKED | B-NODE-1, B-BUDGET-2 | Budget models and six desktop cases passed. Complete mandated runner proof is unavailable because it includes the mixed mobile case; equivalent full desktop action proof remains to be accepted. |
| G-P | Financial audit, closure and carry-forward | BLOCKED | B-NODE-1, B-BUDGET-2 | Budget models and six desktop cases passed. Complete mandated runner proof is unavailable because it includes the mixed mobile case; equivalent full desktop action proof remains to be accepted. |
| G-Q | Job origin and deliberate Planner delivery | PASS | B-NODE-1, B-CORE-2, evidence/integrated-workflow.json |  |
| G-R | Current owner-approved regressions and safe reference layers | PASS | B-CORE-2, B-MAP-DRAFT-2, B-GPU-2 |  |

Authority: src/governance/RELEASE_GATES.md subject to later explicit owner instructions and accepted ADRs. Historical PASS/FAIL declarations are not current proof. The accepted 1 October explicit-calendar ADR supersedes automatic Planner Job creation.

## Detailed findings

### F-001 — Regular-payment command disagrees with Draft eligibility

**P2; Verified internal API consistency risk; NSA/EVT; Quote Builder; FAIL.** Blocking: no.

Expected: A canonical command should enforce or explicitly distinguish the eligibility result exposed to its callers.

Observed: Both synthetic Customer Draft Quotes report paymentAllowed:false and the ordinary UI blocks regular payments, but ProgramQuotes.recordPayment accepts a Bank transfer. Deposits and reversal lineage/idempotency pass.

Impact/limits: An alternate caller can create a transaction the normal UI considers unavailable. A user-interface bypass and an approved prohibition on all pre-Issue receipts were not established; this is not a Critical-gate failure.

Sources: src/program-planner/js/quote-model.js:151; src/program-planner/js/quote-model.js:438; src/program-planner/js/quote-builder.js:1927.

Evidence: [finance-boundary.json](evidence/finance-boundary.json).

Recommended action: Confirm the intended pre-Issue payment policy, then align canonical and UI eligibility in a bounded change.

### F-002 — Approved UI changes have left release tests stale

**P2; Verified test-maintenance defect; NSA/EVT; Space Map; FAIL.** Blocking: no.

Expected: Tests should match the no-Paste MetroMap modal and three-level inspector disclosure.

Observed: Inspected MetroMap cases request the removed Paste button. Two executed deep Undo cases assume the second collapse click reopens full; it correctly reaches minimal, where vertex controls are hidden. An independent current-behavior procedure passes for both modes.

Impact/limits: The unmodified browser/release aggregate cannot provide reliable current sign-off. These failures do not demonstrate broken Undo or MetroMap activation.

Sources: tests/browser/adaptive-map-scheduler-register.spec.js:35; tests/browser/space-map-draft-actions.spec.js:149; src/program-planner/js/program-map.js:874.

Evidence: [execution-summary.json](evidence/execution-summary.json), [inspector-undo.json](evidence/inspector-undo.json).

Recommended action: Update obsolete assertions under separate authorisation and separate desktop functional cases from excluded screenshot/mobile checks.

### F-003 — Latest converted workspace retains 57 Data Health warnings

**P2; Business-data readiness risk; NSA; Workspace support; UNVERIFIED.** Blocking: no.

Expected: Structural recovery and business readiness must be assessed separately.

Observed: The latest approved fixture has zero validation errors, duplicate IDs, missing links or foreign records. It retains 57 warnings for status migration readiness, missing operational amount and an active legacy catalogue.

Impact/limits: The backup is structurally recoverable, but its status/funding/catalogue choices need operational review before relying on them. No source data was silently corrected.

Sources: docs/readiness/README.md:16; src/sample/nsa-workspace-2026-27-area-pricing-v5.json.

Evidence: [recovery-summary.json](evidence/recovery-summary.json).

Recommended action: Review warnings in a disposable imported copy, record accepted exceptions or corrections, and preserve the approved original.

### F-004 — Superseded automatic-Job wording remains in gate documents

**P3; Verified documentation drift; NSA/EVT; Project Planner; FAIL.** Blocking: no.

Expected: Cross-references should reflect the accepted 1 October explicit-calendar decision.

Observed: DECISIONS explicitly supersedes automatic Operational Task Job creation, while older Constitution/PC-027/Gate Q clauses still describe it. The readiness test README also calls a now-included fixture private/unbundled.

Impact/limits: Future reviewers may report false noncompliance or reinstate deliberately removed behavior. This audit follows the later accepted ADR and owner changes.

Sources: src/governance/DECISIONS.md:Explicit Planner calendar creation — 2026-10-01; src/governance/PRODUCT_CONTRACTS.md:33; src/governance/RELEASE_GATES.md:181; tests/readiness/README.md:8.

Evidence: [mandatory-gates-before-execution.json](evidence/mandatory-gates-before-execution.json).

Recommended action: Reconcile current cross-references and fixture wording in a documentation-only change; retain historical records.

### F-005 — Lockfile advisory checks exclude the old vendored PDF runtime

**P2; Dependency-maintenance risk; no exploit established; NSA/EVT; Workspace support; PARTIALLY VERIFIED.** Blocking: no.

Expected: Security evidence should include browser libraries shipped outside package-lock.

Observed: The npm query reports zero known vulnerabilities for its 34-dependency lockfile graph. Vendored PDF.js is 2.16.105, MapLibre is 5.3.0 and JSZip is 3.10.1. PDF.js falls in the CVE-2024-4367 range, but the importer sets isEvalSupported:false, the maintainer-documented mitigation. The separate reviewed 2026 advisory targets a newer version range.

Impact/limits: A zero npm count alone would overstate shipped-runtime coverage. No malicious-PDF exploit or active credential exposure was demonstrated.

Sources: src/shared/vendor/pdfjs/pdf.min.js; src/shared/js/imports.js:28; src/shared/vendor/maplibre/maplibre-gl.js; package-lock.json.

Evidence: [npm-advisories.json](evidence/npm-advisories.json), [security-review.json](evidence/security-review.json).

Recommended action: Inventory vendored versions in repeatable advisory checks and assess a compatible supported PDF upgrade; preserve the explicit eval mitigation.

### F-006 — CSS override density increases maintenance cost

**P3; Optional maintainability improvement; NSA/EVT; Cross-module; PARTIALLY VERIFIED.** Blocking: no.

Expected: Use existing shared tokens and remove only declarations proven redundant in their actual cascade.

Observed: styles.css has 11065 lines, 388715 bytes, 1891 !important declarations, 1236 hex-colour literals and 686 shared-token references. Approximately 160 selector groups repeat; media contexts are not normalised.

Impact/limits: These source metrics do not prove unused CSS, a rendering slowdown or a visual defect.

Sources: src/program-planner/styles.css; src/shared/css/tokens.css:27; src/program-planner/planner-row-header.css; src/program-planner/scheduler-week.css.

Evidence: [static-review.json](evidence/static-review.json).

Recommended action: Consolidate one module at a time and verify computed styles before deleting overrides. No wholesale redesign is warranted.

### F-007 — Reversal evidence does not identify the reversing officer

**P3; Auditability observation; no explicit mandatory actor rule found; NSA/EVT; Quote Builder; OBSERVATION.** Blocking: no.

Expected: Exact commercial lineage, reason, time and idempotency are required; named officer attribution would improve evidence.

Observed: Synthetic reversals preserve reason, timestamp, Quote/Project/owner and original records. reversedBy is not written even with a synthetic session operator name; the viewer truthfully displays Not recorded.

Impact/limits: Commercial traceability passes, while person-level attribution is absent. PC-009 does not explicitly require a named reversal actor; no authenticated-identity rule is invented.

Sources: src/program-planner/js/quote-model.js:473; src/program-planner/js/status-ui.js:220.

Evidence: [finance-boundary.json](evidence/finance-boundary.json).

Recommended action: Decide whether explicit reversal-officer attribution should become a product requirement.

## NSA / EVT parity

| Module | Shared implementation | Approved differences | Evidence / limit |
| --- | --- | --- | --- |
| Register | Shared module implementation and canonical model; separate configured owner workspaces | EVT blue identity, immutable Event ID, editable Council number, bump dates and title privacy exception | B-NODE-1, B-CORE-2. Representative scenarios only; not a claim of every feature/state combination |
| Project Planner | Shared module implementation and canonical model; separate configured owner workspaces | Mode terminology, identity colours and owner data | B-NODE-1, B-CORE-2. Representative scenarios only; not a claim of every feature/state combination |
| Space Map | Shared module implementation and canonical model; separate configured owner workspaces | Mode terminology, identity colours and owner data | B-MAP-DRAFT-2, B-GPU-2, B-CORE-2. Two stale original deep Undo tests; independent current behavior passes |
| Resource Calculator | Shared module implementation and canonical model; separate configured owner workspaces | Mode terminology, identity colours and owner data | B-NODE-1, B-CORE-2. Representative scenarios only; not a claim of every feature/state combination |
| Job Scheduler | Shared module implementation and canonical model; separate configured owner workspaces | EVT derived all-day bump milestones; shared interaction model | B-NODE-1, B-CORE-2. Representative scenarios only; not a claim of every feature/state combination |
| Quote Builder | Shared module implementation and canonical model; separate configured owner workspaces | Mode terminology, identity colours and owner data | B-NODE-1, B-CORE-2. Representative scenarios only; not a claim of every feature/state combination |
| Annual Budget | Shared module implementation and canonical model; separate configured owner workspaces | Owner/year-isolated financial authority and allocations | B-NODE-1, B-CORE-2. Full eight-action mixed mobile browser case blocked; both-owner model and allocation scenarios pass |

## Requirements traceability

| ID | Requirement | Mode | Implementation | Verification | Result |
| --- | --- | --- | --- | --- | --- |
| PC-001 | Register business root | NSA/EVT | src/program-planner/js/model.js | model-v5; delete-register-v5 | PARTIALLY VERIFIED |
| PC-002 | One Register parent / active Project | NSA/EVT | src/program-planner/js/model.js | model-v5; delete-register-v5 | PARTIALLY VERIFIED |
| PC-003 | Canonical Planner Tasks | NSA/EVT | src/program-planner/js/planner-model.js | planner-current-state; planner-draft-job | PARTIALLY VERIFIED |
| PC-004 | Separate Locations and work geometry | NSA/EVT | src/program-planner/js/work-area-service.js | moasure-geometry; map drafts | PARTIALLY VERIFIED |
| PC-005 | Explicit geometry promotion | NSA/EVT | src/program-planner/js/work-area-service.js | canonical-costing-commands; GPU | PARTIALLY VERIFIED |
| PC-006 | Project-owned source-traceable Jobs | NSA/EVT | src/program-planner/js/model.js | canonical-work-governance; calculator isolation | PARTIALLY VERIFIED |
| PC-007 | Historical cost snapshots | NSA/EVT | src/program-planner/js/costing-model.js | quote-calculator-membership; costing-adjustments | PARTIALLY VERIFIED |
| PC-008 | Immutable issued/resolved Quote revisions | NSA/EVT | src/program-planner/js/quote-model.js | quote-payment-funding-workflow; draft-quoted deletion | PARTIALLY VERIFIED |
| PC-009 | Exact receipt and reversal lineage | NSA/EVT | src/program-planner/js/quote-model.js | quote-funding; finance supplement | PARTIALLY VERIFIED |
| PC-010 | Dependency-protected destruction | NSA/EVT | src/program-planner/js/model.js | delete-safety; c4-browser-acceptance | PARTIALLY VERIFIED |
| PC-011 | Complete graph recovery/revision fencing | NSA/EVT | src/program-planner/js/storage.js | data-roundtrip; workspace-backup-recovery; latest fixture | PARTIALLY VERIFIED |
| PC-012 | Separate domain lifecycle vocabularies | NSA/EVT | src/program-planner/js/status-model.js | status; c5-canonical-status-history | PARTIALLY VERIFIED |
| PC-013 | Permissive Draft / evidence-based Issue | NSA/EVT | src/program-planner/js/quote-model.js | quoted-lifecycle; receipt workflow | PARTIALLY VERIFIED |
| PC-014 | Sanctioned sidebar surfaces | NSA/EVT | src/program-planner/js/program-map.js | sidebar-architecture; onboarding | PARTIALLY VERIFIED |
| PC-015 | Operable Location/Polygon surfaces | NSA/EVT | src/program-planner/js/program-map.js | onboarding; inspector supplement | PARTIALLY VERIFIED |
| PC-016 | Active-context Scheduler edit scope | NSA/EVT | src/program-planner/js/scheduler.js | scheduler-unused-action-scope; multi-day | PARTIALLY VERIFIED |
| PC-017 | Active-Project calendar signalling | NSA/EVT | src/program-planner/js/scheduler.js | scheduler-side-by-side; week-viewport | PARTIALLY VERIFIED |
| PC-018 | Bounded usable drawer viewport | NSA/EVT | src/program-planner/js/register.js | drawer-scroll-ownership; drawer-motion | PARTIALLY VERIFIED |
| PC-019 | One drawer scroll owner | NSA/EVT | src/program-planner/js/register.js | drawer context; scroll ownership | PARTIALLY VERIFIED |
| PC-020 | Canonical Tasks and deliberate calendar action | NSA/EVT | src/program-planner/js/planner-model.js | planner-draft-job; planner-task-editor | PARTIALLY VERIFIED |
| PC-021 | Owner-scoped July–June years | NSA/EVT | src/program-planner/js/budget-model.js | budget-model; business-dates | PARTIALLY VERIFIED |
| PC-022 | Distinct Annual Budget authority | NSA/EVT | src/program-planner/js/budget-model.js | budget-model; budget-governance | PARTIALLY VERIFIED |
| PC-023 | Allocation owner/year lineage | NSA/EVT | src/program-planner/js/budget-model.js | desktop Budget cases | PARTIALLY VERIFIED |
| PC-024 | Signed append-only financial decisions | NSA/EVT | src/program-planner/js/budget-governance.js | budget-governance; annual transfer | PARTIALLY VERIFIED |
| PC-025 | Closed-year freeze and reviewed carry-forward | NSA/EVT | src/program-planner/js/budget-governance.js | budget-governance; carry-forward | PARTIALLY VERIFIED |
| PC-026 | Exactly one immutable Job origin | NSA/EVT | src/program-planner/js/model.js | canonical-work-governance; canonical-costing | PARTIALLY VERIFIED |
| PC-027 | Explicit eligible Planner Job creation | NSA/EVT | src/program-planner/js/planner-model.js | planner-draft-job; accepted 1 October ADR | PARTIALLY VERIFIED |
| PC-028 | Deliberate costing/Quote lineage | NSA/EVT | src/program-planner/js/costing-model.js | canonical-costing; quote membership | PARTIALLY VERIFIED |
| OWN-EVT | EVT ID, Council number, bump dates and title privacy | EVT | Shared NSA/EVT module runtime | evt-register-model; evt-register-delivery; milestones | PASS |
| OWN-METRO | User-entered key and correct activation labels | NSA/EVT | Shared NSA/EVT module runtime | metromap-credentials; metromap-activation | PASS |
| OWN-TREE | Lazy read-only tree layers, geometry, budgets and details | NSA/EVT | Shared NSA/EVT module runtime | space-map-tree; tree-reference-selection; GPU | PASS |
| OWN-CANCEL | Hub close globally cancels drafts, preserving in-flight saves | NSA/EVT | Shared NSA/EVT module runtime | closing either radial hub; Location save safeguard | PASS |
| OWN-SCHED | Current-record isolation, side-by-side/multi-day and 06:00 view | NSA/EVT | Shared NSA/EVT module runtime | scheduler scope; side-by-side; multi-day; week viewport | PASS |
| OWN-DECLINED | Block new Declined receipts; retain history/reversals | NSA/EVT | Shared NSA/EVT module runtime | quote-funding; performance-audit; receipt workflow | PASS |

All PC rows link to current contract authority plus accepted amendments. Status applies to named sampled scenarios and source boundaries, not every state combination.

## Test execution and coverage

| Attempt | Start | Duration ms | Exit | Counts |
| --- | --- | --- | --- | --- |
| B-NODE-1 | 2026-10-16T23:39:49.713Z | 2187 | 0 | {"PASS":301} |
| B-CORE-1 | 2026-10-16T23:39:51.901Z | 15650 | 1 | {"BLOCKED":98} |
| B-BUDGET-1 | 2026-10-16T23:40:07.551Z | 2805 | 1 | {"BLOCKED":7} |
| B-MAP-DRAFT-1 | 2026-10-16T23:40:10.357Z | 1702 | 1 | {"BLOCKED":10} |
| B-GPU-1 | 2026-10-16T23:40:12.059Z | 5342 | 1 | {"BLOCKED":16} |
| B-CORE-2 | 2026-10-16T23:41:45.446Z | 86785 | 0 | {"PASS":98} |
| B-BUDGET-2 | 2026-10-16T23:43:12.232Z | 6598 | 1 | {"BLOCKED":1,"PASS":6} |
| B-MAP-DRAFT-2 | 2026-10-16T23:43:18.831Z | 111435 | 1 | {"PASS":8,"FAIL":2} |
| B-GPU-2 | 2026-10-16T23:45:10.267Z | 37754 | 0 | {"PASS":16} |

Exact commands, IDs, candidate identity, outcomes, timestamps and durations are retained in [results.json](results.json) and [execution evidence](evidence/execution-summary.json). Environment blocks and test failures remain visible after later passes.

### Selection / exclusions

The [inventory](evidence/test-inventory.json) lists 138 candidate files. 76 were selected wholly or by exact title. Other files are NOT TESTED, not PASS.
The unmodified release and Budget aggregate runners were excluded because they invoke mixed screenshot/mobile coverage. One model baseline and safe desktop cases were run directly. Process-level guards prevent screenshots, video, traces, persistent profiles and mobile/touch options. The 480px Budget resize was blocked before application. No prohibited capture occurred.

### Latest fixture / recovery supplement

Approved fixture: src/sample/nsa-workspace-2026-27-area-pricing-v5.json, 173344 bytes, SHA256 d3424d247bca9586f1a35a7e3e584fa18b637e0bbeb44b0e29da84122c64ec5f.
NSA preserves 12 applications, 2 Projects, 50 Tasks and 54 Rate Items with zero structural errors, duplicate IDs, missing links or foreign records. JSON/ZIP round trips, reload, backup gate, revision-fenced permanent deletion and empty reload pass. NSA privacy export checked 50 masked fields with zero failures. EVT synthetic contact masking is outside this supplement because it had no sensitive fields. Remaining data warnings are F-003.

| Scenario | Owner | Result | Duration ms |
| --- | --- | --- | --- |
| REC-SUPP-NSA-ISOLATION | NSA | PASS | 6 |
| REC-SUPP-NSA-IMPORT | NSA | PASS | 188 |
| REC-SUPP-NSA-ROUNDTRIP | NSA | PASS | 185 |
| REC-SUPP-NSA-RELOAD | NSA | PASS | 334 |
| REC-SUPP-NSA-DANGERZONE | NSA | PASS | 825 |
| REC-SUPP-EVT-ISOLATION | EVT | PASS | 5 |
| REC-SUPP-EVT-IMPORT | EVT | PASS | 170 |
| REC-SUPP-EVT-ROUNDTRIP | EVT | PASS | 66 |
| REC-SUPP-EVT-RELOAD | EVT | PASS | 226 |
| REC-SUPP-EVT-DANGERZONE | EVT | PASS | 568 |

### Finance / current inspector supplements

| Check | Owner | Result |
| --- | --- | --- |
| NSA-DRAFT-DEPOSIT | NSA | PASS |
| NSA-DRAFT-REGULAR-PAYMENT-BOUNDARY | NSA | FAIL |
| NSA-REVERSAL-TRACEABILITY | NSA | PASS |
| NSA-REVERSAL-ATTRIBUTION | NSA | OBSERVATION |
| EVT-DRAFT-DEPOSIT | EVT | PASS |
| EVT-DRAFT-REGULAR-PAYMENT-BOUNDARY | EVT | FAIL |
| EVT-REVERSAL-TRACEABILITY | EVT | PASS |
| EVT-REVERSAL-ATTRIBUTION | EVT | OBSERVATION |

| Current inspector | Result | Checks |
| --- | --- | --- |
| NSA | PASS | Pointer vertex edit changes preview; Undo restores it without saving.; Undo while summary is collapsed reverses both coordinate edits, preserves card node and saved geometry.; Disclosure cycles full -> summary (3 rows + 6 tools) -> minimal (header + Job Type value only) -> full, preserving card node.; After reopening full level, vertex deletion and Undo restore four vertices without saving. |
| EVT | PASS | Pointer vertex edit changes preview; Undo restores it without saving.; Undo while summary is collapsed reverses both coordinate edits, preserves card node and saved geometry.; Disclosure cycles full -> summary (3 rows + 6 tools) -> minimal (header + Job Type value only) -> full, preserving card node.; After reopening full level, vertex deletion and Undo restore four vertices without saving. |

### Integrated workflow

An independent canonical/API end-to-end trace was executed. It is explicitly model/API evidence, not a claim of a single full UI walk-through. See the embedded structured result and [workflow evidence](evidence/integrated-workflow.json).

{
  "modes": 2,
  "passed": 2,
  "failed": 0,
  "checksPassed": 38
}

## Security / dependency review

The online npm result contains zero reported known vulnerabilities for the lockfile-managed graph. It does not audit vendored browser code. PDF imports explicitly disable eval, which is the [Mozilla-documented CVE-2024-4367 mitigation](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq). The [separate 2026 advisory](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j) targets a newer version range. No malicious-PDF exploit was executed or established.
Runtime MetroMap credentials are entered by the user; browser persistence requires opt-in. Reference detail text uses textContent. No full penetration-test, real-provider uptime or historical key-revocation claim is made.

## Prioritised remediation roadmap

### R-01 — Restore current release evidence

Priority: Before production sign-off. Owner: Product owner and maintainers. Acceptance: Pending.

- Update obsolete MetroMap/inspector assertions under separate authorisation.
- Separate desktop Budget functional proof from prohibited mobile/media stages.
- Approve production browser/distribution scope and finish current mandatory-gate sign-off.

### R-02 — Review all remaining data warnings

Priority: Before using the converted operational fixture. Owner: Operational data owner. Acceptance: Pending.

- Review the 57 NSA warnings and record accepted status/funding/catalogue decisions.
- Retain the original; round-trip the reviewed copy.

### R-03 — Align canonical receipt eligibility

Priority: Next bounded logic change. Owner: Product owner and quote maintainer. Acceptance: Pending.

- Confirm regular-payment policy before Issue.
- Align command/UI behavior for Draft, Issued, Accepted, Declined and reversed transactions.

### R-04 — Maintain vendored runtimes and simplify proven CSS overrides

Priority: Planned maintenance. Owner: Maintainers. Acceptance: Not scheduled.

- Inventory vendored versions; assess a compatible PDF runtime upgrade.
- Consolidate one stylesheet/module at a time with DOM/computed-style checks.
- Decide whether explicit reversal-officer attribution is required.

## Integrated workflow results

| Mode | Outcome | Assertions | Completion limit |
| --- | --- | --- | --- |
| NSA | PASS | 19 | Project final completion: NOT TESTED — The promoted Project includes 25 untouched generated checklist tasks. Completion eligibility correctly remains false. The audit does not invent completion evidence for those tasks. |
| EVT | PASS | 19 | Project final completion: NOT TESTED — The promoted Project includes 12 untouched generated checklist tasks. Completion eligibility correctly remains false. The audit does not invent completion evidence for those tasks. |

The model/API trace preserves the same source lineage through an explicit Planner Job, a 09:00–11:00 schedule, $200 Labour plus $30 Material ($253 including tax), a $50 deposit and $203 balance, reversal of both receipts, and a City-funded second revision. Job and Task completion pass; final Project completion is not claimed. This supplement is model/API proof, not an uninterrupted UI walk-through.

## Limits and final decision

- Assessment applies only to the fingerprinted local working tree, including the uncommitted radial fix. Commit identity alone is insufficient.
- Published GitHub Pages, Windows Edge file:// and other deployment artifacts were not assessed. RC-001 documents a local Node HTTP runtime.
- No screenshot, mobile/touch, video or trace was produced. The guard blocked one attempted change to 480px before applying it.
- Real provider uptime/credentials, actual desktop Outlook import, long-session soak behavior, formal assistive-technology conformance and an approved cross-platform release matrix remain unverified.
- The inventory is risk based. Unknown feature/state combinations are not counted as covered; no invented coverage percentage is used.
- Only synthetic data and disposable approved-fixture copies were mutated or deleted in fresh profiles. Operator workspaces and original backups were preserved.
- npm advisory results cover the lockfile graph; vendored libraries need separate review. Historical Git credential revocation was not established.

**UNVERIFIED.** No confirmed product blocker: do not issue NO-GO for stale tests or environmental setup. Missing mandatory proof yields UNVERIFIED.

No deployment or corrective development is authorised by this report. Stop before remediation.
