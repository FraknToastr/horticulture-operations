# Horticulture Applications — Universal Engineering, Testing & Independent Review Standard

**Document ID:** HORT-ENG-TEST-001  
**Version:** 1.1  
**Issued:** 28 September 2026  
**Status:** Reusable project governance standard; project-specific constitutions and approved business rules remain authoritative  
**Applies to:** New development, maintenance, defect correction, UI changes, refactoring, migration, feature additions, integrations and releases of any Horticulture application.  
**Intended users:** Developer agents (including Gemini/Codex), human developers, independent reviewers and release approvers.

> **Primary rule:** A change is not adequately tested simply because the modified function passes its tests. Verify each affected business invariant across all reachable boundaries, the relevant user workflows and the delivered application artifact. Claims must match actual evidence.

---

## 1. Purpose, precedence and scope

This standard provides one repeatable, rigorous testing and review system without assuming a particular application, framework, language, storage engine, interface, hosting model or development-stage nomenclature. It generalises the supplied Stage 1 Review Protocol v2 rather than reproducing its overtime-planner-specific schema, functions, gates or implementation instructions.

**Precedence (highest first):** applicable law and organisational security/privacy requirements; the project's approved constitution and authoritative business/data rules; the approved feature specification and acceptance criteria; this standard; task-specific developer prompts. If two requirements conflict, record the conflict and seek an explicit decision; do not silently weaken a higher-priority rule. This standard never itself authorises scope expansion, destructive resets, migration removal or release.

**Adoption procedure:** create a short `PROJECT_TEST_PROFILE.md` using Appendix A; record the product's supported platforms, critical workflows, business invariants, risk class, build commands, test commands and approved acceptance gates. If no profile exists, use the conservative defaults here and report missing information as a review limitation. Do not invent test results or assume unavailable infrastructure exists.

**Applicable project forms:** standalone/offline HTML, modular vanilla JavaScript, SPA, GIS/MapLibre/ArcGIS tools, browser-storage applications, services/APIs, scripts/Python toolboxes, dashboards, data pipelines, hybrid applications and future architectures. Mark irrelevant controls **N/A with a reason** instead of pretending to test them.

## 2. Non-negotiable engineering and evidence principles

1. **Inspect the submitted revision.** Verify repository contents, actual code, entry points, current requirements and precise changed files. Historical file paths, line numbers and prior review claims are leads, not proof.
2. **Own invariants once.** Each critical business/data rule needs one authoritative owner or an explicitly justified set of policies. Trace it through *every reachable entry point* and downstream consumer.
3. **Validate before mutation.** Reject bad input before any side effects when feasible. For multi-step writes, use transactions or explicit compensating rollback; prove failure atomicity and recovery.
4. **Separate transformations from validation.** A parser, default, migration, normaliser or constructor must not silently make malformed or incomplete authoritative input appear valid. Legitimate first-run defaults and explicit migration are distinct paths.
5. **Preserve authoritative data.** Prove identity, relationships, chronology, provenance and content where applicable. Comparing only counts, row totals or visible UI values is insufficient.
6. **Test real workflows.** Mocks support targeted unit tests but cannot alone prove persistence, import/export, rendering, deployment, external-service integration or recovery.
7. **Prevent false-green tests.** Check every setup precondition; use genuine output bytes for round trips; make assertions on outcomes, not only absence of exceptions. Deliberately break an invariant to confirm a test fails when practical.
8. **Control scope.** A focused change receives proportionate targeted tests and dependency-based regression; a release receives a broader integrated suite. Do not treat unrelated existing failures as silently resolved or automatically expand the change request.
9. **Independent verification.** Developer claims, test logs and screenshots are inputs; an independent reviewer inspects evidence and reproduces risk-critical cases on the submitted artifact.
10. **Truthful gate decisions.** Distinguish `PASS`, `FAIL`, `BLOCKED`, `NOT RUN`, `N/A` and `KNOWN BASELINE FAILURE`. Passing targeted tests does not imply full release readiness.
11. **Small review packages.** Routine peer-review packages contain only changed/necessary files, relevant tests, required built artifacts, an evidence report and manifest. Full source/release bundles appear only at approved milestones.
12. **Improve the test suite as a review deliverable.** Every substantive independent review must assess test quality and coverage, recommend prioritised improvements and, where feasible, supply executable new/revised test files in a separate minimal test-only package. Do not change production code without explicit authorisation. A reasoned inability to supply executable tests must be documented.
13. **Challenge unsafe instructions.** A developer who finds a demonstrable flaw in an implementation prescription submits a narrow documented design challenge instead of improvising a broad redesign.

## 3. Establish a testable change contract before writing code

For every change, the developer records:

| Field | Required content |
|---|---|
| Identity | Change ID, date, project, version/commit and authoritative baseline |
| Intent | Exact approved outcome, excluded work and stop condition |
| Criticality | Risk class (Section 4), affected users/data and plausible failure cost |
| Changed surface | Files, components, schema, API, workflows, persistent state, external integrations |
| Invariants | Rules that must continue to hold, including legitimate exceptions |
| Boundaries | Every input, write, read, export, import, UI and downstream entry point affected |
| Success criteria | Observable positive, negative and failure-recovery behaviours |
| Tests | New/modified tests, existing regression suites and delivery-artifact checks |
| Rollback | How to return safely to the baseline, including data compatibility |
| Evidence | Commands, output, fixture provenance, hashes and environment |

For a UI-only change, the contract still specifies data-affecting controls, keyboard interactions, viewport constraints, persistence of user input and regressions in adjacent screens. For a refactor, baseline behaviour and public interfaces are the acceptance contract; a claim of 'no functional changes' requires evidence.

## 4. Risk-driven test intensity

