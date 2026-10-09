# Space Map: Moasure import and polygon placement

## Operator workflow

1. Open Space Map, choose **Projects**, and select the Project's **Add Polygons** inspector.
2. Choose **Import Moasure CSV**, select the exported coordinate CSV and the required Layer/Path groups.
3. Choose **Choose map anchor**, then click the approximate survey location on the map.
4. Each selected group becomes a separate **Moasure Polygon Inspector** card. Its placement section contains the rotation read-out/manual degrees field and Save/Cancel controls. Drag the outline to move it or drag the rotation handle to rotate.
5. Choose **Save anchored position** in its card to confirm its position. **Cancel** restores the saved outline. Unconfirmed cards retain their confirmation controls after Escape, navigation and reload.
6. Select the work type and available m²/ha pricing variant, then **Create Job**. An unconfirmed imported outline cannot create a job.
7. **Move / Rotate** is available on existing polygons too. Move each polygon separately.
8. **Edit Vertices** opens a temporary working draft. Use **Finish** on the floating map toolbar to save all vertex changes, or **Cancel** / Escape to discard them. Original Moasure XYZ survey points remain preserved.

## Measurement and commercial safeguards

- Supported CSV paths are Dot2Dot outlines, grouped by Layer and Path and ordered by Point.
- X/Y units may be m, cm or mm and are normalized to local metres; Z is retained, not used for plan area.
- Invalid, degenerate or self-intersecting outlines are rejected before the workspace changes.
- Local X/Y defines the working area in m². Geographic placement is an approximate local projection for manual alignment, not a survey georeferencing service.
- Moving or rotating does not change area or the existing Calculator line/job snapshot.
- Vertex previews do not update stored geometry, jobs or commercial values. Finish validates and commits through the existing guarded costing flow; failed saves retain the draft.
- CSV-reported area is retained as reference; calculated X/Y area controls quantities.
- Hectare quantities use 10,000 m² = 1 ha. Pricing follows the selected existing Rate Library variant.
- Original source files in src/MOASURE remain untouched and are not a runtime dependency.
- Importing deliberately again creates new polygons; retries of a single import operation are idempotent.

## Camera focus

Entering Space Map consumes a fresh focus request for the selected Register record or Project after the map is ready. Deleted records cannot leave a stale camera request. Deliberate user panning cancels a pending entry focus.

## Verification

- Node: tests/moasure-geometry.test.cjs plus the retained repository suite.
- Browser: tests/browser/moasure-map.spec.js covers both owners, import, movement, both rotation controls, confirmation, pricing, job creation, Cancel, editing, reload, group selection, malformed CSV and a narrow viewport.
- Browser: tests/browser/map-reimport-focus.spec.js exercises actual A3330 PDF import, map pan, UI deletion and reimport twice.
- Browser: tests/browser/polygon-inspector-editing.spec.js covers action rows/heights, thinner outlines, persistent confirmation controls, vertex draft Cancel/Escape/navigation, Finish, invalid inputs and stale saves.
- Existing drawing, area pricing, location, job promotion and quote tests remain applicable.

These changes are local until separately committed and published.
