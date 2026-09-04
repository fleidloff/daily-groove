import { describe, expect, it } from 'vitest'
import { FLAVOURS, displayFlavour } from './names'
import { ROOTS } from './roots'
import { type InstrumentKey, writtenRoot } from './transpose'
import { writtenAnswer, writtenChord } from './written'

const KEYS: InstrumentKey[] = ['C', 'E♭', 'B♭']

describe('writtenAnswer', () => {
  it('re-roots the answer through writtenRoot and keeps the flavour (F23 E2 R1)', () => {
    for (const instrumentKey of KEYS) {
      for (const root of ROOTS) {
        for (const slug of FLAVOURS) {
          const flavour = displayFlavour(slug)
          expect(writtenAnswer({ root, flavour }, instrumentKey)).toEqual({
            root: writtenRoot(root, instrumentKey),
            flavour,
          })
        }
      }
    }
  })

  it('is the identity on Concert and leaves its input alone (AC2)', () => {
    const answer = { root: 'E♭' as const, flavour: 'Dorian' }
    expect(writtenAnswer(answer, 'C')).toEqual(answer)
    expect(writtenAnswer(answer, 'E♭')).toEqual({ root: 'C', flavour: 'Dorian' })
    expect(writtenAnswer(answer, 'B♭')).toEqual({ root: 'F', flavour: 'Dorian' })
    expect(answer).toEqual({ root: 'E♭', flavour: 'Dorian' })
  })

  it('returns a new object rather than the one it was given', () => {
    const answer = { root: 'G' as const, flavour: 'Mixolydian' }
    expect(writtenAnswer(answer, 'C')).not.toBe(answer)
  })
})

describe('writtenChord', () => {
  const CASES: [string, InstrumentKey, string][] = [
    ['Am7', 'E♭', 'F♯m7'],
    ['E♭maj7', 'E♭', 'Cmaj7'],
    ['A♭m7♭5', 'E♭', 'Fm7♭5'],
    ['EmMaj7', 'E♭', 'C♯mMaj7'],
    ['G♭maj7', 'E♭', 'E♭maj7'],
    ['E♭m7', 'E♭', 'Cm7'],
    ['A♭7', 'E♭', 'F7'],
    ['F♯m7', 'B♭', 'A♭m7'],
    ['Fdim7', 'B♭', 'Gdim7'],
    ['Bmaj7♯5', 'B♭', 'C♯maj7♯5'],
  ]

  it.each(CASES)(
    'reads %s for %s as %s (F23 E2 R3, AC4)',
    (symbol, instrumentKey, expected) => {
      expect(writtenChord(symbol, instrumentKey)).toBe(expected)
    },
  )

  it('spells every written root from ROOTS, with the suffix verbatim (AC2)', () => {
    for (const instrumentKey of KEYS) {
      for (const root of ROOTS) {
        expect(writtenChord(`${root}m7♭5`, instrumentKey)).toBe(
          `${writtenRoot(root, instrumentKey)}m7♭5`,
        )
      }
    }
  })

  it('is the identity on Concert, character for character (R7)', () => {
    for (const symbol of ['Am7', 'G♭maj7', 'A♭m7♭5', '', 'N.C.', 'Am7/G']) {
      expect(writtenChord(symbol, 'C')).toBe(symbol)
    }
  })

  it('leaves an empty bar empty and an unreadable symbol alone', () => {
    expect(writtenChord('', 'E♭')).toBe('')
    expect(writtenChord('N.C.', 'E♭')).toBe('N.C.')
    expect(writtenChord('x', 'B♭')).toBe('x')
  })

  it('transposes only the first root of a slash chord', () => {
    expect(writtenChord('Am7/G', 'E♭')).toBe('F♯m7/G')
  })
})