Risk is assessed by **impact × reach × reversibility**, with additional scrutiny for uncertainty or missing evidence. Choose the highest applicable class; document the justification rather than averaging high-impact and low-impact effects.

| Class | Typical examples | Minimum assurance |
|---|---|---|
| R1 — Low | Isolated copy, visual spacing, non-interactive decoration | Static review, relevant component/UI tests, visual and accessibility smoke, artifact smoke |
| R2 — Moderate | New screen, filters, calculations without authoritative writes, drawing tools | R1 plus focused unit/integration tests, affected-workflow regression, negative/boundary cases, responsive verification |
| R3 — High | Persistence, import/export, roster eligibility, cost calculations, permissions, major refactor, schema change | R2 plus full boundary inventory, rollback/failure injection, property-based or systematic edge cases, independent adversarial verification, representative production-like fixture and exact-byte artifact/round-trip checks where applicable |
| R4 — Critical | Destructive reset, migrations or legacy removal, irreversible data changes, security-sensitive operations, integrated release | R3 plus rehearsed recovery, explicit authorisation, full applicable release suite, reproducible artifact proof, all release gates and independent acceptance |

**Escalation:** classify as R3/R4 whenever corruption could be silent, user data could be lost, an incorrect business outcome could be committed, or a change affects many modules. Increase testing depth when tools, test infrastructure or specifications are unreliable. Lower classification requires an explicit reason and reviewer agreement.

## 5. Invariant and boundary coverage — the core of the regime

A **business invariant** is a condition that must remain true across permitted operations; examples include no duplicate allocations, no unapproved loss of a historical record, an exact cost total, a consistent spatial reference or a recoverable workspace. For every new invariant or modified enforcement rule, record:

- **Definition:** precise rule, allowed exceptions and user-facing consequence.
- **Authority:** owning module/function/schema and authoritative reference.
- **Lifecycle:** create → edit → validate → save → load → import → export → restore → delete/archive → display → external sync (remove N/A stages).
- **Reachable boundaries:** UI commands, keyboard shortcuts, API/service calls, direct repository methods, background jobs, bulk operations, scripts, cross-tab/browser sessions and third-party callbacks.
- **Failure policy:** explicit rejection/quarantine/rollback/retry; observable result; unchanged durable and in-memory state when required.
- **Evidence:** at least one targeted test for each distinct enforcement path plus adversarial cases for bypassable paths.

### 5.1 Boundary inventory template

| Boundary | Entry point/file | Transformation order | Canonical validator | Permitted mutation | Failure behaviour | Test ID | Status |
|---|---|---|---|---|---|---|---|
| New/empty initialisation | *Fill per project* | *…* | *…* | *…* | *…* | *…* | NOT RUN |
| Direct programmatic write | | | | | | | |
| Interactive/UI write | | | | | | | |
| Startup/read | | | | | | | |
| Import/restore | | | | | | | |
| Export/backup | | | | | | | |
| Delete/archive/reset | | | | | | | |
| Downstream consumer/integration | | | | | | | |

Review **all reachable rows**, even where only one implementation method changed. Use `DYNAMICALLY VERIFIED`, `SOURCE-VERIFIED`, `NOT VERIFIED` or `N/A`, with distinct meanings. Source inspection is not a substitute for execution.

### 5.2 Standard adversarial input matrix

Apply combinations relevant to the domain: explicit valid empty, realistic populated, omitted, null, wrong type, partial, duplicate, malformed, corrupt/truncated, out-of-range, stale version, contradictory fields, maliciously large, unknown field, encoding variation, timezone/daylight-saving edge and valid legacy data **only where migration is supported**. Check the result at every independent entry point, including direct calls that bypass the UI. For writes or rejected restores, compare prior persisted **bytes** (or database state/hash) and prior runtime state, not just return values.

### 5.3 Data-preservation matrix

Assert preservation of each critical **ID/key, relationship, field, order where material, timestamp, version, source/provenance and historical audit record**. Check both *missing* and *unexpected additional* records. Authorised deletion, retention policies and legitimate full replacement must remain possible and be tested as positive cases; do not impose blanket immutability that breaks valid work.

## 6. Test layers and execution policy

Run the smallest credible test set for each iteration, expanding on actual dependencies and risk. Never use test-count inflation as an assurance proxy.

| Layer | What it proves | Standard evidence |
|---|---|---|
| 0. Static/security | Syntax, lint/types, dependency integrity, dangerous patterns, secrets and boundary inventory | Exact command + result + inspected paths |
| 1. Unit/contract | Pure functions, calculations, validators, dates, geospatial transforms, normalisation | Positive/negative/edge assertions and invariant ownership |
| 2. Integration | UI-to-state, service-to-database, persistence, import/export, migration, recovery | Real integration paths, failure injection and state comparisons |
| 3. End-to-end | A complete user task through actual delivery artifact | Reproducible steps, environment and observed results |
| 4. Non-functional | Accessibility, responsiveness, performance, memory, offline, security and browser compatibility | Thresholds, repeatable scenarios, measured data |
| 5. Release | All supported workflows, build, distribution, recovery and deployment | Clean build, full applicable suite, manifests, independent sign-off |

**Run selection:** Every change gets Layer 0 and the narrowest relevant Layer 1–3 checks. R3/R4 changes require the entire affected invariant matrix and relevant Layer 4. A formal release requires all applicable layers. Where no automation exists, use documented manual procedures with captured evidence and record a test-automation debt item; never call manual inspection automated coverage.

### 6.1 Minimum test-case structure

Each test states `ID`, invariant/requirement, setup, fixture origin, precondition assertions, exact operation, expected result, postcondition assertions, teardown and affected environment. Prefer deterministic fixtures, stable clocks, controlled random seeds and isolated storage. Reset fixtures *between* cases. Avoid order-dependent test suites; prove cases are independently reproducible.

