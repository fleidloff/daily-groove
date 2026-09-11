# 0038. The reveal names a track you have heard the mode in

- **Status:** ✅ Accepted
- **Date:** 2026-09-04
- **Source:** [quick-1](../../specs/quick/1-where-youve-heard-it.md)

## Context

The solved panel explains the mode in theory terms
([0027 — The reveal teaches in degrees, on one screen](0027-the-reveal-teaches-in-degrees.md)). A name to hang it on — a track the
player already knows — is worth more than another sentence of theory.

## Decision

One line in the solved box names a well-known track for the mode and root. Text
only: no links, no playback, no artwork. The line is keyed to the mode and root,
not the groove, so every groove in that mode shows the same one. It is optional —
a mode with no reference renders nothing, no empty label and no dash. The
references live in the generated manifest.

## Consequences

- The same line reads identically before and after the reveal, and on a shared
  groove opened on another day.
- Keying by root and mode means 144 possible slots and no per-groove character,
  which is the limit feature-26 then widened by letting `heard-in.json` key an
  entry by groove uuid.
- Finding a genuinely well-known track for twelve modes in twelve roots is
  editorial work with no automated source. The catalogue ships the ones that
  were found.
