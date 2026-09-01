import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Groove } from '../../src/lib/groove.ts'
import { renderManifest, writeManifest } from './manifest.ts'
import { allTemplates } from './templates/index.ts'
import { displayFlavour } from './cli.ts'

const ENTRY: Groove = {
  id: 'groove-01',
  uuid: '4c048e58-88a1-4425-b01b-e74cefc324d1',
  audioSrc: '/grooves/groove-01.mp3',
  name: 'Velvet Pocket',
  bpm: 98,
  scale: 'C♯ minor',
  chord: 'C♯m7',
  progression: 'C♯m–F♯m–G♯7',
  progressionDegrees: [0, 3, 4],
  root: 'C♯',
  flavour: 'Harmonic minor',
  bars: 4,
  loopBars: 16,
  headDelaySeconds: 0.025057,
}

const SECOND: Groove = {
  id: 'groove-02',
  uuid: '1461b138-472c-4bf1-91ca-b40e7c888d7f',
  audioSrc: '/grooves/groove-02.mp3',
  name: 'Dusty Lantern',
  bpm: 104,
  scale: 'E♭ dorian',
  chord: 'E♭m7',
  progression: 'E♭m7–A♭7–E♭m7',
  progressionDegrees: [0, 3, 0],
  root: 'E♭',
  flavour: 'Dorian',
  bars: 4,
  loopBars: 8,
  headDelaySeconds: 0.026122,
}

const dirs: string[] = []

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/**
 * Read the GROOVES array back out of a rendered module, so the assertions are
 * about the values it carries rather than the exact text it uses to spell
 * them. The type-only import is stripped the way Node's own type stripping
 * would strip it.
 */
function evaluate(source: string): Groove[] {
  const pools = source.indexOf('export const SCALE_POOL')
  const body = (pools === -1 ? source : source.slice(0, pools))
    .replace(/^import type .*$/m, '')
    .replace('export const GROOVES: Groove[] =', 'return')
  return new Function(body)() as Groove[]
}

/** Read one exported string-array back out of a rendered module. */
function readPool(source: string, name: string): string[] {
  const match = new RegExp(
    `export const ${name}: string\\[\\] = (\\[[^\\]]*\\])`,
  ).exec(source)
  if (!match) throw new Error(`${name} is not exported`)
  return new Function(`return ${match[1]}`)() as string[]
}

const POOLS = {
  scales: ['A dorian', 'C major', 'C blues'],
  chords: ['Am7', 'Cmaj7', 'Cm7'],
  progressions: ['Am7–D7–Gmaj7', 'Cm7–Fm7–G7'],
}

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'groove-manifest-'))
  dirs.push(dir)
  return dir
}

