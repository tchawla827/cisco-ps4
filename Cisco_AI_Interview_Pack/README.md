# Departmental Reorg Payroll Rollup Tracker

A local tool that takes flat employee records, builds a valid reporting hierarchy, calculates team-level payroll rollups, and lets an administrator safely preview or apply reporting-line changes.

## Problem

The input is a flat list of employees, but the questions are hierarchical: who reports under whom, what each manager's full team costs, and what changes after a reorganisation.

A reporting-line change can also create invalid states such as a management cycle or an attempt to move the department head.

## Solution

The application:

- validates employee records in a fixed first-error order;
- builds one reporting tree while preserving source order;
- calculates complete-team headcount and monthly payroll for every employee;
- previews and applies reporting-line changes;
- rejects invalid transfers without changing the current state;
- shows the moved subtree and only the rollups whose values actually changed.

## Main Demo

The main scenario has 12 employees and a total monthly payroll of **INR 821,000**.

The primary valid transfer is:

`LEAD_A -> MGR_C`

`LEAD_A` moves with its complete three-person subtree. `MGR_A` and `MGR_C` are the only managers whose rollup values change; the department head remains unchanged.

The primary invalid transfer is:

`MGR_A -> E3`

This would create a management cycle, so the request is rejected and the current department remains unchanged.

## Architecture

```text
React + TypeScript
        |
        v
FastAPI routes
        |
        v
DepartmentService
        |
        +--> validation
        +--> tree construction
        +--> rollups
        +--> transfer rules
        |
        v
in-memory employee state
```

The backend owns all hierarchy, payroll, and transfer rules. The frontend renders backend snapshots and keeps only UI state such as selection, staged input, and panel state.

## Tech Stack

| Area | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | FastAPI, Python, Pydantic |
| Domain model | Python dataclasses |
| Testing | pytest, Vitest, Testing Library |
| Persistence | In-memory for the local interview scope |

## Running Locally

```bash
# backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# frontend
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Verification

```bash
cd backend && .venv/bin/pytest -q
cd frontend && npm run test -- --run
cd frontend && npm run build
cd frontend && npm run lint
```

Current verified result:

- **108 backend tests passed**
- **38 frontend tests passed**
- frontend build passed
- lint exits successfully with one Fast Refresh warning in `OrgTreeCanvas.tsx`
