# Implementation Plan — Departmental Reorg Payroll Rollup Tracker

> Sequential, executable expansion of `docs/PLAN.md`'s 5 stages into 14 ordered steps.
> Written to be picked up and executed top-to-bottom by a coding agent with no further
> design decisions required. `docs/PLAN.md` remains the canonical stage-level summary;
> log deviations there, not here.

## Context

The repo holds only specs (`Student_SPR26_D2_P04-*.md` → `PRD.md` → `ARCHITECTURE.md` →
`docs/PLAN.md` → `docs/EXPECTED_RESULTS.md`). No `backend/` or `frontend/` exists yet.

Build a local tool that turns 12 flat employee records into one validated reporting tree,
computes every employee's complete team headcount/payroll, applies one cross-branch
transfer, rejects illegal moves atomically, and explains before/after impact — with
repeatable test evidence for each graded rule.

The oracle in `docs/EXPECTED_RESULTS.md` was independently re-derived during planning and
is **correct**; dataset and transfer choice need no changes.

Two gaps this plan closes: `POST /api/department/load` took no argument, so the Required
one-employee department and the Required "failed load shows no stale state" criteria were
unreachable from the UI and could only ever be pytest output. Load now takes a `scenario`
key and the UI gets a scenario picker.

Design decisions settled before writing this plan: FastAPI + React/Vite as two processes ·
scenario picker · SVG computed org-chart layout · dark-console theme · three-column cockpit
layout · per-employee change cards for impact · all three optional extras (compare drawer,
frontend tests, transfer preview).

---

## Ground rules for the executing agent

Read these once; they apply to every step.

1. **Do the steps in order.** Each step ends at a checkpoint. Do not start step N+1 until
   step N's checkpoint passes. If a checkpoint fails, fix it before moving on.
2. **`backend/app/domain/**` is pure.** No `fastapi`, no `pydantic`, no imports from
   `app.api`, `app.services`, `app.models`, or `tests`. Enforced by a test in step 6.
3. **Never re-sort employees.** Source order drives the employee table, each manager's
   `children_ids`, and `changed_rollup_ids`. No `sorted()` anywhere in `app/domain/**` or
   `app/services/**`.
4. **Validate fully, then build a candidate, then commit.** Never mutate authoritative
   state and roll back. `Employee` is frozen, so mutation is impossible by construction.
5. **Validation order is a hard contract.** 6 load passes, 5 transfer checks, exactly as
   written. Reordering breaks graded precedence tests.
6. **`changed_rollup_ids` is an exact before/after diff**, never an ancestor-path guess.
   An unchanged common ancestor (the department head, here) must not appear.
7. **Oracle isolation (AD-08).** Expected values live in `backend/tests/oracle.py` and
   `docs/EXPECTED_RESULTS.md` only. Nothing under `backend/app/**` may reference them.
8. **Append, never rewrite.** Log deviations under `docs/PLAN.md` "Deviations"; keep
   `docs/AI_PROMPTS.md` and `docs/DESIGN_NOTES.md` current as you go, not at the end.
9. **TDD where it is cheap.** For steps 2–6, write the test file first, watch it fail,
   then implement. The domain rules are the graded content.

### Deviations to log in `docs/PLAN.md` and `docs/DESIGN_NOTES.md`

| # | Deviation | Why |
|---|---|---|
| D1 | Domain `Employee` is a frozen **dataclass**, not `BaseModel` (vs `ARCHITECTURE.md` §6.1 snippet) | AD-05 purity; and invalid fixtures (empty name, salary `0`, non-int salary) must be *constructible* so Pass 1 can reject them. Pydantic stays in `models/` for transport only. |
| D2 | `load` takes a `scenario` key; invalid datasets live in `app/data/scenarios.py` | Closes the two unreachable acceptance criteria. These are *operational inputs*, not oracle values — AD-08 still holds. |
| D3 | Added `GET /api/scenarios` and `POST /api/department/transfer/preview` | Picker needs the list; preview serves "see the proposed structure **before approving**" from the problem statement. |
| D4 | SVG computed layout for the tree | `ARCHITECTURE.md` §20 left the choice open. |
| D5 | Frontend caches the load-time department **response** for the compare drawer | Renders a backend-computed snapshot; never recomputes hierarchy or rollups, so AD-04 holds. |
| D6 | API-level code `NO_DEPARTMENT_LOADED` | Not a domain code; the six domain codes are unchanged. |
| D7 | Dark theme, three-column cockpit | Not specified in `ARCHITECTURE.md`. |
| D8 | `DepartmentTree` also carries `employees` (source-order tuple) | Lets rollup/diff functions take one argument instead of two; keeps source order attached to the structure it governs. |

