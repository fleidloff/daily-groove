# Tech spec — Epic 4: Today joins the played row as soon as it's done

PRD: [../prd/epic-4-today-joins-the-row.md](../prd/epic-4-today-joins-the-row.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

The whole rule lives in `lib/archive.ts`. `toArchiveEntries` filters today out
with `r.date < today`; that filter becomes a predicate that admits today once it
is finished, and the entry it produces carries a new outcome and — while the day
is unsolved — no answer at all. `ArchiveStrip` then renders what it is handed,
including the case where the answer is absent.

Keeping the masking in `lib/` rather than the component is deliberate: the
component cannot leak an answer it was never given, and the rule is asserted
directly as logic rather than through a render. That is also what keeps
`GroovePuzzle` out of this epic entirely, which is what lets it run beside
Epic 2 in the same wave.

## Architecture

`toArchiveEntries(results, today)` gains one branch and loses one filter:

```
for each result
  ├─ date <  today            → a past entry, exactly as now
  ├─ date == today && finished → today's entry, first in the list
  └─ date == today && !finished → omitted
```

where `finished = solved || attempts.length >= 3`.

Today's unsolved entry is the one entry whose `answer` is absent and whose
outcome is `in-play`. Both are decided in `lib/`, so `ArchiveStrip`'s only new
job is rendering a placeholder where an answer would go.

## Contracts

Frozen. Epic 5 renders its play control into these cards and reads `date` from
them.

```ts
// src/features/daily-groove/lib/archive.ts
export type Outcome = 'first-try' | 'solved' | 'missed' | 'in-play'

export type ArchiveEntry = {
  date: string
  /** 'Today', 'Yesterday', a weekday within the last week, or a date beyond. */
  label: string
  /** Absent while today is shown and unsolved — the puzzle is still winnable. */
  answer: Answer | null
  outcome: Outcome
  tries: number
}
```

`outcomeMark(entry)` returns `'In play'` for the new outcome, and its existing
three strings otherwise. `ArchiveStrip`'s props are unchanged:
`{ entries: ArchiveEntry[]; total: number }`.

**`answer` becoming nullable is the breaking part of this contract.** Every
existing consumer reads `entry.answer.root` directly, so the compiler will find
them; there is exactly one, in `ArchiveStrip`.

## Tracks

### Track A — The membership and masking rules

- **Goal** — `toArchiveEntries` admits a finished today, first, without its
  answer while unsolved.
- **Owns** — `src/features/daily-groove/lib/archive.ts`, `lib/archive.test.ts`
- **Depends on** — the `ArchiveEntry` contract only
- **Parallel with** — Track B
- **Done when** — `archive.test.ts` is green on the new rules.

### Track B — The card that withholds its answer

- **Goal** — `ArchiveStrip` renders a null-answer card and suppresses the empty
  state when today is the only entry.
- **Owns** — `src/features/daily-groove/components/ArchiveStrip.tsx`,
  `ArchiveStrip.test.tsx`
- **Depends on** — the `ArchiveEntry` contract only
- **Parallel with** — Track A
- **Done when** — its own tests pass against hand-built entries, with Track A
  unfinished.

### Track C — Integration

- **Owns** — `src/features/daily-groove/components/GroovePuzzle.test.tsx`,
  `src/app/page.test.tsx`
- **Depends on** — Tracks A and B landed

**Both files are shared with Epics 1 and 2 in this wave.** `GroovePuzzle.test.tsx`
in particular carries `shows past days in the archive, and today only as the
puzzle (E5 R8-R11, AC7, AC9)`, whose title states the behaviour this epic
removes. Track C must not run concurrently with the equivalent track in Epic 1
or Epic 2.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B
- **Wave 2:** Track C — integration

## Implementation

### Track A — The membership and masking rules

#### Step A1 — A solved today appears first, labelled "Today"

Covers: R1, R3, R4, AC1, AC5

- **Test first** — `lib/archive.test.ts`: given a solved record dated `today`
  and two past records, assert `toArchiveEntries(...)[0]` has `date === today`
  and `label === 'Today'`, and that the following two are yesterday and the day
  before. Run it: fails — the array has two entries and today is not among them.
- **Implement** — `lib/archive.ts`: add
  `function isFinished(r: DailyResult) { return r.solved || r.attempts.length >= 3 }`;
  change the filter to `r.date < today || (r.date === today && isFinished(r))`;
  add a `distance === 0 → 'Today'` branch at the top of `dayLabel`. The existing
  descending date sort already places today first.
- **Green when** — all three positions assert.
- **Refactor** — none.

#### Step A2 — Three spent attempts admit an unsolved today

Covers: R1, AC2

- **Test first** — `lib/archive.test.ts`: given an unsolved today with three
  attempts, assert one entry exists for today. Run it: fails before A1's
  predicate, passes after.
- **Implement** — none beyond A1.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A3 — Fewer than three attempts admit nothing

Covers: R2, AC3, AC4

- **Test first** — `lib/archive.test.ts`: given an unsolved today with two
  attempts, assert no entry has `date === today`; same for a today with zero
  attempts. Run it: passes after A1 — these are the cases the predicate must
  *not* admit, and they would fail if `isFinished` were written as
  `attempts.length > 0`.
- **Implement** — none.
- **Green when** — both assert.
- **Refactor** — none.

#### Step A4 — An unsolved today carries no answer

Covers: R6a, AC6a

- **Test first** — `lib/archive.test.ts`: given an unsolved today with three
  attempts whose record's answer is `{ root: 'F♯', flavour: 'Dorian' }`, assert
  the entry's `answer` is `null`. Run it: fails — the entry carries the record's
  answer.
- **Implement** — `lib/archive.ts`: in the map, set
  `answer: r.date === today && !r.solved ? null : r.answer`, and widen
  `ArchiveEntry['answer']` to `Answer | null`.
- **Green when** — the assertion passes and `tsc` flags `ArchiveStrip`'s
  `entry.answer.root` as the single consumer to fix in Track B.
- **Refactor** — none.

#### Step A5 — Solving reveals the answer without moving the card

Covers: R6, R6a, AC6, AC6b

- **Test first** — `lib/archive.test.ts`: derive entries from a three-miss
  unsolved today, then from the same record with a fourth solving attempt, and
  assert the answer goes from `null` to the record's answer while `[0].date`
  stays `today` in both.
- **Implement** — none. The rule is re-derived on every call, so nothing latches.
- **Green when** — both halves assert.
- **Refactor** — none.

#### Step A6 — An unsolved today is marked "In play"

Covers: R6b, AC6c

- **Test first** — `lib/archive.test.ts`: assert the three-miss unsolved today's
  `outcome` is `'in-play'` and `outcomeMark(entry)` returns `'In play'`; after
  the solve, assert the outcome is `'solved'` and the mark reads `'4 tries'`.
  Run it: fails — `outcomeOf` returns `'missed'`.
- **Implement** — `lib/archive.ts`: add `'in-play'` to `Outcome`; in
  `outcomeOf(result, today)` return `'in-play'` when
  `result.date === today && !result.solved`; add the `'In play'` case to
  `outcomeMark`. `outcomeOf` gains `today` as a parameter.
- **Green when** — both assert.
- **Refactor** — none.

#### Step A7 — Past days are untouched

Covers: R10, AC11, AC6d

- **Regression guards.** The existing cases for a past miss, a first-try solve
  and the relative labels must pass unmodified — a past unsolved day is still
  `'missed'` and still carries its answer, which is the asymmetry R6c states.
- **Test** — keep every existing case in `archive.test.ts`; add one asserting a
  past unsolved day's `answer` is non-null, since A4 introduced the only way it
  could become null.
- **Green when** — all pass.

### Track B — The card that withholds its answer

#### Step B1 — A card with no answer renders a placeholder

Covers: R6a, AC6a

- **Test first** — `ArchiveStrip.test.tsx`: render one entry with
  `answer: null`, `outcome: 'in-play'`, `label: 'Today'`, and assert the card
  renders `'Today'` and `'In play'` and that neither a root nor a flavour string
  appears anywhere in the container. Run it: fails with
  `Cannot read properties of null (reading 'root')`.
- **Implement** — `ArchiveStrip.tsx`: render
  `entry.answer ? \`${entry.answer.root} ${entry.answer.flavour}\` : '—'` in the
  answer `<span>`, keeping the same typography so the card holds its height.
- **Green when** — the assertions pass and no answer text is present.
- **Refactor** — none.

#### Step B2 — The "in play" mark has its own tone

Covers: R6b, AC6c

- **Test first** — `ArchiveStrip.test.tsx`: assert the in-play card renders the
  text `'In play'`. Run it: fails before B1 with the same null error, passes
  after — so add a `MARK_TONE` entry and assert the mark renders.
- **Implement** — `ArchiveStrip.tsx`: add `'in-play': 'text-warm'` to
  `MARK_TONE`, which is otherwise a non-exhaustive `Record<Outcome, string>` and
  will not compile without it.
- **Green when** — the mark renders and `tsc` is clean.
- **Refactor** — none. The tone remains a second channel: `outcomeMark` already
  says "In play" in words.

#### Step B3 — Today alone suppresses the empty state

Covers: R7, AC8, AC9

- **Test first** — `ArchiveStrip.test.tsx`: render with a single today entry and
  assert `screen.queryByText(/No grooves behind you yet/)` is null and one card
  renders; then render with `entries: []` and assert the empty-state text is
  present. Run it: the first fails if the empty state keys off anything other
  than `entries.length === 0`.
- **Implement** — `ArchiveStrip.tsx`: none expected — the existing guard is
  already `entries.length === 0`. If it passes unchanged, keep the test as the
  guard that stops a later "past days only" condition creeping in.
- **Green when** — both assert.
- **Refactor** — none.

#### Step B4 — Today takes one of the six slots

Covers: R9, AC10

- **Test first** — `ArchiveStrip.test.tsx`: render seven entries, today first,
  and assert six cards render and the `All 7` count shows. Run it: passes with
  the existing `SHOWN = 6` slice; it exists to pin that today is not rendered in
  addition to the six.
- **Implement** — none.
- **Green when** — both assert.

### Track C — Integration

#### Step C1 — The puzzle test admits today to the archive

Covers: R1, R5, R8, AC7, AC10

- **Test first** — `GroovePuzzle.test.tsx`: rewrite
  `shows past days in the archive, and today only as the puzzle` as
  *shows past days, and today once it is finished* — solve today through the UI
  and assert a card labelled "Today" appears in the strip without a reload, and
  that the count includes it. Add a case asserting that after three wrong
  guesses the card appears marked "In play" with no answer text, and that the
  guessing card is still interactive and a fourth guess is recorded — R5's
  no-lock guarantee, which is the requirement most at risk from this epic.
- **Implement** — none. `GroovePuzzle` already passes the full result set to
  `toArchiveEntries`.
- **Green when** — the suite is green.
- **Refactor** — none.

#### Step C2 — The page test's empty-state case still holds

Covers: R7, AC9

- **Test first** — `src/app/page.test.tsx`: `shows the archive's empty state on a
  first visit` must still pass — a first visit has no attempts, so today is not
  admitted and the empty state is correct.
- **Implement** — none.
- **Green when** — it passes unmodified. If it fails, `isFinished` is admitting
  a zero-attempt day and A3 did not.

## Integration and verification

- `npm test`, `npm run lint`, `npm run build` green.
- Demo path, from the PRD: on a fresh day, guess wrong three times. A card
  appears at the front of "Grooves you've played" labelled "Today", marked
  "In play", showing "—" where an answer would be — and the puzzle above is
  still playable. Guess correctly on the fourth: the same card, in the same
  position, now shows the answer and reads "4 tries". Reload: it is still there.
- Adversarial check for R6a: with the card showing, search **the archive row**
  for the day's root and flavour; neither may appear there. The sweep is scoped
  to the row, not the whole page, because the page legitimately renders both
  elsewhere: the guess card lists all twelve roots, the day's flavour is always
  among the four options, and after two misses the nudge announces the root
  outright. AC6a scopes the rule to the row for exactly this reason. Keep the
  check honest by ensuring no other card in view prints the same root or
  flavour, or it passes vacuously.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A2, C1 |
| R2 | A3 |
| R3 | A1 |
| R4 | A1 |
| R5 | C1 |
| R6 | A5 |
| R6a | A4, A5, B1 |
| R6b | A6, B2 |
| R6c | A7 |
| R7 | B3, C2 |
| R8 | C1 |
| R9 | B4 |
| R10 | A7 |
| AC1 | A1 |
| AC2 | A2 |
| AC3 | A3 |
| AC4 | A3 |
| AC5 | A1 |
| AC6 | A5 |
| AC6a | A4, B1 |
| AC6b | A5 |
| AC6c | A6, B2 |
| AC6d | A7 |
| AC7 | C1 |
| AC8 | B3 |
| AC9 | B3, C2 |
| AC10 | B4, C1 |
| AC11 | A7 |

## Assumptions

- The placeholder for a withheld answer is an em dash, styled like the answer it
  replaces so the card keeps its height and the grid does not go ragged.
- `outcomeOf` takes `today` as a second parameter rather than reading a clock.
- `isFinished` uses `>= 3` rather than `=== 3`, so a record that somehow carries
  four attempts without a solve is still admitted.
- The `SHOWN = 6` cap is unchanged.
- Sorting is unchanged: ISO dates compare lexicographically, and today's date
  string is the largest, so it sorts first with no special case.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only.

### Cycle 1 — 2026-08-30

**Q1. How is "in play" modelled on the entry?**
Decision: **A) `Outcome` gains `'in-play'`** — outcome is already the one field
that decides the mark and the tone, and the PRD's lifecycle treats in-play as a
state of the card rather than a flag on it. The two exhaustive maps
(`outcomeMark`'s switch and `ArchiveStrip`'s `MARK_TONE`) turn the addition into
a compiler checklist rather than a search.
Changed: nothing. Contracts, Steps A6 and B2 were drafted against this; it is
now settled, and Epic 5 renders against the four-member union.
Rejected because: a parallel `inPlay` or `isToday` flag can disagree with the
outcome — an entry could read `missed` and `inPlay` at once — and pushes the
invariant into the component, where it could only be tested through a render.

**Q2. Where is the answer withheld?**
Decision: **A) `lib/` returns `answer: null`, and `ArchiveEntry['answer']`
becomes `Answer | null`** — the component cannot leak what it was never given,
the rule is asserted directly as logic, and the compiler finds every consumer.
Changed: nothing. Contracts and Steps A4, A5 and B1 were drafted against this.
Cost accepted: the nullable field is a breaking contract change, and every
consumer reading `entry.answer.root` must narrow first. There is exactly one,
in `ArchiveStrip`, which Step B1 fixes.
Rejected because: keeping the answer in the props and relying on a branch not to
print it leaves the day's answer in the render tree — and this is the
requirement the PRD identifies as the one that can break the game.
