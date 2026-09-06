import type { BongoFigure, FeelTemplate, FixedFigure, KitFigure, Subdivision } from './types.ts'

export const PATTERN_VOICES = [
  'kick',
  'hatClosed',
  'ride',
  'bass',
  'comp',
  'bongos',
  'snareGhosts',
  'kit',
] as const

export type PatternVoice = (typeof PATTERN_VOICES)[number]

// events.ts owns the same two bounds and asserts they agree; patterns.ts may not
// import from events.ts without a cycle.
export const PATTERN_GRID = 16
export const FIGURE_BARS_PER_PASS = 4

// events.ts' PLACEMENTS, seen through the one line this file cares about.
export type PlacementTable = Record<string, { snare?: number[]; [key: string]: unknown }>

const FLAT_POOLS = ['kick', 'hatClosed', 'bass', 'comp', 'snareGhosts'] as const

function fail(templateId: string, subject: string, detail: string): never {
  throw new Error(`${templateId}: ${subject} ${detail}`)
}

function assertSteps(templateId: string, subject: string, steps: number[]): void {
  for (const step of steps) {
    if (!Number.isInteger(step) || step < 0 || step >= PATTERN_GRID) {
      fail(
        templateId,
        subject,
        `has step ${step}, outside the 0…${PATTERN_GRID - 1} sixteenth grid`,
      )
    }
  }
}

function assertFlatPool(templateId: string, subject: string, pool: number[][]): void {
  if (pool.length === 0) fail(templateId, subject, 'is an empty pool')
  for (const figure of pool) {
    if (figure.length === 0) fail(templateId, subject, 'holds a figure with no steps')
    assertSteps(templateId, subject, figure)
  }
}

function assertBongoPool(templateId: string, pool: BongoFigure[]): void {
  const subject = 'patterns.bongos'
  if (pool.length === 0) fail(templateId, subject, 'is an empty pool')
  for (const figure of pool) {
    if (figure.high.length === 0 && figure.low.length === 0) {
      fail(templateId, subject, 'holds a figure with no steps')
    }
    assertSteps(templateId, subject, figure.high)
    assertSteps(templateId, subject, figure.low)
  }
}

function assertRidePool(
  templateId: string,
  pool: Partial<Record<Subdivision, number[][]>>,
): void {
  const entries = Object.entries(pool) as [string, number[][]][]
  if (entries.length === 0) fail(templateId, 'patterns.ride', 'names no subdivision')
  for (const [subdivision, figures] of entries) {
    assertFlatPool(templateId, `patterns.ride[${subdivision}]`, figures)
  }
}

function assertKitPool(templateId: string, pool: KitFigure[]): void {
  const subject = 'patterns.kit'
  if (pool.length === 0) fail(templateId, subject, 'is an empty pool')
  for (const figure of pool) {
    if (figure.snare.length === 0) fail(templateId, subject, 'holds a figure with no snare steps')
    const lines: [string, number[]][] = [
      ['snare', figure.snare],
      ['tomHigh', figure.tomHigh ?? []],
      ['tomLow', figure.tomLow ?? []],
    ]
    for (const [line, steps] of lines) {
      assertSteps(templateId, subject, steps)
      const seen = new Set<number>()
      for (const step of steps) {
        if (seen.has(step)) fail(templateId, subject, `repeats step ${step} in its ${line} line`)
        seen.add(step)
      }
    }
    for (const [line, steps] of lines.slice(1)) {
      for (const step of steps) {
        if (figure.snare.includes(step)) {
          fail(templateId, subject, `puts ${line} on step ${step}, where its own snare sounds`)
        }
      }
    }
  }
}

export function assertPatterns(
  template: FeelTemplate,
  placements: PlacementTable = {},
): void {
  const pools = template.patterns
  if (!pools) return

  for (const voice of PATTERN_VOICES) {
    if (pools[voice] === undefined) continue
    if ((FLAT_POOLS as readonly string[]).includes(voice)) {
      assertFlatPool(template.id, `patterns.${voice}`, pools[voice] as number[][])
    } else if (voice === 'ride') {
      assertRidePool(template.id, pools.ride as Partial<Record<Subdivision, number[][]>>)
    } else if (voice === 'bongos') {
      assertBongoPool(template.id, pools.bongos as BongoFigure[])
    } else {
      assertKitPool(template.id, pools.kit as KitFigure[])
    }
  }

  if (pools.kit && placements[template.id]?.snare) {
    fail(
      template.id,
      'patterns.kit',
      `and PLACEMENTS['${template.id}'].snare both set the snare line; declare one or the other`,
    )
  }
}

function assertFigure(templateId: string, figure: FixedFigure): void {
  const subject = `figures.${figure.voice}`

  if (figure.voice === 'snare') {
    fail(templateId, subject, 'may not name the snare, which comes from placement.snare or patterns.kit')
  }
  if (figure.bars.length === 0) fail(templateId, subject, 'has no bars')
  if (figure.bars.every((bar) => bar.length === 0)) fail(templateId, subject, 'sounds in no bar')
  for (const bar of figure.bars) assertSteps(templateId, subject, bar)

  // events.test.ts's `takes the toms out of the variation` is registry-wide over
  // every four-pass template, so a tom sounding in the last bar of a pass fails it.
  if (figure.voice === 'tomHigh' || figure.voice === 'tomLow') {
    const last = figure.bars[(FIGURE_BARS_PER_PASS - 1) % figure.bars.length]
    if (last.length > 0) {
      fail(templateId, subject, 'sounds in the last bar of a pass, which is the variation bar')
    }
  }
}

export function assertFigures(template: FeelTemplate): void {
  for (const figure of template.figures ?? []) assertFigure(template.id, figure)
}
