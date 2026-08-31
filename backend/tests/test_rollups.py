from __future__ import annotations

import pytest

from app.data.scenarios import SCENARIOS
from app.domain.models import Employee, Rollup
from app.domain.rollups import (
    RootInvariantError,
    assert_root_invariants,
    calculate_rollups,
)
from app.domain.tree import build_tree
from tests.oracle import INITIAL_ROLLUPS, TOTAL_PAYROLL


def main_department() -> list[Employee]:
    return SCENARIOS["main-12"].employees()


def test_calculate_rollups_gives_leaf_its_own_headcount_and_salary() -> None:
    rollups = calculate_rollups(build_tree(main_department()))

    assert rollups["E1"] == INITIAL_ROLLUPS["E1"]


def test_calculate_rollups_handles_a_solo_department() -> None:
    employees = [Employee("SOLO", "Solo", "Director", 50_000, None)]

    rollups = calculate_rollups(build_tree(employees))

    assert rollups["SOLO"] == Rollup(team_headcount=1, team_payroll=50_000)


@pytest.mark.parametrize(
    ("employee_id", "expected"),
    [
        *INITIAL_ROLLUPS.items(),
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
    rollups["HOD"] = Rollup(team_headcount=11, team_payroll=TOTAL_PAYROLL)

    with pytest.raises(RootInvariantError):
        assert_root_invariants(tree, rollups)
