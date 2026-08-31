from __future__ import annotations

from app.data.scenarios import SCENARIOS
from app.domain.validation import validate_department
from tests.oracle import INITIAL_ROLLUPS, TOTAL_PAYROLL


def test_main_scenario_has_the_required_source_order_and_operational_inputs() -> None:
    employees = SCENARIOS["main-12"].employees()

    assert [(employee.employee_id, employee.role, employee.monthly_salary, employee.manager_id) for employee in employees] == [
        ("HOD", "Department Head", 200_000, None),
        ("MGR_A", "Programme Manager", 90_000, "HOD"),
        ("MGR_B", "Laboratory Manager", 85_000, "HOD"),
        ("MGR_C", "Operations Manager", 78_000, "HOD"),
        ("LEAD_A", "Project Lead", 65_000, "MGR_A"),
        ("LEAD_B", "Research Lead", 60_000, "MGR_B"),
        ("E1", "Developer", 42_000, "LEAD_A"),
        ("E2", "Developer", 38_000, "LEAD_A"),
        ("E3", "Designer", 47_000, "MGR_A"),
        ("E4", "Analyst", 41_000, "LEAD_B"),
        ("E5", "Technician", 36_000, "MGR_B"),
        ("E6", "Coordinator", 39_000, "MGR_C"),
    ]
    assert sum(employee.monthly_salary for employee in employees) == TOTAL_PAYROLL
    assert len(INITIAL_ROLLUPS) == len(employees)


def test_each_scenario_returns_a_fresh_employee_list() -> None:
    scenario = SCENARIOS["main-12"]

    first = scenario.employees()
    second = scenario.employees()
    first.pop()

    assert first is not second
    assert len(first) == 11
    assert len(second) == 12


def test_scenarios_exercise_the_specified_validation_outcomes() -> None:
    expected_codes = {
        "solo-1": None,
        "invalid-duplicate-id": "DUPLICATE_EMPLOYEE_ID",
        "invalid-unknown-manager": "UNKNOWN_MANAGER",
        "invalid-cycle": "MANAGEMENT_CYCLE",
        "invalid-precedence": "DUPLICATE_EMPLOYEE_ID",
    }

    for key, expected_code in expected_codes.items():
        error = validate_department(SCENARIOS[key].employees())
        assert (None if error is None else error.code) == expected_code
