# 0036. A first-time player starts in Simple mode

- **Status:** ✅ Accepted
- **Date:** 2026-09-03
- **Source:** [feature-22](../../specs/features/feature-22/briefing.md)

## Context

A new player met twelve roots and four names like "Phrygian dominant" and closed
the tab. Simple mode existed ([0015 — Simple mode is fewer names, not an easier puzzle](0015-simple-mode-is-fewer-names.md)) but was off
by default, so the wall was the first thing anyone saw.

## Decision

With no stored preference, the app starts in Simple mode — six roots, Major or
Minor. The switch stays on the card, so the full set is one tap away. The choice
is remembered the moment the switch is touched and never overridden after that.
The switch says what it changes rather than just "Simple mode", and the
how-to-play box names both ways to play.

## Consequences

- Nothing changes for a player who already has a preference stored.
- The default is a first-run decision, not a difficulty system: no third level,
  and the puzzle behind the switch is identical.
- The caption under the switch now has to state the real option counts, which is
  the contradiction quick-19 was opened to fix.
