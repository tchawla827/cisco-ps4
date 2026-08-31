from __future__ import annotations

from app.data.scenarios import SCENARIOS
from app.domain.models import Employee
from app.domain.tree import build_tree, collect_subtree_ids
from tests.oracle import MOVED_SUBTREE_IDS


def main_department() -> list[Employee]:
    return SCENARIOS["main-12"].employees()


def test_build_tree_preserves_report_source_order_when_manager_is_declared_later() -> None:
    employees = [
        Employee("REPORT_Z", "Zed", "Developer", 40_000, "MANAGER"),
        Employee("REPORT_A", "Ada", "Developer", 41_000, "MANAGER"),
        Employee("MANAGER", "Manager", "Lead", 80_000, "ROOT"),
        Employee("ROOT", "Root", "Head", 120_000, None),
    ]

    tree = build_tree(employees)

    assert tree.root_id == "ROOT"
    assert tree.children_by_id["MANAGER"] == ["REPORT_Z", "REPORT_A"]
    assert tree.children_by_id["ROOT"] == ["MANAGER"]


def test_build_tree_creates_source_ordered_children_entries_for_every_employee() -> None:
    tree = build_tree(main_department())

    assert tree.children_by_id == {
        "HOD": ["MGR_A", "MGR_B", "MGR_C"],
        "MGR_A": ["LEAD_A", "E3"],
        "MGR_B": ["LEAD_B", "E5"],
        "MGR_C": ["E6"],
        "LEAD_A": ["E1", "E2"],
        "LEAD_B": ["E4"],
        "E1": [],
        "E2": [],
        "E3": [],
        "E4": [],
        "E5": [],
        "E6": [],
    }


def test_collect_subtree_ids_includes_self_and_visits_in_preorder() -> None:
    tree = build_tree(main_department())

    assert collect_subtree_ids(tree, "LEAD_A") == MOVED_SUBTREE_IDS
