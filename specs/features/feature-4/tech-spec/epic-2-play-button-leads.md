# Tech spec — Epic 2: The play button leads

PRD: [../prd/epic-2-play-button-leads.md](../prd/epic-2-play-button-leads.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three separable pieces. The design system gains a size variant on the play
control so it can render at the solve button's geometry. The audio layer trades
pause-and-resume for stop-and-restart, so the word on the button matches what
pressing it does. The puzzle then restacks its control region and calls the new
transport method.

The first two own different files and never reference each other, so they run in
parallel behind frozen contracts; the puzzle wiring meets them afterwards. The
transport change is the risky half — it edits the one module the whole feature's
audio goes through, and Epic 5 builds directly on it — so its contract is
settled here rather than discovered during wiring.

## Architecture

`PlayControl` becomes a two-size control that picks its host primitive by size:
`Button` for `'lg'`, `IconButton` for `'sm'`. Each primitive keeps the shape it
already means — `IconButton` stays "circular icon control" rather than becoming
a shape-agnostic base — and the full-width variant inherits the solve button's
geometry structurally rather than by copied class strings.

That has one forced consequence. `Button`'s accessible name is its children, and
this control's visible text ("▶ Play the groove") differs by design from its
accessible name ("Play the loop"). `Button` therefore gains an optional `label`
prop that sets `aria-label` when present, leaving its name as its children
otherwise. Without it, AC3a and AC4 cannot both hold.

`PlayControl`'s `isPlaying` prop already drives the glyph; it now drives the
text as well, and the accessible name states the action rather than the state in
both sizes.

`createAudioPlayer` loses its pause semantics. The element's `loop` property is
untouched — a groove left running still repeats — but a press while sounding
halts playback *and* resets `currentTime` to zero, so `getPosition()` returns 0
and the progress track returns to the start with no extra wiring. That is what
makes AC5a fall out of the audio change rather than needing its own code in the
component.

`GroovePuzzle`'s `createTransport` shim forwards the new method. Its lazy
player construction, its listener set and its `useSyncExternalStore` seam are
unchanged.

## Contracts

Frozen. Track C builds against these while A and B implement behind them, and
Epic 5 inherits both.

```ts
// src/components/Button.tsx — additive, backward compatible
type ButtonProps = {
  children: ReactNode
  onPress: () => void
  disabled: boolean
  tone: ButtonTone
  /** Sets aria-label. Without it the accessible name stays the children. */
  label?: string
}
```

```ts
// src/components/PlayControl.tsx
export type PlayControlSize = 'sm' | 'lg'

type PlayControlProps = {
  isPlaying: boolean
  onToggle: () => void
  /** 'sm' is the circular control; 'lg' is the full-width one. Defaults to 'sm'. */
  size?: PlayControlSize
}
```

```ts
// src/features/daily-groove/lib/audio.ts
export type AudioPlayer = {
  play(): Promise<void>
  /** Halts playback and returns the loop to its start. Replaces `pause`. */
  stop(): void
  getPosition(): number
  isPlaying(): boolean
  subscribe(fn: () => void): () => void
  dispose(): void
}
```

Rendered text, exactly — asserted by AC3a, so a contract rather than copy:

- not sounding → `▶ Play the groove`, accessible name `Play the loop`
- sounding → `■ Stop`, accessible name `Stop the loop`

`size="sm"` renders exactly what `PlayControl` renders today. Epic 5 consumes it
unchanged and will add its own accessible-name override on top.

## Tracks

### Track A — The control's size variant

- **Goal** — `PlayControl` renders full-width with glyph and text, or circular
  as before, chosen by prop.
- **Owns** — `src/components/PlayControl.tsx`, `PlayControl.test.tsx`,
  `src/components/Button.tsx`, `Button.test.tsx`
- **Depends on** — the `PlayControlSize` and `Button` contracts only
- **Parallel with** — Track B
- **Done when** — both variants render and are asserted in
  `src/components`, with no feature imported. `IconButton` is untouched by this
  epic; Epic 5 extends it for the disabled archive control.

### Track B — Stop, not pause

- **Goal** — the transport halts and rewinds instead of holding position.
- **Owns** — `src/features/daily-groove/lib/audio.ts`, `lib/audio.test.ts`
- **Depends on** — the `AudioPlayer` contract only
- **Parallel with** — Track A
- **Done when** — `audio.test.ts` asserts stop-and-restart and is green.

### Track C — The puzzle's control region

- **Goal** — the groove card stacks control over caption and drives the new
  transport.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `GroovePuzzle.test.tsx`
- **Depends on** — Tracks A and B landed
- **Done when** — the puzzle's playback cases assert stop-and-restart.

### Track D — Integration

- **Owns** — `src/app/page.test.tsx`
- **Depends on** — Track C

**`GroovePuzzle.test.tsx` and `src/app/page.test.tsx` are shared with Epics 1
and 4 in this wave.** All three change page-wide assertions. Tracks C and D must
not run concurrently with the equivalent tracks in those epics.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B
- **Wave 2:** Track C
- **Wave 3:** Track D — integration

## Implementation

### Track A — The control's size variant

#### Step A0 — `Button` can carry an accessible name of its own

Covers: R5, AC4

- **Test first** — `src/components/Button.test.tsx`: render
  `<Button label="Play the loop" tone="ready" disabled={false} onPress={noop}>▶ Play the groove</Button>`
  and assert the button's accessible name is `'Play the loop'` while its text
  content is `'▶ Play the groove'`; render without `label` and assert the name
  falls back to the children. Run it: fails — the name is the children in both
  cases, because `Button` renders no `aria-label`.
- **Implement** — `Button.tsx`: add the optional `label` prop and set
  `aria-label={label}` on the `<button>`. Every existing call site omits it and
  is unaffected.
- **Green when** — both assertions pass and the existing `Button` cases stay
  green.
- **Refactor** — none.

#### Step A1 — The control renders full-width with glyph and text

Covers: R1, R4a, AC1, AC3a

- **Test first** — `src/components/PlayControl.test.tsx`: render
  `<PlayControl size="lg" isPlaying={false} onToggle={noop} />` and assert
  `screen.getByRole('button')` has text content `'▶ Play the groove'` and the
  class `w-full`. Run it: fails — the control renders a bare `▶` glyph in a
  fixed 52px circle.
- **Implement** — `PlayControl.tsx`: add the `size` prop. For `'lg'` render
  `<Button tone="ready" disabled={false} onPress={onToggle} label={...}>` with
  the glyph and text as children; for `'sm'` keep rendering `IconButton`
  exactly as today. `Button` already carries
  `w-full rounded-control px-4 py-[15px] text-[15px]`, so the geometry is
  inherited, not restated.
- **Green when** — both assertions pass and the `'sm'` case still renders the
  circle.
- **Refactor** — none. The two branches return different primitives from one
  component, which is the point: callers say what they want, not how it is
  built.

#### Step A2 — The sounding state swaps glyph and text only

Covers: R4b, AC3a, AC3b

- **Test first** — `PlayControl.test.tsx`: render `size="lg"` with
  `isPlaying={true}` and assert the text content is `'■ Stop'`; then render both
  states and assert their buttons carry the same `className` apart from nothing
  — `expect(playing.className).toBe(stopped.className)`. Run it: fails on the
  text assertion.
- **Implement** — `PlayControl.tsx`: drive both glyph and label from
  `isPlaying`, leaving every geometry and tone class outside the conditional.
- **Green when** — both assertions pass.
- **Refactor** — hoist the two label strings to module constants beside the
  glyphs, so the pair that must stay in step lives in one place.

#### Step A3 — The accessible name states the action

Covers: R5, AC4

- **Test first** — `PlayControl.test.tsx`: assert the accessible name is
  `'Play the loop'` when stopped and `'Stop the loop'` when playing, for both
  sizes. Run it: fails on the playing case — the current name is
  `'Pause the loop'`.
- **Implement** — `PlayControl.tsx`: change the playing-state name to
  `'Stop the loop'`, passing it to `Button`'s `label` at `'lg'` and to
  `IconButton`'s `label` at `'sm'`. One derived string feeds both branches, so
  the sizes cannot drift apart.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step A4 — The circular variant is unchanged

Covers: R3, AC2

- **Regression guard, not a red-green step.** It pins the variant Epic 5
  consumes.
- **Test** — `PlayControl.test.tsx`: render with no `size` prop and assert the
  button carries `h-[52px] w-[52px] rounded-full` and renders the glyph alone
  with no text beyond it — i.e. that it still renders through `IconButton`,
  which this epic does not modify.
- **Green when** — it passes at every step of Track A.

### Track B — Stop, not pause

#### Step B1 — Stopping rewinds the loop

Covers: R6, AC5

- **Test first** — `lib/audio.test.ts`: with the existing `Audio` stub, play,
  advance `currentTime` to half the duration, call `stop()`, and assert
  `player.getPosition()` is `0` and `element.currentTime` is `0`. Run it: fails
  with `player.stop is not a function`.
- **Implement** — `lib/audio.ts`: rename `pause()` to `stop()` and add
  `element.currentTime = 0` before `element.pause()`. Update the method's
  doc comment: it halts and rewinds, it does not hold position.
- **Green when** — both assertions pass.
- **Refactor** — update `play()`'s comment, which currently reads "Deliberately
  no `currentTime = 0`: play resumes, it does not restart." The reset now lives
  in `stop()`, so `play()` starting from zero is a consequence rather than an
  exception worth defending.

#### Step B2 — Playing after a stop starts from the beginning

Covers: R6, AC5

- **Test first** — `lib/audio.test.ts`: play, advance to half, `stop()`, `play()`
  again, and assert `element.currentTime` is still `0` at the moment play is
  called. Run it: fails before B1's implement; passes after.
- **Implement** — none beyond B1. This step exists because the resume path is
  what the epic removes, and one assertion on the rewind is not enough to prove
  it.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step B3 — A left-running groove still loops

Covers: R6, AC6

- **Regression guard.** `element.loop` must survive the change.
- **Test** — `lib/audio.test.ts`: construct with `{ loop: true }` and assert
  `element.loop === true` after a play/stop/play cycle.
- **Green when** — it passes.

#### Step B4 — Existing pause assertions are rewritten

Covers: R6

- **Test first** — `lib/audio.test.ts`: the cases asserting that `pause()` holds
  position and `play()` resumes now assert the opposite. Rename them from
  *pauses* / *resumes* to *stops* / *restarts*.
- **Implement** — none.
- **Green when** — the file has no reference to `pause` outside
  `element.pause()`.
- **Refactor** — none.

### Track C — The puzzle's control region

#### Step C1 — The transport stops instead of pausing

Covers: R6

- **Test first** — `GroovePuzzle.test.tsx`: rewrite
  `plays, pauses and resumes on successive presses (D5, R10, AC7)` as
  *plays, stops and restarts on successive presses*: press, advance position,
  press again, and assert the stub's `currentTime` is `0` and `isPlaying` is
  false. Run it: fails — the shim still calls `pause()`.
- **Implement** — `GroovePuzzle.tsx`: in `createTransport`'s `toggle()`, replace
  `current.pause()` with `current.stop()`. Update the comment above it, which
  currently states that pausing holds position for the next play.
- **Green when** — the rewritten case passes.
- **Refactor** — none.

#### Step C2 — The control stacks above its caption

Covers: R4, AC3

- **Test first** — `GroovePuzzle.test.tsx`: assert the caption is not a sibling
  within the control's row — that the play button's `parentElement` does not
  contain the text `Play along`. Run it: fails, they share a `Row`.
- **Implement** — `GroovePuzzle.tsx`: change the `<Row gap="md" align="center">`
  wrapping `PlayControl` and the caption `Text` into
  `<Stack gap="sm">`, and pass `size="lg"` to `PlayControl`.
- **Green when** — the assertion passes and the play control renders full-width.
- **Refactor** — none.

#### Step C3 — The progress track returns to the start on stop

Covers: R6a, AC5a

- **Test first** — `GroovePuzzle.test.tsx`: play, advance the stub's position to
  0.5, assert the progress bar reflects it, press stop, and assert the bar reads
  the start position. Run it: fails before C1, passes after.
- **Implement** — none. The position is read straight off the player through
  `useSyncExternalStore`, so B1's rewind propagates with no component change.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step C4 — The failure alert and retry are untouched

Covers: R7

- **Regression guard.** The two existing cases —
  `shows an error with retry when playback rejects` and
  `clears the error and plays again on retry` — must pass unmodified.
- **Green when** — both pass with no edit.

### Track D — Integration

#### Step D1 — The page test reflects the new control

Covers: R1, R4a

- **Test first** — `src/app/page.test.tsx`: update
  `renders the designed shell with a play control and the guessing card` to
  find the control by its new accessible name and assert its full-width text.
- **Implement** — none.
- **Green when** — `npm test` is green across the suite.

## Integration and verification

- `npm test`, `npm run lint`, `npm run build` all green.
- Demo path, from the PRD: load the page. The play button spans the groove card
  at the same height as the solve button opposite, reading "▶ Play the groove",
  with the caption beneath it. Press it: it reads "■ Stop" and the progress bar
  moves. Press it partway through bar three: playback stops and the bar returns
  to the start. Press again: the groove starts from bar one, not bar three.
  Leave it running past the end of the loop: it repeats.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, D1 |
| R2 | A1 (the `size` prop; enforced by the frozen contract) |
| R3 | A4 |
| R4 | C2 |
| R4a | A1, A2, D1 |
| R4b | A2 |
| R5 | A0, A3 |
| R6 | B1, B2, B4, C1 |
| R6a | C3 |
| R7 | C4 |
| AC1 | A1 |
| AC2 | A4 |
| AC3 | C2 |
| AC3a | A1, A2 |
| AC3b | A2 |
| AC4 | A0, A3 |
| AC5 | B1, B2, C1 |
| AC5a | C3 |
| AC6 | B3 |

## Assumptions

- The full-width variant renders `Button` itself rather than copying its
  classes, so "matches the solve button's geometry" is true by construction and
  cannot drift when `Button` is restyled.
- `Button` gains `label` as an optional prop. This is forced rather than chosen:
  AC3a fixes the visible text and AC4 fixes the accessible name, and they
  differ, so the host element must accept a name override. Every existing
  `Button` call site omits it and is unaffected.
- The glyph is part of the children string rather than a separate `aria-hidden`
  span; with `label` set, `aria-label` replaces the children for assistive
  technology, so the glyph is never announced.
- The glyph stays `▶` / `■`. No icon library is introduced.
- The caption keeps its `Text tone="muted" size="sm"` treatment, now full-width.
- `dispose()` keeps calling `element.pause()` directly; it is releasing the
  element, not performing a user-facing stop.
- Epic 5 adds an accessible-name override to `PlayControl`; this epic does not
  add a prop it has no use for.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only.

### Cycle 1 — 2026-08-30

**Q1. How does `AudioPlayer` express stopping?**
Decision: **A) Replace `pause()` with `stop()`** — the PRDs remove pause from
the product entirely, so keeping the method would leave a path nothing calls and
Epic 5 would have to decide about it again.
Changed: nothing. Contracts and Track B were drafted against this; it is now
settled rather than provisional, and Epic 5 inherits it.

**Q2. What does the full-width `PlayControl` render through?**
Decision: **A) `Button` for `'lg'`, `IconButton` for `'sm'`** — each primitive
keeps the shape it already means, and the full-width variant inherits the solve
button's geometry structurally instead of by copied classes.
Changed: Architecture (the host-per-size rule and its consequence), Contracts
(`Button` gains optional `label`), Track A's owned files (`Button.tsx` in,
`IconButton.tsx` out), new Step A0, Step A1's implement, Step A3's implement,
Step A4's assertion, Assumptions, and the R5/AC4 coverage rows.
Cost surfaced by this decision: `Button`'s accessible name is its children, and
this control's visible text differs from its accessible name by requirement. A
name override on `Button` is forced by AC3a and AC4 both being settled — it is
not a preference, and no option here avoided it.
