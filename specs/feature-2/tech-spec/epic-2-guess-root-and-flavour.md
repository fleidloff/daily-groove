# Tech spec — Epic 2: Guess the root and the flavour

PRD: [../prd/epic-2-guess-root-and-flavour.md](../prd/epic-2-guess-root-and-flavour.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

The domain rewrite comes first and is pure: types, answer derivation, per-day
option narrowing, and pair scoring all live in `lib/` and are testable without a
browser. The chip primitives are independent of it and can be built at the same
time. Only the guessing card needs both, so it goes last.

The old subset-guessing model is deleted rather than adapted. Keeping `Attribute`
alive alongside a root/flavour model would leave two vocabularies in one feature
and two shapes in one store, which is the kind of ambiguity that makes Epics 3–5
harder to write than they need to be.

`buildOptions(correct, pool, seed, count = 4)` already returns the correct answer
plus deterministic distractors, four by default, seeded by a string. It survives
untouched and does the whole of the flavour narrowing.

## Architecture

```
src/features/daily-groove/
  types.ts                  Root, Flavour, Answer, Attempt        (Track A)
  lib/music.ts        NEW   parseScale, ROOTS, flavourPool        (Track A)
  lib/scoring.ts            scoreAttempt — rewritten              (Track A)
  lib/options.ts            buildOptions — unchanged
  hooks/useDailyGrooveStore.ts   new store shape                  (Track A)
  components/GuessCard.tsx  NEW   the "What is it?" card          (Track C)
  components/AttributeSelector.tsx   DELETED
  components/AttributePicker.tsx     DELETED
src/components/
  Chip.tsx, ChipGroup.tsx, Button.tsx                             (Track B)
```

Answer derivation splits `Groove.scale` — `"G mixolydian"` — on its single space
into a root and a flavour, title-casing the flavour for display. The flavour pool
is computed once at module load by mapping every seeded groove's scale through the
same parser, so adding a groove with a new flavour widens the pool with no other
edit.

Deriving from `scale` rather than adding explicit `root`/`flavour` seed fields
keeps one source of truth. Two fields that must agree are two fields that can
disagree.

The day's game state lives in a Zustand store created per puzzle instance inside
`GroovePuzzle`, exactly as feature-1 does it — no module-level singleton, so
deleting `src/features/daily-groove/` leaves nothing behind and the architecture
doc's removability standard still holds. `GroovePuzzle` is the only component that
subscribes; it reads the store with `useStore` and passes plain values and handlers
down as props. `GuessCard` and every component Epics 3–5 add are therefore
presentational, testable by handing them props with no store in sight.

## Contracts

Frozen here; Epics 3–5 build against them.

```ts
// src/features/daily-groove/types.ts
export type Root =
  | 'C' | 'C♯' | 'D' | 'E♭' | 'E' | 'F'
  | 'F♯' | 'G' | 'A♭' | 'A' | 'B♭' | 'B'

export type Flavour = string          // title-cased, e.g. 'Dorian'

export type Answer = { root: Root; flavour: Flavour }

export type Attempt = {
  root: Root
  flavour: Flavour
  correct: boolean
  rootMatched: boolean               // Epic 3's feedback branches
  flavourMatched: boolean
}

// src/features/daily-groove/lib/music.ts
export const ROOTS: Root[]                       // all twelve, canvas order
export function parseScale(scale: string): Answer
export function flavourPool(grooves: Groove[]): Flavour[]

// src/features/daily-groove/lib/scoring.ts
export function scoreAttempt(answer: Answer, guess: Answer): Attempt

// src/features/daily-groove/hooks/useDailyGrooveStore.ts
// Created per puzzle instance in GroovePuzzle; never a module singleton.
export type DailyGrooveState = {
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  attempts: Attempt[]
  solved: boolean
  selectRoot(r: Root): void
  selectFlavour(f: Flavour): void
  check(): void
  canCheck(): boolean                // both chosen, pair not just tried, unsolved
  hydrate(result: DailyResult | null): void   // Epic 5 restores a day through this
}
```

`GuessCard` is presentational — it holds no store reference:

```ts
type GuessCardProps = {
  roots: Root[]
  flavours: Flavour[]
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  onSelectRoot(r: Root): void
  onSelectFlavour(f: Flavour): void
  canCheck: boolean
  onCheck(): void
  solved: boolean
  lastAttempt: Attempt | null
}
```

Design-system prop signatures, strict-props per Epic 1:

- `Chip({ label, selected, disabled, onSelect, width? })`
- `ChipGroup({ label, options, value, onSelect, disabled, name })`
- `Button({ children, onPress, disabled, tone: 'idle' | 'ready' | 'solved' })`

## Tracks

### Track A — Domain model

- **Goal** — types, parsing, the flavour pool, pair scoring, and the store.
- **Owns** — `types.ts`, `lib/music.ts`, `lib/scoring.ts`,
  `hooks/useDailyGrooveStore.ts` and their tests
- **Depends on** — Epic 1's widened `Groove` only
- **Parallel with** — Track B
- **Done when** — its tests pass with no UI present.

### Track B — Chip and button primitives

- **Goal** — `Chip`, `ChipGroup` and `Button` exist and are tested against their
  own contracts, with no musical vocabulary.
- **Owns** — `src/components/Chip.tsx`, `ChipGroup.tsx`, `Button.tsx` and tests
- **Depends on** — Epic 1's token names only
- **Parallel with** — Track A
- **Done when** — its tests pass with no feature code present.

### Track C — The guessing card

- **Goal** — the card composes the primitives over the store, and the old model is
  gone.
- **Owns** — `components/GuessCard.tsx`, `components/GroovePuzzle.tsx`, and the
  deletion of `AttributeSelector` and `AttributePicker`. `GroovePuzzle` owns the
  store; `GuessCard` receives props.
- **Depends on** — Tracks A and B as built code
- **Parallel with** — none
- **Done when** — the demo path works and the old components are deleted.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B
- **Wave 2:** Track C
- **Wave 3:** Integration and verification

## Implementation

### Track A — Domain model

#### Step A1 — A scale string parses into a root and a flavour

Covers: R6, AC4

- **Test first** — `src/features/daily-groove/lib/music.test.ts`: assert
  `parseScale('A dorian')` is `{ root: 'A', flavour: 'Dorian' }`, that
  `'G mixolydian'` gives `G` / `Mixolydian`, and that `'E♭ harmonic minor'` keeps
  the two-word flavour intact as `Harmonic minor`. Run it: fails, `parseScale` is
  not a function.
- **Implement** — `lib/music.ts`: split on the first space only; title-case the
  remainder.
- **Green when** — all three cases parse.
- **Refactor** — none.

#### Step A2 — Every seeded groove parses to a valid answer

Covers: R6

- **Test first** — same file: for every groove in `GROOVES`, assert `parseScale`
  returns a root present in `ROOTS` and a non-empty flavour. Run it: fails if any
  seed scale is malformed.
- **Implement** — `lib/music.ts`: export `ROOTS` in the canvas' order.
- **Green when** — all seven grooves parse cleanly.
- **Refactor** — none. This is the guard that a new groove cannot break the game.

#### Step A3 — The flavour pool comes from the seed data

Covers: R3

- **Test first** — same file: assert `flavourPool(GROOVES)` contains `Dorian` and
  `Locrian`, does not contain `Blues`, and has no duplicates. Run it: fails,
  `flavourPool` is not a function.
- **Implement** — `lib/music.ts`: map every groove through `parseScale`, dedupe,
  sort for stability.
- **Green when** — the pool matches the seed set exactly.
- **Refactor** — none.

#### Step A4 — The day's flavour options always include the answer

Covers: R3, R4, AC1, AC2, AC3

- **Test first** — `lib/music.test.ts`: for each of thirty consecutive dates,
  assert `flavourOptions(date, groove)` returns four entries including the
  groove's own flavour; assert calling it twice for one date returns an identical
  array. Run it: fails, `flavourOptions` is not a function.
- **Implement** — `lib/music.ts`: `flavourOptions` wraps `buildOptions(correct,
  flavourPool(GROOVES), isoDate(date))`.
- **Green when** — every date yields four options containing the answer, stably.
- **Refactor** — none.

#### Step A5 — A pair scores only when both halves match

Covers: R9, AC7, AC8

- **Test first** — `lib/scoring.test.ts`: replace the `scoreSelected` tests —
  assert `scoreAttempt({G,Dorian}, {G,Dorian})` is correct with both halves
  matched; `{G,Mixolydian}` is incorrect with `rootMatched` true and
  `flavourMatched` false; `{C,Dorian}` is the mirror; `{C,Mixolydian}` has both
  false. Run it: fails, `scoreAttempt` is not a function.
- **Implement** — `lib/scoring.ts`: rewrite the module around `scoreAttempt`;
  delete `scoreAttribute` and `scoreSelected`.
- **Green when** — all four cases score as asserted.
- **Refactor** — delete the old scoring tests.

#### Step A6 — The store holds one selection per group

Covers: R5, AC5

- **Test first** — `hooks/useDailyGrooveStore.test.ts`: replace the
  `toggleAttribute` tests — assert `selectRoot('G')` then `selectRoot('C')` leaves
  only `C` selected, and the same for flavours. Run it: fails, `selectRoot` is not
  a function.
- **Implement** — `hooks/useDailyGrooveStore.ts`: rewrite state to the contract.
- **Green when** — selection replaces rather than accumulates.
- **Refactor** — remove `selectedAttrs`, `guesses`, `toggleAttribute`, `setGuess`.

#### Step A7 — Checking is blocked until both halves are chosen

Covers: R7

- **Test first** — same file: assert `canCheck()` is false with nothing selected,
  false with only a root, and true once both are set. Run it: fails, `canCheck` is
  not a function.
- **Implement** — the store: `canCheck` requires both, and `!solved`.
- **Green when** — all three cases hold.
- **Refactor** — none.

#### Step A8 — The same wrong pair cannot be checked twice

Covers: R11, AC9

- **Test first** — same file: select G and Mixolydian, `check()`, then assert
  `canCheck()` is false while the selection is unchanged, and true again after
  `selectFlavour('Dorian')`. Run it: fails, `canCheck` still returns true.
- **Implement** — the store: `canCheck` also requires that the current pair does
  not equal the last attempt's pair.
- **Green when** — the repeat is blocked and a change unblocks it.
- **Refactor** — none.

#### Step A9 — Solving locks the day

Covers: R12

- **Test first** — same file: after checking the correct pair, assert `solved` is
  true, `canCheck()` is false, and that `selectRoot` no longer changes the
  selection. Run it: fails, selection still mutates.
- **Implement** — the store: guard both selectors and `check` on `!solved`.
- **Green when** — the day is inert once solved.
- **Refactor** — none.

### Track B — Chip and button primitives

#### Step B1 — A chip reports selection and respects disabled

Covers: R13, R14, AC12

- **Test first** — `src/components/Chip.test.tsx`: assert a chip renders its label
  as a button, that clicking calls `onSelect`, that `selected` sets
  `aria-pressed="true"`, and that `disabled` prevents the callback. Run it: fails,
  module not found.
- **Implement** — `src/components/Chip.tsx`: token-driven idle and selected
  treatments, `width` prop for the fixed-width case.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step B2 — A chip group is a labelled single-select

Covers: R1, R5, R13, AC11

- **Test first** — `src/components/ChipGroup.test.tsx`: assert the group exposes
  `role="radiogroup"` with its label as accessible name, renders one chip per
  option, marks only `value` as pressed, and is reachable and selectable by
  keyboard. Run it: fails, module not found.
- **Implement** — `src/components/ChipGroup.tsx`: composes `Chip`, wires roving
  selection, forwards `disabled`.
- **Green when** — the group is operable without a pointer.
- **Refactor** — retire the old `OptionGroup` once nothing imports it.

#### Step B3 — The button carries three tones

Covers: R7, R8, R12

- **Test first** — `src/components/Button.test.tsx`: assert the three tones produce
  distinct class strings, that `disabled` blocks `onPress` and sets the disabled
  attribute, and that children render. Run it: fails, module not found.
- **Implement** — `src/components/Button.tsx`: full-width control using the accent,
  faint and soft tokens.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step B4 — Chips wrap without overflowing

Covers: R15, AC13

- **Test first** — `src/components/ChipGroup.test.tsx`: assert the group's wrapper
  carries wrapping and that no fixed width is applied to the container. Run it:
  fails, the wrapper is a non-wrapping row.
- **Implement** — `ChipGroup`: wrapping flex with token gap.
- **Green when** — the guard passes.
- **Refactor** — none.

### Track C — The guessing card

#### Step C1 — The card offers twelve roots and four flavours

Covers: R1, R2, R3, AC1

- **Test first** — `components/GuessCard.test.tsx`: render with `roots={ROOTS}`
  and a four-entry `flavours` prop — no store — and assert a group labelled "Root"
  holds twelve chips and one labelled "Flavour" holds exactly four. Run it: fails,
  module not found.
- **Implement** — `components/GuessCard.tsx`: a `Card` with two `ChipGroup`s driven
  entirely by props, per the `GuessCardProps` contract.
- **Green when** — the counts and the answer's presence hold.
- **Refactor** — none.

#### Step C2 — The control names the pair once both are chosen

Covers: R7, R8, AC6

- **Test first** — same file: with both selections null and `canCheck={false}`,
  assert the control reads "Pick a root and a flavour" and is disabled; re-render
  with G, Dorian and `canCheck`, and assert it reads "Check G Dorian" and is
  enabled. Run it: fails, the control renders a bare "Submit".
- **Implement** — `GuessCard`: derive label and tone from its props.
- **Green when** — both states render as asserted.
- **Refactor** — none.

#### Step C3 — Checking reports right or wrong

Covers: R10, AC7, AC8

- **Test first** — same file: pass a `lastAttempt` with `correct: true` and assert
  a success message renders; pass one with `correct: false` and assert an incorrect
  message renders. Run it: fails, nothing renders for the attempt.
- **Implement** — `GuessCard`: render a plain result line from `lastAttempt`.
  Epic 3 replaces this line with targeted feedback and Epic 4 adds the panel.
- **Green when** — both outcomes surface.
- **Refactor** — none.

#### Step C4 — A wrong check keeps the chips and disables the control

Covers: R11, AC9

- **Test first** — same file: with both chips selected and `canCheck={false}`,
  assert both are still pressed and the control is disabled; re-render with
  `canCheck` and assert it is enabled again. Run it: fails, the control stays
  enabled.
- **Implement** — `GuessCard`: bind the control's `disabled` to `!canCheck`.
- **Green when** — the repeat is blocked in the UI.
- **Refactor** — none.

#### Step C5 — Solving locks the chips

Covers: R12, AC10

- **Test first** — same file: with `solved`, assert clicking a chip does not call
  `onSelectRoot` and the control shows the solved tone. Run it: fails, chips still
  respond.
- **Implement** — `GuessCard`: pass `disabled={solved}` to both groups.
- **Green when** — the card is inert once solved.
- **Refactor** — none.

#### Step C6 — Chord and progression stay hidden

Covers: R (Epic 4's R6 boundary), AC5 of Epic 4

- **Test first** — same file: render an unsolved card for a groove whose chord is
  `Cm7` and progression `Cm–Fm–G7`, and assert neither string appears anywhere.
  Run it: passes trivially now, and is the guard that Epic 4 does not leak them
  early.
- **Implement** — nothing.
- **Green when** — the probe finds nothing.
- **Refactor** — none.

#### Step C7 — The old model is gone

Covers: R (retirement)

- **Test first** — `src/features/daily-groove/index.test.ts`: assert the feature's
  public surface exports no `Attribute` type and that `AttributeSelector` and
  `AttributePicker` no longer resolve. Run it: fails, both still export.
- **Implement** — delete `components/AttributeSelector.tsx`,
  `components/AttributePicker.tsx` and their tests; remove `Attribute` from
  `types.ts` and `index.ts`; update `GroovePuzzle` to render `GuessCard`.
- **Green when** — nothing imports the retired model and the suite is green.
- **Refactor** — delete `ResultBreakdown`'s attribute-shaped props if unused; Epic
  4 rewrites it regardless.

#### Step C8 — The puzzle owns the store and feeds the card

Covers: R5, R7, R10, R11, R12, AC5, AC6, AC9, AC10

- **Test first** — `components/GroovePuzzle.test.tsx`: render the puzzle for a
  known groove and date, then drive the whole flow through the rendered UI — select
  a root, select a flavour, check a wrong pair, change the flavour, check the right
  one — asserting the control's label and disabled state at each stage. Run it:
  fails, the puzzle still renders the retired selector.
- **Implement** — `components/GroovePuzzle.tsx`: create the store once with
  `useState(() => createDailyGrooveStore(answer))`, read `selectedRoot`,
  `selectedFlavour`, `attempts`, `solved` and `canCheck()` with `useStore`, and
  pass them plus the handlers into `GuessCard`.
- **Green when** — the end-to-end flow works through the real store.
- **Refactor** — none.

## Integration and verification

#### Step I1 — The primitives stay domain-free

Covers: R14, AC12

- **Test first** — `src/design-system.test.ts`: extend Epic 1's guard to assert no
  file under `src/components` contains `root`, `flavour`, `groove` or `scale` as a
  word. Run it: fails if a primitive leaked vocabulary.
- **Implement** — rename any offending prop.
- **Green when** — the guard passes.

#### Step I2 — The demo path, by hand

- `npm test`, `npm run build` — green.
- `npm run dev`: pick a root, pick a flavour, watch the control change from "Pick a
  root and a flavour" to "Check G Dorian"; press it and learn whether you were
  right; on a wrong guess the chips stay and the control greys until you change
  something; on the right guess the card locks. Tab through both groups with no
  pointer. Narrow to 375px and confirm both rows wrap.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B2, C1 |
| R2 | C1 |
| R3 | A3, A4, C1 |
| R4 | A4 |
| R5 | A6, B2, C8 |
| R6 | A1, A2 |
| R7 | A7, C2, C8 |
| R8 | B3, C2 |
| R9 | A5 |
| R10 | C3, C8 |
| R11 | A8, C4, C8 |
| R12 | A9, B3, C5, C8 |
| R13 | B1, B2 |
| R14 | B1, I1 |
| R15 | B4 |
| AC1 | A4, C1 |
| AC2 | A4 |
| AC3 | A4 |
| AC4 | A1 |
| AC5 | A6, C8 |
| AC6 | C2, C8 |
| AC7 | A5, C3 |
| AC8 | A5, C3 |
| AC9 | A8, C4, C8 |
| AC10 | C5, C8 |
| AC11 | B2 |
| AC12 | B1, I1 |
| AC13 | B4 |

## Assumptions

- `Flavour` is a plain `string` rather than a union, because the pool is derived
  from seed data at runtime; a union would have to be regenerated whenever a groove
  is added, which is the coupling the derivation exists to avoid.
- `parseScale` splits on the first space so multi-word flavours survive; seed
  scales are always "root flavour" with a single-token root.
- Chips are `<button>` elements with `aria-pressed` inside a `radiogroup`, rather
  than real radio inputs, because the design's chip is a button and native radios
  bring styling constraints with no accessibility gain here.
- `OptionGroup` from feature-1 is retired rather than reworked into `ChipGroup`;
  its radio-input structure does not survive the redesign.
- The plain result line in Step C3 is deliberately throwaway — Epic 3 replaces it.
- `GuessCard` takes plain values rather than the store instance, so its tests need
  no store and Epics 3–5 can extend it without widening a store dependency.
- `hydrate` is on the store contract from the start even though nothing calls it
  until Epic 5, so that epic adds no method to a frozen interface mid-flight.

## Decision log

### Cycle 1 — 2026-08-29

**Q1. Where does the day's game state live?**
Decision: **A) Keep the per-instance store, created in `GroovePuzzle` and passed to
children through props** — it matches feature-1, leaves no global state behind when
the feature folder is deleted, and keeps every child presentational.
Changed: Architecture states the ownership rule; Contracts add a `GuessCardProps`
shape and a `hydrate` method for Epic 5; Steps C1–C5 are rewritten to drive
`GuessCard` by props rather than by the store; new Step C8 wires the store inside
`GroovePuzzle` and covers the flow end to end; coverage updated for R5, R7, R10–R12
and AC5, AC6, AC9, AC10.
