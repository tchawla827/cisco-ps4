# AI Usage

I used AI throughout the build, but mostly in short, bounded tasks: break down one requirement, implement one layer, generate tests for one contract, or debug one specific failure.

I did not use one prompt to generate the whole project. The pattern was usually:

```text
understand one requirement
-> give AI exact constraints
-> inspect the suggested change
-> run focused tests
-> integrate it
-> verify the complete flow
```

The full prompt history is in `AI_PROMPTS_SELECTED.md`. The examples below are the interactions that best show how AI affected the implementation.

## 1. Validation pipeline

**Prompt**

> Implement the pure six-pass department-load validation pipeline test-first, preserving pass and source order, frozen `Employee`, and avoiding `sorted()` in domain and service code.

**Why this mattered**

The project does not only need to reject bad data. It needs deterministic first-error behaviour. If one record has an unknown manager and a later record manages itself, the correct error depends on the defined validation order and the original source order.

**What I kept**

I kept the fixed-pass approach and one source-ordered manager-reference pass. I also kept the domain `Employee` as a frozen dataclass rather than moving the rules into Pydantic, because domain validation order should remain explicit and testable.

**How I checked it**

`test_validation.py` covers every error category, precedence between passes, source-order precedence, and valid input.

## 2. Candidate-before-commit transfer flow

**Prompt**

> Implement pure transfer validation, immutable candidate copying, and rollup-impact detection with exact source-order semantics.

**Why this mattered**

A rejected reorganisation must not leave half-applied state.

**AI suggestion**

Validate the request, make a candidate list, change only the moved employee's `manager_id`, rebuild and recompute the candidate, and assign it only after all checks pass.

**My decision**

I used this instead of mutating current state and trying to roll it back later.

The important part is that failure becomes simple: if candidate validation or recomputation fails, the current state was never touched.

**How I checked it**

Transfer, service, and API tests verify cycle/root rejection, unchanged state after rejection, deterministic reset/reapply, and retained previous impact.

## 3. Exact changed-rollup calculation

**Prompt**

> Implement pure transfer validation, immutable candidate copying, and rollup-impact detection with exact source-order semantics.

While reviewing the impact logic, I compared two possible approaches:

1. mark old/new ancestor paths as changed;
2. compare actual before/after rollup values.

I kept direct value comparison.

The ancestor shortcut can report a common ancestor even when its displayed totals are unchanged. In the main cross-branch move, `HOD` stays above both branches and still has the same 12 employees and INR 821,000 total payroll.

Direct comparison returns only `MGR_A` and `MGR_C`, which is the exact visible impact.

## 4. Rejected AI suggestion: store a mutable tree as primary state

**Prompt**

> Should I keep a nested organisation tree in state and update it directly on transfers, or keep the flat employee records canonical? Review both approaches for this problem.

**AI suggestion**

The first suggestion was to keep a mutable nested tree in service state because transfers would look like direct detach/attach operations and the UI already thinks in terms of a hierarchy.

**Why I rejected it**

I rejected that approach after reviewing what else the application has to preserve. The input itself is an ordered flat list, reset needs to restore the exact source records, and a transfer only changes one `manager_id`. If I stored a mutable tree as the primary state, I would either lose the original ordering contract or have to keep both a list and a tree synchronized.

I kept the ordered flat employee list as the only canonical state. The tree, `children_ids`, and rollups are derived whenever needed. At the required maximum of 30 employees, rebuilding is cheap and removes an entire class of synchronization bugs.

**How I checked it**

Transfer and reset tests verify that source order remains stable, sibling order is deterministic, and rebuilding the tree after a move produces the expected hierarchy.

## 5. Rejected AI code approach: incrementally patch ancestor rollups

**Prompt**

> Optimize transfer impact by updating only the old-manager and new-manager ancestor chains instead of recalculating every rollup. Keep the exact changed-rollup output correct.

**AI suggestion**

AI proposed subtracting the moved subtree's headcount/payroll from the old-manager chain and adding it to the new-manager chain, then using those touched ancestors as the changed set.

**Why I rejected it**

The code was faster on paper, but it added bookkeeping and made correctness harder to inspect. The old and new ancestor paths can overlap. In the main cross-branch transfer they meet at `HOD`; its headcount and payroll are unchanged, so treating every touched ancestor as changed would over-report the impact unless I added more special handling.

Since the problem caps the department at 30 employees, I rejected the incremental patch and kept a full O(n) recomputation followed by a direct before/after value comparison. It is simpler, deterministic, and gives the exact changed set without path-specific cases.

**How I checked it**

For `LEAD_A -> MGR_C`, the final result reports only `MGR_A` and `MGR_C`; `HOD` remains unchanged and is excluded.

## 6. Keep the UI presentation-only

**Prompt**

> Add a pure, test-first SVG organisation chart with deterministic source-order layout, keyboard selection, and transfer-impact markers.

**AI suggestion**

Use backend-provided `children_ids` as the hierarchy and calculate only presentation coordinates in the frontend.

**My decision**

I kept that boundary. React can decide where a card appears on screen, but it does not calculate hierarchy, payroll, cycle validity, or transfer impact.

A drag action only proposes a transfer. The backend validates preview and commit independently.

This kept one source of truth for business rules.

## 7. A bug automated tests did not catch

During the frontend revamp, backend and frontend tests were green, but the live browser walkthrough showed that the organisation tree was not visible.

The component existed in the DOM, so I used AI to narrow the issue instead of immediately changing tree logic.

The problem was the layout chain: the chart wrapper did not provide the flex behaviour needed by the canvas, so its visible height collapsed.

The fix was deliberately small: add the missing flex-container rule in `frontend/src/workspace.css` rather than changing hierarchy or SVG logic.

Then I reran the tests, build, lint, and browser walkthrough and verified that the tree and drag interaction were visible and usable.

This was one of the most useful checks in the project because it showed that passing component tests did not guarantee the complete user flow was correct.

## 8. Test strategy

**Prompt**

> Add focused frontend regression coverage for layout invariants, employee selection, transfer rejection retention, invalid-load clearing, reset semantics, and every API-client route contract.

I used AI to generate possible regression cases, but I did not optimize for test count.

The priority was to protect the contracts that matter most:

- validation precedence;
- source-order behaviour;
- rollup correctness;
- cycle and root protection;
- candidate atomicity;
- exact changed-rollup reporting;
- reset determinism;
- frontend state after rejected operations.

For visual interaction, I still used a live browser walkthrough because that catches a different class of problems than unit/component tests.

## How I Used AI Overall

AI was most useful for decomposition, implementation drafts, test-case discovery, and debugging.

I tried to give it narrow prompts with explicit constraints instead of asking for a complete solution. I accepted suggestions only after I understood the change and had a way to verify it.

The main engineering decisions I kept explicit were:

- flat ordered records as canonical state;
- backend-owned domain rules;
- deterministic validation;
- candidate-before-commit changes;
- full recomputation at the required data size;
- value-based changed-rollup detection.
