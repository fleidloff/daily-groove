import { describe, it, expect } from 'vitest'
import { FAMILIES, UnknownFamilyError, familyOf } from './families'
import { GROOVES } from '../../data/grooves.generated'
import { flavourPool } from './music'

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

  it('grades twelve modes, six major and six minor', () => {
    expect(MAJOR_MODES).toHaveLength(6)
    expect(MINOR_MODES).toHaveLength(6)
    expect(new Set([...MAJOR_MODES, ...MINOR_MODES]).size).toBe(12)
  })

  it('is total over every mode the shipped manifest carries', () => {
    const modes = [...new Set(GROOVES.map((g) => g.flavour))]
    expect(modes.length).toBeGreaterThan(0)
    for (const mode of modes) {
      expect(() => familyOf(mode), `no family for "${mode}"`).not.toThrow()
      expect(FAMILIES, mode).toContain(familyOf(mode))
    }
  })

  it('splits the manifest’s modes evenly between the families', () => {
    const modes = [...new Set(GROOVES.map((g) => g.flavour))]
    const major = modes.filter((m) => familyOf(m) === 'Major')
    const minor = modes.filter((m) => familyOf(m) === 'Minor')
    expect(major.length).toBe(minor.length)
  })

  it('throws rather than defaulting for a mode with no family', () => {
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

describe('the families partition the catalogue', () => {
  const pool = flavourPool(GROOVES)

  it('sorts every mode in the pool into exactly one of the two families', () => {
    const major = pool.filter((m) => familyOf(m) === 'Major')
    const minor = pool.filter((m) => familyOf(m) === 'Minor')

    expect(major.filter((m) => minor.includes(m))).toEqual([])
    expect([...major, ...minor].sort()).toEqual([...pool].sort())
    expect(major.length + minor.length).toBe(pool.length)
  })

  it('gives each family exactly six members of the pool', () => {
    expect(pool.filter((m) => familyOf(m) === 'Major')).toHaveLength(6)
    expect(pool.filter((m) => familyOf(m) === 'Minor')).toHaveLength(6)
  })
})
