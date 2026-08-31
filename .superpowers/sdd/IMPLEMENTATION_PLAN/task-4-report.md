# Task 4 RED/GREEN Report

Base commit: `ed0f77c`.

## RED

Created `backend/tests/test_transfer.py` before production transfer code.
Ran:

```text
cd backend && .venv/bin/pytest tests/test_transfer.py -v
```

Result: collection failed as expected with
`ModuleNotFoundError: No module named 'app.domain.transfer'`.

## GREEN

Implemented the pure transfer domain module with the mandated validation order,
one-record immutable candidate copy, and exact source-order rollup diffs.

Focused verification:

```text
11 passed in 0.02s
```

Full verification:

```text
56 passed in 0.03s
```

Self-review confirmed no `sorted()` use, no production oracle/test imports, and
the final validation check reads the existing tree before any candidate is made.

## Fix round 1/5 — Deterministic state transition

Updated `test_transfer_impact_is_deterministic_after_reset` to explicitly
perform apply → reset from a fresh original copy → apply. It now compares the
independently computed `TransferImpact` values and both resulting employee
sequences exactly.

Commands run:

```text
cd backend && .venv/bin/pytest tests/test_transfer.py -v
11 passed in 0.03s

cd backend && .venv/bin/pytest -q
56 passed in 0.03s
```
