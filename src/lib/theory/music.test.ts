import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it, expect } from 'vitest'
import type { Answer, Groove } from '../groove'
import {
  answerOf,
  flavourOptions,
  flavourPool,
  loopSecondsOf,
  simpleRootOptions,
} from './music'
import { ROOTS } from './roots'

const GROOVE: Groove = {
  id: 'groove-01',
  uuid: '61607a6c-3f9e-4fd7-9724-99ea22d32e4a',
  audioSrc: '/grooves/groove-01.mp3',
  name: 'Test Groove',
  bpm: 90,
  scale: 'C aeolian',
  chord: 'Cm7',
  progression: 'Cm7\u2013Fm7\u2013G7',
  progressionDegrees: [0, 3, 4, 0],
  root: 'C',
  flavour: 'Aeolian',
  bars: 4,
  loopBars: 4,
  headDelaySeconds: 0,
}

const CATALOGUE: Groove[] = ['Aeolian', 'Dorian', 'Lydian', 'Blues', 'Ionian'].map(
  (flavour, i) => ({ ...GROOVE, id: `groove-0${i + 1}`, flavour }),
)

describe('answerOf', () => {
  it("reads the answer from the groove's own root and flavour fields", () => {
    const groove = { ...GROOVE, root: 'A' as const, flavour: 'Dorian' }
    expect(answerOf(groove)).toEqual({ root: 'A', flavour: 'Dorian' })
  })

  it('keeps a two-word flavour intact, which a parse of `scale` would not', () => {
    const groove = {
      ...GROOVE,
      scale: 'E\u266d harmonic minor',
      root: 'E\u266d' as const,
      flavour: 'Harmonic minor',
    }
    expect(answerOf(groove)).toEqual({
      root: 'E\u266d',
      flavour: 'Harmonic minor',
    })
  })

  it('ignores the display string entirely', () => {
    const groove = { ...GROOVE, scale: 'nonsense', root: 'G' as const, flavour: 'Major' }
    expect(answerOf(groove)).toEqual({ root: 'G', flavour: 'Major' })
  })
})

describe('ROOTS', () => {
  it('offers all twelve chromatic notes', () => {
    expect(ROOTS).toHaveLength(12)
    expect(new Set(ROOTS).size).toBe(12)
  })
})

describe('flavourOptions', () => {
  const dates = Array.from(
    { length: 30 },
    (_, i) => new Date(2026, 0, 1 + i),
  )

  it.each(dates.map((d) => [d.toDateString(), d] as const))(
    'on %s returns four options including the answer',
    (_label, date) => {
      const groove = CATALOGUE[1]
      const options = flavourOptions(date, groove, CATALOGUE)
      expect(options).toHaveLength(4)
      expect(options).toContain(groove.flavour)
      expect(new Set(options).size).toBe(4)
    },
  )

  it('is stable for the same date', () => {
    const date = new Date(2026, 7, 29)
    const groove = CATALOGUE[1]
    expect(flavourOptions(date, groove, CATALOGUE)).toEqual(
      flavourOptions(date, groove, CATALOGUE),
    )
  })

  it('draws only from the seeded flavour pool', () => {
    const pool = flavourPool(CATALOGUE)
    for (const date of dates) {
      for (const option of flavourOptions(date, CATALOGUE[1], CATALOGUE)) {
        expect(pool).toContain(option)
      }
    }
  })
})

describe('simpleRootOptions', () => {
  const ANSWER: Answer = { root: 'E\u266d', flavour: 'Dorian' }

  const DATES = Array.from(
    { length: 20 },
    (_, i) => new Date(2026, 1, 20 + i),
  )

  it('covers twenty distinct dates', () => {
    const isos = new Set(DATES.map((d) => d.toDateString()))
    expect(isos.size).toBe(20)
  })

  it.each(DATES.map((d) => [d.toDateString(), d] as const))(
    'offers six distinct roots on %s (R2, AC2)',
    (_label, date) => {
      const options = simpleRootOptions(date, ANSWER)
      expect(options).toHaveLength(6)
      expect(new Set(options).size).toBe(6)
    },
  )

  it.each(DATES.map((d) => [d.toDateString(), d] as const))(
    "always includes the day's correct root on %s (R3, AC2)",
    (_label, date) => {
      expect(simpleRootOptions(date, ANSWER)).toContain('E\u266d')
    },
  )

  it('draws only from the twelve chromatic roots', () => {
    for (const date of DATES) {
      for (const root of simpleRootOptions(date, ANSWER)) {
        expect(ROOTS).toContain(root)
      }
    }
  })

  it('returns the same six in the same order for the same date (AC2)', () => {
    for (const date of DATES) {
      const again = new Date(date.getTime())
      expect(simpleRootOptions(again, ANSWER)).toEqual(
        simpleRootOptions(date, ANSWER),
      )
    }
  })

  it('is seeded by the calendar day, not the clock', () => {
    const morning = new Date(2026, 5, 14, 6, 30)
    const midnight = new Date(2026, 5, 14, 23, 59)
    expect(simpleRootOptions(midnight, ANSWER)).toEqual(
      simpleRootOptions(morning, ANSWER),
    )
  })

  it('does not offer the same six on every date', () => {
    const shapes = new Set(
      DATES.map((d) => simpleRootOptions(d, ANSWER).join('|')),
    )
    expect(shapes.size).toBeGreaterThan(1)
  })

  it("follows the answer's root, whichever it is", () => {
    const date = new Date(2026, 5, 14)
    for (const root of ROOTS) {
      const options = simpleRootOptions(date, { root, flavour: 'Ionian' })
      expect(options).toHaveLength(6)
      expect(options).toContain(root)
    }
  })
})

