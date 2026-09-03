import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Flavour, Root } from '@/lib/groove'
import { isoDate } from '@/lib/date'
import { BAR_COUNT, barChords } from '@/lib/theory/changes'
import {
  answerOf,
  flavourOptions,
  flavourPool,
  loopSecondsOf,
} from '@/lib/theory/music'
import { scaleNotes } from '@/lib/theory/notes'
import { ROOTS } from '@/lib/theory/roots'
import { STAFF_FLOOR_STEP, staffNotes } from '@/lib/theory/staff'
import { GROOVES } from './grooves.generated'
import { selectGrooveForDate } from '../lib/puzzle/selectGroove'

const PUBLIC = join(process.cwd(), 'public')
const SRC = join(process.cwd(), 'src')

describe('the generated groove catalogue', () => {
  it('is not empty', () => {
    expect(GROOVES.length).toBeGreaterThan(0)
  })

  it('gives every entry all fourteen fields, correctly typed', () => {
    for (const g of GROOVES) {
      expect(typeof g.id).toBe('string')
      expect(typeof g.uuid).toBe('string')
      expect(typeof g.audioSrc).toBe('string')
      expect(typeof g.name).toBe('string')
      expect(typeof g.bpm).toBe('number')
      expect(typeof g.scale).toBe('string')
      expect(typeof g.chord).toBe('string')
      expect(typeof g.progression).toBe('string')
      expect(typeof g.root).toBe('string')
      expect(typeof g.flavour).toBe('string')
      expect(typeof g.bars).toBe('number')
      expect(typeof g.headDelaySeconds).toBe('number')
      expect(Array.isArray(g.progressionDegrees), g.id).toBe(true)
    }
  })

  it('gives every entry a canonical v4 uuid, and no two the same', () => {
    const CANONICAL =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

    for (const g of GROOVES) {
      expect(g.uuid, g.id).toMatch(CANONICAL)
    }

    expect(new Set(GROOVES.map((g) => g.uuid)).size).toBe(GROOVES.length)
    for (const g of GROOVES) {
      expect(g.uuid, g.id).not.toContain(g.id)
    }
  })

  it('carries a measured head delay for every entry', () => {
    for (const g of GROOVES) {
      expect(Number.isFinite(g.headDelaySeconds), g.id).toBe(true)
      expect(g.headDelaySeconds, g.id).toBeGreaterThanOrEqual(0)
    }
    expect(
      GROOVES.some((g) => g.headDelaySeconds > 0),
      'every head delay is zero — the probe measured nothing',
    ).toBe(true)
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

describe('the answer comes from its own fields, never from the scale string', () => {
  const FEATURE = join(SRC, 'features', 'daily-groove')

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
  it('has an interval entry for every flavour the catalogue uses', async () => {
    const { scaleNotes } = await import('@/lib/theory/notes')
    for (const g of GROOVES) {
      expect(
        () => scaleNotes({ root: g.root, flavour: g.flavour }),
        `${g.id} (${g.scale}) cannot be spelled`,
      ).not.toThrow()
    }
  })

  it('spells the blues scale with its flat fifth and natural fifth', async () => {
    const { scaleNotes } = await import('@/lib/theory/notes')
    expect(scaleNotes({ root: 'C', flavour: 'Blues' })).toEqual(['C', 'E♭', 'F', 'G♭', 'G', 'B♭'])
  })

  it('spells harmonic minor with its raised seventh', async () => {
    const { scaleNotes } = await import('@/lib/theory/notes')
    expect(scaleNotes({ root: 'A', flavour: 'Harmonic minor' })).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G♯',
    ])
  })
})

describe('the changes of every groove read as degrees', () => {
  it('gives every entry one degree per chord, opening on the tonic', () => {
    for (const g of GROOVES) {
      const degrees = g.progressionDegrees as number[]
      expect(degrees.length, g.id).toBeGreaterThan(0)
      for (const degree of degrees) {
        expect(Number.isInteger(degree), `${g.id} degree ${degree}`).toBe(true)
        expect(degree, g.id).toBeGreaterThanOrEqual(0)
      }
      expect(degrees[0], g.id).toBe(0)
      expect(degrees.length, `${g.id} (${g.progression})`).toBe(
        g.progression.split('–').length,
      )
    }
  })

  it('names a numeral in all four bars of every groove', async () => {
    const { barNumerals } = await import('@/lib/theory/numerals')
    const { barChords, BAR_COUNT } = await import('@/lib/theory/changes')
    const NUMERAL = /^[♭♯]{0,2}(I|II|III|IV|V|VI|VII)$/

    for (const g of GROOVES) {
      const numerals = barNumerals(g.flavour, g.progressionDegrees)

      expect(numerals.length, g.id).toBe(BAR_COUNT)
      for (const [bar, numeral] of numerals.entries()) {
        expect(numeral, `${g.id} (${g.flavour}) bar ${bar + 1}`).not.toBe('')
        expect(numeral, `${g.id} (${g.flavour}) bar ${bar + 1}`).toMatch(NUMERAL)
      }
      expect(numerals[0], `${g.id} (${g.flavour})`).toBe('I')
      expect(barChords(g.progression).length, g.id).toBe(numerals.length)
    }
  })
})

describe('the catalogue is a real rotation', () => {
  it('holds enough grooves for a real rotation', () => {
    expect(GROOVES.length).toBeGreaterThanOrEqual(18)
  })

  it('lets no mode dominate the answers', () => {
    const counts = new Map<string, number>()
    for (const g of GROOVES) counts.set(g.flavour, (counts.get(g.flavour) ?? 0) + 1)
    const n = [...counts.values()]
    expect(counts.size, 'the catalogue carries fewer modes than expected').toBeGreaterThanOrEqual(
      12,
    )
    expect(Math.max(...n)).toBeLessThanOrEqual(Math.min(...n) * 3)
  })

  it('carries every mode its own family table can grade', async () => {
    const { familyOf } = await import('@/lib/theory/families')
    for (const g of GROOVES) {
      expect(() => familyOf(g.flavour), `${g.id} (${g.flavour}) cannot be graded`).not.toThrow()
    }
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
    expect(new Set(pools.SCALE_POOL).size).toBeGreaterThanOrEqual(
      new Set(GROOVES.map((g) => g.scale)).size + 4,
    )
  })
})

const ANSWERS_BEFORE_FEATURE_9 = [
  { id: 'groove-01', bpm: 105, scale: 'C mixolydian', chord: 'C7', progression: 'C7–Em7♭5–B♭maj7–Fmaj7', root: 'C', flavour: 'Mixolydian' },
  { id: 'groove-02', bpm: 96, scale: 'E dorian', chord: 'Em7', progression: 'Em7–Bm7–C♯m7♭5', root: 'E', flavour: 'Dorian' },
  { id: 'groove-03', bpm: 103, scale: 'E♭ dorian', chord: 'E♭m7', progression: 'E♭m7–A♭7–Fm7', root: 'E♭', flavour: 'Dorian' },
  { id: 'groove-04', bpm: 103, scale: 'E mixolydian', chord: 'E7', progression: 'E7–Amaj7–Bm7–Amaj7', root: 'E', flavour: 'Mixolydian' },
  { id: 'groove-07', bpm: 91, scale: 'G aeolian', chord: 'Gm7', progression: 'Gm7–B♭maj7–Cm7', root: 'G', flavour: 'Aeolian' },
  { id: 'groove-08', bpm: 91, scale: 'F♯ aeolian', chord: 'F♯m7', progression: 'F♯m7–Amaj7–A♭m7♭5', root: 'F♯', flavour: 'Aeolian' },
  { id: 'groove-09', bpm: 126, scale: 'C♯ lydian', chord: 'C♯maj7', progression: 'C♯maj7–E♭7–Fm7–B♭m7', root: 'C♯', flavour: 'Lydian' },
  { id: 'groove-10', bpm: 121, scale: 'F lydian', chord: 'Fmaj7', progression: 'Fmaj7–Am7–G7–Dm7', root: 'F', flavour: 'Lydian' },
  { id: 'groove-11', bpm: 120, scale: 'B ionian', chord: 'Bmaj7', progression: 'Bmaj7–Emaj7–C♯m7', root: 'B', flavour: 'Ionian' },
  { id: 'groove-12', bpm: 130, scale: 'A ionian', chord: 'Amaj7', progression: 'Amaj7–A♭m7♭5–F♯m7', root: 'A', flavour: 'Ionian' },
  { id: 'groove-13', bpm: 79, scale: 'A♭ phrygian', chord: 'A♭m7', progression: 'A♭m7–Amaj7–F♯m7–Amaj7', root: 'A♭', flavour: 'Phrygian' },
  { id: 'groove-14', bpm: 72, scale: 'D phrygian', chord: 'Dm7', progression: 'Dm7–Gm7–E♭maj7', root: 'D', flavour: 'Phrygian' },
  { id: 'groove-17', bpm: 126, scale: 'D lydian', chord: 'Dmaj7', progression: 'Dmaj7–Bm7–E7', root: 'D', flavour: 'Lydian' },
  { id: 'groove-18', bpm: 96, scale: 'D mixolydian', chord: 'D7', progression: 'D7–Bm7–F♯m7♭5', root: 'D', flavour: 'Mixolydian' },
  { id: 'groove-19', bpm: 79, scale: 'C♯ aeolian', chord: 'C♯m7', progression: 'C♯m7–A♭m7–B7', root: 'C♯', flavour: 'Aeolian' },
  { id: 'groove-20', bpm: 70, scale: 'E phrygian', chord: 'Em7', progression: 'Em7–Am7–Fmaj7–Dm7', root: 'E', flavour: 'Phrygian' },
  { id: 'groove-21', bpm: 126, scale: 'C ionian', chord: 'Cmaj7', progression: 'Cmaj7–Bm7♭5–Dm7–Bm7♭5', root: 'C', flavour: 'Ionian' },
  { id: 'groove-22', bpm: 106, scale: 'A dorian', chord: 'Am7', progression: 'Am7–Cmaj7–D7', root: 'A', flavour: 'Dorian' },
] as const

describe('the answers feature-9 must not move', () => {
  it('still covers every groove it was written to protect', () => {
    const pinned = ANSWERS_BEFORE_FEATURE_9.map((a) => a.id)
    const present = new Set(GROOVES.map((g) => g.id))
    expect(pinned).toHaveLength(18)
    for (const id of pinned) expect(present, `${id} has left the catalogue`).toContain(id)
  })

  it.each(ANSWERS_BEFORE_FEATURE_9)(
    'renders $id with the answer it has always had',
    (pinned) => {
      const groove = GROOVES.find((g) => g.id === pinned.id)
      expect(groove).toBeDefined()
      expect({
        id: groove!.id,
        bpm: groove!.bpm,
        scale: groove!.scale,
        chord: groove!.chord,
        progression: groove!.progression,
        root: groove!.root,
        flavour: groove!.flavour,
      }).toEqual({ ...pinned })
    },
  )
})

describe('over the shipped catalogue', () => {
  it('covers all 30 catalogued grooves', () => {
    expect(GROOVES).toHaveLength(30)
  })

  it.each(GROOVES.map((groove) => [groove.id, groove] as const))(
    'maps %s to four non-empty bars headed by its tonic chord',
    (_id, groove) => {
      const bars = barChords(groove.progression)
      expect(bars).toHaveLength(BAR_COUNT)
      expect(bars).not.toContain('')
      expect(bars[0]).toBe(groove.chord)
    },
  )
})

const steps = (root: Root, flavour: Flavour) =>
  staffNotes(scaleNotes({ root, flavour })).map((n) => n.step)

describe('STAFF_FLOOR_STEP', () => {
  it('holds for every groove the shipped manifest can play', () => {
    expect(GROOVES.length).toBeGreaterThan(0)

    for (const groove of GROOVES) {
      const label = `${groove.id} — ${groove.root} ${groove.flavour}`
      const lowest = Math.min(...steps(groove.root, groove.flavour))

      expect(lowest, label).toBeGreaterThanOrEqual(STAFF_FLOOR_STEP)
    }
  })
})

describe('every groove in the catalogue', () => {
  it.each(GROOVES.map((g) => [g.id, g] as const))(
    '%s answers to a known root and a non-empty flavour',
    (_id, groove) => {
      const answer = answerOf(groove)
      expect(ROOTS).toContain(answer.root)
      expect(answer.flavour.length).toBeGreaterThan(0)
    },
  )
})

describe('the flavour pool over the shipped catalogue', () => {
  it('is exactly the set of flavours the catalogue actually uses', () => {
    const used = GROOVES.map((g) => g.flavour)
    expect(flavourPool(GROOVES)).toEqual([...new Set(used)].sort())
  })

  it('omits a flavour no groove uses', () => {
    expect(flavourPool(GROOVES)).not.toContain('Whole tone')
  })

  it('has no duplicates', () => {
    const pool = flavourPool(GROOVES)
    expect(new Set(pool).size).toBe(pool.length)
  })

  it('widens automatically when a groove uses a new flavour', () => {
    const extra = { ...GROOVES[0], id: 'extra', scale: 'C whole tone', flavour: 'Whole tone' }
    expect(flavourPool(GROOVES)).not.toContain('Whole tone')
    expect(flavourPool([...GROOVES, extra])).toContain('Whole tone')
  })

  it('carries exactly the twelve flavours the theory module names (F20 E1 R4)', async () => {
    const { FLAVOURS, displayFlavour } = await import('@/lib/theory/names')
    expect(flavourPool(GROOVES)).toEqual(FLAVOURS.map(displayFlavour).sort())
  })
})

describe("today's options, as the page resolves them", () => {
  it("offers today's deterministic flavour options, including the answer", () => {
    const today = new Date();
    const groove = selectGrooveForDate(today, GROOVES);
    const expected = flavourOptions(today, groove, GROOVES);

    expect(expected).toContain(groove.flavour);
  })
})

describe('loopSecondsOf', () => {
  it('is positive and finite for every groove in the catalogue', () => {
    for (const groove of GROOVES) {
      const seconds = loopSecondsOf(groove)
      expect(Number.isFinite(seconds)).toBe(true)
      expect(seconds).toBeGreaterThan(0)
    }
  })
})

describe('the rotation is the generated catalogue', () => {
  it('drops nothing the real catalogue carries (R7)', () => {
    expect(flavourPool(GROOVES)).toHaveLength(
      new Set(GROOVES.map((g) => g.flavour)).size,
    )
  })

  it("keeps the day's row at four options including the answer (R9, AC2)", () => {
    for (let i = 0; i < 40; i++) {
      const date = new Date(2026, 0, 1 + i)
      const groove = GROOVES[i % GROOVES.length]
      const options = flavourOptions(date, groove, GROOVES)

      expect(options).toHaveLength(4)
      expect(options).toContain(groove.flavour)
      expect(new Set(options).size).toBe(4)
    }
  })

  it('is stable across repeated calls for the same date (R9, AC2)', () => {
    const date = new Date(2026, 8, 14)
    const groove = GROOVES[5]
    const first = flavourOptions(date, groove, GROOVES)

    for (let i = 0; i < 5; i++) {
      expect(flavourOptions(date, groove, GROOVES)).toEqual(first)
    }
  })
})
