import type { Answer, Flavour, Groove, Root } from '../groove'
import { isoDate } from '../date'
import { buildOptions } from './options'
import { ROOTS } from './roots'

export function answerOf(groove: Groove): Answer {
  return { root: groove.root, flavour: groove.flavour }
}

export function flavourPool(grooves: Groove[]): Flavour[] {
  return Array.from(new Set(grooves.map((g) => g.flavour))).sort()
}

// Named because the copy states them. `puzzle.simpleModeOff` says how many modes the
// full row offers and `puzzle.simpleModeOn` how many roots the simple row offers, and
// ModeToggle.test.tsx counts the words in those captions against these, and this
// module's own test pins the option lengths to them, so the number in the copy and
// the number of chips cannot part company. A caption that disagreed with its row is
// what quick-19 was opened for. (Not snippets.test.ts: src/lib/snippets/ and
// src/lib/theory/ may not name each other — see structure.test.ts's "snippets and
// theory are siblings".) Two constants rather than one: both are 6 today
// and that is a coincidence, so a shared one would make changing either silently
// change the other.
export const MODE_OPTION_COUNT = 6
export const SIMPLE_ROOT_OPTION_COUNT = 6

export function flavourOptions(
  date: Date,
  groove: Groove,
  grooves: Groove[],
): Flavour[] {
  return buildOptions(
    groove.flavour,
    flavourPool(grooves),
    isoDate(date),
    MODE_OPTION_COUNT,
  )
}

export function simpleRootOptions(date: Date, answer: Answer): Root[] {
  return buildOptions(
    answer.root,
    ROOTS,
    isoDate(date),
    SIMPLE_ROOT_OPTION_COUNT,
  ) as Root[]
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
