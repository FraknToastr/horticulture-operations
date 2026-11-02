# Autosave editing interruption

## Cause and correction

The delayed-save regression reproduced the reported interruption with Privacy mode disabled: the latest text was saved correctly, but the active Quote field lost focus after persistence completed. Each completed workspace save broadcasts `uos:program-ready`; Register refreshed its table by clearing the entire table body. That detached the open module drawer and its focused input. Subsequent reattachment and focus restoration could not reliably preserve uninterrupted editing.

Register now reconciles rows while retaining the drawer that contains the currently mounted module. Summary rows still refresh, but the active module stays connected. Returning to the ordinary Register detail view rebuilds its details normally. This shared correction covers modules hosted in Register drawers rather than adding Quote-only focus restoration.

The existing captured draft snapshots and serialized workspace mutations preserved the latest text during the reproduction. No save coalescing, deferred flush contract or storage-schema change was added: these would expand the persistence change without addressing an additional demonstrated defect. Existing save failures continue through the app's save-failure handling; the correction does not clear in-memory editor input.

## Verification

Four focused desktop cases passed: NSA and EVT privacy editing, and NSA and EVT delayed Quote autosave. Before correction, the delayed-save case failed focus retention after completion. After correction it verifies no removed subtree contains the active input, the original node stays focused, selection and latest text survive save completion, and the latest text remains after navigating away and back. Syntax and whitespace checks passed. No screenshots, mobile tests or full battery were run.

Source regression: `tests/browser/privacy-editing.spec.js` (included in the desktop core selection). No Git publication performed.
