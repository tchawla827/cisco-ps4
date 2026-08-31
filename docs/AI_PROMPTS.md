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
