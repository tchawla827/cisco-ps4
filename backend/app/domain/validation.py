from __future__ import annotations

import re
from collections.abc import Sequence

from app.domain.errors import (
    DUPLICATE_EMPLOYEE_ID,
    INVALID_EMPLOYEE,
    INVALID_ROOT_COUNT,
    MANAGEMENT_CYCLE,
    SELF_MANAGER,
    UNKNOWN_MANAGER,
    DomainError,
)
from app.domain.models import Employee
from app.domain.tree import build_tree


EMPLOYEE_ID_PATTERN = re.compile(r"^[A-Z][A-Z0-9_-]{0,15}$")
MIN_EMPLOYEES, MAX_EMPLOYEES = 1, 30
MIN_SALARY, MAX_SALARY = 1, 1_000_000


def validate_department(employees: Sequence[Employee]) -> DomainError | None:
    """Run the six validation passes in precedence order."""
    passes = (
        _pass1_fields,
        _pass2_duplicates,
        _pass3_root_count,
        _pass4_manager_refs,
        _pass5_cycle,
        _pass6_connected,
    )
    for validation_pass in passes:
        error = validation_pass(employees)
        if error is not None:
            return error
    return None


def _pass1_fields(employees: Sequence[Employee]) -> DomainError | None:
    employee_count = len(employees)
    if not MIN_EMPLOYEES <= employee_count <= MAX_EMPLOYEES:
        return DomainError(
            INVALID_EMPLOYEE,
            f"Department must contain 1-30 employees; got {employee_count}",
        )

    for index, employee in enumerate(employees):
        if not isinstance(employee.employee_id, str) or not EMPLOYEE_ID_PATTERN.fullmatch(
            employee.employee_id
        ):
            return _invalid_field(index, "employee_id")
        if not isinstance(employee.name, str) or not employee.name.strip():
            return _invalid_field(index, "name")
        if not isinstance(employee.role, str) or not employee.role.strip():
            return _invalid_field(index, "role")
        if (
            type(employee.monthly_salary) is not int
            or not MIN_SALARY <= employee.monthly_salary <= MAX_SALARY
        ):
            return _invalid_field(index, "monthly_salary")
        if employee.manager_id is not None and not isinstance(employee.manager_id, str):
            return _invalid_field(index, "manager_id")
    return None


def _pass2_duplicates(employees: Sequence[Employee]) -> DomainError | None:
    seen: dict[str, int] = {}
    for index, employee in enumerate(employees):
        first_index = seen.get(employee.employee_id)
        if first_index is not None:
            return DomainError(
                DUPLICATE_EMPLOYEE_ID,
                "Duplicate employee_id "
                f"'{employee.employee_id}' at record positions {first_index} and {index}",
            )
        seen[employee.employee_id] = index
    return None


def _pass3_root_count(employees: Sequence[Employee]) -> DomainError | None:
    root_ids = [employee.employee_id for employee in employees if employee.manager_id is None]
    if len(root_ids) != 1:
        return DomainError(
            INVALID_ROOT_COUNT,
            f"Expected exactly one root; found {len(root_ids)}: {root_ids}",
        )
    return None


def _pass4_manager_refs(employees: Sequence[Employee]) -> DomainError | None:
    employee_ids = {employee.employee_id for employee in employees}
    for index, employee in enumerate(employees):
        if employee.manager_id is None:
            continue
        if employee.manager_id == employee.employee_id:
            return DomainError(
                SELF_MANAGER,
                f"Employee at index {index} cannot manage itself: '{employee.employee_id}'",
            )
        if employee.manager_id not in employee_ids:
            return DomainError(
                UNKNOWN_MANAGER,
                f"Employee at index {index} references unknown manager "
                f"'{employee.manager_id}'",
            )
    return None


def _pass5_cycle(employees: Sequence[Employee]) -> DomainError | None:
    white, grey, black = 0, 1, 2
    by_id = {employee.employee_id: employee for employee in employees}
    state = {employee_id: white for employee_id in by_id}

    for employee in employees:
        path: list[str] = []
        current_id: str | None = employee.employee_id
        while current_id is not None and state[current_id] == white:
            state[current_id] = grey
            path.append(current_id)
            current_id = by_id[current_id].manager_id
        if current_id is not None and state[current_id] == grey:
            cycle = path[path.index(current_id) :]
            return DomainError(
                MANAGEMENT_CYCLE,
                f"Management cycle detected: {' -> '.join(cycle + [current_id])}",
            )
        for employee_id in path:
            state[employee_id] = black
    return None


def _pass6_connected(employees: Sequence[Employee]) -> DomainError | None:
    tree = build_tree(employees)
    reachable_ids: set[str] = set()
    pending_ids = [tree.root_id]

    while pending_ids:
        employee_id = pending_ids.pop()
        if employee_id in reachable_ids:
            continue
        reachable_ids.add(employee_id)
        pending_ids.extend(tree.children_by_id[employee_id])

    if len(reachable_ids) != len(employees):
        unreachable_ids = [
            employee.employee_id
            for employee in employees
            if employee.employee_id not in reachable_ids
        ]
        return DomainError(
            MANAGEMENT_CYCLE,
            "Management cycle detected: unreachable employee IDs: "
            f"{', '.join(unreachable_ids)}",
        )
    return None


def _invalid_field(index: int, field: str) -> DomainError:
    return DomainError(INVALID_EMPLOYEE, f"Employee at index {index} has invalid {field}")
