# 0017. The nudge hands the root over after two misses

- **Status:** ⛔ Superseded by [0028 — The hint narrows; only solving or giving up reveals](0028-the-hint-narrows-only-the-reveal-reveals.md)
- **Date:** 2026-08-30
- **Source:** [feature-7](../../specs/features/feature-7/briefing.md)

## Context

With [0002 — The answer is an absolute root and mode](0002-the-answer-is-an-absolute-root-and-mode.md) in force and no instrument
in reach, the first two attempts were spent guessing a pitch. Handing the root
over after two misses made the day finishable.

## Decision

After the second miss the nudge names the root, and the card auto-selects it.

## Consequences

- The day became winnable, and the puzzle became a reading exercise from the
  third attempt on.
- It contradicted `docs/persona.md`, which already promised that "nudges narrow
  the options, and giving up reveals the answer".
- Withdrawn in feature-17, which replaced the reveal with narrowing and moved
  the reveal to solving or giving up.
