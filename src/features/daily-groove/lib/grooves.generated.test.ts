import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GROOVES } from './grooves.generated'
import { isoDate, selectGrooveForDate } from './selectGroove'

const PUBLIC = join(process.cwd(), 'public')
const SRC = join(process.cwd(), 'src')

describe('the generated groove catalogue', () => {
  it('is not empty', () => {
    expect(GROOVES.length).toBeGreaterThan(0)
  })

  it('gives every entry all ten fields, correctly typed', () => {
    for (const g of GROOVES) {
      expect(typeof g.id).toBe('string')
      expect(typeof g.audioSrc).toBe('string')
      expect(typeof g.name).toBe('string')
      expect(typeof g.bpm).toBe('number')
      expect(typeof g.scale).toBe('string')
      expect(typeof g.chord).toBe('string')
      expect(typeof g.progression).toBe('string')
      expect(typeof g.root).toBe('string')
      expect(typeof g.flavour).toBe('string')
      expect(typeof g.bars).toBe('number')
    }
  })

  it('gives every entry a non-empty name and a plausible tempo', () => {
    for (const g of GROOVES) {
      expect(g.name.length).toBeGreaterThan(0)
      expect(g.bpm).toBeGreaterThan(40)
      expect(g.bpm).toBeLessThan(220)
    }
  })

  it('is four bars per groove', () => {
    for (const g of GROOVES) expect(g.bars).toBe(4)
  })

  it('uses unique ids and unique audio paths', () => {
    expect(new Set(GROOVES.map((g) => g.id)).size).toBe(GROOVES.length)
    expect(new Set(GROOVES.map((g) => g.audioSrc)).size).toBe(GROOVES.length)
  })

  it('serves every groove from /grooves/', () => {
    for (const g of GROOVES) expect(g.audioSrc.startsWith('/grooves/')).toBe(true)
  })

  it("spells each groove's scale from its own root and flavour", () => {
    for (const g of GROOVES) {
      expect(g.scale.startsWith(g.root)).toBe(true)
      expect(g.scale.toLowerCase()).toContain(g.flavour.toLowerCase())
    }
  })
})

describe('the audio behind the catalogue', () => {
  // The check that would have caught seven zero-byte placeholder mp3s shipping.
  it('has a real, non-empty file behind every entry', () => {
    for (const g of GROOVES) {
      const file = join(PUBLIC, g.audioSrc)
      expect(existsSync(file), `${g.audioSrc} does not exist`).toBe(true)
      expect(statSync(file).size, `${g.audioSrc} is empty`).toBeGreaterThan(0)
    }
  })

  it('resolves a full year of dates to a playable groove', () => {
    const start = new Date('2026-01-01T12:00:00')
    for (let i = 0; i < 366; i++) {
      const day = new Date(start)
      day.setDate(start.getDate() + i)
      const groove = selectGrooveForDate(day, GROOVES)
      expect(GROOVES, `${isoDate(day)} resolved outside the catalogue`).toContain(groove)
      const file = join(PUBLIC, groove.audioSrc)
      expect(statSync(file).size, `${isoDate(day)} resolves to an empty file`).toBeGreaterThan(0)
    }
  })
})

/**
 * Walk a tree and hand back every TypeScript source file in it, tests
 * included: a test that parses a scale string is a second source of truth
 * just as surely as production code that does.
 */
function sourceFiles(root: string): string[] {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name)) found.push(full)
    }
  }
  walk(root)
  return found
}

describe('the app reads grooves from one place', () => {
  it('has no remaining import of the hand-written seed catalogue', () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      /import\s*\{[^}]*\bGROOVES\b[^}]*\}\s*from\s*'[^']*\/seed'/.test(
        readFileSync(file, 'utf8'),
      ),
    )
    expect(offenders).toEqual([])
  })

  // AC8: seed.ts is gone, and nothing anywhere still reaches for it.
  it('imports nothing at all from a seed module', () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      /from\s*'[^']*\.\/seed'/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('has no seed.ts or seed.test.ts on disk', () => {
    const lib = join(SRC, 'features', 'daily-groove', 'lib')
    expect(existsSync(join(lib, 'seed.ts')), 'seed.ts still exists').toBe(false)
    expect(
      existsSync(join(lib, 'seed.test.ts')),
      'seed.test.ts still exists',
    ).toBe(false)
  })
})

