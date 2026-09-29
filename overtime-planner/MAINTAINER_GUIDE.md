# Adelaide City Council — Horticulture Operations Maintenance & Architecture Guide

## 1. System Philosophy: The Synthetic Operational Substrate

The Adelaide City Council Horticulture Operations Overtime & Workforce Planning Suite is engineered as a **synthetic operational substrate** — an operationally resilient, multi-stack planning platform designed for both human municipal coordinators and autonomous AI agents.

The application exists in two parallel, structurally isomorphic implementations:
1. **Live React 18 Application (`src/`)**: A TypeScript/Tailwind SPA utilized for interactive cloud/intranet deployments, featuring real-time state synchronization, rich visualizations, and developer tooling.
2. **Standalone Offline Edition (`Offline/`)**: A 100% zero-dependency, vanilla ES6+ and native CSS single-page application that operates directly from the local filesystem (`file://`) without internet connectivity, local HTTP servers, Node.js, or external CDN assets.

Both implementations maintain strict algorithmic and behavioral parity: they consume the same entity schemas, execute identical scheduling heuristics, enforce identical qualification and rest constraints, and yield byte-level equivalent overtime allocations.

---

### Dual-Stack Parity Matrix

```
+------------------------------------+------------------------------------+--------------------------------------------+
| Operational Subsystem              | Live React 18 Stack (`src/`)       | Standalone Offline Stack (`Offline/`)      |
+------------------------------------+------------------------------------+--------------------------------------------+
| Forward Planner 2.0 (Matrix)       | src/components/ForwardPlannerView  | Offline/js/components/forwardPlanner.js    |
| Monthly Overtime Calendar          | src/components/MonthlyCalendar     | Offline/js/components/calendarView.js      |
| Job Catalog & Archetype Manager    | src/components/JobRegistry         | Offline/js/components/jobRegistry.js       |
| Workforce Directory & Registry     | src/components/StaffRegistry       | Offline/js/components/staffRegistry.js     |
| Peak Demand & Clash Analyzer       | src/components/PeakWeekendsView    | Offline/js/components/peakWeekends.js      |
| EA Overtime Budget & Analytics     | src/components/AnalyticsDashboard  | Offline/js/components/analytics.js         |
| Staged Crew Allocator Modal        | src/components/StaffAssignModal    | Offline/js/components/staffAssignModal.js  |
| Job Definition & Archetype Modal   | src/components/JobEditModal        | Offline/js/components/jobEditModal.js      |
| Overtime Exemption Manager         | src/components/StaffExemptionModal | Offline/js/components/staffExemptionModal.js|
| JSON Backup Exporter               | src/components/ExportModal         | Offline/js/components/exportModal.js       |
| JSON & CSV Roster Importer         | src/components/ImportModal         | Offline/js/components/importModal.js       |
| Scheduling & Temporal Engine       | src/utils/scheduler.ts             | Offline/js/utils/scheduler.js              |
| Eligibility & Qualification Engine | src/utils/eligibilityEngine.ts     | Offline/js/utils/eligibilityEngine.js      |
| 3-Way Workforce Reconciliation     | src/utils/reconciliationEngine.ts  | Offline/js/utils/reconciliationEngine.js   |
| External CSV Roster Parser         | src/utils/userCsvParser.ts         | Offline/js/utils/userCsvParser.js          |
| Unified Persistence & Schema v2    | localStorage / IndexedDB           | Offline/js/utils/storage.js                |
| Security & XSS Sanitization        | React Virtual DOM Escaping         | Offline/js/utils/securityUtils.js          |
| Modal Isolation & Scroll Lock      | Radix / Headless UI Portals        | Offline/js/utils/modalUtils.js             |
| Dimension-Safe SVG Icon Engine     | lucide-react                       | Offline/js/utils/icons.js                  |
+------------------------------------+------------------------------------+--------------------------------------------+
```

---

## 2. The 8-Layer Tower of Linked Abstractions