---

## Step 0 — Scaffold the backend

**Files**

```
backend/requirements.txt      fastapi, uvicorn[standard], pytest, httpx
backend/pytest.ini            [pytest] testpaths = tests ; pythonpath = .
backend/app/__init__.py       (empty; also app/domain, app/models, app/services, app/api, app/data)
backend/tests/__init__.py
backend/.gitignore            .venv/, __pycache__/, .pytest_cache/
```

**Do**

```sh
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

**Checkpoint 0** — `cd backend && pytest` exits 0 with "no tests ran".
`python -c "import fastapi, httpx"` succeeds.

---

## Step 1 — Domain errors and models

**`backend/app/domain/errors.py`**

Module-level string constants (exact spellings — the UI and tests key off them):

```
INVALID_EMPLOYEE  DUPLICATE_EMPLOYEE_ID  INVALID_ROOT_COUNT
UNKNOWN_MANAGER   SELF_MANAGER           MANAGEMENT_CYCLE
UNKNOWN_TRANSFER_EMPLOYEE   ROOT_MOVE_FORBIDDEN   ALREADY_REPORTS_TO_MANAGER
```

plus `@dataclass(frozen=True) class DomainError: code: str; message: str`.

**`backend/app/domain/models.py`**

```python
@dataclass(frozen=True)
class Employee:
    employee_id: str
    name: str
    role: str
    monthly_salary: int
    manager_id: str | None
```

> Add a comment: *annotations are documentation only — dataclasses do not enforce them at
> runtime. `validation.py` is the sole enforcer, and invalid scenario fixtures deliberately
> violate these types so Pass 1 can reject them.*

```python
@dataclass(frozen=True)
class Rollup:
    team_headcount: int
    team_payroll: int

@dataclass(frozen=True)
class DepartmentTree:
    root_id: str
    employees: tuple[Employee, ...]          # canonical source order
    employee_by_id: dict[str, Employee]
    children_by_id: dict[str, list[str]]     # source-ordered direct reports
```

**Checkpoint 1** — from `backend/`,
`python -c "from app.domain.models import Employee, Rollup, DepartmentTree"` succeeds.

---

## Step 2 — Load validation (the 6 passes)

Write `backend/tests/test_validation.py` **first**.

**`backend/app/domain/validation.py`**

```python
EMPLOYEE_ID_PATTERN = re.compile(r"^[A-Z][A-Z0-9_-]{0,15}$")
MIN_EMPLOYEES, MAX_EMPLOYEES = 1, 30
MIN_SALARY, MAX_SALARY = 1, 1_000_000

def validate_department(employees: Sequence[Employee]) -> DomainError | None:
    """Run the 6 passes in order; return the first error, or None."""
```

Six private helpers, each `-> DomainError | None`, called in this exact order:

**`_pass1_fields`** — first the count (`MIN..MAX`, else `INVALID_EMPLOYEE` with message
`"Department must contain 1-30 employees; got {n}"`), then each record in source order,
checking in this sub-order so the message is specific:
`employee_id` is `str` and matches the pattern → `name` is `str` and `.strip()` non-empty →
`role` likewise → `monthly_salary` (**`type(x) is int`, not `isinstance`, so `True` is
rejected**) within 1..1,000,000 → `manager_id` is `None` or `str`.
Return `INVALID_EMPLOYEE` naming the source index and the offending field.

**`_pass2_duplicates`** — walk source order with a `seen` dict; the first ID already seen
returns `DUPLICATE_EMPLOYEE_ID`, message naming both record positions.

**`_pass3_root_count`** — `len([e for e in employees if e.manager_id is None]) != 1` →
`INVALID_ROOT_COUNT`, message giving the count and the root IDs found.

**`_pass4_manager_refs`** — **one single loop** over source records (not two sequential
loops — self-manager and unknown-manager are *one* precedence category, resolved by source
order, so two loops would let a later record's error win). Skip records with
`manager_id is None`. Per record: `manager_id == employee_id` → `SELF_MANAGER`;
`manager_id not in id_set` → `UNKNOWN_MANAGER`.

**`_pass5_cycle`** — parent-pointer walk with WHITE/GREY/BLACK colouring, O(n):

```
state = {id: WHITE for each id}
for e in employees (source order):
    path = []
    cur = e.employee_id
    while cur is not None and state[cur] is WHITE:
        state[cur] = GREY; path.append(cur); cur = by_id[cur].manager_id
    if cur is not None and state[cur] is GREY:
        cycle = path[path.index(cur):]
        return MANAGEMENT_CYCLE, message "Management cycle detected: A -> B -> A"
    for n in path: state[n] = BLACK
