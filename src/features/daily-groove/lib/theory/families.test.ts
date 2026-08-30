import { describe, it, expect } from 'vitest'
import { FAMILIES, UnknownFamilyError, familyOf } from './families'

describe('FAMILIES', () => {
  it('offers exactly the two families, major first', () => {
    expect(FAMILIES).toEqual(['Major', 'Minor'])
  })
})

describe('familyOf', () => {
  it.each(['Ionian', 'Lydian', 'Mixolydian'])(
    'grades %s as Major, because its third is major',
    (mode) => {
      expect(familyOf(mode)).toBe('Major')
    },
  )

  it.each(['Dorian', 'Phrygian', 'Aeolian'])(
    'grades %s as Minor, because its third is minor',
    (mode) => {
      expect(familyOf(mode)).toBe('Minor')
    },
  )

  it('is total over the six modes the rotation actually plays', () => {
    const modes = [
      'Ionian',
      'Dorian',
      'Phrygian',
      'Lydian',
      'Mixolydian',
      'Aeolian',
    ]
    expect(modes.map(familyOf)).toEqual([
      'Major',
      'Minor',
      'Minor',
      'Major',
      'Major',
      'Minor',
    ])
  })

  it('throws rather than defaulting for a mode with no family', () => {
    // Locrian's fifth is diminished: it is neither answer in any honest
    // reading. Silently calling it minor would make its day unwinnable with no
    // signal anywhere, so the gap has to fail loudly.
    expect(() => familyOf('Locrian')).toThrow(UnknownFamilyError)
  })

  it.each(['Harmonic minor', 'Blues', 'dorian', '', 'toString'])(
    'throws for %j, which is not one of the six',
    (mode) => {
      expect(() => familyOf(mode)).toThrow(UnknownFamilyError)
    },
  )

  it('names the offending mode in the error it throws', () => {
    expect(() => familyOf('Locrian')).toThrow(/Locrian/)
  })
})
