import type { Answer } from '../groove'
import { pitchClassOfNote } from './notes'
import { ROOTS } from './roots'
import { type Written, writtenRoot } from './transpose'

const LEADING_ROOT = /^([A-G][♯♭]?)([\s\S]*)$/

export function writtenAnswer(answer: Answer, written: Written): Answer {
  return { root: writtenRoot(answer.root, written), flavour: answer.flavour }
}

export function writtenChord(symbol: string, written: Written): string {
  if (written === 'C') return symbol
  const match = LEADING_ROOT.exec(symbol)
  if (match === null) return symbol
  const [, root, suffix] = match
  return `${writtenRoot(ROOTS[pitchClassOfNote(root)], written)}${suffix}`
}