```

**`_pass6_connected`** — passes 1–5 guarantee one root, known refs, and acyclicity, so
`build_tree` is safe here. Traverse from `root_id` through `children_by_id`; if the
reachable count != `len(employees)`, return `MANAGEMENT_CYCLE` naming the unreachable IDs.
This is defensive and should be unreachable in practice.

**Tests — `backend/tests/test_validation.py`**

- Each code fires on a minimal fixture: `INVALID_EMPLOYEE` (bad ID regex, blank name,
  blank role, salary `0`, salary `1_000_001`, salary `True`, salary `"40000"`),
  `DUPLICATE_EMPLOYEE_ID`, `INVALID_ROOT_COUNT` (0 roots, 2 roots), `SELF_MANAGER`,
  `UNKNOWN_MANAGER`, `MANAGEMENT_CYCLE`.
- Count bounds: 0 employees → error; 1 → valid; 30 → valid; 31 → error.
- **Precedence** (one fixture per pair, each asserting the *earlier* code wins):
  bad-field + duplicate-ID → `INVALID_EMPLOYEE`; duplicate-ID + two-roots →
  `DUPLICATE_EMPLOYEE_ID`; two-roots + unknown-manager → `INVALID_ROOT_COUNT`;
  unknown-manager + cycle → `UNKNOWN_MANAGER`.
- **Within-category source order**: two unknown-manager records → the error names the
  earlier one. Same for two duplicate IDs, two bad fields.
- Self-manager at record 5 and unknown-manager at record 2 → `UNKNOWN_MANAGER` (proves
  the single-loop requirement).
- A valid department whose records are shuffled so managers appear *after* their reports
  → returns `None`.

**Checkpoint 2** — `cd backend && pytest tests/test_validation.py -v` fully green.

---

## Step 3 — Tree construction and rollups

Write `backend/tests/test_tree.py` and `backend/tests/test_rollups.py` first.

**`backend/app/domain/tree.py`**

```python
def build_tree(employees: Sequence[Employee]) -> DepartmentTree
def collect_subtree_ids(tree: DepartmentTree, employee_id: str) -> list[str]
```

`build_tree`: build `employee_by_id` by ID (never assume managers appear first); seed
`children_by_id` with an empty list for **every** employee; then walk the source-ordered
list appending each non-root ID to its manager's list — this is what makes sibling order
equal source order for free. `root_id` is the single `manager_id is None` record.
Assumes validation already passed.

`collect_subtree_ids`: preorder DFS from `employee_id`, visiting children in
`children_by_id` order; **includes `employee_id` itself** as the first element.

**`backend/app/domain/rollups.py`**

```python
class RootInvariantError(Exception): ...
def calculate_rollups(tree: DepartmentTree) -> dict[str, Rollup]
def assert_root_invariants(tree: DepartmentTree, rollups: dict[str, Rollup]) -> None
```

`calculate_rollups`: postorder DFS, `count = 1 + sum(child counts)`,
`payroll = salary + sum(child payrolls)`. Plain recursion is fine at n ≤ 30. Integers only —
never float, never round, never format inside the calculation.

`assert_root_invariants`: raises `RootInvariantError` unless
`rollups[root].team_headcount == len(tree.employees)` **and**
`rollups[root].team_payroll == sum(e.monthly_salary for e in tree.employees)`.
This is an implementation error, not an alternate interpretation — it must raise, not return.

**Tests**

- `test_tree.py`: children lists are in source order; a manager declared after its reports
  still resolves; every employee (including leaves) has a `children_by_id` entry;
  `collect_subtree_ids` includes self, is preorder, and returns `["LEAD_A","E1","E2"]` for
  `LEAD_A` in the main dataset.
- `test_rollups.py`: leaf → headcount 1 and payroll == own salary; solo department → 1 and
  its salary; the full 12-row initial oracle table asserted row by row; root invariants
  hold; `assert_root_invariants` raises on a deliberately corrupted rollup dict.

**Checkpoint 3** — `pytest tests/test_tree.py tests/test_rollups.py -v` green, including
all 12 initial oracle rows.

---

## Step 4 — Transfer domain logic

Write `backend/tests/test_transfer.py` first.

**`backend/app/domain/transfer.py`**

```python
@dataclass(frozen=True)
class RollupChange:
    employee_id: str
    before: Rollup
    after: Rollup

