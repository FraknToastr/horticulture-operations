# Release Gates — v1.5-draft

All Critical gates require reproducible proof.

## Release test regime

`npm run test:release` runs the complete Node suite, the complete browser suite, and the dedicated Budget O/P checks, in that order. It reports each stage separately and exits nonzero when any fails. A passing command proves only that the automated stages passed; it is not a release declaration. Gate owners must still record specific evidence for each applicable Critical contract, including data migration, audit records and end-to-end owner/year cases. A missing test or unimplemented gate is **UNPROVEN**, never **PASS**. The current release status below remains blocked until every Critical gate has recorded proof and no known blocker remains.

For each Critical contract PC-001–PC-028, the release record must identify a reproducible Node or browser test (or an explicit manual proof where automation cannot establish the business decision), its result, the code revision and any unresolved gap. Changes to constitutional language require updated coverage and a gate reassessment. The runner is a suite launcher, not a substitute for this coverage register.

## Gate A — Constitutional integrity
**Critical.** PC-001 through PC-028 must have no silently accepted implementation contradiction.

## Gate B — Core Project → evidence → Quote pathway
**Critical / RELEASE BLOCKER.**

### RB-CRITICAL-01A — Quote Builder accessibility
After a valid Project exists, Quote Builder must open and allow a Draft Quote to be created/saved.

It must **not** require Planner, Space Map, Calculator, Job, Geometry or Quote Readiness completion.

**Proof:** `Register → Project → Quote Builder → Draft Quote → Save = PASS`

### RB-CRITICAL-01B — Cost Library → Resource Calculator
An eligible active Cost/Rate Library item must be selectable and addable to Resource Calculator costing in the selected Project.

**Proof:** `Project → Resource Calculator → Cost Library item → quantity/rate → canonical costing evidence = PASS`

**Current remediation evidence — component path repaired; Gate B remains open:** unclassified default and legacy Rate Items now receive deterministic Labour, Equipment, or Sundry kinds without changing their identity, category, unit, rate, or historical costing. The Labour tab now receives only Labour items and the catalog table reserves its Add/Edit/Delete action column. `tests/empty-operational-baseline.test.cjs` proves the default and legacy-normalised distribution. Full Project → calculator → Quote pathway proof is still required before this release gate can pass.

### RB-CRITICAL-01C — Space Map promotion / Rate Item resolution
A supported configured work type, including `turfing`, must not reach Create a Job and then fail because no exact active Rate Item ID or approved mapping resolves.

**Proof:** `Project → polygon → supported work type → Create Job → exact Rate Item/mapping → one Job + mapped Costing Line = PASS`

Do not repair this by fuzzy-guessing a Rate Item. Mapping must be explicit and deterministic.

## Gate C — Quote Readiness
**Critical / RELEASE BLOCKER once implemented.**

Draft creation remains permissive. Issue requires Scope + Cost-basis + Funding evidence.

Proof must show Draft-before-readiness, actionable blocking when evidence is absent, multiple legitimate evidence pathways, no module-visitation shortcut, and a readiness/evidence snapshot at Issue.

## Gate D — Commercial immutability and revision
**Critical.** Issued Quote history remains unchanged when current Jobs/costs change; later commercial change uses revision.

## Gate E — Dependency protection
**Critical.** Protected dependencies block inappropriate deletion; no silent orphaning/history rewrite.

## Gate F — Persistence/import/recovery
**Critical.** Round-trip preserves IDs and lineage; stale imports/revision conflicts cannot overwrite newer state.

## Gate G — Workspace isolation
**Critical.** NSA and EVT operational data cannot silently cross workspaces.

## Gate H — UX operability
**High; escalates to Critical where a core workflow is blocked.** Eligible controls must be usable; ineligible controls must explain the actionable reason.

### RB-HIGH-02 — Workspace lock truthfulness
**High / RELEASE BLOCKER.** The workspace lock warning must only report a genuine, active competing editor. It must not claim that a workspace is open in another tab, nor offer a force-takeover action, when no competing editor exists.

**Proof:** a single-tab workspace session never displays the warning; a genuine competing session identifies the conflict accurately; takeover behaviour, if retained, is deliberate and auditable.

**Current status:** reported false-positive warning. Parked for remediation; release remains blocked until proven fixed.

### RB-HIGH-03 — Register shortcut availability
**High / RELEASE BLOCKER.** A row-level shortcut to Register must remain usable whenever the user is in another module and the Register record is a valid navigation target. It must not be disabled merely because a stale or misinterpreted module-state flag treats the user as already being in Register.

**Proof:** from each supported non-Register module, an eligible row-level Register shortcut is enabled, opens the intended Register record, and does not alter unrelated active Project or module state.

