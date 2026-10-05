# Workspace Reset Plan — Hort Ops Offline App

> **Written for Antigravity to execute.**  
> Goal: Add a "Reset Workspace" feature that wipes all persisted browser storage
> and returns the app to factory defaults (seed data from `js/data/`).

---

## Background

The app persists its entire workspace in `localStorage` under these keys:

| Key | Notes |
|-----|-------|
| `hort_ops_workspace_v2` | **Primary** — current schema (v2 envelope) |
| `hort_ops_workspace_v1` | Legacy V1 key (written by migrationEngine) |
| `hort_ops_jobs_offline` | Very-old legacy job data |
| `hort_ops_staff_offline` | Very-old legacy staff data |
| `hort_ops_assignments_offline` | Very-old legacy assignments |
| `hort_ops_permits_offline` | Very-old legacy permits |
| `hort_ops_budget_offline` | Very-old legacy budget |

On load, `HortOpsStorage.loadWorkspace()` reads `hort_ops_workspace_v2` first,
falls back to `hort_ops_workspace_v1`, then tries the five legacy keys. Clearing
**all of the above** guarantees a clean load from seed data.

No dedicated "Reset Workspace" UI exists today. This plan adds it end-to-end.

---

## Scope of Work

### 1. Add `resetWorkspace()` to `HortOpsStorage` — `js/utils/storage.js`

Add a new public method after `remove:` and before `createWorkspaceEnvelope:`.
It must:
1. Call `window.localStorage.removeItem(k)` for every known `hort_ops_*` key.
2. Wipe `window.HortOpsStorageDriver.memory = {}` (the in-memory fallback cache).
3. Return `true` on success, `false` if an exception is caught.

```js
resetWorkspace: function() {
  var keysToRemove = [
    this.WORKSPACE_STORAGE_KEY,
    this.LEGACY_V1_KEY,
    'hort_ops_jobs_offline',
    'hort_ops_staff_offline',
    'hort_ops_assignments_offline',
    'hort_ops_permits_offline',
    'hort_ops_budget_offline'
  ];
  try {
    keysToRemove.forEach(function(k) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(k);
      }
    });
    if (window.HortOpsStorageDriver) {
      window.HortOpsStorageDriver.memory = {};
    }
    return true;
  } catch (e) {
    console.error('resetWorkspace failed:', e);
    return false;
  }
},
```

Also add a matching `resetWorkspace()` to `window.HortOpsStorageDriver`
in `js/utils/storage/storageDriver.js` (same logic, no delegation layer).

---

### 2. Add `resetToDefaults()` to `HortOpsApp` — `js/app.js`

Place this method after `restoreWorkspaceJson:`. It calls `resetWorkspace()` then
re-hydrates state from seed data (mirrors the `init()` flow):

```js
resetToDefaults: function() {
  var storage = window.HortOpsStorage;
  var data = window.HortOpsData;
  var scheduler = window.HortOpsScheduler;
  storage.resetWorkspace();
  var ws = storage.loadWorkspace(data.INITIAL_JOBS, data.STAFF_ROSTER, scheduler.DEFAULT_BUDGET_SETTINGS);
  this.state.jobs              = ws.jobs;
  this.state.staffList         = ws.roster;
  this.state.customAssignments = ws.assignments;
  this.state.rostering         = ws.rostering || { instructions: {}, provenance: {} };
  this.state.customPermits     = ws.permits;
  this.state.budgetSettings    = ws.budgetSettings;
  this.state.recoveryRequired  = false;
  this.state.recoverySource    = undefined;
  this.state.recoveryError     = undefined;
  this.state.activeView        = 'forward_planner';
  this.state.currentYear       = new Date().getFullYear();
  this.recomputeDigest();
  this.renderCurrentView();
  if (window.HortOpsHeader && typeof window.HortOpsHeader.updateStorageHealthIndicator === 'function') {
    window.HortOpsHeader.updateStorageHealthIndicator('saved');
  }
},
```

---

### 3. Add `openResetWorkspaceModal()` to `HortOpsApp` — `js/app.js`

Add alongside the other modal openers (`openExportModal`, `openImportModal`, etc.):

```js
openResetWorkspaceModal: function() {
  if (window.HortOpsResetWorkspaceModal && typeof window.HortOpsResetWorkspaceModal.open === 'function') {
    window.HortOpsResetWorkspaceModal.open();
  }
},
```

---

