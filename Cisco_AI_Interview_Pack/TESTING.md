# Testing

The testing strategy follows the architecture: most correctness is in the backend domain layer, so that is where most of the coverage sits. Frontend tests are focused on API integration and important interaction states, with a live browser walkthrough for visual behaviour.

## Current Verification

```bash
cd backend && .venv/bin/pytest -q
# 108 passed

cd frontend && npm run test -- --run
# 38 passed

cd frontend && npm run build
# passed

cd frontend && npm run lint
# exit 0; one Fast Refresh warning
```

## Important Cases

| Scenario | Expected behaviour | Result |
| --- | --- | --- |
| Load `main-12` | Root has 12 employees and INR 821,000 payroll | Passed |
| Invalid employee / duplicate ID | Defined first validation error is returned | Passed |
| Unknown manager / management cycle | Load is rejected | Passed |
| Valid `LEAD_A -> MGR_C` | Candidate commits successfully | Passed |
| Exact impact | Only `MGR_A` and `MGR_C` rollups change | Passed |
| `MGR_A -> E3` | Cycle is rejected | Passed |
| Root transfer | `ROOT_MOVE_FORBIDDEN` is returned | Passed |
| Rejected transfer | Current state and previous successful impact remain unchanged | Passed |
| Transfer preview | Impact is returned without committing state | Passed |
| Reset + reapply | Original state returns and the same transfer gives the same result | Passed |
| Add employee / delete leaf | Candidate is validated and rollups are recomputed | Passed |
| Delete root / manager with reports | Request is rejected | Passed |

## Independent Expected Results

The main dataset was checked against a separate expected-results oracle rather than using production functions to generate their own expected values.

Important values:

- root: 12 employees, INR 821,000;
- `LEAD_A` subtree: 3 employees, INR 145,000;
- before transfer: `MGR_A` = 5 / INR 282,000;
- before transfer: `MGR_C` = 2 / INR 117,000;
- after `LEAD_A -> MGR_C`: `MGR_A` = 2 / INR 137,000;
- after `LEAD_A -> MGR_C`: `MGR_C` = 5 / INR 262,000;
- changed rollups: `MGR_A`, `MGR_C`;
- root remains 12 / INR 821,000.

## Browser Verification

The application was also exercised as a running system.

This caught one issue that the automated tests did not: after the frontend layout revamp, the organisation chart existed in the DOM but had no visible height because its wrapper was missing a flex-container rule.

After the narrow CSS fix, the visible tree, drag interaction, valid transfer, invalid cycle transfer, add/delete flow, and reset were rechecked.

## Known Limitations

- State is process-local; there is no persistence or user isolation.
- There is no production concurrency model or audit history.
- Frontend automated coverage is focused; it is not a full browser E2E suite for every pan/zoom/drag path.
- Lint exits successfully with one Fast Refresh warning because `OrgTreeCanvas.tsx` exports a helper alongside the component.
