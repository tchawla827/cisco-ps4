# Test Evidence

Repeatable commands and results demonstrating the required coverage in
`PRD.md` §19. Commands and outputs below were run against the committed
Stage 5 (Task 13) tree from a clean checkout: `backend` via `pytest -v`
inside `backend/.venv`, `frontend` via `npm run test`, `npm run build`, and
`npm run lint`.

## Backend (`pytest -v`)

86 tests collected, 86 passed, 0 failed, run time 0.27s.

```sh
cd backend && source .venv/bin/activate && pip install -r requirements.txt && pytest -v
```

| Scenario | Test file / case | Result |
| --- | --- | --- |
| Leaf rollup | `test_rollups.py::test_calculate_rollups_gives_leaf_its_own_headcount_and_salary` | PASSED |
| Multi-level rollup | `test_rollups.py::test_calculate_rollups_matches_each_initial_oracle_row[...]` (12 cases, one per employee) | PASSED |
| Root invariants | `test_rollups.py::test_assert_root_invariants_accepts_complete_rollups`, `test_assert_root_invariants_rejects_a_corrupted_root_rollup` | PASSED |
| Valid one-employee department | `test_validation.py::test_accepts_one_employee_department`; `test_rollups.py::test_calculate_rollups_handles_a_solo_department` | PASSED |
| Duplicate-ID load failure | `test_validation.py::test_rejects_duplicate_employee_id` | PASSED |
| Unknown-manager / cycle load failure | `test_validation.py::test_rejects_unknown_manager`, `test_rejects_management_cycle` | PASSED |
| Invalid-load stale-state clearing | `test_api.py::test_invalid_load_returns_domain_error_and_clears_state[...]` (5 scenarios incl. duplicate ID, unknown manager, cycle, precedence, unknown scenario) | PASSED |
| Valid cross-branch transfer (`LEAD_A` → `MGR_C`) | `test_transfer.py::test_oracle_transfer_produces_the_documented_impact_and_rollups`; `test_api.py::test_valid_transfer_returns_department_and_oracle_impact` | PASSED |
| Subtree preservation | `test_transfer.py::test_apply_transfer_replaces_only_the_moved_employee_and_preserves_inputs` | PASSED |
| Exact `changed_rollup_ids` | `test_transfer.py::test_oracle_transfer_produces_the_documented_impact_and_rollups` (asserts `MGR_A`, `MGR_C` only — `HOD` excluded) | PASSED |
| Source-order sibling placement after transfer | `test_transfer.py::test_rebuilt_tree_preserves_source_order_for_transfer_siblings` | PASSED |
| Cycle prevention (`MGR_A` → `E3`) | `test_transfer.py::test_validate_transfer_rejects_each_transfer_rule[MGR_A-E3-MANAGEMENT_CYCLE]` | PASSED |
| Root-move protection | `test_transfer.py::test_validate_transfer_rejects_each_transfer_rule[HOD-MGR_A-ROOT_MOVE_FORBIDDEN]`; `test_api.py::test_root_transfer_is_rejected` | PASSED |
| Transfer validation ordering | `test_transfer.py::test_validate_transfer_uses_specified_precedence` | PASSED |
| Rejected-transfer atomicity | `test_transfer.py::test_rejected_cycle_transfer_is_atomic`; `test_api.py::test_rejected_cycle_is_atomic_and_retains_last_successful_transfer` | PASSED |
| Reset exactness + deterministic reapplication | `test_transfer.py::test_transfer_impact_is_deterministic_after_reset`; `test_api.py::test_reset_restores_initial_state_and_reapplication_is_deterministic` | PASSED |
| Load validation precedence (6-pass order) | `test_validation.py::test_bad_field_wins_over_duplicate_id`, `test_duplicate_id_wins_over_two_roots`, `test_two_roots_win_over_unknown_manager`, `test_unknown_manager_wins_over_cycle`, plus source-order variants | PASSED |
| Domain purity / oracle isolation | `test_ad08_guard.py::test_production_app_never_references_test_oracle`, `test_domain_modules_remain_independent_of_fastapi_and_pydantic` | PASSED |

Full raw output (86 passed, one line per test) is reproduced in the
Task 13 report at
`.superpowers/sdd/IMPLEMENTATION_PLAN/task-13-report.md`.

## Frontend (`npm run test`, `npm run build`, `npm run lint`)

```sh
cd frontend && npm install && npm run test -- --run && npm run build && npm run lint
```

- `npm run test -- --run` (vitest): 4 test files, **16 tests passed**, 0 failed.
- `npm run build` (`tsc -b && vite build`): succeeded, no type errors;
  `dist/assets/index-*.js` ≈216 KB (≈67 KB gzip).
