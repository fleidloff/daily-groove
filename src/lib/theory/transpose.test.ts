import { describe, expect, it } from 'vitest'
import { ROOTS, pitchClassOf } from './roots'
import { INSTRUMENT_KEYS, writtenRoot, type InstrumentKey } from './transpose'

const OFFSET: Record<InstrumentKey, number> = { C: 0, 'B♭': 2, 'E♭': 9, F: 7 }
const up = (from: string, to: string) =>
  (pitchClassOf(to as never) - pitchClassOf(from as never) + 12) % 12

describe('writtenRoot', () => {
  it('lists the four keys in one frozen order (F23 E1 R1)', () => {
    expect(INSTRUMENT_KEYS).toEqual(['C', 'B♭', 'E♭', 'F'])
  })

  it.each(INSTRUMENT_KEYS)(
    'raises every root by the %s offset and spells it from ROOTS (F23 E1 R5, AC6)',
    (instrumentKey) => {
      for (const root of ROOTS) {
        const out = writtenRoot(root, instrumentKey)
        expect(ROOTS).toContain(out)
        expect(up(root, out)).toBe(OFFSET[instrumentKey])
      }
    },
  )

  it('is the identity on concert (F23 E1 R4, AC6)', () => {
    for (const root of ROOTS) expect(writtenRoot(root, 'C')).toBe(root)
  })

  it('spells with flats where ROOTS does: concert C♯ is B♭ on alto, concert E♭ is C on alto and F on tenor (F23 E1 R5)', () => {
    expect(writtenRoot('C♯', 'E♭')).toBe('B♭')
    expect(writtenRoot('E♭', 'E♭')).toBe('C')
    expect(writtenRoot('E♭', 'B♭')).toBe('F')
    expect(writtenRoot('C', 'F')).toBe('G')
    expect(writtenRoot('B♭', 'F')).toBe('F')
  })
})
