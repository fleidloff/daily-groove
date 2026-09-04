# Tech spec — Epic 1: Every groove before any repeat

PRD: [../prd/epic-1-every-groove-before-any-repeat.md](../prd/epic-1-every-groove-before-any-repeat.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

`selectGrooveForDate` keeps its signature and loses its body. Instead of hashing
the ISO day into an index, it turns the day into an integer count from a fixed
epoch, splits that into a lap number and a position within the lap, shuffles the
catalogue deterministically with the lap as the seed, and takes the groove at
that position. Every groove appears once per lap because a shuffle is a
permutation — R1 is a property of the construction, not a check bolted on.

The one piece that is not free is the seam: laps are shuffled independently, so
lap *n+1* can open on the groove lap *n* closed with. A bounded, deterministic
retry re-derives that lap's order with a bumped seed until the two differ.

The shuffle already exists. `lib/theory/options.ts` has `mulberry32` and
`seededShuffle` as private helpers for the daily option row; this epic exports
`seededShuffle` rather than writing a second Fisher–Yates two directories away.

## Architecture

```
isoDate(date)  ──► dayIndexOf(iso) ──┬─► lap      = ⌊dayIndex / N⌋ ──► orderFor(lap, grooves)
                                     └─► position = dayIndex mod N ──────────┐
                                                                             ▼
                                                                    order[position]
```

`dayIndexOf` parses the ISO day at noon local — the same noon-anchored parse
`streak.ts` already uses to dodge DST — and divides by 86 400 000. Noon means a
±1h shift can never cross a day boundary, so the index is stable for a calendar
day regardless of when in it the page is opened.

`orderFor(lap, grooves)` is where the seam guard lives. It shuffles with seed
`lap:<n>`, compares its first element against the last element of the previous
lap's shuffle, and on a collision **swaps `order[0]` with `order[1]`**.

Swapping rather than reshuffling is what keeps the guard cheap and terminating.
A reshuffle would change the lap's *last* element too, so the next lap's guard
would need this lap's corrected order — which needs the one before it, and so on
back to lap 0: ~1,300 stack frames today and one more every day. Swapping the
first two slots never touches the last, which establishes the invariant *a lap
always closes on the groove its own shuffle put there*. The guard therefore only
ever needs the previous lap's raw shuffle: two shuffles, no recursion, constant
cost, and no retry cap needed. A catalogue of two is a separate branch — strict
alternation is the only repeat-free sequence, and there is no non-terminal slot
to swap into.

Nothing reads storage, and `hashString` is imported, never edited — it seeds the
groove generator too, and `src/lib/hash.test.ts` pins it against a fixed table.

## Contracts

Frozen before the tracks start.

```ts
// src/features/daily-groove/lib/theory/options.ts
/** Deterministically shuffle a copy of `items`. Was private; now exported. */
export function seededShuffle<T>(items: T[], seed: string): T[]
```

```ts
// src/features/daily-groove/lib/puzzle/selectGroove.ts
/** Days from 1970-01-01 to the given ISO calendar day. */
export function dayIndexOf(iso: string): number

/** Unchanged signature — callers do not move. */
export function selectGrooveForDate(date: Date, grooves: Groove[]): Groove
```

`GroovePuzzle` keeps calling `selectGrooveForDate(new Date(), GROOVES)`. No
component, hook or store changes in this epic.

## Tracks

### Track A — The shuffle becomes shared

- **Goal** — `seededShuffle` is exported and proven deterministic from outside
  its own module.
- **Owns** — `src/features/daily-groove/lib/theory/options.ts` and its test.
- **Depends on** — nothing.
- **Parallel with** — Track B, which builds against the contract.
- **Done when** — `options.test.ts` passes, including the existing
  `buildOptions` cases, which must not change behaviour.

### Track B — The pick becomes a rotation

- **Goal** — `selectGrooveForDate` walks the whole catalogue before repeating.
- **Owns** — `src/features/daily-groove/lib/puzzle/selectGroove.ts` and its test.
- **Depends on** — the `seededShuffle` contract only. Until Track A lands, Track
  B's test file can import it and fail to compile; that is the red state the
  first step expects.
- **Parallel with** — Track A.
- **Done when** — `selectGroove.test.ts` passes without any component rendering.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B
- **Wave 2:** Integration — the structural check and the manual demo.

## Implementation

### Track A — The shuffle becomes shared

#### Step A1 — `seededShuffle` is importable and deterministic

Covers: R8, AC8

- **Test first** — `src/features/daily-groove/lib/theory/options.test.ts`: add
  `describe('seededShuffle')` asserting `seededShuffle([1,2,3,4,5], 'lap:0')`
  equals itself on a second call, and differs from `seededShuffle([1,2,3,4,5],
  'lap:1')`. Run it: fails with `seededShuffle is not exported from
  './options'` (TS2305).
- **Implement** — `options.ts`: change `function seededShuffle` to `export
  function seededShuffle`. Nothing else moves; `mulberry32` stays private
  because nothing outside needs a raw PRNG.
- **Green when** — both assertions pass and every existing `buildOptions` case
  still passes untouched.
- **Refactor** — none.

#### Step A2 — Only one shuffle exists in the tree

Covers: R8, AC8

- **Test first** — `options.test.ts`: read `src/` from disk and assert that
  exactly one file contains the Fisher–Yates marker `for (let i = out.length -
  1; i > 0; i--)`. Run it: passes trivially today, and is what fails if Track B
  ever copies the algorithm instead of importing it.
- **Implement** — none.
- **Green when** — the count is 1.
- **Refactor** — none.

### Track B — The pick becomes a rotation

#### Step B1 — A day becomes an integer

Covers: R3, AC3

- **Test first** — `src/features/daily-groove/lib/puzzle/selectGroove.test.ts`:
  assert `dayIndexOf('1970-01-01') === 0`, `dayIndexOf('1970-01-02') === 1`, and
  that `dayIndexOf('2026-03-29') + 1 === dayIndexOf('2026-03-30')` — a European
  DST transition. Run it: fails with `dayIndexOf is not a function`.
- **Implement** — `selectGroove.ts`: add `dayIndexOf(iso)`, parsing the ISO day
  to a local `Date` at 12:00:00 exactly as `streak.ts`'s `parseIsoDate` does,
  then `Math.floor(ms / 86_400_000)`. **`Math.floor`, not `Math.round`.** The
  ratio is `days + (12 - utcOffset)/24`: under `TZ=UTC` the fraction is exactly
  `0.5`, so `Math.round` returns `1` for `1970-01-01` and fails this step's own
  assertion — green on a Europe/Berlin laptop, red in a UTC CI. Worse, in
  Europe/London the fraction crosses `0.5` at the DST transition, collapsing two
  calendar days onto one index, which is the exact bug this step exists to
  prevent. The noon anchor does the DST work; the rounding mode must not undo
  it.
- **Green when** — all three assertions pass.
- **Refactor** — none yet. Step B6 revisits the duplication with `streak.ts`.

#### Step B2 — A lap covers the whole catalogue

Covers: R1, R2, AC1, AC2

- **Test first** — `selectGroove.test.ts`: build 16 fake grooves; for a start
  date, collect `selectGrooveForDate` over 16 consecutive days and assert the
  set of ids equals all 16. Assert a second call for one of those dates returns
  the same groove. Run it: fails — the current `% length` pick returns 12
  distinct ids.
- **Implement** — `selectGroove.ts`: replace the body with `dayIndexOf` →
  `lap`/`position` → `orderFor(lap, grooves)[position]`. Add a private
  `orderFor(lap, grooves)` that returns `seededShuffle(grooves, \`lap:${lap}\`)`,
  imported from `../theory/options`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B3 — Two laps give every groove exactly twice

Covers: R5, AC5

- **Test first** — `selectGroove.test.ts`: over 32 consecutive days with 16
  grooves, assert every id appears exactly twice. Run it: passes if B2 is
  right; it exists to pin R5's fixed-lap promise against a later change.
- **Implement** — none.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step B4 — A lap never opens on the groove the last one closed

Covers: R4, AC4

- **Test first** — `selectGroove.test.ts`: for every lap boundary in the first
  **5,000 days**, assert the groove on the boundary day differs from the day
  before. Run it: fails on at least one boundary — independent shuffles collide
  roughly one lap in `N`.
- **Span matters.** A 200-day window is *vacuous* at 16 or 18 grooves: the first
  collision falls outside it, so the assertion passes with the guard deleted.
  Verify by mutation — comment the guard out and confirm the test goes red
  before trusting it.
- **Implement** — `selectGroove.ts`: in `orderFor`, take the previous lap's raw
  shuffle and, if `order[0].id === previous[previous.length - 1].id`, swap
  `order[0]` with `order[1]`. Never reshuffle, and never touch the last slot —
  see Architecture for why that would recurse to lap 0 and overflow the stack.
  Short-circuit for `lap === 0` and branch separately for `grooves.length === 2`,
  where alternation is forced.
- **Green when** — all 200 boundaries differ, and B2/B3 stay green — the guard
  reorders a lap, so it must not break the permutation property.
- **Refactor** — none. `orderFor` recomputing the previous lap doubles the work
  on a boundary day and is one shuffle of ≤32 items once per page load.

#### Step B5 — Degenerate catalogues behave

Covers: R7, AC7

- **Test first** — `selectGroove.test.ts`: assert `selectGrooveForDate(date,
  [])` throws `selectGrooveForDate: grooves must not be empty`, and that a
  one-groove catalogue returns that groove on ten consecutive days without
  hanging. Run it: the empty case passes (the guard is already there); the
  one-groove case fails or hangs if B4's short-circuit is missing.
- **Implement** — `selectGroove.ts`: keep the existing empty-array throw ahead
  of everything else; confirm the `grooves.length < 2` short-circuit from B4.
- **Green when** — both assertions pass and the suite completes in normal time.
- **Refactor** — none.

#### Step B6 — A grown catalogue keeps its guarantees

Covers: R6, R6a, AC6

- **Test first** — `selectGroove.test.ts`: with 18 fake grooves, assert AC1 and
  AC4 hold over 18 consecutive days and across a boundary. Separately, assert
  that the same date can yield a different groove for a 16-groove and an
  18-groove catalogue — the accepted cost of a size change, pinned so nobody
  later mistakes it for a bug. Run it: passes if B2–B4 are size-agnostic; fails
  if any `16` was hardcoded.
- **Implement** — none expected. If a literal crept in, replace it with
  `grooves.length`.
- **Green when** — all assertions pass.
- **Refactor** — extract the noon-anchored ISO parse if `streak.ts`'s copy and
  this one have visibly diverged; otherwise leave both, since `streak.ts` is
  persistence and this is puzzle selection, and `docs/architecture.md` prefers a
  small duplication to a new cross-concern module.

## Integration and verification

- **Step I1 — `hashString` was consumed, not edited.** Covers R2, AC9. Run
  `npx vitest run src/lib/hash.test.ts`. It must pass with the file unmodified;
  `git diff --stat src/lib/hash.ts` must be empty.
- **Step I2 — the page still resolves a groove.** Covers R2. Run the existing
  `GroovePuzzle.test.tsx` suite unchanged. `selectGrooveForDate`'s signature did
  not move, so no component test should need editing — if one does, the change
  leaked past the seam.
- **Demo path** — start `npm run dev`, and with the system date advanced one day
  at a time, reload and read the groove name off the card. Across a full lap
  every name in the catalogue appears once; the name on the first day of the
  next lap differs from the last day of the previous one.
- **Full suite** — `npm test`, `npm run lint`, `npm run build` all clean.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B2, B6 |
| R2 | B2, I1, I2 |
| R3 | B1 |
| R4 | B4, B6 |
| R5 | B3 |
| R6 | B6 |
| R6a | B6 |
| R7 | B5 |
| R8 | A1, A2 |
| AC1 | B2, B6 |
| AC2 | B2 |
| AC3 | B1 |
| AC4 | B4, B6 |
| AC5 | B3 |
| AC6 | B6 |
| AC7 | B5 |
| AC8 | A1, A2 |
| AC9 | I1 |

## Assumptions

- `dayIndexOf` lives in `selectGroove.ts` beside `isoDate`, not in `src/lib/`.
  It is puzzle selection, and `src/lib/` is the leaf the generator shares — a
  date helper the generator never calls does not belong there.
- The seam guard needs no retry cap. A single swap either fixes the collision or
  the catalogue has fewer than two grooves, so there is no loop to bound.
- Test catalogues are hand-built `Groove` literals in the test file, not
  imports of `GROOVES` — the pick must be provably size-agnostic, and Epic 4
  changes the real catalogue underneath.
- The existing `isoDate` export and its semantics are untouched.