### 6.2 False-green prevention

A round-trip test MUST save successfully, export via the actual exporter, retain the exact exported bytes, change or clear the target state, import/restore those exact bytes through the real entry point and validate affected fields, identity sets and storage state. It MUST NOT silently reconstruct expected JSON instead of exercising the exported artifact. All setup calls must assert success before the operation under test. A test that throws before its intended assertion has **failed**, not verified the target. Where safe, mutate a validator or corrupt the fixture once and confirm the test becomes red.

### 6.3 Test isolation and reproducibility

Record runtime versions, OS/browser, relevant feature flags, timezone/locale, dependency lockfile, test commands and expected fixtures. Mock unstable external dependencies for deterministic unit tests; also perform contract/live integration checks using a safe environment when integration behaviour matters. Never run destructive tests against production or real operational records. Redact employee, customer, credential and location-sensitive records; use synthetic or explicitly approved de-identified data.

## 7. Mandatory regression families — select by affected surface

The project profile must map each supported family to actual tests and owner. `N/A` requires a justification. The families below are a **catalogue**, not permission to run all costly suites on every small patch.

| Family | Required checks when relevant |
|---|---|
| Business rules/calculations | Correct formulas, rounding, units, limits, eligibility, exceptions, deterministic ordering and conflicting instructions |
| Identity/reference integrity | Unique IDs; missing/deleted references; parent-child relationships; orphan prevention; stable identity through edits and export |
| Persistence | First-run empty state; create/edit/save/reload; versioning; quota or unavailable storage; write interruption; safe retry |
| Import/export/backup | Valid/invalid files; exact-byte round trip; malicious ZIP/path traversal checks; missing fields; duplicate detection; fidelity and recovery |
| Multi-step mutation | Atomic write/rollback, idempotency, partial failure, concurrency and recovery after interrupted operations |
| Scheduling/time | Weekends/public holidays; cross-midnight intervals; overlapping commitments; DST and timezone edges; deterministic recurrence |
| Workforce/rostering | Eligibility, rest periods, fairness policy as *specified*, exclusive/pooled assignments, manual override and provenance |
| Financial/quotation | Quantity × rate, GST if applicable, rounding consistency, funding gap, stale source values and totals across UI/PDF/exports |
| Maps/spatial | CRS, transformations, lat/lon order, geometry validity, length/area units, drawing/editing, annotation visibility, geocoding and basemap failure |
| Data pipelines/APIs | Pagination, rate limits, partial results, schema drift, retries/backoff, deduplication, record counts **and keys**, error exposure |
| Search/filter/table | Accurate counts, sort stability, cascading filters, blanks, pagination/virtualisation and large-data performance |
| UI/navigation | Primary journeys, focus and keyboard operation, dialogs/drawers, route state, destructive-action confirmation, saved state |
| Visual/responsive | Supported desktop/mobile widths, overflow/truncation, buttons, sticky panels, zoom, high-DPI and browser font differences |
| Offline/PWA | First-launch prerequisites, no unintended network dependency, cached assets, offline reload, recovery after storage wipe |
| Access/security/privacy | Input validation, injection/XSS, authorisation, CSRF if relevant, safe errors, secret leakage, exported PII and retention |
| Performance/reliability | Large representative data, memory growth, freeze thresholds, repeat operations, latency budget, long-running operations |
| Accessibility | Keyboard-only, visible focus, labels, semantics, contrast, zoom/reflow, screen-reader announcements where relevant |
| Packaging/deployment | Clean build, included assets, no missing imports/CDNs, hash consistency, startup/upgrade/rollback and version labels |

## 8. UI and browser acceptance protocol

For every touched screen or shared UI component:

1. Validate the **actual delivered build** and primary path, not only source components or a mock page.
2. Compare before/after at agreed desktop and mobile viewports, including narrow widths, browser zoom and long real-world labels. Prefer automated visual diffs with reviewed baselines, not blind snapshot acceptance.
3. Exercise mouse, keyboard and touch interactions as applicable; test focus return for dialogs, scrolling, drawer conflicts, navigation and validation errors.
4. Check no horizontal overflow, clipped controls, inaccessible buttons, accidental overlaps, unreadable truncation, broken responsive rearrangements or false-empty states.
5. Verify formatting/data parity between UI, calculated state, saved state and printable/exported representations.
6. Run affected adjacent-page workflows and shared-component regression, even for changes labelled cosmetic.

For a standalone/offline artifact: open it directly in the advertised environment with network blocked; validate all bundled CSS/JS/fonts/images and dependencies; compare build versions/hashes where multiple distribution variants claim equivalence. Do not assert equivalence simply because two source entry points look similar.

## 9. Failure injection, resilience, security and privacy

**Failure injection (where applicable):** force storage rejection/full quota, failed writes, partial API response, lost network, delayed request, invalid token, schema mismatch, corrupted import, interrupted background operation, stale browser tab or version mismatch. Assert surfaced error, no silent loss, correct recovery and truthful UI state. A successful retry must not duplicate committed work.

**Security/privacy:** scan changed files and packaged documentation for credentials, tokens, secrets and real personal information; verify `.env`/local settings excluded from packages; sanitise imported text and rendered markup; validate uploaded file names/types/sizes and ZIP paths; audit logs and backups for sensitive content. A claim of privacy clearance requires inspecting *all included files*, including archived documentation, tests and screenshots, not only new source files.

**Recovery:** distinguish runtime recovery, browser-storage restoration, database rollback and deployment rollback. Test each one that the project promises. Destructive reset or legacy removal requires approval, backup/recovery rehearsal where relevant, proof of an actually clean first run and proof that deprecated code/data are absent from the **delivered** artifact.

## 10. Performance and non-functional budgets

