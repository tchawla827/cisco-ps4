from __future__ import annotations

from dataclasses import replace

import pytest

from app.domain.errors import (
    ALREADY_REPORTS_TO_MANAGER,
    MANAGEMENT_CYCLE,
    ROOT_MOVE_FORBIDDEN,
    SELF_MANAGER,
    UNKNOWN_TRANSFER_EMPLOYEE,
)
from app.domain.models import Employee, Rollup
from app.domain.rollups import calculate_rollups
from app.domain.transfer import (
    RollupChange,
    TransferImpact,
    apply_transfer,
    diff_rollups,
    validate_transfer,
)
from app.domain.tree import build_tree, collect_subtree_ids


def main_department() -> list[Employee]:
    return [
        Employee("HOD", "Head", "Department Head", 200_000, None),
        Employee("MGR_A", "A Manager", "Programme Manager", 90_000, "HOD"),
        Employee("MGR_B", "B Manager", "Laboratory Manager", 85_000, "HOD"),
        Employee("MGR_C", "C Manager", "Operations Manager", 78_000, "HOD"),
        Employee("LEAD_A", "A Lead", "Project Lead", 65_000, "MGR_A"),
        Employee("LEAD_B", "B Lead", "Research Lead", 60_000, "MGR_B"),
        Employee("E1", "Employee 1", "Developer", 42_000, "LEAD_A"),
        Employee("E2", "Employee 2", "Developer", 38_000, "LEAD_A"),
        Employee("E3", "Employee 3", "Designer", 47_000, "MGR_A"),
        Employee("E4", "Employee 4", "Analyst", 41_000, "LEAD_B"),
        Employee("E5", "Employee 5", "Technician", 36_000, "MGR_B"),
        Employee("E6", "Employee 6", "Coordinator", 39_000, "MGR_C"),
    ]


def assert_transfer_error(
    employees: list[Employee], employee_id: str, new_manager_id: str, expected_code: str
) -> None:
    error = validate_transfer(build_tree(employees), employee_id, new_manager_id)

    assert error is not None
    assert error.code == expected_code


@pytest.mark.parametrize(
    ("employee_id", "new_manager_id", "expected_code"),
    [
        ("MISSING", "MGR_A", UNKNOWN_TRANSFER_EMPLOYEE),
        ("HOD", "MGR_A", ROOT_MOVE_FORBIDDEN),
        ("LEAD_A", "LEAD_A", SELF_MANAGER),
        ("E1", "LEAD_A", ALREADY_REPORTS_TO_MANAGER),
        ("MGR_A", "E3", MANAGEMENT_CYCLE),
    ],
)
def test_validate_transfer_rejects_each_transfer_rule(
    employee_id: str, new_manager_id: str, expected_code: str
) -> None:
    assert_transfer_error(main_department(), employee_id, new_manager_id, expected_code)


def test_validate_transfer_uses_specified_precedence() -> None:
    employees = main_department()
    self_reporting = [
        *employees[:6],
        replace(employees[6], manager_id="E1"),
        *employees[7:],
    ]

    assert_transfer_error(employees, "HOD", "E1", ROOT_MOVE_FORBIDDEN)
    assert_transfer_error(employees, "HOD", "MISSING", UNKNOWN_TRANSFER_EMPLOYEE)
    assert_transfer_error(self_reporting, "E1", "E1", SELF_MANAGER)


def transfer_impact(
    employees: list[Employee], employee_id: str, new_manager_id: str
) -> TransferImpact | object:
    tree = build_tree(employees)
    before = calculate_rollups(tree)
    error = validate_transfer(tree, employee_id, new_manager_id)
    if error is not None:
        return error

    moved_subtree_ids = collect_subtree_ids(tree, employee_id)
    candidate = apply_transfer(employees, employee_id, new_manager_id)
    after = calculate_rollups(build_tree(candidate))
    changed_rollup_ids = diff_rollups(employees, before, after)

    return TransferImpact(
        employee_id=employee_id,
        old_manager_id=tree.employee_by_id[employee_id].manager_id,
        new_manager_id=new_manager_id,
        moved_subtree_ids=moved_subtree_ids,
        moved_headcount=before[employee_id].team_headcount,
        moved_payroll=before[employee_id].team_payroll,
        changed_rollup_ids=changed_rollup_ids,
        changes=[
            RollupChange(employee_id, before[employee_id], after[employee_id])
            for employee_id in changed_rollup_ids
        ],
        root_unchanged=before[tree.root_id] == after[tree.root_id],
    )


