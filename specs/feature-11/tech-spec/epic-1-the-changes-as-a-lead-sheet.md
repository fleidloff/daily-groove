# Tech spec — Epic 1: The changes as a lead sheet

PRD: [../prd/epic-1-the-changes-as-a-lead-sheet.md](../prd/epic-1-the-changes-as-a-lead-sheet.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three tracks. A pure function in `lib/theory/` turns `groove.progression` into
exactly four chord symbols using the generator's own `bar % chords.length`
rule. A new `LeadSheet` component in `components/puzzle/` draws those four
symbols as barred bars in the jazz face. `SolvedPanel` swaps its "The changes"
chips for it and stops being handed `groove.chord`.

The only decision with reach beyond this epic is how the jazz face gets to a
component that is not the masthead — Epics 2 and 3 need the same route, so it
is settled here and they build against it.

## Architecture

```
lib/theory/changes.ts        barChords('C7–Em7♭5–B♭maj7–Fmaj7') → 4 symbols
        │
        ▼
components/puzzle/LeadSheet.tsx   props: { chords: string[] }  — draws, derives nothing
        │
        ▼
components/puzzle/SolvedPanel.tsx  calls barChords(progression), renders <LeadSheet/>
```

`SolvedPanel` keeps the derivation, exactly as it already calls `scaleNotes` for
the other column. `LeadSheet` is handed four strings and knows nothing about
progressions, modulo arithmetic, or where they came from — which is what lets
Epic 3 reuse `barChords` without reusing the drawing.

**The medium is HTML, not SVG.** The sheet is four text symbols with rules
between them. In HTML that is a flex row with borders, which wraps two-by-two at
a narrow width for free (R10), inherits `currentColor` from the inverted panel
for free (R8), and needs no viewBox arithmetic to stay crisp. SVG buys nothing
here — it is Epic 2's staff, where real geometry starts, that needs it.

**The jazz face reaches the sheet through a design-system primitive.**
`src/components/typography/Lettering.tsx` renders a `<span>` in `font-jazz` at a
caller-chosen size. It carries no domain word and no music: it is "text in the
hand-lettered face", usable by anything. `Heading` size `xl` keeps its own
`font-jazz` — the masthead is not refactored to go through it.

## Contracts

```ts
// src/features/daily-groove/lib/theory/changes.ts
/**
 * The chord sounding in each bar of the four-bar figure, in order.
 *
 * The generator comps `progressionMidi[bar % length]` (scripts/grooves/events.ts,
 * `chordFor`), so a three-chord progression plays 1 2 3 1 and bar four is a
 * return, not a change. Total: never throws, always four entries.
 */
export function barChords(progression: string): string[]

// src/components/typography/Lettering.tsx
type LetteringSize = 'sm' | 'md' | 'lg'
type LetteringProps = { children: ReactNode; size?: LetteringSize }
export function Lettering({ children, size }: LetteringProps): JSX.Element

// src/features/daily-groove/components/puzzle/LeadSheet.tsx
type LeadSheetProps = {
  /** One symbol per bar, in order. Four for the four-bar figure. */
  chords: string[]
}
export function LeadSheet({ chords }: LeadSheetProps): JSX.Element
```

- `BAR_COUNT = 4`, declared in `changes.ts` and imported by anything that needs
  it. `TransportPanel` keeps its own local constant; the two are not merged in
  this epic.
- Separator: the en dash `–` (U+2013), the character the generator writes.

## Tracks

### Track A — `barChords`

- **Goal** — the bar mapping exists, is total, and is proven against the
  catalogue.
- **Owns** — `src/features/daily-groove/lib/theory/changes.ts`,
  `changes.test.ts`
- **Depends on** — nothing.
- **Parallel with** — B, C(partly)
- **Done when** — its own tests pass.

### Track B — `Lettering`

- **Goal** — the jazz face is reachable from anywhere without a raw utility
  class.
- **Owns** — `src/components/typography/Lettering.tsx`, `Lettering.test.tsx`,
  and the `typography` list in `src/components/structure.test.ts`
- **Depends on** — the `LetteringProps` contract only.
- **Parallel with** — A, C
- **Done when** — its own tests pass.

### Track C — The sheet in the panel

- **Goal** — the payoff panel draws the changes as a lead sheet and shows the
  tonic chord once.
- **Owns** — `src/features/daily-groove/components/puzzle/LeadSheet.tsx` +
  test, `SolvedPanel.tsx` + test, the `puzzle` region list in
  `src/features/daily-groove/structure.test.ts`, and the one
  `chord={groove.chord}` line in `components/GroovePuzzle.tsx`
- **Depends on** — the `barChords` and `LeadSheetProps` contracts. It can be
  written against both before A and B are implemented; its tests go green when
  they land.
- **Parallel with** — A, B
- **Done when** — the panel's tests pass with the full suite green.

**Cross-epic seams.** Epic 2 reopens `SolvedPanel.tsx` and the same region list
to add the staff and retire `ValueChips`; it is a later wave, not a parallel
track. Epic 3 reopens `GroovePuzzle.tsx` for the `TransportPanel` call site, so
it must not run in the same wave as Track C, which owns the `SolvedPanel` call
site in that file. Epic 3 imports `barChords` and nothing else from here.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C.
- **Wave 2:** Integration — full suite, lint, build, and the manual demo.

## Implementation

### Track A — `barChords`

#### Step A1 — A four-chord progression is one chord per bar

Covers: R2, R3, AC1

- **Test first** — `src/features/daily-groove/lib/theory/changes.test.ts`:
  `expect(barChords('C7–Em7♭5–B♭maj7–Fmaj7')).toEqual(['C7','Em7♭5','B♭maj7','Fmaj7'])`.
  Run it: fails with "Failed to resolve import ./changes".
- **Implement** — `lib/theory/changes.ts`: `export const BAR_COUNT = 4` and
  `barChords(progression)` splitting on `'–'`, trimming each part, and mapping
  `i => parts[i % parts.length]` for `i` in `0..BAR_COUNT-1`.
- **Green when** — that assertion passes.
- **Refactor** — none.

#### Step A2 — A three-chord progression repeats bar one in bar four

Covers: R2, AC2

- **Test first** — same file:
  `expect(barChords('Em7–Bm7–C♯m7♭5')).toEqual(['Em7','Bm7','C♯m7♭5','Em7'])`.
  Run it: passes if A1's modulo is right. If it fails, A1 hardcoded four parts —
  fix A1, not the test.
- **Implement** — none if A1 is correct.
- **Green when** — green, with A1 still green.

#### Step A3 — Degenerate progressions do not throw

Covers: R3, AC3

- **Test first** — same file: `barChords('C7')` → four `'C7'`;
  `barChords('A–B–C–D–E')` → `['A','B','C','D']`; `barChords('')` → four empty
  strings, and the call does not throw. Run it: the empty case fails or throws,
  depending on A1's split.
- **Implement** — `changes.ts`: filter out empty segments after trimming; when
  nothing is left, return four empty strings rather than throwing. A missing
  progression is a data problem, and the panel showing four blank bars beats the
  day's payoff crashing.
- **Green when** — all three cases pass.
- **Refactor** — none.

#### Step A4 — Every catalogued groove maps to four bars

Covers: R2, R3

- **Test first** — same file: import `GROOVES` from `../../data/grooves.generated`
  and assert that for every groove, `barChords(groove.progression)` has length 4,
  contains no empty string, and its first entry equals `groove.chord` — the
  generator writes the tonic as bar one (`events.test.ts` asserts the same
  relation from its side). Run it: passes if A1–A3 are right; this is the
  tripwire for a future catalogue that breaks the assumption.
- **Implement** — none.
- **Green when** — green across all 30 grooves.

### Track B — `Lettering`

#### Step B1 — Lettering renders its children in the jazz face

Covers: R4

- **Test first** — `src/components/typography/Lettering.test.tsx`: render
  `<Lettering>Cm7</Lettering>`, assert the text is present and its element's
  `className` matches `/font-jazz/`. Run it: fails, module not found.
- **Implement** — `src/components/typography/Lettering.tsx`: a `<span>` with
  `font-jazz` plus a size class from a closed `SIZE` map (`sm`, `md`, `lg`),
  defaulting to `md`. No colour class at all — it inherits `currentColor`, which
  is what makes it legible on the inverted panel and on paper alike.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step B2 — It sets no colour of its own

Covers: R8

- **Test first** — same file: assert the rendered `className` contains no
  `text-` colour token (`/text-(text|on-accent|accent)/` does not match) while
  size classes may still use `text-[…px]`. Run it: fails if B1 added a tone.
- **Implement** — remove any colour class.
- **Green when** — green.

#### Step B3 — The design system knows it exists

Covers: R4

- **Test first** — `src/components/structure.test.ts`: add `'Lettering'` to the
  `typography` group list. Run it: passes only when the file and its test are
  both on disk — that test asserts both.
- **Implement** — the list edit.
- **Green when** — `src/components/structure.test.ts` is green.

### Track C — The sheet in the panel

#### Step C1 — A lead sheet draws one symbol per bar

Covers: R1, AC1

- **Test first** — `src/features/daily-groove/components/puzzle/LeadSheet.test.tsx`:
  render `<LeadSheet chords={['C7','Em7♭5','B♭maj7','Fmaj7']} />` and assert all
  four symbols are present, in document order. Run it: fails, module not found.
- **Implement** — `LeadSheet.tsx`: a flex row of four bar elements, each
  rendering `<Lettering size="md">{chord}</Lettering>`.
- **Green when** — the four symbols render in order.
- **Refactor** — none.

#### Step C2 — It is barred, doubled at the end, and carries no stave

Covers: R5, R5a, AC5, AC5a

- **Test first** — same file: assert each bar element carries a left border
  class and the last carries the doubled-bar treatment; assert the rendered
  markup contains no `<svg>` and no element whose class marks a stave line; and
  assert no title, tempo or key text is rendered when only `chords` is given.
  Run it: fails on the border and double-bar assertions.
- **Implement** — `LeadSheet.tsx`: `border-l` on every bar, a right-hand double
  rule on the last one (a `border-r-[3px]` plus a `border-r` inset, or an
  explicit final element), spacing between bars from the design system's scale.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step C3 — The sheet reads as text to a screen reader

Covers: R9, AC6

- **Test first** — same file: assert the sheet exposes an accessible name
  listing the four chords in order — `getByRole('img', { name: 'C7 · Em7♭5 · B♭maj7 · Fmaj7' })`
  — and that the bar decorations themselves are not separately announced. Run
  it: fails, no role.
- **Implement** — `LeadSheet.tsx`: `role="img"` with an `aria-label` joining the
  chords with `' · '`; the bar elements get `aria-hidden` only if they carry
  text of their own (they should not).
- **Green when** — the query finds it.
- **Refactor** — none.

#### Step C4 — Four bars wrap two-by-two on a narrow panel

Covers: R10

- **Test first** — same file: assert the row's container carries `flex-wrap`
  and that each bar's basis is a half-width class at the narrow breakpoint, so
  four bars become 2 × 2 rather than overflowing. Run it: fails.
- **Implement** — `LeadSheet.tsx`: `flex-wrap` with a `basis-1/2 sm:basis-0
  sm:flex-1` shape on each bar. Order is document order either way, so wrapping
  preserves bar order.
- **Green when** — green, and C1 still green.
- **Refactor** — none.

#### Step C5 — The panel draws the changes instead of listing them

Covers: R1, R2, R6, R7, AC1, AC2, AC4

- **Test first** — `SolvedPanel.test.tsx`: with `progression="Cm–Fm–G7"`, assert
  the four bars read `Cm`, `Fm`, `G7`, `Cm`, and that no chip carries the text
  `Cm–Fm–G7`. Assert the tonic-appears-once half of AC4 on a *four*-chord
  progression — `C7–Em7♭5–B♭maj7–Fmaj7`, where `C7` occurs exactly once — because
  in a three-chord progression bar four correctly *is* the tonic again, and
  counting `Cm` there would fail on behaviour R2 requires. Run it: fails — the
  chips are still there.
- **Implement** — `SolvedPanel.tsx`: import `barChords`, replace the changes
  column's `<ValueChips values={[chord, progression]} layout="row" />` with
  `<LeadSheet chords={barChords(progression)} />`. Leave the notes column and
  the `ValueChips` helper alone — Epic 2 retires them.
- **Green when** — the three assertions pass; existing panel tests that asserted
  the two chips are rewritten in this step, not deleted.
- **Refactor** — the `row` entry in the file's `LAYOUT` map is now unused;
  remove it and keep `grid`.

#### Step C6 — The panel no longer takes a tonic chord

Covers: R6

- **Test first** — `SolvedPanel.test.tsx`: remove `chord` from the test's
  `renderPanel` defaults. Run it: fails to typecheck while the prop is still
  required.
- **Implement** — `SolvedPanel.tsx`: drop `chord` from `SolvedPanelProps` and
  the destructure; `components/GroovePuzzle.tsx`: drop the `chord={groove.chord}`
  line from the `SolvedPanel` call site. That one line is this track's only edit
  in that file.
- **Green when** — typecheck passes and the panel tests are green.
- **Refactor** — none.

#### Step C7 — A revealed day draws the same sheet

Covers: R11, AC7

- **Test first** — `SolvedPanel.test.tsx`: with `revealed`, assert the same four
  bars render. Run it: passes if C5 is right; it is the guard against a later
  change hiding the sheet behind the win state.
- **Implement** — none.
- **Green when** — green.

#### Step C8 — The ink comes from the panel

Covers: R8, AC8

- **Test first** — `SolvedPanel.test.tsx`: assert no element inside the sheet
  carries a hardcoded colour class — no `text-on-accent`, no `text-text`, no
  hex — so it inherits the panel's ink in both palettes. Run it: fails if C1 or
  B1 set a tone.
- **Implement** — remove any colour class.
- **Green when** — green.

#### Step C9 — The region list names the new component

Covers: R1

- **Test first** — `src/features/daily-groove/structure.test.ts`: add
  `'LeadSheet'` to the `puzzle` region list. Run it: it already fails before this
  edit, with `undeclared: ['puzzle/LeadSheet']`, the moment C1 creates the file —
  so run the structural suite as soon as C1 lands rather than at the end.
- **Implement** — the list edit.
- **Green when** — the structural suite is green.

## Integration and verification

- **Wire-up** — none beyond C5 and C6; the panel is already composed.
- **Demo path** — `npm run dev`, solve today's puzzle (or give up), and read the
  payoff panel: four barred bars in the hand-lettered face, the tonic chord
  appearing once, the final bar doubled. Narrow the window to phone width and
  confirm the bars wrap two-by-two in order. Switch the palette and confirm the
  ink follows.
- **Full suite** — `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run
  build`. The structural tests in both `structure.test.ts` files must be green;
  they are the two files most likely to be forgotten.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | C1, C5, C9 |
| R2 | A1, A2, A4, C5 |
| R3 | A1, A3, A4 |
| R4 | B1, B3 |
| R5 | C2 |
| R5a | C2 |
| R6 | C5, C6 |
| R7 | C5 |
| R8 | B2, C8 |
| R9 | C3 |
| R10 | C4 |
| R11 | C7 |
| R12 | C1 (no state, no handlers) |
| AC1 | A1, C1, C5 |
| AC2 | A2, C5 |
| AC3 | A3 |
| AC4 | C5 |
| AC5 | C2 |
| AC5a | C2 |
| AC6 | C3 |
| AC7 | C7 |
| AC8 | C8 |

## Assumptions

- `barChords` lives in `theory/` rather than `presentation/`: it is harmony laid
  over bars, the same subject as `notes.ts`, and it renders nothing.
- `Lettering` takes three sizes because three call sites are coming — the sheet,
  the staff's lettering, and Epic 3's track labels. It gains no tone prop; ink is
  inherited.
- The double bar is drawn with borders rather than a glyph, so it scales with the
  panel's type rather than with a font's metrics.
- No test asserts the rendered font *file*; asserting `font-jazz` is on the
  element is the practical limit in jsdom, and `Heading.test.tsx` already sets
  that precedent.
