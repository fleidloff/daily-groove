import { describe, expect, it } from 'vitest'
import { scaleDegrees } from './degrees'
import { FLAVOUR_INTERVALS, UnknownFlavourError, scaleNotes } from './notes'

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
    // Its degrees are not consecutive: the ♭5 and the 5 share degree number
    // five, and there is no second or sixth at all.
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
    // Derived from the table's own keys: a hardcoded list would still pass on
    // the day a fifteenth flavour is added, which is the failure this guards.
    const flavours = Object.keys(FLAVOUR_INTERVALS)
    // Guard the loop against passing vacuously if the table ever imports empty.
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
    // R10c: the library fails loudly. The panel's tolerance for a mode with no
    // character line is the panel's, not this function's.
    expect(() =>
      scaleDegrees({ root: 'C', flavour: 'Klingon' } as Parameters<typeof scaleDegrees>[0]),
    ).toThrow(UnknownFlavourError)
  })
})
