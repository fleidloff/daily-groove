# Tech spec — Epic 5: The archive strip, and the day you already played

PRD: [../prd/epic-5-archive-and-the-day-you-already-played.md](../prd/epic-5-archive-and-the-day-you-already-played.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three separable pieces. The record shape and the v2 store are pure data behind
feature-1's existing `ResultStore` seam, which does not change. The archive card
and its grid are presentational primitives. The wiring — persist each attempt as
it happens, restore the day on load — is the only part that needs both, and it is
where the real risk lives, so it gets the most explicit steps.

Storage is already versioned and `readEnvelope` already falls back to empty on a
version mismatch, so a v2 key plus a `version: 2` envelope is a clean break with no
migration code. A stale v1 blob is simply never read.

## Architecture

```
src/features/daily-groove/
  types.ts             DailyResult v2                            (Track A)
  lib/storage.ts       v2 key + envelope, same ResultStore API   (Track A)
  lib/streak.ts        isQualifying rewritten                    (Track A)
  lib/archive.ts  NEW  toArchiveEntries, dayLabel, outcomeMark   (Track A)
  hooks/useProgress.ts persist-per-attempt + restore             (Track C)
  components/ArchiveStrip.tsx  NEW                               (Track C)
  components/HistoryView.tsx       DELETED
src/components/
  MiniCard.tsx, SectionLabel.tsx                                 (Track B)
```

A day's outcome is derived at read time rather than stored: a record whose date is
before today and whose `solved` is false is a miss. Nothing has to run at midnight,
and no background job decides a day is over.

Restoration keeps `ResultStore`'s async interface intact. `GroovePuzzle` creates
Epic 2's store empty, renders a loading state while `useProgress` reads the day's
record, and then calls the store's `hydrate(record)` in an effect once loading
completes. Nothing reads `localStorage` synchronously, so the PRD's assumption
that a server-backed store could drop in behind the same interface survives —
and feature-1 already renders a loading state while today's groove resolves, so
the pattern is not new to this codebase.

## Contracts

```ts
// src/features/daily-groove/types.ts
export type DailyResult = {
  date: string            // ISO "YYYY-MM-DD"
  answer: Answer          // the day's correct pair
  attempts: Attempt[]
  solved: boolean
}

// src/features/daily-groove/lib/storage.ts — unchanged interface
export type ResultStore = {
  get(date: string): Promise<DailyResult | null>
  getAll(): Promise<DailyResult[]>
  save(result: DailyResult): Promise<void>
}
const STORAGE_KEY = 'daily-groove:v2:results'   // envelope { version: 2, byDate }

// src/features/daily-groove/lib/archive.ts
export type Outcome = 'first-try' | 'solved' | 'missed'
export type ArchiveEntry = {
  date: string
  label: string           // "Yesterday", "Thu", or a date
  answer: Answer
  outcome: Outcome
  tries: number
}
export function toArchiveEntries(results: DailyResult[], today: string): ArchiveEntry[]
```

- `SectionLabel({ children, action? })`
- `MiniCard({ children })`
- `ArchiveStrip({ entries, total })`

## Tracks

### Track A — Records, storage, streak, archive shaping

- **Goal** — the v2 record and store, the new streak rule, and the pure shaping of
  results into archive entries.
- **Owns** — `types.ts`, `lib/storage.ts`, `lib/streak.ts`, `lib/archive.ts` and
  their tests
- **Depends on** — Epic 2's `Answer` and `Attempt` contracts only
- **Parallel with** — Track B
- **Done when** — its tests pass with no UI present.

### Track B — Archive presentation primitives

- **Goal** — `SectionLabel` and `MiniCard`, generic and domain-free.
- **Owns** — `src/components/SectionLabel.tsx`, `MiniCard.tsx` and their tests
- **Depends on** — Epic 1's token names only
- **Parallel with** — Track A
- **Done when** — its tests pass with no feature code present.

### Track C — Persistence wiring and the strip

- **Goal** — attempts persist as they happen, the day restores on load, and the
  archive renders.
- **Owns** — `hooks/useProgress.ts`, `components/ArchiveStrip.tsx`,
  `components/GroovePuzzle.tsx`, and the deletion of `HistoryView.tsx`
- **Depends on** — Tracks A and B as built code
- **Parallel with** — none

## Execution waves

- **Wave 1 (parallel):** Track A, Track B
- **Wave 2:** Track C
- **Wave 3:** Integration

## Implementation

### Track A — Records, storage, streak, archive shaping

#### Step A1 — The v2 store round-trips a record

Covers: R1

- **Test first** — `lib/storage.test.ts`: replace the attribute-shaped fixtures —
  save a `DailyResult` with an answer, two attempts and `solved: false`, then
  assert `get` returns it intact and `getAll` includes it. Run it: fails, the
  fixture no longer type-checks.
- **Implement** — `types.ts`: replace `DailyResult` with the contract shape.
  `lib/storage.ts`: bump to `daily-groove:v2:results` and `version: 2`.
- **Green when** — the record round-trips unchanged.
- **Refactor** — none.

#### Step A2 — A feature-1 blob is ignored, not read

Covers: R5, AC4

- **Test first** — same file: write a v1 envelope under the old key and a v1-shaped
  blob under the new key, then assert `getAll()` returns an empty array and nothing
  throws. Run it: fails, the old shape is returned.
- **Implement** — `lib/storage.ts`: `readEnvelope` accepts only `version === 2`.
- **Green when** — both stale shapes yield empty.
- **Refactor** — none.

#### Step A3 — A failing write does not throw

Covers: R6, AC5

- **Test first** — same file: with `localStorage.setItem` throwing, assert
  `save()` resolves rather than rejecting. Run it: passes if feature-1's try/catch
  survived the rewrite — which is what the assertion guards.
- **Implement** — `lib/storage.ts`: keep the best-effort write.
- **Green when** — the promise resolves.
- **Refactor** — none.

#### Step A4 — A day qualifies for the streak when it was solved

Covers: R7, AC6

- **Test first** — `lib/streak.test.ts`: assert `isQualifying` is true for a solved
  record regardless of attempt count and false for an unsolved one; assert
  `computeStreak` gives two for yesterday-and-today solved, and one when yesterday
  was unsolved. Run it: fails, `isQualifying` reads `correctness`.
- **Implement** — `lib/streak.ts`: `isQualifying` returns `r.solved`.
  `computeStreak` is otherwise unchanged.
- **Green when** — all four cases hold.
- **Refactor** — none.

#### Step A5 — Past days shape into archive entries

Covers: R8, R9, R10, AC7

- **Test first** — `lib/archive.test.ts`: given records for today, yesterday and
  three days back, assert `toArchiveEntries` excludes today, orders most-recent
  first, and returns one entry per past day. Run it: fails, not a function.
- **Implement** — `lib/archive.ts`: filter, sort descending.
- **Green when** — today is absent and the order is right.
- **Refactor** — none.

#### Step A6 — Outcomes distinguish first-try, solved and missed

Covers: R10, R11, AC8

- **Test first** — same file: assert a past day solved in one attempt is
  `first-try`, one solved in three is `solved` with `tries` of three, and a past day
  with attempts but `solved: false` is `missed`. Run it: fails, `outcome` is
  undefined.
- **Implement** — `lib/archive.ts`: derive outcome from `solved` and attempt count.
- **Green when** — all three outcomes come back.
- **Refactor** — none.

#### Step A7 — A missed day still carries its answer

Covers: R11, AC9

- **Test first** — same file: assert a missed entry's `answer` is the day's correct
  pair, not the last guess. Run it: fails if the answer was taken from an attempt.
- **Implement** — `lib/archive.ts`: read `answer` straight off the record — which
  is why the record stores it rather than recomputing from the groove.
- **Green when** — the answer survives on a missed day.
- **Refactor** — none.

#### Step A8 — Day labels are relative, then absolute

Covers: R9

- **Test first** — same file: with a fixed today, assert the previous day labels as
  "Yesterday", four days back as its weekday name, and twenty days back as a date.
  Run it: fails, labels are raw ISO strings.
- **Implement** — `lib/archive.ts`: `dayLabel(date, today)` via `Intl`.
- **Green when** — all three forms come back.
- **Refactor** — none.

### Track B — Archive presentation primitives

#### Step B1 — `SectionLabel` renders an eyebrow and an optional action

Covers: R8, R14, AC13

- **Test first** — `src/components/SectionLabel.test.tsx`: assert the label renders
  and that an `action` node renders to its right when given. Run it: fails, module
  not found.
- **Implement** — `src/components/SectionLabel.tsx`.
- **Green when** — both cases render.
- **Refactor** — none.

#### Step B2 — `MiniCard` is a small surface

Covers: R8, R14, AC13

- **Test first** — `src/components/MiniCard.test.tsx`: assert children render on a
  bordered surface using tokens. Run it: fails, module not found.
- **Implement** — `src/components/MiniCard.tsx`.
- **Green when** — children render.
- **Refactor** — none.

#### Step B3 — The grid narrows on small screens

Covers: R13, AC12

- **Test first** — `src/components/MiniCard.test.tsx`: assert the grid wrapper is
  single- or two-column at the base breakpoint and six-column only above it. Run
  it: fails, the grid is unconditionally six-column.
- **Implement** — the grid wrapper, base-narrow.
- **Green when** — the narrow case is the default.
- **Refactor** — none.

### Track C — Persistence wiring and the strip

#### Step C1 — Each attempt is persisted as it happens

Covers: R2, AC1

- **Test first** — `hooks/useProgress.test.ts`: guess wrong once and assert the
  store holds a record for today with one attempt, before any solve. Run it: fails,
  nothing is written until a result is built.
- **Implement** — `hooks/useProgress.ts`: expose `recordAttempt(attempt)` writing
  the day's record after every check.
- **Green when** — the record exists mid-game.
- **Refactor** — remove feature-1's save-on-submit path.

#### Step C2 — Reloading restores the attempts spent

Covers: R3, AC1, AC2

- **Test first** — `components/GroovePuzzle.test.tsx`: seed storage with a
  two-attempt unsolved record for today, mount, await the loaded state, and assert
  two dots are spent and the feedback matches the second attempt; then guess again
  and assert it is recorded as the third attempt. Run it: fails, the puzzle starts
  fresh.
- **Implement** — `GroovePuzzle`: call `store.hydrate(todayResult)` in an effect
  keyed on `useProgress`'s `loaded` flag.
- **Green when** — the dots and the attempt count survive the remount.
- **Refactor** — none.

#### Step C3 — Reloading a solved day reopens the panel

Covers: R4, AC3

- **Test first** — same file: seed storage with a solved record for today, mount,
  and assert the solved panel renders and the chips do not respond to clicks. Run
  it: fails, the puzzle offers a fresh game.
- **Implement** — `GroovePuzzle`: hydration sets `solved`, which Epic 2 already
  uses to lock the card and Epic 4 to render the panel.
- **Green when** — the finished day reopens finished.
- **Refactor** — none.

#### Step C3a — The puzzle waits rather than flashing an empty game

Covers: R3, R4

- **Test first** — same file: with a slow store, assert that before `loaded` the
  puzzle renders a loading state and renders neither an unspent dot row nor the
  solved panel — so a restored day never flashes as a fresh one. Run it: fails, the
  empty game paints first.
- **Implement** — `GroovePuzzle`: render the loading state until `useProgress`
  reports loaded, then the hydrated game.
- **Green when** — no fresh-game frame appears before hydration.
- **Refactor** — none.

#### Step C4 — The archive renders past days

Covers: R8, R9, R10, R11, AC7, AC8, AC9, AC10

- **Test first** — `components/ArchiveStrip.test.tsx`: render three entries — one
  first-try, one solved in three, one missed — and assert each card shows its
  label, its mark and its answer, that the marks differ by text and not only
  colour, and that no card contains a sparkline or bar graphic. Run it: fails,
  module not found.
- **Implement** — `components/ArchiveStrip.tsx`: `SectionLabel` plus a grid of
  `MiniCard`s.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step C5 — An empty history shows the empty state

Covers: R12, AC11

- **Test first** — same file: render with no entries and assert the designed empty
  wording renders and no grid does. Run it: fails, an empty grid renders.
- **Implement** — `ArchiveStrip`: early return for the empty case.
- **Green when** — the empty state renders.
- **Refactor** — none.

#### Step C6 — `HistoryView` is gone

Covers: R (retirement)

- **Test first** — `index.test.ts`: assert `HistoryView` no longer resolves and the
  puzzle renders `ArchiveStrip` instead. Run it: fails, the module still exists.
- **Implement** — delete `components/HistoryView.tsx` and its test; wire
  `ArchiveStrip` into `GroovePuzzle` from `toArchiveEntries(history, today)`.
- **Green when** — nothing references it.
- **Refactor** — none.

## Integration and verification

#### Step I1 — The archive components stay domain-free

Covers: R14, AC13

- **Test first** — `src/design-system.test.ts`: confirm `SectionLabel` and
  `MiniCard` pass the existing no-domain-vocabulary guard. Run it: fails if a
  musical prop leaked.
- **Implement** — rename.
- **Green when** — the guard passes.

#### Step I2 — The demo path, by hand

- `npm test`, `npm run build` — green.
- `npm run dev`: guess wrong twice, reload, and confirm both dots are still spent
  and you continue from the third attempt; solve the day, reload, and confirm the
  panel reopens with the card locked. Seed a couple of past days, and confirm they
  appear as cards with their marks and answers, including a missed day showing its
  answer. Clear site data and confirm the empty state. Narrow to 375px and confirm
  the grid reflows.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1 |
| R2 | C1 |
| R3 | C2, C3a |
| R4 | C3, C3a |
| R5 | A2 |
| R6 | A3 |
| R7 | A4 |
| R8 | A5, B1, B2, C4 |
| R9 | A5, A8, C4 |
| R10 | A6, C4 |
| R11 | A6, A7, C4 |
| R12 | C5 |
| R13 | B3 |
| R14 | B1, B2, I1 |
| AC1 | C1, C2 |
| AC2 | C2 |
| AC3 | C3 |
| AC4 | A2 |
| AC5 | A3 |
| AC6 | A4 |
| AC7 | A5, C4 |
| AC8 | A6, C4 |
| AC9 | A7, C4 |
| AC10 | C4 |
| AC11 | C5 |
| AC12 | B3 |
| AC13 | B1, B2, I1 |

## Assumptions

- The v2 envelope lives under a new key rather than reusing the v1 key, so a
  downgrade would still find its old data intact; the v1 blob is left in place
  rather than deleted.
- `DailyResult` stores the day's `answer` rather than recomputing it from the
  groove at read time, so a missed day can show its answer without the archive
  needing the seed set — and so a reseeded groove cannot retroactively rewrite
  history.
- A day is "past" by ISO date comparison against today's local date, consistent
  with feature-1's `isoDate`.
- Every attempt triggers a write of the whole day record; at a handful of attempts
  a day this is far below any level where batching would matter.
- The archive renders the six most recent past days with the real total in the
  section label, and no link, since no archive route exists.
- The loading state reuses whatever feature-1 already renders while today's groove
  resolves, rather than introducing a second loading treatment.
- `hydrate` replaces store state wholesale rather than merging, so restoring is
  idempotent and a second call with the same record is a no-op in effect.

## Decision log

### Cycle 1 — 2026-08-29

**Q1. How does the restored day reach Epic 2's store?**
Decision: **A) Create the store empty, then hydrate it from the loaded record in an
effect, rendering a loading state until `useProgress` reports loaded** — it keeps
`ResultStore`'s promise interface intact, which the PRD's future server-backed
store depends on, and reuses the loading pattern feature-1 already has.
Changed: Architecture describes the hydration flow; Step C2 now hydrates via the
store's `hydrate` method behind the `loaded` flag; new Step C3a asserts no
fresh-game frame paints before hydration; R3 and R4 coverage gains C3a. The
`hydrate` method itself is pinned in Epic 2's contract so it is not added to a
frozen interface mid-flight.
