# PRD — Epic 1: Date, title and streak in the top row; noise out of the cards

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Rearranges the page's fixed furniture and deletes what doesn't earn its place.
The top row becomes *date · Daily Groove · "N days streak"*; the groove card
loses its BPM readout; the player loses its four bar labels; the attempt dots
move off the "What is it?" heading and onto the check button. No behaviour
changes — every value shown is one the page already had.

## Problem

The page currently spends its most valuable real estate on things that tell the
player nothing. The top-left says `daily-groove`, which the `<h1>` beneath it
already says. The groove card leads with a BPM number that drives nothing — not
playback, not the progress bar. The player labels four bars that the segmented
progress track already delineates. And the three attempt dots sit in the
guessing card's heading, far from the button they describe, where they read as a
hamburger menu rather than as progress.

## Scope

- The page header: what sits left, centre and right of the top row.
- The streak badge's wording.
- Removing the BPM readout from the groove card.
- Removing the bar labels from the transport panel.
- Moving the attempt dots to the check button.

**Out of scope**
- The size, shape and position of the play button — Epic 2.
- The streak *number* being wrong the morning after a solve — Epic 3. This epic
  changes only how the streak is worded and where it sits.
- Any change to `AttemptDots` itself, or to how dot states are derived.
- Removing `bpm` from the `Groove` type or the seed data. It stops being
  rendered; it stays in the record.

## Requirements

- **R1** — The page header's top row carries the date on the left, and the
  current streak on the right. The `daily-groove` wordmark and the small accent
  dot beside it are removed, as is the vertical divider that separated the date
  from the streak.
- **R1a** — The date renders as a single line: the weekday, a comma, then the
  day and month — "Saturday, 29 August". It is not the two-line weekday-over-date
  stack the header uses today.
- **R2** — The page's `<h1>` reads "Daily Groove".
- **R3** — The streak badge reads `"N days streak"` for a streak of one or more,
  pluralised correctly at one ("1 day streak").
- **R4** — With no streak, the badge reads "No streak yet" rather than "0 days
  streak".
- **R5** — The groove card header shows the groove's name alone. The BPM number
  and its `BPM` label are not rendered.
- **R6** — The transport panel shows the segmented progress track alone, still
  inside its inset card. The `BAR 1`–`BAR 4` labels are not rendered. The inset
  stays: with the labels gone it is what separates the loop position from the
  controls beneath it.
- **R7** — The attempt dots sit directly above the check button, right-aligned
  to it, inside the guessing card. They no longer sit beside the "What is it?"
  heading.
- **R7a** — That row holds the dots alone. No counter text, label or heading
  accompanies them — the button they sit on is what gives them their meaning.
- **R8** — The dots keep their existing accessible name ("N of 3 attempts
  spent" / "Solved"), so the move costs a screen-reader user nothing.
- **R9** — Every value shown in the header is passed in as a prop. No component
  in this epic reads the clock or the result store itself.

## Behaviour details

The header's date is the same day that selects the groove and seeds the flavour
options — the viewer's local calendar day, resolved once per session and passed
down. Its position and its formatting change; the value and its derivation do
not.

The single line keeps the existing en-GB pin, so the wording reads "Saturday,
29 August" rather than reordering to a US or numeric form for a viewer in
another locale. The *day* is still the viewer's own calendar day; only how it is
worded is fixed.

## Acceptance criteria

- **AC1** (R1) — Given the page is loaded, when the header renders, then the
  date appears in the top row and no `daily-groove` text appears anywhere on the
  page.
- **AC1a** (R1a) — Given the day is 2026-08-29, when the header renders, then it
  contains the single string "Saturday, 29 August", and the weekday does not
  appear as its own separate element.
- **AC2** (R2) — Given the page is loaded, then its level-1 heading is "Daily
  Groove" and the string "Today's groove" appears nowhere.
- **AC3** (R3) — Given a streak of 3, when the header renders, then the badge
  reads "3 days streak"; given a streak of 1, it reads "1 day streak".
- **AC4** (R4) — Given a streak of 0, when the header renders, then the badge
  reads "No streak yet".
- **AC5** (R5) — Given a groove with a bpm of 96, when the groove card renders,
  then "96" and "BPM" appear nowhere in it, and the groove's name does.
- **AC6** (R6) — Given the transport panel renders at any position, then no text
  matching `BAR` appears in it, and the progress track is still present within
  its inset card.
- **AC7** (R7, R7a) — Given the guessing card renders, then the attempt dots
  appear between the flavour chips and the check button, not within the heading
  row, and no text label renders alongside them.
- **AC8** (R8) — Given two attempts have been spent, when the dots render, then
  their accessible name is "2 of 3 attempts spent".

## Dependencies

Nothing must exist first. This epic hands two frozen contracts to its
neighbours:

- `StreakBadge` keeps its `{ streak: number }` prop. Epic 3 changes what that
  number *is* and touches nothing in this epic.
- `GrooveCard` keeps accepting `children` for the transport region, which is
  where Epic 2 re-lays-out the play control.

## Assumptions

- The `Groove` type keeps its `bpm` field, and the generator keeps writing it.
- The "Grooves you've played" section label and the archive strip below are
  untouched here.
- Removing the wordmark does not need a replacement brand mark elsewhere on the
  page; the `<h1>` carries the name.
- On a narrow viewport the top row stacks as it does today, date above streak.
- The date keeps its existing en-GB formatting pin.
- The existing tests that assert "Today's groove", the wordmark, the bpm and the
  bar labels are re-pointed at the new expectations rather than deleted — each
  one is a requirement that changed, not one that went away.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only.

### Cycle 1 — 2026-08-30

**Q1. How does the date read in the top-left?**
Answer: **B) One line — "Saturday, 29 August"** — the two-line stack was a
right-hand-cluster treatment; on the left of the top row a single line reads as
a date rather than as a label with a value under it.
Applied to: R1a, Behaviour details, AC1a, Assumptions

**Q2. What exactly does "on top right of the solve-button" mean?**
Answer: **A) A right-aligned row immediately above the button, dots only** —
closest reading of the briefing, and it leaves the button's own geometry
untouched.
Applied to: R7, R7a, AC7

**Q3. Once the bar labels go, does the transport panel still earn its inset
card?**
Answer: **A) Keep the inset card as it is** — this epic is scoped to removals,
and the inset is what separates loop position from the controls below it.
Applied to: R6, AC6
