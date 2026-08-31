from __future__ import annotations

from app.domain.errors import MANAGEMENT_CYCLE
from app.domain.transfer import TransferImpact
from app.services.department_service import DepartmentService, DepartmentState
from tests.oracle import (
    CHANGED_IDS,
    INITIAL_ROLLUPS,
    MOVED_HEADCOUNT,
    MOVED_PAYROLL,
    MOVED_SUBTREE_IDS,
    POST_TRANSFER_ROLLUPS,
)


def assert_state(service: DepartmentService) -> DepartmentState:
    state = service.get_state()
    assert isinstance(state, DepartmentState)
    return state


def assert_impact_matches_oracle(impact: TransferImpact) -> None:
    assert impact.employee_id == "LEAD_A"
    assert impact.old_manager_id == "MGR_A"
    assert impact.new_manager_id == "MGR_C"
    assert impact.changed_rollup_ids == CHANGED_IDS
    assert impact.moved_subtree_ids == MOVED_SUBTREE_IDS
    assert impact.moved_headcount == MOVED_HEADCOUNT
    assert impact.moved_payroll == MOVED_PAYROLL


def test_load_main_scenario_returns_initial_derived_state() -> None:
    service = DepartmentService()

    result = service.load("main-12")

    assert isinstance(result, DepartmentState)
    assert result.scenario_key == "main-12"
    assert [employee.employee_id for employee in result.employees] == list(INITIAL_ROLLUPS)
    assert result.rollups == INITIAL_ROLLUPS
    assert result.last_successful_transfer is None


def test_valid_transfer_commits_candidate_and_records_oracle_impact() -> None:
    service = DepartmentService()
    service.load("main-12")

    result = service.transfer("LEAD_A", "MGR_C")

    assert isinstance(result, TransferImpact)
    assert_impact_matches_oracle(result)
    state = assert_state(service)
    assert state.rollups == POST_TRANSFER_ROLLUPS
    assert state.last_successful_transfer == result


def test_rejected_cycle_transfer_preserves_every_service_field_and_last_impact() -> None:
    service = DepartmentService()
    service.load("main-12")
    impact = service.transfer("LEAD_A", "MGR_C")
    assert isinstance(impact, TransferImpact)
    fields_before = (
        service._original_employees,
        service._current_employees,
        service._last_successful_transfer,
        service._loaded_scenario,
    )

    error = service.transfer("MGR_A", "E3")

    assert getattr(error, "code", None) == MANAGEMENT_CYCLE
    assert all(
        after is before
        for after, before in zip(
            (
                service._original_employees,
                service._current_employees,
                service._last_successful_transfer,
                service._loaded_scenario,
            ),
            fields_before,
        )
    )
    assert assert_state(service).last_successful_transfer == impact


def test_preview_returns_impact_without_assigning_any_service_state() -> None:
    service = DepartmentService()
    service.load("main-12")
    fields_before = (
        service._original_employees,
        service._current_employees,
        service._last_successful_transfer,
        service._loaded_scenario,
    )

    preview = service.preview("LEAD_A", "MGR_C")

    assert isinstance(preview, TransferImpact)
    assert_impact_matches_oracle(preview)
    assert all(
        after is before
        for after, before in zip(
            (
                service._original_employees,
                service._current_employees,
                service._last_successful_transfer,
                service._loaded_scenario,
            ),
            fields_before,
        )
    )
    assert assert_state(service).rollups == INITIAL_ROLLUPS


def test_reset_restores_a_fresh_original_copy_and_clears_impact() -> None:
    service = DepartmentService()
    service.load("main-12")
    service.transfer("LEAD_A", "MGR_C")
    original = service._original_employees

    result = service.reset()

    assert isinstance(result, DepartmentState)
    assert service._current_employees is not original
    assert result.rollups == INITIAL_ROLLUPS
    assert result.last_successful_transfer is None


def test_invalid_load_uses_precedence_and_clears_all_state() -> None:
    service = DepartmentService()
    service.load("main-12")
    service.transfer("LEAD_A", "MGR_C")

    error = service.load("invalid-precedence")

    assert getattr(error, "code", None) == "DUPLICATE_EMPLOYEE_ID"
    assert service.get_state() is None
    assert service._original_employees is None
    assert service._current_employees is None
    assert service._last_successful_transfer is None
    assert service._loaded_scenario is None


def test_unknown_scenario_clears_existing_state() -> None:
    service = DepartmentService()
    service.load("main-12")

    error = service.load("missing")

    assert getattr(error, "code", None) == "UNKNOWN_SCENARIO"
    assert service.get_state() is None
    assert service._original_employees is None
    assert service._current_employees is None
    assert service._last_successful_transfer is None
    assert service._loaded_scenario is None


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
