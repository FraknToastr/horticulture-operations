# CODEX — HORTICULTURE OPERATIONS RELEASE-READINESS AUDIT

## 1. Mission

Conduct a comprehensive, independent, evidence-based release-readiness assessment of the **Horticulture Operations** application, covering both operating modes:

- **NSA:** Nature Strip Applications
- **EVT:** Event Space Remediation

The scope is the NSA/EVT application launched from `src/index.html`, its NSA and EVT entrypoints, and their required shared runtime, assets, fixtures and tests. Discover and name the seven modules in the scope inventory.

Exclude the independent Overtime application, its dependencies, tests and constitutional framework, and unrelated applications accessible from the launcher. Do not import their requirements into NSA/EVT or run their test regimes.

Your objective is to determine whether the application is sufficiently complete, reliable, consistent, maintainable and safe for production use.

Approach this assignment as a senior software quality engineer, systems architect, security reviewer and independent release auditor.

**This is an assessment exercise, not a development exercise. Do not modify application code, configuration, schemas, governance documents or existing tests without explicit authorisation.**

Do not assume that previous development milestones, successful peer reviews or acceptance claims establish production readiness.

Verify independently.

## 2. Establish the Authoritative Baseline

Before testing, examine the repository and identify:

1. Project constitution and governance framework.
2. Architecture documentation and technical specifications.
3. Functional requirements and accepted design decisions.
4. Existing tests, acceptance criteria and quality gates.
5. Relevant development history, issue registers and known defects.
6. Build, deployment and runtime requirements.
7. Current branch, commit, upstream and working-tree status.
8. Exact release candidate and entrypoints to be assessed.
9. Runtime, dependency, browser and deployment environment.

Identify whether the candidate is the current local working tree, `origin/main`, or a deployed GitHub Pages artifact. If no candidate is specified, assess the current local working tree and explicitly limit the recommendation to that candidate; published readiness remains unverified.

Record the commit and a fingerprint of the actual tested files, including relevant uncommitted changes, lockfiles and generated assets. Record fixture paths, versions and content hashes. A commit identifier alone does not identify a dirty working tree. Preserve pre-existing edits.

For a deployed candidate, record the URL, deployment/source identity and evidence that the served assets correspond to the candidate. Do not infer that the public version passed from local test results.

Record the operating system, Node and relevant tool versions, dependency versions, browser/runtime versions, viewport, entrypoint protocol (`file://`, local HTTP or GitHub Pages), and online/offline conditions. Results apply only to the environments actually verified.

Establish a requirements-to-implementation traceability matrix with requirement IDs, authority, operating mode, implementation references, verification cases and mandatory-gate links.

Identify contradictions between documents, implementation and observed behaviour.

Follow active owner instructions and applicable repository instructions first. Within the application requirements, use current approved NSA/EVT specifications and design decisions, recording their scope, version and approval status. Historical reports, superseded plans and completed milestone claims are evidence leads, not current requirements or proof of a pass.

Where sources conflict, record the conflict and the authority used to resolve it. Do not apply Overtime-only governance to NSA/EVT. Do not invent new requirements and classify them as defects.

If requirements are unclear, record the ambiguity and the associated risk.

## 3. Evaluate NSA and EVT Independently and Together

The two operating modes are intended to share a common application architecture, seven modules, business workflows, component systems and underlying design patterns.

Their differences should principally concern mode-specific business data, terminology, approved workflow variations and visual identity.

NSA uses green as its primary identity colour; EVT uses blue.

Audit:

- Whether equivalent functionality behaves consistently in both modes.
- Whether mode-specific branching has introduced duplicated or contradictory logic.
- Whether shared components genuinely use shared implementations.
- Whether business rules are unintentionally different.
- Whether mode-specific data remains correctly isolated.
- Whether navigation, validation, dialogs, notifications and error handling are consistent.
- Whether switching operating modes causes state contamination, stale information or data loss.
- Whether both modes remain fully functional following reload, import and restoration.

Produce an NSA-versus-EVT parity matrix for every module.

Identify intentional differences separately from implementation defects.

## 4. Conduct a Complete Functional Audit

Inspect every module, feature, interaction and significant user workflow discovered in the application.

Do not limit the audit to a superficial code inspection or successful page loading.

For each module, evaluate:

