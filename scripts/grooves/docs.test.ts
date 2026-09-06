import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { PLACEMENTS, RIDE_PATTERNS } from './events.ts'
import { allTemplates } from './templates/index.ts'
import { FLAVOURS_MAX, FLAVOURS_MIN } from './templates/rules.ts'
import type { FeelTemplate } from './types.ts'
import { VOICE_NAMES } from './types.ts'

const REPO_ROOT = resolve(import.meta.dirname, '..', '..')

const GENERATOR_README = 'scripts/grooves/README.md'
const CODING_GUIDELINES = 'docs/coding-guidelines.md'
const NEW_STYLES = 'specs/new-styles.md'

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

  it('describes a feel by the modes it may draw, not by a pair', () => {
    expect(read(GENERATOR_README)).not.toMatch(/two flavours/)
  })

  it('still documents regenerating the catalogue', () => {
    const source = read(GENERATOR_README)
    expect(source).toMatch(/^## Regenerating$/m)
    expect(source).toContain('npm run grooves')
  })
})

describe('the new-styles note', () => {
  it('finds the document it is meant to be checking', () => {
    const source = read(NEW_STYLES)
    expect(source.length).toBeGreaterThan(2000)
    expect(source).toContain('# New styles')
  })

  it('no longer states the rule this feature dropped as current', () => {
    expect(read(NEW_STYLES)).not.toMatch(/two flavours/)
  })

  it('records the rule as dropped rather than as a proposal', () => {
    expect(read(NEW_STYLES)).not.toMatch(/^## The rule we will drop$/m)
  })

  it('marks the style that shipped', () => {
    const source = read(NEW_STYLES)
    expect(source).toContain('shipped')
    const bossa = source
      .split('\n')
      .find((line) => line.startsWith('| **Bossa Nova**'))
    expect(bossa, 'no candidate row for Bossa Nova').toBeDefined()
    expect(bossa).toMatch(/shipped/i)
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

const FEELS_HEADING = '## The feels'

const COUNT_WORDS: Record<number, string> = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
}

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

function voiceWord(voice: string): string {
  return /^[a-z]+/.exec(voice)?.[0] ?? voice
}

const VOICE_WORDS = [...new Set(VOICE_NAMES.map(voiceWord))]

// A template draws the shared kick pool unless it declares one, and this file cannot
// see the shared pool — so a feel proves an empty downbeat only by declaring a pool
// no member of which states step 0.
function emptyDownbeatTemplates(): FeelTemplate[] {
  return allTemplates().filter((template) => {
    const pool = template.patterns?.kick
    return pool !== undefined && pool.every((figure) => !figure.includes(0))
  })
}

const DECLARED_CELLS: Array<[string, (template: FeelTemplate) => string]> = [
  ['BPM', (t) => `${t.tempoRange[0]}–${t.tempoRange[1]}`],
  ['Subdiv', (t) => String(t.subdivision)],
  ['Swing', (t) => String(t.swing)],
  ['Passes', (t) => String(t.passes)],
  ['Density/bar', (t) => `${t.density.minPerBar}–${t.density.maxPerBar}`],
]

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
    expect(source).toContain('# Music')
    expect(source).toContain(FEELS_HEADING)
  })

  it('heads the feel section with no count in it', () => {
    expect(musicDoc()).not.toMatch(/^## The \w+ feels$/m)
  })

  describe('the feel table', () => {
    const feelTable = (): { header: string[]; byId: Map<string, string[]> } => {
      const rows = tableRowsOf(sectionOf(FEELS_HEADING))
      const header = rows.find((cells) => cells.includes('Pulse'))
      expect(header, 'the feel table has no Pulse column').toBeDefined()
      const byId = new Map<string, string[]>()
      for (const cells of rows) {
        const id = /^`([a-z-]+)`$/.exec(cells[0] ?? '')?.[1]
        if (id) byId.set(id, cells)
      }
      return { header: header!, byId }
    }

    const cellOf = (id: string, column: string): string => {
      const { header, byId } = feelTable()
      const at = header.indexOf(column)
      expect(at, `the feel table has no ${column} column`).toBeGreaterThan(-1)
      const row = byId.get(id)
      expect(row, `no feel-table row for ${id}`).toBeDefined()
      return row![at] ?? ''
    }

    const pulseByFeel = (): Map<string, string> => {
      const { header, byId } = feelTable()
      const pulseAt = header.indexOf('Pulse')
      return new Map([...byId].map(([id, cells]) => [id, cells[pulseAt] ?? '']))
    }

    it('lists every template the code declares', () => {
      expect([...pulseByFeel().keys()].sort()).toEqual(
        allTemplates()
          .map((t) => t.id)
          .sort(),
      )
    })

    it('carries one row per template and nothing else', () => {
      const rows = tableRowsOf(sectionOf(FEELS_HEADING))
      expect(rows.length - 1, 'a row in the feel table names no feel').toBe(
        allTemplates().length,
      )
      expect(feelTable().byId.size).toBe(allTemplates().length)
    })

    it('agrees with every template declaration, cell by cell', () => {
      const wrong: string[] = []
      for (const template of allTemplates()) {
        for (const [column, declared] of DECLARED_CELLS) {
          const cell = cellOf(template.id, column)
          if (cell !== declared(template)) {
            wrong.push(`${template.id} ${column}: doc "${cell}", code "${declared(template)}"`)
          }
        }
      }
      expect(wrong).toEqual([])
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

    it('gives every template the modes that template declares', () => {
      for (const template of allTemplates()) {
        const listed = cellOf(template.id, 'Flavours')
          .split(',')
          .map((flavour) => flavour.trim().replace(/`/g, ''))
          .filter(Boolean)
          .sort()
        expect(listed, template.id).toEqual([...template.flavours].sort())
      }
    })

    it('states the two-to-four rule instead of the two-flavour one', () => {
      expect(musicDoc()).not.toMatch(/exactly two flavours/)
      expect(musicDoc()).not.toMatch(/disjoint across the set/)
      const section = flatten(sectionOf(FEELS_HEADING))
      expect(section).toContain(
        `${COUNT_WORDS[FLAVOURS_MIN]} to ${COUNT_WORDS[FLAVOURS_MAX]}`,
      )
      expect(section, 'nothing says the mode sets may now overlap').toMatch(
        /overlap|no longer disjoint/i,
      )
    })

    it('counts the feels nowhere in the prose', () => {
      expect(musicDoc()).not.toMatch(/\bsix feels\b/i)
      expect(musicDoc()).not.toMatch(/\bof the six\b/i)
    })

    it('no longer claims four of the six ride', () => {
      expect(musicDoc()).not.toContain('Four of the six ride')
      expect(musicDoc()).not.toMatch(/four of the six/i)
    })
  })

  describe('a feel whose kick leaves beat one empty', () => {
    const sentenceFor = (id: string): string | undefined =>
      sentencesOf(sectionOf(FEELS_HEADING)).find(
        (sentence) => sentence.includes(`\`${id}\``) && /beat one/i.test(sentence),
      )

    // No registered feel empties the downbeat since reggae-one-drop was withdrawn,
    // so the two cases below iterate an empty set and would pass over it in silence.
    // This pins the emptiness instead: register such a feel and this goes red, which
    // is the signal that the two below have woken up and now bind it. Delete this
    // case then — the rule it guards is theirs, not this one's.
    it('has none today, so the two cases below are dormant', () => {
      expect(emptyDownbeatTemplates().map((template) => template.id)).toEqual([])
    })

    it('says beat one carries no kick, for every feel whose pool states no step 0', () => {
      for (const template of emptyDownbeatTemplates()) {
        const sentence = sentenceFor(template.id)
        expect(
          sentence,
          `nothing under "${FEELS_HEADING}" says ${template.id} leaves beat one empty`,
        ).toBeDefined()
        expect(sentence, `${template.id}: the sentence must say no kick`).toMatch(/no kick/i)
      }
    })

    it('names what keeps time instead, and names only voices that feel declares', () => {
      for (const template of emptyDownbeatTemplates()) {
        const sentence = sentenceFor(template.id) ?? ''
        const named = VOICE_WORDS.filter((word) =>
          new RegExp(`\\b${word}\\b`).test(sentence),
        )
        const declared = new Set(template.voices.map(voiceWord))
        expect(
          named.filter((word) => !declared.has(word)),
          `${template.id}: the sentence names a voice the feel does not declare`,
        ).toEqual([])
        expect(
          named.filter((word) => word !== 'kick').length,
          `${template.id}: name what keeps time in place of the kick`,
        ).toBeGreaterThanOrEqual(2)
      }
    })
  })

  describe('what a PLACEMENTS key does', () => {
    const placementParagraph = (): string => {
      const paragraph = sectionOf('## Rhythm')
        .split('\n\n')
        .map(flatten)
        .find((block) => block.includes('DEFAULT_PLACEMENT'))
      expect(paragraph, 'no paragraph about DEFAULT_PLACEMENT').toBeDefined()
      return paragraph!
    }

    // The sibling case that also required the paragraph to separate *emptying* a
    // line from moving one went with feature-25 epic-2: reggae-one-drop was the
    // only feel that ever spent a key on emptying one, and it was withdrawn. The
    // replacement semantics below are what bright-straight and second-line rest on
    // and are asserted on their own.
    it('says a key replaces the default line rather than merging with it', () => {
      expect(placementParagraph()).toMatch(/replaces/)
    })

    it('keeps the half-time backbeat as the reason the table exists', () => {
      const paragraph = placementParagraph()
      expect(paragraph).toContain('`half-time`')
      expect(paragraph).toMatch(/wide backbeat/)
    })

    it('names every registered feel that overrides a placement', () => {
      const paragraph = placementParagraph()
      const missing = allTemplates()
        .filter((template) => PLACEMENTS[template.id])
        .map((template) => template.id)
        .filter((id) => !paragraph.includes(`\`${id}\``))
      expect(missing).toEqual([])
    })
  })

  describe('half-time and open-ballad, considered and declined', () => {
    const declined = () => sectionOf(FEELS_HEADING)

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


  describe('the shape of a groove', () => {
    const catalogueRow = (): string[] => {
      const row = tableRowsOf(sectionOf('## The shape of a groove')).find(
        (cells) => cells[0] === 'Catalogue',
      )
      expect(row, 'no Catalogue row in the shape table').toBeDefined()
      return row!
    }

    it('describes the catalogue by its shape, not by a count a mint makes stale', () => {
      expect(catalogueRow().join(' | ')).toContain('catalogue.json')
      expect(musicDoc()).not.toMatch(/30 grooves/)
      expect(musicDoc()).not.toMatch(/6 feels/)
      expect(musicDoc()).not.toMatch(/\b(?:30|thirty) grooves\b/i)
    })
  })

  describe('where to change what', () => {
    const routingRows = () => tableRowsOf(sectionOf('## Where to change what'))

    const rowSendingTo = (label: string, target: RegExp): string[] => {
      const rows = routingRows().filter((cells) => target.test(cells[1] ?? ''))
      expect(rows.length, `no routing row sending ${label}`).toBeGreaterThan(0)
      return rows[0]!
    }

    it('still sends a shared rhythm figure to the pools in events.ts', () => {
      const row = rowSendingTo('a shared figure', /pattern pools in `events\.ts`/)
      expect(row[0]).toMatch(/figures?/i)
    })

    it('sends a figure one feel alone plays to that template patterns block', () => {
      const row = rowSendingTo('a per-feel pool', /`patterns`/)
      expect(row[1]).toMatch(/templates\//)
      expect(row.join(' | ')).toMatch(/figure|pool/i)
    })

    it('sends a fixed per-bar figure to that template figures list', () => {
      const row = rowSendingTo('a fixed figure', /`figures`/)
      expect(row[1]).toMatch(/templates\//)
      expect(row.join(' | ')).toMatch(/fixed|never varies|clave/i)
      expect(row.join(' | '), 'nothing tells the reader when PLACEMENTS is the answer instead')
        .toMatch(/PLACEMENTS/)
    })
  })

  describe('the labelled RNG streams', () => {
    const musicLabelBullet = (): string => {
      const bullets = sectionOf('## What must never change')
        .split(/\n(?=- )/)
        .map(flatten)
      const bullet = bullets.find((text) => text.includes('MUSIC_LABEL'))
      expect(bullet, 'no bullet about MUSIC_LABEL').toBeDefined()
      return bullet!
    }

    it('names every stream MUSIC_LABEL may not absorb, KIT_LABEL included', () => {
      const bullet = musicLabelBullet()
      for (const label of [
        'RHYTHM_LABEL',
        'GHOST_LABEL',
        'BONGO_LABEL',
        'RIDE_LABEL',
        'KIT_LABEL',
      ]) {
        expect(bullet, `${label} is not named`).toContain(label)
      }
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
