# Architecture — Departmental Reorg Payroll Rollup Tracker

## 1. Architecture Goals

The architecture must prioritize:
- correctness of hierarchy and rollup rules;
- deterministic behavior;
- atomic transfers;
- simple mental model;
- clear backend/frontend boundary;
- high unit-testability;
- minimal dependencies;
- fast local startup;
- easy live modification during an interview.

Avoid framework-heavy or generalized enterprise architecture that does not directly support the problem.

## 2. Chosen Stack

### Frontend
- React
- TypeScript
- Vite
- lightweight custom organisation-tree rendering (SVG or simple deterministic DOM/SVG layout)

### Backend
- FastAPI
- Python
- Pydantic for transport/request-response shapes
- pure Python domain functions for contractual business validation and algorithms

### Testing
- pytest for backend domain tests
- FastAPI `TestClient` for a small number of API integration tests
- minimal frontend tests only where they add value to critical interaction/reset behavior

### Persistence
- none
- in-memory state for the running local application

## 3. High-Level System

```text
┌──────────────────────────────────────────────┐
│ React + TypeScript                          │
│                                              │
│ OrgTree                                     │
│ EmployeeTable                               │
│ EmployeeDetails                             │
│ TransferControls                            │
│ ImpactPanel                                 │
│ Load / Reset / Errors                       │
└──────────────────────┬───────────────────────┘
                       │ HTTP / JSON
                       ▼
┌──────────────────────────────────────────────┐
│ FastAPI                                      │
│                                              │
│ Thin routes                                  │
│     ↓                                        │
│ DepartmentService                            │
│     ↓                                        │
│ Pure domain engine                           │
│  - validation                                │
│  - tree construction                         │
│  - rollups                                   │
│  - subtree collection                        │
│  - transfer validation                       │
│  - transfer application                      │
│  - before/after diff                         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ In-memory state                              │
│                                              │
│ original_employees                           │
│ current_employees                            │
│ last_successful_transfer                     │
└──────────────────────────────────────────────┘
```

## 4. Core Architectural Decisions

### AD-01 — FastAPI owns business state

The backend is the single authoritative owner of:
- original employee records;
- current employee records;
- last successful transfer result.

The frontend does not independently mutate hierarchy or recalculate payroll.

### AD-02 — Flat employee records are the canonical domain source of truth

Canonical state is an ordered `list[Employee]`.

Do not store a nested mutable tree as primary state.

The reporting tree, children lists, rollups, and API view models are derived from the flat list.

Rationale:
- the problem starts from flat records;
- a transfer changes only one `manager_id`;
- descendants remain attached naturally;
- source order remains stable;
- reset is simple;
- avoids synchronization between flat and nested representations.

### AD-03 — Employee source order never changes

Never sort or reorder canonical employee records.

Source order drives:
- employee-table order;
- direct-report sibling order;
- `changed_rollup_ids` order.

### AD-04 — Backend owns all domain calculations

React must not duplicate:
- hierarchy validation;
- child construction;
- subtree traversal;
- rollups;
- cycle checks;
- changed-rollup calculation.

The frontend renders normalized backend results.

### AD-05 — Pure domain logic is independent of FastAPI

Domain functions must not import or depend on HTTP, request objects, response models, React assumptions, or global route state.

Routes call a service; the service orchestrates pure functions.

This allows most correctness tests to run without an HTTP server.

### AD-06 — Validate before mutate

Rejected transfers must be naturally atomic.

Never mutate authoritative state and then attempt rollback.

Use:

```text
validate current request
    ↓
create candidate copy
    ↓
apply one manager_id change
    ↓
rebuild + recalculate + assert invariants
    ↓
commit candidate only on success
```

### AD-07 — Recalculate whole-tree rollups after a valid transfer

Do not implement incremental ancestor-only rollup updates.

Maximum department size is 30 employees, so a full O(n) recomputation is simpler, safer, and easier to explain.

### AD-08 — Keep the independent oracle outside runtime production inputs

Expected initial/post-transfer values must live in:
- `docs/EXPECTED_RESULTS.md`; and/or
- test constants/fixtures.

