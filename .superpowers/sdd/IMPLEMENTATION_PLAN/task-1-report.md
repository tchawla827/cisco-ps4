# Task 1 Report

## Implementation

- Added `backend/app/domain/errors.py` with the nine stable error-code constants and frozen `DomainError`.
- Added `backend/app/domain/models.py` with frozen `Employee`, `Rollup`, and `DepartmentTree` dataclasses.
- Kept the domain modules limited to standard-library dataclass support. The requested `str | None` contract is preserved; `from __future__ import annotations` is included because the provided virtual environment is Python 3.9.6.

## Checkpoint

Command, run from `backend/`:

```text
.venv/bin/python -c "from app.domain.models import Employee, Rollup, DepartmentTree"
```

Result: passed with exit status 0 and no output.

Additional checks:

- `.venv/bin/python -m py_compile app/domain/errors.py app/domain/models.py`: passed.
- `git diff --check`: passed.
- Domain import review found only `dataclasses` and `__future__` imports; no FastAPI, Pydantic, API, service, model, or test imports.

## Files changed

- `backend/app/domain/errors.py`
- `backend/app/domain/models.py`
- `.superpowers/sdd/IMPLEMENTATION_PLAN/task-1-report.md`

## Self-review

- All requested error constants use their exact uppercase names as string values.
- All requested dataclasses are frozen.
- `DepartmentTree.employees` is a tuple and the mapping/list fields preserve the requested types and source-order semantics in their contracts.
- The explanatory runtime-type-enforcement comment is present on `Employee`.
- No unrelated files were modified.

## Concerns

The repository virtual environment is Python 3.9.6, so postponed annotation evaluation is required for the mandated `str | None` syntax. No other concerns identified.
