# Testing

## Testing Strategy

The project has automated backend domain/service/API tests and focused frontend component/API-client tests. The main demo was also exercised against the running application; historical walkthrough evidence is in `docs/TEST_EVIDENCE.md`. This document reports the fresh automated checks run from this checkout.

## Automated Tests

```sh
cd backend && .venv/bin/pytest -q
# 108 passed in 0.30s

cd frontend && npm run test -- --run
# 8 files passed; 38 tests passed

cd frontend && npm run build && npm run lint
# both exit 0; lint reports one Fast Refresh warning
```

Backend tests cover pure validation, tree construction, rollups, transfers, roster rules, service state, API responses, and the rule that production code cannot import the test oracle. Frontend tests cover the API client, application states, tree layout/drop resolution, comparison, collapse controls, and roster interactions.

## Important Test Cases

| Scenario | Expected behaviour | Result |
| -------- | ------------------ | ------ |
| Load `main-12` | Source order, root, and INR 821,000 total payroll are returned | Passed |
| Invalid field or duplicate ID | Defined first validation error is returned | Passed |
| Unknown manager or management cycle | Load is rejected and loaded state is cleared | Passed |
| Valid `LEAD_A → MGR_C` transfer | Candidate commits; exact changed rollups are `MGR_A`, `MGR_C` | Passed |
| `MGR_A → E3` | Cycle is rejected without changing current state or last impact | Passed |
| Root transfer | `ROOT_MOVE_FORBIDDEN` is returned | Passed |
| Transfer preview | Impact is returned without committing state | Passed |
| Reset then repeat transfer | Initial state returns and the result is deterministic | Passed |
| Add employee / delete leaf | Candidate is validated and rollups are recomputed | Passed |
| Delete root or manager with reports | Request is rejected with a specific error | Passed |

## Known Limitations

- There is no database, multi-user isolation, or restart persistence to integration-test.
- The browser tests are focused component/API-client tests; they do not replace a full browser suite for every pan, zoom, and drag path.
- The current lint command exits successfully with one warning because `OrgTreeCanvas.tsx` exports a helper alongside its component.