describe('loopSecondsOf', () => {
  it('gives the musical length of the loop from its tempo and bar count', () => {
    expect(loopSecondsOf({ ...GROOVE, bpm: 96, bars: 4, loopBars: 4 })).toBeCloseTo(10, 6)
    expect(loopSecondsOf({ ...GROOVE, bpm: 105, bars: 4, loopBars: 4 })).toBeCloseTo(
      9.142857,
      6,
    )
    expect(loopSecondsOf({ ...GROOVE, bpm: 120, bars: 8, loopBars: 8 })).toBeCloseTo(16, 6)
  })

  it('refuses a tempo that would make the length meaningless', () => {
    expect(loopSecondsOf({ ...GROOVE, bpm: 0 })).toBe(0)
    expect(loopSecondsOf({ ...GROOVE, bpm: -1 })).toBe(0)
  })

  it("measures the file's loop, not the four-bar figure (R8, AC8)", () => {
    expect(
      loopSecondsOf({ ...GROOVE, bpm: 100, bars: 4, loopBars: 16 }),
    ).toBeCloseTo(38.4, 6)
  })

  it('falls back to `bars` when an entry carries no `loopBars` (R8)', () => {
    const groove = { ...GROOVE, bpm: 100, bars: 4 }
    delete groove.loopBars
    expect('loopBars' in groove).toBe(false)
    expect(loopSecondsOf(groove)).toBeCloseTo(9.6, 6)
  })

  it('falls back to `bars` when `loopBars` cannot describe a length (R8)', () => {
    expect(
      loopSecondsOf({ ...GROOVE, bpm: 100, bars: 4, loopBars: 0 }),
    ).toBeCloseTo(9.6, 6)
    expect(
      loopSecondsOf({ ...GROOVE, bpm: 100, bars: 4, loopBars: -8 }),
    ).toBeCloseTo(9.6, 6)
  })
})