/**
 * R8: `root` and `flavour` are the answer; `scale` is a display string. A
 * derivation that takes the answer apart out of `scale` is a second source of
 * truth, and it breaks the moment a flavour is two words — `harmonic minor`
 * would quietly become root `harmonic`.
 */
describe('the answer comes from its own fields, never from the scale string', () => {
  const FEATURE = join(SRC, 'features', 'daily-groove')

  // This file names the patterns it bans, so it excludes itself from the scan.
  const files = () =>
    sourceFiles(FEATURE).filter((f) => !f.endsWith('grooves.generated.test.ts'))

  it('never splits, slices, matches or replaces a scale value', () => {
    const offenders = files().filter((file) =>
      /\.scale\s*\.\s*(split|match|slice|replace)\s*\(/.test(
        readFileSync(file, 'utf8'),
      ),
    )
    expect(offenders).toEqual([])
  })

  it('has no scale-string parser to call in the first place', () => {
    const offenders = files().filter((file) =>
      /\bparse[A-Za-z]*Scale\b/.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('gives every entry a root and a flavour to read instead', () => {
    for (const g of GROOVES) {
      expect(g.root.length, g.id).toBeGreaterThan(0)
      expect(g.flavour.length, g.id).toBeGreaterThan(0)
    }
  })
})

describe('every groove in the catalogue can be spelled', () => {
  // The solved panel calls scaleNotes() unguarded, so a flavour the speller does
  // not know crashes the day it comes up. This is the tripwire for that.
  it('has an interval entry for every flavour the catalogue uses', async () => {
    const { scaleNotes } = await import('./notes')
    for (const g of GROOVES) {
      expect(
        () => scaleNotes({ root: g.root, flavour: g.flavour }),
        `${g.id} (${g.scale}) cannot be spelled`,
      ).not.toThrow()
    }
  })

  it('spells the blues scale with its flat fifth and natural fifth', async () => {
    const { scaleNotes } = await import('./notes')
    expect(scaleNotes({ root: 'C', flavour: 'Blues' })).toEqual(['C', 'E♭', 'F', 'G♭', 'G', 'B♭'])
  })

  it('spells harmonic minor with its raised seventh', async () => {
    const { scaleNotes } = await import('./notes')
    expect(scaleNotes({ root: 'A', flavour: 'Harmonic minor' })).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G♯',
    ])
  })
})

describe('the catalogue is a real rotation', () => {
  it('holds sixteen grooves', () => {
    expect(GROOVES).toHaveLength(16)
  })

  it('puts exactly two grooves behind every flavour it offers', () => {
    const counts = new Map<string, number>()
    for (const g of GROOVES) counts.set(g.flavour, (counts.get(g.flavour) ?? 0) + 1)
    expect(counts.size).toBe(8)
    for (const [flavour, n] of counts) expect(n, flavour).toBe(2)
  })

  it('asks a different question every day it can', () => {
    const answers = GROOVES.map((g) => `${g.root} ${g.flavour}`)
    expect(new Set(answers).size).toBe(GROOVES.length)
  })

  it('exports distractor pools that cover every answer the catalogue uses', async () => {
    const mod = await import('./grooves.generated')
    const pools = mod as unknown as {
      SCALE_POOL: string[]
      CHORD_POOL: string[]
      PROGRESSION_POOL: string[]
    }
    for (const g of GROOVES) {
      expect(pools.SCALE_POOL, g.id).toContain(g.scale)
      expect(pools.CHORD_POOL, g.id).toContain(g.chord)
      expect(pools.PROGRESSION_POOL, g.id).toContain(g.progression)
    }
    // Enough distinct members that a four-option picker can always be filled.
    expect(new Set(pools.SCALE_POOL).size).toBeGreaterThanOrEqual(
      new Set(GROOVES.map((g) => g.scale)).size + 4,
    )
  })
})