### 4. Add a Reset Workspace button to the Header — `js/components/header.js`

Insert a trash-icon button into the `header-actions` div, **to the left of**
the storage health pill. Use the existing icon-button pattern:

- **ID**: `btn-header-reset-workspace`
- **Icon**: `window.HortOpsIcons.render('trash', 'w-4 h-4')`
- **aria-label / data-tooltip**: `Reset Workspace`
- **onclick**: `window.HortOpsApp.openResetWorkspaceModal()`
- **Classes**: `btn-header-action btn-header-icon-action has-tooltip`

Add a red tint hover style in `css/style.css`:

```css
#btn-header-reset-workspace:hover {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.4);
  color: #ef4444;
}
```

---

### 5. Create Confirmation Modal — `js/components/resetWorkspaceModal.js` (NEW FILE)

Follow the exact pattern of `js/components/exportModal.js` or `importModal.js`.
Expose as `window.HortOpsResetWorkspaceModal` with `open()` and `close()` methods.

**Modal content:**

```
Warning: Reset Workspace

This will permanently wipe all your saved data from this browser, including:
  - All jobs and schedules
  - All staff assignments and rostering instructions
  - All custom permits and budget settings
  - All Hort Ops localStorage keys (current and legacy)

The app will reload with factory-default seed data.

  [ Cancel ]   [ Reset Workspace ]
```

- **Cancel** calls `close()`.
- **Reset Workspace** (styled as a danger/red button) calls:

  ```js
  window.HortOpsApp.resetToDefaults();
  window.location.reload();
  ```

The modal must be accessible: `role="dialog"`, focus-trapped, Escape key closes it.

---

### 6. Register the new modal in `index.html`

Add a script tag **after all other component scripts** and **before** `js/app.js`:

```html
<script src="js/components/resetWorkspaceModal.js"></script>
```

Inspect how other modals inject their DOM root. If they use a static div, add:

```html
<div id="reset-workspace-modal-root"></div>
```

immediately before the closing `</body>` tag, matching the existing pattern.

---

## Files to Modify / Create

| File | Type | Change |
|------|------|--------|
| `js/utils/storage.js` | MODIFY | Add `resetWorkspace()` method |
| `js/utils/storage/storageDriver.js` | MODIFY | Add `resetWorkspace()` method |
| `js/app.js` | MODIFY | Add `resetToDefaults()` and `openResetWorkspaceModal()` |
| `js/components/header.js` | MODIFY | Add Reset Workspace icon-button |
| `css/style.css` | MODIFY | Add hover rule for reset button |
| `js/components/resetWorkspaceModal.js` | NEW | Confirmation modal component |
| `index.html` | MODIFY | Add script tag + modal root div |

---

## Verification Steps

After all changes are made:

1. **Run tests**: `npm test` — all existing release gate tests must still pass.

2. **Serve the app**:
   ```bash
   python3 -m http.server 8080 --directory /home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline
   ```

3. **Smoke test** (manual or Playwright headless):
   - Load `http://localhost:8080`.
   - Make any change (edit a job, reassign staff).
   - Open DevTools > Application > Local Storage — confirm `hort_ops_workspace_v2` has data.
   - Click the Reset Workspace (trash) button in the header.
   - Confirm the confirmation modal appears with all bullet-point warnings.
   - Click **Reset Workspace** in the modal.
   - After page reload, verify:
     - `hort_ops_workspace_v2` and all other `hort_ops_*` keys are **gone** from Local Storage.
     - App shows factory seed jobs and staff (from `js/data/`).
     - Active view is Forward Planner.
     - Storage health pill shows green "Saved".

4. **Session-only edge case** — Simulate localStorage unavailable (DevTools quota = 0).
   Confirm the reset runs without throwing and the page reloads cleanly.

---

## Notes for Antigravity

- **Do NOT call `localStorage.clear()`**. Use targeted `removeItem()` for only
  the known `hort_ops_*` keys to avoid wiping unrelated browser origin data.
- **`window.location.reload()` is intentional** — it ensures all in-memory module
  state, digest caches, and rendered DOM are rebuilt cleanly from fresh storage.
- **Match the ES5 code style exactly**: `var`, no arrow functions, no template
  literals, single quotes throughout. The codebase is ES5-compatible by convention.
- If any Node test script stubs `HortOpsStorage` and a test fails because
  `resetWorkspace` is undefined on the stub, add it to the stub object.
