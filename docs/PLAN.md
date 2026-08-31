# Implementation Plan — Departmental Reorg Payroll Rollup Tracker

Ordered per `ARCHITECTURE.md` §29–30. Update the "Deviations" note under any
stage if actual work diverges from what's planned here — don't rewrite history,
append.

## Stage 1 — Domain core (pure Python, no FastAPI)
**Modules:** `backend/app/domain/validation.py`, `tree.py`, `rollups.py`
**Checkpoint:** `pytest backend/tests/test_validation.py backend/tests/test_rollups.py`
all green.
- Employee field/shape validation (regex ID, trimmed name/role, salary range).
- 6-pass validation pipeline in the mandated precedence order (`ARCHITECTURE.md` §8).
- `children_by_id` construction preserving source order (§7.2).
- Postorder DFS rollup calculation + root invariant assertions (§9).
- Tests: leaf, multilevel, 1-employee, root invariants, arbitrary source order,
  each validation error category, validation precedence (multi-error fixtures).

## Stage 2 — Transfer domain logic
**Modules:** `backend/app/domain/transfer.py`
**Checkpoint:** `pytest backend/tests/test_transfer.py` all green, including the
`docs/EXPECTED_RESULTS.md` §3/§4/§5 scenarios reproduced exactly.
- `validate_transfer` in the mandated 5-check order (§10).
- Subtree-membership cycle check via DFS/BFS from the moved employee (§11).
- Validate-then-copy-then-commit transaction (§12): candidate employee list,
  rebuild tree, recalc rollups, assert invariants, diff before/after in source
  order to produce `changed_rollup_ids` (§13), only then commit.
- Tests: valid cross-branch transfer, subtree preservation, exact
  `changed_rollup_ids`, sibling source-order rebuild, cycle rejection, root
  rejection, self/already-reports rejection, atomicity (rejected transfer
  leaves state byte-for-byte equal), deterministic reset + reapply.

## Stage 3 — Service layer + FastAPI routes
**Modules:** `backend/app/services/department_service.py`,
`backend/app/api/department.py`, `backend/app/models/*`, `backend/app/data/demo_department.py`, `backend/app/main.py`
**Checkpoint:** `pytest backend/tests/test_api.py` all green; `uvicorn` boots;
manual `curl` round-trip of load → transfer → reset matches
`docs/EXPECTED_RESULTS.md`.
- Pydantic transport models (thin — precedence-sensitive validation stays in
  `domain/validation.py`, not in Pydantic validators).
- `demo_department.py` holds the 12-employee dataset from
  `docs/EXPECTED_RESULTS.md` §1 as plain operational input — no oracle values
  imported into it.
- `DepartmentService` owns `original_employees` / `current_employees` /
  `last_successful_transfer` in-memory state (§14).
- Four endpoints only: `POST /load`, `GET /department`, `POST /transfer`,
  `POST /reset` (§15), consistent error envelope (§17).
- Integration tests: load, successful transfer response shape, rejected
  transfer leaves state unchanged, reset restores original.

## Stage 4 — Frontend workspace
**Modules:** `frontend/src/components/{OrgTree,EmployeeTable,EmployeeDetails,TransferControls,ImpactPanel}.tsx`, `frontend/src/api/department.ts`, `App.tsx`
**Checkpoint:** manual walkthrough — load demo → inspect several employees →
apply documented valid transfer → attempt documented cycle transfer → attempt
root transfer → reset — all match `docs/EXPECTED_RESULTS.md` on screen.
- One-action load, source-ordered employee table, read-only employee details,
  transfer dropdowns (moved employee / new manager), impact panel that
  retains the last successful result across a rejected attempt (§18, §27).
- ★/●/↪/Δ (or equivalent) visual markers for root/selected/moved/changed,
  text as well as colour (§21).
- No client-side hierarchy/rollup computation — render backend response only.

## Stage 5 — Evidence, polish, live-modification readiness
**Checkpoint:** all `docs/*` populated; full test suite green in one command;
README run instructions verified from a clean checkout.
- `docs/TEST_EVIDENCE.md`: command + output summary per required scenario
  (`PRD.md` §19).
- `docs/AI_PROMPTS.md`, `docs/DESIGN_NOTES.md` kept current from Stage 1 onward
  (not written retroactively only at the end).
- Optional (only after all Required acceptance criteria pass): side-by-side
  original/current comparison drawer (`PRD.md` §4, §Optional).
- Sanity pass: confirm nothing in `backend/app/**` imports
  `docs/EXPECTED_RESULTS.md` or test fixtures (AD-08).

## Deviations
(none yet — append here as they happen, do not edit the stages above in place)
