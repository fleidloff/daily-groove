import type { Flavour } from '../../types'

/**
 * What separates one answer from the plain scale it is a bend of, and the one
 * clause the box says it in.
 */
export type ModeCharacter = {
  /** The degrees that separate this mode from its family's plain scale. */
  degrees: string[]
  /** One clause, e.g. 'major with a ♭7 — that’s the note doing it'. */
  line: string
}

/**
 * The written table: one line of prose per answer the rotation can play.
 *
 * This is content, not arithmetic, and it is the feature's one piece of
 * authored writing — so three rules bind every entry, and each is a test in
 * `character.test.ts` rather than a convention:
 *
 * 1. **`degrees` is the truth, not an opinion.** It is exactly the degrees by
 *    which the mode's `FLAVOUR_INTERVALS` differ from its family's plain scale —
 *    Ionian for a major third, Aeolian for a minor one, graded by `familyOf`
 *    and by nothing this table gets a second opinion about. The test recomputes
 *    it from the intervals; the table never computes it, or it would be
 *    asserting itself.
 * 2. **The line names every one of them.** Lydian dominant is "a ♯4 and a ♭7";
 *    a line naming one of two describes a different mode from the one playing.
 * 3. **One clause, no sentence break, at most 72 characters.** The player is on
 *    a phone with twenty minutes before dinner, and a paragraph in the payoff
 *    is the homework they abandoned three courses to avoid.
 *
 * The vocabulary is deliberately small: major, minor, scale, note, bent, and
 * the degree in the app's own notation. No "characteristic", no "tonality", no
 * "minor seventh", no Roman numerals — the player learned by ear and by tab,
 * and a line that needs a glossary re-creates the gap it exists to close.
 *
 * Totality is asserted against the shipped manifest, the way `families.ts`
 * asserts its own, because a hardcoded list would pass on exactly the day a
 * thirteenth mode is minted. Locrian is absent for the same reason it is absent
 * from `families.ts`: its fifth is diminished, so neither plain scale is an
 * honest baseline for it — and the catalogue no longer carries it.
 */
export const MODE_CHARACTERS: Record<Flavour, ModeCharacter> = {
  // Major third: measured against the plain major scale.
  Ionian: {
    degrees: [],
    line: 'the plain major scale — nothing bent, that’s the sound of it',
  },
  Lydian: {
    degrees: ['♯4'],
    line: 'major with a ♯4 — that’s the note doing it',
  },
  Mixolydian: {
    degrees: ['♭7'],
    line: 'major with a ♭7 — that’s the note doing it',
  },
  'Lydian dominant': {
    degrees: ['♯4', '♭7'],
    line: 'major with a ♯4 and a ♭7 — those are the notes doing it',
  },
  'Phrygian dominant': {
    degrees: ['♭2', '♭6', '♭7'],
    line: 'major with a ♭2, a ♭6 and a ♭7 — those are the notes doing it',
  },
  'Harmonic major': {
    degrees: ['♭6'],
    line: 'major with a ♭6 — that’s the note doing it',
  },
  // Minor third: measured against the plain minor scale, which is Aeolian.
  Aeolian: {
    degrees: [],
    line: 'the plain minor scale — nothing bent, that’s the sound of it',
  },
  Dorian: {
    // A natural degree where the plain scale flattens one still separates the
    // two, so it is named the way the app writes it — plain '6' — and the line
    // says where it sits, because "minor with a 6" alone reads as a riddle to
    // someone who does not read music.
    degrees: ['6'],
    line: 'minor with a 6 where the ♭6 would be — that’s the note doing it',
  },
  Phrygian: {
    degrees: ['♭2'],
    line: 'minor with a ♭2 — that’s the note doing it',
  },
  'Harmonic minor': {
    degrees: ['7'],
    line: 'minor with a 7 where the ♭7 would be — that’s the note doing it',
  },
  'Melodic minor': {
    // Two degrees and a "where the … would be" do not both fit in 72
    // characters, so this one drops the pointing tail rather than the second
    // degree. Naming every degree is a requirement; the tail is a habit.
    degrees: ['6', '7'],
    line: 'minor with a 6 and a 7 where the ♭6 and ♭7 would be',
  },
  Blues: {
    // Not a mode, and the line does not call it one. Its own word is "scale",
    // and the ♭5 wedged between the 4 and the 5 is the thing to listen for.
    //
    // It also says which "blues" this is. The word names two different things a
    // player meets — a six-note scale and a twelve-bar form — and the day's
    // answer is only ever the first. Saying so costs seven words and heads off
    // the one wrong conclusion this line could otherwise invite, from exactly
    // the player who has played twelve-bar blues and never named the scale.
    degrees: ['♭5'],
    line: 'the blues scale, not the 12-bar form — that ♭5 between the 4 and the 5',
  },
}

/**
 * What makes an answer sound like itself, or `undefined` if the table has no
 * line for it.
 *
 * Returns rather than throws, unlike its neighbour `scaleNotes`, and the
 * asymmetry is deliberate: this is read on the panel that pays the day off, so
 * a missing line renders a box without a line, the way `changes.ts` renders
 * four blank bars rather than crashing. The manifest-derived test is what stops
 * that tolerance from quietly shipping a gap.
 *
 * Looks up ignoring case and surrounding space, the way `notes.ts` matches a
 * flavour to its own table.
 */
export function characterOf(flavour: Flavour): ModeCharacter | undefined {
  const wanted = flavour.trim().toLowerCase()
  const key = Object.keys(MODE_CHARACTERS).find((k) => k.toLowerCase() === wanted)
  return key === undefined ? undefined : MODE_CHARACTERS[key]
}
