import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Groove } from '../../src/lib/groove.ts'
import { renderManifest, writeManifest } from './manifest.ts'

const ENTRY: Groove = {
  id: 'groove-01',
  audioSrc: '/grooves/groove-01.mp3',
  name: 'Velvet Pocket',
  bpm: 98,
  scale: 'C♯ minor',
  chord: 'C♯m7',
  progression: 'C♯m–F♯m–G♯7',
  root: 'C♯',
  flavour: 'Harmonic minor',
  bars: 4,
  loopBars: 16,
  headDelaySeconds: 0.025057,
}

const SECOND: Groove = {
  id: 'groove-02',
  audioSrc: '/grooves/groove-02.mp3',
  name: 'Dusty Lantern',
  bpm: 104,
  scale: 'E♭ dorian',
  chord: 'E♭m7',
  progression: 'E♭m7–A♭7–E♭m7',
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

  // AC7: every entry carries all twelve fields, with the right values.
  it('writes all twelve fields of every entry', () => {
    const grooves = evaluate(renderManifest([ENTRY, SECOND]))
    expect(grooves).toEqual([ENTRY, SECOND])
    for (const groove of grooves) {
      expect(Object.keys(groove).sort()).toEqual(Object.keys(ENTRY).sort())
    }
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

  it('holds eighteen grooves', () => {
    expect(grooves).toHaveLength(18)
  })

  it('groups into exactly six modes of three', () => {
    const groups = byFlavour()
    expect(groups.size, [...groups.keys()].sort().join(', ')).toBe(6)
    for (const [flavour, group] of groups) expect(group.length, flavour).toBe(3)
  })

  it('names the six modes and nothing else', () => {
    expect([...byFlavour().keys()].sort()).toEqual([
      'Aeolian',
      'Dorian',
      'Ionian',
      'Lydian',
      'Mixolydian',
      'Phrygian',
    ])
  })

  it('offers no groove whose flavour is Blues or Harmonic minor', () => {
    for (const groove of grooves) {
      expect(['Blues', 'Harmonic minor'], groove.id).not.toContain(groove.flavour)
    }
  })

  it('spells every scale modally, with no major or minor left in it', () => {
    for (const groove of grooves) {
      expect(groove.scale, groove.id).not.toMatch(/\b(major|minor)\b/)
    }
  })
})
