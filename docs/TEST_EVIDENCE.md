# Test Evidence

Repeatable commands and results demonstrating the required coverage in
`PRD.md` §19. Fill in the "Result" column as each is run; link to actual
`pytest` output, screenshots, or terminal transcripts as they're produced.

## Backend (`pytest`)

| Scenario | Test file / case | Result |
| --- | --- | --- |
| Leaf rollup | `test_rollups.py` | pending |
| Multi-level rollup | `test_rollups.py` | pending |
| Root invariants | `test_rollups.py` | pending |
| Valid one-employee department | `test_validation.py` | pending |
| Duplicate-ID load failure | `test_validation.py` | pending |
| Unknown-manager / cycle load failure | `test_validation.py` | pending |
| Invalid-load stale-state clearing | `test_api.py` | pending |
| Valid cross-branch transfer (`LEAD_A` → `MGR_C`) | `test_transfer.py` | pending |
| Subtree preservation | `test_transfer.py` | pending |
| Exact `changed_rollup_ids` | `test_transfer.py` | pending |
| Source-order sibling placement after transfer | `test_transfer.py` | pending |
| Cycle prevention (`MGR_A` → `E3`) | `test_transfer.py` | pending |
| Root-move protection | `test_transfer.py` | pending |
| Transfer validation ordering | `test_transfer.py` | pending |
| Rejected-transfer atomicity | `test_transfer.py` | pending |
| Reset exactness + deterministic reapplication | `test_api.py` | pending |

## Manual / UI walkthrough

| Step | Expected (per `docs/EXPECTED_RESULTS.md`) | Result |
| --- | --- | --- |
| Load demo | 12 employees, `HOD` headcount 12 / payroll 821000 | pending |
| Apply valid transfer | `MGR_A` → 2/137000, `MGR_C` → 5/262000, `HOD` unchanged | pending |
| Attempt invalid transfer | `MANAGEMENT_CYCLE`, prior chart/impact retained | pending |
| Attempt root transfer | `ROOT_MOVE_FORBIDDEN` | pending |
| Reset | Original 12 records, no highlights, reapplying valid transfer reproduces same result | pending |

## Full suite

```sh
cd backend && pytest
```

Result: pending (populate once backend exists).
