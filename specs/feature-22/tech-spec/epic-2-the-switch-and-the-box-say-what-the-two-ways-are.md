# Tech spec — Epic 2: The switch and the box say what the two ways are

PRD: [../prd/epic-2-the-switch-and-the-box-say-what-the-two-ways-are.md](../prd/epic-2-the-switch-and-the-box-say-what-the-two-ways-are.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Five files change what they say and two lines change rooms; no module moves and
no new module appears. The design-system `Switch` gains one optional prop,
`description`, rendered inside the button beneath the label and exposed through
`aria-describedby`, while `aria-labelledby` pins the accessible name to the label
alone. Every new word lands in `src/lib/snippets/en/` first, additively, so the
consumer tracks can run in parallel against frozen key names; the two retired
keys (`puzzle.captionSoundsOn/Off`, `intro.drumCredit`) are deleted in a last
wave once nothing reads them. The caption under the play button is not moved —
it is deleted, and the coaching ladder's rung one is reworded to carry the same
advice, so the hint box already shows it before the first Check through
`selectCoaching` with no change to `lib/presentation/`. The drum credit moves as
a block, constants and links intact, from `HowToPlay.tsx` to the foot of
`GrooveCard.tsx`.

## Architecture

- **Design system.** `src/components/controls/Switch.tsx` renders
  `<button role="switch" aria-labelledby={labelId} aria-describedby={descriptionId?}>`
  with a left column of two spans (label, optional description) and the
  `aria-hidden` track on the right. It takes the description as a string prop
  and imports nothing from `@/lib/snippets` (`src/components/structure.test.ts`
  holds it to that).
- **Feature slice, shell.** `components/puzzle/ModeToggle.tsx` passes
  `puzzle.simpleModeOn` / `puzzle.simpleModeOff` by state.
  `components/intro/HowToPlay.tsx` renders `intro.twoWays` as a `Text` paragraph
  after the `<ol>` and loses the credit block. `components/puzzle/GrooveCard.tsx`
  renders the credit block as the last child of its `Stack`, after `{children}`.
  `components/GroovePuzzle.tsx` loses the `Text` caption and the `Stack gap="sm"`
  that existed only to hold it under `PlayControl`.
- **Coaching.** `src/lib/snippets/en/coaching.ts` rewords `opening`, and
  `ladder[0]` becomes `{ message: opening, soundsOff: openingSoundsOff }`.
  `lib/presentation/feedback.ts` (`coaching.opening`), `moves.ts`
  (`coaching.ladder`) and `coaching.ts` (`tapSounds ? message : soundsOff`) are
  untouched — the hint box already shows rung 0 before the first Check
  (`guessCardView` → `selectCoaching({ attempts: [] })`), and already swaps to
  `soundsOff` when tap sounds are off.
- **Snippets.** `PuzzleSnippets` gains `simpleModeOn`, `simpleModeOff`,
  `drumCredit` and loses `captionSoundsOn`, `captionSoundsOff`; `IntroSnippets`
  gains `twoWays` and loses `drumCredit`; `CoachingSnippets` is unchanged in
  shape. The wording itself is pinned in `src/lib/snippets/snippets.test.ts`, the
  one place a sentence may be written out.
- **Tests that move with their subject.** The credit `describe` in
  `HowToPlay.test.tsx` moves to `GrooveCard.test.tsx` (same text, same two
  links, same `target`/`rel`, same faint small type). The caption assertions in
  `GroovePuzzle.sounding.test.tsx` and the `caption` field of the shape in
  `GroovePuzzle.page.test.tsx` become hint-box assertions read through the
  harness's `move()` / `coachingLine()`; the harness's `CAPTION` and
  `CAPTION_SOUNDS_OFF` exports go.

## Contracts

```ts
// src/components/controls/Switch.tsx — frozen
type SwitchProps = {
  label: string
  checked: boolean
  onChange(checked: boolean): void
  disabled?: boolean
  description?: string
}
// Rendering contract:
//   accessible name       === label            (aria-labelledby → the label span)
//   accessible description === description     (aria-describedby → the description span; attribute absent without one)
//   description span classes include `text-[12px]` and `text-text-faint`; it follows the label span in the same column
//   without `description` the button's textContent === label, as today
```

```ts
// src/lib/snippets/types.ts — frozen key names
export type IntroSnippets = {
  title: string
  closeName: string
  steps: readonly [IntroStep, IntroStep, IntroStep, IntroStep]   // stays a 4-tuple
  twoWays: string                                                // new
  // drumCredit: removed in Wave 3
}

export type PuzzleSnippets = {
  // ...existing keys unchanged...
  simpleModeOn: string    // new — description while the switch is on
  simpleModeOff: string   // new — description while the switch is off
  drumCredit: string      // new — moved here from IntroSnippets
  // captionSoundsOn, captionSoundsOff: removed in Wave 3
}

// CoachingSnippets: shape unchanged. ladder[0] gains a soundsOff.
```

```ts
// src/lib/snippets/en/* — the settled wording (PRD R2, R4, R6, R8)
puzzle.simpleMode    === 'Simple mode'                       // unchanged
puzzle.simpleModeOn  === 'Six roots, Major or Minor'
puzzle.simpleModeOff === 'Twelve roots, four modes'
puzzle.drumCredit    === 'Drum samples provided by DrumGizmo.org'
intro.twoWays        === 'Two ways to play: Simple mode is six roots, Major or Minor. The switch on the card opens up the full set.'
coaching.opening     === 'Loop it a few times. Find the note that feels like home — Play along with your instrument, or tap a root or a mode to hear it.'
coaching.ladder[0]   === { message: coaching.opening,
                           soundsOff: 'Loop it a few times. Find the note that feels like home — Play along with your instrument.' }
```

```tsx
// src/features/daily-groove/components/puzzle/GrooveCard.tsx — the credit block, verbatim from HowToPlay.tsx
const DRUM_CREDIT_URL = 'https://drumgizmo.org'
const DRUM_CREDIT_LICENCE = 'CC BY 4.0'
const DRUM_CREDIT_LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/'
// rendered as the last child of the card's Stack, after {children}:
<Text tone="faint" size="sm">
  <a href={DRUM_CREDIT_URL} target="_blank" rel="noopener noreferrer" className={CREDIT_LINK}>{puzzle.drumCredit}</a>
  {' · '}
  <a href={DRUM_CREDIT_LICENCE_URL} target="_blank" rel="noopener noreferrer" className={CREDIT_LINK}>{DRUM_CREDIT_LICENCE}</a>
</Text>
```

Test commands: `npm test` for every track.

## Tracks

### Track A — The Switch learns a description

- **Goal** — `Switch` accepts `description`, renders it beneath the label in
  faint 12px type, exposes it as the accessible description, keeps the name to
  the label, and is byte-for-byte the same without it.
- **Owns** — `src/components/controls/Switch.tsx`,
  `src/components/controls/Switch.test.tsx`
- **Role** — `implementer`
- **Depends on** — the `SwitchProps` contract only
- **Parallel with** — Track B
- **Done when** — `Switch.test.tsx` is green, `src/components/structure.test.ts`
  is green (no snippet import), and every other Switch consumer
  (`TapSoundsToggle`, `ModeToggle` as it is today) still passes.

### Track B — The words

- **Goal** — every new string exists under `src/lib/snippets/en/` with its type,
  rung one is reworded with a sounds-off variant, and — in Wave 3 — the two
  retired keys are gone.
- **Owns** — `src/lib/snippets/en/puzzle.ts`, `src/lib/snippets/en/intro.ts`,
  `src/lib/snippets/en/coaching.ts`, `src/lib/snippets/types.ts`,
  `src/lib/snippets/snippets.test.ts`,
  `src/features/daily-groove/lib/presentation/coaching.test.ts`
- **Role** — `implementer`
- **Depends on** — nothing (Wave 1 steps are additive; Wave 3 step needs C, D, E
  landed)
- **Parallel with** — Track A
- **Done when** — `snippets.test.ts`, `lib/presentation/*.test.ts` and the two
  structural guards (`structure.test.ts` in the slice and in `src/components/`)
  are green after B1–B4; after B5 the whole suite is green with no reference to
  `captionSoundsOn`, `captionSoundsOff` or `intro.drumCredit` anywhere under
  `src/`.
- **Shared with Epic 3** — `en/coaching.ts` and `types.ts`. Epic 3 adds
  `checkRevealed` beside `checkSolved` and removes `solved.givenUp` /
  `SolvedSnippets.givenUp`; this track edits `opening`/`ladder[0]` in
  `coaching.ts` and `IntroSnippets`/`PuzzleSnippets` in `types.ts`. Different
  lines, either order, the second to land rebases.

### Track C — The mode switch says what it offers

- **Goal** — `ModeToggle` passes a description that follows the state; its text
  still names no mode.
- **Owns** — `src/features/daily-groove/components/puzzle/ModeToggle.tsx`,
  `src/features/daily-groove/components/puzzle/ModeToggle.test.tsx`
- **Role** — `implementer`
- **Depends on** — Track A (the prop), Track B (`puzzle.simpleModeOn/Off`)
- **Parallel with** — Tracks D, E
- **Done when** — `ModeToggle.test.tsx` green; `GroovePuzzle.*.test.tsx` still
  green (they find the switch by `{ name: puzzle.simpleMode }`, which the
  `aria-labelledby` contract keeps exact).

### Track D — Two lines change rooms: the two-ways line in, the credit out

- **Goal** — the how-to-play box has the two-ways paragraph and no link; the
  groove card has the credit at its foot.
- **Owns** — `src/features/daily-groove/components/intro/HowToPlay.tsx`,
  `src/features/daily-groove/components/intro/HowToPlay.test.tsx`,
  `src/features/daily-groove/components/puzzle/GrooveCard.tsx`,
  `src/features/daily-groove/components/puzzle/GrooveCard.test.tsx`
- **Role** — `implementer`
- **Depends on** — Track B (`intro.twoWays`, `puzzle.drumCredit`)
- **Parallel with** — Tracks C, E
- **Done when** — both component test files green, `GroovePuzzle.intro.test.tsx`
  and `GroovePuzzle.copy.test.tsx` still green.

### Track E — The caption leaves the groove box

- **Goal** — nothing renders under `PlayControl`; the sentence is read in the
  hint box; the page tests say so through the harness.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.sounding.test.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.page.test.tsx`,
  `src/features/daily-groove/testing/puzzleHarness.tsx`
- **Role** — `implementer`
- **Depends on** — Track B (`coaching.ladder[0].soundsOff` for the hint-box
  assertions)
- **Parallel with** — Tracks C, D
- **Done when** — the five `GroovePuzzle.*.test.tsx` files and `structure.test.ts`
  are green; `grep -rn "CAPTION" src` finds nothing.
- **Shared with Epic 1** — `components/GroovePuzzle.tsx`, if Epic 1 rewires
  `useSimpleMode` or adds a loading gate there. E1 deletes five contiguous
  lines around `PlayControl` (lines 264–273 today) and touches nothing else in
  the file; Epic 1's edits are in the hook wiring at the top of
  `GroovePuzzleView`. Either order, the second to land rebases.

## Execution waves

- **Wave 1 (parallel):** Track A (Switch), Track B steps B1–B4 (additive
  snippets + rung one)
- **Wave 2 (parallel):** Track C, Track D, Track E — each needs a Wave 1 key or
  prop; none needs another Wave 2 track
- **Wave 3:** Track B step B5 — remove `captionSoundsOn`, `captionSoundsOff`,
  `intro.drumCredit` once E and D have removed their readers
- **Wave 4:** Integration — full suite, lint, typecheck, build, demo path

Why the three-wave shape rather than two: the retired keys are read by
`GroovePuzzle.tsx`, `puzzleHarness.tsx` and `HowToPlay.tsx`, which belong to E
and D. Deleting the keys in Wave 1 would leave the tree red until Wave 2 lands;
letting D or E delete them would put `puzzle.ts`, `intro.ts` and `types.ts` in
two tracks. So B keeps its files and comes back for one step.

## Implementation

### Track A — The Switch learns a description

#### Step A1 — A described switch is named by its label alone

Covers: R1, AC1

- **Test first** — `src/components/controls/Switch.test.tsx`, new
  `describe('with a description')`:
  ```ts
  const DESCRIPTION = 'Email and push'
  it('is found by its label and described by the description (F22 E2 R1, AC1)', () => {
    render(<Switch label={LABEL} description={DESCRIPTION} checked={false} onChange={vi.fn()} />)
    const control = screen.getByRole('switch', { name: LABEL })       // exact string, not a regex
    expect(control).toHaveAccessibleDescription(DESCRIPTION)
    expect(screen.getByText(DESCRIPTION)).toBeInTheDocument()
    expect(control.textContent).not.toBe(LABEL)
  })
  ```
  Run it: fails at `screen.getByText(DESCRIPTION)` with
  `TestingLibraryElementError: Unable to find an element with the text: Email and push`
  (the unknown prop is dropped; `tsc` also reports
  `Property 'description' does not exist on type 'SwitchProps'`).
- **Test first, second half (already green, guards the refactor)** — keep the
  existing `'announces the label alone, so the state is never read twice'` and
  add to it: `expect(control).not.toHaveAccessibleDescription()` and
  `expect(control).not.toHaveAttribute('aria-describedby')`. Rename it
  `'announces the label alone when it has no description (F22 E2 R1, AC1)'`.
- **Implement** — `src/components/controls/Switch.tsx`: add
  `description?: string` to `SwitchProps`; `const labelId = useId()` and
  `const descriptionId = useId()` (import `useId` from `react`); on the
  `<button>` add `aria-labelledby={labelId}` and
  `aria-describedby={description === undefined ? undefined : descriptionId}`;
  replace the label span with
  ```tsx
  <span className="flex min-w-0 flex-col gap-0.5">
    <span id={labelId} className="text-[14px] leading-[1.4] text-text-muted">{label}</span>
    {description !== undefined && (
      <span id={descriptionId} className="text-[12px] leading-[1.4] text-text-faint">{description}</span>
    )}
  </span>
  ```
  The `aria-hidden` track is unchanged.
- **Green when** — both tests pass; all existing `Switch.test.tsx`,
  `ModeToggle.test.tsx`, `TapSoundsToggle.test.tsx` cases pass unchanged (the
  `{ name: /notifications/i }` queries resolve through `aria-labelledby`).
- **Refactor** — none.

#### Step A2 — The description sits beneath the label, smaller and fainter

Covers: R1

- **Test first** — `Switch.test.tsx`, in `describe('with a description')`:
  ```ts
  it('renders the description beneath the label in smaller, fainter type (F22 E2 R1)', () => {
    render(<Switch label={LABEL} description={DESCRIPTION} checked={false} onChange={vi.fn()} />)
    const label = screen.getByText(LABEL)
    const description = screen.getByText(DESCRIPTION)
    expect(description.parentElement).toBe(label.parentElement)
    expect(label.parentElement?.className).toMatch(/flex-col/)
    expect(label.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(description.className).toMatch(/text-text-faint/)
    expect(description.className).toMatch(/text-\[12px\]/)
    expect(label.className).toMatch(/text-\[14px\]/)
  })
  it('keeps the description inside the press target (F22 E2 R1)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Switch label={LABEL} description={DESCRIPTION} checked={false} onChange={onChange} />)
    await user.click(screen.getByText(DESCRIPTION))
    expect(onChange).toHaveBeenCalledWith(true)
  })
  ```
  Run before A1's implementation: fails with `Unable to find an element with the
  text: Email and push`. After A1 it is green — write it in the same sitting as
  A1 so the red is observed once; the step exists so the layout contract is
  pinned separately from the ARIA one.
- **Implement** — covered by A1's markup.
- **Green when** — passes; `src/components/structure.test.ts` `'holds no snippet
  import'` still passes (the description is a prop).
- **Refactor** — none.

### Track B — The words

#### Step B1 — The intro gains the two-ways line

Covers: R4, R9, AC4, AC8

- **Test first** — `src/lib/snippets/snippets.test.ts`, new
  `describe('feature-22 wording')`:
  ```ts
  it('names both ways to play and points at the switch by its name (F22 E2 R4)', () => {
    expect(snippets.intro.twoWays).toBe(
      'Two ways to play: Simple mode is six roots, Major or Minor. The switch on the card opens up the full set.',
    )
    expect(snippets.intro.twoWays).toContain(snippets.puzzle.simpleMode)
    expect(snippets.intro.steps).toHaveLength(4)
  })
  ```
  Run it: fails with `expected undefined to be 'Two ways to play: …'`.
- **Implement** — `src/lib/snippets/types.ts`: add `twoWays: string` to
  `IntroSnippets` (keep `drumCredit` for now). `src/lib/snippets/en/intro.ts`:
  add `twoWays: 'Two ways to play: Simple mode is six roots, Major or Minor. The switch on the card opens up the full set.'`.
- **Green when** — passes; `steps` is still the 4-tuple.
- **Refactor** — none.

#### Step B2 — The switch descriptions and the credit's new home

Covers: R2, R8, R9, AC2, AC8

- **Test first** — `snippets.test.ts`, same describe:
  ```ts
  it('describes each side of the switch by what the row shows (F22 E2 R2)', () => {
    expect(snippets.puzzle.simpleModeOn).toBe('Six roots, Major or Minor')
    expect(snippets.puzzle.simpleModeOff).toBe('Twelve roots, four modes')
    expect(snippets.puzzle.simpleMode).toBe('Simple mode')
  })
  it('holds the drum credit under puzzle (F22 E2 R8)', () => {
    expect(snippets.puzzle.drumCredit).toBe('Drum samples provided by DrumGizmo.org')
  })
  ```
  Run it: fails with `expected undefined to be 'Six roots, Major or Minor'`.
- **Implement** — `types.ts`: add `simpleModeOn: string`, `simpleModeOff: string`,
  `drumCredit: string` to `PuzzleSnippets`. `en/puzzle.ts`: add the three keys
  with the strings above.
- **Green when** — passes.
- **Refactor** — none.

#### Step B3 — Rung one is the listening advice, with a sounds-off variant

Covers: R6, R7, R9, AC6, AC8

- **Test first** — `snippets.test.ts`, same describe:
  ```ts
  it('opens the ladder on the listening line, on and off (F22 E2 R6, R7)', () => {
    const [first] = snippets.coaching.ladder
    expect(first.message).toBe(
      'Loop it a few times. Find the note that feels like home — Play along with your instrument, or tap a root or a mode to hear it.',
    )
    expect(first.soundsOff).toBe(
      'Loop it a few times. Find the note that feels like home — Play along with your instrument.',
    )
    expect(snippets.coaching.opening).toBe(first.message)
    expect(first.message.replace(', or tap a root or a mode to hear it', '')).toBe(first.soundsOff)
  })
  ```
  Run it: fails with `expected 'Loop it a few times. Sing the note that feels like rest — …' to be 'Loop it a few times. Find the note …'`.
- **Implement** — `src/lib/snippets/en/coaching.ts`: set
  `const opening = 'Loop it a few times. Find the note that feels like home — Play along with your instrument, or tap a root or a mode to hear it.'`,
  add `const openingSoundsOff = 'Loop it a few times. Find the note that feels like home — Play along with your instrument.'`,
  and make `ladder[0]` `{ message: opening, soundsOff: openingSoundsOff }`.
  Rungs two to four, `colour`, `tonic`, `simpleColour` untouched.
- **Green when** — passes, and these existing guards stay green (read them,
  don't skip them): `lib/presentation/moves.test.ts` `'gives every tap-naming
  move a sounds-off wording'` (rung one now names a tap, so it must carry
  `soundsOff`, which it does), `'names no mode and no family'` (neither
  "Major" nor "Minor" appears in rung one), `'gives every rung its own trimmed,
  non-empty sentence'`; `lib/presentation/coaching.test.ts` (its
  `SOUNDS_OFF_RUNG` becomes 0 and every case still holds);
  `components/GroovePuzzle.guessing.test.tsx` (`soundsOffRung` becomes 0;
  `'rewords the move when the tap sounds go off'` now runs with zero misses).
- **Refactor** — none.

#### Step B4 — The selector serves rung one's sounds-off wording before the first Check

Covers: R6, AC6

- **Test first** — `src/features/daily-groove/lib/presentation/coaching.test.ts`,
  in `describe('selectCoaching')`:
  ```ts
  it('drops the tap clause from the opening move when the row is silent (F22 E2 R6, AC6)', () => {
    const on = selectCoaching({ attempts: [], tapSounds: true, simple: false }).message
    const off = selectCoaching({ attempts: [], tapSounds: false, simple: false }).message
    expect(on).toBe(LADDER[0].message)
    expect(off).toBe(LADDER[0].soundsOff)
    expect(off).not.toBe(on)
    expect(selectCoaching({ attempts: [], tapSounds: false, simple: true }).message).toBe(LADDER[0].soundsOff)
    expect(selectCoaching({ attempts: [NEITHER], tapSounds: true, simple: false }).message).toBe(LADDER[1].message)
  })
  ```
  Run it before B3: fails at `expect(off).toBe(LADDER[0].soundsOff)` with
  `expected 'Loop it a few times. Sing …' to be undefined`. (Write it alongside
  B3's test and run both before implementing B3.) No sentence is written out —
  the file is under the copied-sentence lint block.
- **Implement** — nothing in `lib/presentation/`; B3's data makes it green.
- **Green when** — passes; `npm run lint` clean (no whitespace-bearing literal
  passed to a matcher in this file).
- **Refactor** — none.

#### Step B5 — The retired keys go (Wave 3)

Covers: R5, R8, R9, AC8

- **Test first** — `snippets.test.ts`, same describe:
  ```ts
  it('carries no caption and files the credit under puzzle only (F22 E2 R5, R8, R9)', () => {
    expect(snippets.puzzle).not.toHaveProperty('captionSoundsOn')
    expect(snippets.puzzle).not.toHaveProperty('captionSoundsOff')
    expect(snippets.intro).not.toHaveProperty('drumCredit')
  })
  ```
  Run it: fails with `expected { … } to not have property "captionSoundsOn"`.
- **Implement** — `types.ts`: remove `captionSoundsOn`, `captionSoundsOff` from
  `PuzzleSnippets` and `drumCredit` from `IntroSnippets`. `en/puzzle.ts` and
  `en/intro.ts`: remove the three entries. Preconditions: Track E has removed
  the caption from `GroovePuzzle.tsx` and `CAPTION*` from the harness; Track D
  has removed the credit from `HowToPlay.tsx` — otherwise `satisfies` fails
  typecheck and the two components render `undefined`.
- **Green when** — passes; `npx tsc --noEmit` clean;
  `grep -rn "captionSounds\|intro.drumCredit" src` is empty.
- **Refactor** — none.

### Track C — The mode switch says what it offers

#### Step C1 — The description follows the state

Covers: R2, AC2

- **Test first** — `src/features/daily-groove/components/puzzle/ModeToggle.test.tsx`:
  ```ts
  it('says what six roots and two names means while it is on (F22 E2 R2, AC2)', () => {
    render(<ModeToggle simple onChange={vi.fn()} />)
    const toggle = screen.getByRole('switch', { name: puzzle.simpleMode })
    expect(toggle).toHaveAccessibleDescription(puzzle.simpleModeOn)
    expect(screen.getByText(puzzle.simpleModeOn)).toBeVisible()
    expect(screen.queryByText(puzzle.simpleModeOff)).toBeNull()
  })
  it('says what the full set is while it is off (F22 E2 R2, AC2)', () => {
    render(<ModeToggle simple={false} onChange={vi.fn()} />)
    const toggle = screen.getByRole('switch', { name: puzzle.simpleMode })
    expect(toggle).toHaveAccessibleDescription(puzzle.simpleModeOff)
    expect(screen.getByText(puzzle.simpleModeOff)).toBeVisible()
    expect(screen.queryByText(puzzle.simpleModeOn)).toBeNull()
  })
  it('keeps the description when the day is over (F22 E2 R2)', () => {
    render(<ModeToggle simple onChange={vi.fn()} disabled />)
    expect(screen.getByRole('switch')).toHaveAccessibleDescription(puzzle.simpleModeOn)
  })
  ```
  Run it: fails with `Unable to find an element with the text: Six roots, Major or Minor`
  (`toHaveAccessibleDescription` fails first with `expected element to have
  accessible description "Six roots, Major or Minor", received ""`).
- **Implement** — `ModeToggle.tsx`: pass
  `description={simple ? puzzle.simpleModeOn : puzzle.simpleModeOff}` to
  `Switch`. Nothing else changes.
- **Green when** — passes; the existing
  `'still reads as a switch that is on when it has settled'` still passes
  (`toHaveTextContent(puzzle.simpleMode)` is a contains-check).
- **Refactor** — none.

#### Step C2 — Neither reading of the mode row leaks into the switch

Covers: R3, AC3

- **Test first** — `ModeToggle.test.tsx`: replace the existing
  `'names no mode, so neither reading of the row leaks into it (R4)'` with an
  `it.each([true, false])` that checks both states against every rendered
  mode name, not just the seven church modes:
  ```ts
  import { DISPLAY_NAMES } from '@/lib/theory/names'
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  it.each([true, false])('names no mode in either state, simple=%s (R4, F22 E2 R3, AC3)', (simple) => {
    const { container } = render(<ModeToggle simple={simple} onChange={vi.fn()} />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian/i)
    for (const name of Object.values(DISPLAY_NAMES)) {
      expect(text, `names ${name}`).not.toMatch(new RegExp(`\\b${escape(name)}\\b`, 'i'))
    }
  })
  ```
  Run it: green before and after C1 — this is the guard R3 says must hold; it
  is rewritten here so it reads the description too (after C1 the toggle's text
  is no longer the label alone, so the old single-state test would have been
  the wrong shape). Say so in the commit; do not pretend a red.
- **Implement** — nothing.
- **Green when** — passes in both states.
- **Refactor** — none.

### Track D — Two lines change rooms

#### Step D1 — The how-to-play box names both ways in one paragraph

Covers: R4, R9, AC4

- **Test first** — `src/features/daily-groove/components/intro/HowToPlay.test.tsx`
  (add `puzzle` to the `@/lib/snippets` import):
  ```ts
  it('names both ways to play in one line under the four steps (F22 E2 R4, AC4)', () => {
    render(<HowToPlay onClose={vi.fn()} />)
    const line = screen.getByText(intro.twoWays)
    expect(line).toBeVisible()
    expect(line).toHaveTextContent(puzzle.simpleMode)
    expect(line.closest('ol')).toBeNull()
    expect(line.tagName).toBe('P')
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    const list = screen.getAllByRole('listitem').at(-1) as HTMLElement
    expect(list.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  ```
  Run it: fails with `Unable to find an element with the text: Two ways to play: …`.
- **Implement** — `HowToPlay.tsx`: after the `</ol>`, render
  `<Text tone="muted">{intro.twoWays}</Text>`. `Text` is already imported.
- **Green when** — passes; `'shows the four items in order with the stated
  words'` and `'holds no state of its own'` still pass (four list items).
- **Refactor** — none.

#### Step D2 — The credit block moves into the groove card

Covers: R8, R9, AC7

- **Test first** — `src/features/daily-groove/components/puzzle/GrooveCard.test.tsx`:
  move the whole `describe('the drum samples credit', …)` from
  `HowToPlay.test.tsx` into the `describe('GrooveCard')` block, with these
  substitutions and nothing else rewritten:
  - `render(<HowToPlay onClose={vi.fn()} />)` → `render(<GrooveCard groove={GROOVE} meta={metaFor(GROOVE)} />)`
  - `const SOURCE = intro.drumCredit` → `const SOURCE = puzzle.drumCredit`
  - `'is not a fifth step'` → `'sits after the card's children, not among them'`:
    ```ts
    render(<GrooveCard groove={GROOVE} meta={metaFor(GROOVE)}><button type="button">play</button></GrooveCard>)
    const play = screen.getByRole('button', { name: 'play' })
    const link = screen.getByRole('link', { name: SOURCE })
    expect(play.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(link.closest('p')?.parentElement).toBe(screen.getByRole('heading', { level: 2 }).parentElement)
    expect(link.closest('p')?.nextElementSibling).toBeNull()
    ```
  - `'stays the quietest thing in the box'` → `'stays the quietest thing in the card'`, assertions unchanged
    (`text-text-faint`, `text-[13px]`).
  The four kept cases (`names the credit…`, `names the licence…`, `leaves the
  site safely…`, quietest) keep their names and assertions.
  Run it: fails with `Unable to find an accessible element with the role "link" and name "Drum samples provided by DrumGizmo.org"`.
- **Implement** — `GrooveCard.tsx`: add `import { puzzle } from '@/lib/snippets'`;
  move `DRUM_CREDIT_URL`, `DRUM_CREDIT_LICENCE`, `DRUM_CREDIT_LICENCE_URL` and
  `CREDIT_LINK` verbatim from `HowToPlay.tsx`; render the block from the
  Contracts section as the last child of the `Stack`, after `{children}`.
- **Green when** — passes; the existing GrooveCard guards still pass:
  `'branches on nothing about which page renders it'` (the source still has no
  `dateLine|metaLine|shared|PuzzleMode`), `'renders no meta line beneath the
  name'` (`/No\.|bars|loops/` does not match the credit — the regex is
  case-sensitive and "DrumGizmo.org" has no "No."), `'says nothing about the
  answer'`.
- **Refactor** — none.

#### Step D3 — The credit leaves the how-to-play box

Covers: R8, AC7

- **Test first** — `HowToPlay.test.tsx`:
  ```ts
  it('carries no link — the credit lives on the groove card now (F22 E2 R8, AC7)', () => {
    render(<HowToPlay onClose={vi.fn()} />)
    expect(screen.queryAllByRole('link')).toEqual([])
    expect(screen.queryByText(/DrumGizmo|CC BY/)).toBeNull()
  })
  ```
  Run it: fails with `expected [ <a …>, <a …> ] to deeply equal []`.
- **Implement** — `HowToPlay.tsx`: delete the `<Text tone="faint" size="sm">…</Text>`
  credit block and the four constants (`DRUM_CREDIT_URL`, `DRUM_CREDIT_LICENCE`,
  `DRUM_CREDIT_LICENCE_URL`, `CREDIT_LINK`). Remove the old
  `describe('the drum samples credit')` from `HowToPlay.test.tsx` (it moved in
  D2).
- **Green when** — passes; `HowToPlay.test.tsx` has no reference to
  `drumCredit`.
- **Refactor** — none.

#### Step D4 — Through the composed page, the credit sits at the foot of the groove card

Covers: R8, AC7

- **Test first** — `GrooveCard.test.tsx`, in the existing
  `describe('through the composed page')`:
  ```ts
  it('puts the two credit links inside the groove card, after the play control (F22 E2 R8, AC7)', async () => {
    await renderFeature()
    const groove = selectGrooveForDate(new Date(), GROOVES)
    const card = screen.getByRole('heading', { name: groove.name }).parentElement as HTMLElement
    const links = within(card).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'https://drumgizmo.org',
      'https://creativecommons.org/licenses/by/4.0/',
    ])
    const play = within(card).getByRole('button', { name: puzzle.playName.play })
    for (const link of links) {
      expect(play.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    }
    expect(screen.getAllByRole('link', { name: puzzle.drumCredit })).toHaveLength(1)
  })
  ```
  (add `within` to the `@testing-library/react` import.) Run it before D2:
  fails with `Unable to find role="link"` inside the card. After D2 and before
  D3 the last line fails with `expected 2 to be 1` — the credit exists twice —
  which is the reason D3 exists.
- **Implement** — nothing beyond D2 and D3.
- **Green when** — passes with one credit on the page, inside the card.
- **Refactor** — none.

### Track E — The caption leaves the groove box

#### Step E1 — Nothing renders under the play control

Covers: R5, AC5

- **Test first** — `GroovePuzzle.sounding.test.tsx`: replace
  `'stacks the caption below the control rather than beside it (E2 R4, AC3)'`
  (line 221 today) with:
  ```ts
  const grooveBox = () =>
    screen.getByRole('heading', { level: 2, name: GROOVE.name }).parentElement as HTMLElement

  it('leaves nothing under the play control — the advice reads in the hint box (F22 E2 R5, AC5)', async () => {
    await renderPuzzle()
    const play = screen.getByRole('button', { name: puzzle.playName.play })
    expect(play).toHaveClass('w-full')
    expect(play.nextElementSibling).toBeNull()
    expect(within(grooveBox()).queryByText(/feels like home/i)).toBeNull()
    expect(within(grooveBox()).queryByText(/play along/i)).toBeNull()
    expect(move()).toBe(coaching.ladder[0].message)
  })
  ```
  Add `coaching` to the `@/lib/snippets` import. Run it: fails at
  `expect(play.nextElementSibling).toBeNull()` with `expected <p …> to be null`.
- **Implement** — `GroovePuzzle.tsx`: replace the
  `<Stack gap="sm">…<PlayControl …/><Text tone="muted" size="sm">{tapSounds ? … }</Text></Stack>`
  block (lines 264–273 today) with the bare `<PlayControl …/>` element. `Text`
  stays imported (loading line, audio alert); `Stack` stays imported.
- **Green when** — passes. `puzzleHarness.tsx` still exports `CAPTION*`
  reading the not-yet-removed keys, so nothing else breaks yet.
- **Refactor** — none.

#### Step E2 — The caption assertions become hint-box assertions and the harness forgets the caption

Covers: R5, R6, AC5, AC6

- **Test first** — three files, all edits to existing tests, each keeping its
  subject:
  - `GroovePuzzle.sounding.test.tsx`
    - `'offers both rows in one sentence, and names no mode (H5, R25)'` (line
      1022): `const text = move() as string` instead of
      `screen.getByText(CAPTION).textContent`; assertions unchanged.
    - delete `'reads the new caption under the play control (E2 R1a, R5, AC6)'`
      (1155) and `'keeps the caption below the control at full width (E2 R1a,
      AC6a)'` (1165): their subject was the caption's placement under the
      control, which E1 now asserts as absence; the "which sentence" half is
      pinned by B3 and the guessing test `'opens clean with the opening
      guidance'`.
    - `'swaps the caption for the task sentence without the tap clause (F17 E2
      R10, R12, AC11, AC12)'` (1304) → rename `'rewords the opening move
      without the tap clause when the sounds go off (F17 E2 R10, R12; F22 E2
      R6, AC6)'`:
      ```ts
      const [first] = coaching.ladder
      expect(move()).toBe(first.message)
      await turnSoundsOff(user)
      expect(move()).toBe(first.soundsOff)
      expect(hintRegion()).toContainElement(coachingLine() as HTMLElement)
      expect(first.message.replace(', or tap a root or a mode to hear it', '')).toBe(first.soundsOff)
      expect(first.soundsOff).not.toMatch(/switch/i)
      expect(first.soundsOff).not.toMatch(/tap/i)
      expect(first.soundsOff).toMatch(/feels like home/i)
      expect(first.soundsOff).not.toContain('\n')
      await user.click(soundSwitch())
      expect(move()).toBe(first.message)
      ```
      (the `control.nextElementSibling` / `text-text-muted` / `text-[13px]`
      lines go — they described the caption's box.)
    - lines 1371 and 1429: `expect(screen.getByText(CAPTION_SOUNDS_OFF))…` →
      `expect(move()).toBe(coaching.ladder[0].soundsOff)`.
    - drop `CAPTION`, `CAPTION_SOUNDS_OFF` from the harness import; add
      `hintRegion`, `coachingLine` if not present (`move` already is).
  - `GroovePuzzle.page.test.tsx` `'has the same puzzle region and the same
    controls in both modes (R4, AC3)'` (line 913): `caption: screen.getByText(CAPTION).textContent`
    → `coaching: coachingLine()?.textContent ?? null` (the shape at 944 already
    reads it that way); drop `CAPTION` from the import.
  - `testing/puzzleHarness.tsx`: delete the `CAPTION` and `CAPTION_SOUNDS_OFF`
    exports (lines 186–188).
  Run the two files before E1: the rewritten 1304 case fails at
  `expect(move()).toBe(first.soundsOff)` with
  `expected 'Loop it a few times. …hear it.' to be undefined` if B3 has not
  landed, and green if it has — so this step's red is E1's, and E2 is the
  relocation that lets B5 delete the keys. Run after E1 and B3: green.
- **Implement** — nothing beyond the test and harness edits.
- **Green when** — `grep -rn "CAPTION" src` is empty; sounding, page, guessing,
  copy, intro, header tests green.
- **Refactor** — none.

#### Step E3 — The opening move is the listening advice, with sounds on and off, through the page

Covers: R6, AC6

- **Test first** — already exists and stays as-is:
  `GroovePuzzle.guessing.test.tsx` `'shows the opening move before anything is
  pressed'` (`move() === LADDER[0].message`), `'rewords the move when the tap
  sounds go off'` (`soundsOffRung` now 0) and `'answers the first miss with a
  verdict and a different move'` (rung two unchanged). Nothing to write; run
  them after B3 and confirm green. Rung two's wording is untouched by B3, so
  AC6's "given one miss, then rung two is unchanged" holds by the diff.
- **Implement** — nothing.
- **Green when** — the guessing file is green with B3 landed.
- **Refactor** — none.

## Integration and verification

Wave 4, after B5.

- **Order inside `/implement-feature`** — A ∥ B(1–4) → C ∥ D ∥ E → B5 → this.
  Shared files with the parallel epics: `components/GroovePuzzle.tsx` (Epic 1's
  hook wiring vs E1's five-line deletion around `PlayControl`),
  `src/lib/snippets/en/coaching.ts` and `snippets/types.ts` (Epic 3's
  `checkRevealed` / `givenUp` removal vs B3's `opening`/`ladder[0]` and B1, B2,
  B5's `IntroSnippets`/`PuzzleSnippets`). The edits sit on different lines; the
  lead sequences the units that own those files so one lands and the next
  rebases, rather than letting two units hold the same file at once.
- **Checks** — `npm test` (all four tiers this touches: `Switch.test.tsx`,
  `snippets.test.ts`, the slice's `lib/presentation/*.test.ts`, the region and
  `GroovePuzzle.*.test.tsx` files, the three structural guards), `npm run lint`
  (the copied-sentence block over `lib/presentation/*.test.ts` — B4 writes no
  sentence; the eight zones — the design system still imports no snippet),
  `npx tsc --noEmit` (the `satisfies` clauses after B5), `npm run build`.
- **Guards read, not run, and why they stay green** —
  `GroovePuzzle.copy.test.tsx`: none of the new strings matches
  `/attempts?\b/i`, `/\bpar\b/i` or the count patterns; its `readablePage()`
  reads `aria-description`, not `aria-describedby`, so the description is seen
  once, as visible text. `src/features/daily-groove/structure.test.ts`:
  `GroovePuzzle.tsx` imports no deeper into `lib/presentation/`;
  `ModeToggle.test.tsx`'s new `@/lib/theory/names` import is shell → theory,
  which is drawn. `src/components/structure.test.ts`: `Switch.tsx` imports
  `react` only.
- **Demo path** — empty `localStorage`, open `/`. The how-to-play box shows
  four numbered steps, then the paragraph *"Two ways to play: Simple mode is six
  roots, Major or Minor. The switch on the card opens up the full set."*, and no
  link. The groove card shows the transport, the play button with nothing under
  it, and at its foot, faint and small, *Drum samples provided by DrumGizmo.org
  · CC BY 4.0* — both links open new tabs. The guess card's switch reads
  **Simple mode** with *Six roots, Major or Minor* beneath when on; flip it and
  the line reads *Twelve roots, four modes*; a screen reader announces "Simple
  mode, switch, on/off" and then the description. The hint box reads *Loop it a
  few times. Find the note that feels like home — Play along with your
  instrument, or tap a root or a mode to hear it.*; switch tap sounds off and it
  ends at *instrument.*; one wrong Check and the hint moves to rung two,
  unchanged from today. Open `/groove/<uuid>`: same card, same switch text,
  same credit.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A2 |
| R2 | B2, C1 |
| R3 | C2 |
| R4 | B1, D1 |
| R5 | E1, E2, B5 |
| R6 | B3, B4, E2, E3 |
| R7 | B3 |
| R8 | B2, D2, D3, D4, B5 |
| R9 | B1, B2, B3, B5 (strings and types), A1 (design system takes a prop), D2 (credit reads `puzzle.drumCredit`) |
| AC1 | A1 |
| AC2 | C1 |
| AC3 | C2 |
| AC4 | D1 |
| AC5 | E1, E2 |
| AC6 | B3, B4, E2, E3 |
| AC7 | D2, D3, D4 |
| AC8 | B1–B5 (`snippets.test.ts`), Integration (`structure.test.ts` in the slice and in `src/components/`; `src/app/language.test.ts` is the stored-language guard and is untouched by this epic — it stays green with no change) |

## Assumptions

- **How the Switch exposes the description**: both spans live inside the
  `<button>`; `aria-labelledby` points at the label span so the name excludes
  the description; `aria-describedby` points at the description span. Chosen
  over a sibling element outside the button so the description stays part of
  the press target and the component's root stays the one `<button>`. Cheap to
  reverse: one component, one test file.
- Description type is `text-[12px] leading-[1.4] text-text-faint` — one step
  below the label's 14px muted, matching the PRD's "smaller, fainter".
- `aria-labelledby` is set always, not only when a description is present, so
  the name is computed one way.
- Snippet key names: `puzzle.simpleModeOn`, `puzzle.simpleModeOff`,
  `puzzle.drumCredit`, `intro.twoWays`; rung one's variant is
  `ladder[0].soundsOff`, the shape every other tap-naming rung already uses.
- The two-ways line is `Text tone="muted"` at the default size, after the list,
  same text in both modes (PRD assumption: static).
- The `Stack gap="sm"` in `GroovePuzzle.tsx` existed only to pair the caption
  with the play control and goes with it; `PlayControl` becomes a direct child
  of the card's `Stack gap="lg"`.
- The settled sentences are asserted verbatim only in
  `src/lib/snippets/snippets.test.ts`, the file the copied-sentence rule names
  as the one place a sentence must be written out; every other test compares
  against the imported snippet.
- The roadmap places the caption assertions in `GroovePuzzle.copy.test.tsx`;
  on the tree they are in `GroovePuzzle.sounding.test.tsx` (six sites),
  `GroovePuzzle.page.test.tsx` (one) and `testing/puzzleHarness.tsx` (two
  exports). The spec follows the tree; the copy test needs no edit.
- Side effect of B3 worth knowing: `soundsOffRung` in
  `GroovePuzzle.guessing.test.tsx` and `SOUNDS_OFF_RUNG` in
  `lib/presentation/coaching.test.ts` are computed by `findIndex` and move from
  rung 3 to rung 0. Both files stay green; rung 3's sounds-off wording is still
  covered at module level by `coaching.test.ts`'s `forEach` over the ladder,
  and by `moves.test.ts`. No test is edited for this.
- The `Footer` candidate row in `specs/features.md` is left for the user, as the
  PRD says.
- `GroovePuzzle.tsx` line numbers above are as of 2026-09-03 (before Epic 1);
  the implementer locates the block by the `PlayControl` element, not the line.

## Decision log

### Cycle 1 — 2026-09-03

No question was put to the user. The one decision with any reach — how `Switch`
exposes its description — is one component and one test file to reverse, so it
is recorded under Assumptions rather than asked. Every wording is settled in the
PRD and copied into Contracts verbatim.
