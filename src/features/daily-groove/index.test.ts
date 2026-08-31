import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as publicSurface from './index'
import { GroovePuzzle } from './index'
import type { Answer, Attempt, DailyResult, Flavour, Groove, Root } from './index'
import { renderFeature, settleFeature } from './testing/renderFeature'

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
      headDelaySeconds: 0.025057,
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

/**
 * Feature-9, Epic 1, Step D3 (R9a, R10; AC9, AC10).
 *
 * The transport cannot derive the sounding bar from position alone once the
 * file is longer than the four-bar figure, so the page hands it a pass count
 * derived from the groove's own two lengths. That derivation is the feature's,
 * not the panel's — and nothing it produces reaches the screen as wording.
 */
describe('the composed feature and its pass count', () => {
  /** A groove of two passes: an eight-bar file of a four-bar figure. */
  const twoPassGroove: Groove = {
    id: 'groove-01',
    audioSrc: '/grooves/groove-01.mp3',
    name: 'Velvet Pocket',
    bpm: 98,
    scale: 'G dorian',
    chord: 'Gm7',
    progression: 'Gm–C–Gm',
    root: 'G',
    flavour: 'Dorian',
    bars: 4,
    loopBars: 8,
    headDelaySeconds: 0.025057,
  }

  async function renderGroove(groove: Groove) {
    const result = render(createElement(GroovePuzzle, { groove }))
    await settleFeature()
    return result
  }

  it('renders a groove whose file is longer than its figure (R9a, AC9)', async () => {
    await renderGroove(twoPassGroove)

    // The transport is composed and satisfied: a missing pass count would
    // leave the panel unrenderable rather than merely mis-scaled.
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getAllByTestId('progress-divider')).toHaveLength(4 - 1)
  })

  it('still renders an entry that carries no loop length at all (R9a)', async () => {
    // A manifest written before `loopBars` existed: one pass, drawn as today.
    const noLoopBars: Groove = { ...twoPassGroove }
    delete noLoopBars.loopBars
    await renderGroove(noLoopBars)

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('names or counts no sounding pass anywhere on the page (R10, AC10)', async () => {
    const { container } = await renderGroove(twoPassGroove)

    expect(screen.queryByText(/of 4/)).toBeNull()
    expect(screen.queryByText(/of 2/)).toBeNull()
    expect(screen.queryByText(/pass/i)).toBeNull()
    expect(container.textContent).not.toMatch(/\bpass(es)?\b/i)
  })

  it("says nothing about passes on today's real groove either (R10, AC10)", async () => {
    const { container } = await renderFeature()

    expect(screen.queryByText(/pass/i)).toBeNull()
    expect(container.textContent).not.toMatch(/\bpass(es)?\b/i)
  })
})
