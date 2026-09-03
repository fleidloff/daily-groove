import { describe, expect, it } from 'vitest'
import { MODE_CHARACTERS, characterOf } from './character'
import { FLAVOUR_LETTER_STEPS } from './notes'
import { FLAVOUR_INTERVALS } from './scales'
import { familyOf } from './families'
import { FLAVOURS, displayFlavour } from './names'

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11]

const ACCIDENTAL: Record<number, string> = {
  [-2]: '♭♭',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '♯♯',
}

function degreeLabels(flavour: string): string[] {
  return FLAVOUR_INTERVALS[flavour].map((semitones, index) => {
    const steps = FLAVOUR_LETTER_STEPS[flavour]
    const number = (steps ? steps[index] : index) + 1
    return `${ACCIDENTAL[semitones - MAJOR_SCALE[number - 1]]}${number}`
  })
}

function differingDegrees(flavour: string): string[] {
  const plain = new Set(degreeLabels(familyOf(flavour) === 'Major' ? 'Ionian' : 'Aeolian'))
  return degreeLabels(flavour).filter((degree) => !plain.has(degree))
}

describe('characterOf', () => {
  it('names Mixolydian by its ♭7', () => {
    const character = characterOf('Mixolydian')
    expect(character?.degrees).toEqual(['♭7'])
    expect(character?.line).toContain('♭7')
  })

  it.each(['mixolydian', 'MIXOLYDIAN', ' Mixolydian '])(
    'matches %j to the same entry, the way notes.ts looks a flavour up',
    (flavour) => {
      expect(characterOf(flavour)).toEqual(characterOf('Mixolydian'))
    },
  )

  it.each(['Klingon', 'Locrian', '', 'toString'])(
    'returns undefined rather than throwing for %j',
    (flavour) => {
      expect(() => characterOf(flavour)).not.toThrow()
      expect(characterOf(flavour)).toBeUndefined()
    },
  )

  it('is total over every mode the shipped manifest carries', () => {
    const modes = FLAVOURS.map(displayFlavour).sort()
    expect(modes.length).toBeGreaterThan(0)
    for (const mode of modes) {
      expect(characterOf(mode), `no character line for "${mode}"`).toBeDefined()
    }
  })
})

const ENTRIES = Object.entries(MODE_CHARACTERS)

describe('MODE_CHARACTERS', () => {
  it('covers every mode the manifest carries and nothing the intervals do not', () => {
    const modes = FLAVOURS.map(displayFlavour).sort()
    expect(ENTRIES.length).toBeGreaterThanOrEqual(modes.length)
    for (const [flavour] of ENTRIES) {
      expect(FLAVOUR_INTERVALS, flavour).toHaveProperty(flavour)
    }
  })

  it.each(ENTRIES)('%s claims exactly the degrees its intervals differ by', (flavour, entry) => {
    expect(entry.degrees).toEqual(differingDegrees(flavour))
  })

  it.each(ENTRIES)('%s names every one of those degrees in its line', (flavour, entry) => {
    for (const degree of entry.degrees) {
      expect(entry.line, `"${entry.line}" never names ${degree}`).toContain(degree)
    }
  })

  it.each(ENTRIES)('%s states what the mode is and stops', (_flavour, entry) => {
    expect(entry.line).not.toContain('doing it')
    expect(entry.line).not.toContain('the sound of it')
  })

  it.each(ENTRIES)('%s says it in one clause with no sentence break', (_flavour, entry) => {
    expect(entry.line).not.toMatch(/[.!?]\s/)
  })

  it.each(ENTRIES)('%s fits in one line of prose', (_flavour, entry) => {
    expect(entry.line.length).toBeLessThanOrEqual(72)
  })

  it.each(ENTRIES)('%s uses no word the player would have to look up', (_flavour, entry) => {
    expect(entry.line).not.toMatch(/characteristic|tonality|seventh|sixth|second|fourth|fifth/i)
    expect(entry.line).not.toMatch(/\b(?:I{1,3}|IV|VI{0,2}|VII)\b/)
  })
})

describe('the blues scale', () => {
  it('names its ♭5 and does not call itself a mode', () => {
    const blues = characterOf('Blues')
    expect(blues?.degrees).toEqual(['♭5'])
    expect(blues?.line).toContain('♭5')
    expect(blues?.line).toContain('4')
    expect(blues?.line).toContain('5')
    expect(blues?.line.toLowerCase()).not.toContain('mode')
  })
})
