# PRD — Epic 2: The play button leads

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Promotes the play control from a 52px circle tucked beside a caption to a
full-width button the size and shape of the solve button opposite it, with its
caption below rather than alongside. The control stays a generic design-system
component: it gains a size variant, not feature knowledge. It also stops
pausing: the button says "Stop", and now that is what it does — playback ends
and the next press restarts the loop from the top.

## Problem

Playing the groove is the first thing a player must do and the only thing that
gives them the information to guess. Right now the control that does it is the
smallest interactive element on the page — a circle beside a line of muted grey
text — while the button that ends the round is a full-width accent bar. The
page's visual hierarchy is the exact inverse of its actual order of operations.

## Scope

- A size variant on the design-system play control so it can render full-width.
- Whatever `IconButton` needs to support that variant without losing its
  circular default.
- Re-laying-out the groove card's control region: control first, caption below.
- Changing the transport from pause-and-resume to stop-and-restart, so the
  control's behaviour matches the word on it.

**Out of scope**
- The smaller variant used by the archive cards — Epic 5 takes the other end of
  the same prop.
- Removing the bar labels and the BPM above the control — Epic 1.
- What plays, that it loops, and how a playback failure is surfaced. Those are
  unchanged; only the meaning of a press while sounding changes.

## Requirements

- **R1** — The play control renders full-width within the groove card, matching
  the solve button's geometry: full width, the same corner radius, the same
  vertical padding, the same text size.
- **R2** — The control's size is chosen by a prop on the design-system
  component. The component holds no knowledge of the groove card, the feature,
  or where it is being used.
- **R3** — The circular variant remains available and unchanged, so any existing
  use of the control is unaffected by this epic.
- **R4** — The caption "Play along. Find the note that feels like home." renders
  below the control, full-width, not beside it.
- **R4a** — The full-width control carries a glyph and text, not a bare glyph:
  "▶ Play the groove" when nothing is sounding, "■ Stop" while it is. A lone
  glyph on a full-width accent bar reads as an unfinished button.
- **R4b** — While the groove is sounding, the glyph and the text swap and
  nothing else about the control changes. Its colour, size and position are the
  same in both states — the progress track directly above it is already the
  page's playing indicator, and a second one would be redundant.
- **R5** — The control's accessible name states the action the press will
  perform, never the state it is in: "Play the loop" when nothing is sounding,
  "Stop the loop" while it is.
- **R6** — A press while the groove is sounding stops playback and returns it to
  the top of the loop. The next press starts from the beginning, not from where
  the previous press left off. The control no longer pauses.
- **R6a** — Stopping returns the progress track to the start, since there is no
  longer a held position for it to show.
- **R7** — The playback-failure alert and its Retry control are unchanged, and
  still appear above the cards.

## Behaviour details

The control is one button with two sizes, not two components. The size variant
is defined so a third, smaller size can be added without reshaping the prop —
Epic 5 needs it for the archive cards, and introducing a second component there
would put the same behaviour in two places.

**Stop, not pause.** The control has always carried a ■ glyph and now carries
the word "Stop"; the transport underneath used to pause, holding position so the
next press resumed mid-bar. The behaviour moves to match the word rather than
the other way round. On a four-bar loop this is also the more useful of the two:
resuming three beats into bar three is rarely what a player wants, and starting
the phrase again is.

Concretely, the transport's pause path is replaced by a stop path that halts
playback and resets position to zero. `loop: true` is untouched — a groove left
running still repeats until it is stopped.

## Acceptance criteria

- **AC1** (R1) — Given the groove card renders, when the play control is
  inspected, then it carries the full-width geometry class set, matching the
  solve button's.
- **AC2** (R2, R3) — Given the design-system control is rendered with each size
  variant in turn, then each renders its own geometry, and the circular variant
  is byte-for-byte what it was before this epic.
- **AC3** (R4) — Given the groove card renders, then the caption appears after
  the control in document order, not within the same row.
- **AC3a** (R4a) — Given nothing is sounding, then the control renders the text
  "Play the groove" beside a ▶ glyph; given the groove is sounding, then it
  renders "Stop" beside a ■ glyph.
- **AC3b** (R4b) — Given the control is captured in both states, then the two
  differ only in glyph and text — the same geometry classes and the same tone
  class in each.
- **AC4** (R5) — Given nothing is sounding, then the control's accessible name
  is "Play the loop"; given the groove is sounding, then it is "Stop the loop".
- **AC5** (R6) — Given the groove is playing partway through the loop, when the
  control is pressed, then playback stops; when pressed again, then it starts
  from the beginning of the loop, not from where it stopped.
- **AC5a** (R6a) — Given the groove is playing partway through, when the control
  is pressed, then the progress track reads the start position.
- **AC6** (R6) — Given the groove is left playing, when it reaches the end of
  the loop, then it repeats — stopping is a press, never something the loop does
  on its own.

## Dependencies

Depends on nothing. Hands two things to Epic 5: the play control's size prop,
with a small variant available for the archive mini cards, and a transport whose
stop semantics Epic 5's exclusivity rule builds on — one groove stops so another
can start, and "stops" now means back to the top.

Epic 5 inherits `GroovePuzzle` and the transport from this epic; both edit them,
so Epic 5 follows this one rather than running beside it. This epic now also
owns `lib/audio.ts`, which no other Wave 1 epic touches, so the wave stays
parallel.

## Assumptions

- The order within the groove card is: name, progress panel, play control,
  caption. The control sits below the progress it drives.
- Existing playback tests that assert pause-and-resume are rewritten to assert
  stop-and-restart. They encoded the old requirement, so they change with it.
- The full-width control keeps the accent colour it has today, in both states.
- The caption's wording is unchanged.
- The size prop's naming (`size`, `variant`, values) is an implementation call
  and does not need settling here.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only.

### Cycle 1 — 2026-08-30

**Q1. What does the full-width control show?**
Answer: **A) Glyph and text — "▶ Play the groove" / "■ Stop"** — the solve
button it now matches leads with words, and at full width a lone glyph reads as
unfinished. The option was amended when answered: the sounding-state word is
"Stop", not the drafted "Pause".
Applied to: R4a, AC3a, Behaviour details, and Q3 below

**Q2. Does the control look different while the groove is playing?**
Answer: **A) Glyph and label swap, colour unchanged** — the progress track above
it already indicates playing, so a second indicator is redundant.
Applied to: R4b, AC3b, Assumptions

### Cycle 2 — 2026-08-30

**Q3. Does the behaviour follow the word "Stop"?**
Answer: **A) The behaviour follows the word** — pressing stops playback and
resets to the top, and the next press starts from bar 1. It is the only option
where the word, the ■ glyph and the behaviour agree, and on a four-bar loop
restarting the phrase beats resuming mid-bar.
Applied to: Summary, Scope, Out of scope, R5, R6, R6a, Behaviour details, AC4,
AC5, AC5a, AC6, Dependencies, Assumptions
