# 0052. A groove is not built from a named song

- **Status:** 🚫 Rejected — replaces [0045 — A song becomes a groove inside the existing styles](0045-a-song-becomes-a-groove-inside-the-existing-styles.md)
- **Date:** 2026-09-11
- **Source:** [feature-26](../../specs/features/feature-26/), built as an experiment and reverted

## Context

[0045 — A song becomes a groove inside the existing styles](0045-a-song-becomes-a-groove-inside-the-existing-styles.md)
proposed a skill that takes a song, picks the style that suits it, finds four
chords that resemble its changes, and mints a groove. `specs/features/feature-26/`
specs it in full.

The obstacle was always assumed to be the harmony: a groove's chords fall out of
its seed through `MUSIC_LABEL`'s frozen draw, so the generator can be aimed but
not instructed.

## What was tried

The harmony obstacle was removed. A catalogue entry declared its four chords
outright, and a second constructor beside `buildHarmony` snapped each one to the
nearest chord the answer's scale holds. It consumed no randomness and added no
draw, so nothing committed moved and the catalogue re-rendered byte-identically.

**It worked.** Three songs were rendered and listened to:

| Song | Best feel available | What came out |
| :-- | :-- | :-- |
| Summertime | `shuffle`, 78 bpm | The closest. All four roots exact, the bass line intact; the V lost its leading tone, so bar 4 stopped pulling home. |
| Beat It | `boom-bap`, 92 bpm | Unrecognisable. The chords were *perfect* — 4/4 roots, 4/4 thirds — and the record is a riff at 139 the generator has no mechanism for. |
| Chan Chan | `shuffle`, 78 bpm | Recognisable and wrong. The changes carry this tune and came through; the only feel holding the mode at that tempo swings at 0.64, and son is straight. A blues shuffle that borrowed the chart. |

## Decision

**Do not build it.** Naming a song does not get you that song, because the
chords were never the hard part.

What identifies a record is its feel — subdivision, kit, percussion, tempo band.
The app has nine, so a named song lands on whichever happens to carry its mode
near its tempo, which is a choice among two or three, and the result wears the
name of a record it does not sound like.

**A groove by name only makes sense if you build a style for every song you
name.** That is the real cost, and it is not one feature.

## Consequences

- The experiment's code is reverted. What survives is this record and the row in
  [specs/features.md](../../specs/features.md).
- `specs/features/feature-26/` stays on disk at ⏸ Parked. Its epics are a fair
  description of the work; the premise underneath them is what failed.
- **The reveal would have claimed more than it could keep.** The line was to read
  "Built on the changes of X" without qualification. On two of three songs that
  claim would have been false in a way a player who knows the tune would hear and
  could not name.

## Two findings worth keeping

**Son montuno is small, and most of it exists.** The claves and the cowbell are
already in `scripts/grooves/samples/pack.json`, levelled, and named by **no
template at all**. `bossa-nova` already carries a whole clave as a fixed
`figures` entry on its rim and already ships straight at swing 0.01. The one
genuinely new piece is a third `BassType` beside `normal` and `walking-bass`: a
tumbao leaves the downbeat open, and both current bass paths state it
unconditionally. A new template re-renders nothing. **This is the work that
would make a Chan Chan worth attempting** — a style first, then maybe a song.

**Minor-key tunes lose their V, systematically.** Summertime's `E7` and Chan
Chan's `A7` both flattened to `Em7` and `Am7` for one reason: a minor-key tune
with a dominant V is in none of the twelve modes. Real minor-key music mixes
natural, harmonic and melodic minor; a mode is a fixed seven notes. Harmonic
minor is nominally the answer and is not — `chordsForScale` derives its tonic as
`mMaj7` and its ♭III as `maj7♯5`, chords no tune plays. Making it exact would
stop the answer being a mode and start it being a key, which collides with the
twelve-ness in [music.md](../music.md) and changes what the game *asks*.

## What is not rejected

The half of feature-26 that never depended on any of this: an entry in
`scripts/grooves/heard-in.json` keyed by **groove uuid** rather than by scale, so
one groove can name a tune its own four chords already resemble. It needs no
minting, no new style and no ear — a person reads the catalogue's progressions
and pins the ones they can name. It is the cheapest part of the feature and the
only one that changes what a player reads tomorrow morning.
