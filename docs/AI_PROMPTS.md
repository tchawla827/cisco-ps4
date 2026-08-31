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

### 2026-08-31 — Step 7 frontend scaffold and API client
**Prompt:** Recover the interrupted React, TypeScript, and Vite frontend
scaffold; add API view types and a typed client for all department routes, then
verify the development proxy renders the main department rollup.
**Outcome:** accepted. Replaced generated Vite demo content with a raw JSON
stub that loads `main-12`; added JSdom Vitest setup, Testing Library support,
and a shared non-2xx parser that always throws `ApiError` with backend code and
message rather than a partial department.

### 2026-08-31 — D7 payroll operations cockpit
**Prompt:** Build the first frontend workspace increment as a dense university
payroll-operations cockpit: fixed utility header, source-ordered employee table,
reserved chart and review zones, accessible semantic status markers, and distinct
invalid-load versus rejected-transfer state handling.
**Outcome:** accepted. Used the specified neutral dark token set and semantic
multi-colour states; table and chart/detail placeholders deliberately avoid client-side
hierarchy or payroll calculation. Transfer handlers live at the App boundary now so
Task 10 controls retain the required rejection semantics.

### 2026-08-31 — D4 SVG organisation tree
**Prompt:** Add a pure, test-first SVG organisation chart with deterministic
source-order layout, keyboard selection, and transfer-impact markers.
**Outcome:** accepted. The chart consumes the existing normalized department
view only: a post-order presentation layout assigns leaf slots and parent
midpoints, while impact styling uses the API-provided preview or last committed
impact without calculating hierarchy, payroll, or transfer state in the client.

### 2026-08-31 — Task 10 transfer review panels
**Prompt:** Add read-only employee details, staged transfer controls, and an
impact panel that preserves committed state through rejected transfer attempts.
**Outcome:** accepted. Controls call the existing API boundary directly; the
impact panel presents backend-provided source-order changes and distinguishes a
preview with dashed treatment rather than calculating payroll client-side.
