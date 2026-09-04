import type { Answer } from '../groove'
import { pitchClassOfNote } from './notes'
import { ROOTS } from './roots'
import { type InstrumentKey, writtenRoot } from './transpose'

const LEADING_ROOT = /^([A-G][♯♭]?)([\s\S]*)$/

export function writtenAnswer(answer: Answer, instrumentKey: InstrumentKey): Answer {
  return { root: writtenRoot(answer.root, instrumentKey), flavour: answer.flavour }
}

export function writtenChord(symbol: string, instrumentKey: InstrumentKey): string {
  if (instrumentKey === 'C') return symbol
  const match = LEADING_ROOT.exec(symbol)
  if (match === null) return symbol
  const [, root, suffix] = match
  return `${writtenRoot(ROOTS[pitchClassOfNote(root)], instrumentKey)}${suffix}`
}
