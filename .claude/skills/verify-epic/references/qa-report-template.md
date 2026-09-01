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

Every **done** row's Evidence cell names a **repo-relative path in backticks and
the test's name in double quotes**, as the AC1 row above writes it. A `:190` line
suffix on the path is allowed. Conforming:
`` `src/features/entries/lib/validate.test.ts` — "rejects future dates" ``.
Not conforming: `` `validate.test.ts` — the happy path is asserted `` — a bare
basename, and no test name. The citation check resolves the path from the repo
root and looks the name up inside that file, so a basename (several files here
are called `page.test.tsx`) and a cell of prose are both reported unresolved, and
an unresolvable citation is unverifiable evidence — the script rejects it and the
report fails on it rather than the grade standing. **Partly** and **not done**
rows carry prose instead; they have no test to cite.

Totals: <x> done · <y> partly · <z> not done

## Checks

| Check | Result | Notes |
| :-- | :-- | :-- |
| Type check | pass | |
| Lint | pass | |
| Unit (app tier) | fail | 2 of 14 failing, below |
| Unit (generator tier) | not run | not run — no path under `scripts/` or `src/lib/` is in the epic's scope |
| Unit (tooling tier) | pass | |
| Integration | not run | no integration tests exist for this epic |
| Functional / e2e | not run | no e2e runner configured |
| Build | pass | |

One row per tier, always all three. A tier `tiersFor` did not select reads **not
run** with `tierReason`'s sentence for it in Notes — never `pass`, never absent.

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