@dataclass(frozen=True)
class TransferImpact:
    employee_id: str
    old_manager_id: str
    new_manager_id: str
    moved_subtree_ids: list[str]
    moved_headcount: int
    moved_payroll: int
    changed_rollup_ids: list[str]
    changes: list[RollupChange]
    root_unchanged: bool

def validate_transfer(tree, employee_id, new_manager_id) -> DomainError | None
def apply_transfer(employees, employee_id, new_manager_id) -> list[Employee]
def diff_rollups(employees, before, after) -> list[str]
```

`validate_transfer` — these five checks, **in this order, no reordering**:

| # | Condition | Code |
|---|---|---|
| 1 | either ID absent from `employee_by_id` | `UNKNOWN_TRANSFER_EMPLOYEE` |
| 2 | `employee_id == tree.root_id` | `ROOT_MOVE_FORBIDDEN` |
| 3 | `employee_id == new_manager_id` | `SELF_MANAGER` |
| 4 | `by_id[employee_id].manager_id == new_manager_id` | `ALREADY_REPORTS_TO_MANAGER` |
| 5 | `new_manager_id in collect_subtree_ids(tree, employee_id)` | `MANAGEMENT_CYCLE` |

Check 3 is logically subsumed by check 5 but must run first to emit the right code.
Check 5 reads the **current** tree — never mutate a hypothetical graph to detect the cycle.

`apply_transfer` — returns a **new** list, same length, same order, with exactly one record
replaced via `dataclasses.replace(e, manager_id=new_manager_id)`. Input untouched.

`diff_rollups` — walk `employees` in source order, include an ID iff
`before[id].team_headcount != after[id].team_headcount or before[id].team_payroll != after[id].team_payroll`.
Exact value comparison only — never ancestor-path inference.

**Tests — `backend/tests/test_transfer.py`**

- Each of the five codes on a targeted fixture.
- Precedence: root + would-be-cycle → `ROOT_MOVE_FORBIDDEN`; unknown ID + root →
  `UNKNOWN_TRANSFER_EMPLOYEE`; self + already-reports → `SELF_MANAGER`.
- **The oracle transfer** `LEAD_A → MGR_C`: post-transfer rollups match all 12 oracle rows;
  `changed_rollup_ids == ["MGR_A", "MGR_C"]` exactly (asserting `HOD` is *absent*);
  `moved_subtree_ids == ["LEAD_A","E1","E2"]`, `moved_headcount == 3`,
  `moved_payroll == 145000`; `HOD` stays 12 / 821,000.
- Subtree preservation: `E1`/`E2` still report to `LEAD_A`; no salary changed; the source
  list order is identical before and after.
- Sibling order: `MGR_C.children_ids == ["LEAD_A", "E6"]` (source record 5 before 12) and
  `MGR_A.children_ids == ["E3"]`.
- **Atomicity**: snapshot `employees` + rollups, attempt `MGR_A → E3`, assert the error is
  `MANAGEMENT_CYCLE` and both snapshots compare equal afterwards.
- Determinism: apply → reset → apply again reproduces an identical `TransferImpact`.

**Checkpoint 4** — `pytest tests/test_transfer.py -v` green. `pytest` (whole suite) green.

---

## Step 5 — Scenarios, oracle module, and the service

**`backend/app/data/scenarios.py`** — operational input only. No oracle values, no imports
from `tests`.

`main-12`, exactly this, in this order:

| # | id | role | salary | manager |
|---|---|---|---|---|
| 1 | `HOD` | Department Head | 200000 | `None` |
| 2 | `MGR_A` | Programme Manager | 90000 | `HOD` |
| 3 | `MGR_B` | Laboratory Manager | 85000 | `HOD` |
| 4 | `MGR_C` | Operations Manager | 78000 | `HOD` |
| 5 | `LEAD_A` | Project Lead | 65000 | `MGR_A` |
| 6 | `LEAD_B` | Research Lead | 60000 | `MGR_B` |
| 7 | `E1` | Developer | 42000 | `LEAD_A` |
| 8 | `E2` | Developer | 38000 | `LEAD_A` |
| 9 | `E3` | Designer | 47000 | `MGR_A` |
| 10 | `E4` | Analyst | 41000 | `LEAD_B` |
| 11 | `E5` | Technician | 36000 | `MGR_B` |
| 12 | `E6` | Coordinator | 39000 | `MGR_C` |

Give each a plausible `name`. Other scenarios:

| key | kind | must produce |
|---|---|---|
| `solo-1` | valid | `SOLO`, salary 50000, `manager_id=None` → headcount 1, payroll 50000 |
| `invalid-duplicate-id` | invalid | `DUPLICATE_EMPLOYEE_ID` |
| `invalid-unknown-manager` | invalid | `UNKNOWN_MANAGER` (a record pointing at `GHOST`) |
| `invalid-cycle` | invalid | `MANAGEMENT_CYCLE` — one real root **plus a disjoint `C1↔C2` pair**, so root count stays exactly 1 and passes 1–4 clear, isolating the cycle |
| `invalid-precedence` | invalid | contains a duplicate ID *and* a cycle → must report `DUPLICATE_EMPLOYEE_ID`, demonstrating the precedence contract live |

Expose `SCENARIOS: dict[str, Scenario]` where `Scenario` has `key`, `label`, `kind`
(`"valid"`/`"invalid"`), `description`, and `employees()` returning a **fresh list** each
call (never hand out a shared mutable list).

**`backend/tests/oracle.py`** — hand-transcribed from `docs/EXPECTED_RESULTS.md`. Test-only.
Constants: `TOTAL_PAYROLL = 821_000`, `INITIAL_ROLLUPS`, `POST_TRANSFER_ROLLUPS`,
`CHANGED_IDS = ["MGR_A", "MGR_C"]`, `MOVED_SUBTREE_IDS`, `MOVED_HEADCOUNT = 3`,
`MOVED_PAYROLL = 145_000`. Retro-fit steps 3–4's tests to import from here.

**`backend/app/services/department_service.py`**

State: `_original_employees`, `_current_employees`, `_last_successful_transfer`,
`_loaded_scenario` — all `| None`.

- `load(scenario_key)` — unknown key → `DomainError("UNKNOWN_SCENARIO", ...)`. Validate a
  fresh copy. **On failure, set all four fields to `None` before returning the error** so
  stale state is cleared server-side too, then return the error. On success set original +
  current, clear `_last_successful_transfer`, record the scenario.
- `get_state()` — `None` if nothing loaded.
- `transfer(employee_id, new_manager_id)` — the `ARCHITECTURE.md` §12 sequence: build
  current tree + before-rollups → `validate_transfer` → on error **return without touching
  any field** → collect moved subtree and its rollup, capture old manager →
  `apply_transfer` into a candidate list → rebuild + recalc + `assert_root_invariants` →
  `diff_rollups` → build `TransferImpact` → **only now** commit `_current_employees` and
  `_last_successful_transfer`.
- `preview(employee_id, new_manager_id)` — byte-identical to `transfer` except it returns
  the impact and **assigns nothing**. Factor the shared part into `_compute_transfer(...)`
  so the two paths cannot drift.
- `reset()` — `_current_employees = fresh copy of _original_employees`;
  `_last_successful_transfer = None`. Returns `None` if nothing was loaded.

**Checkpoint 5** — a scratch script (or `pytest -k service`) drives
load(`main-12`) → transfer(`LEAD_A`,`MGR_C`) → transfer(`MGR_A`,`E3`) → reset, and every
value matches `tests/oracle.py`. `load("invalid-precedence")` returns
`DUPLICATE_EMPLOYEE_ID` and leaves `get_state()` returning `None`.

---

## Step 6 — Pydantic transport models and the FastAPI layer

**`backend/app/models/`** — response schemas only; **no business validation here**
(precedence-sensitive rules stay in `domain/validation.py`).

```
EmployeeView      employee_id,name,role,monthly_salary,manager_id,
                  children_ids,direct_report_count,team_headcount,team_payroll
