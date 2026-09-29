# C6 — Canonical Work-Type / Rate-Pair Governance

**Status:** IMPLEMENTED / VERIFIED / AWAITING PEER REVIEW (2026-09-22)

**Sequence:** C4 PASS and peer review → C5 PASS and peer review → C6.

## Objective

Allow explicit, governed polygon work-type to active Rate Item pairs without name-based inference. A future approved pair may be aerate → RATE-AERATION.

## Required boundaries

- A Rate Library add/edit action creates or changes one Rate Item. It may also create or change a polygon mapping only when the operator explicitly enables `Available as polygon work type` and selects a supported work type.
- Mapping requires explicit supported work-type selection, compatibility validation, and an atomic save with the Rate Item.
- Manual Calculator Jobs/Costing Lines and polygon-measured Jobs/Costing Lines remain separate canonical lineage pathways.
- Mapping changes must not rewrite historical Job or Costing Line snapshots.
- One dual-path Rate Item remains one Rate Library row; the mapping is metadata, not a duplicate Rate Item.
- A manual-only Rate Item keeps the `+` action. A dual-path Rate Item displays the Map icon in its place, but clicking it executes exactly the same Rate-Library-to-Resource-Calculator action as `+`.
- The Map-icon manual action must not navigate to Space Map or create geometry lineage. Its accessible label/tooltip must state that it adds to the Resource Calculator and is also available through mapped polygons.

## Required proof

- Blank-workspace default mappings round-trip through export/import.
- Aeration can be created through manual Calculator and explicitly mapped polygon pathways.
- Rate Library add/edit can explicitly enable or disable a compatible polygon mapping without duplicating the Rate Item.
- Map-icon manual addition and `+` manual addition create equivalent manual lineage; polygon creation retains measured spatial lineage.
- Unknown, inactive, missing, or incompatible mappings fail with an actionable reason.
- Existing turfing mapping and commercial history remain intact.

Implementation evidence is recorded in `C6_CONTINUITY_CHECKPOINT.md` and `Tranche C6 - Governed Work-Type Rate Mapping Walkthrough v5.0.0.md`.
