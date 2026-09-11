# 0021. The ear aids play one sound, and there is no instrument on screen

- **Status:** ✅ Accepted
- **Date:** 2026-08-31
- **Source:** [feature-10](../../specs/features/feature-10/briefing.md) · [feature-16](../../specs/features/feature-16/briefing.md) · [feature-23](../../specs/features/feature-23/briefing.md)

## Context

"Find the note that feels like home" with no instrument in reach is a lottery.
The fix could be a picture — a fretboard, a keyboard, a note-name chart — or a
sound.

## Decision

Tapping a root sounds that note against the running groove. Tapping a mode plays
a short lick in it from the day's root, in time with the loop. One sound at a
time. No fretboard, no keyboard, no tuner, no on-screen instrument anywhere in
the app, reveal included.

## Consequences

- Finding the scale by ear stays the exercise. A picture would answer the
  question the app is asking.
- The aids sound *against* the loop, so the audio graph has to schedule notes
  on the groove's clock — three sound paths, and the hooks that drive them.
- The lick needed more range than the twelve-note pack the comp ships, which is
  what pulled `src/lib/theory/phrase.ts` into existence.
- Both aids are behind a stored switch and at a lower level than the groove,
  because the first cut was too loud.
- Declined again in feature-15 (no instrument view in the reveal) and
  feature-23 ("no fretboard or keyboard picture; the register above the comp
  stays Sam's").
