import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GROOVES } from './grooves.generated'
import { isoDate, selectGrooveForDate } from '../lib/puzzle/selectGroove'

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
      // F15 E3 — the changes read as degrees. The field travels beside the
      // progression it describes, and every shipped groove carries it.
      expect(Array.isArray(g.progressionDegrees), g.id).toBe(true)
    }
  })

  /**
   * Feature-12, Epic 1 — R1, R1a, R2, R3, AC1, AC14.
   *
   * The uuid is the only identifier a share link carries, so a manifest that
   * lost it, lower-cased it differently, or repeated one is a manifest whose
   * links point at the wrong groove or at nothing. It is asserted *here*, on
   * the committed file, and not only through the two consumers that happen to
   * iterate `GROOVES` — `grooveByUuid` and `grooveHref` — because dropping
   * `'uuid'` from `FIELDS` in `scripts/grooves/manifest.ts` must fail the test
   * that owns the manifest, not just the tests that read it.
   */
  it('gives every entry a canonical v4 uuid, and no two the same', () => {
    // Canonical: lowercase, hyphenated, 36 characters, version nibble 4 and a
    // variant nibble of 8/9/a/b. The same shape `scripts/grooves/uuid.ts`
    // enforces on the catalogue this file is generated from.
    const CANONICAL =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

    for (const g of GROOVES) {
      expect(g.uuid, g.id).toMatch(CANONICAL)
    }

    expect(new Set(GROOVES.map((g) => g.uuid)).size).toBe(GROOVES.length)
    // And it is a second identifier, never a restatement of the first: a uuid
    // derived from the catalogue position would not survive a renumbering,
    // which is the whole reason it exists.
    for (const g of GROOVES) {
      expect(g.uuid, g.id).not.toContain(g.id)
    }
  })

  // Epic 2, Step E6: the head delay is measured from each mp3 by ffprobe at
  // render time. The app reads the number it was given rather than inferring
  // one, so a manifest that lost it is a manifest the player cannot use.
  it('carries a measured head delay for every entry', () => {
    for (const g of GROOVES) {
      expect(Number.isFinite(g.headDelaySeconds), g.id).toBe(true)
      expect(g.headDelaySeconds, g.id).toBeGreaterThanOrEqual(0)
    }
    // Sixteen zeroes would pass every assertion above while meaning the probe
    // silently failed on every file, so at least one must be a real offset.
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
    const { scaleNotes } = await import('../lib/theory/notes')
    for (const g of GROOVES) {
      expect(
        () => scaleNotes({ root: g.root, flavour: g.flavour }),
        `${g.id} (${g.scale}) cannot be spelled`,
      ).not.toThrow()
    }
  })

  it('spells the blues scale with its flat fifth and natural fifth', async () => {
    const { scaleNotes } = await import('../lib/theory/notes')
    expect(scaleNotes({ root: 'C', flavour: 'Blues' })).toEqual(['C', 'E♭', 'F', 'G♭', 'G', 'B♭'])
  })

  it('spells harmonic minor with its raised seventh', async () => {
    const { scaleNotes } = await import('../lib/theory/notes')
    expect(scaleNotes({ root: 'A', flavour: 'Harmonic minor' })).toEqual([
      'A', 'B', 'C', 'D', 'E', 'F', 'G♯',
    ])
  })
})

/**
 * Feature-15, Epic 3, Step D5 — R2a, R4, AC5, AC8, AC11.
 *
 * The lead sheet writes a numeral under every bar of every day, so a groove
 * whose degrees are missing, short, or point at a note its flavour does not have
 * is a blank bar on the one screen that owes the player the answer. The sweep is
 * over the shipped manifest rather than a sample: a sample passes on precisely
 * the day a thirteenth mode is minted. A failure here names a flavour or an
 * index, and it is fixed in `lib/theory/numerals.ts` or in the generator's
 * `chordsForScale` — never by narrowing this test.
 */