The planning system is organized as an interconnected **8-Layer Tower of Linked Abstractions**. Each layer strictly isolates operational concerns, provides deterministic API guarantees, and prevents side-effect leakage to adjacent layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│  Layer 8: Security Sanitization & Event Delegation (securityUtils.js)  │
│  Context-aware HTML/attr escaping; data-team attribute click delegation│
├────────────────────────────────────────────────────────────────────────┤
│  Layer 7: Modal Isolation & Scroll Containment Engine (modalUtils.js)  │
│  Two-phase scroll lock; background scroll restoration; 520px viewport  │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 6: Staged Crew Allocation State Machine (staffAssignModal.js)   │
│  Transactional staging; draft mutations; atomic commit / roll-back    │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 5: Regulatory Compliance & Permit Tracking (WZTM / TPO Permits) │
│  Traffic control & tree protection permit flags; overtime exemptions   │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 4: Multi-Tier Preference & Exclusion Matching (initialJobs.js)  │
│  Primary / Secondary / Tertiary suitability; historical team isolation │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 3: Workforce Lifecycle & Qualification Model (staffRoster.js)   │
│  5-state lifecycle (active/departed/...); plant operator ticketing     │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 2: Universal Temporal Engine & Digest Materializer (scheduler) │
│  Fri/Sat/Sun/Mon recurrence; annuals; one-offs; universal overrides   │
├────────────────────────────────────────────────────────────────────────┤
│  Layer 1: Canonical Workspace Schema v2 & Storage Boundary (storage)   │
│  schemaVersion: 2; authoritative v2 key; non-destructive quarantine    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Schema & Core Entities

### 3.1 Canonical Workspace Schema v2 Contract
All persisted state and export/import backup files conform strictly to **Workspace Schema v2**. Any backup or persisted record must adhere to this contract:

```typescript
interface WorkspaceEnvelopeV2 {
  schemaVersion: 2;                          // Strictly integer 2 (not coerced)
  lastSaved: string;                         // ISO-8601 UTC timestamp
  jobs: JobDefinition[];                     // Array of operational job definitions
  roster: StaffMember[];                     // Array of depot staff members
  assignments: {                             // Shift allocation dictionary
    [shiftOrOccurrenceId: string]: string[]; // Array of assigned staff IDs
  };
  permits: {                                 // Regulatory permit records
    [shiftOrOccurrenceId: string]: {
      wztmPermit?: boolean;                  // Work Zone Traffic Management Permit
      tpoPermit?: boolean;                   // Tree Protection Order Permit
    };
  };
  budgetSettings: {                          // EA overtime budget costing parameters
    hourlyRates: { [role: string]: number };
    weekendMultipliers: { saturday: number; sunday: number; publicHoliday: number };
    seasonalMultipliers: { high: number; low: number };
  };
  uiState: {                                 // Viewport and session persistence
    activeView?: string;                     // 'forward_planner' | 'calendar' | ...
    currentYear?: number;                    // Target fiscal planning year (2020-2040)
  };
  recoveryRequired?: boolean;                // Present when stored source is quarantined
  recoverySource?: string;                   // Storage key that failed validation
  recoveryError?: string;                    // Diagnostic reason for quarantine
}
```

#### Persistence & Version Contract Invariants (Symmetric Read & Write Boundary):
1. **Canonical Schema Version Invariant**: `validateWorkspaceSchema()` strictly requires integer `schemaVersion === 2`. Missing versions, `null`, strings (`"2"`), legacy versions (`1`), or future versions (`3`, `99`) are immediately rejected.
2. **Pre-Write Validation Boundary (`saveWorkspace`)**: Candidate workspaces and direct restore envelopes are validated against canonical Schema v2 **before** calling `localStorage.setItem()`. Invalid data is rejected with `{ ok: false, stage: 'validation', storageMode: 'unchanged' }`, preserving existing stored workspaces byte-for-byte unchanged and preventing spurious entry into `Recovery Required`.
3. **Authoritative Presence of V2 Key (Fail-Closed Read Boundary)**: If `localStorage.getItem('hort_ops_workspace_v2') !== null`, that key is authoritative. If it contains invalid JSON, a non-object payload (`null`, string, number, boolean, array), or unsupported schema version, the application enters `Recovery Required`. It **never** rolls back to stale legacy v1 data.
4. **Non-Destructive Quarantine**: Corrupted or invalid sources are preserved byte-identical in storage. Auto-save is suspended (`saveCurrentWorkspace() === false`), and defaults are **never** written over the damaged source.
5. **Clean-Slate Default Invariant**: Initial default workspaces are created **only** when no storage source exists at all (`rawV2 === null && rawV1 === null && !hasAnyLegacyKey`).
6. **Recovery Mode Exit**: Restoring a valid JSON backup via `restoreWorkspaceJson()` explicitly clears `recoveryRequired = false`, clears `recoverySource` and `recoveryError`, sets `storageStatus = 'saved'`, updates the header pill, and re-enables normal saves without requiring a browser reload.

