# Task 6 Report — Pydantic transport models and FastAPI layer

## Recovery audit

This task resumed from base commit `7f53096` with five untracked, interrupted
implementation files:

- `backend/app/api/department.py`
- `backend/app/main.py`
- `backend/app/models/department.py`
- `backend/tests/test_ad08_guard.py`
- `backend/tests/test_api.py`

The first recovered-state test command observed, before any edits, was run from
the repository root exactly as requested:

```text
$ .venv/bin/pytest -v backend/tests/test_api.py backend/tests/test_ad08_guard.py
zsh:1: no such file or directory: .venv/bin/pytest
```

The environment is actually `backend/.venv`. The first focused run from the
correct backend directory then collected 18 tests: the two AD-08 guards passed,
but all 16 API tests errored while importing the router. FastAPI/Pydantic on
Python 3.9 could not evaluate the deferred annotation
`dict[str, object] | JSONResponse` and raised `TypeError`.

The partial implementation was otherwise aligned with the requested API shape:
one module-level service, direct JSON error envelopes, source-ordered views,
and restricted local CORS origins. The recovery fix made transfer and preview
routes explicitly `response_model=None` and removed the incompatible inferred
union return annotations. Added regression coverage for default loading and an
unhandled `RootInvariantError` returning HTTP 500. Test fixtures reset the
module-level service before and after each API test; the explicit invariant test
also resets it in `finally`.

## Implementation

- Added transport-only Pydantic request and response schemas, including nested
  totals and rollup change views.
- Added the complete `/api` router: scenario list, load, read, transfer,
  preview, and reset.
- Domain failures return direct `JSONResponse` envelopes; unloaded state is the
  API-only `NO_DEPARTMENT_LOADED` 409. `RootInvariantError` is not converted
  into a domain outcome and therefore surfaces as a 500.
- Added FastAPI setup and CORS limited to `http://localhost:5173` and
  `http://127.0.0.1:5173`.
- Added API/AD-08 tests and the requested D3/D6/API-boundary documentation.

## Verification

Final checkpoint from `backend`:

```text
$ .venv/bin/pytest -v
============================== 86 passed in 0.38s ==============================
```

Live HTTP verification used Uvicorn on `127.0.0.1:8011` and completed:

```text
POST /api/department/load                         200
POST /api/department/transfer LEAD_A -> MGR_C     200
POST /api/department/transfer MGR_A -> E3         400 MANAGEMENT_CYCLE
POST /api/department/reset                        200
```

The transfer impact had moved IDs `LEAD_A,E1,E2`, headcount `3`, payroll
`145000`, and changed rollups `MGR_A,MGR_C`. Reset restored root totals to
`12` employees and payroll `821000`, with no last successful transfer. Uvicorn
was stopped cleanly after the round trip.

## Files

- `backend/app/models/department.py`
- `backend/app/api/department.py`
- `backend/app/main.py`
- `backend/tests/test_api.py`
- `backend/tests/test_ad08_guard.py`
- `docs/AI_PROMPTS.md`
- `docs/DESIGN_NOTES.md`

## Self-review

- Verified no `sorted(` use under `backend/app`.
- Verified no production references to `tests`, `tests.oracle`, or
  `EXPECTED_RESULTS`.
- AD-08 confirms all domain modules remain free of FastAPI and Pydantic.
- `git diff --check` is clean after staging.

## Concerns

None. The root-level `.venv/bin/pytest` path named in the task is absent; the
project's committed backend workflow and its actual environment use
`backend/.venv/bin/pytest` from `backend`.