Record measurable project-specific budgets before acceptance; do not invent universal limits. At minimum specify representative dataset sizes, supported browsers/devices, initial load time, key action latency, memory/high-water behaviour, export/import time, large-table interaction and offline startup where applicable. Collect baseline and changed-revision measurements in the **same** environment. Record number of iterations, warm/cold status and variance; investigate regressions beyond the approved budget. A single fast run is not proof of stable performance.

## 11. Change-specific test planning and dependency analysis

Before implementing, generate a **change impact map** from changed files/functions → callers → canonical invariants → state/persistence → UI/export surfaces → applicable suites. Classify each test family:

- `MANDATORY`: directly affected critical invariant or contractual boundary.
- `DEPENDENCY`: consumer plausibly affected by the change.
- `RELEASE ONLY`: broad regression deferred until an approved integrated release.
- `N/A`: not reachable from this change, with explicit reason.

Refactors need before/after behavioural parity for supported APIs and representative fixtures. A module extraction should also verify load order, dependencies, global namespace behaviour, no circular imports, no duplicate listeners or shared-state divergence, and identical delivered standalone builds where promised. A UI-only change requires adjacent flows and storage assertions for modified forms. A new feature requires contract tests, negative/error cases and tests for interaction with existing features.

## 12. Formal quality gates and stop rules

Gate names are **roles**, not a mandated project stage order. Map them onto the project's authorised phases.

| Gate | Entry evidence | Exit condition |
|---|---|---|
| G0 — Baseline | Approved scope; exact original artifact/commit; known defects; runnable environment | Baseline recorded and affected rules located |
| G1 — Design/impact | Change contract; invariant/boundary inventory; threats, test plan and rollback plan | Coverage planned; unresolved material design conflicts escalated |
| G2 — Developer verification | Patch; focused tests; build; logs; changed-file inventory | No new blocking focused failure; claims supported; no out-of-scope modification |
| G3 — Independent review | Submitted package; reproducible instructions; exact test evidence | Reviewer reproduces critical cases; classifies all findings; delivers assessment report, prioritised test improvement plan and verified executable test changes where feasible; required gate-blocking corrections made |
| G4 — Integrated release | Approved feature gates; complete artifact; release suite; privacy/security and recovery checks | All release blockers closed, formally accepted baseline exceptions recorded, rollback feasible |
| G5 — Post-release (where applicable) | Deployment record and monitoring plan | Smoke checks, anomaly response and rollback/escalation ownership documented |

**Stop immediately** for suspected silent data loss, incorrect high-impact allocation or financial calculation, unapproved destructive operations, exposed secrets/personal information, misleading tests/evidence, irreproducible release artifact or a material contradiction in the proposed design. Preserve evidence and return a targeted challenge or blocking finding; do not continue to a new stage by implication.

### 12.1 Gate verdict vocabulary

- `ACCEPTED`: all mandatory criteria evidenced for *this named gate*; does not approve the whole product.
- `ACCEPTED WITH EXPLICIT NON-BLOCKING ITEMS`: no gate blocker; deferred items recorded with owner and destination gate.
- `NOT ACCEPTED`: one or more verified blockers; enumerate exact closure requirements.
- `INCONCLUSIVE`: missing/broken evidence prevents a reliable verdict. Distinguish from code failure.

No percentage, grade or subjective confidence score substitutes for the explicit criteria and test inventory.

## 13. Independent reviewer method — three passes

**Pass A — static contract and artifact integrity:** validate archive paths, ZIP integrity, file manifest, claimed baseline, actual diff and build reproducibility. Inspect canonical invariants, all affected boundaries, validation order, bypasses, legitimate exceptions, changed test fixtures, third-party code and personal-data exposure. Compare required standalone distributions with submitted builds and hashes. Inspect actual content, not merely folder names or a passing manifest. Classify prior blocking findings one by one as resolved globally, partly resolved, unresolved or invalidated by new evidence.

**Pass B — focused adversarial execution:** run clean installation/build and selected suites, execute real boundary operations using small shared fixtures, perform critical negative/failure cases, verify byte/state preservation on rejection, rerun affected existing workflows and verify the delivered artifact. Expand to broader tests only if dependencies, failures or risk justify it. Record exact commands, environment, fixture hash, exit codes, failed assertions and unexpected effects. A test suite that aborts before required assertions yields `NOT VERIFIED`, not `PASS`.

**Pass C — test-suite audit and constructive improvement:** assess coverage against the actual invariant/boundary matrix, inspect fixture validity and existing assertions, identify false-green opportunities, design missing positive/negative/edge/failure/recovery tests and deliver executable additions or updates as specified in Section 17A. Verify each proposed test against the submitted baseline and document its expected current outcome. Do not disguise a reproduction test failing on defective production code as an invalid test.

**Reviewer independence:** where possible use a separate session/agent/environment and do not ask the implementing developer to grade their own fixes as independent. Reviewer must clearly distinguish *personally executed*, *source-confirmed*, *developer-reported* and *not tested*.

## 14. Finding triage, anti-recurrence and corrective instructions

Each finding is **one root cause**, not one row per symptom. Include unique ID, severity, current file/line/function, applicable invariant, exact reproduction or source trace, expected vs actual, user/data impact, other reachable boundaries, fix prescription, necessary tests and owner gate. Distinguish a new regression from a pre-existing baseline failure and from a new manifestation of an unresolved root cause.

**Severity:** `BLOCKER` (data loss/corruption, severe security exposure, invalid core outcome or invalid acceptance evidence); `HIGH` (material workflow/integrity defect); `MEDIUM` (limited correctness, resilience, accessibility or maintainability defect); `LOW` (minor non-critical issue). Gate blocking depends on the gate's approved invariants and risk, not on labels alone.