describe('the rotation is the generated catalogue (Epic 4)', () => {
  let fixtureUuids = 0
  const nextFixtureUuid = () =>
    `00000000-0000-4000-8000-${String((fixtureUuids += 1)).padStart(12, '0')}`

  function fake(id: string, flavour: string): Groove {
    return {
      id,
      uuid: nextFixtureUuid(),
      audioSrc: `/grooves/${id}.mp3`,
      name: `Fake ${id}`,
      bpm: 100,
      bars: 4,
      scale: `C ${flavour.toLowerCase()}`,
      chord: 'C',
      progression: 'C–F–G',
      root: 'C',
      flavour,
      headDelaySeconds: 0,
    }
  }

  it('returns exactly the distinct flavours of a hand-built catalogue (R2)', () => {
    const catalogue = [
      fake('a', 'Dorian'),
      fake('b', 'Lydian'),
      fake('c', 'Dorian'),
      fake('d', 'Aeolian'),
    ]

    expect(flavourPool(catalogue)).toEqual(['Aeolian', 'Dorian', 'Lydian'])
  })

  it('offers nothing the hand-built catalogue does not carry (R2, R7)', () => {
    const catalogue = [fake('a', 'Ionian'), fake('b', 'Mixolydian')]

    expect(flavourPool(catalogue)).toEqual(['Ionian', 'Mixolydian'])
    for (const absent of ['Blues', 'Harmonic minor', 'Aeolian', 'Locrian']) {
      expect(flavourPool(catalogue)).not.toContain(absent)
    }
  })

  const SRC = join(process.cwd(), 'src')

  function sourceFiles(dir: string = SRC): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return sourceFiles(full)
      if (!/\.tsx?$/.test(entry.name)) return []
      if (/\.(test|spec)\.tsx?$/.test(entry.name)) return []
      return [full]
    })
  }

  function code(file: string): string {
    return readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  }

  function hits(pattern: RegExp): string[] {
    return sourceFiles().flatMap((file) => {
      const found = code(file).match(pattern)
      return found ? [`${relative(process.cwd(), file)}: ${found[0].trim()}`] : []
    })
  }

  it('carries no retirement flag anywhere in the source (R7, AC8)', () => {
    expect(hits(/retire(?:d|s|ment|ing)?/i)).toEqual([])
  })

  it('carries no allowlist or denylist of grooves or flavours (R7, AC8)', () => {
    const verbs = 'allow|deny|block|exclude|skip|omit|hidden|disabled'
    const nouns = 'grooves?|flavours?|modes?'
    expect(
      hits(new RegExp(`\\b(?:${verbs})[_ ]?(?:list|ed)?[_ ]?(?:${nouns})\\b`, 'i')),
    ).toEqual([])
    expect(
      hits(new RegExp(`\\b(?:${nouns})[_ ]?(?:${verbs})[_ ]?(?:list|ed)?\\b`, 'i')),
    ).toEqual([])
  })

  it('filters the rotation nowhere (R7, AC8)', () => {
    expect(hits(/\bGROOVES\b[^\n]*\.\s*(?:filter|slice|splice)\s*\(/)).toEqual([])

    expect(
      hits(
        /\.\s*filter\s*\([^)\n]*\)?\s*=>[^\n]*\.\s*(?:flavour|mode)\b/i,
      ),
    ).toEqual([])
    expect(
      hits(
        /\.\s*filter\s*\(\s*\(?\s*\{[^}\n]*\b(?:flavour|mode)\b[^}\n]*\}\s*\)?\s*=>/i,
      ),
    ).toEqual([])
  })

  it('hands the whole catalogue to the day’s pick and to the pool (R7, AC8)', () => {
    const picks = hits(/selectGrooveForDate\([^\n]*\bGROOVES\b\s*\)/)
    expect(picks.length).toBeGreaterThan(0)

    const pools = hits(/flavourPool\(\s*GROOVES\s*\)/)
    expect(pools.length).toBeGreaterThan(0)
  })

  it('leaves `Flavour` in src/lib/groove.ts a plain string (R8, AC9)', () => {
    const source = readFileSync(join(SRC, 'lib', 'groove.ts'), 'utf8')
    const declaration = source.match(/export type Flavour\s*=([^\n]*)/)

    expect(declaration).not.toBeNull()
    expect(declaration?.[1].trim()).toBe('string')
  })
})


describe('the flavour pool reaches every call site (F20 E3 R8, AC8)', () => {
  const NEEDLE = 'flavourOptions'
  const FIXTURE_OWNER = ['src', 'lib', 'theory', 'music.test.ts'].join('/')

  function everySource(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return everySource(full)
      return /\.tsx?$/.test(entry.name) ? [full] : []
    })
  }

  function stripped(file: string): string {
    return readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  }

  function thirdArgument(source: string, open: number): string | null {
    const args: string[] = []
    let depth = 0
    let start = open + 1
    for (let i = open; i < source.length; i += 1) {
      const char = source[i]
      if (char === '(' || char === '[' || char === '{') {
        depth += 1
      } else if (char === ')' || char === ']' || char === '}') {
        depth -= 1
        if (depth === 0) {
          args.push(source.slice(start, i))
          break
        }
      } else if (char === ',' && depth === 1) {
        args.push(source.slice(start, i))
        start = i + 1
      }
    }
    return args.length >= 3 ? args[2].trim() : null
  }

  function callSites(): { file: string; pool: string }[] {
    const sites: { file: string; pool: string }[] = []
    const opening = new RegExp(`\\b${NEEDLE}\\s*\\(`, 'g')

    for (const root of ['src', 'scripts']) {
      for (const file of everySource(join(process.cwd(), root))) {
        const source = stripped(file)
        for (const match of source.matchAll(opening)) {
          const index = match.index ?? 0
          if (/\bfunction\s+$/.test(source.slice(0, index))) continue
          const pool = thirdArgument(source, index + match[0].length - 1)
          sites.push({
            file: relative(process.cwd(), file),
            pool: pool ?? '<no third argument>',
          })
        }
      }
    }
    return sites
  }

  it('finds the production call site, so the scan cannot pass vacuously', () => {
    const files = callSites().map((site) => site.file)
    expect(files).toContain(
      ['src', 'features', 'daily-groove', 'lib', 'presentation', 'index.ts'].join('/'),
    )
    expect(files.length).toBeGreaterThan(10)
  })

  it('hands every call site the generated pool, never a local fixture', () => {
    const offenders = callSites()
      .filter(
        (site) =>
          site.pool !== 'GROOVES' &&
          !(site.pool === 'CATALOGUE' && site.file === FIXTURE_OWNER),
      )
      .map((site) => `${site.file}: third argument is \`${site.pool}\``)

    expect(offenders).toEqual([])
  })
})