**Current status:** reported false lock interferes with business-workflow and browser testing. Parked for remediation; release remains blocked until proven fixed.

## Current reviewed v5.0.0 status
**FAIL / RELEASE BLOCKED.** The automated release runner (`npm run test:release`) passes its Node, browser, and dedicated Budget O/P stages (29 September 2026). Gates O and P have 17 passing model tests and 4 passing browser tests. Other Critical gates remain open, so passing automation does not make the product release-ready.


## Gate I — Sidebar architecture retirement
**Critical / RELEASE BLOCKER if legacy behaviour remains wired.**

Source audit and runtime proof must show:
- no expand-sidebar control or active expansion state;
- no collapse-to-super-narrow/compact-sidebar control or active state;
- no undock/float control or active state;
- no persisted settings capable of restoring those modes;
- no event handlers, reducers/state transitions or module APIs that can activate those modes;
- no production code path depends on legacy compact-card/expanded-card sidebar mechanics.

Residual comments or unreachable compatibility code should be removed where safe. This governance update does **not** claim the source audit has already passed; it defines the proof required.

**Current tranche evidence — PASS (not a release declaration):** `tests/sidebar-architecture.test.cjs` proves the retired production module is absent, no application shell loads it, no active source path restores compact/floating state, and the normal Planner, Costing and Quote Builder sidebars remain. Browser coverage confirms the supported full-size module shell still operates.

## Gate J — Location/Polygon sidebar contract
**Critical.**

Acceptance proof:
- Register view with zero Locations → full-size Location Card is present and provides the create/edit entry path.
- Register view with Location → same full-size card surface represents the Location.
- Project view with zero polygons → full-size Polygons Summary Card is present and provides entry to Polygon Inspector.
- Project view with polygons → summary remains present and reports them.
- Polygon Inspector → full-size inspector cards only; no legacy compact/expand card mode.

**Current tranche evidence — PASS (not a release declaration):** `tests/browser/location-active-register.spec.js` proves the full-size empty Register Location Card for NSA and EVT; `tests/location-polygon-sidebar.test.cjs` proves the Project Polygon Summary always derives a zero/non-zero count and exposes Add/Edit Polygon entry; `tests/browser/register-drawer-context.spec.js` proves Location context is transferred rather than left stale in a previous Register drawer.

## Gate K — Scheduler ownership and interaction routing
**Critical.**

Acceptance proof:
1. Calendar can display Jobs belonging to multiple Register/Projects in the owner app.
2. Scheduler compact Job row-table can list Jobs as designed.
3. Selecting an active Register/Project Job from the row-table opens Scheduler Editor.
4. Selecting an active Register/Project Job card on the calendar opens Scheduler Editor.
5. Selecting a calendar Job card owned by another Register/Project opens the Job Summary modal.
6. That non-active Job cannot be sent to Scheduler Editor without first becoming valid under an explicitly changed active Register/Project context.
7. Modal inspection does not silently change the active Register or Project.

## Gate L — Scheduler active-project calendar signalling
**High; escalates to Critical if active-context legibility is required for release.**

Acceptance proof:
- a day containing at least one Draft or Scheduled Job owned by the active Project receives the defined active-project cell colour state;
- a day containing only Jobs from other Projects does not receive that state;
- changing active Register/Project recomputes the day states correctly;
- changing a Job status or ownership recomputes the state from canonical data;
- no calendar-local shadow flag is required to preserve the state.


## Gate M — Accordion drawer viewport containment
**Critical / RELEASE BLOCKER when drawer content or controls are inaccessible.**

Acceptance proof across modules:
- expand a row positioned at multiple vertical locations;
- the drawer begins immediately below its row header;
- the thick drawer floor remains visible without requiring page scrolling;
- the drawer never extends below the usable viewport;
- content that exceeds available height produces an internal drawer-content scrollbar;
- the last content/control remains reachable above the visible floor;
- resizing the viewport recomputes the constraint without leaving stale off-screen geometry.

## Gate N — Register drawer adaptive growth
**Critical.**

Acceptance proof:
1. A short Register drawer uses content-driven height rather than unnecessarily filling the viewport.
2. Increasing Notes/content grows the drawer downward while sufficient viewport space remains.
3. Growth stops when the thick drawer floor reaches the usable viewport bottom.
4. Further content growth does not move the floor off-screen.
5. Excess Register content becomes internally scrollable.
6. Reducing content allows the drawer to shrink again where appropriate.
7. Opening/closing nested content or changing viewport height recomputes the available height correctly.

