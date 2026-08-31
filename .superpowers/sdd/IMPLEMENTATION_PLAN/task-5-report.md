# Task 5 Report — Scenarios, Oracle, and Service

## Scope delivered

- Added `app/data/scenarios.py` with the ordered `main-12`, `solo-1`, and all
  specified invalid fixtures. `Scenario.employees()` returns a fresh list for
  every request; production fixtures contain only operational records.
- Added `tests/oracle.py`, hand-transcribed from `docs/EXPECTED_RESULTS.md`,
  and updated tree, rollup, and transfer tests to use the shared scenario and
  oracle constants.
- Added `DepartmentService` and a plain `DepartmentState`. The service has the
  four required optional state fields; load failure clears every one, transfer
  evaluates a validated candidate through tree rebuild, rollups, and root
  invariants before committing, preview performs no assignment, and reset
  starts from a fresh original-list copy.

## TDD evidence

### RED

Command:

```text
cd backend && .venv/bin/pytest -q tests/test_scenarios.py tests/test_department_service.py
```

Result: collection failed as expected with `ModuleNotFoundError` for
`app.data.scenarios` and `app.services.department_service`. The tests had no
import, fixture, or assertion failure unrelated to the missing implementation.

### GREEN

Focused command:

```text
cd backend && .venv/bin/pytest -q tests/test_scenarios.py tests/test_department_service.py
```

Result: `10 passed in 0.02s`.

Full command:

```text
cd backend && .venv/bin/pytest -q
```

Result: `66 passed in 0.04s`.

## Requirement checks

- Main load exposes source-ordered employees, initial oracle rollups, and no
  prior impact.
- `LEAD_A -> MGR_C` matches post-transfer oracle rollups and the documented
  changed IDs and moved subtree figures.
- `MGR_A -> E3` returns `MANAGEMENT_CYCLE` while all four service fields retain
  object identity and the last successful impact remains available.
- Preview returns the same impact shape without assigning any service field.
- Reset restores initial rollups using a new list and clears the impact.
- `invalid-precedence` reports `DUPLICATE_EMPLOYEE_ID` and clears every field;
  unknown scenario loading does the same.
- Scenario tests verify fresh lists and all required structural error outcomes.

## Self-review

- Confirmed no production import from `tests` or `tests.oracle`.
- Confirmed no `sorted()` call in `backend/app`.
- Confirmed canonical employee order remains list order through scenario load,
  candidate application, tree construction, rollup comparison, and reset.
