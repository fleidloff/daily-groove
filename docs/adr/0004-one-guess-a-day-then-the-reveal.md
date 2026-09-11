# 0004. One guess a day, then the reveal

- **Status:** ⛔ Superseded by [0034 — Attempts are unlimited; a solve is a solve](0034-attempts-are-unlimited.md)
- **Date:** 2026-08-21
- **Source:** [feature-1, epic 1 Q2](../../specs/features/feature-1/prd/)

## Context

Wordle's tension comes from a bounded number of guesses. The first cut of the
game copied it.

## Decision

One guess per attribute per day, then the answer is shown.

## Consequences

- The score was the day's currency, so the solved panel was a scoreboard.
- Three attempt dots and a give-up button grew on top of it in feature-7, and
  the wording of every hint referred to attempts remaining.
- Withdrawn in feature-19: a bounded guess count punishes the player who is
  working it out by ear, which is the behaviour the app is trying to reward.
