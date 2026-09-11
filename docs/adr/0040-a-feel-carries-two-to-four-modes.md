# 0040. A feel carries two to four modes, and the sets may overlap

- **Status:** ✅ Accepted — supersedes [0010 — A feel carries exactly two modes](0010-a-feel-carries-exactly-two-modes.md)
- **Date:** 2026-09-05
- **Source:** [feature-25](../../specs/features/feature-25/briefing.md)

## Context

Adding five styles — bossa nova, son montuno, reggae one-drop, second line,
boom-bap — could not be done under
[0010 — A feel carries exactly two modes](0010-a-feel-carries-exactly-two-modes.md): nine feels times two disjoint modes
does not fit twelve, and forcing it would have meant assigning modes to styles
nobody plays them in.

## Decision

Each style owns two to four modes, and the sets may overlap. A feel is still a
clue to the mode, just a weaker one. What stays: every mode the game offers has
grooves behind it, and no groove answers to a mode the game does not offer.

## Consequences

- The three tests and the sentence in `docs/music.md` that stated the old rule
  changed with it.
- Existing templates kept their `flavours` lists exactly as they were.
  Reordering or removing an entry re-renders that template's grooves and
  reassigns past puzzles; appending re-rolls too, so a `flavours` line freezes
  at that feel's first mint ([0020 — Only a groove's identity is frozen; its audio may always re-render](0020-only-identity-is-frozen.md)).
- A style that still identifies its mode is now a bug rather than the design —
  which is what quick-18 found in `open-ballad`, four of whose five grooves were
  the one mode no other style carried.
