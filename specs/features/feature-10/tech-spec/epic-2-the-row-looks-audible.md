# Tech spec — Epic 2: The row looks audible

PRD: [../prd/epic-2-the-row-looks-audible.md](../prd/epic-2-the-row-looks-audible.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three small tracks. `Chip` gains one optional string prop that renders before
the label, hidden from the accessibility tree; `ChipGroup` passes it through;
the feature hands `'♪'` to the root row, hands nothing to the mode row, and
rewrites the groove card's caption. The only thing that needs care is that a
prop meaning "audible" must not appear anywhere in the design system — the chip
takes an `adornment`, and the feature is what decides it means sound.

No new files. Three existing components change, plus one test in another
feature's suite that asserts the old caption string.

## Architecture

`Chip` renders `{adornment}{label}` where the adornment is a `<span
aria-hidden="true">`. A string rather than a `ReactNode`: `♪` is text, and a
node slot would let a component into a primitive that has none. The chip's
accessible name is unchanged because `aria-hidden` removes the glyph from the
name computation — the same technique `HowToPlay` uses for its emoji and
`ModeToggle` for its track.

`ChipGroup` takes the same optional string and gives every chip in the row the
same one. Not a per-option function: every root chip carries the same glyph, and
a callback would invite a row where some chips sound and others do not, which is
not a state this app has.

The caption is a plain string inside `GroovePuzzle.tsx`, where it lives today.
It does not move to `src/lib/branding.ts` — that module exists because the app
name and tagline are needed in two layers, and this sentence is needed in one.

## Contracts

```ts
// src/components/controls/Chip.tsx
type ChipProps = {
  label: string
  selected: boolean
  disabled: boolean
  onSelect: () => void
  tone?: ChipTone
  /** Decorative glyph rendered before the label, hidden from assistive tech. */
  adornment?: string
}

// src/components/controls/ChipGroup.tsx
type ChipGroupProps = {
  // …unchanged…
  /** Given to every chip in the row. */
  adornment?: string
}
```

- The caption string, verbatim: `Find the note that feels like home — Play along
  with your instrument or tap a root to hear it.`
- The glyph, verbatim: `♪` (U+266A).

## Tracks

### Track A — `Chip` can carry a glyph

- **Goal** — `Chip` renders an optional decorative adornment and is otherwise
  byte-identical in behaviour.
- **Owns** — `src/components/controls/Chip.tsx`, `Chip.test.tsx`
- **Depends on** — the `ChipProps` contract only
- **Parallel with** — B, C
- **Done when** — its own tests pass.

### Track B — `ChipGroup` passes it through

- **Goal** — a row can be given one adornment for all its chips.
- **Owns** — `src/components/controls/ChipGroup.tsx`, `ChipGroup.test.tsx`
- **Depends on** — the `ChipProps` contract
- **Parallel with** — A, C
- **Done when** — its own tests pass, driven through `Chip` as they are today.

### Track C — The card says it

- **Goal** — the root row carries `♪`, the mode row does not, and the caption
  reads the new sentence.
- **Owns** — `src/features/daily-groove/components/puzzle/GuessCard.tsx` (the
  two `ChipGroup` call sites only), `components/GroovePuzzle.tsx` (the caption
  only), and the guess-card and groove-card test files
- **Depends on** — the `ChipGroupProps` contract
- **Parallel with** — A, B
- **Done when** — its tests pass; they assert on rendered output, so they go
  green once A and B land.

**The one cross-epic seam:** Epic 1 also opens `GuessCard` and `GroovePuzzle`.
Epic 1 owns the root row's `onSelect` and the reference-note hook; this epic
owns the `adornment` props and the caption string. Neither goes near the other's
lines.

**The one cross-feature edit:** `specs/feature-4`'s caption assertion. Step C4
updates it; see *Integration*.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C.
- **Wave 2:** Integration — the cross-feature test update and the full suite.

## Implementation

### Track A — `Chip` can carry a glyph

#### Step A1 — A chip with no adornment is unchanged

Covers: R6, R7, AC7

- **Test first** — `src/components/controls/Chip.test.tsx`: assert that a
  `Chip` with no `adornment` renders exactly one element inside the button, that
  its text content equals the label, and that its accessible name equals the
  label — in both `default` and `inverted` tones. Run it: passes today. This is
  the regression guard for the whole track; write it first and keep it green.
- **Implement** — none.
- **Green when** — green in both tones.

#### Step A2 — A chip with an adornment renders it before the label

Covers: R1, R8

- **Test first** — same file: render `<Chip label="C" adornment="♪" … />` and
  assert the button's text content is `♪C` — the glyph first — and that the
  button still has exactly one accessible name. Run it: fails, text content is
  `C`.
- **Implement** — `Chip.tsx`: add `adornment?: string`, and render
  `{adornment && <span aria-hidden="true" className="…">{adornment}</span>}`
  before `{label}`. Use the existing flex row; give the span a small right
  margin and no line-height of its own so R8's equal height holds.
- **Green when** — text content is `♪C` and A1 stays green.
- **Refactor** — none.

#### Step A3 — The adornment is hidden from assistive technology

Covers: R4, AC5

- **Test first** — same file: assert the chip's accessible name is exactly `C`,
  with no `♪` in it, and that the span carries `aria-hidden="true"`. Run it:
  fails if A2 rendered a bare span — the name computation would include the
  glyph.
- **Implement** — the `aria-hidden` from A2, if it was not already there.
- **Green when** — the accessible name is `C`.
- **Refactor** — none.

#### Step A4 — It survives every chip state

Covers: R3, R9

- **Test first** — same file: with `adornment="♪"`, assert the glyph is present
  when `selected`, when `disabled`, and in the `inverted` tone; and that the
  glyph's element carries no colour class of its own, so it inherits the chip's
  ink in every state. Run it: fails on the colour assertion if A2 hard-coded a
  muted token.
- **Implement** — the adornment span inherits `currentColor`; no palette class.
- **Green when** — all four assertions pass.
- **Refactor** — none.

### Track B — `ChipGroup` passes it through

#### Step B1 — A group with no adornment is unchanged

Covers: R7, AC8

- **Test first** — `src/components/controls/ChipGroup.test.tsx`: assert that a
  group rendered without `adornment` produces chips whose text content is
  exactly their option label. Run it: passes today; the track's regression
  guard.
- **Implement** — none.
- **Green when** — green.

#### Step B2 — A group gives its adornment to every chip

Covers: R1, R3

- **Test first** — same file: render a four-option group with
  `adornment="♪"` and assert all four chips' text content begins with `♪`, and
  that each accessible name is still its bare option. Run it: fails with a type
  error — `ChipGroup` has no `adornment` prop.
- **Implement** — `ChipGroup.tsx`: add `adornment?: string` and forward it to
  every `Chip`.
- **Green when** — four chips carry the glyph, four names are bare.
- **Refactor** — none.

### Track C — The card says it

#### Step C1 — The root row carries the glyph, the mode row does not

Covers: R1, R2, AC1, AC2

- **Test first** — `components/puzzle/GuessCard.test.tsx`: render the card and
  assert every chip inside the `Root` radiogroup has text content beginning `♪`,
  and that no chip inside the `Mode` radiogroup does. Run it: fails — no chip
  has it.
- **Implement** — `GuessCard.tsx`: pass `adornment="♪"` to the root
  `ChipGroup`; leave the mode `ChipGroup` untouched.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C2 — Both modes, and a finished day

Covers: R3, AC3, AC4

- **Test first** — same file: with `simple` on, assert all six root chips carry
  the glyph; and with `solved` true, assert the disabled root chips still carry
  it. Run it: passes if C1 is right — these prove the glyph is not conditioned
  on mode or on the `over` lock.
- **Implement** — none.
- **Green when** — green.

#### Step C3 — The caption reads the new sentence

Covers: R1a, R5, AC6

- **Test first** — `components/GroovePuzzle.test.tsx`: assert the exact string
  `Find the note that feels like home — Play along with your instrument or tap a
  root to hear it.` is in the document, and that the old
  `Play along. Find the note that feels like home.` is not. Run it: fails — the
  old string is present.
- **Implement** — `GroovePuzzle.tsx`: replace the caption text inside the
  existing `<Text tone="muted" size="sm">`. The element, its tone, its size and
  its position under the play control are unchanged.
- **Green when** — the new string is found and the old one is gone.
- **Refactor** — none.

#### Step C4 — The caption still sits below the control at full width

Covers: R1a, AC6a

- **Test first** — same file: assert the caption element still follows the play
  control in DOM order within the groove card, which is what feature-4 Epic 2
  AC3 requires. Run it: passes — C3 changed only the string. Write it so a later
  edit cannot move the caption while chasing its wording.
- **Implement** — none.
- **Green when** — green.

#### Step C5 — Nothing about the glyph is remembered

Covers: R10, AC11

- **Test first** — same file: click a root chip, unmount, re-render via
  `renderFeature()`, and assert every root chip still carries the glyph. Also
  assert nothing new was written to the preference store. Run it: passes — the
  proof that no "seen it" state was introduced.
- **Implement** — none.
- **Green when** — green.

## Integration and verification

#### Step I1 — Feature-4's caption assertion is updated

Covers: R1a

- **Test first** — run `npm test`. `specs/feature-4`'s caption test fails on the
  old string: it is the only place the old wording is asserted, and this failure
  is expected.
- **Implement** — update that assertion to the new sentence. Leave every other
  assertion in that file alone — feature-4 Epic 2 R4's *position* half still
  stands, and its AC3 must stay green untouched.
- **Green when** — the whole suite is green.
- **Refactor** — none.

#### Step I2 — `SolvedPanel` is untouched

Covers: R6, AC9

- **Test first** — `components/puzzle/SolvedPanel.test.tsx`: assert its chips
  render no adornment and their text content is exactly their value. Run it:
  passes — the guard that the new prop did not acquire a default.
- **Implement** — none.
- **Green when** — green.

#### Step I3 — Suite, types, lint and the eye

- `npm test` green; `npm run lint`; `npx tsc --noEmit`.
- `src/components/structure.test.ts` still green — no component was added, so
  its `COMPONENTS` declaration is unchanged.
- Demo: load the page cold in both palettes. The root chips carry a legible `♪`
  in idle, selected and disabled states; the mode chips carry nothing; the two
  rows are the same height; and the caption reads the new sentence.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A2, B2, C1 |
| R1a | C3, C4, I1 |
| R2 | C1 |
| R3 | A4, B2, C2 |
| R4 | A3 |
| R5 | C3 |
| R6 | A1, A4, I2 |
| R7 | A1, B1 |
| R8 | A2, I3 |
| R9 | A4, I3 |
| R10 | C5 |
| AC1 | C1 |
| AC2 | C1 |
| AC3 | C2 |
| AC4 | C2 |
| AC5 | A3 |
| AC6 | C3 |
| AC6a | C4 |
| AC7 | A1 |
| AC8 | B1 |
| AC9 | I2 |
| AC10 | I3 |
| AC11 | C5 |

## Assumptions

- **`adornment` is the prop name** — it says what it is, not what it means, so
  the primitive stays free of the feature's vocabulary. `icon`, `glyph` and
  `audible` were all rejected: the first two imply a rendering, the third a
  domain.
- **One adornment per row, not per option.** A per-option callback would model a
  row where some chips sound and some do not; there is no such row.
- **The glyph inherits `currentColor`**, so R9's legibility on the accent
  surface is the chip's existing contrast, already covered by the design system's
  own tests.
- **The caption string stays inline in `GroovePuzzle.tsx`.** It is needed in one
  place; `src/lib/branding.ts` exists for strings needed in two.
- **`♪` needs no font work.** It is text in the page's body stack, not an emoji,
  so it takes the chip's colour and size rather than a colour font's own.

*No open architectural questions.* Every decision here is either frozen in
*Contracts* or listed above as a reversible assumption.