---

### 3.2 Job Definition (`JobDefinition`)
Located in [`Offline/js/data/initialJobs.js`](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline/js/data/initialJobs.js) and [`src/data/initialJobs.ts`](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/src/data/initialJobs.ts):

```typescript
interface JobDefinition {
  id: string;                                // Regex: ^[A-Za-z0-9_-]+$ (Globally unique)
  name: string;                              // Descriptive municipal title
  department: string;                        // Operational division (e.g. 'Parks & Gardens')
  primaryTeam: string;                       // Primary municipal team
  secondaryTeam?: string;                    // Secondary fallback team
  tertiaryTeam?: string;                     // Tertiary fallback team
  exclusiveTeams?: string[];                 // Hard constraint: only listed teams eligible
  status: 'active' | 'inactive' | 'resolved' | 'draft' | 'archived'; // Fail-closed allow-list
  frequencyType: 'recurring_weeks' | 'recurring_cadence' | 'annual' | 'one_off';
  intervalWeeks?: number;                    // Recurrence cadence (e.g. 2 for fortnightly)
  preferredDay?: 'friday' | 'saturday' | 'sunday' | 'monday' | 'friday_pre_holiday' | 'monday_post_holiday';
  anchorDate?: string;                       // YYYY-MM-DD (Must fall on preferredDay weekday)
  targetMonth?: number;                      // 1-12 (Required for annual jobs)
  targetDate?: string;                       // YYYY-MM-DD (Required for one_off jobs; Fri-Mon only)
  crewSize: number;                          // Target employee headcount
  requiresPlantOperator?: boolean;           // True if ticketed plant operator mandatory
  description?: string;                      // Scope of work & location notes
}
```

#### Schedulability Fail-Closed Invariant:
In `scheduler.js`, a job generates shifts **if and only if**:
```javascript
String(job.status || '').trim().toLowerCase() === 'active'
```
Any job with missing, null, undefined, `'draft'`, `'inactive'`, or `'archived'` status produces strictly **0 generated shifts**.

---

### 3.3 Staff Member Schema (`StaffMember`)
Located in [`Offline/js/data/staffRoster.js`](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline/js/data/staffRoster.js) and [`src/data/staffRoster.ts`](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/src/data/staffRoster.ts):

```typescript
interface StaffMember {
  id: string;                                // Regex: ^[A-Za-z0-9_-]+$ (e.g. 'EMP-012')
  name: string;                              // Full legal name
  department: string;                        // Department hierarchy parent
  team: string;                              // Active municipal team
  status: 'active' | 'departed' | 'inactive' | 'on_leave' | 'temporarily_unavailable';
  isPlantOperator?: boolean;                 // Heavy plant & machinery certification
  baseRate?: number;                         // Base hourly rate under SA Council EA
  exemptions?: {                             // Overtime constraints
    noWeekends?: boolean;
    maxConsecutiveWeekends?: number;
  };
}
```

#### Workforce Integrity Invariants:
1. **Departed Exclusion**: Staff with `status === 'departed'` or `'inactive'` are hard-excluded from shift assignment, auto-allocation candidate pools, and the active department hierarchy dropdowns (`getDepartmentHierarchy()`).
2. **Plant Operator Enforcement**: If `job.requiresPlantOperator === true`, the assigned crew must contain at least one staff member with `isPlantOperator === true`. If absent, the scheduler flags an integrity violation pill.
3. **Historical Team Preservation**: When editing jobs with historical or retired teams not present in the current active roster, `renderTeamOptionsGrouped()` retains the team inside a dedicated `<optgroup label="Preserved / Historical Teams">` to prevent accidental erasure on save.

---

### 3.4 Operational Baseline Invariants (Year 2026)
Across both stacks, the 2026 calendar year schedule must strictly evaluate to:
- **Total Schedule Rows**: Exactly **93 rows** (84 baseline recurring weekend shifts + 9 one-off shifts).
- **Unique Shift IDs**: Exactly **93 unique IDs**, strictly **0 duplicates**.
- **Baseline Projected Cost**: **$269,672.80** (under default EA budget settings).

---

## 4. Forward Planner 2.0 Matrix Architecture

The Forward Planner provides a 52-week capacity planning grid designed for high-density municipal operations:

