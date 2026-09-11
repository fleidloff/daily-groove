# 0015. Simple mode is fewer names, not an easier puzzle

- **Status:** ✅ Accepted
- **Date:** 2026-08-30
- **Source:** [feature-7](../../specs/features/feature-7/briefing.md)

## Context

Twelve roots and a row of mode names is a wall for anyone who is not already a
player. The obvious fix is a difficulty level, which means a second puzzle.

## Decision

A switch on the card reduces the *options*, never the puzzle: six roots instead
of twelve, and Major or Minor instead of the named modes. Same groove, same
solve, same reveal.

## Consequences

- One groove a day for everyone, and a shared answer, so
  [0003 — The day's groove is a function of the date](0003-the-days-groove-is-a-function-of-the-date.md) survives intact.
- The choice is a stored preference, which is what let feature-22 make it the
  default for a first-time player
  ([0036 — A first-time player starts in Simple mode](0036-a-first-time-player-starts-in-simple-mode.md)).
- Simple mode's Major/Minor row leaves one live chip once the family is
  confirmed, which is most of the answer. feature-17 looked at that and
  accepted it.
- "Mode" now names two sizes of thing — the Major/Minor family and the six
  named modes — and quick-19 had to spend a ticket saying which is which.

## Alternatives considered

- **A third difficulty level** — ruled out in feature-22, which also ruled out
  ever changing the puzzle behind the switch.
