# Frontend Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the frontend into a collapsible, tree-as-hero layout with a zoomable/pannable org chart, drag-and-drop transfers, and graphical + text-based add/delete employee — backed by two small, additive backend endpoints.

**Architecture:** Backend gets a new `domain/roster.py` pure module (add/delete validation, mirroring `transfer.py`'s validate/apply split) plus two `DepartmentService` methods and two routes — the existing load/transfer pipeline is untouched. Frontend replaces the fixed 3-column `App.tsx` layout with a collapsible sidebar + zoom/pan tree canvas (HTML cards over an SVG edge layer, positioned by the existing `layoutTree()` math) + collapsible right panel, wires `@dnd-kit/core` for drag-to-transfer (reusing the existing preview→confirm→apply flow), and adds roster forms.

**Tech Stack:** FastAPI + pure-Python domain engine (unchanged), React 19 + TypeScript + Vite, new dependency `@dnd-kit/core` + `@dnd-kit/utilities`.

**Spec:** `docs/superpowers/specs/2026-08-31-frontend-revamp-design.md`

## Global Constraints

- Existing load (6-pass) and transfer (5-check) validation order in `ARCHITECTURE.md` §8/§10 must not change — new code is additive only.
- Existing stable error codes (`INVALID_EMPLOYEE`, `DUPLICATE_EMPLOYEE_ID`, `INVALID_ROOT_COUNT`, `UNKNOWN_MANAGER`, `SELF_MANAGER`, `MANAGEMENT_CYCLE`, `UNKNOWN_TRANSFER_EMPLOYEE`, `ROOT_MOVE_FORBIDDEN`, `ALREADY_REPORTS_TO_MANAGER`) must not be renamed.
- New error codes are additive: `EMPLOYEE_NOT_FOUND`, `ROOT_DELETE_FORBIDDEN`, `EMPLOYEE_HAS_DIRECT_REPORTS`.
- Delete is blocked (never cascaded) when the target has any direct reports.
- Source order is sacred — new employees append to the end of the list; nothing gets re-sorted.
- Domain functions stay pure Python, no FastAPI/HTTP imports (`ARCHITECTURE.md` AD-05).
- No new color system — reuse `frontend/src/theme.css`'s existing dark palette.
- Only one new runtime dependency: `@dnd-kit/core` + `@dnd-kit/utilities`.
- 86 existing backend tests and the existing frontend suite must still pass after every task (extended, not broken).

---

## Task 1: Backend — roster domain module (add/delete validation)

**Files:**
- Modify: `backend/app/domain/errors.py`
- Create: `backend/app/domain/roster.py`
- Create: `backend/tests/test_roster.py`

**Interfaces:**
- Consumes: `Employee`, `DepartmentTree` from `app/domain/models.py`; `DomainError` from `app/domain/errors.py`; `build_tree` from `app/domain/tree.py` (all existing, unchanged).
- Produces: `apply_add(employees, new_employee) -> list[Employee]`, `apply_delete(employees, employee_id) -> list[Employee]`, `validate_delete(tree, employee_id) -> DomainError | None` — consumed by Task 2's `DepartmentService`.

- [ ] **Step 1: Add the three new error codes**

In `backend/app/domain/errors.py`, add below the existing `ALREADY_REPORTS_TO_MANAGER` line:

```python
EMPLOYEE_NOT_FOUND = "EMPLOYEE_NOT_FOUND"
ROOT_DELETE_FORBIDDEN = "ROOT_DELETE_FORBIDDEN"
EMPLOYEE_HAS_DIRECT_REPORTS = "EMPLOYEE_HAS_DIRECT_REPORTS"
```

- [ ] **Step 2: Write the failing tests for `validate_delete` and the pure apply functions**

Create `backend/tests/test_roster.py`:

```python
from __future__ import annotations

import pytest

from app.data.scenarios import SCENARIOS
from app.domain.errors import (
    EMPLOYEE_HAS_DIRECT_REPORTS,
    EMPLOYEE_NOT_FOUND,
    ROOT_DELETE_FORBIDDEN,
)
from app.domain.models import Employee
from app.domain.roster import apply_add, apply_delete, validate_delete
from app.domain.tree import build_tree


def main_department() -> list[Employee]:
    return SCENARIOS["main-12"].employees()


def solo_department() -> list[Employee]:
    return SCENARIOS["solo-1"].employees()


def test_validate_delete_rejects_unknown_employee_id() -> None:
    tree = build_tree(main_department())

    error = validate_delete(tree, "MISSING")

    assert error is not None
    assert error.code == EMPLOYEE_NOT_FOUND


def test_validate_delete_rejects_root_before_checking_direct_reports() -> None:
    tree = build_tree(main_department())

    error = validate_delete(tree, "HOD")

    assert error is not None
    assert error.code == ROOT_DELETE_FORBIDDEN


def test_validate_delete_rejects_solo_root_even_without_children() -> None:
    tree = build_tree(solo_department())

    error = validate_delete(tree, "HOD")

    assert error is not None
    assert error.code == ROOT_DELETE_FORBIDDEN


def test_validate_delete_rejects_employee_with_direct_reports() -> None:
    tree = build_tree(main_department())

    error = validate_delete(tree, "MGR_A")

    assert error is not None
    assert error.code == EMPLOYEE_HAS_DIRECT_REPORTS


def test_validate_delete_allows_a_leaf_employee() -> None:
    tree = build_tree(main_department())

    error = validate_delete(tree, "E1")

    assert error is None


def test_apply_add_appends_the_new_employee_in_source_order() -> None:
    employees = main_department()
    new_employee = Employee(
        employee_id="E7", name="New Hire", role="IC", monthly_salary=40_000, manager_id="LEAD_A"
    )

    candidate = apply_add(employees, new_employee)

    assert candidate[:-1] == employees
    assert candidate[-1] == new_employee


def test_apply_delete_removes_only_the_target_and_preserves_order() -> None:
    employees = main_department()

    candidate = apply_delete(employees, "E1")

    assert [employee.employee_id for employee in candidate] == [
        employee.employee_id for employee in employees if employee.employee_id != "E1"
    ]


@pytest.mark.parametrize("employee_id", ["MISSING"])
def test_apply_delete_is_a_no_op_for_an_unknown_id(employee_id: str) -> None:
    employees = main_department()

    candidate = apply_delete(employees, employee_id)

    assert candidate == employees
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && pytest tests/test_roster.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.domain.roster'`

- [ ] **Step 4: Implement `backend/app/domain/roster.py`**

```python
from __future__ import annotations

import dataclasses
from collections.abc import Sequence

from app.domain.errors import (
    EMPLOYEE_HAS_DIRECT_REPORTS,
    EMPLOYEE_NOT_FOUND,
    ROOT_DELETE_FORBIDDEN,
    DomainError,
)
from app.domain.models import DepartmentTree, Employee


def validate_delete(tree: DepartmentTree, employee_id: str) -> DomainError | None:
    """Return the first delete rule violation: existence, then root, then reports."""
    if employee_id not in tree.employee_by_id:
        return DomainError(
            EMPLOYEE_NOT_FOUND, f"Unknown employee id: '{employee_id}'"
        )
    if employee_id == tree.root_id:
        return DomainError(
            ROOT_DELETE_FORBIDDEN, f"Root employee '{employee_id}' cannot be deleted"
        )
    if tree.children_by_id[employee_id]:
        return DomainError(
            EMPLOYEE_HAS_DIRECT_REPORTS,
            f"Employee '{employee_id}' has direct reports and cannot be deleted; "
            "transfer their reports first",
        )
    return None


def apply_add(employees: Sequence[Employee], new_employee: Employee) -> list[Employee]:
    """Return a source-order-preserving candidate with the new employee appended."""
    return [*employees, new_employee]


def apply_delete(employees: Sequence[Employee], employee_id: str) -> list[Employee]:
    """Return a source-order-preserving candidate with the target employee removed."""
    return [employee for employee in employees if employee.employee_id != employee_id]
```

Note: `dataclasses` is imported but unused if you only use the two functions above — remove the `import dataclasses` line since neither function needs it.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && pytest tests/test_roster.py -v`
Expected: PASS (7 tests)

- [ ] **Step 6: Run the full backend suite to confirm nothing else broke**

Run: `cd backend && pytest`
Expected: PASS (93 tests: 86 existing + 7 new)

- [ ] **Step 7: Commit**

```bash
git add backend/app/domain/errors.py backend/app/domain/roster.py backend/tests/test_roster.py
git commit -m "feat(backend): add roster domain module for employee add/delete"
```

---

## Task 2: Backend — `DepartmentService.add_employee` / `delete_employee`

**Files:**
- Modify: `backend/app/services/department_service.py`
- Modify: `backend/tests/test_department_service.py`

**Interfaces:**
- Consumes: `apply_add`, `apply_delete`, `validate_delete` from Task 1's `app/domain/roster.py`; `validate_department` from `app/domain/validation.py` (existing, unchanged).
- Produces: `DepartmentService.add_employee(employee_id, name, role, monthly_salary, manager_id) -> DepartmentState | DomainError` and `DepartmentService.delete_employee(employee_id) -> DepartmentState | DomainError` — consumed by Task 3's API routes.

- [ ] **Step 1: Write the failing service tests**

Append to `backend/tests/test_department_service.py` (after the existing `test_unknown_scenario_clears_existing_state` function, same file):

```python
from app.domain.errors import (
    EMPLOYEE_HAS_DIRECT_REPORTS,
    ROOT_DELETE_FORBIDDEN,
)


def test_add_employee_appends_and_recomputes_rollups() -> None:
    service = DepartmentService()
    service.load("main-12")

    result = service.add_employee("E7", "New Hire", "IC", 40_000, "LEAD_A")

    assert isinstance(result, DepartmentState)
    assert [employee.employee_id for employee in result.employees][-1] == "E7"
    assert result.rollups["LEAD_A"].team_headcount == 4
    assert result.rollups["HOD"].team_headcount == 13
    assert result.rollups["HOD"].team_payroll == 821_000 + 40_000
    assert result.last_successful_transfer is None


def test_add_employee_rejects_unknown_manager() -> None:
    service = DepartmentService()
    service.load("main-12")

    error = service.add_employee("E7", "New Hire", "IC", 40_000, "MISSING")

    assert getattr(error, "code", None) == "UNKNOWN_MANAGER"
    assert service.get_state().rollups["HOD"].team_headcount == 12


def test_add_employee_rejects_duplicate_id() -> None:
    service = DepartmentService()
    service.load("main-12")

    error = service.add_employee("E1", "Duplicate", "IC", 40_000, "LEAD_A")

    assert getattr(error, "code", None) == "DUPLICATE_EMPLOYEE_ID"


def test_delete_employee_removes_a_leaf_and_recomputes_rollups() -> None:
    service = DepartmentService()
    service.load("main-12")

    result = service.delete_employee("E1")

    assert isinstance(result, DepartmentState)
    assert "E1" not in [employee.employee_id for employee in result.employees]
    assert result.rollups["HOD"].team_headcount == 11
    assert result.last_successful_transfer is None


def test_delete_employee_blocked_when_target_has_direct_reports() -> None:
    service = DepartmentService()
    service.load("main-12")

    error = service.delete_employee("MGR_A")

    assert getattr(error, "code", None) == EMPLOYEE_HAS_DIRECT_REPORTS
    assert service.get_state().rollups["HOD"].team_headcount == 12


def test_delete_employee_blocked_for_root() -> None:
    service = DepartmentService()
    service.load("main-12")

    error = service.delete_employee("HOD")

    assert getattr(error, "code", None) == ROOT_DELETE_FORBIDDEN


def test_add_then_delete_clears_stale_transfer_impact() -> None:
    service = DepartmentService()
    service.load("main-12")
    service.transfer("LEAD_A", "MGR_C")

    result = service.add_employee("E7", "New Hire", "IC", 40_000, "LEAD_A")

    assert isinstance(result, DepartmentState)
    assert result.last_successful_transfer is None
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && pytest tests/test_department_service.py -v -k "add_employee or delete_employee"`
Expected: FAIL — `AttributeError: 'DepartmentService' object has no attribute 'add_employee'`

- [ ] **Step 3: Implement the two service methods**

In `backend/app/services/department_service.py`, add the import and the two methods.

Change the import block at the top from:

```python
from app.domain.transfer import (
    RollupChange,
    TransferImpact,
    apply_transfer,
    diff_rollups,
    validate_transfer,
)
```

to also import roster (insert a new import line right after it):

```python
from app.domain.transfer import (
    RollupChange,
    TransferImpact,
    apply_transfer,
    diff_rollups,
    validate_transfer,
)
from app.domain.roster import apply_add, apply_delete, validate_delete
from app.domain.models import Employee as DomainEmployee
```

(`Employee` is already imported from `app.domain.models` on line 7 of the existing file — reuse that name instead of aliasing. Adjust: the existing line 7 is `from app.domain.models import DepartmentTree, Employee, Rollup`, so just add `from app.domain.roster import apply_add, apply_delete, validate_delete` as a new import line and use the existing `Employee` name directly — drop the `DomainEmployee` alias above.)

Add these two methods to the `DepartmentService` class, right after `reset`:

```python
    def add_employee(
        self,
        employee_id: str,
        name: str,
        role: str,
        monthly_salary: int,
        manager_id: str,
    ) -> DepartmentState | DomainError:
        if self._current_employees is None:
            return DomainError("NO_SCENARIO_LOADED", "No scenario is loaded")

        new_employee = Employee(
            employee_id=employee_id,
            name=name,
            role=role,
            monthly_salary=monthly_salary,
            manager_id=manager_id,
        )
        candidate = apply_add(self._current_employees, new_employee)
        error = validate_department(candidate)
        if error is not None:
            return error

        self._current_employees = candidate
        self._last_successful_transfer = None
        state = self.get_state()
        assert state is not None
        return state

    def delete_employee(self, employee_id: str) -> DepartmentState | DomainError:
        if self._current_employees is None:
            return DomainError("NO_SCENARIO_LOADED", "No scenario is loaded")

        tree = build_tree(self._current_employees)
        error = validate_delete(tree, employee_id)
        if error is not None:
            return error

        candidate = apply_delete(self._current_employees, employee_id)
        candidate_error = validate_department(candidate)
        if candidate_error is not None:
            return candidate_error

        self._current_employees = candidate
        self._last_successful_transfer = None
        state = self.get_state()
        assert state is not None
        return state
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && pytest tests/test_department_service.py -v`
Expected: PASS (all existing + 7 new tests)

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && pytest`
Expected: PASS (100 tests: 93 from Task 1 + 7 new)

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/department_service.py backend/tests/test_department_service.py
git commit -m "feat(backend): add DepartmentService.add_employee and delete_employee"
```

---

## Task 3: Backend — API routes + request model + CORS

**Files:**
- Modify: `backend/app/models/department.py`
- Modify: `backend/app/api/department.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_api.py`

**Interfaces:**
- Consumes: `DepartmentService.add_employee`/`delete_employee` from Task 2.
- Produces: `POST /api/department/employees` and `DELETE /api/department/employees/{employee_id}` HTTP routes — consumed by Task 4's frontend API client.

- [ ] **Step 1: Add the `AddEmployeeRequest` model**

In `backend/app/models/department.py`, add after the existing `TransferRequest` class:

```python
class AddEmployeeRequest(BaseModel):
    employee_id: str
    name: str
    role: str
    monthly_salary: int
    manager_id: str
```

- [ ] **Step 2: Write the failing route tests**

Append to `backend/tests/test_api.py` (place near the end of the file, after the existing transfer/reset tests):

```python
def test_add_employee_appends_and_returns_updated_department(client: TestClient) -> None:
    load_main(client)

    response = client.post(
        "/api/department/employees",
        json={
            "employee_id": "E7",
            "name": "New Hire",
            "role": "IC",
            "monthly_salary": 40_000,
            "manager_id": "LEAD_A",
        },
    )

    assert response.status_code == 200
    department = response.json()
    assert department["employees"][-1]["employee_id"] == "E7"
    assert department["totals"]["employee_count"] == 13
    assert department["totals"]["total_payroll"] == 821_000 + 40_000


def test_add_employee_rejects_unknown_manager(client: TestClient) -> None:
    load_main(client)

    response = client.post(
        "/api/department/employees",
        json={
            "employee_id": "E7",
            "name": "New Hire",
            "role": "IC",
            "monthly_salary": 40_000,
            "manager_id": "MISSING",
        },
    )

    assert_error(response, 400, "UNKNOWN_MANAGER")


def test_add_employee_before_load_returns_no_department_error(client: TestClient) -> None:
    response = client.post(
        "/api/department/employees",
        json={
            "employee_id": "E7",
            "name": "New Hire",
            "role": "IC",
            "monthly_salary": 40_000,
            "manager_id": "LEAD_A",
        },
    )

    assert_error(response, 409, "NO_DEPARTMENT_LOADED")


def test_delete_employee_removes_leaf_and_returns_updated_department(client: TestClient) -> None:
    load_main(client)

    response = client.delete("/api/department/employees/E1")

    assert response.status_code == 200
    department = response.json()
    assert "E1" not in [employee["employee_id"] for employee in department["employees"]]
    assert department["totals"]["employee_count"] == 11


def test_delete_employee_blocked_when_target_has_direct_reports(client: TestClient) -> None:
    load_main(client)

    response = client.delete("/api/department/employees/MGR_A")

    assert_error(response, 400, "EMPLOYEE_HAS_DIRECT_REPORTS")


def test_delete_employee_blocked_for_root(client: TestClient) -> None:
    load_main(client)

    response = client.delete("/api/department/employees/HOD")

    assert_error(response, 400, "ROOT_DELETE_FORBIDDEN")


def test_delete_employee_before_load_returns_no_department_error(client: TestClient) -> None:
    response = client.delete("/api/department/employees/E1")

    assert_error(response, 409, "NO_DEPARTMENT_LOADED")
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd backend && pytest tests/test_api.py -v -k "add_employee or delete_employee"`
Expected: FAIL with 404s (routes don't exist yet)

- [ ] **Step 4: Add the two routes**

In `backend/app/api/department.py`, add `AddEmployeeRequest` to the existing import from `app.models.department` (it currently imports `DepartmentTotalsView, DepartmentView, EmployeeView, LoadRequest, RollupChangeView, RollupView, ScenarioView, TransferImpactView, TransferRequest` — add `AddEmployeeRequest` alphabetically into that list).

Add these two routes at the end of the file, after `reset_department`:

```python
@router.post("/department/employees", response_model=DepartmentView)
def add_employee(request: AddEmployeeRequest) -> DepartmentView | JSONResponse:
    state = department_service.get_state()
    if state is None:
        return _no_department_response()

    result = department_service.add_employee(
        request.employee_id,
        request.name,
        request.role,
        request.monthly_salary,
        request.manager_id,
    )
    if isinstance(result, DomainError):
        return _error_response(result)
    return _department_view(result)


@router.delete("/department/employees/{employee_id}", response_model=DepartmentView)
def delete_employee(employee_id: str) -> DepartmentView | JSONResponse:
    state = department_service.get_state()
    if state is None:
        return _no_department_response()

    result = department_service.delete_employee(employee_id)
    if isinstance(result, DomainError):
        return _error_response(result)
    return _department_view(result)
```

- [ ] **Step 5: Allow the DELETE method in CORS**

In `backend/app/main.py`, change:

```python
    allow_methods=["GET", "POST"],
```

to:

```python
    allow_methods=["GET", "POST", "DELETE"],
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend && pytest tests/test_api.py -v`
Expected: PASS (all existing + 7 new)

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && pytest`
Expected: PASS (107 tests)

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/department.py backend/app/api/department.py backend/app/main.py backend/tests/test_api.py
git commit -m "feat(backend): expose add/delete employee API routes"
```

Backend is now feature-complete and independently verified — the rest of this plan is frontend-only.

---

## Task 4: Frontend — dnd-kit dependency, types, and API client functions

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/types/department.ts`
- Modify: `frontend/src/api/department.ts`
- Modify: `frontend/src/api/department.test.ts`

**Interfaces:**
- Produces: `AddEmployeeRequest` type, `addEmployee(request) -> Promise<DepartmentView>`, `deleteEmployee(employeeId) -> Promise<DepartmentView>` — consumed by Task 9 (`RosterControls`) and Task 11 (`App.tsx`). `@dnd-kit/core`/`@dnd-kit/utilities` — consumed by Task 7 (`OrgTreeCanvas`).

- [ ] **Step 1: Install the new dependency**

Run: `cd frontend && npm install @dnd-kit/core @dnd-kit/utilities`
Expected: `package.json`/`package-lock.json` gain `@dnd-kit/core` and `@dnd-kit/utilities` under `dependencies`.

- [ ] **Step 2: Add the `AddEmployeeRequest` type**

In `frontend/src/types/department.ts`, add after the existing `TransferResponse`/`PreviewTransferResponse` interfaces:

```typescript
export interface AddEmployeeRequest {
  employee_id: string
  name: string
  role: string
  monthly_salary: number
  manager_id: string
}
```

- [ ] **Step 3: Write the failing API client tests**

Append to `frontend/src/api/department.test.ts`, inside the existing `describe('department API route contracts', ...)` block — extend the first `it` and the `it.each` list. Replace the whole block (from `describe('department API route contracts', () => {` to its closing `})`) with:

```typescript
describe('department API route contracts', () => {
  it('maps each remaining client function to its backend route and request body', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ))
    vi.stubGlobal('fetch', fetchMock)

    await listScenarios()
    await getDepartment()
    await transfer('LEAD_A', 'MGR_C')
    await previewTransfer('LEAD_A', 'MGR_C')
    await resetDepartment()
    await addEmployee({
      employee_id: 'E7',
      name: 'New Hire',
      role: 'IC',
      monthly_salary: 40_000,
      manager_id: 'LEAD_A',
    })
    await deleteEmployee('E7')

    expect(fetchMock.mock.calls).toEqual([
      ['/api/scenarios', undefined],
      ['/api/department', undefined],
      ['/api/department/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: 'LEAD_A', new_manager_id: 'MGR_C' }),
      }],
      ['/api/department/transfer/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: 'LEAD_A', new_manager_id: 'MGR_C' }),
      }],
      ['/api/department/reset', { method: 'POST' }],
      ['/api/department/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: 'E7',
          name: 'New Hire',
          role: 'IC',
          monthly_salary: 40_000,
          manager_id: 'LEAD_A',
        }),
      }],
      ['/api/department/employees/E7', { method: 'DELETE' }],
    ])
  })

  it.each([
    ['listScenarios', () => listScenarios()],
    ['getDepartment', () => getDepartment()],
    ['transfer', () => transfer('LEAD_A', 'MGR_C')],
    ['previewTransfer', () => previewTransfer('LEAD_A', 'MGR_C')],
    ['resetDepartment', () => resetDepartment()],
    ['addEmployee', () => addEmployee({
      employee_id: 'E7',
      name: 'New Hire',
      role: 'IC',
      monthly_salary: 40_000,
      manager_id: 'LEAD_A',
    })],
    ['deleteEmployee', () => deleteEmployee('E7')],
  ])('keeps the ApiError type for %s non-success responses', async (_name, request) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(
        new Response(
          JSON.stringify({ error: { code: 'REJECTED', message: 'The operation was rejected' } }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      )),
    )

    let failure: unknown
    try {
      await request()
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({
      code: 'REJECTED',
      message: 'The operation was rejected',
    })
  })
})
```

Also update the top import to add `addEmployee` and `deleteEmployee`:

```typescript
import {
  ApiError,
  addEmployee,
  deleteEmployee,
  getDepartment,
  listScenarios,
  loadDepartment,
  previewTransfer,
  resetDepartment,
  transfer,
} from './department'
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd frontend && npm run test -- --run src/api/department.test.ts`
Expected: FAIL — `addEmployee`/`deleteEmployee` are not exported from `./department`

- [ ] **Step 5: Implement the two client functions**

In `frontend/src/api/department.ts`, add `AddEmployeeRequest` to the existing type-only import from `../types/department`:

```typescript
import {
  ApiError,
  type AddEmployeeRequest,
  type DepartmentView,
  type PreviewTransferResponse,
  type ScenarioView,
  type TransferResponse,
} from '../types/department'
```

Add these two functions after `resetDepartment`:

```typescript
export function addEmployee(request: AddEmployeeRequest): Promise<DepartmentView> {
  return request<DepartmentView>('/api/department/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })
}

export function deleteEmployee(employeeId: string): Promise<DepartmentView> {
  return request<DepartmentView>(`/api/department/employees/${employeeId}`, { method: 'DELETE' })
}
```

Note: the generic `request<T>` helper defined earlier in the same file shares its name with the `request: AddEmployeeRequest` parameter above — rename the parameter to `body` to avoid shadowing:

```typescript
export function addEmployee(body: AddEmployeeRequest): Promise<DepartmentView> {
  return request<DepartmentView>('/api/department/employees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd frontend && npm run test -- --run src/api/department.test.ts`
Expected: PASS

- [ ] **Step 7: Run the full frontend suite, build, and lint**

Run: `cd frontend && npm run test -- --run && npm run build && npm run lint`
Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/types/department.ts frontend/src/api/department.ts frontend/src/api/department.test.ts
git commit -m "feat(frontend): add dnd-kit dependency and add/delete employee API client"
```

---

## Task 5: Frontend — collapsible-subtree support in `orgTreeLayout`

**Files:**
- Modify: `frontend/src/components/orgTreeLayout.ts`
- Modify: `frontend/src/components/orgTreeLayout.test.ts`

**Interfaces:**
- Consumes: existing `DepartmentView` type.
- Produces: `layoutTree(department, collapsedIds?: ReadonlySet<string>) -> TreeLayout` (second parameter optional, defaults to empty set — existing callers `OrgTree.tsx` and `CompareDrawer.tsx` keep compiling unchanged) — consumed by Task 7 (`OrgTreeCanvas`).

- [ ] **Step 1: Write the failing collapse test**

Append to `frontend/src/components/orgTreeLayout.test.ts`, inside the `describe('layoutTree', ...)` block, as a new `it`:

```typescript
  it('excludes a collapsed node\'s descendants and recompacts siblings', () => {
    const collapsed = layoutTree(department, new Set(['MGR_A']))
    const ids = collapsed.nodes.map((node) => node.id)

    expect(ids).toContain('MGR_A')
    expect(ids).not.toContain('LEAD_A')
    expect(ids).not.toContain('E1')
    expect(ids).not.toContain('E2')
    expect(collapsed.edges.some((edge) => edge.parentId === 'MGR_A')).toBe(false)

    const byId = new Map(collapsed.nodes.map((node) => [node.id, node]))
    const xOf = (id: string): number => {
      const node = byId.get(id)
      if (node === undefined) throw new Error(`Expected ${id} to be positioned`)
      return node.x
    }
    expect(['MGR_C', 'MGR_A', 'MGR_B'].map(xOf)).toEqual([0, 216, 432])
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm run test -- --run src/components/orgTreeLayout.test.ts`
Expected: FAIL — TypeScript error, `layoutTree` doesn't accept a second argument

- [ ] **Step 3: Implement the `collapsedIds` parameter**

In `frontend/src/components/orgTreeLayout.ts`, change the function signature and the child-id lookup inside `placeNode`:

```typescript
export function layoutTree(
  department: DepartmentView,
  collapsedIds: ReadonlySet<string> = new Set(),
): TreeLayout {
  const employeesById = new Map(department.employees.map((employee) => [employee.employee_id, employee]))
  const positions = new Map<string, TreeNodePosition>()
  const orderedIds: string[] = []
  const edges: TreeEdge[] = []
  let slot = 0
  let maxDepth = 0

  const placeNode = (id: string, depth: number): TreeNodePosition | null => {
    const employee = employeesById.get(id)
    if (!employee) return null

    const childIds = collapsedIds.has(id) ? [] : employee.children_ids
    const childPositions = childIds
      .map((childId) => placeNode(childId, depth + 1))
      .filter((position): position is TreeNodePosition => position !== null)
    const x = childPositions.length === 0
      ? slot++ * (NODE_W + H_GAP)
      : (childPositions[0].x + childPositions[childPositions.length - 1].x) / 2
    const position = { id, x, y: depth * (NODE_H + V_GAP) }

    positions.set(id, position)
    orderedIds.push(id)
    maxDepth = Math.max(maxDepth, depth)
    return position
  }

  placeNode(department.root_id, 0)
  // ... rest of the function (nodes/edges/return block) is unchanged
```

(Only the `placeNode` body's `employee.children_ids` reference changes to `childIds` — everything below `placeNode`'s closing brace, i.e. the `nodes` computation, the edges loop, and the `return` statement, stays exactly as it already is. The edges loop already skips any child not found in `positions`, so collapsed descendants are automatically excluded from edges too — no change needed there.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm run test -- --run src/components/orgTreeLayout.test.ts`
Expected: PASS (all existing + 1 new)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/orgTreeLayout.ts frontend/src/components/orgTreeLayout.test.ts
git commit -m "feat(frontend): support collapsed subtrees in layoutTree"
```

---

## Task 6: Frontend — `CollapsiblePanel` generic component

**Files:**
- Create: `frontend/src/components/CollapsiblePanel.tsx`
- Create: `frontend/src/components/CollapsiblePanel.test.tsx`

**Interfaces:**
- Produces: `CollapsiblePanel` component with props `{ title: string; eyebrow?: string; collapsed: boolean; onToggleCollapsed: () => void; side: 'left' | 'right'; children: ReactNode }` — consumed by Task 11 (`App.tsx`) for the sidebar and right panel.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/CollapsiblePanel.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CollapsiblePanel } from './CollapsiblePanel'

describe('CollapsiblePanel', () => {
  it('renders its title and children when expanded', () => {
    render(
      <CollapsiblePanel title="Employees" eyebrow="ROSTER" collapsed={false} onToggleCollapsed={vi.fn()} side="left">
        <p>panel body</p>
      </CollapsiblePanel>,
    )

    expect(screen.getByText('Employees')).toBeInTheDocument()
    expect(screen.getByText('panel body')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /collapse employees/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('hides its body and title when collapsed, keeping only the toggle', () => {
    render(
      <CollapsiblePanel title="Employees" collapsed onToggleCollapsed={vi.fn()} side="left">
        <p>panel body</p>
      </CollapsiblePanel>,
    )

    expect(screen.queryByText('panel body')).not.toBeInTheDocument()
    expect(screen.queryByText('Employees')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand employees/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('calls onToggleCollapsed when the toggle button is clicked', () => {
    const onToggleCollapsed = vi.fn()
    render(
      <CollapsiblePanel title="Employees" collapsed={false} onToggleCollapsed={onToggleCollapsed} side="left">
        <p>panel body</p>
      </CollapsiblePanel>,
    )

    screen.getByRole('button', { name: /collapse employees/i }).click()

    expect(onToggleCollapsed).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm run test -- --run src/components/CollapsiblePanel.test.tsx`
Expected: FAIL — `Failed to resolve import "./CollapsiblePanel"`

- [ ] **Step 3: Implement `CollapsiblePanel.tsx`**

```typescript
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

interface CollapsiblePanelProps {
  title: string
  eyebrow?: string
  collapsed: boolean
  onToggleCollapsed: () => void
  side: 'left' | 'right'
  children: ReactNode
}

export function CollapsiblePanel({ title, eyebrow, collapsed, onToggleCollapsed, side, children }: CollapsiblePanelProps) {
  const expandIcon = side === 'left' ? <ChevronRight aria-hidden="true" size={16} strokeWidth={2} /> : <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
  const collapseIcon = side === 'left' ? <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} /> : <ChevronRight aria-hidden="true" size={16} strokeWidth={2} />

  if (collapsed) {
    return (
      <section className="collapsible-panel collapsible-panel--collapsed" aria-label={title}>
        <button
          type="button"
          className="collapsible-panel__toggle"
          onClick={onToggleCollapsed}
          aria-expanded={false}
        >
          {expandIcon}
          <span className="visually-hidden">{`Expand ${title}`}</span>
        </button>
      </section>
    )
  }

  return (
    <section className="collapsible-panel" aria-label={title}>
      <div className="collapsible-panel__header">
        <div className="collapsible-panel__title-group">
          {eyebrow ? <span className="collapsible-panel__eyebrow">{eyebrow}</span> : null}
          <span className="collapsible-panel__title">{title}</span>
        </div>
        <button
          type="button"
          className="collapsible-panel__toggle"
          onClick={onToggleCollapsed}
          aria-expanded={true}
        >
          {collapseIcon}
          <span className="visually-hidden">{`Collapse ${title}`}</span>
        </button>
      </div>
      <div className="collapsible-panel__body">{children}</div>
    </section>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm run test -- --run src/components/CollapsiblePanel.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CollapsiblePanel.tsx frontend/src/components/CollapsiblePanel.test.tsx
git commit -m "feat(frontend): add generic CollapsiblePanel component"
```

---

## Task 7: Frontend — `OrgTreeCanvas` (zoom/pan/collapse/drag-and-drop)

**Files:**
- Create: `frontend/src/components/OrgTreeCanvas.tsx`
- Create: `frontend/src/components/OrgTreeCanvas.test.tsx`

**Interfaces:**
- Consumes: `layoutTree` from Task 5's `orgTreeLayout.ts`; `DepartmentView`, `TransferImpactView` types.
- Produces: `OrgTreeCanvas` component with props `{ department: DepartmentView; selectedId: string | null; previewImpact: TransferImpactView | null; collapsedIds: ReadonlySet<string>; onSelect: (employeeId: string) => void; onToggleCollapse: (employeeId: string) => void; onProposeTransfer: (employeeId: string, newManagerId: string) => void }`; exported pure helper `resolveDrop(activeId: string | number, overId: string | number | null | undefined): { employeeId: string; managerId: string } | null` — both consumed by Task 11 (`App.tsx`); `resolveDrop` is unit-tested directly here.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/OrgTreeCanvas.test.tsx`:

```typescript
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OrgTreeCanvas, resolveDrop } from './OrgTreeCanvas'
import type { DepartmentView } from '../types/department'

const department: DepartmentView = {
  scenario: 'canvas-fixture',
  root_id: 'HOD',
  employees: [
    { employee_id: 'HOD', name: 'Head', role: 'HOD', monthly_salary: 1, manager_id: null, children_ids: ['MGR_A'], direct_report_count: 1, team_headcount: 3, team_payroll: 3 },
    { employee_id: 'MGR_A', name: 'Manager Ann', role: 'Manager', monthly_salary: 1, manager_id: 'HOD', children_ids: ['E1'], direct_report_count: 1, team_headcount: 2, team_payroll: 2 },
    { employee_id: 'E1', name: 'Employee One', role: 'IC', monthly_salary: 1, manager_id: 'MGR_A', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
  ],
  totals: { employee_count: 3, total_payroll: 3 },
  last_successful_transfer: null,
}

describe('resolveDrop', () => {
  it('returns null when there is no drop target', () => {
    expect(resolveDrop('E1', null)).toBeNull()
    expect(resolveDrop('E1', undefined)).toBeNull()
  })

  it('returns null when dropped on itself', () => {
    expect(resolveDrop('E1', 'E1')).toBeNull()
  })

  it('returns the employee and manager id when dropped on a different node', () => {
    expect(resolveDrop('E1', 'HOD')).toEqual({ employeeId: 'E1', managerId: 'HOD' })
  })
})

describe('OrgTreeCanvas', () => {
  it('renders every visible node card with id and name', () => {
    render(
      <OrgTreeCanvas
        department={department}
        selectedId={null}
        previewImpact={null}
        collapsedIds={new Set()}
        onSelect={vi.fn()}
        onToggleCollapse={vi.fn()}
        onProposeTransfer={vi.fn()}
      />,
    )

    expect(screen.getByText('HOD')).toBeInTheDocument()
    expect(screen.getByText('Manager Ann')).toBeInTheDocument()
    expect(screen.getByText('Employee One')).toBeInTheDocument()
  })

  it('omits collapsed descendants from the rendered cards', () => {
    render(
      <OrgTreeCanvas
        department={department}
        selectedId={null}
        previewImpact={null}
        collapsedIds={new Set(['MGR_A'])}
        onSelect={vi.fn()}
        onToggleCollapse={vi.fn()}
        onProposeTransfer={vi.fn()}
      />,
    )

    expect(screen.getByText('Manager Ann')).toBeInTheDocument()
    expect(screen.queryByText('Employee One')).not.toBeInTheDocument()
  })

  it('calls onToggleCollapse with the node id when its collapse toggle is clicked', () => {
    const onToggleCollapse = vi.fn()
    render(
      <OrgTreeCanvas
        department={department}
        selectedId={null}
        previewImpact={null}
        collapsedIds={new Set()}
        onSelect={vi.fn()}
        onToggleCollapse={onToggleCollapse}
        onProposeTransfer={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /collapse manager ann/i }))

    expect(onToggleCollapse).toHaveBeenCalledWith('MGR_A')
  })

  it('calls onSelect with the node id when a card is clicked', () => {
    const onSelect = vi.fn()
    render(
      <OrgTreeCanvas
        department={department}
        selectedId={null}
        previewImpact={null}
        collapsedIds={new Set()}
        onSelect={onSelect}
        onToggleCollapse={vi.fn()}
        onProposeTransfer={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Manager Ann'))

    expect(onSelect).toHaveBeenCalledWith('MGR_A')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm run test -- --run src/components/OrgTreeCanvas.test.tsx`
Expected: FAIL — `Failed to resolve import "./OrgTreeCanvas"`

- [ ] **Step 3: Implement `OrgTreeCanvas.tsx`**

```typescript
import { ChevronDown, ChevronUp, Maximize2, Minus, Plus } from 'lucide-react'
import { type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent, useRef, useState } from 'react'
import { DndContext, type DragEndEvent, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

import { formatCurrency } from '../format'
import type { DepartmentView, TransferImpactView } from '../types/department'
import { layoutTree } from './orgTreeLayout'

interface OrgTreeCanvasProps {
  department: DepartmentView
  selectedId: string | null
  previewImpact: TransferImpactView | null
  collapsedIds: ReadonlySet<string>
  onSelect: (employeeId: string) => void
  onToggleCollapse: (employeeId: string) => void
  onProposeTransfer: (employeeId: string, newManagerId: string) => void
  ariaLabel?: string
}

const MIN_SCALE = 0.4
const MAX_SCALE = 2

export function resolveDrop(
  activeId: string | number,
  overId: string | number | null | undefined,
): { employeeId: string; managerId: string } | null {
  if (overId === null || overId === undefined) return null
  const employeeId = String(activeId)
  const managerId = String(overId)
  if (employeeId === managerId) return null
  return { employeeId, managerId }
}

// aria-label wording below intentionally mirrors the old SVG OrgTree.tsx
// (`${id}, ${name}, ${headcount} headcount, ${payroll} payroll${manager}${status}`)
// so App.test.tsx's existing role="treeitem"/role="tree" assertions keep working
// unchanged against this HTML-card canvas.
function OrgNodeCard({
  employeeId,
  name,
  role,
  managerId,
  headcount,
  payroll,
  x,
  y,
  isRoot,
  isSelected,
  isMoved,
  isChanged,
  hasChildren,
  isCollapsed,
  onSelect,
  onToggleCollapse,
}: {
  employeeId: string
  name: string
  role: string
  managerId: string | null
  headcount: number
  payroll: number
  x: number
  y: number
  isRoot: boolean
  isSelected: boolean
  isMoved: boolean
  isChanged: boolean
  hasChildren: boolean
  isCollapsed: boolean
  onSelect: (employeeId: string) => void
  onToggleCollapse: (employeeId: string) => void
}) {
  const draggable = useDraggable({ id: employeeId, disabled: isRoot })
  const droppable = useDroppable({ id: employeeId })
  const dragStyle = draggable.transform
    ? { transform: CSS.Translate.toString(draggable.transform) }
    : undefined

  const setRefs = (node: HTMLDivElement | null) => {
    draggable.setNodeRef(node)
    droppable.setNodeRef(node)
  }

  const className = [
    'org-node-card',
    isSelected ? 'org-node-card--selected' : '',
    droppable.isOver ? 'org-node-card--over' : '',
    draggable.isDragging ? 'org-node-card--dragging' : '',
  ].filter(Boolean).join(' ')

  const markers = [
    isRoot ? 'root' : null,
    isSelected ? 'selected' : null,
    isMoved ? 'moved' : null,
    isChanged ? 'changed' : null,
  ].filter((marker): marker is string => marker !== null)
  const statusDescription = markers.length > 0 ? `, ${markers.join(', ')}` : ''
  const managerDescription = managerId === null ? ', root employee' : `, reports to ${managerId}`
  const cardLabel = `${employeeId}, ${name}, ${headcount} headcount, ${formatCurrency(payroll)} payroll${managerDescription}${statusDescription}`

  return (
    <div className="org-node-slot" style={{ transform: `translate3d(${x}px, ${y}px, 0)` }}>
      {/*
        IMPORTANT: spread dnd-kit's listeners/attributes FIRST, then the
        explicit role/tabIndex/aria-selected/aria-label/onClick/onKeyDown
        props AFTER — dnd-kit's `attributes` object includes its own
        `role="button"` and `tabIndex`, and in JSX a later prop always wins
        over an earlier one with the same name. If this element ever ends up
        with role="button" instead of role="treeitem", the ordering below
        was reversed by mistake.
      */}
      <div
        ref={setRefs}
        className={className}
        style={dragStyle}
        {...draggable.listeners}
        {...draggable.attributes}
        role="treeitem"
        tabIndex={0}
        aria-selected={isSelected}
        aria-label={cardLabel}
        onClick={() => onSelect(employeeId)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onSelect(employeeId)
          }
        }}
      >
        <span className="org-node-card__id" aria-hidden="true">
          {employeeId}
          {isRoot ? ' ★' : ''}
          {isMoved ? ' ↪' : ''}
          {isChanged ? ' Δ' : ''}
        </span>
        <span className="org-node-card__name" aria-hidden="true">{name}</span>
        <span className="org-node-card__metrics" aria-hidden="true">{role} · HC {headcount} · {formatCurrency(payroll)}</span>
      </div>
      {hasChildren ? (
        <button
          type="button"
          className="org-node-collapse"
          onClick={(event: ReactMouseEvent) => {
            event.stopPropagation()
            onToggleCollapse(employeeId)
          }}
        >
          {isCollapsed ? <ChevronDown aria-hidden="true" size={13} /> : <ChevronUp aria-hidden="true" size={13} />}
          <span className="visually-hidden">{`${isCollapsed ? 'Expand' : 'Collapse'} ${name}`}</span>
        </button>
      ) : null}
    </div>
  )
}

export function OrgTreeCanvas({
  department,
  selectedId,
  previewImpact,
  collapsedIds,
  onSelect,
  onToggleCollapse,
  onProposeTransfer,
  ariaLabel = 'Department reporting tree',
}: OrgTreeCanvasProps) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const panState = useRef<{ panning: boolean; startX: number; startY: number; originX: number; originY: number }>({
    panning: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const layout = layoutTree(department, collapsedIds)
  const employeesById = new Map(department.employees.map((employee) => [employee.employee_id, employee]))
  const impact = previewImpact ?? department.last_successful_transfer
  const movedIds = new Set(impact?.moved_subtree_ids ?? [])
  const changedIds = new Set(impact?.changed_rollup_ids ?? [])

  const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    setView((current) => ({ ...current, scale: clampScale(current.scale - event.deltaY * 0.001) }))
  }

  const handleViewportMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    panState.current = {
      panning: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: view.x,
      originY: view.y,
    }
  }

  const handleViewportMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!panState.current.panning) return
    const dx = event.clientX - panState.current.startX
    const dy = event.clientY - panState.current.startY
    setView((current) => ({ ...current, x: panState.current.originX + dx, y: panState.current.originY + dy }))
  }

  const stopPanning = () => {
    panState.current.panning = false
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const drop = resolveDrop(event.active.id, event.over?.id ?? null)
    if (drop) onProposeTransfer(drop.employeeId, drop.managerId)
  }

  return (
    <div className="tree-stage">
      <div className="tree-stage__toolbar" aria-label="Tree zoom controls">
        <button type="button" className="icon-command" onClick={() => setView((current) => ({ ...current, scale: clampScale(current.scale - 0.2) }))} title="Zoom out">
          <Minus aria-hidden="true" size={16} />
        </button>
        <button type="button" className="icon-command" onClick={() => setView((current) => ({ ...current, scale: clampScale(current.scale + 0.2) }))} title="Zoom in">
          <Plus aria-hidden="true" size={16} />
        </button>
        <button type="button" className="icon-command" onClick={() => setView({ scale: 1, x: 0, y: 0 })} title="Fit to screen">
          <Maximize2 aria-hidden="true" size={16} />
        </button>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          className="tree-stage__viewport"
          onWheel={handleWheel}
          onMouseDown={handleViewportMouseDown}
          onMouseMove={handleViewportMouseMove}
          onMouseUp={stopPanning}
          onMouseLeave={stopPanning}
        >
          <div
            className="tree-stage__world"
            role="tree"
            aria-label={ariaLabel}
            style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, width: layout.width, height: layout.height }}
          >
            <svg className="tree-stage__edges" width={layout.width} height={layout.height} aria-hidden="true">
              {layout.edges.map((edge) => <path key={`${edge.parentId}-${edge.childId}`} d={edge.path} />)}
            </svg>
            {layout.nodes.map((node) => {
              const employee = employeesById.get(node.id)
              if (!employee) return null
              return (
                <OrgNodeCard
                  key={employee.employee_id}
                  employeeId={employee.employee_id}
                  name={employee.name}
                  role={employee.role}
                  managerId={employee.manager_id}
                  headcount={employee.team_headcount}
                  payroll={employee.team_payroll}
                  x={node.x}
                  y={node.y}
                  isRoot={employee.employee_id === department.root_id}
                  isSelected={employee.employee_id === selectedId}
                  isMoved={movedIds.has(employee.employee_id)}
                  isChanged={changedIds.has(employee.employee_id)}
                  hasChildren={employee.children_ids.length > 0}
                  isCollapsed={collapsedIds.has(employee.employee_id)}
                  onSelect={onSelect}
                  onToggleCollapse={onToggleCollapse}
                />
              )
            })}
          </div>
        </div>
      </DndContext>
    </div>
  )
}
```

Node sizing note: the card's on-screen size comes entirely from CSS (`.org-node-slot { width: 180px; height: 88px; }`, added in Task 10) — it does not need `NODE_W`/`NODE_H` from `orgTreeLayout.ts` at render time, only `layoutTree`'s computed `x`/`y` per node.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm run test -- --run src/components/OrgTreeCanvas.test.tsx`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/OrgTreeCanvas.tsx frontend/src/components/OrgTreeCanvas.test.tsx
git commit -m "feat(frontend): add zoomable/pannable OrgTreeCanvas with drag-and-drop"
```

Note: full pointer-drag drag-and-drop interaction (as opposed to `resolveDrop`'s decision logic, which is unit-tested above) is verified manually in Task 12's live walkthrough — simulating `@dnd-kit`'s pointer-sensor choreography under jsdom is unreliable and out of scope for today's deadline.

---

## Task 8: Frontend — `TransferDropConfirm` popover

**Files:**
- Create: `frontend/src/components/TransferDropConfirm.tsx`
- Create: `frontend/src/components/TransferDropConfirm.test.tsx`

**Interfaces:**
- Consumes: `TransferImpactView` type, `BannerMessage` type from `MessageBanner.tsx` (existing).
- Produces: `TransferDropConfirm` component with props `{ employeeId: string; newManagerId: string; impact: TransferImpactView | null; loading: boolean; error: BannerMessage | null; onConfirm: () => void; onCancel: () => void }` — consumed by Task 11 (`App.tsx`).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/TransferDropConfirm.test.tsx`:

```typescript
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TransferDropConfirm } from './TransferDropConfirm'
import type { TransferImpactView } from '../types/department'

const impact: TransferImpactView = {
  employee_id: 'LEAD_A',
  employee_name: 'Lead Alice',
  old_manager_id: 'MGR_A',
  new_manager_id: 'MGR_C',
  moved_subtree_ids: ['LEAD_A', 'E1'],
  moved_headcount: 2,
  moved_payroll: 80_000,
  changed_rollup_ids: ['MGR_A', 'MGR_C'],
  changes: [],
  root_unchanged: true,
}

describe('TransferDropConfirm', () => {
  it('shows the proposed move and impact numbers', () => {
    render(
      <TransferDropConfirm
        employeeId="LEAD_A"
        newManagerId="MGR_C"
        impact={impact}
        loading={false}
        error={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText(/LEAD_A/)).toBeInTheDocument()
    expect(screen.getByText(/MGR_C/)).toBeInTheDocument()
    expect(screen.getByText(/2/)).toBeInTheDocument()
  })

  it('shows the backend error message when the proposed move is invalid', () => {
    render(
      <TransferDropConfirm
        employeeId="MGR_A"
        newManagerId="E3"
        impact={null}
        loading={false}
        error={{ kind: 'error', code: 'MANAGEMENT_CYCLE', message: 'Transfer would create a management cycle' }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByText('Transfer would create a management cycle')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('calls onConfirm and onCancel from their respective buttons', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <TransferDropConfirm
        employeeId="LEAD_A"
        newManagerId="MGR_C"
        impact={impact}
        loading={false}
        error={null}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm run test -- --run src/components/TransferDropConfirm.test.tsx`
Expected: FAIL — `Failed to resolve import "./TransferDropConfirm"`

- [ ] **Step 3: Implement `TransferDropConfirm.tsx`**

```typescript
import { formatCurrency } from '../format'
import type { TransferImpactView } from '../types/department'
import type { BannerMessage } from './MessageBanner'

interface TransferDropConfirmProps {
  employeeId: string
  newManagerId: string
  impact: TransferImpactView | null
  loading: boolean
  error: BannerMessage | null
  onConfirm: () => void
  onCancel: () => void
}

export function TransferDropConfirm({
  employeeId,
  newManagerId,
  impact,
  loading,
  error,
  onConfirm,
  onCancel,
}: TransferDropConfirmProps) {
  return (
    <div className="drop-confirm" role="dialog" aria-label="Confirm transfer">
      <p className="drop-confirm__title">
        Move <strong>{employeeId}</strong> to report to <strong>{newManagerId}</strong>?
      </p>
      {impact ? (
        <div className="drop-confirm__impact">
          <span>Subtree moved: {impact.moved_headcount} people · {formatCurrency(impact.moved_payroll)}</span>
          <span>Rollups affected: {impact.changed_rollup_ids.join(', ') || 'none'}</span>
        </div>
      ) : null}
      {error ? <p className="drop-confirm__error">{error.message}</p> : null}
      <div className="drop-confirm__actions">
        <button type="button" className="command-button" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button
          type="button"
          className="command-button command-button--primary"
          onClick={onConfirm}
          disabled={loading || impact === null}
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm run test -- --run src/components/TransferDropConfirm.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/TransferDropConfirm.tsx frontend/src/components/TransferDropConfirm.test.tsx
git commit -m "feat(frontend): add TransferDropConfirm popover for drag-and-drop transfers"
```

---

## Task 9: Frontend — `RosterControls` (graphical + text-based add/delete)

**Files:**
- Create: `frontend/src/components/RosterControls.tsx`
- Create: `frontend/src/components/RosterControls.test.tsx`

**Interfaces:**
- Consumes: `AddEmployeeRequest`, `DepartmentView` types.
- Produces: `RosterControls` component with props `{ department: DepartmentView | null; loading: boolean; onAdd: (request: AddEmployeeRequest) => void; onDelete: (employeeId: string) => void }` — consumed by Task 11 (`App.tsx`). Scope note: the spec's optional "+ hover on a tree card pre-fills manager" affordance is cut for today's deadline (this sidebar form is the single graphical + text-based add path, satisfying the spec's core "graphical and text-based" requirement without a second entry point) — see the ruling in the SDD ledger.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/RosterControls.test.tsx`:

```typescript
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RosterControls } from './RosterControls'
import type { DepartmentView } from '../types/department'

const department: DepartmentView = {
  scenario: 'main-12',
  root_id: 'HOD',
  employees: [
    { employee_id: 'HOD', name: 'Head', role: 'HOD', monthly_salary: 1, manager_id: null, children_ids: ['LEAD_A'], direct_report_count: 1, team_headcount: 2, team_payroll: 2 },
    { employee_id: 'LEAD_A', name: 'Lead Alice', role: 'Lead', monthly_salary: 1, manager_id: 'HOD', children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 1 },
  ],
  totals: { employee_count: 2, total_payroll: 2 },
  last_successful_transfer: null,
}

describe('RosterControls', () => {
  it('disables Add until every required field is filled', () => {
    render(<RosterControls department={department} loading={false} onAdd={vi.fn()} onDelete={vi.fn()} />)

    expect(screen.getByRole('button', { name: /add employee/i })).toBeDisabled()
  })

  it('calls onAdd with the entered fields once all are filled', () => {
    const onAdd = vi.fn()
    render(<RosterControls department={department} loading={false} onAdd={onAdd} onDelete={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/employee id/i), { target: { value: 'E7' } })
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'New Hire' } })
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'IC' } })
    fireEvent.change(screen.getByLabelText(/monthly salary/i), { target: { value: '40000' } })
    fireEvent.change(screen.getByLabelText(/manager/i), { target: { value: 'LEAD_A' } })
    fireEvent.click(screen.getByRole('button', { name: /add employee/i }))

    expect(onAdd).toHaveBeenCalledWith({
      employee_id: 'E7',
      name: 'New Hire',
      role: 'IC',
      monthly_salary: 40_000,
      manager_id: 'LEAD_A',
    })
  })

  it('calls onDelete with the typed id and disables Delete until an id is entered', () => {
    const onDelete = vi.fn()
    render(<RosterControls department={department} loading={false} onAdd={vi.fn()} onDelete={onDelete} />)

    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/delete employee id/i), { target: { value: 'LEAD_A' } })
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(onDelete).toHaveBeenCalledWith('LEAD_A')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm run test -- --run src/components/RosterControls.test.tsx`
Expected: FAIL — `Failed to resolve import "./RosterControls"`

- [ ] **Step 3: Implement `RosterControls.tsx`**

```typescript
import { Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'

import type { AddEmployeeRequest, DepartmentView } from '../types/department'

interface RosterControlsProps {
  department: DepartmentView | null
  loading: boolean
  onAdd: (request: AddEmployeeRequest) => void
  onDelete: (employeeId: string) => void
}

export function RosterControls({ department, loading, onAdd, onDelete }: RosterControlsProps) {
  const [employeeId, setEmployeeId] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [salary, setSalary] = useState('')
  const [managerId, setManagerId] = useState('')
  const [deleteId, setDeleteId] = useState('')

  if (department === null) {
    return <p className="workspace-section__empty">Load a department to manage employees.</p>
  }

  const salaryValue = Number(salary)
  const canAdd = !loading && employeeId.trim() !== '' && name.trim() !== '' && role.trim() !== '' && managerId !== '' && Number.isInteger(salaryValue) && salaryValue > 0
  const canDelete = !loading && deleteId !== ''

  const submitAdd = () => {
    onAdd({
      employee_id: employeeId.trim().toUpperCase(),
      name: name.trim(),
      role: role.trim(),
      monthly_salary: salaryValue,
      manager_id: managerId,
    })
    setEmployeeId('')
    setName('')
    setRole('')
    setSalary('')
  }

  return (
    <div className="roster-controls">
      <div className="roster-controls__section">
        <h3>Add employee</h3>
        <div className="roster-form">
          <div className="roster-form__row">
            <label htmlFor="roster-add-id">Employee ID</label>
            <input id="roster-add-id" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} disabled={loading} placeholder="E7" />
          </div>
          <div className="roster-form__row">
            <label htmlFor="roster-add-name">Name</label>
            <input id="roster-add-name" value={name} onChange={(event) => setName(event.target.value)} disabled={loading} placeholder="New Hire" />
          </div>
          <div className="roster-form__row">
            <label htmlFor="roster-add-role">Role</label>
            <input id="roster-add-role" value={role} onChange={(event) => setRole(event.target.value)} disabled={loading} placeholder="IC" />
          </div>
          <div className="roster-form__row">
            <label htmlFor="roster-add-salary">Monthly salary</label>
            <input id="roster-add-salary" type="number" min={1} value={salary} onChange={(event) => setSalary(event.target.value)} disabled={loading} placeholder="40000" />
          </div>
          <div className="roster-form__row">
            <label htmlFor="roster-add-manager">Manager</label>
            <select id="roster-add-manager" value={managerId} onChange={(event) => setManagerId(event.target.value)} disabled={loading}>
              <option value="">Choose manager</option>
              {department.employees.map((employee) => (
                <option key={employee.employee_id} value={employee.employee_id}>
                  {employee.employee_id} — {employee.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="command-button command-button--primary" onClick={submitAdd} disabled={!canAdd}>
            <UserPlus aria-hidden="true" size={16} strokeWidth={2} />
            <span>Add employee</span>
          </button>
        </div>
      </div>

      <div className="roster-controls__section">
        <h3>Delete employee</h3>
        <div className="roster-delete">
          <label htmlFor="roster-delete-id" className="visually-hidden">Delete employee id</label>
          <input id="roster-delete-id" value={deleteId} onChange={(event) => setDeleteId(event.target.value)} disabled={loading} placeholder="Employee ID" />
          <button
            type="button"
            className="command-button"
            onClick={() => {
              onDelete(deleteId.trim().toUpperCase())
              setDeleteId('')
            }}
            disabled={!canDelete}
          >
            <Trash2 aria-hidden="true" size={16} strokeWidth={2} />
            <span>Delete</span>
          </button>
        </div>
        <p className="transfer-controls__hint">An employee with direct reports must be reassigned before they can be deleted.</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm run test -- --run src/components/RosterControls.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RosterControls.tsx frontend/src/components/RosterControls.test.tsx
git commit -m "feat(frontend): add graphical and text-based RosterControls for add/delete"
```

---

## Task 10: Frontend — `workspace.css` stylesheet and `index.css` cleanup

**Files:**
- Create: `frontend/src/workspace.css`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Produces: all class names referenced by Tasks 6–9 and Task 11 (`.workspace*`, `.tree-stage*`, `.org-node*`, `.drop-confirm*`, `.collapsible-panel*`, `.roster-*`).

- [ ] **Step 1: Create `frontend/src/workspace.css`**

```css
.workspace { display: grid; grid-template-columns: 300px minmax(0, 1fr) 340px; grid-template-rows: minmax(0, 1fr); gap: 1px; min-height: 0; flex: 1; overflow: hidden; background: var(--border); }
.workspace--sidebar-collapsed { grid-template-columns: 48px minmax(0, 1fr) 340px; }
.workspace--right-collapsed { grid-template-columns: 300px minmax(0, 1fr) 48px; }
.workspace--sidebar-collapsed.workspace--right-collapsed { grid-template-columns: 48px minmax(0, 1fr) 48px; }

.collapsible-panel { display: flex; min-width: 0; min-height: 0; flex-direction: column; background: var(--panel); overflow: hidden; }
.collapsible-panel--collapsed { align-items: center; padding-top: 10px; }
.collapsible-panel__header { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 46px; padding: 0 12px; border-bottom: 1px solid var(--border); }
.collapsible-panel__title-group { display: flex; min-width: 0; flex-direction: column; gap: 1px; }
.collapsible-panel__eyebrow { color: var(--text-muted); font-family: var(--font-mono); font-size: 10px; font-weight: 700; text-transform: uppercase; }
.collapsible-panel__title { overflow: hidden; font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.collapsible-panel__toggle { display: grid; width: 28px; height: 28px; flex: none; place-items: center; color: var(--text-muted); background: var(--panel-raised); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; }
.collapsible-panel__toggle:hover { color: var(--text); border-color: var(--interactive); }
.collapsible-panel__body { min-height: 0; flex: 1; overflow: auto; }

.tree-stage { position: relative; display: flex; min-height: 0; min-width: 0; flex: 1; flex-direction: column; background: var(--canvas); }
.tree-stage__toolbar { display: flex; align-items: center; gap: 6px; min-height: 46px; padding: 0 12px; background: var(--panel); border-bottom: 1px solid var(--border); }
.tree-stage__viewport { position: relative; min-height: 0; flex: 1; overflow: hidden; cursor: grab; touch-action: none; }
.tree-stage__world { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
.tree-stage__edges { position: absolute; top: 0; left: 0; overflow: visible; pointer-events: none; }
.tree-stage__edges path { fill: none; stroke: var(--border); stroke-width: 2; }

.org-node-slot { position: absolute; top: 0; left: 0; width: 180px; height: 88px; }
.org-node-card { display: flex; box-sizing: border-box; width: 100%; height: 100%; flex-direction: column; justify-content: center; gap: 3px; padding: 10px 12px; cursor: grab; -webkit-user-select: none; user-select: none; background: var(--panel-raised); border: 1.5px solid var(--border); border-radius: 6px; }
.org-node-card:hover { border-color: var(--interactive); }
.org-node-card--selected { border-width: 3px; border-color: var(--interactive); }
.org-node-card--over { border-color: var(--ok); border-style: dashed; }
.org-node-card--dragging { opacity: 0.5; }
.org-node-card:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
.org-node-card__id { color: var(--text-muted); font-family: var(--font-mono); font-size: 11px; font-weight: 800; }
.org-node-card__name { overflow: hidden; color: var(--text); font-size: 14px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.org-node-card__metrics { overflow: hidden; color: var(--text-muted); font-family: var(--font-mono); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.org-node-collapse { position: absolute; bottom: -10px; left: 50%; z-index: 1; display: grid; width: 20px; height: 20px; place-items: center; color: var(--text-muted); background: var(--panel); border: 1px solid var(--border); border-radius: 50%; cursor: pointer; transform: translateX(-50%); }
.org-node-collapse:hover { color: var(--text); border-color: var(--interactive); }

.drop-confirm { position: fixed; bottom: 28px; left: 50%; z-index: 30; display: flex; width: min(420px, calc(100vw - 32px)); flex-direction: column; gap: 10px; padding: 14px 16px; background: var(--panel-raised); border: 1px solid var(--interactive); border-radius: 8px; box-shadow: 0 14px 34px rgb(0 0 0 / 45%); transform: translateX(-50%); }
.drop-confirm__title { margin: 0; font-size: 13px; font-weight: 700; }
.drop-confirm__impact { display: grid; gap: 4px; color: var(--text-muted); font-family: var(--font-mono); font-size: 11px; }
.drop-confirm__error { margin: 0; color: #ffd6d6; font-size: 12px; }
.drop-confirm__actions { display: flex; justify-content: flex-end; gap: 8px; }

.roster-controls { display: grid; gap: 16px; padding: 14px; }
.roster-controls__section h3 { margin: 0 0 8px; color: var(--text-muted); font-family: var(--font-mono); font-size: 11px; font-weight: 800; text-transform: uppercase; }
.roster-form { display: grid; gap: 8px; }
.roster-form__row { display: grid; gap: 5px; }
.roster-form__row label { color: var(--text-muted); font-size: 11px; font-weight: 700; }
.roster-form input, .roster-form select, .roster-delete input { min-height: 32px; padding: 0 8px; color: var(--text); background: var(--panel-raised); border: 1px solid var(--border); border-radius: 4px; font-size: 12px; }
.roster-delete { display: flex; gap: 8px; }
.roster-delete input { flex: 1; }

.sidebar-employees { min-height: 0; }

@media (max-width: 1120px) {
  .workspace, .workspace--sidebar-collapsed, .workspace--right-collapsed, .workspace--sidebar-collapsed.workspace--right-collapsed {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(320px, 1fr) auto;
    overflow: auto;
  }
}
```

- [ ] **Step 2: Remove the obsolete 3-column layout rules from `index.css` and import the new stylesheet**

In `frontend/src/index.css`, change the top import line from:

```css
@import './theme.css';
```

to:

```css
@import './theme.css';
@import './workspace.css';
```

Then delete these now-obsolete rules (they targeted the old `App.tsx` layout and won't be rendered by the new one): the `.app-shell { display: grid; ... }` line, the `.cockpit { ... }` line, every `.workspace-zone*` selector (`.workspace-zone`, `.workspace-zone__header`, `.workspace-zone__title`, `.workspace-zone__body`, `.workspace-zone--table .workspace-zone__body`, `.workspace-zone--chart .workspace-zone__body, .workspace-zone--right .workspace-zone__body`, and the two `@media` blocks at the bottom that reference `.cockpit`/`.workspace-zone--right`). Keep everything else — `.app-header*`, `.command-button`/`.icon-command`, `.message-banner*`, `.employee-table*`, `.status-badge*`, `.workspace-section*` (still used inside the right panel by `EmployeeDetails`/`TransferControls`/`ImpactPanel`), `.employee-details*`, `.transfer-control*`, `.impact-*`, `.chart-stage`, `.org-tree*` (still used by `OrgTree.tsx` inside `CompareDrawer`), `.compare-drawer*`, and the `@media (max-width: 760px)` block minus its `.cockpit`/`.workspace-zone--right` references (keep its `.app-header`/`.scenario-control`/`.compare-drawer` rules, drop the rest).

Replace `.app-shell { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 100dvh; }` with:

```css
.app-shell { display: flex; flex-direction: column; min-height: 100dvh; }
```

- [ ] **Step 3: Verify the build picks up the new stylesheet**

Run: `cd frontend && npm run build`
Expected: PASS, no CSS import errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/workspace.css frontend/src/index.css
git commit -m "feat(frontend): add workspace.css for the tree-as-hero layout"
```

---

## Task 11: Frontend — rewire `App.tsx` and update `App.test.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `addEmployee`/`deleteEmployee` (Task 4), `layoutTree`'s new signature (Task 5), `CollapsiblePanel` (Task 6), `OrgTreeCanvas`/`resolveDrop` (Task 7), `TransferDropConfirm` (Task 8), `RosterControls` (Task 9), `workspace.css` classes (Task 10). All prior components (`AppHeader`, `EmployeeTable`, `EmployeeDetails`, `TransferControls`, `ImpactPanel`, `MessageBanner`, `CompareDrawer`) keep their existing props unchanged.

- [ ] **Step 1: Write the new/changed App-level tests**

The existing file (`frontend/src/App.test.tsx`) already has: a `vi.mock('./api/department', ...)` factory; `scenarios` and `transferImpact` fixtures; `loadedDepartment`/`transferredDepartment` `DepartmentView` fixtures; `mockedListScenarios`/`mockedLoadDepartment`/`mockedPreviewTransfer`/`mockedResetDepartment`/`mockedTransfer` consts (each `vi.mocked(fn)`); a `renderLoadedApp(department = loadedDepartment)` helper that mocks scenarios+load, renders `<App />`, clicks "Load", and awaits `screen.findByRole('tree', { name: 'Department reporting tree' })`; a `detailsPanel()` helper; and one `describe('App', ...)` block with four `it`s (details-on-select, transfer-then-rejected-transfer, invalid-load-clears-workspace, reset-clears-state). Leave every one of those — imports, fixtures, helpers, and the four existing `it`s — exactly as they are today; they exercise `role="tree"`/`role="treeitem"` markup that `OrgTreeCanvas` (Task 7) reproduces verbatim, so they keep passing unchanged against the new layout.

Make these two additive edits:

1. Extend the top import (add `addEmployee`, `deleteEmployee`):

```typescript
import {
  ApiError,
  addEmployee,
  deleteEmployee,
  listScenarios,
  loadDepartment,
  previewTransfer,
  resetDepartment,
  transfer,
} from './api/department'
```

2. Extend the `vi.mock('./api/department', ...)` factory's returned object to also include `addEmployee: vi.fn()` and `deleteEmployee: vi.fn()` alongside the existing five mocked exports.

Then, right after the existing `const mockedTransfer = vi.mocked(transfer)` line, add two more consts following the same pattern:

```typescript
const mockedAddEmployee = vi.mocked(addEmployee)
const mockedDeleteEmployee = vi.mocked(deleteEmployee)
```

Finally, append a new `describe` block at the end of the file (after the existing `describe('App', ...)` block's closing `})`):

```typescript
describe('collapsible layout and roster controls', () => {
  it('collapses and expands the sidebar via its toggle', async () => {
    await renderLoadedApp()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse Employees' }))
    expect(screen.getByRole('button', { name: 'Expand Employees' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Expand Employees' }))
    expect(screen.getByRole('button', { name: 'Collapse Employees' })).toBeInTheDocument()
  })

  it('adds an employee through the sidebar form and shows a success banner', async () => {
    mockedAddEmployee.mockResolvedValue({
      ...loadedDepartment,
      employees: [...loadedDepartment.employees, {
        employee_id: 'E7', name: 'New Hire', role: 'IC', monthly_salary: 100, manager_id: 'LEAD_A',
        children_ids: [], direct_report_count: 0, team_headcount: 1, team_payroll: 100,
      }],
    })
    await renderLoadedApp()

    fireEvent.change(screen.getByLabelText('Employee ID'), { target: { value: 'E7' } })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Hire' } })
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'IC' } })
    fireEvent.change(screen.getByLabelText('Monthly salary'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Manager'), { target: { value: 'LEAD_A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add employee' }))

    await waitFor(() => expect(mockedAddEmployee).toHaveBeenCalledWith({
      employee_id: 'E7', name: 'New Hire', role: 'IC', monthly_salary: 100, manager_id: 'LEAD_A',
    }))
    expect(await screen.findByText('Added E7.')).toBeInTheDocument()
  })

  it('shows the backend error banner when delete is blocked by direct reports', async () => {
    mockedDeleteEmployee.mockRejectedValue(new ApiError('EMPLOYEE_HAS_DIRECT_REPORTS', 'Employee has direct reports and cannot be deleted'))
    await renderLoadedApp()

    fireEvent.change(screen.getByLabelText('Delete employee id'), { target: { value: 'MGR_A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Employee has direct reports and cannot be deleted')).toBeInTheDocument()
  })
})
```

(`getByLabelText('Delete employee id')` matches `RosterControls`' visually-hidden `<label htmlFor="roster-delete-id">Delete employee id</label>` from Task 9 — Testing Library's `getByLabelText` finds labels regardless of the `.visually-hidden` CSS class, since that class only affects visual rendering, not the accessibility tree.)

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd frontend && npm run test -- --run src/App.test.tsx`
Expected: FAIL — `RosterControls`/collapsible sidebar markup doesn't exist in the current `App.tsx` yet

- [ ] **Step 3: Rewrite `App.tsx`**

```typescript
import { useEffect, useState } from 'react'

import {
  ApiError,
  addEmployee,
  deleteEmployee,
  listScenarios,
  loadDepartment,
  previewTransfer,
  resetDepartment,
  transfer,
} from './api/department'
import { AppHeader } from './components/AppHeader'
import { CollapsiblePanel } from './components/CollapsiblePanel'
import { CompareDrawer } from './components/CompareDrawer'
import { EmployeeDetails } from './components/EmployeeDetails'
import { EmployeeTable } from './components/EmployeeTable'
import { ImpactPanel } from './components/ImpactPanel'
import { MessageBanner, type BannerMessage } from './components/MessageBanner'
import { OrgTreeCanvas } from './components/OrgTreeCanvas'
import { RosterControls } from './components/RosterControls'
import { TransferControls } from './components/TransferControls'
import { TransferDropConfirm } from './components/TransferDropConfirm'
import type { AddEmployeeRequest, DepartmentView, ScenarioView, TransferImpactView } from './types/department'

function messageFromError(error: unknown, fallback: string): BannerMessage {
  if (error instanceof ApiError) {
    return { kind: 'error', code: error.code, message: error.message }
  }

  return { kind: 'error', code: 'REQUEST_FAILED', message: fallback }
}

function App() {
  const [scenarios, setScenarios] = useState<ScenarioView[]>([])
  const [scenario, setScenario] = useState('main-12')
  const [department, setDepartment] = useState<DepartmentView | null>(null)
  const [originalDepartment, setOriginalDepartment] = useState<DepartmentView | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [transferEmployeeId, setTransferEmployeeId] = useState('')
  const [newManagerId, setNewManagerId] = useState('')
  const [previewImpact, setPreviewImpact] = useState<TransferImpactView | null>(null)
  const [banner, setBanner] = useState<BannerMessage | null>(null)
  const [loading, setLoading] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set())
  const [pendingDrop, setPendingDrop] = useState<{ employeeId: string; managerId: string } | null>(null)

  useEffect(() => {
    void listScenarios()
      .then(setScenarios)
      .catch((error: unknown) => setBanner(messageFromError(error, 'Unable to load scenarios.')))
  }, [])

  const clearInvalidLoad = (error: unknown) => {
    setDepartment(null)
    setOriginalDepartment(null)
    setPreviewImpact(null)
    setSelectedId(null)
    setTransferEmployeeId('')
    setNewManagerId('')
    setCompareOpen(false)
    setCollapsedNodeIds(new Set())
    setPendingDrop(null)
    setBanner(messageFromError(error, 'Unable to load the selected department.'))
  }

  const handleLoad = async () => {
    setLoading(true)
    try {
      const loadedDepartment = await loadDepartment(scenario)
      setDepartment(loadedDepartment)
      setOriginalDepartment(loadedDepartment)
      setSelectedId(loadedDepartment.root_id)
      setTransferEmployeeId('')
      setNewManagerId('')
      setPreviewImpact(null)
      setCompareOpen(false)
      setCollapsedNodeIds(new Set())
      setPendingDrop(null)
      setBanner({ kind: 'success', message: `Loaded ${loadedDepartment.employees.length} employee records.` })
    } catch (error) {
      clearInvalidLoad(error)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    setLoading(true)
    try {
      const reset = await resetDepartment()
      setDepartment(reset)
      setOriginalDepartment(reset)
      setSelectedId(reset.root_id)
      setTransferEmployeeId('')
      setNewManagerId('')
      setPreviewImpact(null)
      setCompareOpen(false)
      setCollapsedNodeIds(new Set())
      setPendingDrop(null)
      setBanner({ kind: 'success', message: 'Department reset to its loaded state.' })
    } catch (error) {
      setBanner(messageFromError(error, 'Unable to reset the department.'))
    } finally {
      setLoading(false)
    }
  }

  const stageAndPreview = async (employeeId: string, managerId: string) => {
    setLoading(true)
    try {
      const response = await previewTransfer(employeeId, managerId)
      setPreviewImpact(response.impact)
      setBanner({ kind: 'success', message: 'Transfer preview is ready for review.' })
    } catch (error) {
      setPreviewImpact(null)
      setBanner(messageFromError(error, 'Unable to preview this transfer.'))
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = () => {
    if (!department || !transferEmployeeId || !newManagerId) return
    void stageAndPreview(transferEmployeeId, newManagerId)
  }

  const commitTransfer = async (employeeId: string, managerId: string) => {
    setLoading(true)
    try {
      const response = await transfer(employeeId, managerId)
      setDepartment(response.department)
      setPreviewImpact(null)
      setSelectedId(response.impact.employee_id)
      setBanner({ kind: 'success', message: 'Transfer applied to the current department.' })
    } catch (error) {
      setPreviewImpact(null)
      setBanner(messageFromError(error, 'Transfer was not applied.'))
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = () => {
    if (!department || !transferEmployeeId || !newManagerId) return
    void commitTransfer(transferEmployeeId, newManagerId)
  }

  const handleTransferEmployeeIdChange = (employeeId: string) => {
    setTransferEmployeeId(employeeId)
    setPreviewImpact(null)
  }

  const handleNewManagerIdChange = (managerId: string) => {
    setNewManagerId(managerId)
    setPreviewImpact(null)
  }

  const loadTransferPreset = (employeeId: string, managerId: string) => {
    setTransferEmployeeId(employeeId)
    setNewManagerId(managerId)
    setPreviewImpact(null)
    setBanner({ kind: 'success', message: `Staged ${employeeId} → ${managerId}.` })
  }

  const handleRootMoveAttempt = async () => {
    if (!department) return

    const root = department.employees.find((employee) => employee.employee_id === department.root_id)
    const demonstrationManagerId = root?.children_ids[0] ?? department.employees.find((employee) => employee.employee_id !== department.root_id)?.employee_id
    if (!demonstrationManagerId) {
      setBanner({
        kind: 'error',
        code: 'NO_DEMONSTRATION_TARGET',
        message: 'No other employee exists to demonstrate a root move on this scenario.',
      })
      return
    }

    void commitTransfer(department.root_id, demonstrationManagerId)
  }

  const handleProposeTransfer = (employeeId: string, managerId: string) => {
    setTransferEmployeeId(employeeId)
    setNewManagerId(managerId)
    setPendingDrop({ employeeId, managerId })
    void stageAndPreview(employeeId, managerId)
  }

  const handleConfirmDrop = () => {
    if (!pendingDrop) return
    void commitTransfer(pendingDrop.employeeId, pendingDrop.managerId)
    setPendingDrop(null)
  }

  const handleCancelDrop = () => {
    setPendingDrop(null)
    setPreviewImpact(null)
  }

  const handleToggleCollapseNode = (employeeId: string) => {
    setCollapsedNodeIds((current) => {
      const next = new Set(current)
      if (next.has(employeeId)) next.delete(employeeId)
      else next.add(employeeId)
      return next
    })
  }

  const handleAddEmployee = async (request: AddEmployeeRequest) => {
    setLoading(true)
    try {
      const updated = await addEmployee(request)
      setDepartment(updated)
      setBanner({ kind: 'success', message: `Added ${request.employee_id}.` })
    } catch (error) {
      setBanner(messageFromError(error, 'Unable to add employee.'))
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEmployee = async (employeeId: string) => {
    if (employeeId === '') return
    setLoading(true)
    try {
      const updated = await deleteEmployee(employeeId)
      setDepartment(updated)
      setSelectedId((current) => (current === employeeId ? updated.root_id : current))
      setBanner({ kind: 'success', message: `Deleted ${employeeId}.` })
    } catch (error) {
      setBanner(messageFromError(error, 'Unable to delete employee.'))
    } finally {
      setLoading(false)
    }
  }

  const impact = previewImpact ?? department?.last_successful_transfer ?? null
  const selectedEmployee = department?.employees.find((employee) => employee.employee_id === selectedId) ?? null
  const workspaceClassName = [
    'workspace',
    sidebarCollapsed ? 'workspace--sidebar-collapsed' : '',
    rightPanelCollapsed ? 'workspace--right-collapsed' : '',
  ].filter(Boolean).join(' ')

  return (
    <main className="app-shell">
      <AppHeader
        scenarios={scenarios}
        scenario={scenario}
        loading={loading}
        hasDepartment={department !== null && originalDepartment !== null}
        compareOpen={compareOpen}
        onScenarioChange={setScenario}
        onLoad={() => void handleLoad()}
        onReset={() => void handleReset()}
        onCompareToggle={() => setCompareOpen((open) => !open)}
      />
      <MessageBanner banner={banner} />
      <section className={workspaceClassName} aria-label="Department payroll workspace">
        <CollapsiblePanel
          title="Employees"
          eyebrow="ROSTER"
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
          side="left"
        >
          {department ? (
            <>
              <div className="sidebar-employees">
                <EmployeeTable department={department} selectedId={selectedId} impact={impact} onSelect={setSelectedId} />
              </div>
              <RosterControls department={department} loading={loading} onAdd={(request) => void handleAddEmployee(request)} onDelete={(employeeId) => void handleDeleteEmployee(employeeId)} />
            </>
          ) : (
            <div className="empty-state">No valid department loaded.</div>
          )}
        </CollapsiblePanel>

        <section className="workspace-zone workspace-zone--chart" aria-label="Organisation chart">
          {department ? (
            <OrgTreeCanvas
              department={department}
              selectedId={selectedId}
              previewImpact={previewImpact}
              collapsedIds={collapsedNodeIds}
              onSelect={setSelectedId}
              onToggleCollapse={handleToggleCollapseNode}
              onProposeTransfer={handleProposeTransfer}
            />
          ) : <div className="chart-stage">No organisation chart to display.</div>}
        </section>

        <CollapsiblePanel
          title="Work queue"
          eyebrow="REVIEW"
          collapsed={rightPanelCollapsed}
          onToggleCollapsed={() => setRightPanelCollapsed((value) => !value)}
          side="right"
        >
          <section className="workspace-section">
            <h2 className="workspace-section__heading">Details</h2>
            <EmployeeDetails employee={selectedEmployee} />
          </section>
          <section className="workspace-section">
            <h2 className="workspace-section__heading">Transfer</h2>
            <TransferControls
              department={department}
              employeeId={transferEmployeeId}
              newManagerId={newManagerId}
              loading={loading}
              onEmployeeIdChange={handleTransferEmployeeIdChange}
              onNewManagerIdChange={handleNewManagerIdChange}
              onPreview={handlePreview}
              onApply={handleTransfer}
              onLoadValidPreset={() => loadTransferPreset('LEAD_A', 'MGR_C')}
              onLoadCyclePreset={() => loadTransferPreset('MGR_A', 'E3')}
              onAttemptRootMove={() => void handleRootMoveAttempt()}
            />
          </section>
          <section className="workspace-section">
            <h2 className="workspace-section__heading">Impact</h2>
            <ImpactPanel department={department} impact={impact} preview={previewImpact !== null} />
          </section>
        </CollapsiblePanel>
      </section>
      {pendingDrop ? (
        <TransferDropConfirm
          employeeId={pendingDrop.employeeId}
          newManagerId={pendingDrop.managerId}
          impact={previewImpact}
          loading={loading}
          error={banner?.kind === 'error' ? banner : null}
          onConfirm={handleConfirmDrop}
          onCancel={handleCancelDrop}
        />
      ) : null}
      {department && originalDepartment ? (
        <CompareDrawer
          currentDepartment={department}
          originalDepartment={originalDepartment}
          isOpen={compareOpen}
          onClose={() => setCompareOpen(false)}
        />
      ) : null}
    </main>
  )
}

export default App
```

- [ ] **Step 4: Run the full frontend suite**

Run: `cd frontend && npm run test -- --run`
Expected: PASS — all existing tests plus the new ones from this task and Tasks 4–9

- [ ] **Step 5: Build and lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: both PASS. If `tsc` flags unused imports (e.g. `NODE_W`/`NODE_H` in `OrgTreeCanvas.tsx` per Task 7's note, or the old `ariaLabel`/`readOnly` props no longer referenced anywhere), remove them.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx
git commit -m "feat(frontend): rewire App.tsx into the collapsible tree-as-hero layout"
```

---

## Task 12: Final verification, docs, and manual demo walkthrough

**Files:**
- Modify: `docs/DESIGN_NOTES.md`
- Modify: `docs/AI_PROMPTS.md`

**Interfaces:**
- Consumes: nothing new — this task verifies Tasks 1–11 end to end.

- [ ] **Step 1: Run the complete backend and frontend suites**

Run:
```bash
cd backend && pytest
cd ../frontend && npm run test -- --run && npm run build && npm run lint
```
Expected: all PASS (backend: 107 tests; frontend: existing 16 + new tests from Tasks 4, 6, 7, 8, 9, 11).

- [ ] **Step 2: Manual live walkthrough**

Run `cd backend && uvicorn app.main:app --reload --port 8000` and `cd frontend && npm run dev` in two terminals, then in the browser verify each of these in order, exactly as `docs/EXPECTED_RESULTS.md` and the spec's §8 describe:
1. Load `main-12` — sidebar, tree canvas, and right panel all render; `HOD` shows headcount 12, ₹8,21,000.
2. Collapse the sidebar and right panel via their toggles, then expand them again.
3. Zoom in/out and pan the tree canvas; collapse/expand `MGR_A`'s subtree via its chevron.
4. Drag `LEAD_A`'s card onto `MGR_C`'s card — the `TransferDropConfirm` popover appears showing the real impact numbers; click Confirm — the tree updates and `MGR_A`/`MGR_C` rollups match `docs/EXPECTED_RESULTS.md`.
5. Reset, then drag `MGR_A` onto `E3` — the popover shows the `MANAGEMENT_CYCLE` error inline; Cancel leaves the department untouched.
6. Add an employee via the sidebar form (graphical: click "+" is not implemented as a separate control in this plan — the sidebar form itself is both the graphical and text-based entry point) — confirm it appears in the tree and table with correct rollups.
7. Attempt to delete `MGR_A` (has direct reports) — confirm the `EMPLOYEE_HAS_DIRECT_REPORTS` error banner appears and nothing changes.
8. Delete a leaf employee — confirm it disappears from the tree, table, and rollups update.
9. Reset — confirm the department returns exactly to the `main-12` load state (the added/deleted employees from steps 6–8 are gone).

If any step fails, fix the underlying task before proceeding — do not patch around it here.

- [ ] **Step 3: Update `docs/DESIGN_NOTES.md`**

Append a new dated entry following the file's existing "Prompt / Outcome" journal format (see the `2026-08-31 — Task 13` entry already in the file for the exact style), summarizing: the tree-as-hero layout, the `@dnd-kit` drag-and-drop-to-transfer flow reusing the existing preview/apply plumbing, the new additive `domain/roster.py` module and its two endpoints, and the manual walkthrough results from Step 2.

- [ ] **Step 4: Update `docs/AI_PROMPTS.md`**

Append an entry recording this frontend-revamp prompt and the resulting spec/plan paths (`docs/superpowers/specs/2026-08-31-frontend-revamp-design.md`, `docs/superpowers/plans/2026-08-31-frontend-revamp.md`), following whatever entry format the file already uses.

- [ ] **Step 5: Commit**

```bash
git add docs/DESIGN_NOTES.md docs/AI_PROMPTS.md
git commit -m "docs: record frontend revamp verification and design notes"
```
