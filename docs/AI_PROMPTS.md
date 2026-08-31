# AI Prompt History

Log key prompts, refinements, and notable accepted/rejected AI suggestions as
implementation proceeds (`PRD.md` §20, `ARCHITECTURE.md` §29). Append entries
chronologically; don't rewrite earlier ones.

## Format

```
### <date> — <stage/topic>
**Prompt:** <what was asked>
**Outcome:** accepted / rejected / modified — why
```

## Entries

### 2026-08-31 — Project initialisation
**Prompt:** Convert the raw problem statement
(`Student_SPR26_D2_P04-departmental-reorg-payroll-rollup-tracker.md`) into
`PRD.md` and `ARCHITECTURE.md`, then initialise the repo's documentation
scaffold for systematic building.
**Outcome:** accepted. `PRD.md` and `ARCHITECTURE.md` were reviewed against
the source problem statement and found consistent — no edits needed. Added
`docs/PLAN.md` (5-stage plan with checkpoints), `docs/EXPECTED_RESULTS.md`
(independent 12-employee oracle, hand-derived before any code exists),
`docs/DESIGN_NOTES.md`, `docs/TEST_EVIDENCE.md`, `README.md`, and `CLAUDE.md`.

### 2026-08-31 — Step 2 load validation
**Prompt:** Implement the pure six-pass department-load validation pipeline
test-first, preserving pass and source order, frozen `Employee`, and avoiding
`sorted()` in domain and service code.
**Outcome:** accepted. Added the validator plus only the minimal validated-input
tree builder required by defensive pass 6; full tree behavior remains Step 3.

### 2026-08-31 — Step 3 tree construction and rollups
**Prompt:** Complete source-order tree construction and exact integer postorder
rollups test-first, with root invariant failures raising exceptions and the
independent oracle kept outside production code.
**Outcome:** accepted. Used recursive preorder for subtree collection and
postorder for rollups; source-order appends preserve sibling ordering without
sorting, and the root guard raises `RootInvariantError` on corrupted totals.

### 2026-08-31 — Step 4 transfer domain logic
**Prompt:** Implement pure transfer validation, immutable candidate copying, and
rollup-impact detection with exact source-order semantics.
**Outcome:** accepted. Rollup highlights compare before/after values directly,
not inferred ancestor paths; validation, candidate copy, and full recomputation
remain separate so rejected requests cannot mutate authoritative inputs.

### 2026-08-31 — D2 scenario service and independent oracle
**Prompt:** Add scenario-key loading, a test-only oracle, and an in-memory
service that computes transfer candidates before committing state.
**Outcome:** accepted. Production scenarios hold operational employee inputs
only; expected values live in `backend/tests/oracle.py`, while the service
retains state only after validation, rebuild, recomputation, and invariant
checks succeed.

### 2026-08-31 — D3/D6 FastAPI transport boundary
**Prompt:** Expose scenario selection, department views, transfer preview, and
reset through a thin local FastAPI API while keeping API-only unloaded-state
handling outside the domain.
**Outcome:** accepted. Added `GET /api/scenarios` and preview before approval
(D3), with `NO_DEPARTMENT_LOADED` returned only by the API as a direct 409
JSON envelope (D6). Pydantic models normalize derived tree and rollup state
into stable response views; business validation and transfer precedence remain
in pure domain and service code.
