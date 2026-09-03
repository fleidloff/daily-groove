import { describe, expect, it } from 'vitest'
import {
  DISPLAY_NAMES,
  FLAVOURS,
  displayFlavour,
  slugOf,
  type ScaleSlug,
} from './names'

// A change-detector, in the shape of src/lib/hash.test.ts's PIN table. These
// twelve slugs, in this order, are scripts/grooves/theory/scales.ts:5-18 as it
// stood before the merge. A reordering re-renders the catalogue.
const FROZEN_ORDER = [
  'ionian',
  'aeolian',
  'dorian',
  'mixolydian',
  'lydian',
  'phrygian',
  'harmonic-minor',
  'blues',
  'melodic-minor',
  'lydian-dominant',
  'phrygian-dominant',
  'harmonic-major',
]

// The display strings the old cli.ts algorithm produced, which are the twelve
// distinct values of the `flavour` field in
// src/features/daily-groove/data/grooves.generated.ts.
const RENDERED_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['ionian', 'Ionian'],
  ['aeolian', 'Aeolian'],
  ['dorian', 'Dorian'],
  ['mixolydian', 'Mixolydian'],
  ['lydian', 'Lydian'],
  ['phrygian', 'Phrygian'],
  ['harmonic-minor', 'Harmonic minor'],
  ['blues', 'Blues'],
  ['melodic-minor', 'Melodic minor'],
  ['lydian-dominant', 'Lydian dominant'],
  ['phrygian-dominant', 'Phrygian dominant'],
  ['harmonic-major', 'Harmonic major'],
]

describe('FLAVOURS', () => {
  it('is the twelve renderable slugs in the frozen order', () => {
    expect(FLAVOURS).toEqual(FROZEN_ORDER)
  })

  it('offers twelve distinct flavours', () => {
    expect(FLAVOURS).toHaveLength(12)
    expect(new Set(FLAVOURS).size).toBe(12)
  })

  it('does not offer locrian — it has no perfect fifth', () => {
    expect(FLAVOURS).not.toContain('locrian')
  })
})

describe('DISPLAY_NAMES', () => {
  it('names thirteen scales, the twelve plus locrian', () => {
    expect(Object.keys(DISPLAY_NAMES)).toHaveLength(13)
    expect(Object.keys(DISPLAY_NAMES)).toContain('locrian')
  })

  it('holds a display name for every renderable flavour', () => {
    for (const slug of FLAVOURS) {
      expect(DISPLAY_NAMES[slug]).toBeTruthy()
    }
  })
})

describe('displayFlavour', () => {
  it.each(RENDERED_PAIRS)(
    'spells %j as the manifest spells it, %j',
    (slug, display) => {
      expect(displayFlavour(slug as ScaleSlug)).toBe(display)
    },
  )

  it('spells the app-only scale', () => {
    expect(displayFlavour('locrian')).toBe('Locrian')
  })

  it('throws on a slug it does not hold', () => {
    expect(() => displayFlavour('bebop' as ScaleSlug)).toThrow(/bebop/)
  })
})

describe('slugOf', () => {
  it.each(Object.keys(DISPLAY_NAMES) as ScaleSlug[])(
    'round-trips %s through its display name',
    (slug) => {
      expect(slugOf(displayFlavour(slug))).toBe(slug)
    },
  )

  it('throws on a display name it does not hold', () => {
    expect(() => slugOf('Bebop')).toThrow(/Bebop/)
  })
})
