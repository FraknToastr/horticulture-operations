# Stage 0 — Source-derived workflow maps

These diagrams are **reconnaissance maps**, not proof that the application enforces every transition. Solid arrows indicate directly observed source/UI structure; dotted arrows indicate relationships scheduled for Stage 4 verification. The workspaces share feature modules while exposing owner-specific record types and checklist templates.

## Nature Strip Applications — checklist context and feature touchpoints

`src/program-planner/js/model.js:84–110` supplies Nature Strip checklist labels and `src/program-planner/index.html:48–83` exposes the feature navigation. Mandatory order, approval gates and save timing remain **unverified**.

```mermaid
flowchart LR
    A["Application received"] --> B["Application approved"]
    B --> C["Site assessment / planning checks"]
    C --> D["Contractor and material preparation"]
    D --> E["Works and handover checklist"]
    R["Register"] -. "application and linked project" .-> P["Project Planner"]
    P -. "location / work area" .-> M["Space Map"]
    P -. "job resources" .-> Cc["Cost Calculator"]
    Cc -. "planned work" .-> S["Job Scheduler"]
    S -. "costs / outputs" .-> Q["Quote Builder"]
    Q -. "allocations / charges" .-> BA["Annual Budget / Reports"]
```

## Event Space Remediation — source-defined checklist context

`src/program-planner/js/model.js:111–125` provides Event Space Remediation's separate Pre-Delivery/Post Delivery checklist labels. The diagram is a **logical grouping** of those source-defined tasks, not a tested business-process gate.

```mermaid
flowchart TB
    ER["Event register record"] -. "project linkage" .-> PR["Event remediation project"]
    PR --> PRE["Pre-Delivery checklist"]
    PRE --> IRR["Irrigation mark out / customer consultation"]
    PRE --> PO["Purchase-order and City Works Permit tasks"]
    PRE --> REP["Post Events Report task"]
    PR -. "spatial planning" .-> MAP["Space Map"]
    PR -. "cost and scheduling" .-> COST["Calculator / Scheduler"]
    COST -. "quote preparation" .-> QT["Quote Builder"]
    REP -. "when delivery is complete" .-> POST["Post Delivery checklist"]
    POST --> FINAL["Final reports / quote / handover / turf maintenance"]
```

## First-use, editing and recovery — observed control structure

`src/program-planner/js/app.js:635–677,851–865`, `src/program-planner/js/model.js:229–232,322–355`, `src/program-planner/js/storage.js:236–280`, `src/program-planner/js/data-workspace.js:398–411,619–752`.

```mermaid
flowchart TD
    Start["Open NSA or EVT route"] --> Read["Read configured IndexedDB workspace"]
    Read --> Exists{"Existing workspace?"}
    Exists -- "No" --> Blank["Blank model plus default Rate Catalog"]
    Exists -- "Yes" --> Repair["Source-defined repair / validation path"]
    Blank --> Active["Active workspace"]
    Repair --> Active
    Active --> Mutate["User edits or imports data"]
    Mutate --> Validate["Normalize; validate; budget transition checks"]
    Validate --> Save["Queued save to configured IndexedDB"]
    Save --> Active
    Save -. "failure to be tested" .-> Failure["Error / recoverability review in Stage 2"]
    Active -. "explicit export" .-> Backup["User-controlled backup file"]
    Backup -. "inspection before commit" .-> Mutate
```

**Required follow-up:** independently validate persistence success/failure; app separation and origin/session storage; source-defined lifecycle/status transitions; cross-module transactional integrity; distinction between operational data and default reference catalog; import-preview accuracy and recovery after interrupted saves.
