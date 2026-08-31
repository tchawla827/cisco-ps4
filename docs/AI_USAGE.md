# AI Usage

The repository keeps a dated prompt record in `docs/AI_PROMPTS.md`. The examples below use those recorded prompts; they describe the parts that required engineering judgment rather than autocomplete.

## AI Workflow

AI was used to break the assignment into domain, API, UI, and test work; to propose focused implementations; and to surface regression cases. The code and prompt record show that AI output was checked against the assignment, the independent oracle, unit tests, API tests, and a live browser walkthrough. Where an addition broadened the original task, it was kept additive and documented.

## Example 1 — Validation contract

**Situation**

The flat input needed deterministic first-error validation, including source-order precedence.

**Prompt / instruction**

> Implement the pure six-pass department-load validation pipeline test-first, preserving pass and source order, frozen `Employee`, and avoiding `sorted()` in domain and service code.

**AI suggestion**

Use a fixed sequence of validation passes and a single manager-reference loop so an earlier unknown manager can beat a later self-manager.

**My decision**

Accepted the structure because error ordering is part of the task contract; kept domain records as plain frozen dataclasses so deliberately invalid fixtures could reach the validator.

**Validation**

`backend/tests/test_validation.py` checks every error code, pass precedence, source-order precedence, and valid shuffled input.

## Example 2 — Transfer atomicity

**Situation**

A failed reorganisation must not alter the hierarchy or prior impact explanation.

**Prompt / instruction**

> Implement pure transfer validation, immutable candidate copying, and rollup-impact detection with exact source-order semantics.

**AI suggestion**

Validate first, replace only one employee in a candidate list, recompute the candidate, and assign it only after all checks pass.

**My decision**

Accepted candidate-based commit rather than mutation plus rollback. I also used direct before/after comparison for `changed_rollup_ids`, instead of assuming every ancestor changed.

**Validation**

Transfer, service, and API tests verify cycle/root rejection, unchanged state after rejection, deterministic reset/reapply, and the exact `MGR_A`, `MGR_C` diff.

## Example 3 — API boundary

**Situation**

The UI needed scenario selection and preview without spreading business rules into route handlers.

**Prompt / instruction**

> Expose scenario selection, department views, transfer preview, and reset through a thin local FastAPI API while keeping API-only unloaded-state handling outside the domain.

**AI suggestion**

Use Pydantic request/response models at the transport boundary and keep `NO_DEPARTMENT_LOADED` as an API response rather than a domain validation rule.

**My decision**

Accepted this split. The routes map service state to views; validation and transfer precedence remain in pure modules.

**Validation**

`test_api.py` covers scenario listing, unloaded-state responses, preview non-mutation, reset, CORS, and roster routes. `test_ad08_guard.py` prevents FastAPI/Pydantic imports in domain modules.

## Example 4 — Presentation-only tree

**Situation**

The UI needed an organisation chart that did not become a second hierarchy engine.

**Prompt / instruction**

> Add a pure, test-first SVG organisation chart with deterministic source-order layout, keyboard selection, and transfer-impact markers.

**AI suggestion**

Create a display-only layout helper based on backend-provided `children_ids`, with visual state sourced from the API impact response.

**My decision**

Accepted the layout separation and did not calculate payroll, hierarchy, or transfer validity in React.

**Validation**

`orgTreeLayout.test.ts` and `OrgTreeCanvas.test.tsx` cover layout and drop resolution; the frontend suite also checks the API client and key UI states.

## Example 5 — Frontend bug found during verification

**Situation**

The tree canvas existed in the DOM but initially had no visible height after the layout revamp.

**Prompt / instruction**

The prompt record documents a Playwright walkthrough that found the missing flex-container height chain.

**AI suggestion**

The issue was traced to the chart wrapper lacking the flex rule needed by the canvas.

**My decision**

Applied the narrow CSS fix in `frontend/src/workspace.css` rather than changing the chart component or transfer behavior.

**Validation**

The later fix-wave record reports a visible chart screenshot, successful stepped drag interaction, 108 backend tests, 38 frontend tests, build, and lint.

## How I Used AI

I used AI to accelerate decomposition, implementation drafts, and test ideas. I kept the domain contracts small enough to inspect, compared behavior with the hand-derived oracle, and relied on automated and live checks before accepting changes. The architecture, boundaries, and final verification were my responsibility.
