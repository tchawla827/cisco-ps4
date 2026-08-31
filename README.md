# Departmental Reorg Payroll Rollup Tracker

Turns a flat employee list into a validated reporting tree, computes each
employee's complete team headcount/payroll, and lets an administrator preview
a reorganisation before/after impact — rejecting moves that would create a
reporting cycle or move the department head.

Problem statement: `Student_SPR26_D2_P04-departmental-reorg-payroll-rollup-tracker.md`
(source of truth). Product spec: `PRD.md`. System design: `ARCHITECTURE.md`.
Implementation plan: `docs/PLAN.md`. Independent expected-results oracle:
`docs/EXPECTED_RESULTS.md`.

> Status: documentation/planning stage — see `docs/PLAN.md` for the build
> sequence. `backend/` and `frontend/` do not exist yet.

## Intended stack

- **Backend:** FastAPI (Python), pure-Python domain engine, pytest.
- **Frontend:** React + TypeScript + Vite.
- **Persistence:** none — in-memory only, single local session.

## Intended run commands (once scaffolded per `ARCHITECTURE.md` §5)

```sh
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Backend tests
cd backend
pytest                              # full suite
pytest tests/test_transfer.py       # single file
pytest tests/test_transfer.py -k valid_cross_branch_transfer   # single test

# Frontend
cd frontend
npm install
npm run dev                         # served separately, calls backend at :8000
```

This section will be replaced with verified exact commands once the backend
and frontend projects are scaffolded (`docs/PLAN.md` Stage 3–4).

## Project docs

| File | Purpose |
| --- | --- |
| `PRD.md` | Product requirements, derived from the source problem statement |
| `ARCHITECTURE.md` | System design, module layout, algorithms, API surface |
| `docs/PLAN.md` | 5-stage implementation plan with checkpoints |
| `docs/EXPECTED_RESULTS.md` | Independent oracle for the 12-employee demo (never imported by app code) |
| `docs/AI_PROMPTS.md` | AI prompt history and notable accepted/rejected suggestions |
| `docs/DESIGN_NOTES.md` | Trade-offs and deviations discovered during implementation |
| `docs/TEST_EVIDENCE.md` | Repeatable test/demo evidence checklist |
