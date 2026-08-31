# Departmental Reorg Payroll Rollup Tracker

Turns a flat employee list into a validated reporting tree, computes each
employee's complete team headcount/payroll, and lets an administrator preview
a reorganisation before/after impact — rejecting moves that would create a
reporting cycle or move the department head.

Problem statement: `Student_SPR26_D2_P04-departmental-reorg-payroll-rollup-tracker.md`
(source of truth). Product spec: `PRD.md`. System design: `ARCHITECTURE.md`.
Implementation plan: `docs/PLAN.md`. Independent expected-results oracle:
`docs/EXPECTED_RESULTS.md`.

## Stack

- **Backend:** FastAPI (Python), pure-Python domain engine, pytest.
- **Frontend:** React + TypeScript + Vite.
- **Persistence:** none — in-memory only, single local session.

## Run commands (verified from a clean checkout)

```sh
# Backend — install and run
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Backend tests (run from the backend/ directory with .venv activated)
cd backend && source .venv/bin/activate
pytest                                                    # full suite (108 tests)
pytest tests/test_transfer.py                              # single file
pytest tests/test_transfer.py -k oracle_transfer_produces   # single test

# Frontend — install and run (in a second terminal, backend must be running)
cd frontend
npm install
npm run dev                         # http://localhost:5173, calls backend at :8000

# Frontend checks
cd frontend
npm run test -- --run               # vitest, 38 tests
npm run build                       # tsc -b && vite build
npm run lint                        # oxlint
```

With both servers running, open `http://localhost:5173`, pick a scenario
(`main-12` is selected by default) and click **Load** to run the full demo
described in `docs/EXPECTED_RESULTS.md`.

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
