# 0029. A confirmed root or mode locks for the day

- **Status:** ✅ Accepted
- **Date:** 2026-09-02
- **Source:** [feature-17](../../specs/features/feature-17/briefing.md)

## Context

A player who gets the root right and the mode wrong had no record of it. The
feedback line said "keep the root and try another flavour" and the row still
offered all twelve.

## Decision

When **Check** confirms a root or a mode, every other option in that row goes
`unavailable` and the answer is locked. The lock is permanent for the day and
survives every later wrong guess. Only Check locks — a selection, or a chip
tapped to hear it, locks nothing.

## Consequences

- The row shows what the player found; the old nudge said what they hadn't.
  Hiding the root and locking a right one are not in conflict, and
  feature-17's briefing says so in writing so nobody "resolves" it.
- The feedback line got shorter: instructing what the row already shows said it
  twice.
- No checkmark glyph. The row collapsing to one live chip is clear enough.
- No design-system change was needed — per-option state already existed for the
  ruled-out row, and locking is that same `unavailable` state applied to
  everything that is not the answer.
- In Simple mode the Major/Minor row locks the same way, leaving one live
  family chip. That is most of the answer, and it was accepted as a different
  bargain from one of six modes.
