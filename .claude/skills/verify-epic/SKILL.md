---
name: verify-epic
description: Run full QA on one epic and report whether its acceptance criteria actually hold. Resolves the epic's PRD and tech spec, runs its unit, integration, and functional tests plus type check, lint, and build, then traces every AC to a passing test and marks it done / partly / not done. Diagnoses failures but does not fix them. Use whenever the user runs `/verify-epic`, asks to verify, QA, or check an epic, or wants to know whether an epic's requirements are genuinely met.
argument-hint: [epic-N] [feature-X]
---

# Verify epic

Answer one question honestly: **does this epic actually meet its acceptance
criteria?** A green suite is evidence, not the answer — a passing run says
nothing about an AC no one wrote a test for.

**This skill diagnoses; it does not fix.** Keeping verification separate from
repair is what keeps it trustworthy: an agent that can fix failures is tempted
to weaken a test to make the report look better. Report the failures and let the
caller decide.

## 1. Resolve the epic

Arguments arrive in any order — `epic-2`, `feature-3`, `/verify-epic epic-2
feature-3` all work.

- Epic and feature given → use them.
- Epic only → search `specs/*/prd/` for a matching epic. One hit, use it; more
  than one, list them and ask.
- Nothing given → list the epics that have a PRD and ask.

Read the PRD (acceptance criteria — the thing being verified), the tech spec if
present (its `Requirement coverage` table maps ACs to steps and tests, which
saves you rediscovering it), and `docs/testing.md` for how this repo tests.

## 2. Establish the epic's scope

Which files and tests belong to this epic. In a feature-sliced repo that's the
slice plus its route; the tech spec's file-ownership lists are authoritative
where they exist.

Scope matters in both directions: running the whole repo's suite attributes
unrelated breakage to this epic, and running too narrowly misses the integration
the epic was supposed to deliver.

## 3. Detect what test tiers exist

Check `package.json` scripts and config files for the runners actually
installed. Never report a tier as passing when nothing ran.

| Tier | What it covers here |
| :-- | :-- |
| Unit | Colocated tests in the epic's slice — logic, components in isolation |
| Integration | Boundaries inside the epic — route handler with its lib, data access |
| Functional / e2e | The PRD's demo path end to end, browser-level if configured |

Report absent tiers as **not run**, with what's missing. An epic whose
functional tier doesn't exist is a real finding — say so rather than quietly
scoring it on the two tiers that do.

## 4. Run the checks

Run in ascending cost, but **run them all** even after a failure — a full
picture beats a fast exit, and the caller is about to fix everything anyway:

1. Type check
2. Lint
3. Unit tests, scoped to the epic
4. Integration tests
5. Functional / e2e tests
6. Build

Capture actual output for anything that fails. "3 tests failed" is not
actionable; the assertion, the expected-versus-received, and the file and line
are.

If the PRD names a manual demo path and a browser tool is available, walk it and
report what you saw. Otherwise list it as unverified — don't imply it passed.

## 5. Trace acceptance criteria to tests

This is the part a test run alone can't give you. For each AC in the PRD:

- **Done** — a test asserts this AC and it passes. Name the test.
- **Partly** — asserted but incompletely (the happy path only, an edge case from
  the requirement left out), or implemented and visibly working but untested.
- **Not done** — no test asserts it and no implementation satisfies it, or its
  test fails.

An AC with **no test at all** is a distinct finding from a failing one, and the
more dangerous of the two: nothing will ever tell you it broke. Call these out
as coverage gaps in their own right, even when everything is green.

Read the tests to confirm they assert what the AC claims. A test named for an AC
that asserts something weaker is worse than a missing one, because it reports as
covered forever.

## 6. Report

Follow [references/qa-report-template.md](references/qa-report-template.md).
Write it to `specs/<feature>/.verify/<epic>.md` and summarize in chat: the
verdict, the AC tallies, and each failure with its diagnosis.

Lead with the verdict — **pass**, **pass with gaps** (everything green but ACs
uncovered), or **fail** — so the caller doesn't have to infer it from a table.

For each failure give a one-line diagnosis: what broke and the most likely
cause. That's what makes the report directly actionable by whoever fixes it,
including an agent.

Resist grading generously. This report exists so someone can trust the epic
without rechecking it themselves; an inflated pass costs far more than a
detailed fail.
