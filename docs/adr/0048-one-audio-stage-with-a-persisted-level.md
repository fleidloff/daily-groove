# 0048. One audio stage with a persisted master level

- **Status:** 🤔 Proposed
- **Date:** 2026-09-08
- **Source:** [quick-13](../../specs/quick/13-change-the-groove-volume.md)

## Context

The three sound paths — the groove loop, the reference note and the mode lick —
each connect straight to `ctx.destination`. There is no shared stage to hang a
volume on, so "how loud the app plays" is not a thing the app has.

## Decision

The three paths meet at one gain node, and a slider sets it. The level covers
every sound, survives a reload in `localStorage`, and *scales* the fixed
per-sound levels in `lib/audio/level.ts` rather than replacing them — the
reference note and the lick keep the relative balance
[0021 — The ear aids play one sound, and there is no instrument on screen](0021-the-ear-aids-play-one-sound.md) gave them.

## Consequences

- The audio module gets a bus, which is the first piece of shared audio state
  since the shared player was deleted in
  [0013 — The page ends at the puzzle](0013-the-page-ends-at-the-puzzle.md).
- At the lowest setting nothing is audible and the loop keeps running rather
  than stopping, so the transport and the level stay separate concepts.
- Parked, not built. The row reads ⏸ Parked.
