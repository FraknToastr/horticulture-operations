# C6 Final Commercial Snapshot Safety Checkpoint

Date: 22 September 2026  
Status: PASS / CLOSED following peer-review acceptance and C6 closure evidence.  
Stop point: C6 is closed; H1 Map status-filter normalization is the active authorised tranche.

## Active governance

```text
P0   COMPLETE
C1   COMPLETE
C2   COMPLETE
C3   COMPLETE
R1   COMPLETE
C4   PASS / CLOSED
C5   PASS / CLOSED

Pre-C5 migration: NOT APPLICABLE TO SUPPORTED FRESH-START DEPLOYMENT

C6   PASS / CLOSED
H1   OPEN / ACTIVE
```

## Final C6 safeguards

- `geometry.areaSqM` remains the canonical polygon measurement and `geometry.rateItemId` remains its selected pricing basis.
- Structured multi-rate eligibility/default mappings, m²/ha/km² conversion, explicit selection, and the single-row dual-path Rate Library UI remain unchanged.
- A Rate Item with Job, CostingLine, or QuoteLine lineage cannot change unit or quantity mode. The governed error directs the operator to create a new Rate Item.
- Monetary-only Rate Item edits remain allowed. Existing CostingLine commercial snapshots are retained; issued QuoteLine evidence remains immutable.
- `syncGeometry()` defensively derives a retained same-Rate snapshot using the retained CostingLine unit, preventing a current-conversion/old-unit hybrid even for malformed imported state.
- Data Health raises `SPATIAL_COST_QUANTITY_MISMATCH` when a spatial CostingLine quantity does not reconcile to `sourceAreaSqM` and its own commercial unit snapshot.
- Polygon-derived Calculator quantity, unit, and unit-rate controls are disabled and labelled “Derived from polygon — manage in Space Map”. Manual Calculator rows remain editable.
- The obsolete singular work-type mapping mutation inside the Rate Library upsert flow has been removed.

## Verification

```text
Deterministic suite: 78 / 78 PASS
New deterministic cases: C6-21, C6-22 PASS

Focused C6 browser suite: 11 / 11 PASS
New browser case: C6-BR-09 PASS

Complete browser suite: 55 / 55 PASS
Workers: 1; retries: 0

JavaScript/CJS syntax: 83 / 83 PASS
```

## Changed final-patch files

- `src/program-planner/js/costing-model.js`
- `src/program-planner/js/work-area-service.js`
- `src/program-planner/js/data-health.js`
- `src/program-planner/js/costing.js`
- `tests/c6-multirate-corrective.test.cjs`
- `tests/browser/c6-work-type-rate-mapping.spec.js`
- `Offline/antigravity-ide-next-steps.md`

## C6 closure evidence

Peer review 9 required restoration of RC-DEL-01's event-driven assertion. The test no longer performs a manual Calculator controller refresh, and proves the application's `uos:workspace-changed` listener updates the DOM. Focused RC-DEL-01 passed and the complete browser suite passed 55 / 55 before H1 commenced.

H1 was then explicitly authorised. The C6 ZIP remains the closed milestone archive; H1 receives its own replacement peer-review package.

## C6 structural Rate edit import-guard micro-patch

```text
TRANCHE: C6 — Structural Rate Edit Import Guard Micro-Patch
STATUS: PASS / awaiting peer review
PRODUCTION FILES CHANGED: src/program-planner/js/costing-model.js
TEST FILES CHANGED: tests/c6-multirate-corrective.test.cjs; tests/browser/calculator-line-deletion.spec.js
SHARED STRUCTURAL EDIT AUTHORITY: PASS
GOVERNED RATE EDIT PATH: PASS
GENERIC RATE UPSERT: PASS
RATE CATALOG IMPORT PATH: PASS
MONETARY-ONLY EDIT: PRESERVED
EXISTING SPATIAL LINEAGE: PRESERVED
FOCUSED TESTS: C6-21 PASS; C6-23 PASS; C6-24 PASS
FULL DETERMINISTIC: 80 / 80 PASS
FULL BROWSER: 55 / 55 PASS
SYNTAX: 83 / 83 PASS
REGRESSIONS: none
DEFERRED: Rate CSV identity/mapping portability enhancement
H1 MODIFIED: NO
SAFE TO PROCEED TO H1: NO — peer-review closure remains required
```
