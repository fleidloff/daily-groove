/**
 * Spelled note names → positions on a staff.
 *
 * A staff line is a letter, not a semitone: E♭ and E sit on the same line and
 * differ only by the glyph in front of the notehead. So nothing here does pitch
 * arithmetic — `scaleNotes` has already done the hard part of choosing the
 * letters, and this walks them.
 */

/** The letters of a staff, in the order they ascend from middle C. */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

/** Every accidental `notes.ts` can spell, plus the empty string for none. */
const ACCIDENTALS = ['', '♭', '♭♭', '♯', '♯♯']

/** Drawn on a line a previous note in the same scale altered. */
const NATURAL = '♮'

export type StaffNote = {
  /** Diatonic steps above middle C. C4 = 0, D4 = 1, B4 = 6, C5 = 7. */
  step: number
  /** '♯' | '♭' | '♯♯' | '♭♭' | '♮' | '' — drawn to the left of the notehead. */
  accidental: string
}

/** Thrown when a name is not a letter A–G with an accidental we can spell. */
export class UnknownNoteError extends Error {
  constructor(note: string) {
    super(`Not a spelled note: "${note}"`)
    this.name = 'UnknownNoteError'
  }
}

/**
 * Spelled note names → staff positions, ascending from the root in the octave
 * above middle C. Throws UnknownNoteError on a name it cannot parse, so a
 * catalogue that grows a new spelling fails in tests, not on the panel.
 */
export function staffNotes(names: string[]): StaffNote[] {
  // The root sits in the octave running upward from middle C — its letter's
  // first occurrence at or above C4, which is just its index in LETTERS. Each
  // later note wraps to the next octave when its letter falls below the one
  // before it, which is what puts E Dorian's C♯ at step 7 rather than step 0.
  let octave = 0
  let previous = -1

  const notes = names.map((name) => {
    const index = LETTERS.indexOf(name.slice(0, 1).toUpperCase())
    if (index === -1) throw new UnknownNoteError(name)
    const accidental = name.slice(1)
    if (!ACCIDENTALS.includes(accidental)) throw new UnknownNoteError(name)

    if (previous !== -1 && index < previous) octave += 1
    previous = index

    return { step: octave * LETTERS.length + index, accidental }
  })

  // A G following a G♭ has to say it is natural: with no key signature, an
  // accidental holds for the rest of the line it was drawn on. Only the blues
  // scale puts two notes on one line, but the rule is stated for any scale that
  // does.
  return notes.map((note, i) => {
    if (note.accidental !== '') return note
    const altered = notes
      .slice(0, i)
      .some((earlier) => earlier.step === note.step && earlier.accidental !== '')
    return altered ? { ...note, accidental: NATURAL } : note
  })
}