- Creation, reading, updating and deletion of records.
- Required fields and validation.
- Relationships between parent and child records.
- Business-rule enforcement.
- Navigation and cross-module interactions.
- Search, filters, sorting and selection.
- Calculations, derived values and displayed totals.
- State transitions and lifecycle management.
- User feedback, confirmation and error recovery.
- Empty, invalid, partial and boundary conditions.
- Persistence following reload or mode switching.
- Import, export and restoration behaviour.
- Resilience to interrupted or unsuccessful operations.

Trace at least one complete realistic workflow from initial registration through planning, operational processing, costing, quoting and completion where supported by the application.

Repeat relevant workflow testing in both NSA and EVT.

Build a scenario inventory from current approved business rules, including these high-risk regressions where applicable:

- Register identity and lifecycle: immutable EVT Event ID versus Council Event Number, EVT-only bump dates and calendar entries, status transitions, approved privacy exceptions, and unchanged NSA behaviour.
- Resource Calculator and Quotes: item categories and Scheduler eligibility, current Project work versus saved quote snapshots, revisions and archived quotes, quote exclusions, and protection of issued or resolved work.
- Funding and receipts: default Customer funding, deposit/payment eligibility, funding-source changes, Declined-quote restrictions, repeat submissions, reversals, and evidence with correct actor/timestamp and stable navigation.
- Scheduler: isolation when switching Register records with or without Projects, available/used action states, draft versus saved bookings, same-type overlap warnings, adaptive Week columns, all-day/multi-day editing, and preservation of unsaved work.
- Space Map: renderer/provider failure and recovery without losing drafts, user-managed MetroMap credentials, tree-layer loading and selection, Moasure units/placement/import, and geometry editing and inspector behaviour.
- Workspace recovery: the latest approved converted fixture, import/migration and round trips, failed saves and quota, concurrent tabs and stale revisions, and permanent Danger Zone deletion restricted to disposable synthetic data.

Use the inventory to identify existing coverage and select necessary checks. These examples do not authorise new business rules; resolve expected outcomes against the approved requirements.

## 5. Prioritise Data Integrity and Financial Correctness

Treat data loss, silent corruption and incorrect financial outcomes as release-critical risks.

Pay particular attention to:

### Record integrity
- Parent/child relationships and referential integrity.
- Cascading deletion and prevention of orphaned records.
- Stable identifiers and uniqueness.
- Update operations that could overwrite unrelated records.
- Preservation of records during import/export.
- Handling of malformed, incomplete and older workspace data.
- Duplicate operations and repeat submissions.

### Financial and operational integrity
- Correct separation of quantities, unit costs, totals and funding calculations.
- Consistency between cost catalogues, job calculators and quotations.
- Quote line-item creation, modification and deletion.
- Appropriate treatment of funding gaps.
- Correct calculation after changes to upstream records.
- Prevention of unintended changes to issued or finalised quotations.
- Quote acceptance and lifecycle transitions.
- Receipts, evidence and audit records where required.
- Correct behaviour when a job changes after a quote is prepared or issued.

Use the actual approved business rules to determine expected behaviour.

Do not assume a calculation is correct merely because its displayed components sum consistently.

Check whether the underlying business meaning is correct.

## 6. Storage, Backup and Recovery

Identify the application's actual persistence architecture.

Evaluate:

- Durability of saved records.
- Browser refresh and restart behaviour.
- Storage failure and quota handling.
- Import/export completeness.
- Backup and restore reliability.
- Workspace compatibility and migration.
- Schema/version handling.
- Recovery from interrupted operations.
- Protection against accidental destructive actions.
- Whether destructive operations provide adequate safeguards.

Perform non-destructive round-trip tests using isolated test data.

Never clear or replace a real workspace.

CRUD, save/reload, migration, quota/failure injection and destructive recovery checks may write to persistent storage only inside disposable browser profiles and test workspaces containing synthetic data or disposable copies of approved fixtures. Preserve original fixture and backup files; a copied fixture is never permission to touch its operator's actual storage. Never reuse an operator's browser profile or attach tests to an existing user session. Verify isolation before starting and keep fixture provenance in the report.

Distinguish between intended storage limitations and genuine defects.

## 7. UI, UX and CSS Architecture

Conduct both a visual and structural audit.

Check:

