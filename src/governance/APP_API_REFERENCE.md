# Horticulture Program Planner API Reference

The application is browser-only: it makes no remote HTTP calls. Its supported integration surface is `window.UOS`, browser events, and local IndexedDB persistence.

## Workspace and application APIs

| Namespace | Public calls |
|---|---|
| `UOS.ProgramApp` | `init`, `render`, `navigate`, `workspace`, `snapshot`, `updateWorkspace`, `adoptWorkspace`, `setWorkingContext`, `syncToolbarPrerequisites`, `evaluateShortcutRule`, `deleteStoredWorkspace`, `clearInMemory`, `restoreStoredData`, `reviewLegacyData`, `resolveDeepLink`, `entityById` |
| `UOS.ProgramModel` | `blank`, `normalize`, `validate`, `assertValid`, `exportJson`, `importJson`, `promoteRegisterRecord`, Register/Project lookup helpers, location and work-geometry CRUD, deletion-impact helpers, legacy normalizers, payment-allocation helpers, and spatial invariant checks |
| `UOS.ProgramStorage` | `get`, `getRaw`, `getStrict`, `save`, `saveValidated`, `recoverLastVerified`, `deleteStoredWorkspace`, `factoryReset`, migration-state calls, `stageLegacySources` |
| `UOS.storage` | `get`, `getStrict`, `set`, `remove`, `commitRevision`, `getLastVerified`, `promoteVerified`, `restoreVerified`, `removeWorkspaceState`, `acquireLease`, `renewLease`, `takeOverLease`, `releaseLease` |

Use `UOS.ProgramApp.updateWorkspace(mutator, options)` for normal writes. It clones, validates, revision-checks, and persists the replacement workspace.

## Operational APIs

| Namespace | Public calls |
|---|---|
| `UOS.ProgramPlannerModel` | `eventTemplates`, `isOperationalTask`, `updateTask`, `createTask`, `saveTask`, `duplicateTasks`, `createDraftJob`, `scheduleTask` |
| `UOS.ProgramPlanner` | `init`, `render`, Project/row selection, task editor, save, duplicate, and delete actions |
| `UOS.ProgramSchedulerModel` | Job normalization, validation, scheduling, and source-lineage helpers |
| `UOS.ProgramSchedulerUI` | `init`, `render`, `selectJob`, `focusCalendarJob`, `routeCalendarJob`, `backToList`, `snapshot` |
| `UOS.ProgramCosting` | Rate-item CRUD, job/line CRUD, `refreshLineFromRate`, `assignLine`, `totals`, `jobCalculator`, adjustments, catalogue queries/grouping, `exportRateCsv` |
| `UOS.rateLibrary` | Rate-library CSV import/export and catalogue helpers |
| `UOS.WorkAreaService` | `eligibleSpatialRatesForWorkType`, `mappedRateIds`, `isMappedRate`, `canonicalWorkTypeRateItems` |
| `UOS.ProgramRegister` | Register UI controller methods |
| `UOS.ProgramBudget` | Annual budget/allocation creation and approval, adjustments, charging/release, close/reopen, carry-forward, balances, validation |
| `UOS.ProgramBudgetUI` | `openAllocation`, `openCarryForward`, `render`, `hasConfirmedCarryForward` |
| `UOS.ProgramQuotes` | Draft/update, readiness, issue/accept/decline, revision, payment, summary, deletion, total APIs |

## Data, status, and shared APIs

| Namespace | Public calls |
|---|---|
| `UOS.ProgramData` | `stage`, `apply`, JSON/ZIP import/export, GeoJSON output, PDF receipt parsing, identity/isolation checks, workspace slicing |
| `UOS.ProgramDataSettings` | `create`, `mount`, `inspectFile` |
| `UOS.ProgramDataHealth` | `check` |
| `UOS.ProgramStatus` | Status-code, transition, and validation helpers |
| `UOS.ProjectFunding` | Financial summary and funding/readiness helpers |
| `UOS.imports` | Text/JSON/PDF/CSV readers, downloads, UUID, formatting, clone helpers |
| `UOS.smartImport` | Import-target registration, listing, detection, and staging |
| `UOS.xlsxReader` | `read`, `rows`, `headers`, `rateRows` |
| `UOS.dialogs` | `open`, `confirm`, `alert`, `close` |
| `UOS.preferences` | `get`, `set`, `apply` |
| `UOS.toast` | Notification function: `(message, severity)` |

## Events and reset

The app emits `uos:program-ready`, `uos:workspace-changed`, and `uos:program-save-error`. Event data is a snapshot; use `updateWorkspace` for persisted changes.

Open either application with `?factory-reset=1` to remove its local workspace, recovery, and migration records, then create a blank Register-first workspace with the default Rate Library. The query flag is removed immediately after use.
