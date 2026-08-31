import { describe, expect, it } from 'vitest'
import { BAR_COUNT, barChords } from './changes'
import { GROOVES } from '../../data/grooves.generated'

describe('BAR_COUNT', () => {
  it('is the four bars of the figure every groove loops', () => {
    expect(BAR_COUNT).toBe(4)
  })
})

describe('barChords', () => {
  // AC1: a four-chord progression is one chord per bar, in order.
  it('gives a four-chord progression one chord per bar', () => {
    expect(barChords('C7–Em7♭5–B♭maj7–Fmaj7')).toEqual(['C7', 'Em7♭5', 'B♭maj7', 'Fmaj7'])
  })

  // AC2: the generator comps progressionMidi[bar % length], so with three
  // chords bar four is a return to bar one rather than a new change. The sheet
  // is wrong the moment it disagrees with what is sounding.
  it('returns to bar one in bar four when the progression has three chords', () => {
    expect(barChords('Em7–Bm7–C♯m7♭5')).toEqual(['Em7', 'Bm7', 'C♯m7♭5', 'Em7'])
  })

  // AC3: total over degenerate input — one chord cycles, five are truncated,
  // and nothing throws. A missing progression is a data problem; four blank
  // bars beat the day's payoff crashing.
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

  // R2, R3: the tripwire for a future catalogue. Every groove that ships must
  // fill four bars with real symbols, and bar one must be the tonic chord the
  // card already names — the generator writes the progression's head as
  // `chord`, and events.test.ts asserts the same relation from its side.
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
