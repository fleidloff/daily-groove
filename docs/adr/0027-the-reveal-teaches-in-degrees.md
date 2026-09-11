# 0027. The reveal teaches in degrees, on one screen

- **Status:** ✅ Accepted
- **Date:** 2026-09-01
- **Source:** [feature-15](../../specs/features/feature-15/briefing.md)

## Context

The solved box was a scoreboard — tries and streak — and it is the only part of
the day that could teach anything. The obvious expansion is a lesson: next
steps, a curriculum, a "learn more".

## Decision

The solved panel is the day's lesson and nothing more: the characteristic note
that makes it that mode, the scale numbered as degrees as well as named, the
changes read as degrees of the key beside the chord symbols, and how near the
guess came. One screen, read in twenty seconds. The score moves out, up beside
the attempt dots.

## Consequences

- Degrees transfer to an instrument and note names do not, which is the whole
  argument for numbering them — and it is why
  [0037 — Transposition changes what is written, never what is heard](0037-transposition-changes-what-is-written.md) had a spelling to re-spell.
- No lesson plan, no levels, no links. The app stays one thing a day, in step
  with [0013 — The page ends at the puzzle](0013-the-page-ends-at-the-puzzle.md).
- The panel is below both cards and goes unread while the loop plays at the
  top, which feature-18 answered by moving the coaching into the hint box
  instead of moving the panel.
- The near-miss line was later confined to a day given up on: on a solved day it
  read as a leftover from before the solve.
- `lib/presentation/` grew to eleven modules under this, which is what earned it
  a door ([0033 — Coaching has one door, and the card feeds itself](0033-coaching-has-one-door.md)).
