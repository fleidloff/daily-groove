import type { Flavour } from '../../types'

/**
 * One note of a lick: a scale degree at a beat position.
 *
 * A lick is data, not audio. Twelve modes are twelve small entries here rather
 * than 144 rendered files, because the degrees resolve to pitches through the
 * day's root and the mode's own interval table (`phrase.ts`) and the beats
 * resolve to seconds through the day's tempo. A phrase that sounds wrong is a
 * one-line fix.
 */
export type LickNote = {
  /** Index into the mode's interval table. 0 is the root; 7 is the root an octave up. */
  degree: number
  /** Onset, in beats from the start of the phrase. */
  beat: number
  /** Sounding length, in beats. */
  beats: number
}

/**
 * The phrase each mode plays, one per flavour the catalogue can mint.
 *
 * Three rules govern every entry, and `licks.test.ts` holds each one:
 *
 * 1. **It leans on the interval that makes the mode.** The ♯4 for Lydian, the
 *    ♭2 for Phrygian, the natural 6 for Dorian, the augmented second between
 *    ♭6 and ♮7 for harmonic minor. None of the twelve is its scale in order —
 *    a run up a scale tells you the notes and not the sound.
 * 2. **The rhythm is its own.** Ionian is eight plain eighths, Lydian floats in
 *    dotted quarters, harmonic minor gallops, phrygian dominant is a Spanish
 *    sixteenth turn. The twelve are not one figure with the pitches swapped.
 * 3. **The pitches alone still separate them.** Disregard every rhythm and no
 *    two degree sequences are the same, so a player who learns to tell two
 *    modes apart has learned the mode and not the pattern.
 * 4. **A phrase fits its own scale and no other.** Take the pitch classes it
 *    sounds from the root and no other entry in `FLAVOUR_INTERVALS` — Locrian
 *    included — contains all of them. This is the rule that has actually caught
 *    bugs: a Dorian phrase that omitted its third was note-for-note a legal
 *    Mixolydian one, and Mixolydian can be the chip sitting next to it. Note
 *    that it can only be satisfied by *adding* a note, never by withholding
 *    one: dropping a pitch class can only widen the set of scales a phrase
 *    fits, which is why there is no rule about degrees a phrase must avoid.
 *
 * **Register.** Every degree is between 0 and the octave, because the phrase is
 * rooted at midi 60–71 and the render provides C4–B5: a degree above the octave
 * is a note with no file behind it. That is asserted in `phrase.test.ts`, from
 * all twelve roots, rather than assumed here.
 *
 * A phrase runs about a bar of 4/4 — the last note may ring a little over the
 * bar line, never further — so that tapping four modes in a row is a comparison
 * and not a wait.
 */