- `npm run lint` (`oxlint`): exit 0, no findings.

## Manual / UI walkthrough

Both services were started locally (`uvicorn app.main:app --port 8000`,
`npm run dev`) and driven end-to-end with Playwright browser automation
against `http://localhost:5173`. Screenshots saved under
`.superpowers/sdd/task-13-evidence/`.

| Step | Expected (per `docs/EXPECTED_RESULTS.md`) | Result |
| --- | --- | --- |
| Load demo (`main-12`) | 12 employees, `HOD` headcount 12 / payroll INR 821,000; every leaf shows headcount 1 / own salary | **Confirmed.** Table and org chart both show `HOD` "HC 12 · ₹8,21,000"; leaves (`E1`…`E6`) each show "HC 1" with team payroll equal to own salary. Screenshot: `01-loaded.png`. |
| Apply valid transfer (`LEAD_A` → `MGR_C`, via "Valid preset" + Apply) | `MGR_A` 5→2 / 282,000→137,000; `MGR_C` 2→5 / 117,000→262,000; moved subtree `LEAD_A, E1, E2` = 3 / 145,000; `HOD` unchanged and not listed as affected | **Confirmed exactly.** Impact panel: "MGR_A … Headcount 5 → 2, −3 … Payroll INR 282,000 → INR 137,000, −INR 145,000"; "MGR_C … Headcount 2 → 5, +3 … Payroll INR 117,000 → INR 262,000, +INR 145,000"; "↪ MOVED LEAD_A … Subtree 3 · INR 145,000"; footer "★ HOD 12 · INR 821,000 unchanged — not financially affected". `changed_rollup_ids` (verified via `GET /api/department`) = `["MGR_A","MGR_C"]` only. Screenshot: `02-valid-transfer.png`. |
| Attempt invalid transfer (`MGR_A` → `E3`, via "Cycle preset" + Apply) | Rejected with `MANAGEMENT_CYCLE`; chart and impact cards stay exactly as after the prior valid transfer | **Confirmed.** Alert banner: "MANAGEMENT_CYCLE — Transfer would create a management cycle: 'MGR_A' -> 'E3'". Table, chart, and impact panel are pixel-identical to the prior valid-transfer state (still showing `MGR_A` 2/137,000, `MGR_C` 5/262,000, `LEAD_A` moved). Screenshot: `03-cycle-rejected.png`. |
| Attempt root transfer (`HOD` → any manager, via "Attempt root move") | Rejected with `ROOT_MOVE_FORBIDDEN` | **Confirmed.** Alert banner: "ROOT_MOVE_FORBIDDEN — Root employee 'HOD' cannot be moved". State again unchanged from the prior applied transfer. |
| Load `solo-1` | Headcount 1 | **Confirmed via API.** `POST /api/department/load {"scenario":"solo-1"}` → `employees: [{"employee_id":"SOLO", ..., "team_headcount":1, "team_payroll":50000}]`, `totals.employee_count: 1`. |
| Load `invalid-duplicate-id` | Whole workspace clears | **Confirmed via API.** `POST /api/department/load {"scenario":"invalid-duplicate-id"}` → `400 {"error":{"code":"DUPLICATE_EMPLOYEE_ID", ...}}`; subsequent `GET /api/department` → `409 {"error":{"code":"NO_DEPARTMENT_LOADED", ...}}`, i.e. no stale department survives an invalid load. |
| Reset | Restores original 12 records, no highlights, `MGR_A` back to 5/282,000, `MGR_C` back to 2/117,000, "No transfer impact available." | **Confirmed.** Status banner: "Department reset to its loaded state."; table/chart show no `CHANGED`/`MOVED` markers; Impact panel reads "No transfer impact available." Screenshot: `04-reset.png`. |
| Reapply the same valid transfer | Reproduces an identical result | **Confirmed.** After Reset → "Valid preset" → Apply, `GET /api/department` again shows `MGR_A` team_headcount 2 / team_payroll 137,000, `MGR_C` 5 / 262,000, `HOD` 12 / 821,000 — byte-identical to the first application. Screenshot: `05-reapplied.png`. |

## Full suite

```sh
cd backend && pytest
```

Result: **86 passed** in 0.27s (Python 3.9.6, pytest 8.4.2).

```sh
cd frontend && npm run test -- --run && npm run build && npm run lint
```

Result: **16 passed** (vitest), build succeeded (`tsc -b && vite build`),
lint exit 0 (`oxlint`).
