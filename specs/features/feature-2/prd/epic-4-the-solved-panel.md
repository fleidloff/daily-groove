# PRD — Epic 4: The solved panel

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md) · Design: [Daily Groove.dc.html](../Daily%20Groove%20webapp%20design/Daily%20Groove.dc.html)

## Summary

The payoff. Solving the day reveals a full-width deep-green panel: the answer set
large in Newsreader, a line beside it saying how many tries it took and where the
streak now stands, and columns showing the groove's chord changes and the notes
that live in its scale. It is the one moment where the app teaches rather than
tests.

## Problem

After Epic 2 a correct guess produces a plain confirmation, which wastes the
strongest element in the design and the only place the app tells the player
anything about the music they just identified. The groove's chord and progression
are already in the data and currently go unseen by anyone.

## Scope

- An inverted panel surface and the chip treatment used on it.
- The answer line and the tries/streak meta line.
- The columns of musical detail, fed from existing groove data.
- Deleting the orphaned `ResultReveal`.

**Out of scope**
- The "Try this" tips column — `Groove` carries no tips, and inventing advice for
  an arbitrary groove is deferred to a follow-up feature.
- Any missed or out-of-attempts variant — there is no lose state.
- The archive strip below the panel — Epic 5.
- Restoring the panel after a reload — Epic 5 owns persistence; within this epic
  the panel lives for the session.

## Requirements

- **R1** — When the day is solved, a full-width panel appears below the two cards,
  on the design's deep-green gradient.
- **R2** — The panel names the answer as root and flavour together, set in
  Newsreader at display size.
- **R3** — Beside the answer, a meta line states how many tries the solve took and
  the streak's new value. One try reads "one try", not "1 tries".
- **R4** — The panel shows the groove's chord changes, drawn from the existing
  `chord` and `progression` fields, as chips on the inverted surface.
- **R5** — The panel shows the notes of the day's scale, computed from the root and
  the flavour by interval arithmetic rather than stored per groove. The
  computation covers every flavour the seed set uses.
- **R6** — Chord and progression are revealed here only. They are never guessable
  and never shown before the day is solved.
- **R7** — The panel's columns collapse to a single column on narrow screens.
- **R8** — Text on the panel meets contrast requirements against the gradient, in
  both palettes.
- **R9** — The panel's appearance is announced to assistive technology as a
  result, not left as a silent visual change.
- **R10** — The inverted panel surface and the column layout are generic
  components in `src/components`, carrying no musical vocabulary.

## Behaviour details

The panel is the solved state of the day, not a dismissible dialog: once shown it
stays for the rest of the session, and the guessing card above it is locked by
Epic 2's R11.

`ResultReveal` is deleted in this epic. It is exported from the feature's public
surface but used by nothing, and hardcodes "The scale was", which the root-plus-
flavour model makes meaningless.

The scale notes come from a semitone-interval table keyed by flavour, applied to
the root's chromatic index. G Dorian yields G A B♭ C D E F. This is a pure
function in `lib/`, testable without rendering, and it needs no new seed data.

## Acceptance criteria

- **AC1** (R1, R2) — Given the answer is G Dorian, when the player solves the day,
  then a panel appears naming "G Dorian".
- **AC2** (R3) — Given the player solved on the first guess, when the panel
  renders, then the meta line reads "one try".
- **AC3** (R3) — Given the player solved on the third guess, when the panel
  renders, then the meta line says three tries and shows the streak's new value.
- **AC4** (R4) — Given a groove with a chord and a progression, when the panel
  renders, then both are shown as chips.
- **AC5** (R5) — Given the answer is G Dorian, when the notes are computed, then
  they are G, A, B♭, C, D, E, F.
- **AC6** (R5) — Given every flavour in the seed set, when the notes are computed
  for each, then a full scale comes back for all of them with no gaps.
- **AC7** (R6) — Given the day is unsolved, when the guessing card renders, then
  neither the chord nor the progression appears anywhere on the page.
- **AC8** (R7) — Given a 375px viewport, when the panel renders, then its columns
  are stacked and nothing overflows.
- **AC9** (R8, R9) — Given a screen reader, when the day is solved, then the result
  is announced; and in both palettes the panel's text meets contrast against the
  gradient.
- **AC10** (R10) — Given the repository, when the panel primitives are inspected,
  then they take content as props and contain no reference to roots, flavours or
  grooves.

## Dependencies

Needs Epic 2's domain contract: the answer, the solved flag, and the attempt count
that feeds "solved in N tries". Needs the streak value already computed by
feature-1's `computeStreak`. Needs Epic 1's tokens for the gradient and inverted
text tints.

Hands the panel surface and column primitives to Epic 5, which reuses neither but
shares the token layer.

## Assumptions

- The panel renders below both cards, spanning the full grid width, as the canvas
  places it.
- The streak shown is the value after today's solve is counted.
- With the tips column out of scope the panel carries two columns rather than
  three; the grid rebalances to share the width evenly rather than leaving a gap.
- The panel does not animate in beyond whatever the design system's default
  transition provides.
- Note spelling follows the flavour's conventional accidental — flats for Dorian,
  Minor, Mixolydian and Phrygian, sharps for Lydian — rather than a single
  chromatic spelling applied everywhere.

## Question log

### Cycle 1 — 2026-08-29

**Q1. Where do the "Notes to live in" come from?**
Answer: **A) Compute them from root and flavour with an interval table** — a pure
function over data the app already holds, needing no seed changes, and it is the
column that makes the panel teach rather than restate the answer.
Applied to: R5, AC5, AC6, Behaviour details, Assumptions
