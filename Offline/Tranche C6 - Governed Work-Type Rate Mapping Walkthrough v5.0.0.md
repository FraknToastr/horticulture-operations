# Tranche C6 — Governed Work-Type / Rate Item Mapping Walkthrough v5.0.0

Date: 2026-09-22  
Result: PASS — awaiting ChatGPT peer review

## Outcome

C6 generalises polygon costing beyond Turfing while preserving one Rate Item, one Rate Library row, and two distinct creation pathways. Fresh workspaces now explicitly map Turfing and Aeration. The Rate Library editor can govern the remaining supported polygon work types without name inference or duplicate catalog records.

## User-visible behavior

- A manual-only Rate Item shows `+` and adds to the Resource Calculator.
- A dual-path Rate Item shows a Map icon in the same action position.
- Clicking the Map icon performs the same manual Resource Calculator addition as `+`.
- The Map icon indicates that the same Rate Item is also available to a separately created Space Map polygon.
- Add/edit exposes “Also available as a polygon job” and a governed work-type selector.
- Adding or editing a dual-path Rate produces exactly one Rate Library row.

## Mapping governance

The workspace authority remains `referenceData.shared.workTypeRateItems`, seeded by the singular model authority:

```text
turfing -> RATE-TURFING
aerate  -> RATE-AERATION
```

Supported configurable polygon keys are Turfing, Aeration, Fertilising, Topdressing, and Rolling. Saves reject unsupported keys, inactive targets, and non-area Rate Items. Empty entries are deliberate tombstones that can disable a canonical default without allowing the model default to reappear.

## Lineage and history

Manual Map-icon addition creates `sourceKind: manual` and no `sourceGeometryId`. Polygon Job creation retains `sourceKind: space-map`, measured quantity, and geometry lineage. Existing Jobs and Costing Lines keep their captured Rate Item, description, unit, rate, and total when a mapping changes. Resynchronising old geometry cannot overwrite the newer global mapping.

## Verification

- Deterministic suite: 66 / 66 PASS.
- Browser suite: 49 / 49 PASS.
- C6 browser cases: 5 / 5 PASS.
- Non-vendor JavaScript/CJS syntax: 84 / 84 PASS.

The ten deterministic C6 cases cover canonical Turfing, exact Aeration, unknown and missing mappings, missing/inactive/incompatible Rate Items, explicit override, immutable historical snapshots, reload persistence, and current-version JSON export/import.

The five browser cases cover Aeration polygon lineage, unmapped rejection, durable reload, dual-path Rate creation/manual Map-button behavior, and editing an existing manual Rate into one dual-path row.

## Full-gate dependency

The complete browser gate exposed a pre-existing race between the two canonical status-history renderers. A narrow attribute alignment in `register-history-ui.js` preserves the existing C5 selector in either rendering order. No C5 migration or mutation scope was reopened.

## Next sequence

Stop for peer review. After C6 acceptance and explicit authorisation, proceed to H1+. The deferred C5 historical-status migration corrective remains scheduled only after H1+.