describe('renderManifest', () => {
  it('opens with a do-not-edit banner', () => {
    const source = renderManifest([ENTRY])
    expect(source.trimStart()).toMatch(/^\/\*\*/)
    expect(source).toMatch(/DO NOT EDIT/i)
    // The banner comes before anything executable.
    expect(source.indexOf('DO NOT EDIT')).toBeLessThan(
      source.indexOf('export const GROOVES'),
    )
  })

  it('imports the Groove type the way the app does', () => {
    const source = renderManifest([ENTRY])
    expect(source).toContain("import type { Groove } from '@/lib/groove'")
    // App-side imports carry no file extension, and go through the `@/` alias:
    // the generated module is compiled by Next, where the alias resolves. Only
    // scripts/ needs the relative path with the extension.
    expect(source).not.toContain("from '@/lib/groove.ts'")
    expect(source).not.toContain("from '../types'")
  })

  it('exports a typed GROOVES array', () => {
    const source = renderManifest([ENTRY])
    expect(source).toContain('export const GROOVES: Groove[] = [')
  })

  // AC7: every entry carries all thirteen fields, with the right values.
  it('writes every field of every entry', () => {
    const grooves = evaluate(renderManifest([ENTRY, SECOND]))
    expect(grooves).toEqual([ENTRY, SECOND])
    for (const groove of grooves) {
      expect(Object.keys(groove).sort()).toEqual(Object.keys(ENTRY).sort())
    }
  })

  // Feature-12, Epic 1, Step A5 — R1, R4, AC1. The uuid is the only identifier a
  // share link carries, so a manifest that dropped it would leave every link in
  // the wild pointing at nothing. It is written directly after `id`, which is
  // what makes the catalogue and the manifest read the same way round.
  it("writes each entry's uuid, directly after its id", () => {
    const source = renderManifest([ENTRY, SECOND])
    expect(source).toMatch(/^ {4}uuid: '4c048e58-88a1-4425-b01b-e74cefc324d1',$/m)
    for (const entry of [ENTRY, SECOND]) {
      expect(source).toContain(`    id: '${entry.id}',\n    uuid: '${entry.uuid}',`)
    }
    // ...and it survives the round trip, not just the text.
    expect(evaluate(source).map((g) => g.uuid)).toEqual([ENTRY.uuid, SECOND.uuid])
  })

  // Epic 2, Step E3: the measured head delay is rendered like any other field,
  // after `bars`. A field the renderer does not list is silently dropped, and
  // the app would then be reading a manifest that had lost it.
  it("writes each entry's measured head delay, after its bar count", () => {
    const source = renderManifest([ENTRY])
    expect(source).toMatch(/^ {4}headDelaySeconds: 0\.025057,$/m)
    expect(source.indexOf('bars: 4,')).toBeLessThan(
      source.indexOf('headDelaySeconds: 0.025057,'),
    )
  })

  // Feature 9, Step C1 — R7, AC8. The figure and the file are two different
  // lengths, so the manifest states both: `bars` is the four-bar figure, and
  // `loopBars` is how much of it the mp3 actually contains. A renderer that
  // lists one and not the other hands the app a groove that cannot say how
  // long it is.
  it("writes each entry's loop length, between its bar count and its head delay", () => {
    const source = renderManifest([ENTRY])
    expect(source).toMatch(/^ {4}loopBars: 16,$/m)
    expect(source.indexOf('bars: 4,')).toBeLessThan(
      source.indexOf('loopBars: 16,'),
    )
    expect(source.indexOf('loopBars: 16,')).toBeLessThan(
      source.indexOf('headDelaySeconds: 0.025057,'),
    )
  })

  it('keeps the two lengths apart, entry by entry', () => {
    const grooves = evaluate(renderManifest([ENTRY, SECOND]))
    expect(grooves.map((g) => g.bars)).toEqual([4, 4])
    expect(grooves.map((g) => g.loopBars)).toEqual([16, 8])
  })

  // `loopBars` is optional on `Groove`, so a manifest can be rendered from an
  // entry that predates the field. It must come out as a module a human could
  // have written, not one carrying the word `undefined`.
  it('omits a field the entry does not carry, rather than writing undefined', () => {
    const older: Groove = { ...ENTRY }
    delete older.loopBars
    const source = renderManifest([older])
    expect(source).not.toContain('undefined')
    expect(source).not.toContain('loopBars')
    expect(evaluate(source)).toEqual([older])
  })

  // Feature 15, Epic 3, Step A4 — R4, R4a, AC5. The degrees are the first array
  // field the manifest has ever written, and a value the renderer cannot spell
  // is a value silently dropped. The line sits directly under the string it
  // describes, so the diff reads as one added line per groove.
  it("writes each entry's degrees as an array, directly under its progression", () => {
    const source = renderManifest([ENTRY])
    expect(source).toMatch(/^ {4}progressionDegrees: \[0, 3, 4\],$/m)
    expect(source.indexOf("progression: '")).toBeLessThan(
      source.indexOf('progressionDegrees:'),
    )
    expect(source.indexOf('progressionDegrees:')).toBeLessThan(
      source.indexOf("root: '"),
    )
  })

  it('round-trips the degrees as the array itself, entry by entry', () => {
    const grooves = evaluate(renderManifest([ENTRY, SECOND]))
    expect(grooves.map((g) => g.progressionDegrees)).toEqual([
      [0, 3, 4],
      [0, 3, 0],
    ])
  })

  // `progressionDegrees` is optional on `Groove`, as `loopBars` is, so the same
  // rule applies to the second optional field: omitted, never `undefined`.
  it('omits the degrees an entry does not carry, rather than writing undefined', () => {
    const older: Groove = { ...ENTRY }
    delete older.progressionDegrees
    const source = renderManifest([older])
    expect(source).not.toContain('undefined')
    expect(source).not.toContain('progressionDegrees')
    expect(evaluate(source)).toEqual([older])
  })

  it('escapes a quote inside a value rather than breaking the literal', () => {
    const awkward: Groove = { ...ENTRY, name: "Ol' \\ Cassette" }
    expect(evaluate(renderManifest([awkward]))).toEqual([awkward])
  })

  it('quotes strings the way the rest of the codebase does', () => {
    const source = renderManifest([ENTRY])
    expect(source).toContain("id: 'groove-01'")
    expect(source).not.toContain('"')
  })

  it('emits the entries in the order it was given', () => {
    const source = renderManifest([ENTRY, SECOND])
    expect(source.indexOf('groove-01')).toBeLessThan(
      source.indexOf('groove-02'),
    )
  })

  it('keeps Unicode accidentals verbatim', () => {
    const source = renderManifest([ENTRY])
    expect(source).toContain('C♯')
    expect(source).not.toContain('\\u')
  })

  it('renders an empty catalogue as an empty array', () => {
    const source = renderManifest([])
    expect(source).toContain('export const GROOVES: Groove[] = []')
  })

  it('is stable — the same entries render the same source', () => {
    expect(renderManifest([ENTRY, SECOND])).toBe(
      renderManifest([ENTRY, SECOND]),
    )
  })

  it('ends with a trailing newline', () => {
    expect(renderManifest([ENTRY]).endsWith('\n')).toBe(true)
  })
})

