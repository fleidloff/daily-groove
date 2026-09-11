# 0034. Attempts are unlimited; a solve is a solve

- **Status:** ✅ Accepted — supersedes [0004 — One guess a day, then the reveal](0004-one-guess-a-day-then-the-reveal.md)
- **Date:** 2026-09-03
- **Source:** [feature-19](../../specs/features/feature-19/briefing.md)

## Context

The three attempt dots had been a scoreboard, a tooltip explaining that the
tries were actually unlimited, and a phrase in half the copy in the app. They
measured something the game did not enforce.

## Decision

The dots are removed. A puzzle counts as solved when it is solved, however many
tries it took. Only giving up, or not attempting a day at all, resets the
streak. Attempts keep being written to `localStorage` in case they feed stats
later.

## Consequences

- The streak measures showing up and finishing, which is the behaviour the app
  wants, rather than getting it right first time.
- Every hint and caption that referred to attempts had to be reworded, and the
  feature spent most of its scope there.
- Nothing renders the stored attempt counts, so they are data with no reader —
  deliberately.
- The narrowing in [0028 — The hint narrows; only solving or giving up reveals](0028-the-hint-narrows-only-the-reveal-reveals.md) is what
  keeps unlimited attempts from making the day trivial: help arrives on a miss
  count that still exists internally.
