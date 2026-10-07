# ROSTERING INTEGRITY FREEZE
## Canonical Architectural Specification & Frozen Contracts
**Milestone**: Offline17.5j  
**Status**: FROZEN AND CANONICAL  
**Architecture**: Historical Source Sealing + Forward Ownership + Lightweight Lineage  

---

### Core Governing Principles

1. **Past instructions explain the past. Active instructions control the future.**
2. **Historical instructions never own future rostering.**
3. **Completed instructions never regain future authority.**
4. **Future rostering cannot silently disappear, move, or change meaning.**
5. **Malformed active state fails closed.**
6. **Job mutations are transactional.**
7. **Historical truth survives future Job changes.**

> [!IMPORTANT]
> **Future Development Rule**:  
> Future rostering features (including Same-Staff Rostering, Smart Rotation, Staff Pools, Team Pools, Exclusive Staff, and Fairness Logic) must integrate with these invariants rather than altering them, unless a separately approved architecture change explicitly supersedes this freeze.

---

### 1. State Space Matrices

#### A. Parent Job / Instruction Lifecycle Matrix

| Job Status | Instruction Status | Permitted? | Invariant / Reason |
|:---|:---|:---:|:---|
| `active` | `active` | **YES** | Live operational state; subject to valid operational occurrence. |
| `active` | `historical` | **YES** | Normal sealed historical record on an ongoing job. |
| `inactive` | `historical` | **YES** | Historical lineage preserved under retired/inactive Job (audit durability). |
| `inactive` | `active` | **NEVER** | **Invariant I1**: Active instruction requires active parent Job. |
| `draft` / `archived` / `resolved` | `active` | **NEVER** | **Invariant I1**: Non-active Job statuses cannot hold active instructions. |
| `draft` / `archived` / `resolved` | `historical` | **YES** | Completed historical lineages remain valid under archived/resolved jobs. |

#### B. Instruction / Temporal Ownership Matrix

Canonical boundary: `historical: targetDate < today`, `current/future: targetDate >= today` (`today` from `window.HortOpsDateUtils.getLocalDateKey()`).

| Instruction Status | Owned Occurrence Target | Permitted? | Invariant / Reason |
|:---|:---|:---:|:---|
| `active` | Future / Current (`>= today`) | **YES** | Standard live forward planning. |
| `active` | Historical (`< today`) | **Transitional** | Normal lifecycle until sealed by schedule edit or retirement. |
| `historical` | Historical (`< today`) | **YES** | Canonical immutable past operational record. |
| `historical` | Future / Current (`>= today`) | **NEVER** | **Invariant I2**: Historical instructions cannot own current or future occurrences. |

#### C. Provenance Matrix

| Instruction Status | Provenance Target Date | Permitted? | Invariant / Reason |
|:---|:---|:---:|:---|
| `active` | Current / Future (`>= today`) | **YES** | Live rostering-rule assignment linkage. |
| `active` | Historical (`< today`) | **YES** | Transitional operational audit. |
| `historical` | Historical (`< today`) | **YES** | Valid recorded past audit trail. |
| `historical` | Current / Future (`>= today`) | **NEVER** | **Invariant I2**: Schema rejects historical instruction with future provenance. |

---

### 2. Global Invariants (I1–I12)

* **Invariant I1 (Active Parent Requirement)**:  
  An active instruction strictly requires an active parent Job (`job.status === 'active'`). Non-active parent statuses (`inactive`, `draft`, `archived`, `resolved`) immediately fail Schema v2 validation.
* **Invariant I2 (Historical Temporal Bound)**:  
  Historical instructions may explain past operational state only. They cannot own current or future rostering-rule provenance (`targetDate >= today`).
* **Invariant I3 (Operational Authority)**:  
  Every active instruction source must resolve to a recognised operational occurrence of its parent Job (either generated recurrence or a trusted explicit operational occurrence from `HISTORICAL_OCCURRENCES`).
* **Invariant I4 (Historical Recurrence Independence)**:  
  A modern historical instruction (`status === 'historical'`) remains recorded past truth and is NEVER invalidated or re-derived when the parent Job's future recurrence changes.
* **Invariant I5 (Fail-Closed Unresolvable Active)**:  
  Any active instruction that cannot be resolved against the existing Job schedule fails closed, blocking schedule edits and retirement with zero partial mutations.
* **Invariant I6 (Anti-Resurrection)**:  
  An already exhausted active instruction (`currentOccs.length > 0 && currentFutureOccs.length === 0` under existing schedule) is sealed to `status: 'historical'` before a schedule-affecting mutation commits, and can never regain future scope.
* **Invariant I7 (Audit Deletion Protection)**:  
  Any Job with existing rostering lineage (active or historical instructions) cannot be hard-deleted from `state.jobs`. Operator delete requests cleanly retire the Job to `status: 'inactive'` instead.
* **Invariant I8 (Retirement Future Guard)**:  
  A Job with active future rostering cannot be retired (`active -> inactive`) until that future rostering is revised or ended.
* **Invariant I9 (Completed Lineage Structure)**:  
  A completed historical lineage chain may legitimately have zero active terminal instructions while maintaining 100% schema validity.
* **Invariant I10 (Whole-Sequence Preservation)**:  
  A schedule-affecting mutation on a Job with active future instructions is permitted ONLY if the entire future occurrence sequence before the mutation exactly matches the future occurrence sequence after the mutation.
* **Invariant I11 (Transactional Atomicity & Rollback)**:  
  Job mutations and status transitions are strictly atomic. Any validation rejection or storage persistence failure triggers a full rollback of both in-memory Job state and instruction statuses.
* **Invariant I12 (Load-Save Equivalence)**:  
  Any accepted loaded workspace state (`loadWorkspace()`) must be immediately re-saveable (`saveWorkspace()`) without modification, data drift, or Schema rejection.

---

### 3. Operational Rules

#### A. Schedule-Affecting Mutation Rules
1. Operational schedule fields checked: `frequencyType`, `intervalWeeks`, `anchorDate`, `anchorWeek`, `targetDate`, `targetMonth`, `preferredDay`, `status`.
2. Non-scheduling edits (`name`, `notes`, `crewSize`, `description`, team preferences) leave instruction statuses untouched.
3. Exhaustion is proven strictly under the existing schedule: `currentOccs.length > 0 && currentFutureOccs.length === 0`.
4. Staged sealing converts exhausted active instructions to `historical` prior to disk commitment.
5. Mixed exhausted + incompatible future-active instructions block the entire transaction with zero live or persisted mutation.

#### B. Job Retirement & Deletion Rules
1. Active future instructions block retirement.
2. Exhausted active instructions seal to historical upon retirement.
3. Historical-only Jobs retire to `inactive` cleanly.
4. Hard delete is strictly prohibited if any instruction lineage exists.

#### C. Provenance & Assignment Contracts
1. Future assignments (`aDate >= today`) linked via provenance to `historical` instructions fail closed in both Schema v2 and the Job mutation guard.
2. Assignment-free instructions (vacant slots) constitute valid rostering state and enforce lifecycle invariants identically to staffed slots.
3. Rotation mode instructions seal to historical preserving exact historical assignments without recalculation or re-running rotation candidate pools.

---

### 4. Freeze Declaration

The Manual / Fixed / Rotation / Repeat rostering foundation is formally frozen at **Offline17.5j**. No further speculative architectural micro-patches are planned or permitted on this foundation.
