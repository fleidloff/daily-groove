import { describe, expect, it } from 'vitest'
import { nameFor } from './name.ts'
import { ADJECTIVES, NOUNS, WORDS } from './words.ts'

/**
 * The vocabularies a name must never leak. Both accidental spellings are
 * listed: the app spells roots with Unicode accidentals ('C♯', 'E♭') and the
 * player may well type the ASCII ones, so a word matching either would hand
 * over the answer.
 */
const NOTE_WORDS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'C#',
  'D#',
  'F#',
  'G#',
  'A#',
  'Db',
  'Eb',
  'Gb',
  'Ab',
  'Bb',
  'C♯',
  'D♯',
  'F♯',
  'G♯',
  'A♯',
  'D♭',
  'E♭',
  'G♭',
  'A♭',
  'B♭',
]

const MODE_WORDS = [
  'major',
  'minor',
  'ionian',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'aeolian',
  'locrian',
  'harmonic',
  'melodic',
  'blues',
  'pentatonic',
  'chromatic',
  'diatonic',
]

/** Whole words of a phrase, lowercased, punctuation stripped from the edges. */
function wordsOf(phrase: string): string[] {
  return phrase
    .split(/[\s\-–—]+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}#♯♭]+|[^\p{L}\p{N}#♯♭]+$/gu, ''))
    .filter((w) => w.length > 0)
    .map((w) => w.toLowerCase())
}

const FORBIDDEN = new Set(
  [...NOTE_WORDS, ...MODE_WORDS].map((w) => w.toLowerCase()),
)

describe('nameFor', () => {
  it('gives a two-word name', () => {
    const name = nameFor('groove-01')
    expect(typeof name).toBe('string')
    expect(name.trim().split(/\s+/)).toHaveLength(2)
  })

  it('is stable across calls for the same seed label', () => {
    expect(nameFor('groove-01')).toBe(nameFor('groove-01'))
    expect(nameFor('groove-42')).toBe(nameFor('groove-42'))
  })

  it('differs between seed labels', () => {
    expect(nameFor('groove-01')).not.toBe(nameFor('groove-02'))
  })

  it('does not collide across eight grooves', () => {
    const labels = Array.from(
      { length: 8 },
      (_, i) => `groove-${String(i + 1).padStart(2, '0')}`,
    )
    const names = labels.map(nameFor)
    expect(new Set(names).size).toBe(labels.length)
  })
})

describe('the curated word list', () => {
  it('is large enough that eight grooves have room to differ', () => {
    expect(ADJECTIVES.length).toBeGreaterThanOrEqual(24)
    expect(NOUNS.length).toBeGreaterThanOrEqual(24)
  })

  it('holds no duplicates', () => {
    expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length)
    expect(new Set(NOUNS).size).toBe(NOUNS.length)
  })

  it('holds only single, non-empty words', () => {
    for (const word of WORDS) {
      expect(word).toMatch(/^\p{Lu}\p{L}+$/u)
    }
  })

  // AC8: no generated name contains a note name or a mode name.
  it('contains no note name and no mode name, checked as whole words', () => {
    for (const word of WORDS) {
      for (const token of wordsOf(word)) {
        expect(
          FORBIDDEN.has(token),
          `"${word}" contains the forbidden word "${token}"`,
        ).toBe(false)
      }
    }
  })

  it('carries no accidental sign in any word', () => {
    for (const word of WORDS) {
      expect(word).not.toMatch(/[#♯♭]/)
    }
  })
})

describe('generated names', () => {
  // AC8, checked on the output rather than the vocabulary, so a future
  // nameFor that joined or decorated words would still be caught.
  it('leak no note or mode name for any of a thousand seeds', () => {
    for (let i = 0; i < 1000; i++) {
      const name = nameFor(`groove-${i}`)
      expect(name).not.toMatch(/[#♯♭]/)
      for (const token of wordsOf(name)) {
        expect(
          FORBIDDEN.has(token),
          `nameFor("groove-${i}") = "${name}" leaks "${token}"`,
        ).toBe(false)
      }
    }
  })
})