Production application modules must not import them to decide results.

## 5. Suggested Repository Layout

```text
reorg-payroll-tracker/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   │
│   │   ├── api/
│   │   │   └── department.py
│   │   │
│   │   ├── models/
│   │   │   ├── employee.py
│   │   │   ├── department.py
│   │   │   └── transfer.py
│   │   │
│   │   ├── domain/
│   │   │   ├── validation.py
│   │   │   ├── tree.py
│   │   │   ├── rollups.py
│   │   │   └── transfer.py
│   │   │
│   │   ├── services/
│   │   │   └── department_service.py
│   │   │
│   │   └── data/
│   │       └── demo_department.py
│   │
│   └── tests/
│       ├── test_validation.py
│       ├── test_rollups.py
│       ├── test_transfer.py
│       └── test_api.py
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── department.ts
│   │   ├── components/
│   │   │   ├── OrgTree.tsx
│   │   │   ├── EmployeeTable.tsx
│   │   │   ├── EmployeeDetails.tsx
│   │   │   ├── TransferControls.tsx
│   │   │   └── ImpactPanel.tsx
│   │   ├── types/
│   │   │   └── department.ts
│   │   └── App.tsx
│   └── ...
│
├── docs/
│   ├── PLAN.md
│   ├── EXPECTED_RESULTS.md
│   ├── AI_PROMPTS.md
│   ├── DESIGN_NOTES.md
│   └── TEST_EVIDENCE.md
│
├── PRD.md
├── ARCHITECTURE.md
└── README.md
```

Keep module count reasonable. If implementation remains small, combining closely related files is preferable to unnecessary layering.

## 6. Backend Domain Types

These are target shapes, not mandatory exact syntax.

### 6.1 Employee

```python
class Employee(BaseModel):
    employee_id: str
    name: str
    role: str
    monthly_salary: int
    manager_id: str | None
```

Important: Pydantic should primarily provide transport/type parsing. Contract-specific validation precedence must remain in the explicit domain validator.

### 6.2 Rollup

```python
@dataclass(frozen=True)
class Rollup:
    team_headcount: int
    team_payroll: int
```

### 6.3 DepartmentTree

```python
@dataclass
class DepartmentTree:
    root_id: str
    employee_by_id: dict[str, Employee]
    children_by_id: dict[str, list[str]]
```

### 6.4 Domain Error

```python
@dataclass(frozen=True)
class DomainError:
    code: str
    message: str
```

### 6.5 Transfer Impact

```python
@dataclass
class TransferImpact:
    employee_id: str
    old_manager_id: str
    new_manager_id: str
    moved_subtree_ids: list[str]
    moved_headcount: int
    moved_payroll: int
    changed_rollup_ids: list[str]
    changes: list[RollupChange]
```

`RollupChange` should contain employee ID and before/after rollup values.

## 7. Tree Representation

Use normalized lookup structures derived from the source-ordered employee list:

```text
root_id
employee_by_id: employee ID -> employee
children_by_id: employee ID -> ordered list of direct-report IDs
```

### 7.1 Building `employee_by_id`

Build by ID regardless of input ordering.

### 7.2 Building `children_by_id`

Initialize every employee with an empty child list, then iterate the original employee list in source order and append each non-root employee to their manager's child list.

This automatically preserves direct-report sibling order.

## 8. Department Validation Pipeline

Validation must be implemented as explicit passes to guarantee mandated precedence.

```text
Pass 1 — employee count and field validity
Pass 2 — duplicate employee IDs
Pass 3 — exactly one root
Pass 4 — self-manager / unknown-manager references
Pass 5 — management cycle
Pass 6 — defensive connected/rooted-tree invariant
```

### 8.1 Pass 1 — Field/Count Validation

Check:
- 1–30 employees;
- employee ID regex;
- trimmed non-empty name;
- trimmed non-empty role;
- integer monthly salary 1–1,000,000;
- manager ID transport shape.

Return `INVALID_EMPLOYEE` for the first affected source record.

### 8.2 Pass 2 — Duplicate IDs

Detect duplicates while respecting source-order reporting.

