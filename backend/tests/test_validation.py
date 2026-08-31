from __future__ import annotations

import pytest

from app.domain.errors import (
    DUPLICATE_EMPLOYEE_ID,
    INVALID_EMPLOYEE,
    INVALID_ROOT_COUNT,
    MANAGEMENT_CYCLE,
    SELF_MANAGER,
    UNKNOWN_MANAGER,
)
from app.domain.models import Employee
from app.domain.validation import validate_department


def employee(
    employee_id: object = "ROOT",
    name: object = "Root Employee",
    role: object = "Chief Executive",
    monthly_salary: object = 100_000,
    manager_id: object = None,
) -> Employee:
    return Employee(  # type: ignore[arg-type]
        employee_id=employee_id,
        name=name,
        role=role,
        monthly_salary=monthly_salary,
        manager_id=manager_id,
    )


def assert_error(employees: list[Employee], code: str, message: str) -> None:
    result = validate_department(employees)
    assert result is not None
    assert result.code == code
    assert result.message == message


@pytest.mark.parametrize(
    ("invalid_employee", "field"),
    [
        (employee(employee_id="bad"), "employee_id"),
        (employee(name="   "), "name"),
        (employee(role="\t"), "role"),
        (employee(monthly_salary=0), "monthly_salary"),
        (employee(monthly_salary=1_000_001), "monthly_salary"),
        (employee(monthly_salary=True), "monthly_salary"),
        (employee(monthly_salary="40000"), "monthly_salary"),
    ],
)
def test_rejects_invalid_employee_fields(invalid_employee: Employee, field: str) -> None:
    assert_error(
        [invalid_employee],
        INVALID_EMPLOYEE,
        f"Employee at index 0 has invalid {field}",
    )


def test_rejects_empty_department() -> None:
    assert_error(
        [],
        INVALID_EMPLOYEE,
        "Department must contain 1-30 employees; got 0",
    )


def test_accepts_one_employee_department() -> None:
    assert validate_department([employee()]) is None


def test_accepts_thirty_employee_department() -> None:
    employees = [employee("ROOT")]
    employees.extend(
        employee(f"E{index}", manager_id="ROOT") for index in range(1, 30)
    )

    assert validate_department(employees) is None


def test_rejects_thirty_one_employee_department() -> None:
    employees = [employee("ROOT")]
    employees.extend(
        employee(f"E{index}", manager_id="ROOT") for index in range(1, 31)
    )

    assert_error(
        employees,
        INVALID_EMPLOYEE,
        "Department must contain 1-30 employees; got 31",
    )


def test_rejects_duplicate_employee_id() -> None:
    assert_error(
        [employee("ROOT"), employee("ROOT", manager_id="ROOT")],
        DUPLICATE_EMPLOYEE_ID,
        "Duplicate employee_id 'ROOT' at record positions 0 and 1",
    )


@pytest.mark.parametrize(
    ("employees", "message"),
    [
        (
            [employee("ONE", manager_id="TWO"), employee("TWO", manager_id="ONE")],
            "Expected exactly one root; found 0: []",
        ),
        (
            [employee("ONE"), employee("TWO")],
            "Expected exactly one root; found 2: ['ONE', 'TWO']",
        ),
    ],
)
def test_rejects_invalid_root_count(employees: list[Employee], message: str) -> None:
    assert_error(employees, INVALID_ROOT_COUNT, message)


def test_rejects_self_manager() -> None:
    assert_error(
        [employee("ROOT"), employee("SELF", manager_id="SELF")],
        SELF_MANAGER,
        "Employee at index 1 cannot manage itself: 'SELF'",
    )


def test_rejects_unknown_manager() -> None:
    assert_error(
        [employee("ROOT"), employee("REPORT", manager_id="MISSING")],
        UNKNOWN_MANAGER,
        "Employee at index 1 references unknown manager 'MISSING'",
    )


def test_rejects_management_cycle() -> None:
    assert_error(
        [
            employee("ROOT"),
            employee("A", manager_id="B"),
            employee("B", manager_id="A"),
        ],
        MANAGEMENT_CYCLE,
        "Management cycle detected: A -> B -> A",
    )


def test_bad_field_wins_over_duplicate_id() -> None:
    assert_error(
        [employee("bad"), employee("bad", manager_id="bad")],
        INVALID_EMPLOYEE,
        "Employee at index 0 has invalid employee_id",
    )


def test_duplicate_id_wins_over_two_roots() -> None:
    assert_error(
        [employee("ROOT"), employee("ROOT")],
        DUPLICATE_EMPLOYEE_ID,
        "Duplicate employee_id 'ROOT' at record positions 0 and 1",
    )


def test_two_roots_win_over_unknown_manager() -> None:
    assert_error(
        [employee("ROOT"), employee("OTHER"), employee("REPORT", manager_id="MISSING")],
        INVALID_ROOT_COUNT,
        "Expected exactly one root; found 2: ['ROOT', 'OTHER']",
    )


def test_unknown_manager_wins_over_cycle() -> None:
    assert_error(
        [
            employee("ROOT"),
            employee("UNKNOWN", manager_id="MISSING"),
            employee("A", manager_id="B"),
            employee("B", manager_id="A"),
        ],
        UNKNOWN_MANAGER,
        "Employee at index 1 references unknown manager 'MISSING'",
    )


def test_first_unknown_manager_in_source_order_wins() -> None:
    assert_error(
        [
            employee("ROOT"),
            employee("EARLY", manager_id="MISSING_ONE"),
            employee("LATE", manager_id="MISSING_TWO"),
        ],
        UNKNOWN_MANAGER,
        "Employee at index 1 references unknown manager 'MISSING_ONE'",
    )


def test_first_duplicate_employee_id_in_source_order_wins() -> None:
    assert_error(
        [
            employee("ROOT"),
            employee("A", manager_id="ROOT"),
            employee("A", manager_id="ROOT"),
            employee("B", manager_id="ROOT"),
            employee("B", manager_id="ROOT"),
        ],
        DUPLICATE_EMPLOYEE_ID,
        "Duplicate employee_id 'A' at record positions 1 and 2",
    )


def test_first_bad_field_in_source_order_wins() -> None:
    assert_error(
        [employee("ROOT"), employee(name=""), employee(role="")],
        INVALID_EMPLOYEE,
        "Employee at index 1 has invalid name",
    )


def test_unknown_manager_at_record_two_wins_over_later_self_manager() -> None:
    assert_error(
        [
            employee("ROOT"),
            employee("UNKNOWN", manager_id="MISSING"),
            employee("A", manager_id="ROOT"),
            employee("B", manager_id="ROOT"),
            employee("SELF", manager_id="SELF"),
        ],
        UNKNOWN_MANAGER,
        "Employee at index 1 references unknown manager 'MISSING'",
    )


def test_accepts_department_with_managers_after_reports() -> None:
    employees = [
        employee("REPORT", manager_id="MANAGER"),
        employee("ROOT"),
        employee("MANAGER", manager_id="ROOT"),
        employee("LEAF", manager_id="REPORT"),
    ]

    assert validate_department(employees) is None
