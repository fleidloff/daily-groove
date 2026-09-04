# Tech spec — Epic 2: The notes are numbered

PRD: [../prd/epic-2-the-notes-are-numbered.md](../prd/epic-2-the-notes-are-numbered.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

The row of numbers is one more layer inside the `ScaleStaff` SVG, drawn from the
x sequence the noteheads already use and at a y that is a module constant rather
than a measurement of the day's scale. That constant is derived from one exported
fact — `STAFF_FLOOR_STEP`, the lowest step any scale in the rotation can occupy —
so the claim "it clears every day's lowest notehead" is proven by a `lib/` test
over every root and flavour rather than asserted by a comment. The pairing a
screen reader hears is a third piece, a pure `staffLabel(degrees, notes)` in
`lib/presentation/`, which keeps the panel's edit down to two lines and makes
R6's exact wording testable without jsdom. `ScaleStaff` still derives nothing: it
takes `degrees: string[]` beside `notes`, pairs them by index, and draws them.

Four tracks, two of them `lib/` and parallel, then the drawing, then the panel
that composes both props from the answer.

## Architecture

**This epic is written against post-move paths.** Epic 1's Step A0 relocates
`SolvedPanel.tsx`, `LeadSheet.tsx` and `ScaleStaff.tsx` with their tests from
`components/puzzle/` into the feature's fourth region,
`components/solved/`. Every path below says `components/solved/…` and assumes
that move has landed. Epic 1's Step A0 also teaches
`src/features/daily-groove/structure.test.ts` the `solved` region; **this epic
adds no component file and must not touch that test again.**

This epic is Wave 2 of the feature, per the roadmap. That is not only about the
degree namer: Epic 1's Track D edits `components/solved/SolvedPanel.tsx`, and so
does this epic's Track D. The same file, so a later wave — not a merge.

### Where the row sits

Everything vertical in `ScaleStaff.tsx` comes off `SPACE`, and the degree row
joins that arithmetic instead of introducing a second scale:

```
const DEGREE_SIZE = 14          // smaller than ACCIDENTAL_SIZE (20): a caption
const DEGREE_GAP = SPACE        // one staff space of air, below the floor note
const DEGREE_Y =
  yFor(STAFF_FLOOR_STEP) + NOTE_RY + DEGREE_GAP + DEGREE_SIZE / 2   // 115
const HEIGHT = DEGREE_Y + DEGREE_SIZE / 2 + MARGIN                  // 125
```

With today's geometry that is `90 + 6 + 12 + 7 = 115`, and a drawing 125 units
tall where it was 110. The numbers a reviewer should check:

| | value | why |
| :-- | :-- | :-- |
| `yFor(0)` | 90 | C4, the lowest notehead the rotation can draw |
| lowest notehead's bottom edge | ~97.6 | `NOTE_RY` plus the tilt and the stroke |
| numeral's top edge | 108 | `DEGREE_Y - DEGREE_SIZE / 2` |
| numeral's bottom edge | 122 | clears nothing below it but `MARGIN` |
| bottom staff line, `yFor(2)` | 78 | the row is below the staff (R1) |

`DEGREE_Y` is a constant of the module, not a function of `notes` — which is
exactly R1c and R1e: the same y and the same `HEIGHT` on every day. The staff
lines, the clef and every notehead keep the y they have today; only the drawing's
bottom edge moves down. `width` is untouched, because a numeral at most two
characters wide, centred on a notehead, cannot reach past the `PAD_RIGHT` the
last notehead already has (32 units against 14) — so nothing about the row makes
the drawing wider or the panel scroll (R7).

`HEIGHT` stops being a literal and becomes derived, so it moves in the source to
sit below `yFor` with the other derived constants. `MARGIN`, `PAD_RIGHT` and
`EMPTY_WIDTH` stay where they are.

### The floor is a fact, not a guess

`staffNotes` places the root at its letter's first occurrence at or above C4, so
root steps are 0..6 and every later note wraps upward. The lowest step reachable
is therefore 0 — C4, one ledger line below the bottom line, on a scale rooted on
C. Measured over the whole cross product (12 roots × every flavour in
`FLAVOUR_INTERVALS`, 156 pairs, none of which throws) the range is exactly
0..12, and over the 30 shipped grooves it is the same. That is what
`STAFF_FLOOR_STEP` records and what Track A's tests keep true if the catalogue
grows.

The constant is exported from `lib/theory/staff.ts` — the module that owns what a
step means — rather than declared privately in the drawing, so the number the row
is placed from and the number the test proves are one number.

### Paint order and what the row is not

The degree row is one `<g data-testid="degrees">` emitted **after** the notes,
which is what makes a numeral crossing a ledger line read as both (R1d, AC11):
in SVG the last sibling wins. The group carries no `role` and no `aria-label`, so
the drawing stays one `role="img"` named by its own `label` — the invariant
`ScaleStaff.test.tsx` already asserts.

Nothing here reaches the interval tables. The drawing imports `StaffNote` from
`lib/theory/staff` and nothing else; the answer, the flavour and `scaleDegrees`
are the panel's business (R3, AC4).

## Contracts

Frozen. Tracks build against these rather than waiting on each other.

```ts
// src/features/daily-groove/lib/theory/staff.ts — new export, nothing else changes
/**
 * The lowest step any scale in the rotation can occupy: C4, one ledger line
 * below the bottom staff line, on a scale rooted on C. It follows from
 * `staffNotes`' own rule — the root sits at its letter's first occurrence at or
 * above middle C — and it is what the staff's degree row is placed clear of.
 */
export const STAFF_FLOOR_STEP = 0
```

```ts
// src/features/daily-groove/lib/presentation/staffLabel.ts
/**
 * The staff's accessible name: each degree with the note it names, in order.
 * `staffLabel(['1','2','♭3'], ['G','A','B♭'])` → '1 G, 2 A, ♭3 B♭'.
 * Pairs by index and stops at the shorter array; either one empty → ''.
 */
export function staffLabel(degrees: string[], notes: string[]): string
```

```ts
// src/features/daily-groove/components/solved/ScaleStaff.tsx
type ScaleStaffProps = {
  notes: StaffNote[]
  /** The accessible name: degree and note paired, in order (R6). */
  label: string
  /**
   * One label per note, in note order, exactly as `scaleDegrees` returns them
   * (R2, R3). The drawing pairs them by index and draws nothing for an index it
   * has no label for. It does not count, validate or derive: a disagreement
   * between the two arrays is a `lib/` test's business, not the drawing's (AC8).
   */
  degrees: string[]
}
```

Consumed from Epic 1, frozen there, implemented behind this epic:

```ts
// src/features/daily-groove/lib/theory/degrees.ts
export function scaleDegrees(answer: Answer): string[]
// Mixolydian → ['1','2','3','4','5','6','♭7']; Blues → ['1','♭3','4','♭5','5','♭7']
// Same length and order as scaleNotes(answer). Throws UnknownFlavourError.
```

## Tracks

### Track A — The staff's floor

- **Goal** — `STAFF_FLOOR_STEP` exists, and tests prove no scale the app can
  spell or the manifest can play goes below it, and that a degree list is always
  as long as its note list.
- **Owns** — `src/features/daily-groove/lib/theory/staff.ts`,
  `src/features/daily-groove/lib/theory/staff.test.ts`
- **Role** — `implementer`
- **Depends on** — Epic 1's `scaleDegrees` (for Step A3 only)
- **Parallel with** — Track B
- **Done when** — `npm test` is green with the three new cases in
  `staff.test.ts`, and nothing else in the epic exists yet.

### Track B — The paired accessible name

- **Goal** — a pure function that reads a degree and its note as one pair, in
  order, tested as a plain function.
- **Owns** — `src/features/daily-groove/lib/presentation/staffLabel.ts`,
  `src/features/daily-groove/lib/presentation/staffLabel.test.ts`
- **Role** — `implementer`
- **Depends on** — the `staffLabel` contract only
- **Parallel with** — Track A
- **Done when** — its own tests pass; no component imports it yet.

### Track C — The numbered drawing

- **Goal** — `ScaleStaff` takes `degrees` and draws one numeral per note, at the
  notehead's x and at a y that is the same on every day.
- **Owns** — `src/features/daily-groove/components/solved/ScaleStaff.tsx`,
  `src/features/daily-groove/components/solved/ScaleStaff.test.tsx`
- **Role** — `implementer`
- **Depends on** — Track A's `STAFF_FLOOR_STEP`. This is a real dependency, not
  a stubbable one: a missing export is a compile error, not a behaviour that can
  be faked behind a contract — which is why C is a wave later than A.
- **Parallel with** — nothing
- **Done when** — `ScaleStaff.test.tsx` is green, including every case
  feature-11 wrote, and `npx tsc --noEmit` is clean.

### Track D — The box composes both props

- **Goal** — the panel derives the degrees from the answer, hands them to the
  staff, and names the staff with the pairing.
- **Owns** — `src/features/daily-groove/components/solved/SolvedPanel.tsx`,
  `src/features/daily-groove/components/solved/SolvedPanel.test.tsx`
- **Role** — `implementer`
- **Depends on** — Tracks B and C, and Epic 1's `scaleDegrees`
- **Parallel with** — nothing. **Not with Epic 4 either:** Epic 4's near-miss
  line goes in this same file, and the roadmap's "different components" does not
  hold for `SolvedPanel.tsx`. The two epics run in the same wave; these two steps
  must not. This epic's edit is deliberately two lines, so whichever goes second
  is a small rebase.
- **Done when** — the panel's tests pass and `npm test` is green whole.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B
- **Wave 2:** Track C — needs A's `STAFF_FLOOR_STEP`
- **Wave 3:** Track D — needs C's prop and B's function
- **Wave 4:** Integration

## Implementation

### Track A — The staff's floor

#### Step A1 — The floor is a named fact, over every root and flavour

Covers: R1c, AC10

- **Test first** — `src/features/daily-groove/lib/theory/staff.test.ts`: import
  `STAFF_FLOOR_STEP` beside `staffNotes`, build the cross product of `ROOTS` and
  `Object.keys(FLAVOUR_INTERVALS)`, and for each pair assert
  `staffNotes(scaleNotes({ root, flavour }))` neither throws nor produces a step
  below `STAFF_FLOOR_STEP` — with the pair named in the assertion message. Then
  assert at least one pair reaches it exactly, so the bound is tight rather than
  slack (every C-rooted scale does). Run it: fails with "SyntaxError: The
  requested module './staff' does not provide an export named
  'STAFF_FLOOR_STEP'".
- **Implement** — `staff.ts`: `export const STAFF_FLOOR_STEP = 0`, documented as
  in Contracts. No other change to the module.
- **Green when** — all 156 pairs pass and the tightness assertion passes.
- **Refactor** — none. Do not replace the cross product with a hardcoded list;
  that is the failure mode the test exists to prevent.

#### Step A2 — The shipped rotation stays on that floor

Covers: R1c, AC10

- **Test first** — same file: iterate `GROOVES` from
  `../../data/grooves.generated`, and for each entry assert the minimum step of
  `staffNotes(scaleNotes({ root: g.root, flavour: g.flavour }))` is
  `>= STAFF_FLOOR_STEP`, naming `g.id` in the message. Run it: passes on today's
  30 grooves — which is the point; it is the tripwire for the day the catalogue
  grows a scale that hangs lower, because that is the day the degree row would
  start crossing a notehead.
- **Implement** — nothing. If it ever fails, `STAFF_FLOOR_STEP` moves and the
  drawing's `DEGREE_Y` and `HEIGHT` follow it for free.
- **Green when** — every groove passes.
- **Refactor** — extract the `steps(root, flavour)` helper A1 and A2 both want.

#### Step A3 — A degree list is always as long as its note list

Covers: R2, AC8

- **Test first** — same file: for the same cross product, assert
  `scaleDegrees({ root, flavour }).length` equals
  `staffNotes(scaleNotes({ root, flavour })).length`, and that the blues scale's
  is 6 while a mode's is 7. Run it before Epic 1 has landed: fails with "Cannot
  find module './degrees'"; after it has landed, passes — and names the flavour
  if the two ever disagree.
- **Implement** — nothing. This is the assertion that lets `ScaleStaff` skip the
  check: the mismatch is caught here, in `lib/`, not by the drawing.
- **Green when** — every pair agrees.
- **Refactor** — none. It lives in `staff.test.ts` rather than in
  `degrees.test.ts` because Epic 1's Track B owns that file and ownership has to
  stay disjoint — and because the invariant's subject is the pair of arrays the
  drawing is handed, which is this file's subject.

### Track B — The paired accessible name

#### Step B1 — A degree and its note read as one pair

Covers: R6, AC5

- **Test first** —
  `src/features/daily-groove/lib/presentation/staffLabel.test.ts`: assert
  `staffLabel(['1','2','♭3','4','5','6','♭7'], ['G','A','B♭','C','D','E','F'])`
  equals `'1 G, 2 A, ♭3 B♭, 4 C, 5 D, 6 E, ♭7 F'`, and that the blues case
  `staffLabel(['1','♭3','4','♭5','5','♭7'], ['C','E♭','F','G♭','G','B♭'])`
  equals `'1 C, ♭3 E♭, 4 F, ♭5 G♭, 5 G, ♭7 B♭'`. Run it: fails with "Cannot find
  module './staffLabel'".
- **Implement** — `staffLabel.ts`: zip the two arrays, `${degree} ${note}` per
  pair, joined with `', '`. The comma is what gives a screen reader a pause
  between pairs instead of one fourteen-token run.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B2 — Nothing to name is an empty name

Covers: R8, AC6, AC8

- **Test first** — same file: assert `staffLabel([], [])` is `''`, that
  `staffLabel([], ['G','A'])` is `''`, and that `staffLabel(['1'], ['G','A'])` is
  `'1 G'` — the function pairs what it can and drops the rest rather than
  throwing or printing `undefined`. Run it against B1's naive map: fails with
  "expected '1 G, undefined A' to be '1 G'".
- **Implement** — `staffLabel.ts`: iterate to
  `Math.min(degrees.length, notes.length)`.
- **Green when** — all three assertions pass and B1's stay green.
- **Refactor** — none.

### Track C — The numbered drawing

#### Step C1 — Every note carries its number, at the notehead's own x

Covers: R1, R1a, R2, R3, AC1, AC3

- **Test first** — `components/solved/ScaleStaff.test.tsx`: add a
  `degrees()` reader beside the existing `noteheads()` and `accidentals()` —
  `screen.queryAllByTestId('degree')` — and a
  `degreesFor(notes)` helper returning placeholder labels of the right length for
  the cases that are not about them. Then render
  `<ScaleStaff notes={E_DORIAN} label={E_DORIAN_LABEL} degrees={['1','2','♭3','4','5','6','♭7']} />`
  and assert: seven `degree` nodes; their `textContent` equals that array in
  order; and each one's `x` equals the corresponding notehead's `cx` exactly. Run
  it: fails with "Unable to find an element by:
  [data-testid='degree']" (and `npx tsc --noEmit` fails with "Property
  'degrees' does not exist on type 'IntrinsicAttributes & ScaleStaffProps'").
- **Implement** — `ScaleStaff.tsx`: add `degrees: string[]` to
  `ScaleStaffProps`; after the notes map, emit `<g data-testid="degrees">` whose
  children are, for each note index with a defined label, a
  `<text data-testid="degree" x={xs[i]} y={DEGREE_Y} textAnchor="middle"
  dominantBaseline="central" fontSize={DEGREE_SIZE} fill="currentColor"
  className="font-jazz">`. `xs` is the existing `centres(notes)` array — the same
  one the noteheads use, which is R1a with no second computation to drift.
- **Green when** — all three assertions pass; every feature-11 case in the file
  is still green after `degrees={degreesFor(…)}` is added to each of its renders;
  `npx tsc --noEmit` is clean.
- **Refactor** — none. Do not give the row its own x arithmetic.

#### Step C2 — Six numbers for a blues day, including under the shared step

Covers: R2, R1a, AC2, AC3

- **Test first** — same file, in the existing `two notes on one line (B4)`
  block: render `C_BLUES` with `degrees={['1','♭3','4','♭5','5','♭7']}` and
  assert six `degree` nodes reading exactly that; that node 4's `x` equals
  notehead 4's `cx` — the one that received `SHARED_STEP_EXTRA`; and that
  `x[4] - x[3]` is greater than `x[3] - x[2]`, so the row inherits the extra
  advance rather than being evenly spaced. Run it: fails with "expected 6 to be
  ..." if the row counts `1..7`, and on the shared-step x if the labels are laid
  out on their own grid.
- **Implement** — nothing beyond C1, which pairs by index off `centres`. This
  step exists because the blues scale is the whole test of the epic, and it must
  fail loudly if anyone ever counts.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step C3 — The row is below the staff, and never over a notehead

Covers: R1, R1b, R1d, AC1, AC11

- **Test first** — same file: with a C-Mixolydian fixture reaching the floor —
  `fixture([0,''],[1,''],[2,''],[3,''],[4,''],[5,''],[6,''])` — assert (a) every
  `degree` node's `y` is greater than the lowest staff line's `y1`, so the row is
  below the staff; (b) its top edge, `y - fontSize / 2`, is greater than every
  notehead's `cy + ry`, so no numeral is drawn over a notehead — including the
  step-0 note one ledger line below the staff; (c) the air below the row,
  `viewBox height - (y + fontSize / 2)`, is less than one staff space, so the row
  belongs to the drawing rather than reading as a caption floating under it. Run
  it: fails with "expected 90 to be greater than 96" on (b) if the y is derived
  from anything but the floor.
- **Implement** — `ScaleStaff.tsx`: derive the constants as in Architecture —
  `DEGREE_SIZE`, `DEGREE_GAP = SPACE`, `DEGREE_Y` from
  `yFor(STAFF_FLOOR_STEP) + NOTE_RY + DEGREE_GAP + DEGREE_SIZE / 2`, and `HEIGHT`
  from `DEGREE_Y + DEGREE_SIZE / 2 + MARGIN`. Import `STAFF_FLOOR_STEP` from
  `../../lib/theory/staff`, beside the existing `StaffNote` type import. Move the
  `HEIGHT` declaration down to sit after `yFor` — it is now derived, and `yFor`
  must be above the constants that call it, as `CLEF_PLACEMENT` already is.
- **Green when** — all three assertions pass.
- **Refactor** — none. Keep the four constants named and separate; a single
  literal `115` is what makes the next reader guess.

#### Step C4 — The same y, and the same height, on every day

Covers: R1c, R1e, AC10

- **Test first** — same file: render a C-rooted fixture (steps 0..6, which
  reaches below the staff) and a G-rooted one (steps 4..10, which does not), and
  assert the `degree` nodes' `y` is identical within each render, identical
  between the two renders, and that both `<svg>` elements report the same
  `height` attribute — which also equals the empty staff's, `notes={[]}`. Run it:
  fails with "expected 121 to be 115" if `DEGREE_Y` is measured off the day's
  lowest note, and with a height mismatch if `HEIGHT` grows with the scale.
- **Implement** — nothing beyond C3, which made both constants module-level.
  This step is the guard on that, and it is the assertion that keeps the panel
  the same height from one day to the next.
- **Green when** — all four assertions pass, and feature-11's "keeps a staff
  space the same size whatever the note count" stays green.
- **Refactor** — none.

#### Step C5 — A number crossing a ledger line is painted over it

Covers: R1d, AC11

- **Test first** — same file: with the step-0 fixture, which rules a ledger
  line, assert that every `degree` node follows every `ledger` node in document
  order —
  `expect(ledger.compareDocumentPosition(degree) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()`
  — and, as the same claim read off the tree, that the last `ledger`'s index in
  `container.querySelectorAll('*')` is lower than the first `degree`'s. Run it:
  fails with "expected 0 to be truthy" if the row is emitted before the notes.
- **Implement** — `ScaleStaff.tsx`: keep the `<g data-testid="degrees">` as the
  last child of the `<svg>`, after the notes map. In SVG the last sibling paints
  last, which is the whole mechanism.
- **Green when** — both assertions pass.
- **Refactor** — none. Add a one-line comment saying the position of that group
  in the JSX *is* the paint order, so a later tidy-up does not move it.

#### Step C6 — A caption, not a second voice, in the surface's own ink

Covers: R4, R5

- **Test first** — same file, in the existing `ink and fit (B7)` block: assert
  every `degree` node's `fill` is `currentColor`; that its `font-size` is
  strictly less than an `accidental` node's, so the numbers read as a caption
  under the notes rather than competing with them; that its class matches
  `/font-jazz/` and names no colour class (the block's existing regex); that it
  sets no `font-weight`; and that no `degree` node carries a `role` or an
  `aria-label`, so the drawing stays one image. Run it: fails with "expected null
  to be 'currentColor'" before C1, and on the size comparison if the row is set
  at the accidentals' 20.
- **Implement** — nothing beyond C1's attributes, which already name
  `fill="currentColor"` and `fontSize={DEGREE_SIZE}`.
- **Green when** — all five assertions pass, and the block's two existing
  sweeping assertions — every drawn element inks from `currentColor`, no colour
  class anywhere — stay green over the new `text` nodes.
- **Refactor** — none.

#### Step C7 — No notes, no numbers; no overlap, no extra width

Covers: R7, R8, AC6, AC7

- **Test first** — same file: (a) render `notes={[]}` with
  `degrees={['1','2']}` and assert zero `degree` nodes and no throw — the drawing
  draws numbers for notes, not for labels; (b) with `E_DORIAN` and seven labels
  including two-character ones, assert no two consecutive labels' horizontal em
  boxes overlap, reusing the file's `overlaps` helper with a middle-anchored span
  (`[x - em / 2, x + em / 2]`, `em = font-size × character count`); (c) assert
  the `<svg>`'s `width` attribute is identical with the seven labels and with
  `degrees={[]}`, so the row adds no width and cannot make the panel scroll
  sideways, and that the class still carries `max-w-full h-auto` and no
  `w-full`. Run it: (a) fails with "expected 2 to be 0" if the row maps over
  `degrees` instead of `notes`.
- **Implement** — `ScaleStaff.tsx`: map the row over `notes`, taking
  `degrees[i]` and skipping an index it has no label for. Leave the `width`
  computation exactly as it is.
- **Green when** — all three groups pass.
- **Refactor** — none. The 360px check itself is the demo path: jsdom cannot
  measure a wrap, and the drawing scales as a whole, so relative non-overlap in
  viewBox units is the assertion that transfers.

#### Step C8 — The drawing derives nothing

Covers: R3, AC4

- **Test first** — same file: read
  `components/solved/ScaleStaff.tsx` from disk with `node:fs` (the way
  `SolvedPanel.test.tsx` already reads source) and assert its import specifiers
  are only `../../lib/theory/staff` — no `degrees`, no `notes`, no `changes`, no
  `../../types`, no `Answer`, and no `FLAVOUR_` anywhere in the file. Run it:
  passes today and after C1 — which is the point; it is the tripwire for the
  shortcut where the drawing starts computing the row from the answer.
- **Implement** — nothing. If it fails, delete the import, not the test.
- **Green when** — the specifier list is exactly the one import.
- **Refactor** — none.

### Track D — The box composes both props

#### Step D1 — The box hands the staff its degrees

Covers: R1, R2, R9, AC1, AC2

- **Test first** — `components/solved/SolvedPanel.test.tsx`: add a
  `degreeTexts()` reader over `staff()` — `[data-testid="degree"]` — and assert
  that `renderPanel()` (G Dorian) draws `['1','2','♭3','4','5','6','♭7']`; that a
  blues answer (`{ root: 'C', flavour: 'Blues' }`) draws
  `['1','♭3','4','♭5','5','♭7']`, six labels against six noteheads; and that
  `revealed: true` draws the same row as the solved render, because a day given
  up on shows the same solution. Run it: fails with "expected [] to equal [ '1',
  '2', … ]".
- **Implement** — `SolvedPanel.tsx`: `const degrees = scaleDegrees(answer)`
  beside the existing `scaleNotes(answer)`, imported from
  `../../lib/theory/degrees`, and pass `degrees={degrees}` to `ScaleStaff`. One
  new import, one new line, one new prop.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step D2 — The accessible name pairs each degree with its note

Covers: R6, AC5

- **Test first** — same file: rewrite the existing
  `expect(staff()).toHaveAccessibleName('G A B♭ C D E F')` inside "shows the
  seven scale notes under 'Notes to live in'" to
  `toHaveAccessibleName('1 G, 2 A, ♭3 B♭, 4 C, 5 D, 6 E, ♭7 F')`, keeping the
  case and its other assertions and adding this epic's refs to its name. Run it:
  fails with "expected element to have accessible name '1 G, 2 A, ♭3 B♭, 4 C, 5
  D, 6 E, ♭7 F' but got 'G A B♭ C D E F'".
- **Implement** — `SolvedPanel.tsx`: `label={staffLabel(degrees, notes)}` in
  place of `label={notes.join(' ')}`, importing `staffLabel` from
  `../../lib/presentation/staffLabel`.
- **Green when** — the assertion passes and the file's other accessible-name
  assertions (`expect(drawing).toHaveAccessibleName()`) stay green.
- **Refactor** — none. The assertion keeps its subject — what the staff's
  accessible name says — and only its expected value changed, which is the
  honest way to record that the name now carries the pairing.

#### Step D3 — The note names stay off the screen

Covers: R6a, AC9

- **Test first** — same file: assert the whole "Notes to live in" group's
  `textContent` matches no `/[A-G]/` — extending feature-11's existing
  `staff().textContent` assertion to the column, so a name cannot appear beside
  the staff either — and that every `degree` node's text matches
  `/^[♭♯]?\d$/`, so the row is numbers and accidentals and nothing else. Run it:
  passes after D1 and D2 — which is the point; it pins the one thing the epic
  must not do, and it fails the moment someone adds a name row.
- **Implement** — nothing.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step D4 — The row exists only where the box does

Covers: R9

- **Test first** — same file, reusing its `readFileSync`/`resolve` imports: walk
  `src/features/daily-groove/components/` and assert exactly one non-test source
  file imports `ScaleStaff` — `solved/SolvedPanel.tsx` — so nothing draws the
  staff, and therefore the degrees, before the day has ended. Run it: passes
  today; it fails on the day a mid-puzzle hint renders the staff, which is the
  day half the answer leaks.
- **Implement** — nothing.
- **Green when** — the importer list is exactly `['solved/SolvedPanel.tsx']`.
- **Refactor** — none.

## Integration and verification

- **Step I1 — the whole suite.** `npm test`, `npx tsc --noEmit`,
  `npm run lint`, `npm run build`, all green.
  `src/features/daily-groove/structure.test.ts` is untouched by this epic and
  must stay green as Epic 1's Step A0 left it — this epic adds no component
  file, so its `REGIONS` needs no edit.
- **Step I2 — the demo path, on a phone-width window.** `npm run dev`, at
  360px. Solve a seven-note day: under the staff, `1 2 3 4 5 6 ♭7` sits under the
  noteheads, one number per note, nothing overlapping and no sideways scroll.
  Solve or give up on a blues day: six numbers, `1 ♭3 4 ♭5 5 ♭7`, with the ♭5 and
  5 further apart than the rest. Compare a C-rooted day against a G-rooted one:
  the box is the same height and the row is at the same place. Check both
  palettes on the inverted panel — the part no test asserts is whether the
  numbers read as a caption rather than as a second voice.
- **Step I3 — the pairing, read aloud.** With a screen reader on the staff,
  confirm it announces `1 G, 2 A, ♭3 B♭, …` as one image, and that no note name
  is visible on screen anywhere in that column.
- **Coverage** — the table below; every R and AC has a step.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | C1, C3, D1 |
| R1a | C1, C2 |
| R1b | C3 |
| R1c | A1, A2, C3, C4 |
| R1d | C3, C5 |
| R1e | C4 |
| R2 | A3, C1, C2, D1 |
| R3 | C1, C8 |
| R4 | C6 |
| R5 | C6 |
| R6 | B1, D2 |
| R6a | D3 |
| R7 | C7, I2 (visual) |
| R8 | B2, C7 |
| R9 | D1, D4 |
| AC1 | C1, C3, D1 |
| AC2 | C2, D1 |
| AC3 | C1, C2 |
| AC4 | C8 |
| AC5 | B1, D2, I3 |
| AC6 | B2, C7 |
| AC7 | C7, I2 (visual) |
| AC8 | A3, B2, C7 |
| AC9 | D3, I3 |
| AC10 | A1, A2, C4 |
| AC11 | C3, C5 |

## Assumptions

- **`degrees` is a required prop, not optional.** A caller that forgets it loses
  the whole row, and the panel is the only caller — so `tsc` should be the one
  that notices. The cost is mechanical: every existing render in
  `ScaleStaff.test.tsx` gains `degrees={degreesFor(notes)}` in Step C1, which
  changes no existing assertion.
- **The numbers are 14 units, at full-strength `currentColor`.** The row is
  distinguished from the notation by size, not by a lighter ink: the staff is
  read on the panel's inverted accent surface, where a faded numeral is the first
  thing to disappear. `ACCIDENTAL_SIZE` is 20 and a staff space is 12, so 14
  reads as pencilled-in marking rather than as a second stave.
- **`DEGREE_GAP` is one `SPACE`.** The row could sit tighter, but the gap is
  measured from the *floor* note, which most days do not reach, so a smaller
  number buys little and risks the one day it matters.
- **`staffLabel` lives in `lib/presentation/`, beside `date.ts` and
  `feedback.ts`.** It turns values into what is shown — the folder's own test —
  and putting it there rather than inline in the panel is what keeps R6's exact
  wording under a plain-function test and this epic's edit to `SolvedPanel.tsx`
  down to two lines, which matters because Epic 4 is editing the same file in the
  same wave.
- **`, ` separates the pairs.** A comma is a pause in every screen reader, and
  `1 G, 2 A` is unambiguous where `1 G 2 A` is fourteen tokens in a row.
- **The steps of the rotation are 0..12 today.** Measured, not assumed: over 12
  roots × every flavour in `FLAVOUR_INTERVALS`, none of which throws, and over
  all 30 shipped grooves. Only the floor is exported and tested, because the
  ceiling is not this epic's business any more — Cycle 3 moved the row down.
- **`HEIGHT` grows from 110 to 125, so the panel grows ~15px.** It is the same
  15px every day (R1e), and no notehead, line or clef moves.

The spec is ready to implement: there are no architectural forks left open. The
two things a reviewer should push back on if they disagree are `degrees` being
required rather than optional, and `staffLabel` being a `lib/` function rather
than an expression in the panel — both cheap to reverse, both argued above.