Prepared regression acceptance additionally requires repeated Preliminaries/Margin saves inside NSA and Event Resource Calculator drawers to reuse the established viewport cap, preserve outer and inner scroll positions, keep Rate Items/assigned lines and the totals footer visible, and show percentage-labelled AUD breakdown amounts. Evidence remains **NOT RUN / awaiting explicit verification approval**.

`tests/costing-adjustments.test.cjs` prepares the corresponding calculation-order, decimal-percentage, rounding and zero-default model proof. Evidence remains **NOT RUN / awaiting explicit verification approval**.

## Gate O — Annual budget authority and allocation
**Critical / automated Gate O proof passing (29 September 2026).** Run `npm run test:budget-gates` before release. Model tests cover owner/year isolation, exact cents, protected transfers, Job attribution and legacy authority separation; browser tests cover Register allocation and annual transfer.

Proof must cover 1 July–30 June boundaries, one budget per NSA/EVT owner and year, distinct owner budgets, multiple annual allocations for the same Register, valid same-owner Register/Project lineage, and rejection of duplicate budgets or cross-owner/cross-year links. Reconcile original approved authority plus signed approved adjustments against allocations in cents. Block allocations or transfers that exceed authority or violate protected commitments/actuals. Verify planned cost, approved budget, allocated amount, commitment, actual spend and forecast are distinct and not double counted.

### Prepared presentation acceptance — awaiting execution

The allocation table must match the adjacent Project-action width. Its compact two-column `Financial FY` / `Allocated` header and each governed allocation row use discrete dividers. The legacy `Council Operational Amount` row and its duplicated value are prohibited alongside the obsolete standalone Budget card.

The Register presentation places `Budget`/`Allocate/Adjust` and a compact `Council Operations Allocated` table directly in the existing Delivery Project two-column grid for NSA and Event records, whether or not a Project is linked. The table lists one governed Register/FY allocation per row, newest FY first, shows no cross-year total, and falls back to the current FY with `$0.00` only when no allocation exists. The table uses the adjacent Project-action width, owner-aware treatment and discrete row dividers. The obsolete standalone Budget card is prohibited.

Prepared browser acceptance also covers accessible Rate Item sorting: Description defaults ascending; Category and Description toggle in both directions; mouse and keyboard operation expose indicators and `aria-sort`; sort survives Kind/search/category filters; duplicate ordering is deterministic; and Add/Edit/Delete retain the correct Rate Item target after reorder.

Evidence status: **NOT RUN / awaiting explicit verification approval.** Do not promote this section to PASS until the focused Rate Library and Budget browser tests, relevant model tests, complete release suite, and `git diff --check` have all run and the exact results are recorded.

## Gate P — Financial audit, closure and carry-forward
**Critical / automated Gate P proof passing (29 September 2026).** Run `npm run test:budget-gates` before release. Model and browser tests cover immutable requests and decisions, draft/rejection effects, separate reopen approval, both carry-forward answers and approved next-year posting.

Proof must show approval records with names, decision time and reason, while making no authentication claim. Approved budget/allocation changes must use immutable signed adjustment entries; draft/rejected entries must have zero effect. Transfers must commit debit and credit together. Corrections must preserve originals. A closed year rejects financial mutation; reopening needs a separate recorded decision and later reclose history. Both Register Yes and No carry-forward answers open review without moving funds. A Yes proposal cannot exceed verified prior-year unspent, cannot alter the prior year, and has no new-year effect before recorded approval and adjustment. Legacy `operationalAmount`/`approvedBudget` migration must show mapping diagnostics and quarantine ambiguity rather than creating authority silently.

Register carry-forward presentation follows the same authority boundary: keep the Yes/No trigger available, but render no carry-forward FY/amount state for unanswered review, recorded Yes, draft, pending or rejection. Only a posted approved carry-forward allocation may update or create the destination-FY allocation row. Prepared evidence is **NOT RUN / awaiting explicit verification approval**.

## Gate Q — Job origin and staged Planner delivery
**Critical / RELEASE BLOCKER until implemented and proven.**

Proof must cover all three exact origins: Planner Task, Calculator work, and Space Map geometry. Each Job retains immutable source ID and same-owner Register/Project lineage through save, import and recovery. An Inert Task creates no Job. Creating or promoting an Operational Task creates or resolves one Draft Planner Job, including on repeat actions; it does not schedule, cost or quote the Job. Explicit scheduling changes only Scheduler-owned state of that Job. Explicit costing with a valid basis creates or refreshes a snapshot under the same Job. Draft Quote inclusion is deliberate, remains traceable to Job and Costing Line, and cannot bypass Quote Readiness; issued history remains immutable. Legacy `manual` or ambiguous Job origins require review rather than invented lineage.
