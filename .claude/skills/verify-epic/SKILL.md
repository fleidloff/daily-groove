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

## Who does the work

**The `verifier` agent runs the checks and grades.** Resolve the epic (§1) and
its scope (§2) in the lead, then dispatch the verifier with the epic's PRD, its
tech spec and that file scope. It runs §4's checks, traces every acceptance
criterion as §5 describes, and returns the finished report. The lead relays it —
it does not re-trace the grades by hand.

**The verifier cannot fix anything.** Not a failing test, not a lint error, not a
typo in the code under review. It reports the failure with its diagnosis and
stops; repair belongs to `/implement-feature` §9 and stays there. This is the
property the whole skill rests on, and it is worth restating now that the work
happens in a subagent: the separation this report's trust depends on is
verification from *repair*, and delegating the grading does not touch it.

What is given up is narrower — **the lead relays a verdict it did not form**. The
citation check in §6 is what stands in for the lead's eyes: it resolves every
grade's evidence mechanically, so a **done** resting on a test that was never
written, or one renamed since, is caught before the verdict goes anywhere.

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

Concretely, the epic's **file scope** is the union of the tech spec's per-track
file-ownership lists — every path each track says it *owns*, taken together. An
epic with no tech spec has no determinable scope; record that as the scope
rather than guessing one, and carry it into §4.

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

Before running any test, decide which unit-test tiers this epic requires. Call
`tiersFor` from `scripts/tiers.ts` — `node --experimental-strip-types` can
import it — with the file scope from §2, passing `null` when the scope could not
be determined. Run exactly the tiers it returns:

| Tier | Command |
| :-- | :-- |
| `app` and `tooling` together | `npm test` |
| `generator` | `npm run test:gen` |
| all three at once | `npm run test:all` |

`tiersFor` always returns `app` and `tooling`, so in practice a selection is
either `npm test` or `npm run test:all`.

`scripts/tiers.ts` is the authority on that selection. Don't restate its
condition here or reason about it yourself — the rule has one home, and it is
tested.

Run in ascending cost, but **run them all** even after a failure — a full
picture beats a fast exit, and the caller is about to fix everything anyway:

1. Type check
2. Lint
3. Unit tests, for each tier `tiersFor` selected
4. Integration tests
5. Functional / e2e tests
6. Build

Every tier gets its own row in the report's Checks table — `Unit (app tier)`,
`Unit (generator tier)`, `Unit (tooling tier)` — whether or not it ran. A tier
`tiersFor` did not select reads **not run**, with `tierReason`'s sentence for
that tier in the Notes column. A tier that did not run is never reported as
passing and never left out of the table.

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

No acceptance criterion may be graded **done** on evidence from a tier that did
not run. An unrun tier proves nothing, so an AC that depends on it is at best
**partly** — say which tier was missing.

An AC with **no test at all** is a distinct finding from a failing one, and the
more dangerous of the two: nothing will ever tell you it broke. Call these out
as coverage gaps in their own right, even when everything is green.

Read the tests to confirm they assert what the AC claims. A test named for an AC
that asserts something weaker is worse than a missing one, because it reports as
covered forever.

## 6. Report

Follow [references/qa-report-template.md](references/qa-report-template.md).
Write it to `specs/features/<feature>/.verify/<epic>.md` and summarize in chat: the
verdict, the AC tallies, and each failure with its diagnosis.

**Check the citations before relaying anything.** Once the report is written and
before its verdict goes to the caller, run `scripts/citations.ts` over it —
`parseCitations` on the report's markdown, then `checkCitations` on what that
returns, with the repo root; `node --experimental-strip-types` can import it. It
checks only the rows graded **done**, and only that the cited file exists and
declares a test with the cited name. Whether that test asserts what the AC claims
stays the verifier's judgement.

**A citation that does not resolve is a failure of the report, not a passing
grade.** Surface it instead of relaying it: name the acceptance criterion, the
file and test name it cited, and which way it failed — `no-file` (the path does
not resolve from the repo root) or `no-test` (the file has no test by that name).
Do not relay a verdict that rests on it; the grade goes back to the verifier to
re-cite or to re-grade. An unresolvable citation is unverifiable evidence, and it
is exactly the failure the lead can no longer catch by eye.

Lead with the verdict — **pass**, **pass with gaps** (everything green but ACs
uncovered), or **fail** — so the caller doesn't have to infer it from a table.

For each failure give a one-line diagnosis: what broke and the most likely
cause. That's what makes the report directly actionable by whoever fixes it,
including an agent.

Resist grading generously. This report exists so someone can trust the epic
without rechecking it themselves; an inflated pass costs far more than a
detailed fail.
