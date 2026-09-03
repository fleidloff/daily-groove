import { describe, expect, it } from 'vitest'
import { scaleDegrees } from './degrees'
import { UnknownFlavourError, scaleNotes } from './notes'
import { FLAVOUR_INTERVALS } from './scales'

describe('scaleDegrees', () => {
  it('names a Mixolydian scale 1 2 3 4 5 6 ♭7', () => {
    expect(scaleDegrees({ root: 'C', flavour: 'Mixolydian' })).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '♭7',
    ])
  })

  it('names a Dorian scale 1 2 ♭3 4 5 6 ♭7', () => {
    expect(scaleDegrees({ root: 'A', flavour: 'Dorian' })).toEqual([
      '1',
      '2',
      '♭3',
      '4',
      '5',
      '6',
      '♭7',
    ])
  })

  it('names the blues scale six degrees, not seven', () => {
    expect(scaleDegrees({ root: 'C', flavour: 'Blues' })).toEqual([
      '1',
      '♭3',
      '4',
      '♭5',
      '5',
      '♭7',
    ])
  })

  it('gives the blues scale one label per spelled note', () => {
    const answer = { root: 'E♭', flavour: 'Blues' } as const
    expect(scaleDegrees(answer)).toHaveLength(scaleNotes(answer).length)
  })

  it('names every flavour the table carries, one label per note', () => {
    const flavours = Object.keys(FLAVOUR_INTERVALS)
    expect(flavours.length).toBeGreaterThan(1)
    for (const flavour of flavours) {
      const answer = { root: 'C', flavour } as Parameters<typeof scaleDegrees>[0]
      const degrees = scaleDegrees(answer)
      expect(degrees, flavour).toHaveLength(scaleNotes(answer).length)
      expect(degrees[0], flavour).toBe('1')
      for (const label of degrees) {
        expect(label, `${flavour}: ${label}`).toMatch(/^[♭♯]{0,2}[1-7]$/)
      }
    }
  })

  it('throws UnknownFlavourError for a flavour the table has never heard of', () => {
    expect(() =>
      scaleDegrees({ root: 'C', flavour: 'Klingon' } as Parameters<typeof scaleDegrees>[0]),
    ).toThrow(UnknownFlavourError)
  })
})