def test_oracle_transfer_produces_the_documented_impact_and_rollups() -> None:
    employees = main_department()
    before = calculate_rollups(build_tree(employees))
    impact = transfer_impact(employees, "LEAD_A", "MGR_C")
    after = calculate_rollups(build_tree(apply_transfer(employees, "LEAD_A", "MGR_C")))

    assert isinstance(impact, TransferImpact)
    assert after == {
        "HOD": Rollup(12, 821_000),
        "MGR_A": Rollup(2, 137_000),
        "MGR_B": Rollup(4, 222_000),
        "MGR_C": Rollup(5, 262_000),
        "LEAD_A": Rollup(3, 145_000),
        "LEAD_B": Rollup(2, 101_000),
        "E1": Rollup(1, 42_000),
        "E2": Rollup(1, 38_000),
        "E3": Rollup(1, 47_000),
        "E4": Rollup(1, 41_000),
        "E5": Rollup(1, 36_000),
        "E6": Rollup(1, 39_000),
    }
    assert impact.changed_rollup_ids == ["MGR_A", "MGR_C"]
    assert "HOD" not in impact.changed_rollup_ids
    assert impact.changes == [
        RollupChange("MGR_A", before["MGR_A"], after["MGR_A"]),
        RollupChange("MGR_C", before["MGR_C"], after["MGR_C"]),
    ]
    assert impact.moved_subtree_ids == ["LEAD_A", "E1", "E2"]
    assert impact.moved_headcount == 3
    assert impact.moved_payroll == 145_000
    assert after["HOD"] == Rollup(12, 821_000)
    assert impact.root_unchanged is True


def test_apply_transfer_replaces_only_the_moved_employee_and_preserves_inputs() -> None:
    employees = main_department()
    original = list(employees)

    transferred = apply_transfer(employees, "LEAD_A", "MGR_C")

    assert employees == original
    assert transferred is not employees
    assert [employee.employee_id for employee in transferred] == [
        employee.employee_id for employee in original
    ]
    assert len(transferred) == len(original)
    assert [
        index for index, (before, after) in enumerate(zip(original, transferred)) if before is not after
    ] == [4]
    assert transferred[4] == replace(original[4], manager_id="MGR_C")
    assert original[4].manager_id == "MGR_A"
    assert [employee.manager_id for employee in transferred if employee.employee_id in {"E1", "E2"}] == [
        "LEAD_A",
        "LEAD_A",
    ]
    assert [employee.monthly_salary for employee in transferred] == [
        employee.monthly_salary for employee in original
    ]


def test_rebuilt_tree_preserves_source_order_for_transfer_siblings() -> None:
    tree = build_tree(apply_transfer(main_department(), "LEAD_A", "MGR_C"))

    assert tree.children_by_id["MGR_C"] == ["LEAD_A", "E6"]
    assert tree.children_by_id["MGR_A"] == ["E3"]


def test_rejected_cycle_transfer_is_atomic() -> None:
    employees = main_department()
    tree = build_tree(employees)
    rollups = calculate_rollups(tree)
    employees_snapshot = list(employees)
    rollups_snapshot = dict(rollups)

    error = validate_transfer(tree, "MGR_A", "E3")

    assert error is not None
    assert error.code == MANAGEMENT_CYCLE
    assert employees == employees_snapshot
    assert rollups == rollups_snapshot


def test_transfer_impact_is_deterministic_after_reset() -> None:
    original = main_department()

    first = transfer_impact(original, "LEAD_A", "MGR_C")
    reset = list(original)
    second = transfer_impact(reset, "LEAD_A", "MGR_C")

    assert isinstance(first, TransferImpact)
    assert first == second
