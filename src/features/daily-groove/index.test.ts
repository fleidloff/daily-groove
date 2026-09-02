import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import * as publicSurface from './index'
import { GroovePuzzle, grooveByUuid, grooveHref, shareUrlOf } from './index'
import type { Answer, Attempt, DailyResult, Flavour, Groove, Root } from './index'
import { GROOVES } from './data/grooves.generated'
import { renderFeature, settleFeature } from './testing/renderFeature'

const featureDir = resolve(process.cwd(), 'src/features/daily-groove')
const componentDir = join(featureDir, 'components')

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

  it('exports only the named surface and the shared types (no lib/component internals)', () => {
    const runtimeExports = Object.keys(publicSurface).sort()
    expect(runtimeExports).toEqual([
      'GroovePuzzle',
      'grooveByUuid',
      'grooveHref',
      'isTodaysGroove',
      'shareUrlOf',
    ])
    expect(runtimeExports).not.toContain('createDailyGrooveStore')
    expect(runtimeExports).not.toContain('buildOptions')
    expect(runtimeExports).not.toContain('scoreAttempt')
    expect(runtimeExports).not.toContain('selectFeedback')
    expect(runtimeExports).not.toContain('toArchiveEntries')
    expect(runtimeExports).not.toContain('ArchiveStrip')
    expect(runtimeExports).not.toContain('SolvedPanel')
    expect(runtimeExports).not.toContain('shareLink')
    expect(runtimeExports).not.toContain('browserShareDeps')
    expect(runtimeExports).not.toContain('GROOVE_PATH')
    expect(runtimeExports).not.toContain('selectGrooveForDate')
    expect(runtimeExports).not.toContain('GROOVES')
  })

  it('names grooveByUuid, grooveHref, isTodaysGroove and shareUrlOf among its exports (R15)', () => {
    const source = readFileSync(join(featureDir, 'index.ts'), 'utf8')
    const blocks = [...source.matchAll(/export\s+\{([^}]*)\}/g)]
    const names = blocks
      .flatMap((block) => block[1].split(','))
      .map((name) => name.trim())
      .filter(Boolean)
      .sort()

    expect(names).toEqual([
      'GroovePuzzle',
      'grooveByUuid',
      'grooveHref',
      'isTodaysGroove',
      'shareUrlOf',
    ])
  })

  it('resolves the three feature-12 functions as callable values (R15)', () => {
    expect(typeof grooveByUuid).toBe('function')
    expect(typeof grooveHref).toBe('function')
    expect(typeof shareUrlOf).toBe('function')
  })

  it('resolves a groove by uuid and builds its link, through the index alone (R12, R15)', () => {
    const groove = grooveByUuid(GROOVES[0].uuid)
    expect(groove?.id).toBe(GROOVES[0].id)
    expect(grooveHref(GROOVES[0])).toBe(`/groove/${GROOVES[0].uuid}`)
    expect(shareUrlOf(GROOVES[0], 'https://example.test/')).toBe(
      `https://example.test/groove/${GROOVES[0].uuid}`,
    )
  })

  it('exports exactly the six shared type names (AC14)', () => {
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

    const groove: Groove = {
      id: 'groove-01',
      uuid: '39185f2b-f4bf-4fef-b928-65543664a6ec',
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
    const pattern = new RegExp(RETIRED.join('|'))
    const offenders = sourceFiles(featureDir).filter((file) =>
      pattern.test(readFileSync(file, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})

describe('the composed feature and its pass count', () => {
  const twoPassGroove: Groove = {
    id: 'groove-01',
    uuid: '93669912-e0dd-4127-872c-decd7543df6b',
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

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getAllByTestId('progress-divider')).toHaveLength(4 - 1)
  })

  it('still renders an entry that carries no loop length at all (R9a)', async () => {
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
