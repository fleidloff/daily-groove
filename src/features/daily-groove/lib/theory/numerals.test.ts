import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { barNumerals, romanNumeral } from './numerals'
import { FLAVOUR_INTERVALS } from './notes'
import { BAR_COUNT } from './changes'

describe('romanNumeral', () => {
  // R2b, AC10: the numerals are counted from the day's root, so index 0 is
  // always `I`. The function takes a flavour and has no root to count from
  // anything else — the parent major scale is unreachable from here.
  it('names index 0 the tonic', () => {
    expect(romanNumeral('Mixolydian', 0)).toBe('I')
  })

  // R3a: a seven-note mode's degree number is its index + 1, and the accidental
  // is the signed difference from the major scale at the same degree — right in
  // both directions, so Lydian's 6 semitones is ♯IV and Mixolydian's 10 is ♭VII.
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
  // R3a, AC4: the blues scale is `1 ♭3 4 ♭5 5 ♭7` — six degrees, whose indices
  // are therefore not consecutive degree numbers. The numbers come from
  // `FLAVOUR_LETTER_STEPS`, which already declares them, so index 1 is the
  // third degree and not the second.
  //
  // Worth knowing: `harmony.ts`'s `IDIOMS.blues` states its chords at offsets
  // 0, 5 and 7 — indices 0, 2 and 4 — so a shipped blues groove only ever
  // reads `I · IV · V`. The ♭5 degree exists in the scale and carries no chord
  // today, which is exactly why `♭V` is asserted here: a future idiom on that
  // degree would otherwise print `♯IV`.
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

  // R3, AC3: plain numerals. Upper case throughout, no lower case for minor, no
  // `ø` or `°` for half-diminished or diminished, no `+`, no `7`, no `♭5`
  // suffix. The quality is already written above, on the symbol. This assertion
  // exists to stop a later "helpful" lower-casing.
  it.each(FLAVOURS)('writes %s as bare accidental-plus-numeral throughout', (flavour) => {
    const intervals = FLAVOUR_INTERVALS[flavour]
    const numerals = intervals.map((_semitone, degree) => romanNumeral(flavour, degree))

    for (const numeral of numerals) {
      expect(numeral).toMatch(/^[♭♯]{0,2}(I|II|III|IV|V|VI|VII)$/)
    }
  })

  // Two degrees of one scale must never read as the same numeral, or the sheet
  // names one degree for two the groove plays — the blues scale's ♭V and V are
  // the case that makes this worth asserting.
  it.each(FLAVOURS)('gives %s a distinct numeral for every degree', (flavour) => {
    const intervals = FLAVOUR_INTERVALS[flavour]
    const numerals = intervals.map((_semitone, degree) => romanNumeral(flavour, degree))

    expect(new Set(numerals).size).toBe(numerals.length)
  })

  // The two cases the PRD names by hand. On an E Dorian day the half-diminished
  // chord is the sixth degree and reads `VI`, never `vii` and never `VIø`; the
  // quality lives on the `C♯m7♭5` above it.
  it('reads E Dorian\u2019s C\u266Fm7\u266D5 degree as a plain VI', () => {
    expect(romanNumeral('Dorian', 5)).toBe('VI')
  })

  it('reads F\u266F Aeolian\u2019s A\u266Dm7\u266D5 degree as a plain II', () => {
    expect(romanNumeral('Aeolian', 1)).toBe('II')
  })
})

describe('a gap is a blank numeral, never a throw', () => {
  // R4a, R8, AC7: this module is deliberately the total one. A numeral is less
  // load-bearing than a bar, so an unknown flavour, an index the scale does not
  // have, or missing degrees altogether all produce an empty string — unlike
  // the staff's `scaleDegrees`, which throws, because a gap there is a broken
  // drawing rather than one missing label.
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
  // R1, R2, R2a, R2b, AC2, AC10: one numeral per bar, mapped by `perBar` — the
  // same function `barChords` maps the symbols through — so bar four of a
  // three-chord progression is bar one's numeral rather than a blank.
  it('returns to bar one in bar four when the progression has three chords', () => {
    // The PRD's example: Em7–Bm7–C♯m7♭5 on an E Dorian day.
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

  // R2b, AC10: whatever the day's flavour, the tonic is `I`. There is no root in
  // the signature, so this is the only answer the function can give.
  it.each(Object.keys(FLAVOUR_INTERVALS))('opens %s on the tonic', (flavour) => {
    expect(barNumerals(flavour, [0])[0]).toBe('I')
  })
})

describe('there is no chord-symbol parser here', () => {
  const SOURCE = readFileSync(
    join(process.cwd(), 'src/features/daily-groove/lib/theory/numerals.ts'),
    'utf8',
  )

  /** The source with its comments removed, so prose about chords is not code. */
  const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  // R4, AC5: the generator knows which degree it chose, and a parser here would
  // be a second source of truth waiting to disagree with it. This assertion
  // exists because that is the one claim in the epic a later convenience edit
  // would quietly break.
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
    expect(new Set(specifiers)).toEqual(new Set(['../../types', './changes', './notes']))
  })

  it('reads the tables from notes.ts and edits nothing there', () => {
    expect(CODE).toContain("import { FLAVOUR_INTERVALS, FLAVOUR_LETTER_STEPS } from './notes'")
    expect(CODE).toContain("import { perBar } from './changes'")
  })
})
