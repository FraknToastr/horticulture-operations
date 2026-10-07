# Adelaide Horticulture Operations: Synthetic System Architecture & Agent Control Specification

## 1. Philosophical Grounding: The Agent in the Driver's Seat

This operational architecture is explicitly designed from the perspective of an **AI agent operating in concert with human municipal supervisors**. 

In traditional enterprise applications, user interfaces are optimized for human eyes at the expense of computational legibility. Data models are loosely coupled, domain logic is scattered across UI components, and state mutations lack semantic provenance. For an autonomous or pair-programming agent, this introduces extreme cognitive friction: state must be painfully reverse-engineered from DOM trees, mutations risk unintended side-effects, and tokens are squandered on speculative trial-and-error.

**This system solves that by establishing a unified, synthetic operational substrate.**

Visual rendering is treated merely as a human-facing projection of a deterministic, mathematical state space. Every entity is uniquely and permanently addressed, every business rule is encoded as a pure invariant, and the entire system is organized into an **8-Layer Tower of Linked Abstractions**.

```
       +-------------------------------------------------------------------------+
       |               SYNTHETIC OPERATIONAL SUBSTRATE (STATE SPACE)             |
       +-------------------------------------------------------------------------+
                                            |
                  +-------------------------+-------------------------+
                  |                                                   |
                  v                                                   v
     +--------------------------+                        +--------------------------+
     |   Human Presentation     |                        |   Headless Agent C2      |
     |   Projections            |                        |   Control Plane          |
     +--------------------------+                        +--------------------------+
     | - Live React (src/)      |                        | - window.__HORT_OPS__    |
     | - Standalone Offline     |                        | - window.HortOpsApp      |
     |   (Offline/)             |                        | - Deterministic Digests  |
     | - 52-Week Matrix Grid    |                        | - Two-Phase Commit API   |
     | - Color-Coded Team Dots  |                        | - RTK Token Compression  |
     +--------------------------+                        +--------------------------+
```

---

## 2. The 8-Layer Tower of Linked Abstractions

```
========================================================================================
Layer 7: Collaborative Human-Agent UI & Control Plane
         (window.__HORT_OPS__, window.HortOpsApp, Forward Planner 2.0, Agent Console)
========================================================================================
Layer 6: Operational Synthesis & Friction Oracle
         (Clash Oracle, 10h Fatigue Sentinel, Plant Operator Deficit Monitor, EA Budget)
========================================================================================
Layer 5: Allocation & Historical Integrity Ledger
         (OvertimeAssignment binding Occurrence to Staff with Frozen Team Snapshot)
========================================================================================
Layer 4: Intelligent Suitability & Multi-Tier Preference Graph
         (Tier 1 Primary -> Tier 2 Secondary -> Tier 3 Tertiary -> Hard Exclusion)
========================================================================================
Layer 3: Temporal Materialization Engine
         (Split Saturday/Sunday Grid, Multi-Year 2025-2028, Contiguous Clustering)
========================================================================================
Layer 2: Operational Archetypes & Job Blueprints
         (JobDefinition, Multi-Tier Team Preferences, Hard Exclusive Team Constraints)
========================================================================================
Layer 1: Workforce & Accretive Lifecycle Engine
         (Permanent EMP Identity, 3-Way CSV Sync: Active / Unavailable / Departed)
========================================================================================
Layer 0: Regulatory & Physical Axioms
         (Gazetted SA Public Holidays, Enterprise Agreement Penalty Multipliers)
========================================================================================
```

---

