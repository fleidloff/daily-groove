import { describe, it, expect } from 'vitest'
import { FAMILIES, UnknownFamilyError, familyOf } from './families'
import { GROOVES } from '../../data/grooves.generated'

/**
 * Every mode the table grades, in the display spelling the manifest uses —
 * sentence case, the internal hyphen read as a space ('harmonic-minor' →
 * 'Harmonic minor'). Listed here only to assert the *split*; totality is
 * asserted against the shipped manifest instead, because a hardcoded list
 * would pass on exactly the day someone mints a thirteenth mode.
 */
const MAJOR_MODES = [
  'Ionian',
  'Lydian',
  'Mixolydian',
  'Lydian dominant',
  'Phrygian dominant',
  'Harmonic major',
]

const MINOR_MODES = [
  'Dorian',
  'Phrygian',
  'Aeolian',
  'Harmonic minor',
  'Blues',
  'Melodic minor',
]

describe('FAMILIES', () => {
  it('offers exactly the two families, major first', () => {
    expect(FAMILIES).toEqual(['Major', 'Minor'])
  })
})

describe('familyOf', () => {
  it.each(MAJOR_MODES)('grades %s as Major, because its third is major', (mode) => {
    expect(familyOf(mode)).toBe('Major')
  })

  it.each(MINOR_MODES)('grades %s as Minor, because its third is minor', (mode) => {
    expect(familyOf(mode)).toBe('Minor')
  })

  // AC2b: neither family is the better blind guess in simple mode.
  it('grades twelve modes, six major and six minor', () => {
    expect(MAJOR_MODES).toHaveLength(6)
    expect(MINOR_MODES).toHaveLength(6)
    expect(new Set([...MAJOR_MODES, ...MINOR_MODES]).size).toBe(12)
  })

  // AC6: driven by the manifest, not by a list, because the table only has to
  // be total over what the catalogue can actually play — and a hardcoded list
  // stays green on the day a thirteenth mode is minted, which is precisely the
  // day familyOf starts throwing for real players.
  it('is total over every mode the shipped manifest carries', () => {
    const modes = [...new Set(GROOVES.map((g) => g.flavour))]
    expect(modes.length).toBeGreaterThan(0)
    for (const mode of modes) {
      expect(() => familyOf(mode), `no family for "${mode}"`).not.toThrow()
      expect(FAMILIES, mode).toContain(familyOf(mode))
    }
  })

  // AC2b again, this time over what actually ships: the modes the manifest
  // carries are split evenly, so simple mode stays a real discrimination.
  it('splits the manifest’s modes evenly between the families', () => {
    const modes = [...new Set(GROOVES.map((g) => g.flavour))]
    const major = modes.filter((m) => familyOf(m) === 'Major')
    const minor = modes.filter((m) => familyOf(m) === 'Minor')
    expect(major.length).toBe(minor.length)
  })

  it('throws rather than defaulting for a mode with no family', () => {
    // Locrian's fifth is diminished: it is neither answer in any honest
    // reading. Silently calling it minor would make its day unwinnable with no
    // signal anywhere, so the gap has to fail loudly.
    expect(() => familyOf('Locrian')).toThrow(UnknownFamilyError)
  })

  it.each(['Locrian', 'Whole tone', 'Altered', 'dorian', '', 'toString'])(
    'throws for %j, which the table does not grade',
    (mode) => {
      expect(() => familyOf(mode)).toThrow(UnknownFamilyError)
    },
  )

  it('names the offending mode in the error it throws', () => {
    expect(() => familyOf('Locrian')).toThrow(/Locrian/)
  })
})