export const LICKS: Record<Flavour, LickNote[]> = {
  // Major third and major seventh, and the natural 4 that is the whole
  // difference from Lydian. Straight eighths: the plainest rhythm belongs to
  // the plainest mode, and it is the reading everything else is heard against.
  // The ♮6 on the way up to the octave is load-bearing rather than decorative:
  // without it the phrase is a legal harmonic major one, and with it no other
  // scale in the table holds all six pitches.
  Ionian: [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 2, beat: 0.5, beats: 0.5 },
    { degree: 4, beat: 1, beats: 0.5 },
    { degree: 5, beat: 1.5, beats: 0.5 },
    { degree: 7, beat: 2, beats: 0.5 },
    { degree: 6, beat: 2.5, beats: 0.5 },
    { degree: 3, beat: 3, beats: 0.5 },
    { degree: 2, beat: 3.5, beats: 1 },
  ],

  // The minor third leaping a **tritone** onto the natural sixth on the
  // downbeat of two, and the ♮6 again on three, over the fifth and the ♭7.
  // The tritone is the whole tell: Aeolian's ♭3 rises a perfect fourth to its
  // ♭6, in the same place in the bar, so the two modes differ by an interval a
  // player can hear and not by one substituted note. Syncopated, pushing off
  // the beat. Ends on the ♭3, which is what states the mode as minor when the
  // loop is stopped and there is no comp underneath.
  Dorian: [
    { degree: 0, beat: 0, beats: 0.75 },
    { degree: 2, beat: 0.75, beats: 0.25 },
    { degree: 5, beat: 1, beats: 0.75 },
    { degree: 4, beat: 1.75, beats: 0.25 },
    { degree: 6, beat: 2, beats: 0.5 },
    { degree: 5, beat: 2.5, beats: 0.75 },
    { degree: 3, beat: 3.25, beats: 0.25 },
    { degree: 2, beat: 3.5, beats: 1 },
  ],

  // Falls from the octave to the ♭2 and leans on it into the root — the
  // Andalusian descent, and the only one of the twelve that starts above the
  // root. Even steps down to a held fifth, then the two-note cadence.
  Phrygian: [
    { degree: 7, beat: 0, beats: 0.5 },
    { degree: 6, beat: 0.5, beats: 0.5 },
    { degree: 5, beat: 1, beats: 0.5 },
    { degree: 4, beat: 1.5, beats: 1 },
    { degree: 2, beat: 2.5, beats: 0.5 },
    { degree: 1, beat: 3, beats: 0.5 },
    { degree: 0, beat: 3.5, beats: 1 },
  ],

  // The ♯4, held longest of any note in the phrase and never resolved down to
  // the natural 4 — which is the note Ionian's phrase spends a beat on. Dotted
  // quarters, so the figure floats across the beat rather than marking it.
  Lydian: [
    { degree: 0, beat: 0, beats: 0.75 },
    { degree: 2, beat: 0.75, beats: 0.75 },
    { degree: 3, beat: 1.5, beats: 1 },
    { degree: 4, beat: 2.5, beats: 0.5 },
    { degree: 3, beat: 3, beats: 0.5 },
    { degree: 6, beat: 3.5, beats: 0.5 },
    { degree: 7, beat: 4, beats: 0.5 },
  ],

  // Major third up to a held ♭7 and back down — the pair that is the mode. A
  // riff rhythm: a long root, a sixteenth pickup into the fifth, the ♭7 held
  // over the middle of the bar.
  Mixolydian: [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 2, beat: 0.5, beats: 0.25 },
    { degree: 3, beat: 0.75, beats: 0.25 },
    { degree: 4, beat: 1, beats: 0.5 },
    { degree: 6, beat: 1.5, beats: 1 },
    { degree: 5, beat: 2.5, beats: 0.5 },
    { degree: 2, beat: 3, beats: 0.5 },
    { degree: 0, beat: 3.5, beats: 0.75 },
  ],

  // The ♭6 sighing back to the fifth, minor third underneath it. The ♭3 gets
  // there by a **perfect fourth** across beats 1 → 2, in the same place in the
  // bar where Dorian leaps a tritone to its ♮6: the same gesture, one note
  // different, which is the pair R6 asks a player to hear. The ♮2 is what keeps
  // it out of Phrygian and the ♭7 what keeps it out of harmonic minor — the
  // three minor modes are neighbours on the row and the phrase has to say which
  // one it is. The only phrase with no note shorter than an eighth, so it still
  // reads as the slow, sighing one against Dorian's push.
  Aeolian: [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 1, beat: 0.5, beats: 0.5 },
    { degree: 2, beat: 1, beats: 1 },
    { degree: 5, beat: 2, beats: 0.5 },
    { degree: 4, beat: 2.5, beats: 0.5 },
    { degree: 6, beat: 3, beats: 0.5 },
    { degree: 0, beat: 3.5, beats: 1 },
  ],

  // The ♭5, taken as a passing note between the fourth and the fifth and never
  // as a destination — which is what a blue note is. Starts on the ♭3, not the
  // root, and the six-note scale means degree 6 is already the octave.
  Blues: [
    { degree: 1, beat: 0, beats: 0.5 },
    { degree: 2, beat: 0.5, beats: 0.25 },
    { degree: 3, beat: 0.75, beats: 0.25 },
    { degree: 4, beat: 1, beats: 0.75 },
    { degree: 5, beat: 1.75, beats: 0.75 },
    { degree: 4, beat: 2.5, beats: 0.5 },
    { degree: 2, beat: 3, beats: 0.5 },
    { degree: 0, beat: 3.5, beats: 1 },
  ],

  // ♭6 to ♮7 in one step: the augmented second, taken twice, up in a gallop of
  // sixteenths and down again over the last beat. Harmonic major has the same
  // two degrees adjacent, so the interval alone does not name the mode — the
  // minor third under it does, and that is why the ascent starts through it.
  'Harmonic minor': [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 2, beat: 0.5, beats: 0.5 },
    { degree: 4, beat: 1, beats: 0.5 },
    { degree: 5, beat: 1.5, beats: 0.25 },
    { degree: 6, beat: 1.75, beats: 0.25 },
    { degree: 7, beat: 2, beats: 1 },
    { degree: 6, beat: 3, beats: 0.25 },
    { degree: 5, beat: 3.25, beats: 0.25 },
    { degree: 4, beat: 3.5, beats: 1 },
  ],

  // Minor third with a natural sixth *and* a major seventh — the top half of
  // the major scale over a minor bottom, which is the whole point of the mode.
  // A sixteenth run up to the octave, then held notes on the way back, so the
  // ascent is the same shape as harmonic minor's at half the note length and
  // the two cannot be confused.
  'Melodic minor': [
    { degree: 0, beat: 0, beats: 0.25 },
    { degree: 2, beat: 0.25, beats: 0.25 },
    { degree: 4, beat: 0.5, beats: 0.25 },
    { degree: 5, beat: 0.75, beats: 0.25 },
    { degree: 6, beat: 1, beats: 0.25 },
    { degree: 7, beat: 1.25, beats: 0.75 },
    { degree: 6, beat: 2, beats: 0.5 },
    { degree: 5, beat: 2.5, beats: 0.5 },
    { degree: 2, beat: 3, beats: 1.25 },
  ],

  // A major third, then the ♭6 where the major sixth should be — held, so the
  // borrowed note is the one the ear stops on, and rising an augmented second
  // out of that hold into the ♮7 before the turn back down. Major third with
  // ♭6 and ♮7 is a set no other scale in the table contains. Long notes rising,
  // a short turn falling.
  'Harmonic major': [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 2, beat: 0.5, beats: 0.5 },
    { degree: 4, beat: 1, beats: 0.5 },
    { degree: 5, beat: 1.5, beats: 1 },
    { degree: 6, beat: 2.5, beats: 0.75 },
    { degree: 2, beat: 3.25, beats: 0.25 },
    { degree: 0, beat: 3.5, beats: 1 },
  ],

  // ♯4 and ♭7 together — Lydian's bright fourth over Mixolydian's flat seventh,
  // which is exactly what the name says and what neither neighbour has. Six
  // notes, every one a dotted quarter or longer, so it lopes rather than runs.
  'Lydian dominant': [
    { degree: 0, beat: 0, beats: 0.75 },
    { degree: 3, beat: 0.75, beats: 0.75 },
    { degree: 4, beat: 1.5, beats: 0.75 },
    { degree: 6, beat: 2.25, beats: 0.75 },
    { degree: 3, beat: 3, beats: 0.5 },
    { degree: 2, beat: 3.5, beats: 1 },
  ],

  // ♭2 against a major third — the two notes that make the mode Spanish rather
  // than Phrygian. The ♭2 is turned around the root three times, and the fifth
  // and ♭6 above it get the same turn. The busiest rhythm of the twelve, which
  // suits the only mode in the set that is a flourish by nature.
  'Phrygian dominant': [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 1, beat: 0.5, beats: 0.25 },
    { degree: 2, beat: 0.75, beats: 0.25 },
    { degree: 1, beat: 1, beats: 0.5 },
    { degree: 0, beat: 1.5, beats: 0.5 },
    { degree: 4, beat: 2, beats: 0.5 },
    { degree: 5, beat: 2.5, beats: 0.25 },
    { degree: 4, beat: 2.75, beats: 0.25 },
    { degree: 2, beat: 3, beats: 0.5 },
    { degree: 1, beat: 3.5, beats: 0.25 },
    { degree: 0, beat: 3.75, beats: 0.75 },
  ],
}

/**
 * The phrase for a mode, or `null` for a mode with none.
 *
 * Never throws, unlike `familyOf`: this is reached from a click handler *after*
 * the chip has already been selected, so a mode the table has never heard of
 * must be silence and not a broken card (R19, R20). Matched case-insensitively,
 * the way `notes.ts` matches its own tables.
 */
export function lickFor(flavour: Flavour): LickNote[] | null {
  const wanted = flavour.trim().toLowerCase()
  if (wanted === '') return null
  const key = Object.keys(LICKS).find((k) => k.toLowerCase() === wanted)
  return key === undefined ? null : LICKS[key]
}
