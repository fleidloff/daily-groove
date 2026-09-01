# Tech spec — Epic 2: The notes on a staff

PRD: [../prd/epic-2-the-notes-on-a-staff.md](../prd/epic-2-the-notes-on-a-staff.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

One pure function and one drawing. `lib/theory/staff.ts` turns the spelled names
`scaleNotes` already returns into staff positions — an integer per note, counting
diatonic steps from a fixed reference — plus an accidental glyph. `ScaleStaff`
draws them as SVG: five lines, a clef, ledger lines, ellipse noteheads,
accidentals to the left. `SolvedPanel` swaps the note chips for it and restacks,
so the lead sheet sits above the staff at full width.

Everything the mapping needs is a string like `E♭`. No pitch arithmetic, no MIDI,
no octave data from the catalogue: `scaleNotes` has already done the hard part of
spelling, and octave comes from one rule applied to the root.

## Architecture

```
lib/theory/notes.ts    scaleNotes(answer) → ['E','F♯','G','A','B','C♯','D']
        │
        ▼
lib/theory/staff.ts    staffNotes(names) → [{ step, accidental }, …]
        │                                    step: diatonic steps above C4
        ▼
components/puzzle/ScaleStaff.tsx    props: { notes: StaffNote[]; label: string }
        │
        ▼
components/puzzle/SolvedPanel.tsx   calls scaleNotes → staffNotes → <ScaleStaff/>
```

**Positions are diatonic steps, not pitches.** A staff line is a letter, not a
semitone: `E♭` and `E` sit on the same line and differ only by the glyph in
front. So `step` counts letters — `C4 = 0`, `D4 = 1`, … `C5 = 7` — and the
accidental rides alongside. Every vertical measurement in the drawing is
`step × halfSpace`, which is why the geometry is four lines of arithmetic.

**The octave rule.** The root is placed in the octave running upward from middle
C: its letter's first occurrence at or above C4. The scale then ascends by
letter, wrapping to the next octave when the letter wraps past B. A scale from B
therefore runs B4→B5 and carries ledger lines above; a scale from C runs C4→C5
and sits inside the staff. One rule, twelve roots, and the same picture shape
every time.

**Every glyph is drawn, not typeset — except the accidentals.** The treble clef
is one SVG `<path>`, checked in as path data with the viewBox it was drawn
against; the noteheads are rotated `<ellipse>`s; the ledger and staff lines are
`<line>`s. Only `♯ ♭ ♮` are characters, set in the jazz face — the app already
renders `♯` and `♭` today in chord symbols and chip labels, so those glyphs are
proven on every platform it runs on. No second font file is loaded, and every
vertical measurement stays under the drawing's own control rather than a font's
metrics.

Two consequences worth stating: `♮` is the one glyph not already proven in this
app, so B3 asserts it renders as text and does not fall back to a box; and the
clef path is fixed artwork — it scales with the viewBox and is never re-drawn
per render.

**The panel restacks.** With both columns now drawings, the two-column grid is
wrong: a staff wants the panel's full width. `PanelColumns` is dropped from this
panel in favour of a stack — lead sheet, then staff, each keeping its
`LabelledColumn` eyebrow. The primitive itself stays in the design system.

## Contracts

```ts
// src/features/daily-groove/lib/theory/staff.ts
export type StaffNote = {
  /** Diatonic steps above middle C. C4 = 0, D4 = 1, B4 = 6, C5 = 7. */
  step: number
  /** '♯' | '♭' | '♯♯' | '♭♭' | '♮' | '' — drawn to the left of the notehead. */
  accidental: string
}

/**
 * Spelled note names → staff positions, ascending from the root in the octave
 * above middle C. Throws UnknownNoteError on a name it cannot parse, so a
 * catalogue that grows a new spelling fails in tests, not on the panel.
 */
export function staffNotes(names: string[]): StaffNote[]

// src/features/daily-groove/components/puzzle/ScaleStaff.tsx
type ScaleStaffProps = {
  notes: StaffNote[]
  /** The accessible name: the note names, in order. */
  label: string
}
```

- Ledger lines are the drawing's business, derived from `step`; the mapping
  emits none.
- `staffNotes` is total over the catalogue's spellings but not over arbitrary
  strings — parsing `H♭` is a bug, and it throws.

## Tracks

### Track A — `staffNotes`

- **Goal** — every scale the catalogue can mint becomes positions and
  accidentals.
- **Owns** — `src/features/daily-groove/lib/theory/staff.ts`, `staff.test.ts`
- **Depends on** — `scaleNotes`, which exists.
- **Parallel with** — B
- **Done when** — its own tests pass, including all thirteen flavours × twelve
  roots.

### Track B — `ScaleStaff`

- **Goal** — a staff that draws whatever positions it is handed.
- **Owns** — `src/features/daily-groove/components/puzzle/ScaleStaff.tsx` +
  test
- **Depends on** — the `StaffNote` contract only. It can be built before Track A
  exists, against hand-written `StaffNote[]` fixtures.
- **Parallel with** — A
- **Done when** — its own tests pass with fixture input.

### Track C — The staff in the panel

- **Goal** — the panel stacks, the chips are gone, the staff is under the sheet.
- **Owns** — `SolvedPanel.tsx` + test, the `puzzle` region list in
  `src/features/daily-groove/structure.test.ts`
- **Depends on** — Tracks A and B, and Epic 1 having landed its lead sheet in
  this file.
- **Parallel with** — nothing.
- **Done when** — the panel's tests pass and the suite is green.

**Cross-epic seam.** `SolvedPanel.tsx` and the region list are Epic 1's in wave
1 and this epic's in wave 2. Nothing here may start on that file until Epic 1's
Track C has landed; Tracks A and B are free of it and can run in wave 1
alongside Epic 1 if there is capacity.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B.
- **Wave 2:** Track C.
- **Wave 3:** Integration.

## Implementation

### Track A — `staffNotes`

#### Step A1 — A natural scale from C sits on consecutive steps

Covers: R1, R2, R3, AC1

- **Test first** — `src/features/daily-groove/lib/theory/staff.test.ts`: assert
  `staffNotes(['C','D','E','F','G','A','B'])` returns steps `[0,1,2,3,4,5,6]`,
  every accidental `''`. Run it: fails, module not found.
- **Implement** — `staff.ts`: split each name into letter and accidental with
  the same shape `notes.ts` uses; map the letter to its index in
  `C D E F G A B`; carry an octave counter that increments when the letter index
  wraps below the previous one; `step = octave * 7 + letterIndex`.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A2 — Accidentals ride beside the position, not in it

Covers: R2, AC1

- **Test first** — same file: `staffNotes(['E','F♯','G','A','B','C♯','D'])` —
  E Dorian — returns steps `[2,3,4,5,6,7,8]` and accidentals
  `['','♯','','','','♯','']`. The `C♯` is step 7, an octave above the `C` that
  would be step 0, because the letters have wrapped. Run it: fails if A1 got the
  wrap wrong.
- **Implement** — the accidental passthrough; fix the wrap if needed.
- **Green when** — both arrays match.
- **Refactor** — none.

#### Step A3 — The root sits in the octave above middle C

Covers: R1b, AC6b

- **Test first** — same file: the first `step` of a scale from `C` is 0, from
  `E` is 2, from `B` is 6; and a scale from `B` ends at step 12 — `A♯5` for B
  Ionian, since `scaleNotes` returns seven degrees and does not repeat the root
  at the octave — which is above the staff. Run it: passes if A1 is right — this pins the rule so a later
  "improvement" cannot quietly re-centre it.
- **Implement** — none.
- **Green when** — green.

#### Step A4 — The blues scale keeps two notes on one line

Covers: R4, AC2

- **Test first** — same file: `staffNotes(scaleNotes({ root: 'C', flavour: 'Blues' }))`
  returns six notes; the fourth and fifth share a `step`; their accidentals are
  `'♭'` and `'♮'` in that order. Run it: fails — the natural is `''` until the
  next step.
- **Implement** — `staff.ts`: when a note has no accidental and an earlier note
  in the same array shares its `step` and did carry one, emit `'♮'`. That is the
  rule a reader needs: a G after a G♭ on the same line has to say it is natural.
- **Green when** — the six positions and the `♭`/`♮` pair are right.
- **Refactor** — none.

#### Step A5 — Every root × every flavour maps

Covers: R3, R6, AC3

- **Test first** — same file: for all twelve roots × all thirteen keys of
  `FLAVOUR_INTERVALS`, assert `staffNotes(scaleNotes({ root, flavour }))` returns
  the same length as the scale, steps that never descend, and never throws.
  Not *strictly* ascending: the blues scale shares a step between its `G♭` and
  its `G`, which is Step A4's whole subject. Assert the strongest true form —
  exactly one repeated step for the six-note blues, exactly none for a
  seven-note scale — so a mode that collapsed two lines still fails. Run
  it: fails on any spelling A1's parser does not handle — double accidentals are
  the likely first casualty.
- **Implement** — `staff.ts`: accept `♭♭` and `♯♯`; throw `UnknownNoteError` on
  anything else, so the failure is named.
- **Green when** — all 156 combinations pass.
- **Refactor** — none.

### Track B — `ScaleStaff`

#### Step B1 — Five lines and a clef

Covers: R1, R1b

- **Test first** — `components/puzzle/ScaleStaff.test.tsx`: render with an empty
  `notes` array and assert the SVG contains exactly five staff lines
  (`data-testid="staff-line"`) and one clef (`data-testid="clef"`). Run it:
  fails, module not found.
- **Implement** — `ScaleStaff.tsx`: an `<svg>` with a `viewBox`, five `<line>`s
  a fixed `SPACE` apart, and a treble clef as a single `<path>` — path data as a
  module constant beside the geometry constants, `fill="currentColor"`, scaled
  and positioned so its curl sits on the G line. No font, no glyph character.
- **Green when** — both counts are right.
- **Refactor** — none.

#### Step B2 — One notehead per note, ascending left to right

Covers: R1, AC1

- **Test first** — same file: render seven fixture notes and assert seven
  `data-testid="notehead"` elements, with `cx` strictly increasing and `cy`
  strictly decreasing (a higher step sits higher on the page). Run it: fails.
- **Implement** — `ScaleStaff.tsx`: `cx = LEFT + i * ADVANCE`,
  `cy = BASELINE - step * (SPACE / 2)`, an `<ellipse>` per note, slightly
  rotated as a real notehead is, and **open** — stroked, not filled. These are
  whole notes — superseded by feature-15, which draws quarter notes: a filled
  head with a stem. The reasoning that follows is why this epic chose otherwise;
  it no longer describes the component. In particular a filled head *with* a
  stem is not "a different note value", which is what made the reversal cheap.
  Original text: whole notes; a filled head with no stem is a different note value, and seven
  filled ovals also read heavier than the staff they sit on.
- **Green when** — seven noteheads, both orderings hold.
- **Refactor** — extract `yFor(step)`; B3 and B4 both need it.

#### Step B3 — Accidentals sit to the left of their notehead

Covers: R2, R4

- **Test first** — same file: with a fixture carrying `♯`, `♭` and `♮`, assert
  each accidental element's `x` is less than its notehead's `cx` and its `y`
  matches that notehead's `cy`; and that a note with `''` renders no accidental.
  Run it: fails, nothing is rendered.
- **Implement** — `ScaleStaff.tsx`: an SVG `<text>` per accidental at
  `cx - ACCIDENTAL_OFFSET`, holding the `♯`, `♭` or `♮` character and carrying
  the jazz face through the same class `Lettering` uses. Assert in the same step
  that the rendered text content is the character itself — `♮` is the one glyph
  this app has never drawn before, and a font gap shows as a box, not an error.
- **Green when** — the three positions and the empty case are right.
- **Refactor** — none.

#### Step B4 — Two notes on one line do not collide

Covers: R4, AC2

- **Test first** — same file: with the C blues fixture — the `♭` and `♮` sharing
  a step — assert the two noteheads have equal `cy`, that their `cx` differ by at
  least one notehead width, and that the two accidental elements do not overlap
  horizontally. Run it: fails if B3 places accidentals at a fixed offset without
  checking the neighbour.
- **Implement** — `ScaleStaff.tsx`: when the previous note shares a step, push
  this accidental further left by one accidental width. The noteheads are already
  separated by `ADVANCE`; only the glyphs in front of them can clash.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step B5 — Notes outside the staff get ledger lines

Covers: R5, AC4

- **Test first** — same file: a fixture with a note at step 12 (`A5`, above the
  staff — the top line is `F5`, step 10) renders at least one `data-testid="ledger"` line at that note's `cy`,
  and a fixture entirely inside the staff renders none. Run it: fails.
- **Implement** — `ScaleStaff.tsx`: for each note outside the top or bottom
  line, draw a short line at every line-position between the staff and the note.
- **Green when** — both cases pass.
- **Refactor** — none.

#### Step B6 — The staff reads as its notes

Covers: R7, AC5

- **Test first** — same file: assert `getByRole('img', { name: 'E F♯ G A B C♯ D' })`
  finds the staff, and that no notehead or line is separately announced. Run it:
  fails, no role.
- **Implement** — `ScaleStaff.tsx`: `role="img"` and `aria-label={label}` on the
  `<svg>`; everything inside inherits presentational semantics.
- **Green when** — the query finds it.
- **Refactor** — none.

#### Step B7 — It sets no colour and scales to its box

Covers: R9, R10, AC8

- **Test first** — same file: assert every drawn element uses `currentColor` for
  stroke and fill and carries no colour class; assert the `<svg>` has a
  `viewBox` and `w-full` with no fixed pixel width, so it fits a phone. Run it:
  fails if B1 hardcoded a stroke.
- **Implement** — `stroke="currentColor"`, `fill="currentColor"` (or `none`
  where a shape is drawn rather than filled), `width`/`height` in the viewBox's
  own units, and `max-w-full h-auto`. **Natural size, not stretched:** one
  viewBox unit is one pixel, so a staff space is `SPACE` on screen whatever the
  panel is doing. Stretched to a card's full width the staff reads as a diagram
  of a staff rather than as notation, and it also made a six-note blues scale
  render larger than a seven-note mode. `max-w-full` is what still fits it on a
  phone: below its natural width the whole drawing scales down.
- **Green when** — green.
- **Refactor** — none.

### Track C — The staff in the panel

#### Step C1 — The panel draws the scale instead of listing it

Covers: R1, R1a, AC1, AC6a

- **Test first** — `SolvedPanel.test.tsx`: for `G Dorian`, assert the staff is
  present with its seven notes as its accessible name, and that no chip
  containing a note name is rendered. Run it: fails — the seven chips are still
  there.
- **Implement** — `SolvedPanel.tsx`: replace the notes column's `<ValueChips …>`
  with `<ScaleStaff notes={staffNotes(notes)} label={notes.join(' ')} />`.
- **Green when** — both assertions pass; the existing chip assertions in this
  file are rewritten here, not deleted.
- **Refactor** — `ValueChips` and the `LAYOUT` map now have no caller. Delete
  both, and drop the `Chip` import.

#### Step C2 — The panel stacks, sheet above staff

Covers: R1c, AC6

- **Test first** — `SolvedPanel.test.tsx`: assert the lead sheet appears before
  the staff in document order, that both are inside the panel, and that the
  container is no longer the two-column grid (`md:grid-cols-2` is absent). Run
  it: fails on the grid assertion.
- **Implement** — `SolvedPanel.tsx`: replace `<PanelColumns>` with a `Stack`,
  keeping both `LabelledColumn`s.
- **Green when** — the order and the absence of the grid both hold.
- **Refactor** — drop the `PanelColumns` import. Leave the primitive in place;
  it is the design system's, not this panel's.

#### Step C3 — A revealed day draws the same staff

Covers: R11, AC7

- **Test first** — `SolvedPanel.test.tsx`: with `revealed`, assert the staff is
  present with the same accessible name. Run it: passes if C1 is right.
- **Implement** — none.
- **Green when** — green.

#### Step C4 — The blues day renders

Covers: R4, R6, AC2

- **Test first** — `SolvedPanel.test.tsx`: render with `{ root: 'C', flavour:
  'Blues' }` and assert six noteheads and the `♭`/`♮` pair on one line. Run it:
  passes if A4 and B4 are right; this is the end-to-end guard for the one scale
  that breaks naive renderers.
- **Implement** — none.
- **Green when** — green.

#### Step C5 — The region list names the new component

Covers: R1

- **Test first** — `src/features/daily-groove/structure.test.ts`: add
  `'ScaleStaff'` to the `puzzle` region list. Run it: fails with
  `undeclared: ['puzzle/ScaleStaff']` from the moment B1 creates the file.
- **Implement** — the list edit.
- **Green when** — the structural suite is green.

## Integration and verification

- **Demo path** — solve a day whose scale carries a sharp and one whose scale
  carries a flat, and a blues day if one is in rotation: the accidentals are
  right, the notes ascend, the two blues notes share a line without touching.
  Narrow to phone width; switch palettes.
- **Full suite** — `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run
  build`.
- **The one thing to eyeball** — vertical alignment. Nothing in the test suite
  can tell you the noteheads sit *on* the lines rather than a pixel off, and
  jsdom will happily pass a staff that looks wrong.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, B1, B2, C1, C5 |
| R1a | C1 |
| R1b | A3, B1 |
| R1c | C2 |
| R2 | A1, A2, B3 |
| R3 | A1, A5 |
| R4 | A4, B4, C4 |
| R5 | B5 |
| R6 | A5, C4 |
| R7 | B6 |
| R8 | B1, B3 (jazz face via the same class `Lettering` uses) |
| R9 | B7 |
| R10 | B7 |
| R11 | C3 |
| R12 | B1 (no state, no handlers) |
| AC1 | A1, A2, B2, C1 |
| AC2 | A4, B4, C4 |
| AC3 | A5 |
| AC4 | B5 |
| AC5 | B6 |
| AC6 | C2 |
| AC6a | C1 |
| AC6b | A3 |
| AC7 | C3 |
| AC8 | B7 |

## Assumptions

- `staff.ts` sits in `theory/` beside `notes.ts`: it is about how notation
  spells a scale, and it renders nothing.
- The staff is one octave and one voice. No key signature, so every accidental is
  drawn in front of its note — which is also what makes the blues pair readable.
- The accidental slot fits two characters: `C♯ Lydian` spells `F♯♯`, so double
  accidentals are not hypothetical.
- Test ids (`staff-line`, `clef`, `notehead`, `ledger`) are the seam for testing
  a drawing; `TransportPanel.test.tsx` already tests `progress-divider` this way.
- The clef path data is artwork, not generated: it is checked in as a string
  constant with a comment naming the viewBox it was drawn against, so a later
  change to the staff's size cannot silently distort it.
- Sizing constants (`SPACE`, `ADVANCE`, `LEFT`) live in `ScaleStaff.tsx` as
  module constants, not in the design system's token scale — they are the
  drawing's internal geometry, not spacing anyone else can use.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only: never
rewrite or prune a past cycle.

### Cycle 1 — 2026-08-31

**Q1. How are the clef and the accidentals drawn?**
Decision: **A) Clef as an SVG path, noteheads as ellipses, accidentals as the
`♯ ♭ ♮` characters in the jazz face** — the app already renders `♯` and `♭`
today, so those glyphs are proven; one hand-drawn path is the whole cost, and no
second font file is loaded. Shipping Petaluma's notation face would have handed
glyph positioning to font metrics instead of the drawing's own geometry.
Changed: Architecture (a new paragraph settling the glyph strategy), Step B1
(the clef is a `<path>` with checked-in data), Step B3 (accidentals are
characters, and the step now asserts `♮` renders rather than falling back to a
box), Assumptions (the path data is artwork).