### Layer 0: Regulatory & Physical Axioms
The immutable baseline foundation governing time, industrial agreements, and biological limits:
* **Gazetted SA Public Holidays**:
  Defined in [`src/data/southAustraliaHolidays.ts`](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/src/data/southAustraliaHolidays.ts) and [`Offline/js/data/holidays.js`](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline/js/data/holidays.js). Fixed dates (Australia Day, Anzac Day, Christmas, Proclamation Day) and floating holidays (Adelaide Cup on the 2nd Monday of March, King's Birthday on the 2nd Monday of June, Labour Day on the 1st Monday of October, and the Easter cycle).
* **Industrial Agreement (Award/EA) Overtime Penalties**:
  $$\text{Multiplier}(t) = \begin{cases} 
  1.5 & \text{if Saturday and } t \le 2\text{ hours} \\ 
  2.0 & \text{if Saturday and } t > 2\text{ hours} \\ 
  2.0 & \text{if Sunday} \\ 
  2.5 & \text{if Public Holiday} 
  \end{cases}$$
* **Fatigue & Rest Invariant**:
  $$\Delta t_{\text{rest}} = t_{\text{start}}(\text{Shift}_{n+1}) - t_{\text{end}}(\text{Shift}_n) \ge 10\text{ hours}$$
  Mandatory minimum 10-hour rest break between the conclusion of any prior shift (regular or overtime) and the commencement of an overtime occurrence.

---

### Layer 1: Workforce & Accretive Lifecycle Engine
The human resource substrate preserving permanent identity and lifecycle state:
* **Permanent Entity Identification**: Each employee retains a permanent, immutable identifier (`EMP-001` through `EMP-253`).
* **Accretive Lifecycle State Machine**:
  ```
                 +--------------------------+
                 |          active          |
                 +--------------------------+
                   |        ^             |
                   v        |             v
    +--------------------+  |    +------------------+
    | temp_unavailable / | -+    |     departed     |
    |      on_leave      |       +------------------+
    +--------------------+       (Historical intact,
                                  future unassigned)
  ```
* **3-Way Reconciliation Engine ([`src/utils/reconciliationEngine.ts`](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/src/utils/reconciliationEngine.ts))**:
  * **Added**: New records in `users.csv` are appended as `active`.
  * **Updated**: Profile changes (team transfers, promotions, phone) update the current record while preserving historical assignment snapshots.
  * **Departed**: Records missing from the upload transition to `departed`. **Records are never deleted**. Historical shifts remain intact. Unworked future shifts are automatically released to the vacancy queue.
* **Overtime Equity Ledger**: Maintains cumulative YTD overtime hours, shift counts, and equity percentiles across all 24 municipal teams.

---

### Layer 2: Operational Archetypes & Job Blueprints
The catalog of operational templates defining work patterns:
* **Separation of Archetype from Occurrence**: A `JobDefinition` represents the repeatable operational blueprint (e.g. *5am Tramline*, *Montefiore Hill*, *Sir Donald Bradman Drive*).
* **Recurrence Axioms**:
  * `annual`: Fixed or floating calendar anchor.
  * `recurring_weeks`: Cadence interval (every 2, 4, 6, 8, or 16 weeks) with `anchorWeek` offset (1..52).
  * `one_off`: Specific target operational date.
* **Resource Constraints**: `crewSize`, `plantOperatorRequired: boolean`, required tickets, and default department/team.
* **Multi-Tier Team Preference Hierarchy**:
  * `primaryTeam`: 1st preference team unit (allocated top suitability priority: 1000 pts).
  * `secondaryTeam`: 2nd preference team unit (sister trade fallback: 800 pts).
  * `tertiaryTeam`: 3rd preference team unit (extended operational fallback: 600 pts).
* **Hard Exclusivity Constraint**:
  * `isExclusiveTeams: boolean`: When true, personnel outside `exclusiveTeams[]` are strictly forbidden from assignment and filtered out of candidate selection pools.

---

### Layer 3: Temporal Materialization Engine
The deterministic expansion of blueprints into a concrete 52-week operational schedule:
* **Multi-Year Horizon Expansion**: Generates concrete occurrences (`JobOccurrence` / `ScheduledShift`) across 2025–2028 based on calendar geometry.
* **Split Saturday & Sunday Day Matrix**: Rather than aggregating entire weeks into blended buckets, each scheduled week is partitioned into discrete Saturday and Sunday sub-columns.
* **Adjoining Shift Expansion**: Automatically models overtime on **Fridays** and **Mondays**, dynamically inserting adjoining columns when gazetted South Australian public holidays demand operational coverage.
* **Optimal Contiguous Job Grouping Invariant**:
  When staff members work across multiple overlapping shifts, naive rendering pushes unplaced teammates and vacancies below subsequent jobs, vertically fragmenting the cards.
  * **Clustering Algorithm**: Identifies unplaced crew for the current shift. If shared teammates are already placed in `tableRows`, unplaced items are inserted **directly adjacent to the earliest shared teammate** (`Math.min(...existingIndices)`):
    $$\text{InsertIndex} = \min_{i \in \text{Assigned}}(\text{RowIndex}(i))$$
  * **Proof of Contiguity**: Guarantees that all rows for overlapping jobs form unbroken vertical clusters, ensuring matrix cards never fragment.

---

### Layer 4: Intelligent Suitability & Multi-Tier Preference Graph
Explainable multi-dimensional candidate ranking:
* **Suitability Scoring Formulation**:
  $$\text{Score} = S_{\text{tier}} + S_{\text{plant}} + S_{\text{equity}} - S_{\text{fatigue}}$$
  * **Tier Score ($S_{\text{tier}}$)**:
    * Primary Team Match: $+1000\text{ pts}$
    * Secondary Team Match: $+800\text{ pts}$
    * Tertiary Team Match: $+600\text{ pts}$
    * Cross-Department with Certified Tickets: $+400\text{ pts}$
  * **Plant Operator Ticket ($S_{\text{plant}}$)**: $+50\text{ pts}$ if occurrence requires operator.
  * **Equity Adjustment ($S_{\text{equity}}$)**: $\pm 15\text{ pts}$ inversely proportional to YTD overtime burden.
* **Hard Disqualification (Score = 0 & Allowed = False)**:
  * Departed or inactive status.
  * Same-day double-booking clash.
  * 10-hour rest break violation.
  * Breach of `isExclusiveTeams` constraint.
* **Machine-Readable Rationale**: Every candidate evaluation returns an array of justification tokens (`reasons: [...]`) for instant agent explainability.

---

### Layer 5: Allocation & Historical Integrity Ledger
The immutable transactional ledger of workforce commitments:
* **Entity Binding (`OvertimeAssignment`)**: Binds an `occurrenceId` / `shiftId` to a `staffId`.
* **Frozen Historical Snapshot**:
  Every assignment record contains an immutable snapshot of the worker's organizational profile at the precise moment of allocation:
  ```typescript
  interface AssignmentSnapshot {
    staffId: string;
    staffName: string;
    departmentAtTime: string;
    teamAtTime: string;
    crewAtTime?: string;
    roleAtTime: string;
    isPlantOperatorAtTime: boolean;
  }
  ```
  * **Historical Invariant**: If an employee transfers from *Parks* to *Mowing*, or departs Council service, all past shift reports continue to accurately reflect their deployment under *Parks*.

---

### Layer 6: Operational Synthesis & Friction Oracle
The continuous background evaluator of operational health and compliance:
* **Staffing Vacancy Deficit Sentinel**:
  Identifies any occurrence where $\text{assignedStaffIds.length} < \text{crewSize}$, computing deficit count and injecting interactive vacancy slots into matrix renderers.
* **Plant Operator Deficit Sentinel**:
  Flags occurrences where `plantOperatorRequired === true` but zero assigned personnel hold the ticket.
* **Arterial Corridor Clash Sentinel**:
  Detects concurrent closures on adjoining arterial roads (e.g. *Montefiore Hill* and *Sir Donald Bradman Drive*), alerting supervisors to traffic network impacts.
* **Fatigue Rest Break Sentinel**:
  Real-time verification ensuring $\Delta t_{\text{rest}} \ge 10\text{ hours}$ across all shifts.
* **Financial Cost Forecaster**:
  Calculates dynamic weekend and annual budget expenditure against Enterprise Agreement penalty tiers.

---

### Layer 7: Dual-Stack Human & Headless Agent Control Plane
The collaborative presentation surface and headless command-and-control API:
* **Live React Edition (`src/`)**:
  Functional components with Tailwind CSS tokens, [`AgentConsoleModal.tsx`](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/src/components/AgentConsoleModal.tsx), and headless global API [`window.__HORT_OPS__`](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/src/utils/agentControlPlane.ts).
* **Standalone Offline Edition (`Offline/`)**:
  Vanilla DOM manipulation, local SVG engine, and [`window.HortOpsApp`](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline/js/app.js) state coordinator.
* **Two-Phase Commit Transaction Model**:
  ```
  [Agent Query] ---> simulateAssignment(occId, staffId)
                           |
                           v  { allowed: boolean, costDelta, reasons }
                     commitAssignment(occId, staffId, role, justification)
                           |
                           v  { success: true, assignmentId }
                     [Reactive DOM Event & State Persistence]
  ```

---

## 3. Headless Agent C2 Protocol Specification

Autonomous agents interface with the operational substrate via `window.__HORT_OPS__`:

```typescript
export interface AgentControlPlaneInterface {
  // Returns holistic operational telemetry (vacancies, clashes, budget burn)
  getOperationalDigest(): OperationalDigest;

  // Evaluates all 253 staff against Layer 4 preference rules for an occurrence
  queryCandidates(occurrenceId: string): CandidateEvaluation[];

  // Non-mutating pre-flight simulation checking fatigue, exclusivity, and cost
  simulateAssignment(occurrenceId: string, staffId: string): SimulationResult;

  // Atomically commits assignment with frozen historical snapshot
  commitAssignment(
    occurrenceId: string, 
    staffId: string, 
    role?: AssignmentRole, 
    justification?: string
  ): CommitResult;

  // 3-way non-destructive roster reconciliation against uploaded CSV
  reconcileWorkforce(csvContent: string): ReconciliationResult;

  // Complete state tree export for agent serialization and verification
  exportSystemSnapshot(): SystemSnapshot;
}
```

### Protocol Usage Example
```javascript
// Step 1: Query operational health
const digest = window.__HORT_OPS__.getOperationalDigest();

// Step 2: Query prioritized candidates for an understaffed occurrence
const candidates = window.__HORT_OPS__.queryCandidates('shift-job-001-2026-01-24');
const topCandidate = candidates[0];

// Step 3: Simulate allocation
const sim = window.__HORT_OPS__.simulateAssignment('shift-job-001-2026-01-24', topCandidate.staff.id);
if (sim.allowed) {
  // Step 4: Commit with provenance
  window.__HORT_OPS__.commitAssignment(
    'shift-job-001-2026-01-24', 
    topCandidate.staff.id, 
    'General Hand', 
    'Automated Tier 1 primary team allocation'
  );
}
```

---

## 4. Resource & Token Frugality (RTK Integration)

To operate with the least expenditure of LLM context tokens and system compute:
1. **Mandatory RTK Command Wrapping**:
   All shell operations run through `rtk` (Rust Token Killer v0.45.0 at `~/.local/bin/rtk`), which strips noise and compresses CLI output by **76.5%**:
   ```bash
   rtk git status
   rtk rg <pattern>
   rtk npm run build
   rtk playwright test
   ```
2. **Dense Telemetry Digests**:
   Agents poll `getOperationalDigest()` (returning a compact 20-line JSON summary) instead of scraping thousands of lines of HTML table markup.
3. **Headless Linux Playwright Verification**:
   Visual regression and functional state verification are executed in headless Linux via [`scripts/verify_offline.cjs`](file:///home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/scripts/verify_offline.cjs) in under 2 seconds without launching heavy desktop browsers or Windows processes.
