# HortOps Milestone 15: Stage 3 Commencement & Master Handoff

**Current Status:**
- **Stage 1 (Architecture Governance & Invariants):** **CLOSED & FROZEN** (17 Retained Suites).
- **Stage 2 (Transactions, Storage Hygiene & Emergency Recovery):** **CLOSED & FROZEN** (Candidate `PR23_07_10` signed off by Project Owner on 2026-10-02; Review 54 and Evidence Adjudication accepted).
- **Stage 3 (Workforce Intelligence, Qualifications & Fatigue Management):** **EXPLICITLY AUTHORIZED & ACTIVE** (Project Owner Decision 2026-10-02; Use of AI agents authorized).

---

## Authoritative Documentation Hierarchy for Incoming Maintainers / Agents

1. **Master Onboarding & Runbook:** [`NEW_MAINTAINER_HANDOFF_GUIDE.md`](NEW_MAINTAINER_HANDOFF_GUIDE.md) (and [`MASTER_MAINTAINER_HANDOFF_STAGE3.md`](MASTER_MAINTAINER_HANDOFF_STAGE3.md))
2. **System Constitution & Roadmap:** [`ROADMAP_TEST_ACCEPTANCE_AND_RELEASE_GATES.md`](ROADMAP_TEST_ACCEPTANCE_AND_RELEASE_GATES.md)
3. **Domain Knowledge & Schemas:** [`MAINTAINER_GUIDE.md`](MAINTAINER_GUIDE.md)
4. **Owner Sign-Off Record:** [`governance_and_reviews/OWNER_APPROVAL_RECORD.md`](governance_and_reviews/OWNER_APPROVAL_RECORD.md)

---

## Baseline Release Integrity Commands (Always Execute in Ubuntu 24.04 WSL2)

```bash
cd /home/n0rt/Antigravity-IDE/Hort_Ops_Visualisations/Offline2-Overtime-Planner

# 1. Run all 24 master release gates
NODE_PATH=/usr/local/lib/node_modules node scripts/run_all_release_gates.cjs

# 2. Run Playwright browser operator lifecycle suite
NODE_PATH=/usr/local/lib/node_modules node scripts/test_review50_browser_parent_workflow.cjs

# 3. Verify single-file build parity
node scripts/build_single_file.cjs
sha256sum index.html dist/hort_ops_offline_planner.html
```

---

## Stage 3 Priorities
1. Interrelated Qualification Registries & Validation Engine (Chainsaw, EWP, Chipper, Chemical, First Aid).
2. Advanced Municipal Fatigue Management (10-hour rest intervals, consecutive days cap).
3. Multi-Period Absence Ledger & Shift Conflict Detection.
4. Fair-Share Overtime Allocation Algorithm.