**Anti-recurrence trigger:** if substantially the same defect category is found in two successive revisions, stop issuing isolated single-function repair requests. Require a complete boundary inventory, one shared contract, coordinated edits to every reachable call site and one coherent regression suite. A third isolated patch without a documented architectural reason is not acceptable.

**Deferral:** unrelated issues are tracked, not automatically dragged into the current change. They become immediate blockers only if they invalidate a current gate criterion, cause credible critical harm, or undermine relied-upon test evidence. Keep a baseline/deferral ledger with ticket, first-observed revision, reproducibility, severity, owner, due gate and risk acceptance.

## 15. Developer design-challenge protocol

A developer must issue `DESIGN_CHALLENGE.md` when an instruction conflicts with the **current** repository, an authoritative invariant or safe architecture, or when a smaller demonstrably equivalent design is available. Include `CHALLENGE-ID`; precise challenged instruction; current code and call-path evidence; minimal alternative (patch or pseudocode); effects on other entry points; invariant-preservation argument; test delta; risk; and the specific decision required. **Stop only the affected work** until that issue is decided. Do not substitute an unapproved redesign or begin subsequent gates. Avoid challenges based solely on preferred style.

## 16. Artifact packaging and evidence provenance

### 16.1 Routine peer-review package (minimal by default)

Include only genuinely changed source, directly relevant new/modified tests, affected built delivery artifacts where required, focused change/evidence report, manifest/hash file, reproducibility instructions and a targeted challenge (if any). Include unchanged contextual files **only if independently necessary** to execute/review and label them unchanged. Omit historical archives, unrelated tests, private credentials, real staff data, caches, node_modules and large vendor trees unless specifically necessary and approved. Never include a whole repository merely to avoid identifying the actual change.

### 16.2 Full integration/release package (approved milestones only)

Include all runtime assets, exact supported distribution builds, required licence notices, complete current project governance and docs, installation/rollback instructions, compatibility statement, SBOM/dependency manifest where appropriate, test summary, security/privacy sign-off and full file checksums. Test archive extraction, clean install, offline startup and asset completeness. Verify manifest entries against the **actual included archive bytes**, not only the developer workspace.

### 16.3 Evidence hierarchy

1. Reviewer-reproduced tests on the submitted artifact.
2. Reviewer-verified source trace and independently reproduced build/hash.
3. Trustworthy automated output from the exact submitted revision.
4. Developer-provided logs/videos/screenshots with reproducible steps.
5. Narrative assertions without reproducible evidence.

Do not describe (3)–(5) as independent proof. Preserve failure logs; do not edit outputs to present a clean story. Report the **actual command and exit code**, including unexpected aborts. Screenshots support visual findings but do not prove hidden persistence behaviour.

## 17. Standard test evidence and review-report format

Each review report must contain the following in this order:

1. **Verdict and scope:** named gate, precise baseline and changed revision, `ACCEPTED`/`NOT ACCEPTED`/`INCONCLUSIVE`, limited to that gate.
2. **Artifact integrity:** package contents, unexpected files, path safety, version/manifest, relevant hashes and build parity.
3. **Change and impact inventory:** actual modified files, invariants, direct/indirect consumers and out-of-scope changes.
4. **Boundary coverage matrix:** every affected boundary; observed validation, mutation, failure behaviour and verification level.
5. **Evidence ledger:** exact tests/commands, runner exit codes, setup validity, environment, positive/negative cases, artifacts and pass/fail/not-run totals.
6. **Findings:** root-cause grouping, severity, file/line, reproducible evidence, operational impact, fix prescription and owner gate.
7. **Historical blocking findings:** status and evidence for each carry-over item; explicit baseline exceptions.
8. **Non-functional and privacy results:** only applicable controls, including any unverified items.
9. **Test-suite health and improvement plan:** coverage gaps, weak/duplicate/flaky tests, fixture risks, recommended suites, priority, mapped requirements, files to add/update and acceptance tests.
10. **Test changes and verification:** attached test-only package or justified exception; file manifests, exact commands and expected outcomes on current and corrected builds; independent mutation/sensitivity evidence where feasible.
11. **Residual risk and gate criteria:** what is proven, unproven and deferred; explicit closure conditions.
12. **Next handoff:** one consolidated, prescriptive corrective prompt if blocked; otherwise next authorised gate's *entry conditions*, not unauthorised work.

### 17.1 Evidence ledger template

| Test ID | Required behaviour | Layer | Method | Environment/fixture | Command/steps | Observed outcome | Status | Evidence ref |
|---|---|---|---|---|---|---|---|---|
| EX-001 | *Replace* | Integration | Automated | *…* | *…* | *…* | NOT RUN | *…* |

### 17.2 Finding template

```text
ID: <project>-<gate>-F01
Severity: BLOCKER | HIGH | MEDIUM | LOW
Invariant/requirement:
Current revision, file/function/lines:
Reproduction or complete source trace:
Expected / actual:
Data/user/security consequence:
Other reachable boundaries affected:
Previously known? New regression | Existing baseline | Recurrent root cause
Prescriptive correction and legitimate behaviours to preserve:
Required positive, negative and rollback regression tests:
Owner / closure gate:
Evidence references:
```

## 17A. Mandatory reviewer-generated test improvements and executable test artifacts

This section applies to **every substantive independent review** (functional, architectural, persistence, security, data, integration or release) and to focused UI reviews when automated regression tests are feasible. A documentation-only or trivially cosmetic review may mark executable test delivery `N/A`, with a specific reason. Recommendations alone are not sufficient when feasible executable tests can be prepared. This section does not authorise modifying the application or expanding the approved feature scope.

### 17A.1 Three required outputs

