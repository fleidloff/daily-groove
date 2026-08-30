# PRD — Epic 2: The card names the tempo

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The groove card shows the tempo under the groove's name. Every groove in the
catalogue already carries a `bpm`, and nothing on the page has ever shown it —
so this is a display change with no new data, no new state and no new
dependency.

## Problem

The card invites you to "Play along. Find the note that feels like home." The
one number a player needs in order to do that — how fast the thing is — is the
one the card withholds. `GrooveCard`'s own doc comment records the reason it was
dropped: the canvas' meta line ("No. 214 · 4 bars · loops forever") was not
backed by real data at the time. `bpm` is, and always has been.

## Scope

- `components/puzzle/GrooveCard.tsx` renders `groove.bpm`.
- Its doc comment, which currently explains why the tempo is *not* shown, is
  corrected.

**Out of scope**
- **The rest of the meta line** — `4/4`, `4 bars`, `loops until you stop`. The
  briefing asks for the tempo and only the tempo. All three are equally
  available if they are wanted later.
- **The groove number.** `groove.id` would fill the canvas' "No. 214", but a
  visible integer is a lookup key a player can keep notes against, and Epic 1
  makes the sequence more predictable rather than less.
- **Making the tempo audible.** A count-in, a click, a metronome — none of that
  is here. This epic labels the groove; it does not change playback.
- **Using the tempo for anything.** `loopSecondsOf` already derives the loop
  length from `bpm`; that is untouched and unrelated.

## Requirements

- **R1** — The groove card displays the tempo of today's groove.
- **R2** — The tempo is shown whether or not the groove is playing, and does not
  change while it plays.
- **R3** — The tempo is subordinate to the groove's name: it reads as a caption
  beneath the heading, not as part of it.
- **R4** — The tempo is not part of the heading's accessible name. A screen
  reader announcing the card's heading announces the groove's name alone.
- **R5** — The tempo is written as the number followed by `bpm` — `105 bpm` —
  never a bare integer and never in another notation.
- **R6** — `GrooveCard` takes no new props. It already receives the whole
  `Groove` and reads the field it needs.

## Acceptance criteria

- **AC1** (R1) — Given a groove with a `bpm` of 105, when the card renders, then
  the tempo appears on the card.
- **AC2** (R2) — Given the card, when playback starts and stops, then the tempo
  shown is unchanged.
- **AC3** (R3, R4) — Given the card, when its accessible tree is inspected, then
  the level-2 heading's name is the groove's name only, and the tempo is a
  separate node.
- **AC4** (R5) — Given a groove with a `bpm` of 105, when the card renders, then
  the card shows `105 bpm`.
- **AC5** (R6) — Given `GrooveCard`'s props, when they are inspected, then they
  are `groove` and `children`, as before.

## Dependencies

None. No other epic in this feature opens `GrooveCard.tsx`, so this runs
alongside Epics 1, 3 and 4 with no shared files.

Per `docs/testing.md`, `GrooveCard` is part of the feature slice and is tested
inside it, driven by props.

## Assumptions

- The tempo sits directly under the heading, inside the card's existing `Stack`,
  above whatever `children` the puzzle passes in.
- It uses the muted text tone and a small size, matching the date line in
  `GrooveHeader` and the caption under the play control.
- `bpm` is always present and positive for catalogue grooves — the generator
  writes it and `loopSecondsOf` already depends on it. No fallback for a missing
  tempo is rendered.
- The value is shown as the integer the generator wrote, unrounded and
  unformatted beyond its unit.
- `bpm` is lower-case, matching the field name and the way the number is spoken.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-30

**Q1. How is the tempo written?**
Answer: **A) `105 bpm`** — the briefing and the codebase both call the field
`bpm`, and it reads to a musician and a non-musician alike.
Applied to: R5, AC4, Assumptions
