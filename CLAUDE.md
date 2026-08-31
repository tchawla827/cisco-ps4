# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

`backend/` (FastAPI + pure-Python domain engine) and `frontend/` (React +
TypeScript + Vite) are fully built: 86 backend tests (`pytest`) and 16
frontend tests (`vitest`) pass, the frontend build and lint are clean, and
the full demo (load → valid cross-branch transfer → cycle/root-move
rejection → reset → deterministic reapply) has been verified live against
`docs/EXPECTED_RESULTS.md`. See `docs/TEST_EVIDENCE.md` for the evidence and
`docs/PLAN.md`'s "Deviations" section (D1–D8) for where the implementation
extended or tightened the original design. Before making further changes,
read in this order:

1. `Student_SPR26_D2_P04-departmental-reorg-payroll-rollup-tracker.md` — the
   **source of truth** for the problem. If anything in `PRD.md` or
   `ARCHITECTURE.md` ever conflicts with it, this file wins.
2. `PRD.md` — product requirements derived from the source problem.
3. `ARCHITECTURE.md` — mandated stack, module layout, algorithms, API
   surface, and validation/transfer pass ordering. Follow it exactly; it is
   deliberately prescriptive (down to function signatures and validation
   pass order) because the domain rules are the graded content.
4. `docs/PLAN.md` — the 5-stage build order with checkpoints. Work stage by
   stage; don't build the frontend before the domain engine has passing tests.
5. `docs/EXPECTED_RESULTS.md` — the independently hand-derived oracle for the
   12-employee demo dataset (initial rollups, the required valid transfer,
   the required cycle rejection). **Never import this file, or any test
   fixture derived from it, into `backend/app/**` production code** — it
   exists only for tests/docs to assert against (see AD-08 in
   `ARCHITECTURE.md`).

`docs/AI_PROMPTS.md` and `docs/DESIGN_NOTES.md` should be updated as work
progresses, not written retroactively at the end.

## Commands

Verified from a clean checkout (also in `README.md`):

```sh
# Backend (from backend/, with .venv activated: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt)
cd backend && pytest                                   # full backend suite (86 tests)
cd backend && pytest tests/test_transfer.py             # one file
cd backend && pytest tests/test_transfer.py -k <name>   # one test
cd backend && uvicorn app.main:app --reload --port 8000 # run API on :8000

# Frontend (from frontend/, after npm install)
cd frontend && npm run dev                               # run UI on :5173, calls backend at :8000
cd frontend && npm run test -- --run                      # vitest (16 tests)
cd frontend && npm run build                              # tsc -b && vite build
cd frontend && npm run lint                               # oxlint
```

## Architecture (target — see `ARCHITECTURE.md` for full detail)

This is a domain-rules-first application: the entire correctness burden lives
in a small set of **pure Python functions with no FastAPI/HTTP dependency**
(`backend/app/domain/{validation,tree,rollups,transfer}.py`), which a thin
`DepartmentService` orchestrates and thin FastAPI routes expose. The React
frontend is presentation-only — it never recomputes hierarchy, rollups, or
validation; it renders whatever the backend returns.

Key invariants that shape almost every change:

- **Flat list is canonical.** State is `list[Employee]`, never a mutable
  nested tree. The tree (`root_id`, `employee_by_id`, `children_by_id`) and
  all rollups are *derived* on each read/transfer, not stored and patched.
- **Source order is sacred.** Employee table rows, each manager's
  `children_ids`, and `changed_rollup_ids` all follow original source-record
  order — never re-sort by name, ID, or salary in domain code.
- **Validate fully before mutating.** Both department load and transfer
  follow: validate → build candidate → recalc/assert invariants → commit.
  A rejected transfer must leave every manager link, rollup, and the prior
  successful transfer result byte-for-byte unchanged (this is what
  "atomicity" means here — no rollback logic, just never mutate authoritative
  state until validation has fully passed).
- **Validation and transfer-check ordering is a hard contract, not a
  suggestion.** Load validation runs in 6 fixed passes (count/fields → dup ID
  → root count → self/unknown manager → cycle → connectivity). Transfer
  validation runs in 5 fixed checks (unknown ID → root move → self-manager →
  already-reports → cycle). Changing this order breaks the graded
  precedence tests in `docs/PLAN.md` Stage 1/2 — don't reorder without
  updating `ARCHITECTURE.md` §8 and §10 first.
- **Full recompute, not incremental.** After a transfer, recalculate all
  rollups from scratch (O(n), n ≤ 30) rather than patching ancestor chains.
  This is a deliberate simplicity choice (AD-07) — don't "optimize" it.
- **`changed_rollup_ids` is an exact diff**, not an ancestor-path guess:
  compare every employee's before/after rollup and include only those that
  actually differ. An unchanged common ancestor (e.g. the department head on
  an internal cross-branch move) must *not* appear even though it sits above
  both branches.

## Stable domain error codes (do not rename)

Load: `INVALID_EMPLOYEE`, `DUPLICATE_EMPLOYEE_ID`, `INVALID_ROOT_COUNT`,
`UNKNOWN_MANAGER`, `SELF_MANAGER`, `MANAGEMENT_CYCLE`.

Transfer: `UNKNOWN_TRANSFER_EMPLOYEE`, `ROOT_MOVE_FORBIDDEN`, `SELF_MANAGER`,
`ALREADY_REPORTS_TO_MANAGER`, `MANAGEMENT_CYCLE`.

These are part of the tested contract with the frontend and test suite — the
UI and tests key off these exact strings.
