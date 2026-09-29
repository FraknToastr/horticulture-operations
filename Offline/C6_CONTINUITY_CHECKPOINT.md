# C6 CONTINUITY CHECKPOINT

> **SUPERSEDED C6 SUBMISSION:** This checkpoint records the first C6 implementation and is retained as historical evidence only. The controlling replacement is `Offline/C6_CORRECTIVE_CONTINUITY_CHECKPOINT.md`. C5 is PASS/CLOSED; pre-C5 migration is not applicable to the supported fresh-start deployment; H1 remains blocked.

Date: 2026-09-22  
Tranche: C6 — Governed Work-Type / Rate Item Mapping  
Status: PASS / IMPLEMENTATION COMPLETE / AWAITING PEER REVIEW

## Checkpoint result

```text
TRANCHE: C6 — Governed Work-Type / Rate Item Mapping
STATUS: PASS
DETACHED BRANCH: /home/n0rt/headroom-projects/Antigravity-IDE-Offline-Codex-takeover/Horticulture-Operations-Suite-v5.0.0-P0-Remediation
MASTER MODIFIED: NO
P0–C5 PRESERVED: YES
PRODUCTION FILES CHANGED:
- src/program-planner/index.html
- src/program-planner/js/model.js
- src/program-planner/js/costing-model.js
- src/program-planner/js/costing.js
- src/program-planner/js/work-area-service.js
- src/program-planner/js/program-map.js
- src/program-planner/js/data-health.js
- src/program-planner/js/register-history-ui.js (narrow blocking full-gate selector alignment)
TEST FILES CHANGED:
- tests/governed-remediation.test.cjs
- tests/browser/c6-work-type-rate-mapping.spec.js
SINGLE MAPPING AUTHORITY: PASS
TURFING MAPPING: PASS
SECOND APPROVED MAPPING: PASS (aerate -> RATE-AERATION)
UNKNOWN WORK TYPE: PASS
MISSING MAPPING: PASS
MISSING RATE ITEM: PASS
INACTIVE RATE ITEM: PASS
INCOMPATIBLE RATE ITEM: PASS
NO FUZZY MATCHING: PASS
HISTORICAL JOB/COST SNAPSHOT: PASS
WORKSPACE RELOAD: PASS
CURRENT-VERSION EXPORT/IMPORT: PASS
RATE LIBRARY SINGLE ROW: PASS
DUAL-PATH MAP ICON MANUAL ADD: PASS
DETERMINISTIC TESTS: 66 / 66
BROWSER TESTS: 49 / 49
SYNTAX CHECK: 84 / 84 PASS
REGRESSIONS: none
DEFERRED FINDINGS: C5 historical-status migration corrective remains deferred until after H1+
H1+ MODIFIED: NO
SAFE TO PROCEED TO H1: YES, after C6 peer-review acceptance and explicit user authorisation
```

## Implemented contract

- One Rate Item remains one Rate Library row.
- `referenceData.shared.workTypeRateItems` remains the editable workspace mapping authority seeded from `ProgramModel.canonicalWorkTypeRateItems`.
- Canonical fresh-start mappings are `turfing -> RATE-TURFING` and `aerate -> RATE-AERATION`.
- Rate Library add/edit can enable, change, or disable one supported polygon work type atomically with the Rate Item save.
- Manual-only Rate Items use `+`; dual-path Rate Items use the Map icon.
- Both icons invoke the same manual Resource Calculator command. The Map icon does not navigate to Space Map and does not create geometry lineage.
- Polygon work remains a distinct Space Map path with measured `space-map` lineage.
- Mapping changes affect future polygons and do not rewrite existing Jobs or Costing Line commercial snapshots.
- Old geometry resynchronisation no longer writes back into the global mapping authority.

## Blocking dependency resolved during the full gate

The first complete browser run exposed a pre-existing C5 reload-render race: `register-history-ui.js` rendered canonical status events without the canonical `data-register-timeline-status` marker while `status-ui.js` included it. The narrow correction adds the same marker to the second renderer. It changes no C5 data, migration, writer, or lifecycle behavior. The targeted C5 reload acceptance and the complete 49-test browser suite pass afterward.

## Preserved deferral

The C5 historical-status migration corrective remains DEFERRED / OPEN by explicit product-owner instruction. C6 does not close, remove, or implement that backlog. The fresh-start reset guardrail remains: `Clear All Data` is insufficient; use Delete Stored Workspace or complete site-storage deletion, and do not restore/import pre-C5 backups.

## Stop point

C6 implementation, verification, documentation, and peer-review packaging are complete. Do not start H1 until the C6 peer review is accepted and the user explicitly authorises H1.
