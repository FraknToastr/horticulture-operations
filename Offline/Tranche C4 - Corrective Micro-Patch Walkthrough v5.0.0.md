# Tranche C4 — Corrective micro-patch walkthrough (superseded package)

## Review status

This package failed its subsequent ChatGPT review because it weakened mapped-work dependency protection. It is retained as historical evidence only. The controlling implementation record is `Tranche C4 - Final Corrective Micro-Patch Checkpoint.md`; C4 remains open pending review of that replacement package.

## Delivered corrections

- Explicit empty canonical Costing Project/Job context clears the local Calculator controller instead of reviving stale selection.
- Calculator deletion detects local/canonical divergence, reconciles to the live workspace, surfaces a controlled error, and emits `uos:costing-sync-anomaly`.
- The controller recognises the real `data-program-view="costing"` active panel.
- The immediate Add then Remove acceptance needs no arbitrary settled-state delay.
- Mapped deletion remains delegated to `WorkAreaService.removeGeometry`; only truly scheduled or active jobs block deletion.
- Complete mapped-work removal also removes status events and recommendations targeting the removed Job, preventing dangling `entityId` validation failure.

## Evidence

- `npm test`: 49 / 49 passing.
- `npm run test:browser`: 40 / 40 passing.
- JavaScript/CJS syntax validation: 79 / 79 passing.

## Scope note

The status-control cleanup and dependency classification were objective blocking dependencies discovered by the required mapped-geometry browser acceptance. They are confined to `WorkAreaService.removeGeometryWork`; no C5 status-history action-key work has started.

## Peer-review package

- Archive: `Offline/Zip files for peer review/Offline-Horticulture-Operations-Suite-v5.0.0-C4-Corrective-Micro-Patch-Peer-Review.zip`
- Initial archive validation: 194 entries; no `node_modules`, transient test output, or prior peer-review archives included.
- SHA-256 sidecar accompanies the archive. Its digest is regenerated after this documentation update so the package and sidecar are an exact pair.

## Next controlled action

Submit the accompanying C4 corrective peer-review ZIP. Do not begin C5 until its PASS verdict is recorded. C6 Canonical Work-Type / Rate-Pair Governance remains planned after C5 review.