DepartmentView    scenario, root_id, employees[EmployeeView],
                  totals{employee_count,total_payroll}, last_successful_transfer|null
RollupView        team_headcount, team_payroll
RollupChangeView  employee_id,name,role,before:RollupView,after:RollupView
TransferImpactView  employee_id,employee_name,old_manager_id,new_manager_id,
                  moved_subtree_ids,moved_headcount,moved_payroll,
                  changed_rollup_ids,changes[RollupChangeView],root_unchanged
ScenarioView      key,label,kind,description
TransferRequest   employee_id: str, new_manager_id: str
LoadRequest       scenario: str = "main-12"
```

`employees` must stay in source order in the response.

**`backend/app/api/department.py`**

```
GET  /api/scenarios                    -> [ScenarioView]
POST /api/department/load              LoadRequest  -> DepartmentView
GET  /api/department                   -> DepartmentView
POST /api/department/transfer          TransferRequest -> {department, impact}
POST /api/department/transfer/preview  TransferRequest -> {impact}
POST /api/department/reset             -> DepartmentView
```

Errors: return a `JSONResponse` **directly** (not `HTTPException`, whose `detail` wrapper
would produce the wrong envelope):

```json
400 {"error": {"code": "MANAGEMENT_CYCLE", "message": "..."}}
409 {"error": {"code": "NO_DEPARTMENT_LOADED", "message": "..."}}
```

`RootInvariantError` must surface as a 500 — it is an implementation defect, never a
business outcome. Single module-level `DepartmentService` instance (single-user local app).

**`backend/app/main.py`** — create the app, include the router, add `CORSMiddleware`
restricted to `http://localhost:5173` and `http://127.0.0.1:5173` only.

