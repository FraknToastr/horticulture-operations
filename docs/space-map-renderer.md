# NSA/EVT Space Map renderer

Space Map uses the existing `RemediationMap` interaction controller with a locally
bundled renderer adapter. Its startup order is WebGPU, Three.js WebGL2, local
MapLibre WebGL, then the existing unavailable-map panel. The adapter keeps the
controller object, sources, camera, markers and unfinished interactions during
recovery. Switching backends never accepts or cancels a draft.

The renderer bundle loads when Space Map is entered. MapLibre loads only when
needed for fallback. The tree hub is a small DOM control; expanding it loads no
tree runtime or service data. Trees require zoom 16; SRZ and TPZ require zoom 17.
Direct `file://` entry (including Windows Edge opening WSL files) uses lazy
classic loader scripts and a self-contained Blob worker, since local-file ES
module imports and module workers are blocked by browser origin restrictions.
HTTP entry continues to use the module loader and worker. Both paths retain
geometry processing off the main thread and load no tree code on hub expansion.
Enabled layers are session UI state, start off on a fresh page load and are never
added to workspace entities, costing, selection or Jobs.

The authoritative service is
`https://services.arcgis.com/BzylpWnjWP0tW4nL/arcgis/rest/services/Forestree_TPZ_and_SRZ/FeatureServer`.
Layer 0 supplies points, 1 supplies SRZ, and 2 supplies TPZ. Zone colors come from
each service layer's risk renderer. Queries request WGS84 GeoJSON and only
`OBJECTID` or `OBJECTID,risk`. The loader debounces requests for 200 ms, permits
four concurrent requests, times out at eight seconds and retries twice. Both
transfer-limit flag locations trigger bounded subdivision. Viewport changes abort
obsolete fetches and reject stale worker results.

The lazy worker parses, validates, deduplicates, conservatively simplifies and
triangulates geographic polygons, preserving holes and multipart rings. It
transfers point, fill and outline buffers. Outlines use triangle-strip tessellation
with geographic base positions and screen-width offsets; a GPU uniform keeps them
one CSS pixel wide without buffer uploads during zoom. No Line2 materials, ArcGIS
SDK, SVG or HTML reference features are used. WebGPU native points are fixed at
one pixel, so batched GPU point sprites produce the required two-pixel-radius
circles. Pin symbols and measurement labels remain accessible DOM overlays.

Resource limits are 4 MiB per response, 32 MiB for the worker cell cache, 16 MiB
combined reference GPU buffers, 10,000 visible points, 4,000 visible features per
zone layer, 500,000 combined polygon vertices and 128 raster tiles. Worker cache
accounting reserves three times response bytes for parsed objects. Geographic
cells and subdivision also have bounds (256 initial cells and 512 requests per
layer/viewport). Budget failures clear the affected layer and request closer
zoom. Service/geometry failures stop automatic retries until the layer is toggled.
All layers off terminates the worker and clears its cache. Render targets are
capped at pixel ratio 2 and four million pixels. Rendering is invalidation driven.

Raster tile selection accounts for the camera's 512-pixel zoom scale, the
provider's tile size and the canvas pixel ratio. It chooses sufficient native
resolution for the viewport, within the provider's maximum zoom and 128-tile
budget, instead of stretching 256-pixel imagery at the camera's zoom level.

## Rebuild

Dependencies are pinned to `three@0.186.1`, `earcut@3.2.4` and `esbuild@0.28.2`.
Run `npm run build:space-map` after editing `src/shared/space-map/`. Generated
bundles and the three package licenses live in `src/shared/vendor/space-map/`.
The build does not generate review archives or test-evidence packages.

## Verification

`tests/browser/space-map-gpu.spec.js` runs real software WebGPU and forced
WebGL2, including actual device destruction, fallback, polygon holes, request
counts, thresholds, visibility, cell subdivision, failures, budgets, stale worker
results, raster projection and unfinished drawing/pin/rotation drafts. Tests use
DOM, styles, geometry buffers and resource metrics. The focused local-launcher
raster regression also reads a canvas screenshot pixel to verify that newly
uploaded tiles reach the actual WebGPU/WebGL surface; it uses no image baselines.
Existing NSA/EVT drawing, editor, Moasure, sidebar, radial and lazy-runtime tests
remain the interaction parity checks. Node tests cover triangulation, projection,
transfer limits, malformed coordinates and worker budgets.
The local-file browser regression verifies full-size SVG connectors, lazy classic
loading, actual worker buffers and canvas image changes during mouse pan and
wheel zoom. Connector selectors are scoped above the shared 20px icon rule.

For diagnostics, set `window.UOS_SPACE_MAP_BACKEND` to `webgpu`, `webgl` or
`maplibre` before entering Space Map. The controller exposes
`getRendererMetrics()` and `getRendererAdapter()`, and `UOS.TreeHub.getState()`
reports tree request/cache/worker metrics. These are developer hooks and do not
alter stored schemas. Overtime is unchanged and remains independent.
