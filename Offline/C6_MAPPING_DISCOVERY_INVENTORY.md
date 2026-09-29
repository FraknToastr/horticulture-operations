# C6 Mapping Discovery Inventory

Status: COMPLETE — prerequisite inventory before C6 production source changes  
Date: 2026-09-21

## Decision boundary

C6 will preserve one Rate Item and one Rate Library row per service. A Rate Item may be manual-only or may also be mapped to one supported Space Map work type. Mapping does not create a second Rate Item. The Rate Library action remains a manual Resource Calculator action in both cases: `+` denotes manual-only and the Map icon denotes dual-path availability while invoking the same manual-add command.

The deferred C5 historical-status migration correction is not part of C6.

## Current implementation inventory

| Area | Current implementation | C6 change required? |
|---|---|---|
| Turfing catalog Rate Item | `RATE-TURFING` exists, is active, uses `m²`, and is the sole seeded canonical mapping. | Retain. Add regression coverage for dual-path manual and spatial use. |
| Aeration catalog Rate Item | `RATE-AERATION` already exists, is active, uses `m²`, and has an existing governed unit rate. Older imported aeration entries also exist but use `item` and are not suitable area mappings. | Map canonical `aerate` to the existing `RATE-AERATION`; do not create or infer a duplicate. |
| Supported Space Map work types | The map exposes exact canonical keys `turfing` and `aerate` (with import aliases normalized by the map UI). | Reuse the exact keys. The Rate editor must offer only supported keys; no fuzzy matching. |
| Mapping authority | `ProgramModel.canonicalWorkTypeRateItems` seeds `referenceData.shared.workTypeRateItems`. `WorkAreaService.rateMapping()` resolves configured entries over canonical defaults. | Extend the seed to aeration and make the workspace mapping the editable authority. Do not add mapping flags to Rate Items. |
| Mapping persistence | The mapping object is already part of the normalized workspace and therefore follows save/reload and JSON export/import. | Add tests proving editor-created changes survive normalization and export/import. |
| Validation and health | `DataHealth` reports unknown and inactive mapping targets. `WorkAreaService` only resolves active Rate Items. | Add command-level validation for supported key, active Rate Item, area-compatible unit/mode, and one mapping per Rate Item. |
| Rate Library add/edit | `ProgramCosting.upsertRateItem()` only changes a Rate Item. The dialog has no mapping controls. | Add an atomic Rate Item + optional work-type mapping command and expose an optional polygon-work-type selector in add/edit. |
| Rate Library row count | One row is rendered per Rate Item. Legacy display code still recognizes historical paired presentation fields. | Preserve one row per Rate Item; do not manufacture a job/polygon pair. |
| Rate Library action | Unmapped rows have an actionable `+`. Mapped rows currently render a non-interactive Map-icon span and prohibit manual addition. | Render the Map icon as the same `data-costing-add-rate` button. It must call the unchanged manual add path and must not create geometry lineage. |
| Create Job eligibility | `WorkAreaService.resolveGeometryRate()` uses the exact work-type mapping; missing/inactive mappings do not resolve. Map UI gates Job creation on resolution. | Preserve exact resolution and cover both turfing and aeration. |
| Spatial quantity | `WorkAreaService` converts mapped polygon area for `m²` and `ha`; `ProgramCosting` snapshots rate fields into the generated Costing Line. | Restrict editable polygon mappings to area-compatible units/modes and retain snapshot behavior. |
| Manual lineage | `ProgramCosting.createLine()` assigns `sourceKind: "manual"` and no `sourceGeometryId` when invoked by the Rate Library path. | Assert Map-icon manual adds retain manual lineage. |
| Spatial lineage | Geometry sync creates the Job and Costing Line with `sourceKind: "space-map"` and `sourceGeometryId`. | Preserve and assert the distinct lineage. |
| Existing snapshots/history | Existing Costing Lines copy description, unit, rate and totals. Geometry resync explicitly preserves an existing line's captured rate fields. | Mapping/rate edits must not rewrite existing Costing Lines or Jobs. Add regression coverage. |
| Delete behavior | A Rate Item referenced by a mapping cannot be deleted. | Retain. Unmapping through edit makes later deletion possible when no other references exist. |

## C6 implementation constraint

The editable source of truth remains `workspace.referenceData.shared.workTypeRateItems` (`workTypeKey -> rateItemId`). Rate Items remain ordinary catalog entities. UI state is derived by inverting the mapping for the edited Rate Item; it is not stored as a second flag or duplicate mapping field.
