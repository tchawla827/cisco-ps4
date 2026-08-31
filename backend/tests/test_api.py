from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.domain.rollups import RootInvariantError


@pytest.fixture
def client() -> TestClient:
    from app.api.department import department_service
    from app.main import app

    department_service.__init__()
    with TestClient(app) as test_client:
        yield test_client
    department_service.__init__()


def assert_error(response, status_code: int, code: str) -> None:
    assert response.status_code == status_code
    payload = response.json()
    assert set(payload) == {"error"}
    assert payload["error"]["code"] == code
    assert isinstance(payload["error"]["message"], str)


def load_main(client: TestClient) -> dict:
    response = client.post("/api/department/load", json={"scenario": "main-12"})
    assert response.status_code == 200
    return response.json()


def test_scenarios_exposes_transport_views_in_registry_order(client: TestClient) -> None:
    response = client.get("/api/scenarios")

    assert response.status_code == 200
    scenarios = response.json()
    assert [scenario["key"] for scenario in scenarios] == [
        "main-12",
        "solo-1",
        "invalid-duplicate-id",
        "invalid-unknown-manager",
        "invalid-cycle",
        "invalid-precedence",
    ]
    assert set(scenarios[0]) == {"key", "label", "kind", "description"}


def test_get_department_before_load_returns_exact_no_department_error(client: TestClient) -> None:
    assert_error(client.get("/api/department"), 409, "NO_DEPARTMENT_LOADED")


def test_load_main_returns_source_order_and_root_rollup(client: TestClient) -> None:
    department = load_main(client)

    assert department["scenario"] == "main-12"
    assert department["root_id"] == "HOD"
    assert [employee["employee_id"] for employee in department["employees"]] == [
        "HOD",
        "MGR_A",
        "MGR_B",
        "MGR_C",
        "LEAD_A",
        "LEAD_B",
        "E1",
        "E2",
        "E3",
        "E4",
        "E5",
        "E6",
    ]
    assert department["employees"][0]["team_headcount"] == 12
    assert department["employees"][0]["team_payroll"] == 821_000
    assert department["totals"] == {"employee_count": 12, "total_payroll": 821_000}
    assert department["last_successful_transfer"] is None


def test_load_defaults_to_main_scenario(client: TestClient) -> None:
    response = client.post("/api/department/load", json={})

    assert response.status_code == 200
    assert response.json()["scenario"] == "main-12"


def test_load_solo_returns_single_person_rollup(client: TestClient) -> None:
    response = client.post("/api/department/load", json={"scenario": "solo-1"})

    assert response.status_code == 200
    department = response.json()
    assert department["employees"][0]["team_headcount"] == 1
    assert department["employees"][0]["team_payroll"] == 50_000


@pytest.mark.parametrize(
    ("scenario", "code"),
    [
        ("invalid-duplicate-id", "DUPLICATE_EMPLOYEE_ID"),
        ("invalid-unknown-manager", "UNKNOWN_MANAGER"),
        ("invalid-cycle", "MANAGEMENT_CYCLE"),
        ("invalid-precedence", "DUPLICATE_EMPLOYEE_ID"),
        ("missing", "UNKNOWN_SCENARIO"),
    ],
)
def test_invalid_load_returns_domain_error_and_clears_state(
    client: TestClient, scenario: str, code: str
) -> None:
    load_main(client)

    response = client.post("/api/department/load", json={"scenario": scenario})

    assert_error(response, 400, code)
    assert_error(client.get("/api/department"), 409, "NO_DEPARTMENT_LOADED")


