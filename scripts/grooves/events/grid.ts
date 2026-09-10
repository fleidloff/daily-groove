import type { FeelTemplate } from '../types.ts'

export const BEATS_PER_BAR = 4

export const BARS_PER_PASS = 4

export const PATTERN_RESOLUTION = 16

export const QUARTER_STEPS_16 = [0, 4, 8, 12]

function scaleStep(step: number, subdivision: number): number {
  return Math.min(subdivision - 1, Math.round((step * subdivision) / PATTERN_RESOLUTION))
}

export function gridSteps(steps: number[], subdivision: number): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const source of [...steps].sort((a, b) => a - b)) {
    const step = scaleStep(source, subdivision)
    if (seen.has(step)) continue
    seen.add(step)
    out.push(step)
  }
  return out
}

// A pool figure may run past its first bar: step 18 is bar 2's step 2. Splitting it
// here is what lets one drawn figure span bars while the emission stays per bar.
export function figureBars(steps: number[], subdivision: number): number[][] {
  const bars = Math.floor(Math.max(...steps) / PATTERN_RESOLUTION) + 1
  return Array.from({ length: bars }, (_, bar) =>
    gridSteps(
      steps.filter((step) => Math.floor(step / PATTERN_RESOLUTION) === bar).map(
        (step) => step % PATTERN_RESOLUTION,
      ),
      subdivision,
    ),
  )
}

export function ghostSteps(steps: number[], subdivision: number): number[] {
  const seen = new Set<number>()
  const out: number[] = []
  for (const source of [...steps].sort((a, b) => a - b)) {
    const scaled = (source * subdivision) / PATTERN_RESOLUTION
    const odd = 2 * Math.round((scaled - 1) / 2) + 1
    const step = Math.min(subdivision - 1, Math.max(1, odd))
    if (seen.has(step)) continue
    seen.add(step)
    out.push(step)
  }
  return out
}

export function featherSteps(
  sounding: number[],
  subdivision: FeelTemplate['subdivision'],
): number[] {
  return gridSteps(QUARTER_STEPS_16, subdivision).filter((step) => !sounding.includes(step))
}

export function middlePassOf(passes: number): number | null {
  if (passes < 3) return null
  return Math.floor((passes - 1) / 2)
}

export function sixteenthOf(step: number, subdivision: number): number {
  return (step * PATTERN_RESOLUTION) / subdivision
}
