import type { Root } from '../groove'
import { noteName, pitchClassOf } from './roots'

export type InstrumentKey = 'C' | 'B♭' | 'E♭' | 'F'

export const INSTRUMENT_KEYS: readonly InstrumentKey[] = ['C', 'B♭', 'E♭', 'F']

const OFFSET: Record<InstrumentKey, number> = { C: 0, 'B♭': 2, 'E♭': 9, F: 7 }

export function writtenRoot(root: Root, instrumentKey: InstrumentKey): Root {
  return noteName(pitchClassOf(root) + OFFSET[instrumentKey])
}
