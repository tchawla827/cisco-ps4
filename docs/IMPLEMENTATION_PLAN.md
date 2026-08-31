# Implementation Plan

This is the development sequence I would use to explain the project. The detailed historical build plan remains in `docs/PLAN.md`.

### Stage 1 — Define the domain rules

**Goal:** Make a flat employee list safe to use as one reporting hierarchy.

**Work:**

- Model employees and fixed domain error codes.
- Validate fields, identifiers, one root, manager references, cycles, and connectivity in a defined order.
- Build a source-order-preserving tree from validated records.

**Checkpoint:** Valid and invalid scenarios return the expected first validation result.

### Stage 2 — Derive hierarchy and payroll information

**Goal:** Calculate the information an administrator needs from the validated tree.

**Work:**

- Traverse the tree to calculate each employee's complete-team headcount and payroll.
- Assert that the root totals equal the source records.
- Keep the hand-derived demo oracle outside production code.

**Checkpoint:** The 12-person scenario matches the documented headcount and INR 821,000 total payroll.

### Stage 3 — Add safe reorganisation operations

**Goal:** Preview and apply a reporting-line change without corrupting state.

**Work:**

- Check transfer rules before changing records.
- Build a candidate list, recompute rollups, and commit only on success.
- Report the moved subtree and exact before/after rollup differences; add reset and leaf-only roster operations.

**Checkpoint:** `LEAD_A → MGR_C` succeeds, while a root move and a cycle are rejected without changing the prior state.

### Stage 4 — Expose a local API and UI

**Goal:** Let a user inspect scenarios and operate the workflow visually.

**Work:**

- Add thin FastAPI routes and typed response models.
- Build a React UI for loading, inspecting, previewing, applying, and resetting a department.
- Add tree interaction, comparison, and focused add/delete controls without moving domain rules into the browser.

**Checkpoint:** A user can complete the main demo from the browser against the running API.

### Stage 5 — Verify the important contracts

**Goal:** Guard the rules most likely to regress during a live change.

**Work:**

- Test pure domain functions, service state transitions, API envelopes, and focused UI interactions.
- Check source order, validation precedence, exact rollup differences, and rejected-operation atomicity.
- Run the frontend build and lint alongside both test suites.

**Checkpoint:** Current verification: 108 backend tests and 38 frontend tests pass; frontend build and lint exit successfully.

## What Changed During Implementation

**Original direction:** The base assignment focused on loading, transferring, and resetting a department.

**What changed:** Scenario selection and transfer preview were added so invalid loads and a proposed transfer could be demonstrated directly from the UI.

**Why:** They make the required validation and before/after discussion visible without changing the underlying rules.

**Original direction:** The initial UI plan used a simple organisation display.

**What changed:** The current UI uses an SVG tree with pan/zoom, collapsible side panels, and drag-to-propose transfer.

**Why:** The hierarchy is the primary object of the task; these additions improve inspection while the backend remains authoritative.

**Original direction:** Roster editing was out of the original core flow.

**What changed:** Add employee and delete leaf employee routes were added as small, additive operations.

**Why:** They provide useful live-modification seams. The existing department validator still guards the resulting candidate list.
