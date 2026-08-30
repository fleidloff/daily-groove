import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it, expect } from 'vitest'
import type { Answer, Groove } from '../../types'
import { GROOVES } from '../../data/grooves.generated'
import { selectGrooveForDate } from '../puzzle/selectGroove'
import {
  ROOTS,
  answerOf,
  flavourOptions,
  flavourPool,
  loopSecondsOf,
  simpleRootOptions,
} from './music'

describe('answerOf', () => {
  it("reads the answer from the groove's own root and flavour fields", () => {
    const groove = { ...GROOVES[0], root: 'A' as const, flavour: 'Dorian' }
    expect(answerOf(groove)).toEqual({ root: 'A', flavour: 'Dorian' })
  })

  it('keeps a two-word flavour intact, which a parse of `scale` would not', () => {
    // 'E\u266d harmonic minor' split on the first space gives flavour
    // 'harmonic minor' but a naive split gives root 'harmonic'. Reading the
    // fields cannot go wrong either way.
    const groove = {
      ...GROOVES[0],
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
    const groove = { ...GROOVES[0], scale: 'nonsense', root: 'G' as const, flavour: 'Major' }
    expect(answerOf(groove)).toEqual({ root: 'G', flavour: 'Major' })
  })
})

describe('ROOTS', () => {
  it('offers all twelve chromatic notes', () => {
    expect(ROOTS).toHaveLength(12)
    expect(new Set(ROOTS).size).toBe(12)
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

describe('flavourPool', () => {
  it('is exactly the set of flavours the catalogue actually uses', () => {
    // Asserted as a property of the data rather than against a fixed list, so
    // the test keeps its meaning when the generated catalogue changes.
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
    // A flavour no real groove carries, so this cannot pass vacuously.
    const extra = { ...GROOVES[0], id: 'extra', scale: 'C whole tone', flavour: 'Whole tone' }
    expect(flavourPool(GROOVES)).not.toContain('Whole tone')
    expect(flavourPool([...GROOVES, extra])).toContain('Whole tone')
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
      const groove = GROOVES[2]
      const options = flavourOptions(date, groove)
      expect(options).toHaveLength(4)
      expect(options).toContain(groove.flavour)
      expect(new Set(options).size).toBe(4)
    },
  )

  it('is stable for the same date', () => {
    const date = new Date(2026, 7, 29)
    const groove = GROOVES[3]
    expect(flavourOptions(date, groove)).toEqual(flavourOptions(date, groove))
  })

  it('draws only from the seeded flavour pool', () => {
    const pool = flavourPool(GROOVES)
    for (const date of dates) {
      for (const option of flavourOptions(date, GROOVES[6])) {
        expect(pool).toContain(option)
      }
    }
  })
})

describe('simpleRootOptions', () => {
  const ANSWER: Answer = { root: 'E\u266d', flavour: 'Dorian' }

  /** Twenty consecutive days, spanning a month boundary and a leap day. */
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
      // A fixed six would leave a groove rooted in E\u266d unanswerable.
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

/**
 * Relocated from `src/app/page.test.tsx` (Epic 3, Step C3). It asserts on the
 * options themselves rather than on rendered chips, so unlike its sibling in
 * `components/puzzle/GuessCard.test.tsx` it needs no composed render: the day
 * the player is actually handed must always include the answer.
 */
describe("today's options, as the page resolves them", () => {
  it("offers today's deterministic flavour options, including the answer", () => {
    const today = new Date();
    const groove = selectGrooveForDate(today, GROOVES);
    const expected = flavourOptions(today, groove);

    expect(expected).toContain(groove.flavour);
  })
})

describe('loopSecondsOf', () => {
  it('gives the musical length of the loop from its tempo and bar count', () => {
    // 4 bars of 4/4 at 96bpm is 16 beats, and 16 * 60/96 = 10s exactly.
    expect(loopSecondsOf({ ...GROOVES[0], bpm: 96, bars: 4 })).toBeCloseTo(10, 6)
    expect(loopSecondsOf({ ...GROOVES[0], bpm: 105, bars: 4 })).toBeCloseTo(9.142857, 6)
    expect(loopSecondsOf({ ...GROOVES[0], bpm: 120, bars: 8 })).toBeCloseTo(16, 6)
  })

  it('is positive and finite for every groove in the catalogue', () => {
    for (const groove of GROOVES) {
      const seconds = loopSecondsOf(groove)
      expect(Number.isFinite(seconds)).toBe(true)
      expect(seconds).toBeGreaterThan(0)
    }
  })

  it('refuses a tempo that would make the length meaningless', () => {
    expect(loopSecondsOf({ ...GROOVES[0], bpm: 0 })).toBe(0)
    expect(loopSecondsOf({ ...GROOVES[0], bpm: -1 })).toBe(0)
  })
})

/**
 * Epic 4, Step D2 — the pool is whatever the catalogue carries.
 *
 * The first two blocks below pin behaviour that already holds (R2, R9): the
 * pool is derived from the seed data, and the day's row keeps its shape. They
 * exist so a later change cannot quietly narrow either one.
 *
 * The last two are structural (R7, R8). The rotation *is* the generated
 * catalogue: a groove that should not be played is a groove that is not in
 * `catalogue.json`, so no flag, allowlist or predicate stands between `GROOVES`
 * and either the day's pick or the option pool. That is a claim about the whole
 * source tree, which no import can check, so they read `src/` from disk.
 */
describe('the rotation is the generated catalogue (Epic 4)', () => {
  /** A groove built from nothing, so the pool cases cannot lean on real data. */
  function fake(id: string, flavour: string): Groove {
    return {
      id,
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

  // --- R2: the pool is exactly the catalogue's distinct flavours ------------

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

  it('drops nothing the real catalogue carries (R7)', () => {
    // The size-agnostic form of "no predicate is applied": however many
    // flavours the generated catalogue holds today, the pool holds all of them.
    expect(flavourPool(GROOVES)).toHaveLength(
      new Set(GROOVES.map((g) => g.flavour)).size,
    )
  })

  // --- R9: four options, seeded by the date, always including the answer ----

  it("keeps the day's row at four options including the answer (R9, AC2)", () => {
    for (let i = 0; i < 40; i++) {
      const date = new Date(2026, 0, 1 + i)
      const groove = GROOVES[i % GROOVES.length]
      const options = flavourOptions(date, groove)

      expect(options).toHaveLength(4)
      expect(options).toContain(groove.flavour)
      expect(new Set(options).size).toBe(4)
    }
  })

  it('is stable across repeated calls for the same date (R9, AC2)', () => {
    const date = new Date(2026, 8, 14)
    const groove = GROOVES[5]
    const first = flavourOptions(date, groove)

    for (let i = 0; i < 5; i++) {
      expect(flavourOptions(date, groove)).toEqual(first)
    }
  })

  // --- R7: no retirement flag, no allowlist, no rotation filter -------------

  const SRC = join(process.cwd(), 'src')

  /** Every `.ts`/`.tsx` under `src/` that is not itself a test. */
  function sourceFiles(dir: string = SRC): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return sourceFiles(full)
      if (!/\.tsx?$/.test(entry.name)) return []
      if (/\.(test|spec)\.tsx?$/.test(entry.name)) return []
      return [full]
    })
  }

  /**
   * A file's code with its comments blanked out.
   *
   * The rule is about what the app *does*, not about how it is described, and
   * prose is where a word like "retired" legitimately turns up — the feature
   * already writes about retired components in its own tests. Judging the code
   * keeps these assertions from failing the next time someone describes
   * something accurately.
   */
  function code(file: string): string {
    return readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  }

  /** `path: matched text` for every source file whose code matches `pattern`. */
  function hits(pattern: RegExp): string[] {
    return sourceFiles().flatMap((file) => {
      const found = code(file).match(pattern)
      return found ? [`${relative(process.cwd(), file)}: ${found[0].trim()}`] : []
    })
  }

  it('carries no retirement flag anywhere in the source (R7, AC8)', () => {
    // A groove that should not be played is a groove that is not in
    // `catalogue.json`. Nothing downstream is allowed to learn that a groove
    // was ever there, so there is no field and no constant recording that one
    // was retired.
    //
    // Matched without word boundaries on purpose: `RETIRED_IDS` and
    // `isRetired` are exactly the shapes this is looking for, and `\b` sees
    // neither of them.
    expect(hits(/retire(?:d|s|ment|ing)?/i)).toEqual([])
  })

  it('carries no allowlist or denylist of grooves or flavours (R7, AC8)', () => {
    const verbs = 'allow|deny|block|exclude|skip|omit|hidden|disabled'
    const nouns = 'grooves?|flavours?|modes?'
    expect(
      hits(new RegExp(`\\b(?:${verbs})[_ ]?(?:list|ed)?[_ ]?(?:${nouns})\\b`, 'i')),
    ).toEqual([])
    // The same list under the other word order, e.g. `FLAVOUR_ALLOWLIST`.
    expect(
      hits(new RegExp(`\\b(?:${nouns})[_ ]?(?:${verbs})[_ ]?(?:list|ed)?\\b`, 'i')),
    ).toEqual([])
  })

  it('filters the rotation nowhere (R7, AC8)', () => {
    // Two shapes of the same mistake: narrowing `GROOVES` at a call site, and a
    // predicate that decides on a groove's flavour.
    expect(hits(/\bGROOVES\b[^\n]*\.\s*(?:filter|slice|splice)\s*\(/)).toEqual([])
    expect(
      hits(/\.\s*filter\s*\([^)\n]*\)?\s*=>[^\n]*\b(?:flavour|mode)\b/i),
    ).toEqual([])
  })

  it('hands the whole catalogue to the day’s pick and to the pool (R7, AC8)', () => {
    // The positive half: wherever the rotation is consumed, the argument is the
    // bare generated array.
    const picks = hits(/selectGrooveForDate\([^\n]*\bGROOVES\b\s*\)/)
    expect(picks.length).toBeGreaterThan(0)

    const pools = hits(/flavourPool\(\s*GROOVES\s*\)/)
    expect(pools.length).toBeGreaterThan(0)
  })

  // --- R8: the flavour type stays open -------------------------------------

  it('leaves `Flavour` in src/lib/groove.ts a plain string (R8, AC9)', () => {
    const source = readFileSync(join(SRC, 'lib', 'groove.ts'), 'utf8')
    const declaration = source.match(/export type Flavour\s*=([^\n]*)/)

    expect(declaration).not.toBeNull()
    // Exactly `string` — not a union, not a template literal, not a narrowing
    // of the vocabulary. The pool is derived from the seed data at runtime.
    expect(declaration?.[1].trim()).toBe('string')
  })
})
