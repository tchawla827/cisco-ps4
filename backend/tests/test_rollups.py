from __future__ import annotations

import pytest

from app.domain.models import Employee, Rollup
from app.domain.rollups import (
    RootInvariantError,
    assert_root_invariants,
    calculate_rollups,
)
from app.domain.tree import build_tree


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


def test_calculate_rollups_gives_leaf_its_own_headcount_and_salary() -> None:
    rollups = calculate_rollups(build_tree(main_department()))

    assert rollups["E1"] == Rollup(team_headcount=1, team_payroll=42_000)


def test_calculate_rollups_handles_a_solo_department() -> None:
    employees = [Employee("SOLO", "Solo", "Director", 50_000, None)]

    rollups = calculate_rollups(build_tree(employees))

    assert rollups["SOLO"] == Rollup(team_headcount=1, team_payroll=50_000)


@pytest.mark.parametrize(
    ("employee_id", "expected"),
    [
        ("HOD", Rollup(12, 821_000)),
        ("MGR_A", Rollup(5, 282_000)),
        ("MGR_B", Rollup(4, 222_000)),
        ("MGR_C", Rollup(2, 117_000)),
        ("LEAD_A", Rollup(3, 145_000)),
        ("LEAD_B", Rollup(2, 101_000)),
        ("E1", Rollup(1, 42_000)),
        ("E2", Rollup(1, 38_000)),
        ("E3", Rollup(1, 47_000)),
        ("E4", Rollup(1, 41_000)),
        ("E5", Rollup(1, 36_000)),
        ("E6", Rollup(1, 39_000)),
    ],
)
def test_calculate_rollups_matches_each_initial_oracle_row(
    employee_id: str, expected: Rollup
) -> None:
    rollups = calculate_rollups(build_tree(main_department()))

    assert rollups[employee_id] == expected


def test_assert_root_invariants_accepts_complete_rollups() -> None:
    tree = build_tree(main_department())

    assert_root_invariants(tree, calculate_rollups(tree))


def test_assert_root_invariants_rejects_a_corrupted_root_rollup() -> None:
    tree = build_tree(main_department())
    rollups = calculate_rollups(tree)
    rollups["HOD"] = Rollup(team_headcount=11, team_payroll=821_000)

    with pytest.raises(RootInvariantError):
        assert_root_invariants(tree, rollups)