// AC14: the pools ship in the same generated module as the answers, so they
// cannot drift from them.
describe('renderManifest with pools', () => {
  it('exports the three pools as typed string arrays', () => {
    const source = renderManifest([ENTRY], POOLS)
    expect(source).toContain('export const SCALE_POOL: string[] = [')
    expect(source).toContain('export const CHORD_POOL: string[] = [')
    expect(source).toContain('export const PROGRESSION_POOL: string[] = [')
  })

  it('writes every pool value, in the order it was given', () => {
    const source = renderManifest([ENTRY], POOLS)
    expect(readPool(source, 'SCALE_POOL')).toEqual(POOLS.scales)
    expect(readPool(source, 'CHORD_POOL')).toEqual(POOLS.chords)
    expect(readPool(source, 'PROGRESSION_POOL')).toEqual(POOLS.progressions)
  })

  it('still renders the entries alongside them', () => {
    expect(evaluate(renderManifest([ENTRY, SECOND], POOLS))).toEqual([
      ENTRY,
      SECOND,
    ])
  })

  it('quotes pool values the way it quotes everything else', () => {
    const source = renderManifest([ENTRY], POOLS)
    expect(source).toContain("'A dorian'")
    expect(source).not.toContain('"')
  })

  it('keeps Unicode accidentals in pool values verbatim', () => {
    const source = renderManifest([ENTRY], {
      ...POOLS,
      chords: ['E♭m7♭5'],
    })
    expect(source).toContain('E♭m7♭5')
    expect(source).not.toContain('\\u')
  })

  it('renders an empty pool as an empty array', () => {
    const source = renderManifest([ENTRY], {
      scales: [],
      chords: [],
      progressions: [],
    })
    expect(source).toContain('export const SCALE_POOL: string[] = []')
    expect(source).toContain('export const CHORD_POOL: string[] = []')
    expect(source).toContain('export const PROGRESSION_POOL: string[] = []')
  })

  it('is stable — the same entries and pools render the same source', () => {
    expect(renderManifest([ENTRY], POOLS)).toBe(renderManifest([ENTRY], POOLS))
  })

  it('ends with a trailing newline', () => {
    expect(renderManifest([ENTRY], POOLS).endsWith('\n')).toBe(true)
  })

  it('omits the pool exports when no pools are given', () => {
    const source = renderManifest([ENTRY])
    expect(source).not.toContain('SCALE_POOL')
    expect(source).not.toContain('CHORD_POOL')
    expect(source).not.toContain('PROGRESSION_POOL')
  })
})

describe('writeManifest', () => {
  it('writes the rendered module to the given path', () => {
    const path = join(tempDir(), 'grooves.generated.ts')
    writeManifest([ENTRY], path)
    expect(readFileSync(path, 'utf8')).toBe(renderManifest([ENTRY]))
  })

  it('creates missing parent directories', () => {
    const path = join(tempDir(), 'nested', 'lib', 'grooves.generated.ts')
    writeManifest([ENTRY], path)
    expect(readFileSync(path, 'utf8')).toContain('groove-01')
  })

  it('writes the pools too, when it is given them', () => {
    const path = join(tempDir(), 'grooves.generated.ts')
    writeManifest([ENTRY], path, POOLS)
    expect(readFileSync(path, 'utf8')).toBe(renderManifest([ENTRY], POOLS))
  })

  it('overwrites an existing manifest', () => {
    const path = join(tempDir(), 'grooves.generated.ts')
    writeManifest([ENTRY], path)
    writeManifest([SECOND], path)
    const written = readFileSync(path, 'utf8')
    expect(written).toContain('groove-02')
    expect(written).not.toContain('groove-01')
  })
})

