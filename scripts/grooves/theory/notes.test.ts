import { describe, expect, it } from 'vitest'
import { ROOTS, midiOf, noteName, pitchClassOf } from './notes.ts'

describe('ROOTS', () => {
  it('is the twelve chromatic roots in the app’s spelling', () => {
    expect(ROOTS).toEqual([
      'C',
      'C♯',
      'D',
      'E♭',
      'E',
      'F',
      'F♯',
      'G',
      'A♭',
      'A',
      'B♭',
      'B',
    ])
  })
})

describe('midiOf', () => {
  it('places middle C at 60', () => {
    expect(midiOf('C', 4)).toBe(60)
  })

  it('walks up in semitones across an octave', () => {
    expect(midiOf('C♯', 4)).toBe(61)
    expect(midiOf('B', 4)).toBe(71)
    expect(midiOf('C', 5)).toBe(72)
    expect(midiOf('C', 1)).toBe(24)
  })
})

describe('noteName', () => {
  it('names middle C', () => {
    expect(noteName(60)).toBe('C')
  })

  it('round-trips every one of the twelve roots', () => {
    for (const root of ROOTS) {
      expect(noteName(midiOf(root, 4))).toBe(root)
      expect(noteName(midiOf(root, 1))).toBe(root)
    }
  })

  it('is octave-independent', () => {
    expect(noteName(48)).toBe('C')
    expect(noteName(0)).toBe('C')
    expect(noteName(70)).toBe('B♭')
  })
})

describe('pitchClassOf', () => {
  it('maps a root to its 0..11 pitch class', () => {
    expect(pitchClassOf('C')).toBe(0)
    expect(pitchClassOf('E♭')).toBe(3)
    expect(pitchClassOf('B')).toBe(11)
  })
})
