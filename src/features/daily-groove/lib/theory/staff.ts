const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']

const ACCIDENTALS = ['', '♭', '♭♭', '♯', '♯♯']

const NATURAL = '♮'

export const STAFF_FLOOR_STEP = 0

export type StaffNote = {
  step: number
  accidental: string
}

export class UnknownNoteError extends Error {
  constructor(note: string) {
    super(`Not a spelled note: "${note}"`)
    this.name = 'UnknownNoteError'
  }
}

export function staffNotes(names: string[]): StaffNote[] {
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

  return notes.map((note, i) => {
    if (note.accidental !== '') return note
    const altered = notes
      .slice(0, i)
      .some((earlier) => earlier.step === note.step && earlier.accidental !== '')
    return altered ? { ...note, accidental: NATURAL } : note
  })
}
