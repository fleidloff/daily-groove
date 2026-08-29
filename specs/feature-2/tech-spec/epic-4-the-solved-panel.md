# Tech spec — Epic 4: The solved panel

PRD: [../prd/epic-4-the-solved-panel.md](../prd/epic-4-the-solved-panel.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Two independent pieces. The scale-note computation is pure music theory over data
the app already holds — an interval table keyed by flavour, applied to the root's
chromatic index — and it is testable with no rendering at all. The panel itself is
an inverted surface primitive plus a labelled-column primitive, both generic. Only
the assembly needs both, so it goes last.

The panel is not a dialog. It is the solved state of the day: once shown it stays,
and the guessing card above it is already locked by Epic 2.

## Architecture

```
src/features/daily-groove/
  lib/notes.ts       NEW   FLAVOUR_INTERVALS, scaleNotes           (Track A)
  components/SolvedPanel.tsx  NEW                                  (Track C)
  components/ResultReveal.tsx     DELETED
src/components/
  Panel.tsx          NEW   inverted gradient surface               (Track B)
  LabelledColumn.tsx NEW   eyebrow label over content              (Track B)
  Chip.tsx                 gains an `inverted` tone                (Track B)
```

`scaleNotes(answer)` walks a semitone interval list from the root's index through
a twelve-note chromatic ring and spells each degree. Spelling follows the
flavour's conventional accidental — flats for Dorian, Minor, Mixolydian, Phrygian
and Locrian, sharps for Lydian — so the notes read the way a musician would write
them rather than as a uniform chromatic spelling.

The interval table must cover every flavour the seed set uses, Locrian included.
Step A2 asserts that directly, so adding a groove in a flavour with no interval
entry fails the suite rather than rendering a broken column.

## Contracts

```ts
// src/features/daily-groove/lib/notes.ts
export const FLAVOUR_INTERVALS: Record<Flavour, number[]>   // semitones from root
export function scaleNotes(answer: Answer): string[]        // seven spelled notes
```

- `Panel({ children })` — full-width inverted gradient surface
- `LabelledColumn({ label, children })`
- `Chip({ ..., tone?: 'default' | 'inverted' })`
- `SolvedPanel({ answer, tries, streak, chord, progression })`

## Tracks

### Track A — Scale notes

- **Goal** — correct spelled notes for every flavour in the seed set.
- **Owns** — `lib/notes.ts` and its test
- **Depends on** — Epic 2's `Answer` contract only
- **Parallel with** — Track B
- **Done when** — its tests pass with no UI present.

### Track B — Panel primitives

- **Goal** — the inverted surface, the labelled column, and the inverted chip.
- **Owns** — `src/components/Panel.tsx`, `LabelledColumn.tsx`, and the `tone` prop
  on `Chip.tsx`
- **Depends on** — Epic 1's token names only
- **Parallel with** — Track A
- **Done when** — its tests pass with no feature code present.

### Track C — The panel itself

- **Goal** — the solved state renders, and `ResultReveal` is gone.
- **Owns** — `components/SolvedPanel.tsx`, `components/GroovePuzzle.tsx`, and the
  deletion of `ResultReveal.tsx`
- **Depends on** — Tracks A and B as built code
- **Parallel with** — none

## Execution waves

- **Wave 1 (parallel):** Track A, Track B
- **Wave 2:** Track C
- **Wave 3:** Integration

## Implementation

### Track A — Scale notes

#### Step A1 — G Dorian spells its seven notes

Covers: R5, AC5

- **Test first** — `lib/notes.test.ts`: assert `scaleNotes({ root: 'G', flavour:
  'Dorian' })` is exactly `['G','A','B♭','C','D','E','F']`. Run it: fails,
  `scaleNotes` is not a function.
- **Implement** — `lib/notes.ts`: the chromatic ring, the Dorian interval list,
  and flat spelling.
- **Green when** — the seven notes match in order.
- **Refactor** — none.

#### Step A2 — Every flavour in the seed set computes

Covers: R5, AC6

- **Test first** — same file: for every groove in `GROOVES`, parse its scale and
  assert `scaleNotes` returns seven non-empty notes with the root first and no
  duplicates. Run it: fails, Locrian has no interval entry.
- **Implement** — `lib/notes.ts`: fill `FLAVOUR_INTERVALS` for all seven seeded
  flavours; throw a named error for an unknown flavour rather than returning a
  short array.
- **Green when** — all seven grooves produce a full scale.
- **Refactor** — none. This is the guard against a new groove breaking the panel.

#### Step A3 — Lydian spells with sharps

Covers: R5

- **Test first** — same file: assert `scaleNotes({ root: 'F', flavour: 'Lydian' })`
  is `['F','G','A','B','C','D','E']`, and that a sharp-spelled flavour never
  returns a flat. Run it: fails, the fourth degree comes back as `B♭`.
- **Implement** — `lib/notes.ts`: per-flavour spelling preference.
- **Green when** — Lydian spells sharp and Dorian still spells flat.
- **Refactor** — extract the spelling choice into one lookup.

### Track B — Panel primitives

#### Step B1 — `Panel` is an inverted surface

Covers: R1, R10, AC10

- **Test first** — `src/components/Panel.test.tsx`: assert it renders children,
  spans full width, and carries the gradient tokens rather than a raw colour. Run
  it: fails, module not found.
- **Implement** — `src/components/Panel.tsx`.
- **Green when** — children render on the inverted surface.
- **Refactor** — none.

#### Step B2 — `LabelledColumn` pairs an eyebrow with content

Covers: R10, AC10

- **Test first** — `src/components/LabelledColumn.test.tsx`: assert the label
  renders as an eyebrow and the children below it, and that the label is
  programmatically associated with the group. Run it: fails, module not found.
- **Implement** — `src/components/LabelledColumn.tsx`: `aria-labelledby` wiring.
- **Green when** — the association holds.
- **Refactor** — none.

#### Step B3 — Chips have an inverted tone

Covers: R4

- **Test first** — `src/components/Chip.test.tsx`: assert `tone="inverted"`
  produces a different class string from the default and still renders its label.
  Run it: fails, `tone` is not a prop.
- **Implement** — `src/components/Chip.tsx`: add the tone, using the translucent
  light treatment.
- **Green when** — both tones render distinctly.
- **Refactor** — none.

#### Step B4 — The columns stack on narrow screens

Covers: R7, AC8

- **Test first** — `src/components/Panel.test.tsx`: assert the panel's column
  wrapper is single-column at the base breakpoint and multi-column only above it.
  Run it: fails, the wrapper is unconditionally multi-column.
- **Implement** — `Panel`: base-single grid.
- **Green when** — the stacked case is the default.
- **Refactor** — none.

### Track C — The panel itself

#### Step C1 — Solving reveals the answer

Covers: R1, R2, AC1

- **Test first** — `components/SolvedPanel.test.tsx`: render with the answer G
  Dorian and assert "G Dorian" appears as a heading. Run it: fails, module not
  found.
- **Implement** — `components/SolvedPanel.tsx`: a `Panel` with a display heading.
- **Green when** — the answer renders.
- **Refactor** — none.

#### Step C2 — The meta line counts tries correctly

Covers: R3, AC2, AC3

- **Test first** — same file: assert `tries={1}` renders "one try" and not "1
  tries"; assert `tries={3}` renders three tries and shows the streak value. Run
  it: fails, the pluralisation is wrong.
- **Implement** — `SolvedPanel`: a small `triesLabel` helper.
- **Green when** — both cases read correctly.
- **Refactor** — none.

#### Step C3 — The changes and the notes render as columns

Covers: R4, R5, AC4

- **Test first** — same file: with chord `Cm7` and progression `Cm–Fm–G7`, assert
  both render as inverted chips under a "The changes" column, and that the seven
  computed notes render under a "Notes to live in" column. Run it: fails, no
  columns render.
- **Implement** — `SolvedPanel`: two `LabelledColumn`s, notes from `scaleNotes`.
- **Green when** — both columns render their content.
- **Refactor** — none.

#### Step C4 — The panel announces itself

Covers: R9, AC9

- **Test first** — same file: assert the panel carries `role="status"` so a screen
  reader is told the day was solved. Run it: fails, no live region.
- **Implement** — `SolvedPanel`: `role="status"`.
- **Green when** — the role resolves.
- **Refactor** — none.

#### Step C5 — The panel appears only once solved

Covers: R1, R6, AC7

- **Test first** — `components/GroovePuzzle.test.tsx`: assert no panel renders
  before the solve and that neither the chord nor the progression appears anywhere
  on the page; solve, and assert the panel renders with both. Run it: fails, the
  panel is never rendered.
- **Implement** — `GroovePuzzle`: render `SolvedPanel` below both cards when
  `solved`.
- **Green when** — the panel is gated on the solve.
- **Refactor** — none.

#### Step C6 — `ResultReveal` is gone

Covers: R (retirement)

- **Test first** — `index.test.ts`: assert `ResultReveal` no longer resolves from
  the feature. Run it: fails, the module still exists.
- **Implement** — delete `components/ResultReveal.tsx` and its test; remove any
  export.
- **Green when** — nothing references it.
- **Refactor** — none.

## Integration and verification

#### Step I1 — The panel primitives stay domain-free

Covers: R10, AC10

- **Test first** — `src/design-system.test.ts`: the Epic 2 guard already asserts no
  `root`, `flavour`, `groove` or `scale` under `src/components`; confirm `Panel`
  and `LabelledColumn` pass it. Run it: fails if a musical prop name leaked.
- **Implement** — rename.
- **Green when** — the guard passes.

#### Step I2 — Contrast on the inverted surface

Covers: R8, AC9

- Manual: with the panel open, check the answer, meta line, column labels and chip
  text against the gradient in both palettes, at the WCAG AA threshold for their
  sizes.

#### Step I3 — The demo path, by hand

- `npm test`, `npm run build` — green.
- `npm run dev`: solve the day and watch the panel appear with the answer in serif,
  the tries and streak beside it, the chord changes and the scale notes as chips.
  Confirm neither chord nor progression was visible before the solve. Narrow to
  375px and confirm the columns stack.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B1, C1, C5 |
| R2 | C1 |
| R3 | C2 |
| R4 | B3, C3 |
| R5 | A1, A2, A3, C3 |
| R6 | C5 |
| R7 | B4 |
| R8 | I2 |
| R9 | C4 |
| R10 | B1, B2, I1 |
| AC1 | C1 |
| AC2 | C2 |
| AC3 | C2 |
| AC4 | C3 |
| AC5 | A1 |
| AC6 | A2 |
| AC7 | C5 |
| AC8 | B4 |
| AC9 | C4, I2 |
| AC10 | B1, B2, I1 |

## Assumptions

- The chromatic ring is spelled twice — a flat spelling and a sharp spelling — and
  the flavour picks which; this is simpler and more predictable than deriving
  spelling from key signatures, and correct for the seven flavours in play.
- An unknown flavour throws rather than degrading, so the failure surfaces in tests
  rather than as a short column in production.
- With the tips column out of scope the panel renders two columns; the grid divides
  the width evenly rather than leaving the third slot empty.
- `triesLabel` handles only "one try" versus "N tries"; no other number words are
  spelled out.
- The panel uses `role="status"` rather than `role="alert"`, since solving is not
  an interruption.

No architectural questions remain for this epic — the note computation is a pure
function, the primitives follow the contracts Epic 1 froze, and the only decision
with reach (where game state lives) is settled in Epic 2.
