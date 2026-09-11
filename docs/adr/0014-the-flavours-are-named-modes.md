# 0014. The flavours are named modes

- **Status:** ✅ Accepted
- **Date:** 2026-08-30
- **Source:** [feature-7](../../specs/features/feature-7/briefing.md)

## Context

The guess card offered invented "flavour" words. Nobody could say what they
meant, and they mapped onto nothing a player could look up or practise.

## Decision

The vocabulary is the modes as musicians name them — ionian, dorian, mixolydian
and the rest, twelve in all, listed in `FLAVOURS`.

## Consequences

- What the player learns transfers off the app, which is the premise the reveal
  later built on ([0027 — The reveal teaches in degrees, on one screen](0027-the-reveal-teaches-in-degrees.md)).
- `FLAVOURS` becomes the app's declared vocabulary and is append-only: its
  order is frozen, because every derived table and twelve-ness test is graded
  against it ([0020 — Only a groove's identity is frozen; its audio may always re-render](0020-only-identity-is-frozen.md)).
- Four unfamiliar words with no way to hear them apart is a reading exercise,
  which is the gap [0021 — The ear aids play one sound, and there is no instrument on screen](0021-the-ear-aids-play-one-sound.md) and Simple mode
  ([0015 — Simple mode is fewer names, not an easier puzzle](0015-simple-mode-is-fewer-names.md)) had to close.
- The internal slug stayed `flavour` long after the player-facing word became
  "mode", so the codebase carries both.