Return `DUPLICATE_EMPLOYEE_ID`.

### 8.3 Pass 3 — Root Count

Exactly one `manager_id is None`.

Return `INVALID_ROOT_COUNT` otherwise.

### 8.4 Pass 4 — Manager References

Evaluate source records in order.

- self-reference → `SELF_MANAGER`;
- undeclared manager → `UNKNOWN_MANAGER`.

### 8.5 Pass 5 — Existing Management Cycles

Use DFS colouring/state:

```text
UNVISITED
VISITING
VISITED
```

Encountering a `VISITING` node means a cycle.

Return `MANAGEMENT_CYCLE` with a useful cycle description where practical.

### 8.6 Pass 6 — Connected Tree Invariant

Traverse from the root and assert all employees are reachable.

This is defensive validation; a valid single-root, valid-reference, acyclic manager structure should satisfy it.

## 9. Rollup Algorithm

Use recursive postorder DFS.

For employee `u`:

```text
count = 1
payroll = salary[u]

for child in children[u]:
    child_rollup = dfs(child)
    count += child_rollup.count
    payroll += child_rollup.payroll
```

Store results in:

```text
rollups_by_id: employee ID -> Rollup
```

Complexity is O(n).

### 9.1 Root Assertions

After calculation:

```text
root.team_headcount == len(employees)
root.team_payroll == sum(employee.monthly_salary for employee in employees)
```

Failure should be treated as an internal implementation error.

## 10. Transfer Validation

Function boundary:

```python
validate_transfer(
    employees,
    tree,
    employee_id,
    new_manager_id,
) -> DomainError | None
```

Check in this exact order:

```text
1. unknown either ID         -> UNKNOWN_TRANSFER_EMPLOYEE
2. selected employee is root -> ROOT_MOVE_FORBIDDEN
3. selected == manager       -> SELF_MANAGER
4. current manager == target -> ALREADY_REPORTS_TO_MANAGER
5. target in selected subtree-> MANAGEMENT_CYCLE
```

Do not reorder these checks.

## 11. Transfer-Cycle Check

For proposed move `X -> Y`, a cycle exists if `Y` is in the current subtree rooted at `X`.

Use DFS/BFS from `X` through `children_by_id`.

If `Y` is encountered, reject with `MANAGEMENT_CYCLE` before mutation.

Do not mutate a hypothetical graph just to detect this case.

## 12. Transfer Transaction

The service-level transfer flow should be:

```text
current_employees
    ↓
current_tree + before_rollups
    ↓
validate_transfer
    ↓ invalid
return error; change nothing
    ↓ valid
collect moved subtree IDs
read moved subtree rollup from selected employee
capture old manager
    ↓
deep/shallow-copy employee records as appropriate
replace exactly selected employee with manager_id = new_manager_id
    ↓
validate/rebuild candidate tree
calculate candidate rollups
assert root invariants
    ↓
compare before vs candidate rollups in source order
    ↓
build TransferImpact
    ↓
commit candidate employees
store last_successful_transfer
    ↓
return normalized department + impact
```

Only one canonical record's `manager_id` changes.

## 13. Changed Rollup Identification

Compare all employee rollups before and after in original source order.

Employee ID belongs in `changed_rollup_ids` iff:

```text
before.team_headcount != after.team_headcount
OR
before.team_payroll != after.team_payroll
```

Do not infer this only from ancestor paths; compare exact computed values.

This deliberately excludes unchanged common ancestors such as the department head in an internal cross-branch move.

## 14. In-Memory State

The backend service may hold:

```python
original_employees: list[Employee]
current_employees: list[Employee] | None
last_successful_transfer: TransferImpact | None
```

### 14.1 Load

- validate a fresh copy of demo employees;
- set current employees;
- clear prior successful transfer;
- return normalized department state.

### 14.2 Transfer Failure

- do not mutate current employees;
- do not mutate last successful transfer;
- return structured error.

### 14.3 Transfer Success

- commit candidate employees;
- replace last successful transfer with new successful impact.

### 14.4 Reset

- restore a fresh copy of original employees;
- clear last successful transfer;
- return original normalized state.

## 15. API Surface