### 4.1 Split Saturday & Sunday Day Columns
Rather than collapsing weekends into a single composite cell, the grid renders distinct sub-columns for Saturday and Sunday (along with Friday pre-holiday and Monday post-holiday columns where applicable), preventing multi-shift collision ambiguity.

### 4.2 Two-Tier Header System
- **Tier 1 (Date Header)**: Month grouping, calendar dates (`10 Oct`), and public holiday badge indicators.
- **Tier 2 (Week Number & Metrics)**: ISO week numbers (`Wk 41`), total scheduled headcount, and arterial clash alerts.

### 4.3 Optimal Contiguous Job Grouping Algorithm
To prevent visual fragmentation when staff members work across multiple projects, the grid executes an optimal contiguous clustering algorithm:
```javascript
// Adjacent shared-crew clustering algorithm:
shifts.forEach(shift => {
  const existingIndices = [];
  rows.forEach((row, idx) => {
    if (shift.assignedStaffIds.includes(row.staffId)) existingIndices.push(idx);
  });
  const unplacedStaff = shift.assignedStaffIds.filter(id => !rows.some(r => r.staffId === id));
  if (existingIndices.length > 0) {
    rows.splice(Math.min(...existingIndices), 0, ...unplacedStaff.map(id => ({ staffId: id, jobId: shift.jobId })));
  } else {
    rows.push(...unplacedStaff.map(id => ({ staffId: id, jobId: shift.jobId })));
  }
});
```

### 4.4 Vacancy Rows & Interactive Backfill Trigger
When a shift has fewer allocated staff than its mandated `crewSize`, the grid renders a dedicated vacancy row with an amber warning pill (`Vacancy: N required`). Clicking the vacancy row immediately opens the Crew Allocator pre-filtered to the target shift with candidate recommendations.

---

## 5. Unified CSS Token System for Team Identifiers

Municipal operations rely on immediate visual recognition of team assignments. All teams are assigned dedicated CSS color tokens across both stacks:

```css
:root {
  --team-color-parks: #22c55e;
  --team-color-arboriculture: #15803d;
  --team-color-biodiversity: #16a34a;
  --team-color-squares: #84cc16;
  --team-color-golf: #10b981;
  --team-color-nursery: #059669;
  --team-color-irrigation: #06b6d4;
  --team-color-infrastructure: #3b82f6;
  --team-color-maintenance: #6366f1;
  --team-color-waste: #8b5cf6;
  --team-color-workshop: #a855f7;
  --team-color-open-space: #ec4899;
  --team-color-civil: #f97316;
  --team-color-cleansing: #eab308;
  --team-color-depot-support: #64748b;
}
```

---

## 6. Crew Allocator & Job Editor State Machines

### 6.1 Transactional Staging State Machine (`staffAssignModal.js`)
The Crew Allocator utilizes a transactional staging model:
1. **Modal Open**: Snapshot current `assignedStaffIds` into `stagedStaffIds`.
2. **Draft Mutations**: Adding, removing, or executing "Auto-Fill Team" modifies `stagedStaffIds` in memory only.
3. **Discard**: Clicking **Cancel**, pressing `Escape`, or clicking the backdrop closes the modal and drops staged state without mutating schedule state.
4. **Commit**: Clicking **"Confirm & Save Allocation"** validates qualification requirements (e.g. Plant Operator ticket), writes to application state, triggers recomputation of operational digests, and persists to storage.

### 6.2 Security Architecture & Dynamic Event Delegation
To defend against Cross-Site Scripting (XSS) and DOM injection through user-supplied team names or CSV payloads:
1. **Context-Aware Sanitization**: All interpolated strings pass through `HortOpsSecurityUtils.escapeHtml()` or `escapeAttr()`.
2. **Delegated Event Architecture**: Dynamic team names are **never** interpolated into executable inline JavaScript strings (e.g. `onclick="toggleExclusiveTeam('...')"` is strictly forbidden). Instead, elements render semantic `data-team="..."` attributes, and click handlers are bound once via event delegation on modal container roots.

---

## 7. Modal Lifecycle & Scroll Containment (`modalUtils.js`)