**Tests — `backend/tests/test_api.py`** (FastAPI `TestClient`)

- `GET /api/department` before any load → 409 `NO_DEPARTMENT_LOADED`.
- `POST /load {main-12}` → 200; 12 employees in source order; `HOD` shows 12 / 821,000.
- `POST /load {solo-1}` → headcount 1, payroll 50,000.
- Each invalid scenario → 400 with its expected code; **and** a load of `main-12` followed
  by a load of `invalid-duplicate-id` leaves `GET /api/department` returning 409 (proves
  stale-state clearing).
- `POST /transfer {LEAD_A, MGR_C}` → impact matches the oracle.
- `POST /transfer {MGR_A, E3}` → 400 `MANAGEMENT_CYCLE`, and a subsequent
  `GET /api/department` is byte-identical to the pre-attempt response, with
  `last_successful_transfer` still populated.
- `POST /transfer {HOD, MGR_A}` → 400 `ROOT_MOVE_FORBIDDEN`.
- `POST /transfer/preview` returns an impact but leaves `GET /api/department` unchanged and
  `last_successful_transfer` untouched.
- `POST /reset` restores the initial 12 rollups and clears `last_successful_transfer`;
  re-applying the same transfer reproduces an identical impact.

**Tests — `backend/tests/test_ad08_guard.py`**

Walk every `.py` under `backend/app/`; fail if any contains `tests.oracle`, `from tests`,
`import tests`, or `EXPECTED_RESULTS`. Also assert no `app.domain.*` module's source
contains `fastapi` or `pydantic`.

**Checkpoint 6** — `cd backend && pytest -v` fully green.
`uvicorn app.main:app --reload --port 8000` boots, and a curl round-trip of
load → transfer → reject → reset matches `docs/EXPECTED_RESULTS.md`.

---

## Step 7 — Frontend scaffold, types, API client

```sh
cd frontend && npm create vite@latest . -- --template react-ts
npm i && npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Set `vite.config.ts` to proxy `/api` → `http://localhost:8000` (removes CORS friction in
dev) and configure vitest with the `jsdom` environment.

- `src/types/department.ts` — TS mirrors of every view model from step 6, plus
  `ApiError { code: string; message: string }`.
- `src/api/department.ts` — `listScenarios()`, `loadDepartment(scenario)`,
  `getDepartment()`, `transfer(a,b)`, `previewTransfer(a,b)`, `resetDepartment()`.
  Each parses `{error:{code,message}}` on non-2xx and **throws a typed `ApiError`** —
  never returns a partial department on failure.

**Checkpoint 7** — `npm run dev` serves a stub page that calls `loadDepartment("main-12")`
and renders raw JSON containing `"team_payroll": 821000`.

---

## Step 8 — Theme, shell layout, header, banner, employee table

**`src/theme.css`** — dark console tokens as CSS custom properties:

```
--canvas #0B0E14   --panel #131822   --panel-raised #1A2130   --border #2A3342
--text #E6EAF2     --text-muted #9AA6B8
--interactive #5B8DEF  --root #F2C94C  --moved #FF9F45  --changed #B47CF5
--danger #FF6B6B   --ok #4ADE80
```

Verify every text/background pair at **WCAG AA** — dark themes lose contrast badly on
projectors, and this will be demoed on one. All currency and count cells use
`font-variant-numeric: tabular-nums` so before/after digits align vertically.

**`src/components/StatusBadge.tsx`** — renders **symbol + label + colour, never colour
alone**: `★ ROOT`, `● SELECTED`, `↪ MOVED`, `Δ CHANGED`. A node may carry several at once.

**`src/App.tsx`** — three-column cockpit grid: header row across the top; then left rail
(employee table), centre (org chart), right rail (Details → Transfer → Impact, stacked in
demo-narration order). State:

```
scenarios, scenario, department, originalDepartment, selectedId,
transferEmployeeId, newManagerId, previewImpact, banner{kind,code,message}|null,
loading, compareOpen
```

**The two failure modes are deliberately different** — this is the easiest thing to get
wrong, and both are graded:

