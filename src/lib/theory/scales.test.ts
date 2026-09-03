import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DISPLAY_NAMES, FLAVOURS, displayFlavour, type ScaleSlug } from './names'
import {
  FLAVOUR_INTERVALS,
  INTERVALS,
  MAJOR_INTERVALS,
  intervalsFor,
  pitchesOf,
  scaleName,
} from './scales'

const ALL: ScaleSlug[] = [
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

const ADDED: ScaleSlug[] = [
  'melodic-minor',
  'lydian-dominant',
  'phrygian-dominant',
  'harmonic-major',
]

// A change-detector. This is src/features/daily-groove/lib/theory/notes.ts:40-54
// as it stood before the merge — the display-keyed table the app read. The
// derivation in scales.ts must reproduce it value for value.
const APP_TABLE: Record<string, number[]> = {
  Ionian: [0, 2, 4, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  'Harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  Blues: [0, 3, 5, 6, 7, 10],
  'Melodic minor': [0, 2, 3, 5, 7, 9, 11],
  'Lydian dominant': [0, 2, 4, 6, 7, 9, 10],
  'Phrygian dominant': [0, 1, 4, 5, 7, 8, 10],
  'Harmonic major': [0, 2, 4, 5, 7, 8, 11],
}

describe('intervalsFor', () => {
  it('knows the natural minor', () => {
    expect(intervalsFor('aeolian')).toEqual([0, 2, 3, 5, 7, 8, 10])
  })

  it('knows the blues scale', () => {
    expect(intervalsFor('blues')).toEqual([0, 3, 5, 6, 7, 10])
  })

  it('knows the other six', () => {
    expect(intervalsFor('ionian')).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(intervalsFor('dorian')).toEqual([0, 2, 3, 5, 7, 9, 10])
    expect(intervalsFor('mixolydian')).toEqual([0, 2, 4, 5, 7, 9, 10])
    expect(intervalsFor('lydian')).toEqual([0, 2, 4, 6, 7, 9, 11])
    expect(intervalsFor('phrygian')).toEqual([0, 1, 3, 5, 7, 8, 10])
    expect(intervalsFor('harmonic-minor')).toEqual([0, 2, 3, 5, 7, 8, 11])
  })

  it('knows the four modes Epic 6 added', () => {
    expect(intervalsFor('melodic-minor')).toEqual([0, 2, 3, 5, 7, 9, 11])
    expect(intervalsFor('lydian-dominant')).toEqual([0, 2, 4, 6, 7, 9, 10])
    expect(intervalsFor('phrygian-dominant')).toEqual([0, 1, 4, 5, 7, 8, 10])
    expect(intervalsFor('harmonic-major')).toEqual([0, 2, 4, 5, 7, 8, 11])
  })

  it('covers all twelve flavours with ascending, distinct, in-octave intervals', () => {
    expect(FLAVOURS).toEqual(ALL)
    for (const flavour of ALL) {
      const intervals = intervalsFor(flavour)
      expect(intervals[0]).toBe(0)
      expect(new Set(intervals).size).toBe(intervals.length)
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThan(intervals[i - 1])
        expect(intervals[i]).toBeLessThan(12)
      }
      expect(INTERVALS[flavour]).toEqual(intervals)
    }
  })

  it('throws on an unknown flavour', () => {
    expect(() => intervalsFor('bebop' as ScaleSlug)).toThrow(/bebop/)
  })
})

describe('the modal vocabulary', () => {
  it('offers ionian and aeolian, and neither major nor minor', () => {
    expect(FLAVOURS).toContain('ionian')
    expect(FLAVOURS).toContain('aeolian')
    expect(FLAVOURS).not.toContain('major')
    expect(FLAVOURS).not.toContain('minor')
  })

  it('keeps the two renamed flavours in the places they held', () => {
    expect(FLAVOURS[0]).toBe('ionian')
    expect(FLAVOURS[1]).toBe('aeolian')
  })

  it('gives ionian the major intervals and aeolian the natural-minor ones', () => {
    expect(intervalsFor('ionian')).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(intervalsFor('aeolian')).toEqual([0, 2, 3, 5, 7, 8, 10])
  })

  it('still spells harmonic minor with the word minor in it', () => {
    expect(FLAVOURS).toContain('harmonic-minor')
    expect(intervalsFor('harmonic-minor')).toEqual([0, 2, 3, 5, 7, 8, 11])
  })
})

describe('scaleName', () => {
  it('reads as a display string', () => {
    expect(scaleName('C', 'dorian')).toBe('C dorian')
    expect(scaleName('E♭', 'aeolian')).toBe('E♭ aeolian')
    expect(scaleName('C', 'ionian')).toBe('C ionian')
  })

  it('spells the hyphenated flavour as words', () => {
    expect(scaleName('A', 'harmonic-minor')).toBe('A harmonic minor')
  })

  it('spells the four hyphenated modes Epic 6 added as words', () => {
    expect(scaleName('C', 'melodic-minor')).toBe('C melodic minor')
    expect(scaleName('C', 'lydian-dominant')).toBe('C lydian dominant')
    expect(scaleName('E♭', 'phrygian-dominant')).toBe('E♭ phrygian dominant')
    expect(scaleName('A', 'harmonic-major')).toBe('A harmonic major')
  })

  it('lower-cases the mode, so it is not displayFlavour', () => {
    expect(scaleName('A', 'harmonic-minor')).toBe('A harmonic minor')
    expect(scaleName('A', 'harmonic-minor')).not.toContain(
      displayFlavour('harmonic-minor'),
    )
  })
})

describe('pitchesOf', () => {
  it('returns the scale’s pitch classes transposed to the root', () => {
    expect(pitchesOf('C', 'aeolian')).toEqual([0, 2, 3, 5, 7, 8, 10])
    expect(pitchesOf('D', 'ionian')).toEqual([1, 2, 4, 6, 7, 9, 11])
  })

  it('always returns 0..11 values, ascending, for every root and flavour', () => {
    for (const flavour of ALL) {
      for (const root of ['C', 'F♯', 'B♭'] as const) {
        const pcs = pitchesOf(root, flavour)
        expect(pcs.length).toBe(intervalsFor(flavour).length)
        expect(new Set(pcs).size).toBe(pcs.length)
        for (const pc of pcs) {
          expect(pc).toBeGreaterThanOrEqual(0)
          expect(pc).toBeLessThan(12)
        }
        expect([...pcs].sort((a, b) => a - b)).toEqual(pcs)
      }
    }
  })
})

describe('the twelve-mode vocabulary', () => {
  it('offers twelve flavours', () => {
    expect(FLAVOURS.length).toBe(12)
    expect(new Set(FLAVOURS).size).toBe(12)
  })

  it('does not offer locrian', () => {
    expect(FLAVOURS).not.toContain('locrian')
  })

  it('carries the four added modes', () => {
    for (const flavour of ADDED) expect(FLAVOURS).toContain(flavour)
  })

  it('gives every added mode ascending intervals from 0', () => {
    for (const flavour of ADDED) {
      const intervals = intervalsFor(flavour)
      expect(intervals[0]).toBe(0)
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThan(intervals[i - 1])
        expect(intervals[i]).toBeLessThan(12)
      }
    }
  })

  it('gives every flavour a perfect fifth', () => {
    for (const flavour of FLAVOURS) {
      expect({ flavour, hasFifth: intervalsFor(flavour).includes(7) }).toEqual({
        flavour,
        hasFifth: true,
      })
    }
  })

  it('leaves the eight that shipped before it untouched', () => {
    expect(FLAVOURS.slice(0, 8)).toEqual([
      'ionian',
      'aeolian',
      'dorian',
      'mixolydian',
      'lydian',
      'phrygian',
      'harmonic-minor',
      'blues',
    ])
  })
})

