from __future__ import annotations

import dataclasses
from collections.abc import Sequence
from dataclasses import dataclass

from app.domain.errors import (
    ALREADY_REPORTS_TO_MANAGER,
    MANAGEMENT_CYCLE,
    ROOT_MOVE_FORBIDDEN,
    SELF_MANAGER,
    UNKNOWN_TRANSFER_EMPLOYEE,
    DomainError,
)
from app.domain.models import DepartmentTree, Employee, Rollup
from app.domain.tree import collect_subtree_ids


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


def validate_transfer(
    tree: DepartmentTree, employee_id: str, new_manager_id: str
) -> DomainError | None:
    """Return the first transfer rule violation in the contractual order."""
    by_id = tree.employee_by_id
    if employee_id not in by_id or new_manager_id not in by_id:
        return DomainError(
            UNKNOWN_TRANSFER_EMPLOYEE,
            f"Unknown transfer employee: '{employee_id}' or '{new_manager_id}'",
        )
    if employee_id == tree.root_id:
        return DomainError(
            ROOT_MOVE_FORBIDDEN,
            f"Root employee '{employee_id}' cannot be moved",
        )
    if employee_id == new_manager_id:
        return DomainError(
            SELF_MANAGER,
            f"Employee '{employee_id}' cannot manage itself",
        )
    if by_id[employee_id].manager_id == new_manager_id:
        return DomainError(
            ALREADY_REPORTS_TO_MANAGER,
            f"Employee '{employee_id}' already reports to '{new_manager_id}'",
        )
    if new_manager_id in collect_subtree_ids(tree, employee_id):
        return DomainError(
            MANAGEMENT_CYCLE,
            f"Transfer would create a management cycle: '{employee_id}' -> '{new_manager_id}'",
        )
    return None


def apply_transfer(
    employees: Sequence[Employee], employee_id: str, new_manager_id: str
) -> list[Employee]:
    """Return a source-order-preserving candidate with one manager replacement."""
    return [
        dataclasses.replace(employee, manager_id=new_manager_id)
        if employee.employee_id == employee_id
        else employee
        for employee in employees
    ]


def diff_rollups(
    employees: Sequence[Employee], before: dict[str, Rollup], after: dict[str, Rollup]
) -> list[str]:
    """Return source-ordered IDs whose complete-team values changed exactly."""
    return [
        employee.employee_id
        for employee in employees
        if (
            before[employee.employee_id].team_headcount
            != after[employee.employee_id].team_headcount
            or before[employee.employee_id].team_payroll
            != after[employee.employee_id].team_payroll
        )
    ]
