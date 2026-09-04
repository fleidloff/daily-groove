# Tech spec — Epic 3: Chords over the playing bars

PRD: [../prd/epic-3-chords-over-the-playing-bars.md](../prd/epic-3-chords-over-the-playing-bars.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

`TransportPanel` gains one optional prop: the four chord symbols, or nothing.
Given them, it draws a four-column row above the track in the jazz face, with the
sounding bar's symbol at full ink and the other three dimmed — off the same
`active` index it already computes for the segment highlight. `GroovePuzzle`
passes the symbols only once the day has ended, and passes nothing before then.

No new component, no new lib module, no new state. The whole epic is a prop, a
row, and one conditional at the call site.

## Architecture

```
GroovePuzzle           over = solved || revealed        ← already computed there
      │                chords = over ? barChords(groove.progression) : null
      ▼
TransportPanel({ position, isPlaying, passes, chords })
      │  active = isPlaying ? floor(scaled × 4) % 4 : null   ← already computed
      ├── chord row      four columns, symbol i at full ink when i === active
      └── ProgressTrack  unchanged
```

**One derivation, two consumers.** The `active` index the segment highlight uses
is the same value the row reads. It is not recomputed, not passed in twice, and
not derived from a second clock — a symbol lighting a frame off from its segment
is exactly what a player watching a bar line would catch.

**The symbols live in the feature.** `ProgressTrack` stays a segmented bar that
knows nothing about chords; the row is a sibling inside `TransportPanel`'s inset
card, sharing its four-column geometry through a CSS grid rather than through
the primitive.

**Alignment is by grid, not by measurement.** The row is
`grid grid-cols-4` over the same width as the track, so column *i* is bar *i* by
construction. Nothing computes pixel offsets, and the alignment survives every
width without a media query.

## Contracts

```ts
// src/features/daily-groove/components/puzzle/TransportPanel.tsx
type TransportPanelProps = {
  position: number
  isPlaying: boolean
  passes: number
  /**
   * One chord symbol per bar, or null to draw no row at all. Null until the
   * day has ended: the progression names the answer.
   */
  chords?: string[] | null
}
```

- Consumed from Epic 1: `barChords(progression): string[]` and `Lettering`.
  Nothing else crosses.
- The prop is optional so every existing `TransportPanel` test keeps compiling
  unchanged; omitting it is the pre-solve state.

## Tracks

### Track A — The row inside the panel

- **Goal** — `TransportPanel` draws and lights the row when given chords, and is
  byte-identical in behaviour when not.
- **Owns** — `src/features/daily-groove/components/puzzle/TransportPanel.tsx`,
  `TransportPanel.test.tsx`
- **Depends on** — the `Lettering` contract from Epic 1 (Track B there).
- **Parallel with** — B
- **Done when** — its own tests pass with hand-passed `chords`.

### Track B — The card decides when

- **Goal** — the symbols appear once the day has ended and never before.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.tsx` (the
  `TransportPanel` and `GrooveCard` call sites only), `GroovePuzzle.test.tsx`,
  and — for Track C — `puzzle/GrooveCard.tsx` and its test
- **Depends on** — the `TransportPanelProps` contract and `barChords`.
- **Parallel with** — A
- **Done when** — its tests pass, which requires A to have landed.

**Cross-epic seam.** Epic 1's Track C also edits `GroovePuzzle.tsx` — the
`SolvedPanel` call site, to drop `chord={groove.chord}`. Different JSX block,
same file, so this epic runs in a **later wave than Epic 1**, not beside it. The
roadmap already schedules it that way.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B — B's tests go red until A lands, which
  is expected and is what B's steps say.
- **Wave 2:** Integration.

## Implementation

### Track A — The row inside the panel

#### Step A1 — No chords, no row

Covers: R2, AC2

- **Test first** — `TransportPanel.test.tsx`: render as today, with no `chords`
  prop, and assert no element carrying the chord-row test id exists and the
  card's only child region is the track. Run it: passes today. This is the
  track's regression guard — write it first and keep it green.
- **Implement** — none.
- **Green when** — green.

#### Step A2 — Four symbols above the track

Covers: R1, R7, AC1

- **Test first** — same file: render with
  `chords={['Em7','Bm7','C♯m7♭5','Em7']}` and assert the four symbols are
  present in order, that their container carries `grid-cols-4`, and that each
  symbol's element resolves to the jazz face (`className` matches `/font-jazz/`).
  Run it: fails with a type error — no `chords` prop.
- **Implement** — `TransportPanel.tsx`: add `chords?: string[] | null`; when
  non-empty, render a `grid grid-cols-4` row of `<Lettering size="sm">` above
  the `ProgressTrack`, inside the same `Card`.
- **Green when** — the three assertions pass and A1 stays green.
- **Refactor** — none.

#### Step A3 — The sounding bar's symbol is the lit one

Covers: R4, R5, AC4

- **Test first** — same file: with `isPlaying`, `passes={1}` and
  `position={0.6}` — inside bar three — assert the third symbol's element
  carries the full-ink treatment and the other three carry the dimmed one, and
  that the `progress-active` rect sits over the third segment. Then rerender at
  `position={0.1}` and assert the lit symbol has moved to the first. Run it:
  fails, no treatment is applied.
- **Implement** — `TransportPanel.tsx`: pass the existing `active` value to the
  row; symbol `i` gets the dimmed class when `active !== null && i !== active`.
- **Green when** — both positions light the right symbol.
- **Refactor** — none.

#### Step A4 — Stopped means all four alike

Covers: R6, AC5

- **Test first** — same file: with `isPlaying={false}`, assert all four symbols
  carry the same treatment and none is dimmed — matching the track, which
  highlights no segment when stopped. Run it: fails if A3 dimmed on a `null`
  active.
- **Implement** — the `active !== null` guard from A3, if it was not already
  there.
- **Green when** — green.
- **Refactor** — none.

#### Step A5 — A pass boundary moves ink and highlight together

Covers: R5

- **Test first** — same file: with `passes={4}`, step `position` across a bar
  boundary within a pass and across the pass boundary itself, asserting at each
  point that the lit symbol's index equals the segment the `progress-active`
  rect covers. Run
  it: passes if A3 read `active` rather than recomputing; fails loudly if it
  derived its own.
- **Implement** — none.
- **Green when** — green at every sampled position.

#### Step A6 — The row announces nothing

Covers: R10, AC6

- **Test first** — same file: assert the row is not a live region — no
  `aria-live`, no `role="status"` — and that the `progressbar`'s accessible
  output is what it is today. Run it: fails if A2 gave the row a role.
- **Implement** — plain elements, no ARIA beyond what the symbols are.
- **Green when** — green.
- **Refactor** — none.

#### Step A7 — The row fits, and does not shove the card

Covers: R6a, R9, R11

- **Test first** — same file: assert the row sits inside the same
  `bg-surface-inset` card as the track and immediately before it in document
  order; and that no symbol element carries a hardcoded colour class, so the ink
  follows the palette. Run it: fails if A2 rendered the row outside the card.
- **Implement** — placement and class cleanup.
- **Green when** — green.
- **Refactor** — none.

### Track B — The card decides when

#### Step B1 — Nothing before the day ends

Covers: R2, AC2

- **Test first** — `GroovePuzzle.test.tsx`: render a day in progress with two
  wrong attempts spent and assert that none of the day's four chord symbols
  appears anywhere in the document. Run it: passes today; it is the guard that
  matters most in this epic, because getting it wrong hands over the answer.
- **Implement** — none.
- **Green when** — green.

#### Step B2 — The symbols arrive with the answer

Covers: R1, R3, AC1, AC3

- **Test first** — same file: solve the day, then assert the four symbols from
  `barChords(groove.progression)` are present above the track. Repeat for a day
  given up on. Run it: fails — nothing is passed.
- **Implement** — `GroovePuzzle.tsx`: at the `TransportPanel` call site, pass
  `chords={solved || revealed ? barChords(groove.progression) : null}`. The
  `solved || revealed` expression is the same terminal state the panel below
  already keys on; do not introduce a second name for it.
- **Green when** — both cases pass and B1 stays green.
- **Refactor** — none.

#### Step B3 — The card's own chords match the panel's

Covers: R1

- **Test first** — same file: on a solved day, assert the four symbols over the
  track read the same, in the same order, as the four bars in the payoff panel.
  Run it: passes if both call `barChords`; fails if either grew its own
  derivation.
- **Implement** — none.
- **Green when** — green.

### Track C — The answer beside the tempo

#### Step C1 — The card names the answer once the day is over

Covers: R12, R13, AC7

- **Test first** — `puzzle/GrooveCard.test.tsx`: with an `answer` prop, assert
  the meta line reads `105 bpm · C Mixolydian · Sunday, 30 August` as one node;
  without it, and with `answer={null}`, assert it reads `105 bpm · Sunday, 30
  August` and that no mode name appears anywhere in the card. Run it: fails with
  a type error — `GrooveCard` has no `answer` prop.
- **Implement** — `GrooveCard.tsx`: `answer?: Answer | null`, and build the meta
  line by joining `[bpm, ...(answer ? ['<root> <flavour>'] : []), dateLine(date)]`
  with `' · '`. One node, as it is today.
- **Green when** — both states read correctly and the heading is untouched.
- **Refactor** — none.

#### Step C2 — It waits for the end of the day

Covers: R13, AC7

- **Test first** — `GroovePuzzle.test.tsx`: assert the answer is absent from the
  document before a guess and after a wrong one, and present in the meta line
  once solved. Run it: fails — the card is passed no answer.
- **Implement** — `GroovePuzzle.tsx`: `answer={solved || revealed ? answer : null}`
  at the `GrooveCard` call site — the same terminal state the chord row uses.
- **Green when** — green, with the chord-row spoiler guard still green.

## Integration and verification

- **Demo path** — play a day through: no chord symbols while guessing. Solve it,
  press play, and watch the lit symbol step 1→2→3→4 and wrap, in time with the
  segment beneath it. Stop: all four symbols at full ink, no segment lit. Reload
  the solved day and confirm the symbols are still there before pressing play.
- **Full suite** — `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run
  build`.
- **The spoiler check, by hand** — open the app on a fresh day in a private
  window and confirm nothing on the card names a chord until the day is over.
  This is the one failure the tests describe but a careless later refactor could
  reintroduce.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A2, B2, B3 |
| R2 | A1, B1 |
| R3 | B2 |
| R4 | A3 |
| R5 | A3, A5 |
| R6 | A4 |
| R6a | A2, A7 |
| R7 | A2 |
| R8 | A2 (grid-cols-4 over the track's own width) |
| R9 | A7 |
| R10 | A6 |
| R11 | A7 |
| R12 | C1, C2 |
| R13 | C1, C2 |
| AC1 | A2, B2 |
| AC2 | A1, B1 |
| AC3 | B2 |
| AC4 | A3 |
| AC5 | A4 |
| AC6 | A6 |
| AC7 | C1, C2 |

## Assumptions

- The dimmed treatment is an opacity class on the symbol, not a second colour
  token: the row's ink is the card's ink, and dimming is how the track's own
  quiet segments already read.
- `TransportPanel` keeps its local `BAR_COUNT`. It is the number of segments the
  track draws, and coupling it to `changes.ts`'s constant would make the drawing
  depend on the harmony module for no gain.
- Four symbols are assumed because `barChords` returns four; the row renders
  whatever length it is handed, and a wrong length is a `barChords` bug, not a
  case for this component to handle.
- No animation on the ink change. The segment highlight does not animate either,
  and at 105 bpm a transition would blur the very boundary the row exists to
  mark.