**A. `INDEPENDENT_REVIEW_ASSESSMENT.md` — assessment report.** Include every Section 17 item, precise revision and gate, a test-suite-health subsection and a line-item distinction among reviewer-executed, reviewer-authored, source-inspected and developer-reported evidence. For each gap, show the business requirement/invariant, affected boundary, missing or unreliable assertion and practical consequence. Report failing tests as defects, fixture problems, environmental blocks or intended red tests with evidence; do not merge these categories.

**B. `TEST_IMPROVEMENT_PLAN.md` — prioritised actionable recommendations.** Supply a table with `Test ID | Requirement/invariant | Boundary | Gap/risk | Proposed test and exact assertion | Test level | Priority | New/updated file | Fixture/data | Execution command | Acceptance condition | Status`. Prioritise **P0** (critical incorrect outcome, data loss, security or false-green gate), **P1** (affected core workflow or high-risk missing regression), **P2** (valuable reliability/maintainability), **P3** (optional optimisation). Distinguish `IMPLEMENTED IN ATTACHED TESTS`, `RECOMMENDED ONLY`, `BLOCKED` and `N/A`; explain any P0/P1 recommendation lacking an executable test.

**C. A separate minimal `REVIEWER_TEST_PATCH.zip` where feasible.** Include only new or changed test source (for example `.cjs`, `.js`, `.mjs`, `.ts`, `.py`), necessary synthetic fixtures/test helpers, a patch manifest, commands and a `TEST_PATCH_VERIFICATION.md`. Do not bundle unrelated production modules, historical documents, existing unmodified suites, secrets or actual staff/customer records. If an unchanged helper is essential to run the tests, name and justify it explicitly. Include portable unified diffs or documented replacement paths for changed existing tests when useful. Never overwrite the project's existing files in place without authorisation; test changes are reviewer proposals until integrated by the developer.

### 17A.2 Test patch construction rules

1. **Inspect first:** use the submitted actual source, current test runner, imports, module format, fixtures and package scripts. Respect each project's toolchain; do not impose `.cjs` where the project uses another format or produce speculative files that cannot be executed.
2. **Traceability:** assign stable IDs and map each proposed test to a precise invariant, boundary and identified risk. Include tests for legitimate behaviours alongside rejection paths; avoid tests that merely freeze implementation quirks.
3. **Meaningful assertions:** validate setup preconditions and resulting state, full identity/relationship integrity where applicable, user-visible result and durable bytes for import/export or persistence. Include clear failure messages and deterministic isolation/cleanup.
4. **Adversarial coverage:** choose relevant boundary values, malformed and stale inputs, bypasses, cross-feature interactions, rollback/failure injection, restart and round-trip cases. Use synthetic data and documented timezones/clock control.
5. **Sensitivity proof:** where practical, demonstrate that a new test fails when its target invariant is deliberately violated (temporary mutation, controlled faulty fixture or known defective baseline) and passes against a corrected or independently valid reference. Revert temporary mutations; never package deliberately corrupted application source.
6. **Baseline outcomes:** new regression tests may be **RED ON SUBMITTED BUILD** if they reproduce a verified defect; mark them `INTENDED RED` with the observed assertion and specify precisely what change will make them pass. `GREEN ON SUBMITTED BUILD` does not establish sensitivity without adequate assertions. `BLOCKED/NOT RUN` is never represented as green.
7. **Isolation:** reviewer test files must not write to live/production databases, send real notifications, perform destructive resets or depend on hidden credentials. Use mock, sandbox or clearly designated synthetic test environments; call out any missing prerequisite.
8. **No silent production patch:** the reviewer may suggest narrowly scoped implementation corrections in the report, but production changes require the approved developer workstream. Do not modify existing test expectations just to turn a genuine product failure green.
9. **No invented verification:** when runtime, dependencies, service access or build tooling are unavailable, include syntactically reviewed test files if feasible, exact proposed commands and explicit `UNVERIFIED` status with blockers. Never claim they execute successfully.
10. **Repeat review:** on subsequent submissions, re-run prior reviewer-authored tests, confirm integration or provide a precise reconciliation if a test was rejected or replaced, and look for the same root cause across other reachable boundaries.

### 17A.3 Verification report and acceptance criteria

For **each** attached test file, `TEST_PATCH_VERIFICATION.md` must record its path and SHA-256, change type (`NEW`/`MODIFIED`), test IDs, runner/environment/version, fixture provenance, exact execution command, exit code, assertion count where measurable and observed status (`PASS`, `INTENDED RED`, `FAIL—TEST DEFECT`, `BLOCKED`, `NOT RUN`). Add sensitivity evidence and the intended post-fix outcome. Test failure caused by a genuine unresolved application defect is evidence of the defect, not a reason to weaken the test. A reviewer cannot claim a fully verified test patch if any required test is blocked or not run; say which parts are verified.

Gate G3 **test-deliverable check:** The report and improvement plan are mandatory. An executable test patch is mandatory **where feasible** for a verified P0/P1 gap, recurrence or missing affected-invariant coverage; otherwise justify infeasibility per item and give an exact implementation-ready test specification. Approval of a review gate does not require intentionally red defect-reproduction tests to pass on the defective baseline; closure of the corresponding defect requires the tests to pass on the corrected revision. Do not conflate test-patch delivery with authority to proceed to a later project stage.

**Suggested review package structure:**

```text
review-output/
  INDEPENDENT_REVIEW_ASSESSMENT.md
  TEST_IMPROVEMENT_PLAN.md
  REVIEWER_TEST_PATCH.zip             # if executable updates are feasible
  TEST_PATCH_VERIFICATION.md
  MANIFEST.sha256.txt

REVIEWER_TEST_PATCH.zip (contents)
  tests/<relevant new or modified test files>
  tests/fixtures/<synthetic fixtures only, if needed>
  TEST_PATCH_README.md               # apply/run instructions and prerequisites
  TEST_PATCH_MANIFEST.sha256.txt
```

