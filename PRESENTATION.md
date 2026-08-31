# Presentation Outline

## Slide 1 — Problem & Solution

- Flat employee records do not explain team structure or payroll impact.
- Administrators need to test a reporting-line change safely.
- This tool validates the hierarchy, calculates rollups, and previews/applies a move.

**Visual:** Screenshot of the loaded organisation tree.

**Speaker notes:** “The input is flat, but the decisions are hierarchical. I built a local tool that turns it into a validated reporting tree and makes a proposed reorganisation explainable before it is committed.”

## Slide 2 — How It Works

- Select a deterministic scenario.
- Backend validates and derives tree and team rollups.
- Preview or apply a transfer; invalid moves leave state unchanged.

**Visual:** Load → preview → apply/reject flow.

**Speaker notes:** “The backend is the source of truth. The UI receives a complete snapshot and does not recalculate payroll or transfer validity.”

## Slide 3 — Architecture

- React UI → FastAPI routes → `DepartmentService` → pure domain functions.
- Canonical state is an ordered flat employee list.
- Tree and rollups are derived; state is in memory for this exercise.

**Visual:** Mermaid diagram from `README.md`.

**Speaker notes:** “The important boundary is between pure domain logic and transport/presentation. That lets most correctness tests run without a browser or server.”

## Slide 4 — Development Approach

- Validate records before deriving anything.
- Use candidate-then-commit for transfers.
- Added preview and scenario selection to make required behavior demonstrable.

**Visual:** Validate → candidate → recompute → commit.

**Speaker notes:** “I deliberately recompute rollups for a candidate. At 30 employees, that is simpler and safer than incremental patching.”

## Slide 5 — AI-Assisted Development

- AI helped decompose validation, transfer, API, and UI work.
- Validation order and domain boundaries remained explicit contracts.
- Tests and a live walkthrough were used to accept or correct output.

**Visual:** Compact excerpt from `docs/AI_USAGE.md`, not a chat transcript.

**Speaker notes:** “AI accelerated drafts and test ideas, but I checked behavior against the oracle. Direct before/after rollup comparison is one choice I retained after evaluating an ancestor-path shortcut.”

## Slide 6 — Testing, Trade-offs & Demo

- Fresh checks: 108 backend tests, 38 frontend tests, frontend build and lint pass.
- No persistence, authentication, or multi-user isolation by design.
- Demo: `LEAD_A → MGR_C`, then rejected `MGR_A → E3` cycle.

**Visual:** Before/after impact panel showing `MGR_A` and `MGR_C`.

**Speaker notes:** “Testing focuses on rule ordering, exact impact, and retained state after rejection. Process-local state is the intentional limitation; production persistence and concurrency are outside this version.”