- Consistent styling across all seven modules.
- Shared design tokens and reusable CSS classes.
- Equivalent NSA and EVT layouts.
- Correct application of mode identity colours.
- Unnecessary duplicated CSS or conflicting overrides.
- Visual regressions and layout instability.
- Desktop layout at supported viewports and the actual target browser/entrypoint where available.
- Tablet/mobile behaviour may be reviewed statically, but mobile-device, mobile-viewport and touch-emulation test execution is excluded under the current instructions. Record unexecuted compatibility coverage explicitly.
- Usability of navigation, panels, drawers, forms and dialogs.
- Readability, focus states, keyboard access and accessibility.
- Error, warning, success and empty-state messaging.
- Privacy masking and treatment of personally identifiable information.
- Presentation and navigation of large datasets.

Assess maintainability separately from release-blocking functionality.

Do not recommend wholesale visual redesigns where the existing design is functional and compliant.

## 8. Security, Privacy and Reliability

Investigate practical risks, including:

- Cross-site scripting and unsafe HTML rendering.
- Untrusted imported data.
- Exposure of personal information.
- Unsafe handling of credentials or sensitive configuration.
- Dependency vulnerabilities.
- Unhandled exceptions.
- Broken asynchronous workflows.
- Race conditions and duplicate submissions.
- Unvalidated state transitions.
- Loss of data through unexpected navigation.
- Failures caused by unavailable browser APIs or external dependencies.

Identify actual exploitability and operational impact rather than reporting hypothetical vulnerabilities without evidence.

## 9. Testing Strategy

First inspect the existing test framework, coverage, scripts and hooks. Build an execution inventory listing each selected check, its requirement/risk, operating mode, environment, side effects and output location. Record exclusions and reasons. Select commands within the owner's existing authorisation; do not introduce an extra permission step for already authorised checks.

Use risk-based execution covering applicable mandatory gates and material gaps. Consider unit, integration, end-to-end, static analysis, build and dependency checks. A relevant full-suite baseline may be justified, but do not run every available command automatically or repeat passing checks without a changed candidate, failure or unresolved concern.

**Do not perform screenshot tests or captures, browser video/screenshot traces, mobile-device or mobile-viewport tests, or touch emulation.** Inspect aggregate commands before using them: the current release runner invokes the browser suite, whose existing cases and failure hooks can include excluded behaviour. Do not run an aggregate command unchanged if it would exceed these boundaries.

Use desktop DOM, computed-style, geometry, interaction, buffer/resource and state checks as appropriate. Supplement existing coverage with focused temporary checks in isolated locations; do not alter existing tests to obtain a pass. Record the source and fixture identity of supplementary checks so the evidence can be reproduced.

Where browser automation is available, test realistic user interactions in both NSA and EVT. Use disposable contexts and synthetic data. Do not send real emails, create real operational bookings, submit external business transactions or expose credentials through testing.

Preflight each command for writes. If it regenerates tracked assets, rewrites fixtures or affects the baseline, run it only in a disposable filesystem copy of the exact candidate or mark it blocked. Do not create branches, check out another revision, discard local changes or restore files over existing edits. Allow only isolated test outputs and the audit deliverable directory described below.

Preserve a clear distinction between:

- **PASS:** The stated expected outcome was executed and verified successfully.
- **FAIL:** The expected outcome was demonstrably violated; classify whether the cause is application, test, fixture or environment before calling it a product defect.
- **BLOCKED:** Execution could not proceed; record the cause and the evidence still required.
- **NOT TESTED:** The check was not executed; state why and its effect on confidence and release gates.
- **NOT APPLICABLE:** An approved requirement does not apply; cite the reason.

Never describe an unexecuted check as passing. Record flaky/intermittent outcomes and every attempt; a later pass does not erase a reproduced defect.

Before execution, establish the mandatory release-gate matrix from applicable approved requirements and acceptance criteria. Give every gate a stable ID, authority, expected outcome, required verification/environment, evidence references and status. Explain why it is mandatory. Do not invent unrelated standards or silently weaken an existing gate.

Coverage excluded by the owner is not automatically NOT APPLICABLE. If it is mandatory for the proposed release scope, the missing verification must affect the release decision. A desktop-only conclusion must not claim mobile readiness.