describe('thirteen scales, twelve flavours', () => {
  it('carries locrian, which the generator refuses to render', () => {
    expect(INTERVALS.locrian).toEqual([0, 1, 3, 5, 6, 8, 10])
    expect(intervalsFor('locrian')).toEqual([0, 1, 3, 5, 6, 8, 10])
    expect(intervalsFor('locrian')).not.toContain(7)
  })

  it('keys the interval table by thirteen slugs', () => {
    expect(Object.keys(INTERVALS)).toHaveLength(13)
  })

  it('keys the twelve renderable slugs first, in the frozen order', () => {
    expect(Object.keys(INTERVALS).slice(0, 12)).toEqual(FLAVOURS)
  })
})

describe('FLAVOUR_INTERVALS', () => {
  it('is keyed by the thirteen display names', () => {
    expect(Object.keys(FLAVOUR_INTERVALS)).toHaveLength(13)
    expect(Object.keys(FLAVOUR_INTERVALS)).toContain('Locrian')
    expect(Object.keys(FLAVOUR_INTERVALS)).toContain('Harmonic minor')
  })

  it.each(Object.keys(INTERVALS) as ScaleSlug[])(
    'is the very same array as INTERVALS.%s',
    (slug) => {
      expect(FLAVOUR_INTERVALS[displayFlavour(slug)]).toBe(INTERVALS[slug])
    },
  )

  it('names every display name DISPLAY_NAMES knows', () => {
    for (const display of Object.values(DISPLAY_NAMES)) {
      expect(Object.keys(FLAVOUR_INTERVALS)).toContain(display)
    }
  })

  it('equals the app’s literal table, value for value', () => {
    expect(Object.keys(FLAVOUR_INTERVALS).sort()).toEqual(
      Object.keys(APP_TABLE).sort(),
    )
    for (const [display, intervals] of Object.entries(APP_TABLE)) {
      expect(FLAVOUR_INTERVALS[display]).toEqual(intervals)
    }
  })
})