// Step C3 — R4, R5, R5a, AC5, AC6, AC6a. The assertions above are about the
// renderer; these are about the module it actually produced and the app
// actually imports. The manifest is generated, so a failure here is fixed in
// `catalogue.json` and a re-render, never by editing the module.
describe('the committed manifest', () => {
  const MANIFEST_PATH = join(
    import.meta.dirname,
    '..',
    '..',
    'src',
    'features',
    'daily-groove',
    'data',
    'grooves.generated.ts',
  )
  const grooves = evaluate(readFileSync(MANIFEST_PATH, 'utf8'))

  function byFlavour(): Map<string, Groove[]> {
    const groups = new Map<string, Groove[]>()
    for (const groove of grooves) {
      const group = groups.get(groove.flavour) ?? []
      group.push(groove)
      groups.set(groove.flavour, group)
    }
    return groups
  }

  // Feature 15, Epic 3, Step A6 — R4, R4b, AC5, AC11. The shipped file, not a
  // fixture: the app reads this manifest, so the degrees have to be in it.
  //
  // The length claim is AC11's manifest half. A bar's numeral is looked up by
  // the same `[bar % length]` arithmetic that picks its chord symbol, so one
  // degree per named chord is exactly the condition under which no bar can ever
  // render with a symbol and no numeral.
  it('carries one degree per chord of every progression — R4, AC5, AC11', () => {
    expect(grooves.length).toBeGreaterThan(0)
    for (const groove of grooves) {
      const where = groove.id
      expect(Array.isArray(groove.progressionDegrees), where).toBe(true)
      const degrees = groove.progressionDegrees as number[]
      // The progression starts on the tonic, so its first index is the tonic's.
      expect(degrees[0], where).toBe(0)
      expect(degrees.length, where).toBe(groove.progression.split('–').length)
      for (const degree of degrees) {
        expect(Number.isInteger(degree), where).toBe(true)
        expect(degree, where).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('holds a groove for every mode, and lets none dominate', () => {
    // Neither a count nor a fixed mode list: both only record the day they were
    // written, and the catalogue grows every time `grooves:add` runs. What has
    // to hold is that each mode the game can ask about has grooves behind it,
    // and that the older modes have not crowded out the newer ones — a rotation
    // where one answer is six times likelier than another is a worse quiz.
    const groups = byFlavour()
    const sizes = [...groups.values()].map((g) => g.length)
    expect(groups.size, 'the manifest carries fewer modes than expected').toBeGreaterThanOrEqual(
      12,
    )
    expect(Math.max(...sizes)).toBeLessThanOrEqual(Math.min(...sizes) * 3)
  })

  // Feature-9 Epic 6 took the vocabulary from six modes to twelve, so listing
  // them here would only date the assertion again. The claim that matters is
  // that the manifest names nothing the templates do not offer — a flavour in
  // the manifest with no template behind it is a groove nobody can be asked for
  // honestly.
  it('names only modes the templates offer', () => {
    const offered = new Set(allTemplates().flatMap((t) => t.flavours).map(displayFlavour))
    for (const flavour of byFlavour().keys()) {
      expect(offered, `${flavour} is in the manifest but no template offers it`).toContain(flavour)
    }
  })

  // Feature-7 removed the blues and harmonic-minor grooves from the catalogue
  // while leaving both in their templates' flavour arrays, so the pair stayed
  // mintable and ungraded — which was a live crash in simple mode waiting on the
  // day either came up. Feature-9 Epic 6 grades them, and the catalogue carries
  // them again. This is the assertion that reversed; it is kept, inverted, so
  // the reversal is visible rather than an absence.
  it('carries the blues and harmonic-minor grooves its templates offer', () => {
    const flavours = new Set(grooves.map((g) => g.flavour))
    expect(flavours, 'shuffle offers blues but nothing is minted in it').toContain('Blues')
    expect(flavours, 'half-time offers harmonic minor').toContain('Harmonic minor')
  })

  // "C major" and "C minor" were the feature-7 spellings this replaced. The two
  // words survive only inside a mode's own name — harmonic minor, melodic minor,
  // harmonic major — where they are part of the name rather than a substitute
  // for one.
  it('spells every scale modally, with no bare major or minor left in it', () => {
    for (const groove of grooves) {
      const bare = groove.scale.replace(/\b(harmonic|melodic) (minor|major)\b/g, '')
      expect(bare, groove.id).not.toMatch(/\b(major|minor)\b/)
    }
  })
})
