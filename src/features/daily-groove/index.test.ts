import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as publicSurface from './index'
import { GroovePuzzle } from './index'
import type { Answer, Attempt, DailyResult, Flavour, Groove, Root } from './index'

const featureDir = resolve(process.cwd(), 'src/features/daily-groove')
const componentDir = join(featureDir, 'components')

/** Every .ts/.tsx file under `dir`, recursively. */
function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...sourceFiles(full))
    else if (/\.tsx?$/.test(entry.name) && !full.endsWith('index.test.ts')) {
      out.push(full)
    }
  }
  return out
}

/**
 * Components retired across Epics 2-5: the subset-guessing pickers, and the
 * feature-1 views the solved panel and the archive strip replace.
 */
const RETIRED = [
  'AttributeSelector',
  'AttributePicker',
  'ResultReveal',
  'ResultBreakdown',
  'AlreadyPlayed',
  'HistoryView',
]

describe('daily-groove public surface', () => {
  it('exports GroovePuzzle as a component', () => {
    expect(typeof GroovePuzzle).toBe('function')
  })

  it('exports only GroovePuzzle and the shared types (no lib/component internals)', () => {
    // Types are erased at runtime; only the component remains as a value export.
    const runtimeExports = Object.keys(publicSurface)
    expect(runtimeExports).toEqual(['GroovePuzzle'])
    // Guard against leaking internals as runtime values.
    expect(runtimeExports).not.toContain('createDailyGrooveStore')
    expect(runtimeExports).not.toContain('buildOptions')
    expect(runtimeExports).not.toContain('scoreAttempt')
    expect(runtimeExports).not.toContain('selectFeedback')
    expect(runtimeExports).not.toContain('toArchiveEntries')
    expect(runtimeExports).not.toContain('ArchiveStrip')
    expect(runtimeExports).not.toContain('SolvedPanel')
  })

  it('exports exactly the six shared type names (AC14)', () => {
    // Types are erased at runtime, so the surface is pinned by reading the
    // source. Epic 4 moved Root, Flavour and Groove to src/lib/groove.ts; this
    // asserts consumers of the feature saw no change when they left.
    const source = readFileSync(join(featureDir, 'index.ts'), 'utf8')
    const blocks = [...source.matchAll(/export\s+type\s*\{([^}]*)\}/g)]
    const names = blocks
      .flatMap((block) => block[1].split(','))
      .map((name) => name.trim())
      .filter(Boolean)
      .sort()
    expect(names).toEqual([
      'Answer',
      'Attempt',
      'DailyResult',
      'Flavour',
      'Groove',
      'Root',
    ])
  })

  it('exports the root/flavour domain types (Epic 2 contract)', () => {
    // Compile-time assertions: these fail `tsc` if the types stop being part of
    // the public surface, or if their shape drifts from the frozen contract.
    const root: Root = 'G'
    const flavour: Flavour = 'Dorian'
    const answer: Answer = { root, flavour }
    const attempt: Attempt = {
      root,
      flavour,
      correct: true,
      rootMatched: true,
      flavourMatched: true,
    }

    // Groove comes through the same surface, re-exported from src/lib/groove.
    const groove: Groove = {
      id: 'groove-01',
      audioSrc: '/grooves/groove-01.mp3',
      name: 'Velvet Pocket',
      bpm: 98,
      scale: 'G dorian',
      chord: 'Gm7',
      progression: 'Gm–C–Gm',
      root,
      flavour,
      bars: 4,
    }

    expect(answer).toEqual({ root: 'G', flavour: 'Dorian' })
    expect(attempt.correct).toBe(true)
    expect(groove.root).toBe('G')
  })

  it("exports the day's record in its v2 shape (Epic 5 contract)", () => {
    const result: DailyResult = {
      date: '2026-08-29',
      answer: { root: 'G', flavour: 'Dorian' },
      attempts: [],
      solved: false,
    }
    expect(Object.keys(result).sort()).toEqual([
      'answer',
      'attempts',
      'date',
      'solved',
    ])
  })

  it('no longer resolves the retired components', () => {
    // The retired model is gone from disk, not merely unreferenced.
    for (const name of RETIRED) {
      expect(
        existsSync(resolve(componentDir, `${name}.tsx`)),
        `${name}.tsx should be deleted`,
      ).toBe(false)
      expect(
        existsSync(resolve(componentDir, `${name}.test.tsx`)),
        `${name}.test.tsx should be deleted`,
      ).toBe(false)
    }
  })

  it('leaves no reference to the retired components anywhere in the feature', () => {
    // A dynamic `import()` of a deleted module cannot be used here: Vite fails
    // the whole file at transform time rather than rejecting at runtime. A
    // source sweep is the equivalent guard and covers every referrer —
    // comments included, so a stale mention cannot outlive the code.
    const pattern = new RegExp(RETIRED.join('|'))
    const offenders = sourceFiles(featureDir).filter((file) =>
      pattern.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