- **Invalid load** → clear `department`, `originalDepartment`, `previewImpact`,
  `selectedId`, and both transfer selects; show the error banner over an empty state.
- **Rejected transfer** → show the error banner but keep the tree, rollups, and
  `last_successful_transfer` panel fully intact; clear only `previewImpact`.

`AppHeader.tsx` — scenario `<select>`, Load, Reset, Compare toggle.
`MessageBanner.tsx` — shows the error `code` **and** message, or a success line.
`EmployeeTable.tsx` — backend source order (never re-sorted), columns ID · name · role ·
manager · salary · team HC · team ₹, badges per row, row click sets `selectedId`.

**Checkpoint 8** — load `main-12` in the browser: 12 rows in source order, `HOD` reads
12 / 821,000, clicking a row highlights it. Load `invalid-duplicate-id`: table empties and
the banner shows `DUPLICATE_EMPLOYEE_ID`.

---

## Step 9 — Org chart (SVG)

**`src/components/orgTreeLayout.ts`** — a **pure, unit-tested** function. Presentation only;
it must never feed back into domain logic.

```ts
export function layoutTree(department: DepartmentView): {
  nodes: { id: string; x: number; y: number }[];
  edges: { parentId: string; childId: string; path: string }[];
  width: number; height: number;
}
```

Algorithm: `y = depth * (NODE_H + V_GAP)`. A post-order pass gives each leaf the next
sequential x slot (`slot++ * (NODE_W + H_GAP)`) and centres each internal node over the
midpoint of its first and last child. Children are visited in `children_ids` order, so
left-to-right on screen equals source order. Edges are orthogonal elbows
(`M px,pBottom V mid H cx V cTop`), which read as a conventional org chart.

**`src/components/OrgTree.tsx`** — renders the computed nodes as focusable
`<g role="treeitem" tabIndex=0>` groups with the ID, name, and `HC · ₹` beneath; click and
Enter/Space select. Highlight state derives from
`previewImpact ?? department.last_successful_transfer`: root → `★`, `selectedId` → `●`,
`moved_subtree_ids` → `↪`, `changed_rollup_ids` → `Δ`.
**Preview highlights use a dashed outline** so an un-applied preview is never mistaken for a
committed transfer. Wrap in `<svg viewBox>` so the chart scales to the column.

**Checkpoint 9** — the chart renders `HOD` on top with `MGR_A`/`MGR_B`/`MGR_C` left-to-right
in source order, `E1`/`E2` at depth 3 under `LEAD_A`, no overlapping nodes, and selection
works by click and by keyboard.

---

## Step 10 — Details, transfer controls, impact panel

`EmployeeDetails.tsx` — for `selectedId`: ID, name, role, own monthly salary, direct-report
count, team headcount, team payroll. Strictly read-only; selecting changes nothing else.

`TransferControls.tsx` — "Move" `<select>` (all employees except root — the root option is
kept but **disabled with a hint**, so the `ROOT_MOVE_FORBIDDEN` path can still be
demonstrated via a dedicated "Attempt root move" demo button), "Under" `<select>` (all
employees), plus **Preview**, **Apply**, and two convenience buttons preloading the
documented valid transfer (`LEAD_A → MGR_C`) and the documented cycle attempt
(`MGR_A → E3`).

`ImpactPanel.tsx` + `ChangeCard.tsx` — per-employee change cards:

```
┌─ ↪ MOVED ───────────────────┐   ┌─ Δ CHANGED ─────────────────┐
│ LEAD_A  Project Lead        │   │ MGR_A  Programme Manager    │
│ MGR_A → MGR_C               │   │ headcount   5 → 2      −3   │
│ subtree  3 · ₹145,000       │   │ payroll  282,000 → 137,000  │
└─────────────────────────────┘   └─────────────────────────────┘
```

Cards follow `changed_rollup_ids` order (i.e. source order). Below them, print an explicit
line — `★ HOD  12 · ₹821,000 unchanged — not financially affected` — driven by
`root_unchanged`. The panel **retains the last successful impact when a later transfer is
rejected**; only a preview or a reset replaces it.

**Checkpoint 10** — full browser walkthrough: load `main-12` → inspect several employees →
Apply `LEAD_A → MGR_C` → cards read `MGR_A` 5→2 / 282,000→137,000 and `MGR_C` 2→5 /
117,000→262,000 → attempt `MGR_A → E3` → banner shows `MANAGEMENT_CYCLE` while chart and
cards stay exactly as they were → attempt the root move → `ROOT_MOVE_FORBIDDEN` → Reset
restores the initial state and clears every highlight → re-apply reproduces identical cards.