Follow the repository's tool-discovery protocol when tooling is missing. Name the exact missing component and explain why it would help before using a workaround. Do not install dependencies, update lockfiles or alter the baseline without explicit authorisation.

## 10. Governance and Architectural Compliance

Assess whether the implementation conforms to its own constitution, governance standards and accepted architectural decisions.

Investigate:

- Deviations from the approved architecture.
- Business logic embedded in inappropriate layers.
- Duplicate implementations of common functionality.
- Accumulated patches and workaround logic.
- Undocumented architectural changes.
- Excessively coupled modules.
- Dead code and abandoned functionality.
- Insufficient error handling.
- Missing or ineffective regression tests.
- Inconsistent state management.
- Technical debt likely to compromise maintenance or release stability.

Distinguish architectural concerns that threaten release safety from improvements that can reasonably wait until a later version.

Do not substitute personal architectural preferences for approved project decisions.

## 11. Defect Classification

Classify every finding using the following scale:

| Severity | Definition |
|---|---|
| P0 — Critical | Data loss, corruption, serious security exposure or fundamentally unsafe core behaviour |
| P1 — High | Broken essential workflows, incorrect material calculations, significant reliability failures or serious governance breaches |
| P2 — Medium | Functional defects with practical workarounds, significant inconsistencies or maintainability risks |
| P3 — Low | Minor cosmetic defects, refinements and non-essential improvements |

For every finding, record:

1. Unique finding ID.
2. Severity.
3. Affected module and operating mode.
4. Requirement or governance reference.
5. Observed behaviour.
6. Expected behaviour.
7. Steps to reproduce.
8. Supporting file paths and line numbers.
9. Test or execution evidence.
10. Impact on users, data or business operations.
11. Recommended corrective action.
12. Suggested regression tests.
13. Whether the issue blocks release and the gate IDs affected.
14. Evidence/run IDs, exact command or reproducible procedure, environment, fixture identity and candidate fingerprint.
15. Reproducibility, attempts and any uncertainty or environment/test limitation.

Separate verified application defects from test/infrastructure failures, unverified risks, requirement ambiguities and optional improvements. Every claim must point to evidence; severity alone does not establish that a test executed.

Do not inflate severity or generate speculative findings to increase the apparent thoroughness of the audit.

## 12. Required Deliverables

Produce a structured audit package in a new `docs/audits/nsa-evt/<run-id>/` directory. This is an explicit exception for new report artifacts only; application, governance and existing-test baselines remain unchanged. Do not overwrite an earlier audit run.

Required files:

- `results.json`: the common structured source for candidate/environment/fixture metadata, requirements, gates, test attempts, findings, parity, coverage and the final recommendation. Use stable IDs to link these records.
- `report.md`: the complete readable assessment.
- `report.html`: an interactive, self-contained HTML/CSS/JavaScript report with embedded data and no CDN, external runtime dependency or runtime fetch. It must open offline, support keyboard-accessible filtering/search by mode, module, severity and result, and show expandable findings and gate evidence.

Generate both human-readable reports from the same results data so counts, findings and recommendations agree. Include the following sections in both.

Retain sanitised text evidence and any synthetic supplementary harness/fixtures needed for reproduction inside the run directory. Keep disposable profiles, caches and transient execution files outside the baseline and report package. Do not include screenshots, real workspace exports, credentials, private storage values, identifiable personal data or credential-bearing URLs. Redact before writing evidence, and escape untrusted text rendered by the HTML report.

Record the scope exclusions and any unavailable environments prominently. Preserve report artifacts as local deliverables; their creation does not authorise committing, pushing or publishing them.

### A. Executive Release Assessment
A concise evaluation of current release readiness, the most serious risks and the recommendation.

### B. Release-Readiness Scorecard
Give each category an evidence-backed rating of **VERIFIED**, **PARTIALLY VERIFIED**, **FAILED**, **UNVERIFIED** or **NOT APPLICABLE**, including:

- Functional completeness.
- NSA/EVT parity.
- Data integrity.
- Financial correctness.
- Storage and recovery.
- Security and privacy.
- UI/UX consistency.
- Supported desktop compatibility, with mobile coverage exclusions stated separately.
- Architectural maintainability.
- Governance compliance.
- Test coverage and reliability.

