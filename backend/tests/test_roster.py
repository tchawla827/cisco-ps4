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

    error = validate_delete(tree, "SOLO")

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
