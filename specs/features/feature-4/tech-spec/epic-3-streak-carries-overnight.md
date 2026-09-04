# Tech spec — Epic 3: The streak carries overnight

PRD: [../prd/epic-3-streak-carries-overnight.md](../prd/epic-3-streak-carries-overnight.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

One function changes. `computeStreak` currently anchors its walk at today and
returns 0 the moment today fails to qualify, which is why the number is wrong
every morning. The fix is to choose the anchor first — today when today is
solved, otherwise yesterday — and then run the existing backward walk unchanged.

No signature changes, no persistence, no component edits. The work is a
four-line change and a substantially rewritten test file: several existing cases
assert the behaviour this epic removes, and rewriting them is most of the epic.

## Architecture

```
computeStreak(results, today)
  ├─ index results by date
  ├─ anchor = today qualifies ? today : yesterday
  └─ walk back from anchor while each day qualifies
```

Qualifying is unchanged and stays `isQualifying(r) === r.solved`. The anchor
shift is the only new concept, and it is deliberately not a "grace period" or a
freeze: a day is never forgiven, the count simply refuses to judge a day that
has not finished yet.

`useProgress` is untouched. It already recomputes the streak from the full
result set on every render, so a solve updates the badge with no reload — R4
falls out of the existing derivation rather than needing code.

## Contracts

Unchanged, and depended on by Epic 1's `StreakBadge` in the same wave:

```ts
// src/features/daily-groove/lib/streak.ts
export function isQualifying(r: DailyResult): boolean
export function computeStreak(results: DailyResult[], today: string): number
```

`today` stays an ISO `YYYY-MM-DD` string. Date parsing stays noon-anchored so a
DST step cannot move a record onto a neighbouring calendar day.

## Tracks

### Track A — The rule

- **Goal** — `computeStreak` implements the anchor shift.
- **Owns** — `src/features/daily-groove/lib/streak.ts`, `lib/streak.test.ts`
- **Depends on** — nothing
- **Parallel with** — Track B is downstream, so nothing in this epic
- **Done when** — `streak.test.ts` is green on the new table.

### Track B — The hook's assertions

- **Goal** — the hook tests assert the new rule.
- **Owns** — `src/features/daily-groove/hooks/useProgress.test.ts`,
  `hooks/useProgress.integration.test.ts`
- **Depends on** — Track A landed
- **Done when** — both files are green with no change to `useProgress.ts`.

This epic touches no component and no shared page-level test file, so it does not
collide with Epics 1, 2 or 4 anywhere.

## Execution waves

- **Wave 1:** Track A
- **Wave 2:** Track B

## Implementation

### Track A — The rule

#### Step A1 — A solved yesterday survives an untouched today

Covers: R1, AC1

- **Test first** — `lib/streak.test.ts`: rewrite
  `is 0 when today itself is absent, even with a prior run` as
  *counts the run ending yesterday when today is untouched* — given a solved
  record for yesterday and none for today, assert `computeStreak` returns `1`.
  Run it: fails, `expected 1, received 0`.
- **Implement** — `lib/streak.ts`: before the walk, compute
  `const anchor = byDate.get(today)?.solved ? today : previousDay(today)`, and
  start `cursor` at `parseIsoDate(anchor)`. Add `previousDay(iso)` as a local
  helper that steps a noon-anchored date back one day and re-formats it.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A2 — Solving today advances the number

Covers: R1, R4, AC2, AC3

- **Test first** — `lib/streak.test.ts`: given a solved yesterday and a solved
  today, assert `2`; given three consecutive solved days ending today, assert
  `3`. Run it: the existing equivalents already pass, so add the
  yesterday-then-today transition as one case that computes the streak twice —
  once with today absent (`1`), once with today solved (`2`) — proving the
  anchor moves.
- **Implement** — none beyond A1.
- **Green when** — both halves of the transition assert.
- **Refactor** — none.

#### Step A3 — An attempted but unsolved today keeps yesterday's run

Covers: R1, R3b, AC6

- **Test first** — `lib/streak.test.ts`: rewrite
  `is 0 when today is played but unsolved` — given a solved yesterday and an
  unsolved record for today with two attempts, assert `1` rather than `0`. Run
  it: fails, `expected 1, received 0` before A1; passes after.
- **Implement** — none beyond A1. An unsolved today does not qualify, so the
  anchor falls to yesterday.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A4 — An attempted but unsolved *past* day still breaks the run

Covers: R3, R3b, AC6a

- **Test first** — `lib/streak.test.ts`: given a solved record two days ago and
  an unsolved record for yesterday, assert `0`. Run it: fails before A1 for the
  wrong reason (today is absent) and for the right one after — the anchor is
  yesterday, yesterday does not qualify, the walk stops immediately.
- **Implement** — none. This is the case that proves the anchor shift did not
  become a grace period.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A5 — A missed day clears the streak

Covers: R3a, AC5

- **Test first** — `lib/streak.test.ts`: keep and extend
  `stops at a gap day with no result` — given solved records for Monday,
  Tuesday and Wednesday and a `today` of Friday with no Thursday record, assert
  `0`. Run it: passes after A1 (Thursday is the anchor, and it is absent), and
  is the briefing's "1 day without trying clears the streak" asserted rather
  than assumed.
- **Implement** — none.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A6 — Attempt count never decides qualification

Covers: R3, AC6b

- **Test first** — `lib/streak.test.ts`: given a record for today solved on the
  fifth attempt, assert `1`. The existing
  `is true for a solved day, whatever the attempt count` covers `isQualifying`;
  this asserts it through `computeStreak`.
- **Implement** — none.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A7 — The empty and boundary cases hold

Covers: R2, R6, AC4, AC7

- **Regression guards.** `is 0 when there are no results`,
  `is 0 when today is absent and the last solve was two days ago`, and
  `steps across a month boundary correctly` must all still pass — the last one
  is what proves `previousDay` handles a month rollover, which A1 introduced.
- **Test** — keep all three; add the two-days-ago case explicitly if the
  existing file only covers it via the gap-day test.
- **Green when** — all pass.

#### Step A8 — Computing writes nothing

Covers: R5, AC8

- **Regression guard.** `computeStreak` takes an array and returns a number; it
  has no store reference and cannot write. Asserted structurally by the frozen
  contract rather than by a test, since there is nothing to spy on.

### Track B — The hook's assertions

#### Step B1 — The hook's streak cases match the new rule

Covers: R1, R4

- **Test first** — `hooks/useProgress.test.ts`: the case asserting
  `streak` is `0` for an unsolved day, and
  `an unsolved yesterday breaks the streak`, are re-checked against the new
  rule and their expectations updated where the fixture makes the old number
  wrong. Same for `useProgress.integration.test.ts`, whose
  `Unsolved, so it does not build the streak` case expects `0`.
- **Implement** — no change to `useProgress.ts`.
- **Green when** — both files are green.
- **Refactor** — none. Where a fixture's expectation is genuinely unchanged
  (an unsolved today with no prior days is still `0`), leave it and note why in
  the test's comment, so a reader can tell a survived assertion from an
  overlooked one.

#### Step B2 — Solving updates the badge with no reload

Covers: R4, AC2

- **Test first** — `hooks/useProgress.test.ts`: extend
  `a solving attempt marks the day solved and starts the streak` — seed a solved
  yesterday, assert the streak reads `1` on load, record a solving attempt for
  today, and assert it reads `2` without remounting.
- **Implement** — none; the streak is a `useMemo` over the result set that
  `recordAttempt` already updates.
- **Green when** — the assertion passes.
- **Refactor** — none.

## Integration and verification

- `npm test` green, with particular attention to `lib/streak.test.ts` — several
  of its cases assert the *opposite* of what they did before, so a file that
  passes without having been edited is a signal the change did not land.
- Demo path, from the PRD, without waiting a day: seed
  `localStorage['daily-groove:v2:results']` with a solved record dated yesterday
  and reload. The header reads "1 day streak" before any guess. Solve today's
  groove: it reads "2 days streak" with no reload. Clear the record, seed one
  dated two days ago, reload: "No streak yet".

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A2, A3, B1 |
| R2 | A7 |
| R3 | A4, A6 |
| R3a | A5 |
| R3b | A3, A4 |
| R4 | A2, B2 |
| R5 | A8 |
| R6 | A7 |
| AC1 | A1 |
| AC2 | A2, B2 |
| AC3 | A2 |
| AC4 | A7 |
| AC5 | A5 |
| AC6 | A3 |
| AC6a | A4 |
| AC6b | A6 |
| AC7 | A7 |
| AC8 | A8 |

## Assumptions

- `previousDay` is a local helper in `streak.ts` rather than an export. Only
  this module needs it; `archive.ts` has its own noon-anchored date parsing and
  is not refactored to share one here — that consolidation belongs to the
  structure-and-guidelines candidate, not to a streak fix.
- The anchor is computed from the record set, not from a clock, so the function
  stays pure and the tests stay free of fake timers.
- No storage migration. The rule is a re-read of records already saved.