Keep endpoints intentionally small.

### 15.1 Load Demo

```http
POST /api/department/load
```

Purpose:
- validate and initialize the candidate-authored main department in one action.

### 15.2 Get Current Department

```http
GET /api/department
```

Purpose:
- retrieve current normalized state when loaded;
- useful for refresh/debugging.

### 15.3 Transfer

```http
POST /api/department/transfer
```

Request:

```json
{
  "employee_id": "LEAD_A",
  "new_manager_id": "MGR_B"
}
```

Success returns:
- current normalized department;
- transfer impact.

Failure returns:
- stable domain error code/message;
- authoritative department state remains unchanged.

### 15.4 Reset

```http
POST /api/department/reset
```

Purpose:
- restore exact original demo department and clear transfer result.

Do not add employee CRUD endpoints unless a live modification explicitly requires them.

## 16. API Response View Model

Return enough derived information that the frontend does not perform business calculations.

Suggested employee view:

```json
{
  "employee_id": "MGR_A",
  "name": "...",
  "role": "...",
  "monthly_salary": 100000,
  "manager_id": "HOD",
  "children_ids": ["LEAD_A", "E_X"],
  "direct_report_count": 2,
  "team_headcount": 6,
  "team_payroll": 470000
}
```

Suggested department view:

```json
{
  "root_id": "HOD",
  "employees": [...],
  "last_successful_transfer": null
}
```

Keep source employee order in the returned employee list.

## 17. HTTP vs Domain Errors

Stable domain codes are the contract the UI and tests care about.

Expected domain failures can use a consistent HTTP 4xx response (for example 400) with:

```json
{
  "error": {
    "code": "MANAGEMENT_CYCLE",
    "message": "..."
  }
}
```

Do not encode business meaning only in HTTP status text.

Unexpected root-invariant or internal consistency failures should be treated as server/internal errors.

## 18. Frontend State Boundary

Frontend should hold only presentation/interaction state such as:

```text
department response data
selectedEmployeeId
transferEmployeeId
newManagerId
loading state
transient API error
```

Do not maintain a second independently mutable organisation hierarchy.

A rejected transfer should display the new error while retaining the previously returned successful impact panel.

## 19. Frontend Components

### 19.1 `OrgTree`
Responsibilities:
- render current hierarchy from `root_id` + `children_ids`;
- support employee selection;
- show root/selected/moved/changed semantics;
- use text/symbols as well as colour.

### 19.2 `EmployeeTable`
Responsibilities:
- preserve backend source order;
- show manager, salary, team headcount, team payroll;
- allow selecting a row.

### 19.3 `EmployeeDetails`
Responsibilities:
- display role;
- own salary;
- direct-report count;
- team headcount;
- team payroll.

### 19.4 `TransferControls`
Responsibilities:
- dropdown for employee to move;
- dropdown for new manager;
- apply-transfer action;
- optional convenience controls for documented demo transfers.

Dropdowns are preferred for normal UI because a full arbitrary-ID editor is not required. Unknown-ID behavior remains covered through backend tests.

### 19.5 `ImpactPanel`
Responsibilities:
- old/new manager;
- moved subtree headcount/payroll;
- list/visual of moved subtree;
- exact changed-rollup IDs;
- before/after rollup values;
- retain last successful result if a later transfer attempt is rejected.

## 20. Tree Visualization Decision

Do not introduce D3/React Flow unless implementation evidence shows a compelling need.

Preferred solution:
- lightweight custom SVG or simple deterministic hierarchical DOM/SVG rendering;
- depth determines vertical level;
- child/subtree ordering follows source order;
- visual layout is presentation-only and must never affect hierarchy logic.

Only 12 employees are required in the main demo, so a small custom renderer is sufficient.

## 21. Accessibility / Visual States

Use labels or symbols in addition to colour.

Recommended semantics:

```text
★ ROOT
● SELECTED
↪ MOVED SUBTREE
Δ ROLLUP CHANGED
```

A node may have more than one semantic marker where appropriate.

## 22. Demo Dataset and Oracle Workflow

The exact 12-person dataset is intentionally **not hard-coded into this architecture document yet**.