describe('MAJOR_INTERVALS', () => {
  it('is the ionian set, and the one ruler accidentals are spelled against', () => {
    expect(MAJOR_INTERVALS).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(MAJOR_INTERVALS).toBe(INTERVALS.ionian)
  })
})

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..')
const SKIP = new Set(['node_modules', '.next', '.git', 'public'])

function sourceFilesUnder(dirs: string[]): string[] {
  const out: string[] = []
  for (const dir of dirs) {
    for (const entry of readdirSync(join(REPO_ROOT, dir), {
      withFileTypes: true,
    })) {
      if (SKIP.has(entry.name)) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) out.push(...sourceFilesUnder([full]))
      else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(entry.name)) out.push(full)
    }
  }
  return out
}

// The interval sets are declared once in the repo (R4). Tests are excluded on
// purpose: this file's own change-detector tables legitimately write them, and
// so do the pins in roots.test.ts and lib/audio/reference.test.ts, each with a
// different subject.
const NEEDLES = Object.entries(INTERVALS).map(
  ([slug, intervals]) => [slug, `[${intervals.join(',')}]`] as const,
)

describe('the interval sets are declared once', () => {
  it.each(NEEDLES)(
    'has %s’s set %s in src/lib/theory/scales.ts and nowhere else',
    (_slug, needle) => {
      const holders = sourceFilesUnder(['src', 'scripts'])
        .filter((file) => !/\.(test|spec)\.tsx?$/.test(file))
        .filter((file) =>
          readFileSync(join(REPO_ROOT, file), 'utf8')
            .replace(/\s+/g, '')
            .includes(needle),
        )
        .map((file) => relative('.', file))
        .sort()
      expect(holders).toEqual(['src/lib/theory/scales.ts'])
    },
  )
})
