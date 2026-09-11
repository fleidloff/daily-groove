# 0022. Tapping a chip to hear it is never a guess

- **Status:** ✅ Accepted
- **Date:** 2026-08-31
- **Source:** [feature-10](../../specs/features/feature-10/briefing.md) · [feature-16](../../specs/features/feature-16/briefing.md)

## Context

The root chips already selected a guess. Giving them a second job — sounding the
note — risks either a second control to find or an accidental attempt.

## Decision

The same tap that sounds a chip also selects it, and neither costs anything.
Nothing is scored, no attempt is spent, and nothing locks until **Check** is
pressed.

## Consequences

- No new control and no new affordance to learn: the chip row is the instrument.
- Exploration is free, which is what makes the mode licks usable at all —
  cycling six modes to hear them apart would otherwise end the day.
- The ♪ glyph stays on every chip, ruled-out and locked-out ones included,
  because a chip that is out of play still sounds. That is what kept
  feature-17's locking from needing a glyph decision.
- The locking in [0029 — A confirmed root or mode locks for the day](0029-a-confirmed-answer-locks-for-the-day.md) is triggered by
  Check alone, never by a selection or a tap.