The coding agent must first design one that satisfies all PRD constraints, then independently calculate expected results.

Required separation:

```text
backend/app/data/demo_department.py
    -> operational input only

docs/EXPECTED_RESULTS.md
    -> independent expected calculations

backend/tests/... test constants
    -> may assert oracle values

production app code
    -> must never import expected-result oracle
```

Prefer manually readable salaries and a transfer whose changed manager values are easy to explain aloud.

## 23. Testing Strategy

### 23.1 Domain Unit Tests — highest priority

Test pure functions for:
- 1-person tree;
- leaf rollup;
- multilevel rollup;
- root invariants;
- arbitrary source ordering;
- sibling/source-order preservation;
- each structural validation category;
- validation precedence;
- valid transfer;
- subtree preservation;
- exact changed-rollup IDs;
- cycle prevention;
- root protection;
- already-reports/self/unknown transfer errors;
- atomicity;
- deterministic reset/reapplication.

### 23.2 API Integration Tests — small set

Use FastAPI `TestClient` to verify:
- load endpoint;
- successful transfer response;
- rejected transfer leaves state unchanged;
- reset endpoint restores original state.

### 23.3 Frontend Tests — minimal but useful

If time permits, cover:
- employee selection;
- displayed transfer error;
- impact panel retention after rejected transfer;
- reset UI state.

Do not spend interview preparation time building broad frontend test infrastructure at the expense of domain coverage.

## 24. Complexity Expectations

For `n <= 30`:
- validation: O(n) plus traversal;
- tree construction: O(n);
- rollup calculation: O(n);
- subtree check: O(n) worst case;
- transfer full recomputation: O(n).

Do not add optimization caches or incremental payroll propagation unless explicitly requested later.

## 25. Concurrency / Multi-User Assumption

This is a single-user local interview application.

The in-memory service does not need production multi-user concurrency guarantees, persistence, transactions, or distributed locking.

If discussing trade-offs, state that production deployment would require a different persistence/concurrency design, but it is deliberately out of scope here.

## 26. CORS / Local Development

During local development:
- FastAPI and Vite may run on separate localhost ports;
- configure CORS only for the local frontend origin(s) required;
- do not broaden configuration unnecessarily.

README must document exact startup commands.

## 27. Failure-State Rules

### Invalid Department Load
Frontend must display the error and no stale tree/rollup/impact state.

### Rejected Transfer
Frontend must:
- show the transfer error;
- retain current valid tree and rollups;
- retain last successful impact explanation.

These two failure modes are deliberately different.

## 28. Live Modification Readiness

Keep code paths small and obvious so changes can be localized.

Examples of likely modification-friendly extension points:
- new transfer validation rule → `validate_transfer` + tests + UI message;
- new employee-derived metric → normalized backend view + UI card;
- new impact calculation → `TransferImpact` builder + panel;
- new visual badge → frontend only;
- alternate table sort for display → frontend only without mutating source-domain order.

Avoid coupling UI layout to hierarchy calculation so live UI changes cannot break domain correctness.

## 29. Documentation Requirements

Before coding, produce:
- `docs/PLAN.md` — 3–5 ordered implementation stages with checkpoints;
- `docs/EXPECTED_RESULTS.md` — independent oracle for main dataset.

During coding, maintain:
- `docs/AI_PROMPTS.md` — key prompts, refinements, accepted/rejected AI suggestions;
- `docs/DESIGN_NOTES.md` — architecture decisions/trade-offs and any deviations;
- `docs/TEST_EVIDENCE.md` — important commands/results/screenshots references.

## 30. Coding-Agent Instructions

After reading `PRD.md` and this file, the coding agent should **plan before implementation**.

Required next output from the coding agent:
1. identify any ambiguities or conflicts;
2. propose the exact 12-person deterministic demo dataset;
3. independently compute/verify the initial and post-transfer oracle;
4. produce a 3–5 stage implementation plan with concrete test checkpoints;
5. map each PRD requirement to planned modules/tests;
6. only then begin implementation.

Prefer a smaller correct implementation over abstractions that are not required by the PRD.