For a review with no needed test changes, record **NO TEST CHANGES REQUIRED** and justify it using the boundary matrix, assertions inspected and tests reproduced; still deliver the assessment and improvement plan (the latter may record no outstanding recommendations). Do not create meaningless test files just to fulfil a packaging requirement.

### 17A.4 Example recommendation-to-test traceability

| Finding | Recommendation | Executable deliverable | Evidence expected |
|---|---|---|---|
| Rejected import changes stored records | P0: prove rejected import is atomic at every import boundary | `tests/import-atomicity.test.cjs` plus synthetic corrupt fixture, when project uses Node CJS | Pre-state IDs/content vs post-state IDs/content; intentional red on defective baseline; green after correction |
| Roster eligibility lacks cross-day recovery checks | P1: test overnight availability and rest with a controlled clock | Existing eligibility suite updated or new relevant runner-native test | Legitimate allocation passes; boundary violation fails; mutation/sensitivity demonstration |
| Dialog change clips mobile primary action | P1/P2 by impact: test interactive control access at supported viewport | Browser automation or documented manual script if UI automation is unavailable | Exact device/viewport, screenshots, keyboard/touch reachability, result recorded |

## 18. Release acceptance checklist

The release approver records `PASS`, `FAIL`, `BLOCKED` or `N/A (reason)` for each item. **Every applicable item must be resolved** before an unqualified release decision; deviations require explicit documented risk acceptance by the authorised owner.

- [ ] Exact source baseline, scope, approved requirements and user workflows are identified.
- [ ] All critical invariants have an owner and complete applicable boundary matrix.
- [ ] All blocking findings and regression defects are closed with independently verified evidence.
- [ ] Unit, integration and end-to-end tests pass for supported critical journeys; incomplete suites are disclosed.
- [ ] Negative inputs, failure injection, transactional recovery and backup/restore pass where applicable.
- [ ] All supported devices/browsers and offline behaviours are verified on the actual deliverable.
- [ ] Representative data/performance budgets, accessibility and security/privacy acceptance are met.
- [ ] New build is reproducible; package, manifests, hashes and required assets are verified.
- [ ] No sensitive content or unauthorised personal information remains in *any* packaged file.
- [ ] Upgrade, fresh start and rollback/destructive reset paths are rehearsed as applicable.
- [ ] Known baseline failures and consciously accepted residual risks have owners and dates/gates.
- [ ] Independent reviewer supplies assessment report, prioritised test improvement plan and verified reviewer test patch where feasible; new affected-invariant regression tests are integrated or tracked with approved disposition.
- [ ] Independent reviewer and release authority record explicit named-gate decisions.

---

# Appendices — copy/paste operating templates

## Appendix A — `PROJECT_TEST_PROFILE.md` (complete once per application)

```markdown
# <Application> — Test Profile
Project/version/owner:
Canonical requirements and constitution:
Risk class and reason:
Supported architecture/runtime and operating modes:
Supported devices, browsers, OS, accessibility target:
Authoritative data stores, schema versions and permitted migrations:
Critical business invariants (IDs + descriptions + owners):
Critical user journeys (IDs + steps + expected outcomes):
External APIs, services and failure modes:
Supported import/export/backup and recovery paths:
Offline guarantee (if any):
Representative datasets / synthetic fixtures:
Build/test/lint/typecheck commands:
Affected test suite map and release-suite command:
Performance, memory and accessibility budgets:
Security/privacy requirements and approved test data:
Approved review/release gates and decision owners:
Known baseline failures, deferred issues and constraints:
Approved test-runner languages/file conventions (e.g., CJS, ESM, pytest):
Reviewer test-patch integration owner, approval path and CI command:
Package/distribution format and source-to-build parity rules:
```

## Appendix B — reusable developer instruction (paste into any change request)

```text
Apply HORT-ENG-TEST-001 to this change and the current PROJECT_TEST_PROFILE.md.

1. Inspect the actual supplied baseline and approved project constitution; do not rely on historical function names or previous reviews. Record exact change scope, exclusions, invariant owners and a boundary/caller map.
2. Assign risk class. State positive, negative, boundary, failure-injection, legitimate-exception and recovery acceptance cases BEFORE implementation. Identify dependency regressions and actual delivered artifacts.
3. Implement the smallest coherent fix across ALL reachable boundaries of each affected invariant. Validate before mutation; preserve authoritative data, legitimate operations, scope and stable interfaces. Challenge materially unsafe or mismatched implementation instructions using DESIGN_CHALLENGE.md rather than inventing a replacement architecture.
4. Add or update deterministic tests using actual public methods and true round-trip bytes where applicable. Assert setup success, failed-write atomicity, relevant identity sets and downstream user-visible results. Do not create superficial assertion-free tests or accept false-green setup failures.
5. Run static checks, focused unit/integration tests, affected workflow and dependency regressions, security/privacy checks and relevant artifact/UI/offline checks. Expand based on risk. Never claim a suite ran if it did not.
6. Produce a focused CHANGE_AND_TEST_EVIDENCE.md containing exact baseline, file diff, boundary matrix, commands and exit codes, fixture details, all failures, remaining limitations, build hashes, regression impact and explicit requested gate acceptance criteria.
7. Package only actually changed and review-essential files for an incremental review; include required affected build artifacts, relevant tests, evidence report and checksum manifest. Do not start another gate or include an entire release package unless authorised.
STOP if data loss, unsafe instructions, privacy leakage, misleading fixtures or material architectural contradictions are discovered. Provide a targeted challenge or blocking report.
```

## Appendix C — reusable independent peer-review instruction