def test_valid_transfer_returns_department_and_oracle_impact(client: TestClient) -> None:
    load_main(client)

    response = client.post(
        "/api/department/transfer",
        json={"employee_id": "LEAD_A", "new_manager_id": "MGR_C"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == {"department", "impact"}
    impact = payload["impact"]
    assert impact["employee_id"] == "LEAD_A"
    assert impact["employee_name"] == "Noah Williams"
    assert impact["old_manager_id"] == "MGR_A"
    assert impact["new_manager_id"] == "MGR_C"
    assert impact["moved_subtree_ids"] == ["LEAD_A", "E1", "E2"]
    assert impact["moved_headcount"] == 3
    assert impact["moved_payroll"] == 145_000
    assert impact["changed_rollup_ids"] == ["MGR_A", "MGR_C"]
    assert impact["root_unchanged"] is True
    assert impact["changes"] == [
        {
            "employee_id": "MGR_A",
            "name": "Daniel Ortiz",
            "role": "Programme Manager",
            "before": {"team_headcount": 5, "team_payroll": 282_000},
            "after": {"team_headcount": 2, "team_payroll": 137_000},
        },
        {
            "employee_id": "MGR_C",
            "name": "Priya Shah",
            "role": "Operations Manager",
            "before": {"team_headcount": 2, "team_payroll": 117_000},
            "after": {"team_headcount": 5, "team_payroll": 262_000},
        },
    ]
    assert payload["department"]["last_successful_transfer"] == impact


def test_rejected_cycle_is_atomic_and_retains_last_successful_transfer(
    client: TestClient,
) -> None:
    load_main(client)
    valid = client.post(
        "/api/department/transfer",
        json={"employee_id": "LEAD_A", "new_manager_id": "MGR_C"},
    )
    assert valid.status_code == 200
    before = client.get("/api/department")
    assert before.status_code == 200

    rejected = client.post(
        "/api/department/transfer",
        json={"employee_id": "MGR_A", "new_manager_id": "E3"},
    )

    assert_error(rejected, 400, "MANAGEMENT_CYCLE")
    after = client.get("/api/department")
    assert after.content == before.content
    assert after.json()["last_successful_transfer"] == valid.json()["impact"]


def test_root_transfer_is_rejected(client: TestClient) -> None:
    load_main(client)

    response = client.post(
        "/api/department/transfer",
        json={"employee_id": "HOD", "new_manager_id": "MGR_A"},
    )

    assert_error(response, 400, "ROOT_MOVE_FORBIDDEN")


def test_preview_returns_impact_without_mutating_department(client: TestClient) -> None:
    before = load_main(client)

    response = client.post(
        "/api/department/transfer/preview",
        json={"employee_id": "LEAD_A", "new_manager_id": "MGR_C"},
    )

    assert response.status_code == 200
    assert set(response.json()) == {"impact"}
    assert response.json()["impact"]["changed_rollup_ids"] == ["MGR_A", "MGR_C"]
    after = client.get("/api/department")
    assert after.status_code == 200
    assert after.json() == before
    assert after.json()["last_successful_transfer"] is None


def test_reset_restores_initial_state_and_reapplication_is_deterministic(
    client: TestClient,
) -> None:
    initial = load_main(client)
    first_transfer = client.post(
        "/api/department/transfer",
        json={"employee_id": "LEAD_A", "new_manager_id": "MGR_C"},
    )
    assert first_transfer.status_code == 200

    reset = client.post("/api/department/reset")

    assert reset.status_code == 200
    assert reset.json() == initial
    second_transfer = client.post(
        "/api/department/transfer",
        json={"employee_id": "LEAD_A", "new_manager_id": "MGR_C"},
    )
    assert second_transfer.status_code == 200
    assert second_transfer.json()["impact"] == first_transfer.json()["impact"]


def test_reset_without_department_returns_no_department_error(client: TestClient) -> None:
    assert_error(client.post("/api/department/reset"), 409, "NO_DEPARTMENT_LOADED")


def test_root_invariant_failure_surfaces_as_internal_server_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.api.department import department_service
    from app.main import app

    department_service.__init__()
    try:
        department_service.load("main-12")

        def raise_root_invariant_error(employee_id: str, new_manager_id: str) -> None:
            raise RootInvariantError("forced test invariant failure")

        monkeypatch.setattr(department_service, "transfer", raise_root_invariant_error)
        with TestClient(app, raise_server_exceptions=False) as test_client:
            response = test_client.post(
                "/api/department/transfer",
                json={"employee_id": "LEAD_A", "new_manager_id": "MGR_C"},
            )

        assert response.status_code == 500
    finally:
        department_service.__init__()


def test_cors_only_allows_configured_vite_origins(client: TestClient) -> None:
    allowed = client.options(
        "/api/department",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    denied = client.options(
        "/api/department",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in denied.headers


def test_add_employee_appends_and_returns_updated_department(client: TestClient) -> None:
    load_main(client)

    response = client.post(
        "/api/department/employees",
        json={
            "employee_id": "E7",
            "name": "New Hire",
            "role": "IC",
            "monthly_salary": 40_000,
            "manager_id": "LEAD_A",
        },
    )

    assert response.status_code == 200
    department = response.json()
    assert department["employees"][-1]["employee_id"] == "E7"
    assert department["totals"]["employee_count"] == 13
    assert department["totals"]["total_payroll"] == 821_000 + 40_000


def test_add_employee_rejects_unknown_manager(client: TestClient) -> None:
    load_main(client)

    response = client.post(
        "/api/department/employees",
        json={
            "employee_id": "E7",
            "name": "New Hire",
            "role": "IC",
            "monthly_salary": 40_000,
            "manager_id": "MISSING",
        },
    )

    assert_error(response, 400, "UNKNOWN_MANAGER")


def test_add_employee_before_load_returns_no_department_error(client: TestClient) -> None:
    response = client.post(
        "/api/department/employees",
        json={
            "employee_id": "E7",
            "name": "New Hire",
            "role": "IC",
            "monthly_salary": 40_000,
            "manager_id": "LEAD_A",
        },
    )

    assert_error(response, 409, "NO_DEPARTMENT_LOADED")


def test_delete_employee_removes_leaf_and_returns_updated_department(client: TestClient) -> None:
    load_main(client)

    response = client.delete("/api/department/employees/E1")

    assert response.status_code == 200
    department = response.json()
    assert "E1" not in [employee["employee_id"] for employee in department["employees"]]
    assert department["totals"]["employee_count"] == 11


def test_delete_employee_blocked_when_target_has_direct_reports(client: TestClient) -> None:
    load_main(client)

    response = client.delete("/api/department/employees/MGR_A")

    assert_error(response, 400, "EMPLOYEE_HAS_DIRECT_REPORTS")


def test_delete_employee_blocked_for_root(client: TestClient) -> None:
    load_main(client)

    response = client.delete("/api/department/employees/HOD")

    assert_error(response, 400, "ROOT_DELETE_FORBIDDEN")


def test_delete_employee_before_load_returns_no_department_error(client: TestClient) -> None:
    response = client.delete("/api/department/employees/E1")

    assert_error(response, 409, "NO_DEPARTMENT_LOADED")