To prevent background page jump and scroll chaining during modal inspection:
1. **Two-Phase Scroll Lock**: Opening a modal reads `window.scrollY`, adds `.modal-open` (`overflow: hidden`) to both `document.documentElement` and `document.body`, and anchors scroll position.
2. **Scroll Isolation**: The modal body carries `data-modal-scroll-target="true"`. Touch and wheel events inside the modal body scroll internally without leaking scroll deltas to the page background.
3. **Clean Restoration**: Closing the modal restores `overflow` styles and immediately restores `window.scrollTo(0, savedScrollY)`.
4. **Short Viewport Resilience**: Modals feature max-height bounds (`calc(100vh - 40px)`), sticky headers, and scrollable bodies that remain fully functional down to 520px viewport heights.

---

## 8. Dual Component Architecture & File Tree

### 8.1 Standalone Offline Edition (`Offline/`) ? Dual Architecture

The Offline Edition implements a dual architecture balancing developer maintainability with 100% serverless, zero-network, single-file distribution:
- **Modular Development Template (`index.modular.html`)**: References `css/style.css` and the 26 JavaScript files individually for modular refactoring, inspection, and static analysis.
- **Compiled Single-File Application (`index.html` & `dist/hort_ops_offline_planner.html`)**: An automated compiler (`scripts/build_single_file.cjs`) inlines all CSS and 26 JS scripts in dependency order into an authoritative static self-contained HTML file (~558 KB) runnable directly via `file://`.

```
Offline/
??? index.html                           # Compiled, 100% self-contained single-file HTML application (file:// target)
??? index.modular.html                   # Modular developer template referencing individual CSS & JS files
??? README.md                            # Offline distribution documentation
??? package.json                         # Build scripts (`npm run build`) & release gate runners (`npm test`)
??? sample-overtime-source.json          # Reference Schema v2 import dataset
??? dist/
?   ??? hort_ops_offline_planner.html    # Standalone single-file distribution bundle
??? css/
?   ??? style.css                        # CSS design tokens, responsive rules, modal layouts
??? js/
?   ??? app.js                           # Master coordinator, state store, and URL hooks
?   ??? components/
?   ?   ??? header.js                    # Top navigation, year picker, and storage health pill
?   ?   ??? forwardPlanner.js            # 52-week capacity matrix & contiguous grouping
?   ?   ??? calendarView.js              # Monthly overtime calendar & shift cards
?   ?   ??? jobRegistry.js               # Job catalog & slideout detail drawer
?   ?   ??? staffRegistry.js             # Workforce directory & qualification filters
?   ?   ??? peakWeekends.js              # High-density clash & conflict analyzer
?   ?   ??? analytics.js                 # Overtime budget projections & expenditure profiles
?   ?   ??? staffAssignModal.js          # Staged crew allocator with delegated team chips
?   ?   ??? jobEditModal.js              # Job editor with multi-tier & historical team options
?   ?   ??? staffExemptionModal.js       # Employee overtime exemption rules manager
?   ?   ??? exportModal.js               # Canonical Schema v2 JSON backup exporter
?   ?   ??? importModal.js               # JSON / CSV roster import and preview modal
?   ??? data/
?   ?   ??? initialJobs.js               # Canonical municipal job definitions
?   ?   ??? staffRoster.js               # 253-staff municipal roster & hierarchy
?   ?   ??? holidays.js                  # Gazetted South Australian public holidays (2025-2028)
?   ?   ??? historicalOccurrences.js     # Explicit historical actuals dataset
?   ??? utils/
?       ??? icons.js                     # Local dimension-safe SVG icon engine
?       ??? dateUtils.js                 # Date arithmetic, weekday checks, ISO week numbering
?       ??? scheduler.js                 # Schedule materialization, clash detection, costing
?       ??? eligibilityEngine.js         # Rest rule (10h), team suitability, plant tickets
?       ??? reconciliationEngine.js      # 3-Way CSV roster reconciliation
?       ??? userCsvParser.js             # RFC 4180 CSV roster parser
?       ??? securityUtils.js             # HTML and attribute sanitization engine
?       ??? modalUtils.js                # Two-phase scroll lock and modal lifecycle
?       ??? storage.js                   # Canonical Schema v2 persistence, migration, quarantine
??? scripts/
    ??? build_single_file.cjs            # Single-file compiler (inlines CSS + 26 JS files)
    ??? run_all_release_gates.cjs        # Master Automated Release Gates Runner (npm test)
    ??? test_static_release.cjs          # Gate 1: Static syntax & scope audit (26 files)
    ??? test_scheduler.cjs               # Gate 2: Schedulability, overrides, and invariants
    ??? test_workforce.cjs               # Gate 3: Staff lifecycle and qualification rules
    ??? test_persistence.cjs             # Gate 4: Schema v2 persistence & quarantine (40 tests)
    ??? test_browser_smoke.cjs           # Gate 5: Serverless Playwright headless browser smoke suite (file://)
```