```text
Perform an INDEPENDENT review of the exact submitted package using HORT-ENG-TEST-001 and the project's test profile. Do not infer success from developer narrative, older review line numbers or green test counts.

PASS A: inspect archive and actual changed source; validate manifest, exact baseline, current business invariants, all reachable affected boundaries, mutation/validation ordering, previous blockers, legitimate exceptions, test fixture construction and privacy across EVERY included file. Check actual built artifact(s), source-to-build consistency and scope control.

PASS B: execute the smallest credible focused suite, then adversarial real-boundary tests, negative input, relevant failure/rollback tests, true export-byte round trips, affected user journeys, UI/offline/integration checks and dependency regressions. Run the full applicable suite only at an approved integration/release gate or where material risks justify expansion. Record tests NOT RUN, unexpectedly aborted and known baseline failures separately.

PASS C: audit the existing tests for missing boundary coverage, weak assertions, unsafe/false-green fixtures, flaky behaviour and unreproduced claims. Write prioritised TEST_IMPROVEMENT_PLAN.md. Where feasible, CREATE updated/new runnable test files native to this repository (including .cjs when applicable), provide a minimal separate REVIEWER_TEST_PATCH.zip and TEST_PATCH_VERIFICATION.md with exact commands and verified outcomes. Prove test sensitivity when practical. Keep production code unchanged. Explain any required test you cannot implement or run.

REPORT: issue an explicit verdict for the NAMED gate only; provide integrity/diff evidence, invariant-by-boundary verification status, exact test commands and outcomes, root-cause findings with line references and proof, carry-over finding status, residual risks, and objective closure criteria. If corrections are required, generate ONE consolidated and prescriptive developer prompt that fixes the complete relevant boundary surface without scope drift. Never label the whole product release-ready on the strength of a focused gate.
```

## Appendix D — mandatory change-evidence file skeleton

```markdown
# <Application> — <Change ID> — Change and Test Evidence
Baseline / submitted commit or package hash:
Approved scope / exclusions / requested gate:
Risk classification:
Changed file inventory (changed / generated / unchanged context):
Invariant ownership and affected boundary matrix:
Positive + negative + failure + recovery test IDs:
Environment, versions, flags, timezone and fixture origin/hash:
Commands executed and literal exit codes:
Test result table (pass/fail/blocked/not-run/N/A):
Known baseline failures / prior blockers (each explicitly reconciled):
Reviewer test improvement recommendations and integration status:
New/updated regression test IDs, locations and verification outcomes:
Adversarial checks and observed persisted/runtime state:
UI, offline, performance, security/privacy results (if applicable):
Build and submitted artifact hashes / asset completeness:
Scope deviations, unresolved issues, limitations and rollback:
Requested named-gate acceptance criteria and developer declaration:
```

## Appendix E — example cross-project acceptance scenarios

These are **adaptable patterns**, not claims about a specific Horticulture application.

| Example feature | Positive proof | Negative/adversarial proof | Recovery/integrity proof |
|---|---|---|---|
| Overtime allocation | Approved eligible assignment persists and appears in planner | Overlap/rest-rule breach and unsupported worker rejected | Failed allocation leaves roster and audit history unchanged |
| Quote builder | Line calculations, funding totals and print/export agree | Missing rate, invalid quantity and stale catalogue handled | Failed save/export does not silently lose quote edits |
| Horticulture register | Project links and notes survive save/reload | Orphan IDs, duplicate records and malformed import rejected | Genuine backup restores exact IDs/relationships into clean state |
| Spatial drawing tool | CRS-correct polygon/line metrics and toggles | Invalid geometry, malformed KML/KMZ and reversed coordinates handled | Basemap/API outage leaves user drawings intact; offline guarantees respected |
| Asset/data dashboard | Filters and aggregations match source by key | Missing columns, duplicate IDs, partial API pages handled | Import abort preserves previous valid dataset; large data remain responsive |
| Shared UI refactor | Same user workflows, keyboard operation and responsive fit | Long labels, small screen, dialog overlap and partial form input | Build loads with promised dependencies bundled; no state loss |

---

## Appendix F — reusable instruction to commission a review with test-file outputs

```text
Independently review the submitted application revision under HORT-ENG-TEST-001 v1.1 and the current PROJECT_TEST_PROFILE.md. Use the exact package contents, approved invariants, current test runner and authorised gate; do not assume historical reviews are accurate.

Deliver (1) INDEPENDENT_REVIEW_ASSESSMENT.md, (2) TEST_IMPROVEMENT_PLAN.md with actionable, P0–P3 prioritised recommendations and exact assertions, and (3) where feasible, a minimal REVIEWER_TEST_PATCH.zip containing actual new or updated executable tests in this project's native language/framework (e.g., .cjs) and necessary synthetic fixtures only, with TEST_PATCH_VERIFICATION.md and SHA-256 manifests.

For each added test, map it to a requirement and boundary; prove fixture setup and meaningful assertions; run it on the supplied revision and record the real exit code and status. Where a verified defect exists, an INTENDED RED test is acceptable and should show the required post-fix behaviour. Demonstrate test sensitivity where practical. Never change production source, conceal failing tests or claim unrun tests passed. Give a specific reason and implementation-ready specification for any P0/P1 test that cannot be supplied. Keep review/test packages minimal, reconcile earlier findings and issue a verdict for the named gate only; do not authorise another stage.
```

---

**Version 1.1 change record (28 September 2026):** Adds mandatory reviewer-authored test-suite improvement analysis, prioritised recommendations, executable test-only patch deliverables where feasible, test sensitivity/verification evidence, corresponding gate acceptance conditions and a reusable review commissioning prompt. Previous requirements remain in force.

**Maintenance rule:** version this standard deliberately. A project may add stricter controls through its profile/constitution; weakening a control requires explicit documented authorisation. Reassess this standard after a major escaped defect or repeated false-green review, updating the *root-cause control*, not merely adding another isolated test.
