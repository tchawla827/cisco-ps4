from __future__ import annotations

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
