import type { Root } from '../groove'
import { noteName, pitchClassOf } from './roots'

export type Written = 'C' | 'B♭' | 'E♭' | 'F'

export const WRITTEN: readonly Written[] = ['C', 'B♭', 'E♭', 'F']

const OFFSET: Record<Written, number> = { C: 0, 'B♭': 2, 'E♭': 9, F: 7 }

export function writtenRoot(root: Root, written: Written): Root {
  return noteName(pitchClassOf(root) + OFFSET[written])
}