describe('the changes of every groove read as degrees', () => {
  it('gives every entry one degree per chord, opening on the tonic', () => {
    for (const g of GROOVES) {
      const degrees = g.progressionDegrees as number[]
      expect(degrees.length, g.id).toBeGreaterThan(0)
      for (const degree of degrees) {
        expect(Number.isInteger(degree), `${g.id} degree ${degree}`).toBe(true)
        expect(degree, g.id).toBeGreaterThanOrEqual(0)
      }
      // Bar one is the tonic, so the first index is the root's own (AC10).
      expect(degrees[0], g.id).toBe(0)
      // One index per chord symbol: no chord without a degree, and no degree
      // without a chord (AC5).
      expect(degrees.length, `${g.id} (${g.progression})`).toBe(
        g.progression.split('–').length,
      )
    }
  })

  it('names a numeral in all four bars of every groove', async () => {
    const { barNumerals } = await import('../lib/theory/numerals')
    const { barChords, BAR_COUNT } = await import('../lib/theory/changes')
    // A numeral is a degree of the day's own scale, spelled with at most a
    // double accidental — never a quality and never a figured bass.
    const NUMERAL = /^[♭♯]{0,2}(I|II|III|IV|V|VI|VII)$/

    for (const g of GROOVES) {
      const numerals = barNumerals(g.flavour, g.progressionDegrees)

      expect(numerals.length, g.id).toBe(BAR_COUNT)
      // No blank bar: every one of the four carries a numeral (AC8, AC11).
      for (const [bar, numeral] of numerals.entries()) {
        expect(numeral, `${g.id} (${g.flavour}) bar ${bar + 1}`).not.toBe('')
        expect(numeral, `${g.id} (${g.flavour}) bar ${bar + 1}`).toMatch(NUMERAL)
      }
      expect(numerals[0], `${g.id} (${g.flavour})`).toBe('I')
      // And a symbol and a numeral in one bar always come as a pair, because
      // both rows go through the same bar arithmetic.
      expect(barChords(g.progression).length, g.id).toBe(numerals.length)
    }
  })
})

describe('the catalogue is a real rotation', () => {
  // Epic 4 (feature-7) took the rotation from sixteen to eighteen: six
  // replacements minted, then the two `Blues` and two `Harmonic minor` grooves
  // deleted from `catalogue.json`. The rotation only ever grew — 16 → 22 → 18.
  it('holds enough grooves for a real rotation', () => {
    // Not a fixed count. The catalogue grows every time `grooves:add` runs, and
    // pinning a number records the day the test was written rather than a
    // property of the rotation.
    expect(GROOVES.length).toBeGreaterThanOrEqual(18)
  })

  // Feature-9 Epic 6 took the vocabulary from six modes to twelve, so a fixed
  // list of six no longer describes it. The property that list existed for is
  // that no answer is much likelier than another.
  it('lets no mode dominate the answers', () => {
    const counts = new Map<string, number>()
    for (const g of GROOVES) counts.set(g.flavour, (counts.get(g.flavour) ?? 0) + 1)
    const n = [...counts.values()]
    expect(counts.size, 'the catalogue carries fewer modes than expected').toBeGreaterThanOrEqual(
      12,
    )
    expect(Math.max(...n)).toBeLessThanOrEqual(Math.min(...n) * 3)
  })

  // Feature-7 retired the blues and harmonic-minor grooves while leaving both
  // modes in their templates, so they stayed mintable and ungraded — a crash in
  // simple mode waiting on the day either came up. Feature-9 Epic 6 grades them
  // and the catalogue carries them again. This assertion is inverted rather than
  // deleted so the reversal is visible in the record.
  it('carries every mode its own family table can grade', async () => {
    const { familyOf } = await import('../lib/theory/families')
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
    // Enough distinct members that a four-option picker can always be filled.
    expect(new Set(pools.SCALE_POOL).size).toBeGreaterThanOrEqual(
      new Set(GROOVES.map((g) => g.scale)).size + 4,
    )
  })
})

/**
 * The answers as they stood before feature-9 re-rendered the catalogue.
 *
 * This is a regression guard, not a description. Feature-9 changes how every
 * groove *sounds* — passes, instruments, timing, voicings, fills — and none of
 * that may change what a groove *is*, because a player's stored history refers
 * to grooves by id. A record of solving `groove-07` has to keep describing the
 * music it described when they solved it.
 *
 * The generator guarantees this by construction: the stream that draws tempo,
 * root, flavour and harmony keeps the label `events` and its draw order, and
 * every later change draws from `rhythm` instead. This table is what proves the
 * guarantee held.
 *
 * When it fails, the fix is the generator's draw order — never this table.
 */
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
    // A subset, not the whole catalogue. The table guards the eighteen that
    // existed when feature-9 began re-rendering — grooves whose ids are already
    // in players' stored history. Grooves minted since have no history to
    // protect and must not be pinned, or every future mint would have to edit
    // this table to pass.
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