VERIFIED means all declared applicable checks for that category were executed and passed; PARTIALLY VERIFIED means some passed but coverage remains incomplete; FAILED means an application requirement demonstrably failed; UNVERIFIED means reliable verification evidence is absent; NOT APPLICABLE requires a cited scope justification.

For each rating, provide its reasoning, evidence, applicable/verified/failed/blocked/not-tested counts, and confidence limitations. A broad category rating must not imply that every feature was exercised. Unknown scope must be explicit rather than assigned an invented coverage percentage.

Do not use uncalibrated numeric scores or average away a blocking finding. If an approved numeric rubric already exists, document its fixed criteria and weights before testing and present it only as supplementary information. The gate matrix determines release readiness.

### C. Detailed Findings Register
All verified defects, risks, governance deviations and improvement opportunities, classified and prioritised.

### D. NSA/EVT Parity Matrix
A module-by-module comparison highlighting verified consistency, approved differences and discrepancies.

### E. Requirements Traceability Matrix
Map documented requirements and acceptance criteria to implementation, verification cases, actual execution outcomes and mandatory gates. Keep unsupported assumptions and approved mode differences visible.

### F. Test Execution Report
For each executed check, record its ID, command/procedure, timestamps, duration, exit status, attempts, candidate and fixture identity, expected/observed outcome, environment and sanitised evidence links.

Include the selected/excluded test inventory, gate outcomes, coverage limitations and blocked/not-tested checks. Previous report results are historical references, not evidence that the current candidate passed.

### G. Prioritised Remediation Roadmap
Identify the smallest practical set of corrective changes needed to reach release readiness.

Separate mandatory fixes from optional improvements.

Recommend logical, independently testable remediation packages.

### H. Release Decision
Issue exactly one recommendation for the identified candidate and release scope. Apply this precedence:

1. **NO-GO:** Any confirmed P0/P1 application defect, other established release-blocking defect, or demonstrated mandatory-gate failure exists. This takes precedence even when other evidence is missing.
2. **UNVERIFIED:** No established blocking failure exists, but mandatory evidence is missing, blocked, outside executed coverage, or insufficiently tied to the candidate.
3. **CONDITIONAL GO:** Mandatory gates passed and no release-blocking or P0/P1 application defect remains, but explicitly identified non-blocking risks or operational restrictions require recorded owner acceptance before deployment. Name each condition, responsible owner and acceptance status; the recommendation itself does not authorise deployment.
4. **GO:** Mandatory gates passed, no unresolved release-blocking defects remain, and no outstanding release condition requires acceptance.

No waiver or category score may permit GO or CONDITIONAL GO while a confirmed P0/P1 application defect remains. Missing verification is not a demonstrated product failure, but it must never be treated as a pass.

State any local-versus-published artifact limitation explicitly. A recommendation for one candidate, browser or protocol does not certify another.

## 13. Working Constraints

**This audit must be read-only with respect to the application and its governance baseline.**

- Do not implement fixes.
- Do not refactor.
- Do not change CSS.
- Do not update dependencies.
- Do not silently amend tests.
- Do not modify business rules.
- Do not modify persistent operator/application data; only isolated disposable test data may be written or destroyed as specified in Section 6.
- Do not overwrite existing workspaces or backups.
- Do not commit or push changes.
- Do not create a release.

Temporary test fixtures, disposable browser profiles and generated audit reports are permitted only in the isolated locations defined above. Review working-tree status before and after the audit and account for every audit-created artifact. Do not overwrite, remove or revert pre-existing local files or edits.

If a test is potentially destructive, execute it only against a verified disposable test workspace as defined in Section 6. If isolation cannot be guaranteed, document the procedure and mark it BLOCKED; never execute it against existing operator data.

Retain the existing approved design unless the audit demonstrates a genuine problem.

## 14. Final Instructions

Work systematically and independently.

Use actual source-code inspection, targeted execution, automated testing and documented evidence wherever feasible.

Do not rely solely on previous development reports or claims that features were completed.

Do not mistake code that appears logically correct for code that has been tested successfully.

Be critical but proportionate.

The primary objective is **a stable, dependable production release**, not perfection or unnecessary redevelopment.

Complete the assessment, provide the full findings and release recommendation, and then stop.

**Do not begin remediation until the audit has been reviewed and explicit authorisation has been provided.**
