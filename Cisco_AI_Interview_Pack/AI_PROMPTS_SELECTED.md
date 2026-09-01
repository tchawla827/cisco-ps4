# Selected AI Prompt History

This is the short prompt history I would show in the interview. It keeps the prompts that materially changed the design, implementation, testing, or debugging process.

## Project setup

**Prompt**

> Convert the raw problem statement into `PRD.md` and `ARCHITECTURE.md`, then initialise the repo's documentation scaffold for systematic building.

**Outcome**

Accepted. The problem was split into a requirements document, architecture constraints, implementation stages, expected-result oracle, prompt log, and test evidence before full implementation started.

## Load validation

**Prompt**

> Implement the pure six-pass department-load validation pipeline test-first, preserving pass and source order, frozen `Employee`, and avoiding `sorted()` in domain and service code.

**Outcome**

Accepted. Validation became a fixed sequence of passes with source-order precedence inside a pass.

## Tree construction and rollups

**Prompt**

> Complete source-order tree construction and exact integer postorder rollups test-first, with root invariant failures raising exceptions and the independent oracle kept outside production code.

**Outcome**

Accepted. Tree construction preserves source order, rollups use postorder traversal, and root totals are checked against the flat source records.

## Transfer logic

**Prompt**

> Implement pure transfer validation, immutable candidate copying, and rollup-impact detection with exact source-order semantics.

**Outcome**

Accepted with review. Candidate-before-commit was used instead of mutation/rollback, and changed rollups are found by direct before/after value comparison.

## Architecture review - mutable tree rejected

**Prompt**

> Should I keep a nested organisation tree in state and update it directly on transfers, or keep the flat employee records canonical? Review both approaches for this problem.

**Outcome**

Rejected the mutable-tree approach after review. The ordered flat employee list stayed canonical; tree and rollups are derived. This avoids synchronising two mutable representations and keeps reset/source-order behaviour straightforward.

## Transfer optimization review - incremental rollup patch rejected

**Prompt**

> Optimize transfer impact by updating only the old-manager and new-manager ancestor chains instead of recalculating every rollup. Keep the exact changed-rollup output correct.

**Outcome**

Rejected the generated incremental-update approach. At `n <= 30`, full recomputation is simpler and safer. Direct before/after comparison also avoids over-reporting a shared ancestor such as `HOD` when its totals do not change.

## API boundary

**Prompt**

> Expose scenario selection, department views, transfer preview, and reset through a thin local FastAPI API while keeping API-only unloaded-state handling outside the domain.

**Outcome**

Accepted. FastAPI remains a transport layer while business validation stays in domain/service code.

## Organisation tree

**Prompt**

> Add a pure, test-first SVG organisation chart with deterministic source-order layout, keyboard selection, and transfer-impact markers.

**Outcome**

Accepted. The frontend calculates layout coordinates only and consumes backend-provided hierarchy and impact data.

## Frontend regression tests

**Prompt**

> Add focused frontend regression coverage for layout invariants, employee selection, transfer rejection retention, invalid-load clearing, reset semantics, and every API-client route contract.

**Outcome**

Accepted. Tests focus on interaction contracts and mock the API boundary rather than duplicating domain calculations in React.

## Final verification

**Prompt**

> Run the real backend and frontend test/build/lint commands, drive a live end-to-end walkthrough of the demo against the exact oracle values, capture screenshots, then fill in test evidence and document deviations from the original plan.

**Outcome**

The walkthrough found a real visual bug even though automated tests were green: the organisation chart wrapper did not provide usable height to the canvas.

The issue was fixed narrowly in the frontend CSS, then the complete test/build/lint and browser flow were rerun. Current verification is 108 backend tests and 38 frontend tests passing, with build passing and lint exiting successfully with one Fast Refresh warning.
