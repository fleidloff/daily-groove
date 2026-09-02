import type { Answer, Flavour, Groove, Root } from '../../types'
import { buildOptions } from './options'
import { GROOVES } from '../../data/grooves.generated'
import { isoDate } from '../puzzle/selectGroove'

export const ROOTS: Root[] = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
]

export function answerOf(groove: Groove): Answer {
  return { root: groove.root, flavour: groove.flavour }
}

export function flavourPool(grooves: Groove[]): Flavour[] {
  return Array.from(new Set(grooves.map((g) => g.flavour))).sort()
}

export function flavourOptions(date: Date, groove: Groove): Flavour[] {
  return buildOptions(groove.flavour, flavourPool(GROOVES), isoDate(date))
}

export function simpleRootOptions(date: Date, answer: Answer): Root[] {
  return buildOptions(answer.root, ROOTS, isoDate(date), 6) as Root[]
}

const BEATS_PER_BAR = 4

export function loopSecondsOf(groove: Groove): number {
  if (!Number.isFinite(groove.bpm) || groove.bpm <= 0) return 0
  const loopBars =
    Number.isFinite(groove.loopBars) && (groove.loopBars ?? 0) > 0
      ? (groove.loopBars as number)
      : groove.bars
  if (!Number.isFinite(loopBars) || loopBars <= 0) return 0
  return (loopBars * BEATS_PER_BAR * 60) / groove.bpm
}
