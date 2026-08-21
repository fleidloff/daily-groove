# Run report template

Written to `specs/<feature>/.implement/report.md` and summarized in chat.

---

# Implementation report — <feature>

Run: <date> · Mode: subagents | teams · Units: <n> across <m> waves

## Result

One paragraph: what got built, what didn't, and whether the suite is green.
Lead with the bad news if there is any.

## Acceptance criteria

Every AC from every PRD in the feature. Mark **done** only where a passing test
demonstrates it.

| Epic | AC | Status | Evidence |
| :-- | :-- | :-- | :-- |
| 1 | AC1 | done | `src/features/entries/lib/validate.test.ts` — "rejects future dates" |
| 1 | AC2 | partly | implemented in `entry-form.tsx`; no test for the empty-note case |
| 2 | AC5 | not done | blocked — Track B failed, see below |

Totals: <x> done · <y> partly · <z> not done

## Waves

| Wave | Units | Ran in parallel | Outcome |
| :-- | :-- | :-- | :-- |
| 1 | entries-lib, entries-ui | yes | both green |
| 2 | entries-route | — | green |

## Verification

- Full suite: <pass/fail> — <n> tests
- Type check: <pass/fail>
- Build: <pass/fail>
- Manual demo path from the PRD: <what you checked, or not checked>

## Follow-ups

What the next run should pick up: the partly-done ACs, the failures, anything a
worker flagged as an assumption or a spec ambiguity. Be specific enough to act
on without rereading this report's context.
