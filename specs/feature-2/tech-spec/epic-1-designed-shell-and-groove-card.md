# Tech spec — Epic 1: The designed shell and today's groove card

PRD: [../prd/epic-1-designed-shell-and-groove-card.md](../prd/epic-1-designed-shell-and-groove-card.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four tracks that barely touch each other. The token layer and fonts live in
`src/app`; the design-system primitives live in `src/components`; the groove data
and the audio player live in the feature's `lib/`; and the feature's UI composes
all three. Freezing the token names and the primitive prop signatures up front is
what lets three of the four run at once — and those same two contracts are what
Epics 2–5 build against, so they are the most valuable output of this epic.

Styling is expressed as semantic CSS custom properties under Tailwind v4's
`@theme`, redefined once inside a `prefers-color-scheme: dark` block. No component
carries a raw hex value and no component carries a `dark:` variant, so the whole
app re-themes at a single swap point.

## Architecture

```
src/app/
  globals.css      @theme token layer, light + dark          (Track A)
  layout.tsx       fonts, metadata, <body>                   (Track A)
  page.tsx         composition only                          (Track D)
src/components/    generic prop-driven primitives            (Track B)
src/features/daily-groove/
  types.ts         Groove widened with name + bpm            (Track C)
  lib/seed.ts      names and tempos authored                 (Track C)
  lib/audio.ts     looping play/pause/resume + position      (Track C)
  components/      groove card, header, transport            (Track D)
```

Playback position is polled with `requestAnimationFrame` rather than the audio
element's `timeupdate` event, which fires roughly four times a second — too coarse
to move a bar highlight cleanly. The player exposes a subscribe/snapshot pair so
React reads it through `useSyncExternalStore` without a render loop.

Primitives take **strict props only**. No component in `src/components` accepts a
`className`, a `style`, or any other passthrough that would let a caller express
layout from outside the design system. Variation is expressed as closed prop
unions — `gap="md"`, `tone="inset"` — resolved to token classes inside the
component. This is what makes the briefing's rule testable rather than
aspirational: Step D7's guard only means something if layout is impossible to
write at the call site, and Step I4 asserts the absence of the escape hatch
directly.

## Contracts

Frozen here; Epics 2–5 build against them.

```css
/* src/app/globals.css — @theme token names (light values shown) */
--color-paper:            #F5F2EA;   /* page ground */
--color-paper-tint:       #FBF9F3;   /* radial highlight */
--color-paper-shade:      #EDEBE0;   /* radial falloff */
--color-surface:          #FFFDF8;   /* card */
--color-surface-inset:    #F3F1E6;   /* transport panel */
--color-border:           #E4E2D5;
--color-border-strong:    #DCDACD;
--color-accent:           #3F5A42;
--color-accent-hover:     #33492F;
--color-accent-soft:      #7E9B6E;   /* brand dot, marks */
--color-accent-track:     #8FA87C;   /* progress fill */
--color-text:             #23291F;
--color-text-muted:       #8A9180;
--color-text-faint:       #A0A794;
--color-warm:             #C4714B;   /* active bar, miss tone */
--radius-card:            22px;
--radius-panel:           16px;
--radius-control:         14px;
--radius-chip:            10px;
--shadow-card:            0 1px 0 #FFFFFF inset, 0 18px 40px -32px rgba(48,58,42,.45);
```

```ts
// src/features/daily-groove/types.ts
export type Groove = {
  id: string
  audioSrc: string
  name: string        // NEW — display name, e.g. "Sunroom Shuffle"
  bpm: number         // NEW — display only, does not drive playback
  scale: string
  chord: string
  progression: string
}

// src/features/daily-groove/lib/audio.ts
export type AudioPlayer = {
  play(): Promise<void>          // starts or resumes; loops
  pause(): void                  // holds position
  getPosition(): number          // 0..1 through the loop, 0 when never played
  isPlaying(): boolean
  subscribe(fn: () => void): () => void
  dispose(): void
}
```

Primitive prop signatures — `src/components/`. Every prop is a closed union or a
value; none of these types includes `className`, `style`, or an index signature,
and none extends `HTMLAttributes`.

```ts
type Space = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
```

- `PageShell({ children })` · `Container({ children })`
- `Card({ children, tone?: 'raised' | 'inset' })`
- `Stack({ children, gap: Space })`
- `Row({ children, gap: Space, align?: 'start' | 'center' | 'end' | 'baseline', justify?: 'start' | 'between' | 'end', collapseBelow?: 'sm' | 'md' })`
- `Heading({ children, level: 1 | 2 | 3, size: 'sm' | 'md' | 'lg' | 'xl' })`
- `Text({ children, tone?: 'default' | 'muted' | 'faint', size?: 'sm' | 'md' })`
- `EyebrowLabel({ children })` · `Pill({ children, icon? })`
- `IconButton({ onPress, label, glyph })`
- `ProgressTrack({ value, segments, activeSegment })`
- `PlayControl({ isPlaying, onToggle })`

## Tracks

### Track A — Token layer and fonts

- **Goal** — the paper ground, both palettes, and the type pairing exist.
- **Owns** — `src/app/globals.css`, `src/app/layout.tsx`
- **Depends on** — nothing
- **Parallel with** — Tracks B, C
- **Done when** — the token tests pass and the app renders on paper.

### Track B — Design-system primitives

- **Goal** — every primitive in the contract exists and is tested against its own
  props, states and accessibility, with no feature knowledge.
- **Owns** — `src/components/**`
- **Depends on** — the token names only
- **Parallel with** — Tracks A, C
- **Done when** — its own tests pass with no feature code present.

### Track C — Groove data and audio

- **Goal** — `Groove` carries a name and a tempo, the seed is authored, and the
  player loops with an observable position.
- **Owns** — `src/features/daily-groove/types.ts`, `lib/seed.ts`, `lib/audio.ts`
  and their tests
- **Depends on** — the `Groove` and `AudioPlayer` contracts only
- **Parallel with** — Tracks A, B
- **Done when** — its own tests pass without any UI.

### Track D — Feature UI and route composition

- **Goal** — the header, the groove card, the transport, and a `src/app` emptied
  of layout.
- **Owns** — `src/features/daily-groove/components/**`, `src/app/page.tsx`
- **Depends on** — Track B's primitives and Track C's player, as built code
- **Parallel with** — none
- **Done when** — the demo path renders and the app-purity guards pass.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C
- **Wave 2:** Track D — needs B and C as built code, not just contracts
- **Wave 3:** Integration and verification

## Implementation

### Track A — Token layer and fonts

#### Step A1 — The light token layer exists

Covers: R1, R2

- **Test first** — `src/app/globals.test.ts`: read `src/app/globals.css` and assert
  it contains an `@theme` block defining every name in the Contracts list. Run it:
  fails, `--color-paper` is not found.
- **Implement** — `src/app/globals.css`: replace the scaffold's `--background`/
  `--foreground` pair with the full `@theme` block; set `body` to the radial paper
  gradient using the three paper tokens.
- **Green when** — every contract token name is present.
- **Refactor** — none.

#### Step A2 — The dark palette covers exactly the same names

Covers: R3

- **Test first** — same file: parse the custom-property names defined in `@theme`
  and those defined inside `@media (prefers-color-scheme: dark)`, and assert the
  two sets are equal. Run it: fails, the dark set is empty.
- **Implement** — `src/app/globals.css`: add the dark block redefining every colour
  token. Radii and shadow are palette-independent and stay out of it — exclude
  non-`--color-*` names from both sides of the comparison.
- **Green when** — the two colour-token sets match exactly.
- **Refactor** — none. This test is the guard that a token added later gets a dark
  value too.

#### Step A3 — Newsreader and DM Sans replace Geist

Covers: R1

- **Test first** — `src/app/layout.test.ts`: read `src/app/layout.tsx` and assert it
  imports `Newsreader` and `DM_Sans` from `next/font/google`, and that it does not
  import `Geist`. Run it: fails, `Geist` is still imported.
- **Implement** — `src/app/layout.tsx`: swap the font imports, exposing
  `--font-newsreader` and `--font-dm-sans`; map them onto `--font-display` and
  `--font-sans` in the `@theme` block.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A4 — `layout.tsx` carries no layout classes

Covers: R13

- **Test first** — `src/app/layout.test.ts`: assert the file's className strings
  contain no flex, grid, gap, padding, margin or max-width utilities. Run it:
  fails on `min-h-full flex flex-col`.
- **Implement** — `src/app/layout.tsx`: reduce `<body>` to the font variables and
  the theme background; structure moves to `PageShell`.
- **Green when** — the guard passes.
- **Refactor** — none.

### Track B — Design-system primitives

#### Step B1 — `PageShell` and `Container` frame the page

Covers: R13, R14

- **Test first** — `src/components/PageShell.test.tsx`: render
  `<PageShell><Container>hi</Container></PageShell>`, assert the text renders and
  the outermost element is a `<div>` carrying the page padding. Run it: fails,
  module not found.
- **Implement** — `src/components/PageShell.tsx` and `Container.tsx`: prop-driven,
  children-only, centred max-width in `Container`.
- **Green when** — both render their children.
- **Refactor** — none.

#### Step B2 — `Card` renders raised and inset tones

Covers: R7

- **Test first** — `src/components/Card.test.tsx`: render `<Card>a</Card>` and
  `<Card tone="inset">b</Card>`, assert both render children and that the two
  produce different class strings. Run it: fails, module not found.
- **Implement** — `src/components/Card.tsx`: `tone` defaults to `raised`, using the
  surface, border, radius and shadow tokens; `inset` uses the inset surface.
- **Green when** — both tones render distinctly.
- **Refactor** — none.

#### Step B3 — `Stack` and `Row` own spacing

Covers: R13

- **Test first** — `src/components/Stack.test.tsx`: render a `Stack` and a `Row`
  with three children each, assert all children appear and that `Row` accepts
  `align` and `justify` without error. Run it: fails, module not found.
- **Implement** — `src/components/Stack.tsx`, `Row.tsx`: gap taken as a token-scale
  prop, never a raw class from the caller.
- **Green when** — children render for both.
- **Refactor** — none.

#### Step B4 — Typography primitives

Covers: R4

- **Test first** — `src/components/Heading.test.tsx`: assert `<Heading level={1}>`
  renders an `<h1>` and `<Heading level={2}>` an `<h2>`; assert `Text` and
  `EyebrowLabel` render their children. Run it: fails, module not found.
- **Implement** — `src/components/Heading.tsx`, `Text.tsx`, `EyebrowLabel.tsx`.
  `Heading` uses the display font; `EyebrowLabel` applies the uppercase tracked
  treatment.
- **Green when** — the heading levels map correctly.
- **Refactor** — none.

#### Step B5 — `Pill` renders a label and an optional icon

Covers: R6

- **Test first** — `src/components/Pill.test.tsx`: assert `<Pill>12 days</Pill>`
  renders the text, and that passing `icon` renders it before the label. Run it:
  fails, module not found.
- **Implement** — `src/components/Pill.tsx`: rounded outline treatment.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B6 — `IconButton` is a labelled circular control

Covers: R10, R14

- **Test first** — `src/components/IconButton.test.tsx`: render with
  `label="Play the loop"`, assert `getByRole('button', { name: 'Play the loop' })`
  resolves and that clicking calls `onPress` once. Run it: fails, module not found.
- **Implement** — `src/components/IconButton.tsx`: `aria-label` from `label`,
  glyph rendered `aria-hidden`.
- **Green when** — the accessible name resolves and the click fires.
- **Refactor** — none.

#### Step B7 — `ProgressTrack` marks segments and the active one

Covers: R11

- **Test first** — `src/components/ProgressTrack.test.tsx`: render
  `<ProgressTrack value={0.3} segments={4} activeSegment={1} />`, assert it exposes
  `role="progressbar"` with `aria-valuenow` of 30, renders three divider marks, and
  that no segment is active when `activeSegment` is `null`. Run it: fails, module
  not found.
- **Implement** — `src/components/ProgressTrack.tsx`: fill width from `value`,
  `segments - 1` dividers, active segment styled with the warm token.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step B8 — `PlayControl` toggles between play and pause

Covers: R10

- **Test first** — `src/components/PlayControl.test.tsx`: replace the existing
  play/replay tests — assert that with `isPlaying={false}` the accessible name is
  "Play the loop", with `isPlaying` it is "Pause the loop", and clicking calls
  `onToggle`. Run it: fails, the component still takes `onPlay`/`label`.
- **Implement** — `src/components/PlayControl.tsx`: rewrite over `IconButton`,
  taking `isPlaying` and `onToggle`.
- **Green when** — both names resolve and the toggle fires.
- **Refactor** — delete the old `onPlay`/`label` props and their tests.

### Track C — Groove data and audio

#### Step C1 — Every groove has a name and a tempo

Covers: R8, AC6

- **Test first** — `src/features/daily-groove/lib/seed.test.ts`: assert every groove
  in `GROOVES` has a non-empty `name` and a `bpm` between 40 and 200. Run it: fails,
  `name` is undefined.
- **Implement** — `types.ts`: add `name: string` and `bpm: number` to `Groove`.
  `lib/seed.ts`: author a name and a tempo for all seven grooves.
- **Green when** — the assertion passes for every groove.
- **Refactor** — none.

#### Step C2 — Playback loops

Covers: R10

- **Test first** — `src/features/daily-groove/lib/audio.test.ts`: assert the element
  created by `createAudioPlayer` has `loop === true`. Run it: fails, `loop` is
  false.
- **Implement** — `lib/audio.ts`: set `element.loop = true`.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step C3 — Pause holds position and play resumes

Covers: R10, AC7

- **Test first** — same file: call `play()`, set the stub element's `currentTime`,
  call `pause()`, assert `currentTime` is unchanged and `isPlaying()` is false;
  call `play()` again and assert `currentTime` still has not been reset. Run it:
  fails, `pause` is not a function.
- **Implement** — `lib/audio.ts`: replace `stop()` with `pause()`; remove the
  `currentTime = 0` reset from `play()`; track and expose `isPlaying()`.
- **Green when** — position survives a pause/resume round trip.
- **Refactor** — none.

#### Step C4 — Position is observable

Covers: R11

- **Test first** — same file: assert `getPosition()` is 0 before playing; with the
  stub reporting `currentTime` 3 and `duration` 12, assert it returns 0.25; assert
  `subscribe` returns an unsubscribe function that stops further notification. Run
  it: fails, `getPosition` is not a function.
- **Implement** — `lib/audio.ts`: `getPosition()` as `currentTime / duration`
  guarded against a zero or `NaN` duration; a listener set driven by a
  `requestAnimationFrame` loop that runs only while playing.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step C5 — A failed play still rejects

Covers: R12

- **Test first** — same file: with the stub's `play()` rejecting, assert the
  player's `play()` rejects rather than resolving. Run it: passes or fails
  depending on C3's rewrite — if it passes, the assertion is guarding the
  rewrite, which is the point.
- **Implement** — `lib/audio.ts`: keep returning the element's play promise.
- **Green when** — the rejection propagates.
- **Refactor** — none.

### Track D — Feature UI and route composition

#### Step D1 — The card header shows the name and the BPM, and nothing else

Covers: R7, R9, AC5

- **Test first** — `src/features/daily-groove/components/GrooveCard.test.tsx`:
  render with a groove named "Sunroom Shuffle" at 84 bpm, assert both appear, that
  "BPM" is present as a label, and that no element matching `/No\.|bars|loops/`
  renders. Run it: fails, module not found.
- **Implement** — `components/GrooveCard.tsx`: a `Card` containing a `Row` of
  `Heading` (name) and a right-aligned tempo block. No meta line.
- **Green when** — name and BPM render and the meta-line probe finds nothing.
- **Refactor** — none.

#### Step D2 — The transport shows four bars and highlights the sounding one

Covers: R11, AC8

- **Test first** — `components/TransportPanel.test.tsx`: render with `position` 0.1
  and assert "BAR 1" is marked current; re-render at 0.3 and assert "BAR 2" is;
  render with `isPlaying={false}` and assert no bar is current. Run it: fails,
  module not found.
- **Implement** — `components/TransportPanel.tsx`: an inset `Card` wrapping
  `ProgressTrack`, with four labels; the active segment is
  `Math.floor(position * 4)` while playing, `null` otherwise.
- **Green when** — the highlight tracks position and clears when stopped.
- **Refactor** — none.

#### Step D3 — The header carries the brand, the title and today's date

Covers: R4, R5, AC3

- **Test first** — `components/GrooveHeader.test.tsx`: render with a fixed date of
  29 August 2026, assert the wordmark "daily-groove", the heading "Today's groove",
  the weekday "Saturday" and "29 August" all render. Run it: fails, module not
  found.
- **Implement** — `components/GrooveHeader.tsx`: takes `date` and `streak` as
  props — no clock reading inside the component, so the test needs no fake timers.
  Formats via `Intl.DateTimeFormat`.
- **Green when** — all four strings render.
- **Refactor** — none.

#### Step D4 — The streak pill shows a zero state

Covers: R6, AC4

- **Test first** — `components/StreakBadge.test.tsx`: assert `streak={0}` renders
  the no-streak wording and not the bare string "0 days"; assert `streak={1}`
  renders "1 day" and `streak={12}` renders "12 days". Run it: fails, the component
  still renders "0 days".
- **Implement** — `components/StreakBadge.tsx`: rewrite over `Pill` with the accent
  dot as its icon.
- **Green when** — all three cases render as asserted.
- **Refactor** — none.

#### Step D5 — Pressing the control plays, pauses and resumes

Covers: R10, AC7

- **Test first** — `components/GroovePuzzle.test.tsx`: with a stubbed player,
  assert pressing the control calls `play`, that the accessible name becomes
  "Pause the loop", that pressing again calls `pause`, and that a third press calls
  `play` without any reset. Run it: fails, the puzzle still renders a replay button.
- **Implement** — `components/GroovePuzzle.tsx`: hold the player in a ref, read
  `isPlaying`/`getPosition` through `useSyncExternalStore` over the player's
  `subscribe`, and pass them down to `PlayControl` and `TransportPanel`.
- **Green when** — the three-press sequence produces play, pause, play.
- **Refactor** — remove the now-unused `isPlaying` local state.

#### Step D6 — A failed play surfaces an error with retry

Covers: R12, AC9

- **Test first** — same file: with the player rejecting, assert an element with
  `role="alert"` appears, that it offers a retry control, and that the card's name
  and transport still render. Run it: fails, the alert path was removed by D5.
- **Implement** — `components/GroovePuzzle.tsx`: catch the rejection, set an error
  flag, render the alert above the card, clear it on retry.
- **Green when** — the alert renders and the rest of the card survives.
- **Refactor** — none.

#### Step D7 — The route composes primitives and holds no layout

Covers: R13, AC10

- **Test first** — `src/app/page.test.tsx`: extend the existing test to assert the
  file contains no flex, grid, gap, padding, margin or max-width utility classes.
  Run it: fails on `flex flex-1 flex-col items-center justify-center`.
- **Implement** — `src/app/page.tsx`: reduce to `PageShell` → `Container` →
  `GrooveHeader` + `GroovePuzzle`.
- **Green when** — the guard passes and the page still renders the puzzle.
- **Refactor** — none.

#### Step D8 — The layout collapses on a narrow viewport

Covers: R15, AC12

- **Test first** — `components/GroovePuzzle.test.tsx`: assert the two-column
  wrapper carries a single-column class at the base breakpoint and the split only
  at the larger one, so the stacked case is the default rather than an override.
  Run it: fails, the wrapper is unconditionally two-column.
- **Implement** — the grid wrapper in `GroovePuzzle`, expressed through a `Row`
  or grid primitive that takes a `collapseBelow` prop.
- **Green when** — the base case is single-column.
- **Refactor** — none.

## Integration and verification

#### Step I1 — No component carries a raw hex colour

Covers: R2, AC1

- **Test first** — `src/design-system.test.ts`: glob `src/components/**` and
  `src/features/**` for `/#[0-9a-fA-F]{3,8}\b/` and assert no matches. Run it:
  fails if any step inlined a colour.
- **Implement** — replace any offender with a token.
- **Green when** — the glob finds nothing.

#### Step I2 — The design system knows nothing about features

Covers: R14, AC11

- **Test first** — same file: glob `src/components/**` and assert no file contains
  `from '@/features` or `from '../features`. Run it: fails if a primitive reached
  for a domain type.
- **Implement** — move any leaked type into the component's props.
- **Green when** — the glob finds nothing.

#### Step I3 — The app renders correctly in the dark palette

Covers: R3, AC2

- **Test first** — `src/app/globals.test.ts`: assert no `dark:` variant appears
  anywhere under `src/components` or `src/features`, proving the palette swap is
  doing the work rather than per-component overrides. Run it: fails if any step
  reached for `dark:`.
- **Implement** — replace with a token that already differs per palette.
- **Green when** — the guard passes.

#### Step I4 — No primitive offers a styling escape hatch

Covers: R13, R14

- **Test first** — `src/design-system.test.ts`: glob `src/components/**` and assert
  no file's props type mentions `className`, `style`, `HTMLAttributes` or
  `ComponentProps`. Run it: fails if any primitive spreads DOM props.
- **Implement** — replace any passthrough with a closed prop union resolved to
  token classes inside the component.
- **Green when** — the glob finds nothing.

#### Step I5 — The demo path, by hand

- `npm test` — full suite green.
- `npm run build` — no type or lint errors.
- `npm run dev`, then: the page renders on the paper ground with the serif title,
  the date and the streak pill; the card shows the groove's name and BPM with no
  meta line; pressing play animates the progress bar and moves the bar highlight;
  pressing again pauses without resetting; switching the OS to dark re-themes the
  page; narrowing to 375px stacks the columns with no horizontal scroll.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A3 |
| R2 | A1, I1 |
| R3 | A2, I3 |
| R4 | B4, D3 |
| R5 | D3 |
| R6 | B5, D4 |
| R7 | B2, D1 |
| R8 | C1 |
| R9 | D1 |
| R10 | B8, C2, C3, D5 |
| R11 | B7, C4, D2 |
| R12 | C5, D6 |
| R13 | A4, B1, B3, D7, I4 |
| R14 | B6, I2, I4 |
| R15 | D8 |
| AC1 | I1 |
| AC2 | I3 |
| AC3 | D3 |
| AC4 | D4 |
| AC5 | D1 |
| AC6 | C1 |
| AC7 | C3, D5 |
| AC8 | D2 |
| AC9 | D6 |
| AC10 | D7 |
| AC11 | I2 |
| AC12 | D8 |

## Assumptions

- Token names use Tailwind v4's `--color-*` / `--radius-*` conventions so they
  generate utilities automatically; semantic names, not palette names.
- `GrooveHeader` takes `date` as a prop rather than reading the clock, which keeps
  its test free of fake timers and lets the route own "today".
- The audio element is stubbed in tests via a module-level factory seam rather than
  a jsdom media shim, since jsdom implements no playback.
- Names and tempos are authored to match each groove's character; they are content,
  not a schema change beyond the two fields.
- Existing feature-1 tests for `PlayControl`'s replay behaviour are deleted in Step
  B8 rather than adapted, because the control's contract changed.
- Spacing, alignment and size props are closed unions over a token scale rather than
  free values, so a caller cannot smuggle an arbitrary length through a typed prop.
- When a primitive genuinely needs a new layout capability, it gains a named prop
  rather than a passthrough; that is ordinary evolution, not an escape hatch.

## Decision log

### Cycle 1 — 2026-08-29

**Q1. How strictly do the design-system primitives control styling?**
Decision: **A) Strict props only — no `className` passthrough anywhere in
`src/components`** — it is the only version of the briefing's rule a test can
enforce, and Step D7's guard is meaningless if layout can be written at the call
site.
Changed: Approach and Architecture now state the rule; Contracts pin closed prop
unions and a `Space` scale for every primitive; new Step I4 asserts no primitive
exposes `className`, `style`, `HTMLAttributes` or `ComponentProps`; the old Step
I4 demo path is renumbered I5; R13 and R14 coverage gains I4.
