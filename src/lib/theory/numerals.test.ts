import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { barNumerals, romanNumeral } from './numerals'
import { FLAVOUR_INTERVALS } from './scales'
import { BAR_COUNT } from './changes'

describe('romanNumeral', () => {
  it('names index 0 the tonic', () => {
    expect(romanNumeral('Mixolydian', 0)).toBe('I')
  })

  it('writes a natural degree with no accidental', () => {
    expect(romanNumeral('Mixolydian', 3)).toBe('IV')
  })

  it('flats a degree the mode lowers', () => {
    expect(romanNumeral('Mixolydian', 6)).toBe('♭VII')
    expect(romanNumeral('Dorian', 2)).toBe('♭III')
  })

  it('leaves a degree the mode does not alter natural', () => {
    expect(romanNumeral('Dorian', 5)).toBe('VI')
    expect(romanNumeral('Aeolian', 1)).toBe('II')
  })

  it('sharps a raised degree rather than flatting the one above it', () => {
    expect(romanNumeral('Lydian', 3)).toBe('♯IV')
  })
})

describe('romanNumeral over a scale that is not seven notes', () => {
  it('reads the blues scale as I ♭III IV ♭V V ♭VII', () => {
    expect(romanNumeral('Blues', 0)).toBe('I')
    expect(romanNumeral('Blues', 1)).toBe('♭III')
    expect(romanNumeral('Blues', 2)).toBe('IV')
    expect(romanNumeral('Blues', 3)).toBe('♭V')
    expect(romanNumeral('Blues', 4)).toBe('V')
    expect(romanNumeral('Blues', 5)).toBe('♭VII')
  })
})

describe('romanNumeral says nothing about the chord quality', () => {
  const FLAVOURS = Object.keys(FLAVOUR_INTERVALS)

  it('covers every flavour the speller knows', () => {
    expect(FLAVOURS.length).toBeGreaterThanOrEqual(13)
  })

  it.each(FLAVOURS)('writes %s as bare accidental-plus-numeral throughout', (flavour) => {
    const intervals = FLAVOUR_INTERVALS[flavour]
    const numerals = intervals.map((_semitone, degree) => romanNumeral(flavour, degree))

    for (const numeral of numerals) {
      expect(numeral).toMatch(/^[♭♯]{0,2}(I|II|III|IV|V|VI|VII)$/)
    }
  })

  it.each(FLAVOURS)('gives %s a distinct numeral for every degree', (flavour) => {
    const intervals = FLAVOUR_INTERVALS[flavour]
    const numerals = intervals.map((_semitone, degree) => romanNumeral(flavour, degree))

    expect(new Set(numerals).size).toBe(numerals.length)
  })

  it('reads E Dorian\u2019s C\u266Fm7\u266D5 degree as a plain VI', () => {
    expect(romanNumeral('Dorian', 5)).toBe('VI')
  })

  it('reads F\u266F Aeolian\u2019s A\u266Dm7\u266D5 degree as a plain II', () => {
    expect(romanNumeral('Aeolian', 1)).toBe('II')
  })
})

describe('a gap is a blank numeral, never a throw', () => {
  it('gives an unknown flavour an empty numeral rather than throwing', () => {
    expect(() => romanNumeral('Klingon', 0)).not.toThrow()
    expect(romanNumeral('Klingon', 0)).toBe('')
  })

  it('gives an index past the end of a six-note scale an empty numeral', () => {
    expect(romanNumeral('Blues', 6)).toBe('')
  })

  it('gives a negative index an empty numeral', () => {
    expect(romanNumeral('Dorian', -1)).toBe('')
  })

  it('gives a non-integer index an empty numeral', () => {
    expect(romanNumeral('Dorian', 1.5)).toBe('')
  })

  it('gives four blank bars when there are no degrees at all', () => {
    expect(() => barNumerals('Dorian', undefined)).not.toThrow()
    expect(barNumerals('Dorian', undefined)).toEqual(['', '', '', ''])
    expect(barNumerals('Dorian', [])).toEqual(['', '', '', ''])
  })

  it('gives four blank bars when the flavour is unknown', () => {
    expect(() => barNumerals('Klingon', [0, 1])).not.toThrow()
    expect(barNumerals('Klingon', [0, 1])).toEqual(['', '', '', ''])
  })
})

describe('barNumerals', () => {
  it('returns to bar one in bar four when the progression has three chords', () => {
    expect(barNumerals('Dorian', [0, 4, 5])).toEqual(['I', 'V', 'VI', 'I'])
  })

  it("names groove-01's four changes", () => {
    expect(barNumerals('Mixolydian', [0, 2, 6, 3])).toEqual(['I', 'III', '♭VII', 'IV'])
  })

  it('names a blues turnaround, bar four returning to the tonic', () => {
    expect(barNumerals('Blues', [0, 2, 4])).toEqual(['I', 'IV', 'V', 'I'])
  })

  it('always fills every bar of the figure', () => {
    expect(barNumerals('Dorian', [0, 4, 5])).toHaveLength(BAR_COUNT)
    expect(barNumerals('Blues', [0])).toHaveLength(BAR_COUNT)
    expect(barNumerals('Lydian', [0, 1, 2, 3, 4, 5, 6])).toHaveLength(BAR_COUNT)
  })

  it.each(Object.keys(FLAVOUR_INTERVALS))('opens %s on the tonic', (flavour) => {
    expect(barNumerals(flavour, [0])[0]).toBe('I')
  })
})

describe('there is no chord-symbol parser here', () => {
  const SOURCE = readFileSync(
    join(process.cwd(), 'src/lib/theory/numerals.ts'),
    'utf8',
  )

  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  it.each(['split(', 'match(', 'slice(', 'replace(', 'indexOf('])(
    'takes apart no string with %s',
    (call) => {
      expect(CODE).not.toContain(call)
    },
  )

  it('never mentions a chord or a progression in its code', () => {
    expect(CODE.toLowerCase()).not.toContain('chord')
    expect(CODE.toLowerCase()).not.toContain('progression')
  })

  it('imports only the interval tables, the bar mapping and types', () => {
    const specifiers = [...CODE.matchAll(/from\s*'([^']+)'/g)].map((hit) => hit[1])
    expect(new Set(specifiers)).toEqual(
      new Set(['../groove', './changes', './notes', './scales']),
    )
  })

  it('reads the tables from notes.ts and edits nothing there', () => {
    expect(CODE).toContain("import { FLAVOUR_INTERVALS, MAJOR_INTERVALS } from './scales'")
    expect(CODE).toContain("import { FLAVOUR_LETTER_STEPS } from './notes'")
    expect(CODE).toContain("import { perBar } from './changes'")
  })
})