---

## 9. Developer & Maintainer Operations

### 9.1 The 5 Master Automated Release Gates
Every release candidate must pass 100% of the automated release gates before distribution:

```bash
# Execute the full suite via npm:
npm test

# Or execute directly via Node:
node scripts/run_all_release_gates.cjs
```

#### The 5 Verification Gates:
1. **[Gate 1/5] Static Syntax & Helper Scope Audit (`scripts/test_static_release.cjs`)**:
   Parses all 26 JavaScript and HTML release files using Node's `vm.Script` compiler to guarantee zero syntax errors, undeclared variables, or broken script tags.
2. **[Gate 2/5] Scheduler Engine Invariants (`scripts/test_scheduler.cjs`)**:
   Verifies fail-closed status filtering (`status === 'active'`), universal date overrides, annual jobs, one-offs, and confirms the 2026 baseline: 93 rows, 93 IDs, 0 duplicates, cost $269,672.80.
3. **[Gate 3/5] Workforce Lifecycle & Assignment Integrity (`scripts/test_workforce.cjs`)**:
   Validates 5-state roster lifecycle, hard exclusion of departed staff, 10-hour mandatory rest rules, and plant operator requirements.
4. **[Gate 4/5] Persistence Contract & JSON Schema Validation (`scripts/test_persistence.cjs`)**:
   Executes 40 regression tests covering Schema v2 saves, pre-write validation, byte-for-byte storage preservation, non-destructive quarantine, anti-rollback protection, atomic legacy migrations, unsupported version rejection (0, 3, 99, "2"), non-object v2 payload handling, and recovery exit.
5. **[Gate 5/5] Playwright Headless Browser Smoke Suite (`scripts/test_browser_smoke.cjs`)**:
   Spawns Playwright headless Chromium in Ubuntu WSL2 directly navigating to `file://.../index.html` (zero local HTTP server or network sockets) to verify DOM rendering, modal scroll containment, short-viewport (520px) usability, truthful storage pills, and XSS injection click tests under pure serverless execution.

---

### 9.2 Release Packaging Standards

All release packages (e.g. `Offline12.zip`) are built using standard Python `zipfile` automation:

```bash
python3 scratch/package_offline12.py
```

#### Packaging Invariants:
- **Zero `.png` Files**: Strictly no test screenshots or raster images inside the archive.
- **Zero Nested `.zip` Archives**: Strictly no nested archives.
- **Decompression Verification**: Every archive is validated using `unzip -t <archive>.zip` to guarantee 0 decompression errors.

---

### 9.3 URL Testing & Diagnostic Hooks
The standalone offline application supports diagnostic URL parameters:
- `?testVacancy=1`: Removes crew from shift 0 to trigger vacancy rows and backfill pills.
- `?openStaffAssign=1`: Automatically launches the Crew Allocator modal on page load.
- `?openAddJob=1`: Automatically launches the Job Editor modal on page load.
- `?showAll=1`: Bypasses default view limits to display all 253 staff rows in Forward Planner.
- `?view=[view_name]`: Activates a specific view on load (`forward_planner`, `calendar`, `job_manager`, `staff_registry`, `peak_weekends`, `analytics`).

---

### 9.4 Common Maintenance Recipes

#### Recipe A: Adding a New Municipal Team
1. Add team name and metadata to `Offline/js/data/staffRoster.js` and `src/data/staffRoster.ts`.
2. Add color token to `:root` in `Offline/css/style.css` and `src/index.css`:
   `--team-color-[slug]: #[hex];`
3. Add `.team-dot-[slug]` selector referencing the variable.
4. Run `npm test` to verify no broken team references.

#### Recipe B: Adding or Modifying a Job Archetype
1. Append to `Offline/js/data/initialJobs.js` and `src/data/initialJobs.ts`.
2. Ensure `status: 'active'`, `primaryTeam`, and valid `anchorDate` (matching preferred weekday) are provided.
3. Run `npm test` to verify uniqueness and schema compliance.

#### Recipe C: Syncing Updated Council Staff CSV
1. Open the **Import** modal and drop the updated CSV file.
2. The 3-way reconciliation engine displays added, modified, and departed staff.
3. Confirming the import atomically merges personnel changes while preserving active shift assignments.