---

## Step 11 — Compare drawer

`CompareDrawer.tsx` — a right-side slide-over showing `originalDepartment` and `department`
as two read-only `OrgTree`s side by side, with a small legend. `originalDepartment` is the
department **response** cached at load/reset time (D5): it is a backend-computed snapshot
rendered as-is, never recomputed client-side. No history, no second reorganisation policy —
that stays out of scope per `PRD.md` §4.

**Checkpoint 11** — after the valid transfer, the drawer shows `LEAD_A` under `MGR_A` on the
left and under `MGR_C` on the right; the drawer never alters current state.

---

## Step 12 — Frontend tests

`src/components/orgTreeLayout.test.ts` — deterministic output for the same input; siblings
ordered left-to-right by `children_ids`; a parent's x is centred between its first and last
child; no two nodes share the same (x, y).

`src/App.test.tsx` (mocked `api/department`) — selecting a row updates `EmployeeDetails`;
a rejected transfer shows the error **and** keeps the previous impact cards mounted; an
invalid load unmounts tree, table, and impact together; reset clears all badges.

**Checkpoint 12** — `cd frontend && npm run test` green.

---

## Step 13 — Documentation and final verification

- `docs/TEST_EVIDENCE.md` — one row per `PRD.md` §19 item: scenario → command → observed
  result. Include real `pytest -v` output and screenshots of the four demo states (loaded,
  after valid transfer, cycle rejection, after reset).
- `docs/PLAN.md` — append D1–D8 under "Deviations"; do not edit the existing stages.
- `docs/DESIGN_NOTES.md` — the trade-offs behind D1–D8, plus why full recompute (AD-07)
  over incremental ancestor patching, and why `changed_rollup_ids` is a value diff rather
  than an ancestor walk.
- `docs/AI_PROMPTS.md` — prompts and accepted/rejected suggestions, kept current from step 1.
- `README.md` — replace the "Intended run commands" section with verified exact commands and
  drop the "does not exist yet" status note.
- `CLAUDE.md` — update the "Project state" and "Commands" sections now that the code exists.

**Checkpoint 13** — from a clean checkout, following only the README, both services start
and the full demo runs.

---

## Verification

```sh
cd backend  && source .venv/bin/activate && pytest -v
cd frontend && npm run test
cd backend  && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
```

End-to-end, in the browser, against the oracle: `HOD` shows 12 / 821,000 and every leaf
shows 1 · own salary. After `LEAD_A → MGR_C`: `MGR_A` 5→2 and 282,000→137,000, `MGR_C` 2→5
and 117,000→262,000, moved subtree `LEAD_A, E1, E2` = 3 / 145,000, and `HOD` reported
unchanged and **not** listed as affected. Then `MGR_A → E3` is rejected with
`MANAGEMENT_CYCLE` while the chart and impact cards stay exactly as they were; `HOD` is
rejected with `ROOT_MOVE_FORBIDDEN`; `solo-1` loads at headcount 1; `invalid-duplicate-id`
clears the whole workspace; reset restores the initial state; and reapplying the same
transfer reproduces an identical result.

### Acceptance-criteria coverage

| Problem-statement Required criterion | Covered by |
|---|---|
| Load deterministic 12-employee dept in one action | step 5 `main-12`, step 8 Load |
| Independently documented initial rollups reproduced | `tests/oracle.py` asserted in step 3 |
| Tree + table + details + rollups shown together | step 8 cockpit layout + steps 9–10 |
| Leaf HC 1; head HC 12 and payroll = salary sum | `test_rollups.py`, root invariants |
| Documented cross-branch transfer, subtree preserved, exact highlights | step 4 tests + step 10 |
| Explanation: old/new manager, moved HC/₹, before/after per change | `ImpactPanel` + `ChangeCard` |
| Head totals unchanged for the internal move | `root_unchanged`, asserted in step 4 |
| Cycle rejected `MANAGEMENT_CYCLE`, root rejected `ROOT_MOVE_FORBIDDEN`, chart untouched | step 4 atomicity tests + step 6 API tests + step 10 walkthrough |
| Valid one-employee department, HC 1 | `solo-1` scenario, `test_rollups.py`, UI picker |
| ≥2 structural load failures incl. duplicate ID and unknown-manager/cycle | `test_validation.py` + 4 invalid scenarios |
| Reset restores everything; re-apply reproduces the result | step 5 `reset()`, step 6 API test, step 10 |
| Focused tests for all 12 listed behaviours | steps 2–6 pytest, step 12 vitest |
| Optional comparison drawer | step 11 |
