# 0043. The mode row offers six names and never narrows itself

- **Status:** ✅ Accepted
- **Date:** 2026-09-05
- **Source:** [quick-6](../../specs/quick/6-six-mode-options.md) · [quick-19](../../specs/quick/19-say-how-many-modes-the-hard-mode-has.md)

## Context

The guess card offered four mode chips out of twelve modes. Four names is a
narrow enough field that the mode is close to a coin flip once the root is in.

## Decision

Six mode chips, one of them correct, laid out as two rows of three on a wide
screen and three rows of two on a narrow one. Simple mode's Major/Minor row is
untouched. The hint narrows roots only — the mode row never narrows itself, and
a mode leaves only when the player has personally guessed it wrong.

## Consequences

- The six names sit there cold, which is what makes the mode licks
  ([0021 — The ear aids play one sound, and there is no instrument on screen](0021-the-ear-aids-play-one-sound.md)) the way through rather than
  elimination.
- Narrowing roots and not modes is a deliberate asymmetry in
  [0028 — The hint narrows; only solving or giving up reveals](0028-the-hint-narrows-only-the-reveal-reveals.md), not an omission.
- The count now appears in copy as well as on the card, and the two drifted
  apart immediately — the caption said four while six chips were on screen.
  quick-19 fixed it and added a test that fails if the number in the copy and
  the number of chips ever disagree again.
