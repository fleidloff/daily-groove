import { describe, expect, it } from 'vitest'
import { MODE_CHARACTERS, characterOf } from './theory/character'
import { FLAVOURS, displayFlavour } from './theory/names'
import { solved } from './snippets'

function lineOf(flavour: string): string {
  const line = solved.modeLine({ flavour })
  if (line === undefined) throw new Error(`no mode line for "${flavour}"`)
  return line
}

const ENTRIES = Object.entries(MODE_CHARACTERS).map(
  ([flavour, character]) =>
    [flavour, { degrees: character.degrees, line: lineOf(flavour) }] as const,
)

describe('characterOf', () => {
  it('names Mixolydian by its ♭7', () => {
    const character = characterOf('Mixolydian')
    const line = solved.modeLine({ flavour: 'Mixolydian' })
    expect(character?.degrees).toEqual(['♭7'])
    expect(line).toContain('♭7')
  })
})

describe('MODE_CHARACTERS', () => {
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
    const line = lineOf('Blues')
    expect(blues?.degrees).toEqual(['♭5'])
    expect(line).toContain('♭5')
    expect(line).toContain('4')
    expect(line).toContain('5')
    expect(line.toLowerCase()).not.toContain('mode')
  })
})

describe('the degrees and the line', () => {
  it('are defined for exactly the same flavours', () => {
    const modes = FLAVOURS.map(displayFlavour)
    expect(modes.length).toBeGreaterThan(0)
    for (const mode of modes) {
      expect(characterOf(mode), `no character for "${mode}"`).toBeDefined()
      expect(solved.modeLine({ flavour: mode }), `no line for "${mode}"`).toBeDefined()
    }
  })

  it.each(['Klingon', 'Locrian', '', 'toString'])(
    'are both undefined for %j',
    (flavour) => {
      expect(characterOf(flavour)).toBeUndefined()
      expect(solved.modeLine({ flavour })).toBeUndefined()
    },
  )
})
