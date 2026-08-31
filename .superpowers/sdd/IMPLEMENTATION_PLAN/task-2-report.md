# Task 2 Report — Load validation

## Scope

Implemented the pure six-pass `validate_department` pipeline and its focused
behavior tests. Added only `app/domain/tree.py::build_tree`, the minimal tree
support required for defensive validation pass 6; tree traversal utilities and
rollups remain owned by Step 3.

## RED Evidence

`backend/tests/test_validation.py` was created before production validation
code. The required command was then run from `backend`:

```text
$ .venv/bin/pytest tests/test_validation.py -v
collected 0 items / 1 error
E   ModuleNotFoundError: No module named 'app.domain.validation'
=============================== 1 error in 0.07s ===============================
```

The expected failure was caused by the missing validation module, not a test
fixture or assertion failure.

## Implementation

- `validation.py` applies exactly these first-error passes: fields, duplicate
  IDs, root count, manager references, cycles, and defensive connectivity.
- Field checks use source order and the specified sub-order, including
  `type(monthly_salary) is int` so `True` is rejected.
- Duplicate, root, manager-reference, cycle, and connectivity errors preserve
  required source ordering. Manager references use one loop, so an earlier
  unknown manager wins over a later self-manager.
- Cycle detection uses WHITE/GREY/BLACK parent-pointer traversal in O(n).
- `build_tree` assumes validated input and preserves source order for children;
  it is used only by validation pass 6 in this step.

## Test Coverage

- Field failures: invalid ID, blank name, blank role, salary below/above range,
  boolean salary, and string salary.
- Count bounds: 0, 1, 30, and 31 employees.
- Each structural error: duplicate ID, zero/two roots, self-manager, unknown
  manager, and management cycle.
- Required pass precedence, within-category source ordering, the single-loop
  manager-reference case, and manager-after-report valid input.

## GREEN Evidence

After production code was added, the required checkpoint was run from
`backend`:

```text
$ .venv/bin/pytest tests/test_validation.py -v
============================== 26 passed in 0.02s ==============================
```

## Self-review

- Domain remains pure; no API, service, or transport dependencies were added.
- `Employee` was not modified and remains frozen.
- `rg -n "sorted\\(" backend/app/domain backend/app/services` produced no
  matches.
- `git diff --check` completed without whitespace errors.
- Appended the requested prompt outcome to `docs/AI_PROMPTS.md` and D1 plus the
  validation-order contract to `docs/DESIGN_NOTES.md`.
