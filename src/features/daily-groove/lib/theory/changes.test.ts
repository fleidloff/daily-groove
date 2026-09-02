import { describe, expect, it } from 'vitest'
import { BAR_COUNT, barChords, perBar } from './changes'
import { GROOVES } from '../../data/grooves.generated'

describe('BAR_COUNT', () => {
  it('is the four bars of the figure every groove loops', () => {
    expect(BAR_COUNT).toBe(4)
  })
})

describe('perBar', () => {
  it('returns to the first value in bar four when there are three values', () => {
    expect(perBar(['a', 'b', 'c'])).toEqual(['a', 'b', 'c', 'a'])
  })

  it('yields four undefineds for an empty list rather than throwing', () => {
    expect(() => perBar([])).not.toThrow()
    expect(perBar([])).toEqual([undefined, undefined, undefined, undefined])
  })

  it('truncates a list longer than four to its first four', () => {
    expect(perBar([1, 2, 3, 4, 5])).toEqual([1, 2, 3, 4])
  })

  it('cycles a single value through all four bars', () => {
    expect(perBar(['x'])).toEqual(['x', 'x', 'x', 'x'])
  })
})

describe('barChords', () => {
  it('gives a four-chord progression one chord per bar', () => {
    expect(barChords('C7–Em7♭5–B♭maj7–Fmaj7')).toEqual(['C7', 'Em7♭5', 'B♭maj7', 'Fmaj7'])
  })

  it('returns to bar one in bar four when the progression has three chords', () => {
    expect(barChords('Em7–Bm7–C♯m7♭5')).toEqual(['Em7', 'Bm7', 'C♯m7♭5', 'Em7'])
  })

  it('cycles a single chord through all four bars', () => {
    expect(barChords('C7')).toEqual(['C7', 'C7', 'C7', 'C7'])
  })

  it('truncates a progression longer than four bars to its first four', () => {
    expect(barChords('A–B–C–D–E')).toEqual(['A', 'B', 'C', 'D'])
  })

  it('alternates a two-chord progression', () => {
    expect(barChords('Dm7–G7')).toEqual(['Dm7', 'G7', 'Dm7', 'G7'])
  })

  it('returns four empty bars for an empty progression rather than throwing', () => {
    expect(() => barChords('')).not.toThrow()
    expect(barChords('')).toEqual(['', '', '', ''])
  })

  it('returns four empty bars when the progression is nothing but separators', () => {
    expect(() => barChords(' – – ')).not.toThrow()
    expect(barChords(' – – ')).toEqual(['', '', '', ''])
  })

  it('trims the space around each symbol and ignores an empty segment', () => {
    expect(barChords(' Cm7 – F7 – B♭maj7 ')).toEqual(['Cm7', 'F7', 'B♭maj7', 'Cm7'])
    expect(barChords('Cm7––F7')).toEqual(['Cm7', 'F7', 'Cm7', 'F7'])
  })

  describe('over the shipped catalogue', () => {
    it('covers all 30 catalogued grooves', () => {
      expect(GROOVES).toHaveLength(30)
    })

    it.each(GROOVES.map((groove) => [groove.id, groove] as const))(
      'maps %s to four non-empty bars headed by its tonic chord',
      (_id, groove) => {
        const bars = barChords(groove.progression)
        expect(bars).toHaveLength(BAR_COUNT)
        expect(bars).not.toContain('')
        expect(bars[0]).toBe(groove.chord)
      },
    )
  })
})
