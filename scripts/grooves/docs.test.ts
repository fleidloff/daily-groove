import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { RIDE_PATTERNS } from './events.ts'
import { allTemplates } from './templates/index.ts'
import { VOICE_NAMES } from './types.ts'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')

const GENERATOR_README = 'scripts/grooves/README.md'
const CODING_GUIDELINES = 'docs/coding-guidelines.md'

function read(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8')
}

describe('the generator README', () => {
  it('finds the document it is meant to be checking', () => {
    const source = read(GENERATOR_README)
    expect(source.length).toBeGreaterThan(2000)
    expect(source).toContain('# The groove generator')
  })

  it('describes no freeze rule', () => {
    expect(read(GENERATOR_README)).not.toMatch(/freeze rule/i)
  })

  it('makes no reference to freezing a groove at all', () => {
    const offenders = [...read(GENERATOR_README).matchAll(/.*freez|.*frozen/gi)]
      .map((m) => m[0].trim())
    expect(offenders).toEqual([])
  })

  it('still documents regenerating the catalogue', () => {
    const source = read(GENERATOR_README)
    expect(source).toMatch(/^## Regenerating$/m)
    expect(source).toContain('npm run grooves')
  })
})

describe('the coding guidelines', () => {
  it('finds the document it is meant to be checking', () => {
    const source = read(CODING_GUIDELINES)
    expect(source.length).toBeGreaterThan(2000)
    expect(source).toContain('src/lib/hash.ts')
  })

  it('still declares src/lib/hash.ts frozen', () => {
    expect(read(CODING_GUIDELINES)).toMatch(/`src\/lib\/hash\.ts` is frozen/)
  })

  it('justifies the hash rule by the date mapping', () => {
    expect(read(CODING_GUIDELINES)).toMatch(
      /every past date is reassigned a different puzzle/,
    )
  })

  it('no longer leans on the README freeze rule', () => {
    expect(read(CODING_GUIDELINES)).not.toMatch(/freeze rule in/)
  })
})

const MUSIC_DOC = 'docs/music.md'

const NUMBER_WORDS: Record<number, string> = {
  12: 'twelve',
  13: 'thirteen',
  14: 'fourteen',
  15: 'fifteen',
  16: 'sixteen',
}

function musicDoc(): string {
  return read(MUSIC_DOC)
}

// Prose assertions run against whitespace-collapsed text: a claim must not stop
// being findable because the paragraph was re-wrapped.
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function sentencesOf(text: string): string[] {
  return flatten(text).split(/(?<=[.!?])\s+/)
}

function sectionOf(heading: string): string {
  const source = musicDoc()
  const start = source.indexOf(heading)
  expect(start, `no section headed "${heading}"`).toBeGreaterThan(-1)
  const rest = source.slice(start + heading.length)
  const end = rest.search(/^## /m)
  return end === -1 ? rest : rest.slice(0, end)
}

function tableRowsOf(section: string): string[][] {
  return section
    .split('\n')
    .filter((line) => line.trimStart().startsWith('|'))
    .map((line) =>
      line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((cells) => !cells.every((cell) => /^:?-+:?$/.test(cell) || cell === ''))
}

function ridingTemplateIds(): string[] {
  return allTemplates()
    .filter((template) => template.voices.includes('ride'))
    .map((template) => template.id)
    .sort()
}

describe('the music document', () => {
  it('finds the document it is meant to be checking', () => {
    const source = musicDoc()
    expect(source.length).toBeGreaterThan(8000)
    expect(source).toContain('## The six feels')
  })

  describe('the feel table', () => {
    const pulseByFeel = (): Map<string, string> => {
      const rows = tableRowsOf(sectionOf('## The six feels'))
      const header = rows.find((cells) => cells.includes('Pulse'))
      expect(header, 'the feel table has no Pulse column').toBeDefined()
      const pulseAt = header!.indexOf('Pulse')
      const feels = new Map<string, string>()
      for (const cells of rows) {
        const id = /^`([a-z-]+)`$/.exec(cells[0] ?? '')?.[1]
        if (id) feels.set(id, cells[pulseAt] ?? '')
      }
      return feels
    }

    it('lists every template the code declares', () => {
      expect([...pulseByFeel().keys()].sort()).toEqual(
        allTemplates()
          .map((t) => t.id)
          .sort(),
      )
    })

    it('reads ride for exactly the templates that declare a ride', () => {
      const riding = [...pulseByFeel()]
        .filter(([, pulse]) => pulse === 'ride')
        .map(([id]) => id)
        .sort()
      expect(riding).toEqual(ridingTemplateIds())
    })

    it('reads hat for every template that declares no ride', () => {
      const wrong = [...pulseByFeel()]
        .filter(([id]) => !ridingTemplateIds().includes(id))
        .filter(([, pulse]) => pulse !== 'hat')
        .map(([id, pulse]) => `${id} reads ${pulse}`)
      expect(wrong).toEqual([])
    })

    it('no longer claims four of the six ride', () => {
      expect(musicDoc()).not.toContain('Four of the six ride')
      expect(musicDoc()).not.toMatch(/four of the six/i)
    })
  })

  describe('half-time and open-ballad, considered and declined', () => {
    const declined = () => sectionOf('## The six feels')

    it('names both of them as considered and declined', () => {
      const section = declined()
      expect(section).toMatch(/declined/i)
      expect(section).toContain('`half-time`')
      expect(section).toContain('`open-ballad`')
    })

    it('gives the reason by naming their swing values', () => {
      const sentences = sentencesOf(declined()).filter((s) =>
        /declined|straight in all but name/i.test(s),
      )
      expect(sentences.join(' ')).toMatch(/0\.28/)
      expect(sentences.join(' ')).toMatch(/0\.02/)
    })
  })

  describe('the pattern pools', () => {
    const poolRow = (name: string): string[] => {
      const row = tableRowsOf(sectionOf('## Rhythm')).find(
        (cells) => cells[0] === `\`${name}\``,
      )
      expect(row, `no pattern-pool row for ${name}`).toBeDefined()
      return row!
    }

    it('describes the punctuation pool by the backbeat, not by odd steps', () => {
      const row = poolRow('HAT_PUNCTUATION_PATTERNS').join(' | ')
      expect(row).toMatch(/beats 2 and 4/)
      expect(row).toMatch(/2[–-]4 a bar/)
      expect(row).not.toMatch(/odd/i)
    })

    it('leaves the ghost pool saying every step odd', () => {
      expect(poolRow('SNARE_GHOST_PATTERNS').join(' | ')).toMatch(/every step odd/)
    })

    it('names the ride pool option count for every subdivision the code keys', () => {
      const cell = poolRow('RIDE_PATTERNS').join(' | ')
      for (const [subdivision, members] of Object.entries(RIDE_PATTERNS)) {
        expect(cell, `subdivision ${subdivision}`).toContain(subdivision)
        expect(cell, `count for subdivision ${subdivision}`).toContain(
          String((members ?? []).length),
        )
      }
    })
  })

  describe('who keeps time', () => {
    const whoKeepsTime = () => {
      const rhythm = sectionOf('## Rhythm')
      const start = rhythm.indexOf('**Who keeps time.**')
      expect(start, 'no "Who keeps time" paragraph').toBeGreaterThan(-1)
      const rest = rhythm.slice(start)
      const end = rest.search(/\n\*\*[A-Z]/)
      return flatten(end === -1 ? rest : rest.slice(0, end))
    }

    it('says the punctuation hat holds the backbeat', () => {
      expect(whoKeepsTime()).toMatch(/beats 2 and 4/)
    })

    it('drops the off-sixteenths claim', () => {
      expect(musicDoc()).not.toMatch(/off-sixteenths only/)
    })

    it('retracts the collision reason rather than narrowing it', () => {
      expect(musicDoc()).not.toContain(
        'so the hat cannot mark a position the ride is using',
      )
      const paragraph = whoKeepsTime()
      expect(paragraph, 'the retraction must quote what the document used to say').toMatch(
        /used to say/i,
      )
      expect(paragraph, 'the retraction must call the old reason wrong').toMatch(
        /\bwrong\b/i,
      )
    })

    it('keeps the true half — a ride figure is denser than hat punctuation', () => {
      expect(whoKeepsTime()).toMatch(/denser than hat punctuation/)
    })

    it('records that a riding feel drops the open hat', () => {
      expect(whoKeepsTime()).toMatch(
        /drops? `hatOpen`|`hatOpen` (?:is dropped|leaves)/,
      )
    })

    it('records the ride out of the fill bar and on quarters for the variation', () => {
      const paragraph = whoKeepsTime()
      expect(paragraph).toMatch(/fill bar/)
      expect(paragraph).toMatch(/quarters?.*variation|variation.*quarters?/)
    })
  })

  describe('the voice list', () => {
    const heading = () => {
      const match = /^## The (\w+) voices$/m.exec(musicDoc())
      expect(match, 'no voice-list heading').not.toBeNull()
      return match!
    }

    const listedVoices = () => {
      const section = sectionOf(heading()[0])
      const paragraph = section.trim().split('\n\n')[0] ?? ''
      return [...paragraph.matchAll(/`([A-Za-z]+)`/g)].map((m) => m[1]).sort()
    }

    it('counts the voices the code declares', () => {
      expect(heading()[1]).toBe(NUMBER_WORDS[VOICE_NAMES.length])
    })

    it('lists exactly the voices VoiceName holds', () => {
      expect(listedVoices()).toEqual([...VOICE_NAMES].sort())
    })

    it('credits every library the pack now draws on', () => {
      const section = flatten(sectionOf(heading()[0]))
      expect(section).not.toMatch(/three libraries/)
      expect(section).toMatch(/four libraries/)
      expect(section).toContain('Drum samples provided by DrumGizmo.org')
      expect(section).toContain('Ride cymbal samples from DRSKit')
    })

    it('records that the claves and the rim never sound in the same groove', () => {
      const sentence = sentencesOf(musicDoc()).find((s) =>
        /never sound in the same groove/.test(s),
      )
      expect(sentence, 'nothing says two voices never share a groove').toBeDefined()
      expect(sentence).toContain('`claves`')
      expect(sentence).toContain('`rim`')
    })
  })

  describe('the feathered kick', () => {
    it('appears in the document', () => {
      expect(musicDoc()).toMatch(/feather/i)
    })

    it('is attributed to the riding feels, on quarter notes, under the ghost threshold', () => {
      const paragraph = musicDoc()
        .split('\n\n')
        .map(flatten)
        .find((block) => /\*\*Feather/i.test(block))
      expect(paragraph, 'no paragraph introducing the feathered kick').toBeDefined()
      expect(paragraph).toMatch(/rid(?:e|ing)/i)
      expect(paragraph).toMatch(/quarter/i)
      expect(paragraph).toMatch(/0\.5/)
      expect(paragraph).toMatch(/no new sample/i)
    })
  })
})
