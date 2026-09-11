# 0045. A song becomes a groove inside the existing styles

- **Status:** 🚫 Rejected — see [0052 — A groove is not built from a named song](0052-a-groove-is-not-built-from-a-named-song.md)
- **Date:** 2026-09-06
- **Source:** [feature-26](../../specs/features/feature-26/briefing.md)

## Context

Naming a song — Summertime, say — and getting a groove that resembles it is the
most direct way to grow the catalogue. The obstacle is that the generator
derives harmony from the seed and `MUSIC_LABEL`'s draw order is frozen
([0020 — Only a groove's identity is frozen; its audio may always re-render](0020-only-identity-is-frozen.md)), so four named chords have to be reached
*inside* that draw or the whole catalogue re-renders and every past puzzle is
reassigned.

## Decision

A skill picks the best-fitting existing style for a song and the four chords
that resemble it, then mints the groove — creating no new style and staying
inside the boundaries already there. `heard-in.json` gains the option of keying
an entry by groove uuid; a groove with a uuid entry uses it, and every other
groove falls back to the root-and-mode lookup of
[0038 — The reveal names a track you have heard the mode in](0038-the-reveal-names-a-track-youve-heard-it-in.md).

## Consequences

- The constraint is what made this a feature rather than a quick ticket, and it
  is the whole design problem: search the seed space for a draw that lands the
  wanted chords, rather than setting them.
- A groove can carry a reference of its own, so the reveal can name the song it
  was modelled on instead of a generic one for the mode.
- Not built. Tried as an experiment on 2026-09-11 and rejected:
  [0052 — A groove is not built from a named song](0052-a-groove-is-not-built-from-a-named-song.md)
  records what three rendered songs sounded like and why the premise failed.
