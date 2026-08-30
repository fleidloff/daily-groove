# Tech spec — Epic 2: The card names the tempo

PRD: [../prd/epic-2-the-card-names-the-tempo.md](../prd/epic-2-the-card-names-the-tempo.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

One component, one line of JSX, one prop-driven test. `GrooveCard` already
receives the whole `Groove` and renders `groove.name` in a level-2 heading; it
gains a muted caption below it reading `105 bpm`. Nothing is derived, fetched or
stored, and no other file changes.

The only design decision worth stating is where the tempo sits in the accessible
tree. It goes in its own node *after* the heading, not inside it, so a screen
reader announcing the card's heading still says "Rusted Shuffle" and nothing
else. That is the difference between a caption and a longer title.

## Architecture

```
Card
└── Stack gap="lg"
    ├── Heading level={2} size="lg"   ← groove.name        (unchanged)
    ├── <p> muted, small              ← `${groove.bpm} bpm` (new)
    └── {children}                     ← TransportPanel + PlayControl
```

The caption uses `Text` from the design system with `tone="muted"` and
`size="sm"` — the same pair the play control's caption already uses one level
down, so the two read as the same class of information.

`Text` is a design-system primitive and stays domain-free: it is handed a
finished string. The word `bpm` is composed here, in the feature, for the same
reason `PlayControl` is handed `text={{ play: 'Play the groove' }}` rather than
knowing what a groove is.

## Contracts

Nothing changes.

```ts
// src/features/daily-groove/components/puzzle/GrooveCard.tsx
type GrooveCardProps = {
  groove: Groove
  children?: ReactNode
}
```

`Groove.bpm: number` already exists in `src/lib/groove.ts` and is already
written by the generator for every catalogue entry.

## Tracks

### Track A — The caption

- **Goal** — the tempo renders under the groove name.
- **Owns** — `src/features/daily-groove/components/puzzle/GrooveCard.tsx` and
  `GrooveCard.test.tsx`.
- **Depends on** — nothing.
- **Parallel with** — every other epic in the feature. No file here is opened by
  Epics 1, 3, 4 or 5.
- **Done when** — its own tests pass.

## Execution waves

- **Wave 1:** Track A. There is only one track; the epic is one component.

## Implementation

### Track A — The caption

#### Step A1 — The card shows the tempo

Covers: R1, R5, R6, AC1, AC4, AC5

- **Test first** — `src/features/daily-groove/components/puzzle/GrooveCard.test.tsx`:
  render `<GrooveCard groove={grooveFixture({ bpm: 105 })} />` and assert
  `screen.getByText('105 bpm')` is in the document. Run it: fails with `Unable
  to find an element with the text: 105 bpm`.
- **Implement** — `GrooveCard.tsx`: below the `Heading`, add
  `<Text tone="muted" size="sm">{`${groove.bpm} bpm`}</Text>`, importing `Text`
  from `@/components/typography/Text`.
- **Green when** — the assertion passes and the existing name assertion stays
  green.
- **Refactor** — none. The props did not change, which is AC5.

#### Step A2 — The tempo is not part of the heading

Covers: R3, R4, AC3

- **Test first** — `GrooveCard.test.tsx`: assert
  `screen.getByRole('heading', { level: 2 }).textContent` equals the groove's
  name exactly, with no tempo in it. Run it: passes if A1 placed the caption as
  a sibling; fails with `"Rusted Shuffle105 bpm"` if it was nested inside the
  heading.
- **Implement** — none if A1 is correct. This step exists to pin the placement,
  because "put it under the name" is the kind of instruction that gets
  implemented as a second line inside the same element.
- **Green when** — the heading's text is the name alone.
- **Refactor** — none.

#### Step A3 — The tempo survives playback

Covers: R2, AC2

- **Test first** — `GrooveCard.test.tsx`: render the card with children that
  toggle a playing flag, fire the toggle, and assert `105 bpm` is still present
  afterwards. Run it: passes — the card does not subscribe to the transport.
  The step is a regression pin: it is what fails if someone later moves the
  caption into `TransportPanel`, where it would live under playing state.
- **Implement** — none.
- **Green when** — the text is present before and after.
- **Refactor** — none.

#### Step A4 — The stale comment goes

Covers: R1

- **Test first** — none. A comment is not behaviour and does not get a test.
- **Implement** — `GrooveCard.tsx`: rewrite the doc comment. It currently reads
  "The tempo is display-only data that drives nothing on screen, so it is not
  rendered; the canvas' meta line … is dropped rather than filled, since none of
  it is backed by real data." Replace with a sentence saying the header carries
  the name and the tempo, and that the rest of the canvas' meta line is
  deliberately still absent.
- **Green when** — suite unchanged and green.
- **Refactor** — this *is* the refactor step.

## Integration and verification

- **Step I1 — the puzzle still renders.** Run `GroovePuzzle.test.tsx`
  unchanged. `GrooveCard`'s props did not move, so nothing upstream should need
  editing.
- **Demo path** — `npm run dev`, open the page: under "Rusted Shuffle" the card
  reads `105 bpm`. Press play; the tempo does not move, flicker or change.
- **Full suite** — `npm test`, `npm run lint`, `npm run build` clean.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A4 |
| R2 | A3 |
| R3 | A2 |
| R4 | A2 |
| R5 | A1 |
| R6 | A1 |
| AC1 | A1 |
| AC2 | A3 |
| AC3 | A2 |
| AC4 | A1 |
| AC5 | A1 |

## Assumptions

- The caption is a `Text` element, not a `<span>` with utility classes. The
  design system owns type, and `GrooveHeader`'s date line is the one place that
  reaches for a raw `<span>` — not a precedent worth extending.
- `grooveFixture` is whatever helper `GrooveCard.test.tsx` already uses to build
  a `Groove`; if the file builds its literal inline, this spec's steps use that
  literal with `bpm` set.
- No fallback is rendered for a missing or zero `bpm`. `loopSecondsOf` already
  treats that as unrenderable and the generator never writes it.
