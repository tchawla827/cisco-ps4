# Implementation Plan

I split the work into five stages so the core rules were correct before UI work started.

## 1. Define the domain rules

**Goal:** Make a flat employee list safe to use as one reporting hierarchy.

**Work**
- Model employee records and domain error codes.
- Validate fields, duplicate IDs, root count, manager references, cycles, and connectivity in a fixed order.
- Preserve employee source order while building direct-report lists.

**Checkpoint:** Valid and invalid datasets return the expected first result.

## 2. Build the hierarchy and rollups

**Goal:** Derive the reporting tree and complete-team totals from validated records.

**Work**
- Build the tree from the flat canonical list.
- Calculate subtree headcount and payroll using postorder traversal.
- Check that root totals match the source records.
- Keep expected demo values outside production code.

**Checkpoint:** The 12-person dataset produces 12 employees and INR 821,000 at the root.

## 3. Add safe transfer logic

**Goal:** Apply a reporting-line change without risking partial state updates.

**Work**
- Validate transfer rules in a fixed order.
- Create a candidate employee list instead of mutating current state.
- Rebuild the candidate tree and rollups.
- Compare before/after rollups and commit only after every check succeeds.

**Checkpoint:** `LEAD_A -> MGR_C` succeeds; cycle and root moves are rejected without changing the existing state.

## 4. Add the API and UI

**Goal:** Make the domain workflow easy to inspect and demonstrate.

**Work**
- Expose thin FastAPI routes around `DepartmentService`.
- Keep business validation out of route handlers and React.
- Build the React workspace for loading, inspecting, previewing, applying, and resetting a department.
- Add the organisation tree as a presentation layer over backend-provided hierarchy data.

**Checkpoint:** The complete required flow works from the browser.

## 5. Verify and tighten the project

**Goal:** Protect the contracts most likely to break during implementation or a live change.

**Work**
- Test validation precedence, source order, rollups, cycle prevention, atomic rejection, reset, and API behaviour.
- Add focused frontend tests for interaction states and API integration.
- Run a live browser walkthrough in addition to automated tests.

**Checkpoint:** 108 backend tests and 38 frontend tests pass; build succeeds; the main demo matches the expected values.

## Changes From the Original Plan

### Transfer preview and scenario selection

These were added after the core domain flow worked. They make validation and before/after impact easier to demonstrate without changing the underlying business rules.

### Interactive organisation tree

The initial UI could have been a simple hierarchy display. It was expanded into an SVG tree with interaction support, but it still consumes backend hierarchy data rather than calculating business rules in the client.

### Add/delete employee operations

These were added only after the required workflow was complete. They reuse the same candidate-validation-recompute-commit pattern and provide small extension points without changing the core model.
