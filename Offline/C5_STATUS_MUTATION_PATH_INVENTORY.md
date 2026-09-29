# C5 Status Mutation Path Inventory

Date: 2026-09-21

Milestone state: C5 OPEN / AUTHORISED

This inventory was completed before C5 production-source changes. Its purpose is to identify every lifecycle-status mutation path and distinguish the canonical writer from compatibility readers and obsolete writable paths.

| Location | Path | Classification | C5 disposition |
| --- | --- | --- | --- |
| `src/program-planner/js/status.js` | `transition(...)` updates the entity's current status and appends one `statusEvent` | CANONICAL | Retain as the sole active lifecycle-status writer. |
| `src/program-planner/js/status.js` | `reconcileMutation(...)` converts governed status changes into a canonical transition | CANONICAL | Retain. Verify that one transition creates exactly one event. |
| `src/program-planner/js/status-app.js` | ProgramApp status commands and recommendation decisions delegate to ProgramStatus | CANONICAL | Retain. |
| `src/program-planner/js/status-ui.js` | `data-status-command` lifecycle controls collect actor/reason/confirmation and call ProgramApp | CANONICAL | Retain as the active status UI. |
| `src/program-planner/js/status.js` | Migration reads legacy `statusHistory`, creates deterministic migration `statusEvents`, then removes legacy arrays from the migrated workspace | MIGRATION / READ-ONLY COMPATIBILITY | Retain. Legacy evidence must remain readable through canonical migration without fabrication. |
| `src/program-planner/js/data-workspace.js` | Import merge carries existing `statusHistory` and `statusEvents` data | MIGRATION / READ-ONLY COMPATIBILITY | Retain import compatibility; it must not become an interactive writer. |
| `src/program-planner/js/register.js` | Record normalisation reads legacy `statusHistory` for display | MIGRATION / READ-ONLY COMPATIBILITY | Retain only as a read-only pre-migration display fallback. |
| `src/program-planner/js/register.js` | `renderStatusHistory(...)` renders legacy history and currently emits delete controls | OBSOLETE WRITABLE PATH | Keep read-only rendering; remove delete controls. |
| `src/program-planner/js/register-history-ui.js` | Renders canonical `statusEvents` in the Register drawer | CANONICAL READ MODEL | Retain. |
| `src/program-planner/js/register.js` | NSA and EVT timeline sections render editable `status` / `statusDate` controls | OBSOLETE WRITABLE PATH | Remove structurally. Preserve non-lifecycle fields such as EVT priority. |
| `src/program-planner/js/register.js` | Generic detail sections render editable `status` / `statusDate` controls | OBSOLETE WRITABLE PATH | Remove structurally. |
| `src/program-planner/js/register.js` | `data-register-action="add-status-history"` buttons | OBSOLETE WRITABLE PATH | Remove structurally. |
| `src/program-planner/js/register.js` | `addStatusHistoryEntry(...)` pushes to `record.statusHistory` / `record.raw.statusHistory` and persists it | OBSOLETE WRITABLE PATH | Delete. |
| `src/program-planner/js/register.js` | `deleteStatusHistoryEntry(...)` splices legacy evidence and persists it | OBSOLETE WRITABLE PATH | Delete. Historical lifecycle evidence is not user-deletable. |
| `src/program-planner/js/register.js` | Generic edit handler writes `status` / `statusDate` directly | OBSOLETE WRITABLE PATH | Reject lifecycle keys and remove direct status-specific propagation. |
| `src/program-planner/js/register.js` | Generic persistence maps status aliases and can copy `statusHistory` | OBSOLETE WRITABLE PATH | Remove lifecycle-specific write propagation from this path. |
| `src/program-planner/js/status-ui.js` | Hides legacy Register lifecycle controls after render | OBSOLETE PRESENTATION SHIM | Remove once those controls are structurally absent; do not rely on hidden DOM for acceptance. |

## Canonical invariant

After C5, an operator lifecycle change must flow through the governed status command and produce one atomic outcome: the entity current status changes and exactly one canonical `statusEvent` is appended. No active UI or generic Register edit path may create, update, append, or delete `statusHistory`.

Historical legacy data remains import-compatible and readable through deterministic migration. C5 does not erase genuine history, invent missing events, or modify unrelated record fields.
