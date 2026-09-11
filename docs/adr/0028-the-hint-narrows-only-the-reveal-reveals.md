# 0028. The hint narrows; only solving or giving up reveals

- **Status:** ✅ Accepted — supersedes [0017 — The nudge hands the root over after two misses](0017-the-nudge-hands-the-root-over.md)
- **Date:** 2026-09-02
- **Source:** [feature-17](../../specs/features/feature-17/briefing.md)

## Context

[0017 — The nudge hands the root over after two misses](0017-the-nudge-hands-the-root-over.md) named the root after two misses, which
turned the rest of the day into reading. `docs/persona.md` had promised the
opposite all along: "nudges narrow the options, and giving up reveals the
answer".

## Decision

The root is never handed over. After two misses the hint takes wrong roots off
the row instead, so there is still help and it still rewards listening. The
answer appears only on a solve or on giving up, which is offered from three
misses and stays.

## Consequences

- The day stays resolvable either way, so removing the reveal costs nothing in
  reachability — the dots mark par, not lives, which is the reading
  [0034 — Attempts are unlimited; a solve is a solve](0034-attempts-are-unlimited.md) then made explicit.
- Grinding is legible: pin the root by brute force, then cycle the modes.
  Accepted, because the feedback line already allowed it and narrowing is what
  makes listening the faster route.
- Options already checked and wrong are dimmed as spent, so the same pair is
  not guessed twice. No "X" glyph — dimming says it.
- The hint box only renders when it has content, is labelled "Hint", and
  disappears on a solve or a give-up, because the solved panel is what explains
  what happened.
- The modes never narrow, only roots — see
  [0043 — The mode row offers six names and never narrows itself](0043-the-mode-row-offers-six-names.md).
