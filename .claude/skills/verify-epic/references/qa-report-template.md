# QA report template

Written to `specs/<feature>/.verify/<epic>.md`.

---

# QA — Epic <N>: <epic name>

Run: <date> · PRD: [../prd/epic-<N>-<slug>.md](../prd/epic-<N>-<slug>.md)

## Verdict

**pass** | **pass with gaps** | **fail**

One paragraph. If it fails, the headline is what fails and why, not a summary of
what works.

## Acceptance criteria

| AC | Status | Evidence |
| :-- | :-- | :-- |
| AC1 | done | `src/features/entries/lib/validate.test.ts` — "rejects future dates" |
| AC2 | partly | happy path only; the empty-note case in R3 is unasserted |
| AC3 | not done | no test asserts this, and no implementation found |

Totals: <x> done · <y> partly · <z> not done

## Checks

| Check | Result | Notes |
| :-- | :-- | :-- |
| Type check | pass | |
| Lint | pass | |
| Unit (epic scope) | fail | 2 of 14 failing, below |
| Integration | not run | no integration tests exist for this epic |
| Functional / e2e | not run | no e2e runner configured |
| Build | pass | |

## Failures

### `validate.test.ts` — "rejects future dates"

```
expected: { ok: false, error: 'future_date' }
received: { ok: true }
```

Diagnosis: `validate()` compares against `new Date()` including time, so an
entry later today passes. Needs a date-only comparison.

## Coverage gaps

ACs with no test asserting them. Green today, silently breakable tomorrow.

- **AC3** — nothing exercises the empty state.

## Unverified

Anything that couldn't be checked automatically, so the reader knows it's
unknown rather than fine.

- The PRD's manual demo path — no browser tool available in this run.
