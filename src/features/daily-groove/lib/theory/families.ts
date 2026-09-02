import type { Flavour } from '../../types'

export type Family = 'Major' | 'Minor'

export const FAMILIES: Family[] = ['Major', 'Minor']

const FAMILY_OF: Record<string, Family> = {
  Ionian: 'Major',
  Lydian: 'Major',
  Mixolydian: 'Major',
  'Lydian dominant': 'Major',
  'Phrygian dominant': 'Major',
  'Harmonic major': 'Major',
  Dorian: 'Minor',
  Phrygian: 'Minor',
  Aeolian: 'Minor',
  Blues: 'Minor',
  'Harmonic minor': 'Minor',
  'Melodic minor': 'Minor',
}

export class UnknownFamilyError extends Error {
  constructor(mode: Flavour) {
    super(`No family for mode "${mode}"`)
    this.name = 'UnknownFamilyError'
  }
}

export function familyOf(mode: Flavour): Family {
  if (!Object.hasOwn(FAMILY_OF, mode)) throw new UnknownFamilyError(mode)
  return FAMILY_OF[mode]
}
