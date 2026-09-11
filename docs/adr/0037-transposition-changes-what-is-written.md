# 0037. Transposition changes what is written, never what is heard

- **Status:** ✅ Accepted
- **Date:** 2026-09-04
- **Source:** [feature-23](../../specs/features/feature-23/briefing.md)

## Context

The persona plays guitar and alto sax. On alto, everything is read a major sixth
up from concert pitch, so a concert E♭ groove is a written C. A reveal in concert
pitch is unusable to that player without doing the transposition in their head
every day.

## Decision

A pill in the header cycles Concert → E♭ alto sax → B♭ tenor & trumpet, stored
as a preference. The chosen instrument's written pitch runs through the *whole*
puzzle: the chips, the check, the hints, the heading, the lead-sheet chords, the
staff notes and its label, and the transport panel's chord line. The audio and
the share link stay in concert pitch.

## Consequences

- On E♭, tapping the C chip plays what an alto sounds when it fingers C — a
  concert E♭ — so the chip and the sound agree. Sound is sound; the setting
  changes spelling.
- A share link opens the same groove for anyone, whatever either player has the
  pill set to.
- The guess boxes look identical in every setting. Only what the chips mean
  changes, which is why the pill has to read the instrument rather than a state.
- `transpose` from `src/lib/theory/` reaches into persistence, the session
  context and three coaching modules — the widest single arrow the module map
  draws.
- Still no fretboard or keyboard picture, per
  [0021 — The ear aids play one sound, and there is no instrument on screen](0021-the-ear-aids-play-one-sound.md).
