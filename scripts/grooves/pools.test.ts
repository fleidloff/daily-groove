import { describe, expect, it } from 'vitest'
import type { Groove } from '../../src/lib/groove.ts'
import { buildPools } from './pools.ts'

/**
 * A stand-in catalogue in the notation the renderer actually emits — Unicode
 * accidentals, en-dash separated progressions, two-word flavours. The
 * assertions below are properties of `buildPools`, so they keep their meaning
 * when the real catalogue is re-selected.
 */
const ENTRIES: Groove[] = [
  {
    id: 'groove-01',
    audioSrc: '/grooves/groove-01.mp3',
    name: 'Rusted Shuffle',
    bpm: 105,
    scale: 'C blues',
    chord: 'Cm7',
    progression: 'Cm7–E♭6–B♭sus4–E♭6',
    root: 'C',
    flavour: 'Blues',
    bars: 4,
    headDelaySeconds: 0.025057,
  },
  {
    id: 'groove-02',
    audioSrc: '/grooves/groove-02.mp3',
    name: 'Dusty Ravine',
    bpm: 96,
    scale: 'E minor',
    chord: 'Em7',
    progression: 'Em7–Bm7–Cmaj7',
    root: 'E',
    flavour: 'Minor',
    bars: 4,
    headDelaySeconds: 0.025057,
  },
  {
    id: 'groove-03',
    audioSrc: '/grooves/groove-03.mp3',
    name: 'Feathered Pocket',
    bpm: 103,
    scale: 'E♭ harmonic minor',
    chord: 'E♭mMaj7',
    progression: 'E♭mMaj7–Fm7♭5–F♯maj7♯5–Ddim7',
    root: 'E♭',
    flavour: 'Harmonic minor',
    bars: 4,
    headDelaySeconds: 0.025057,
  },
]

const POOL_NAMES = ['scales', 'chords', 'progressions'] as const

/** The catalogue field each pool is drawn from. */
const SOURCE: Record<(typeof POOL_NAMES)[number], keyof Groove> = {
  scales: 'scale',
  chords: 'chord',
  progressions: 'progression',
}

function used(entries: Groove[], name: (typeof POOL_NAMES)[number]): string[] {
  return [...new Set(entries.map((e) => e[SOURCE[name]] as string))]
}

describe('buildPools', () => {
  it('returns the three pools as arrays of strings', () => {
    const pools = buildPools(ENTRIES)
    expect(Object.keys(pools).sort()).toEqual([...POOL_NAMES].sort())
    for (const name of POOL_NAMES) {
      expect(Array.isArray(pools[name]), name).toBe(true)
      expect(pools[name].length, name).toBeGreaterThan(0)
      for (const value of pools[name]) expect(typeof value).toBe('string')
    }
  })

  // AC14: every value the catalogue uses is in its pool.
  it('contains every value its entries use', () => {
    const pools = buildPools(ENTRIES)
    for (const name of POOL_NAMES) {
      for (const value of used(ENTRIES, name)) {
        expect(pools[name], `${name} is missing ${value}`).toContain(value)
      }
    }
  })

  // AC14: enough distinct distractors for buildOptions to fill a four-option
  // set for *any* groove — three distractors beyond the correct answer.
  it('has at least four distinct members more than the catalogue uses', () => {
    const pools = buildPools(ENTRIES)
    for (const name of POOL_NAMES) {
      expect(pools[name].length, name).toBeGreaterThanOrEqual(
        used(ENTRIES, name).length + 4,
      )
    }
  })

  it('holds no duplicates', () => {
    const pools = buildPools(ENTRIES)
    for (const name of POOL_NAMES) {
      expect(new Set(pools[name]).size, name).toBe(pools[name].length)
    }
  })

  it('sorts every pool, so the rendered module is stable', () => {
    const pools = buildPools(ENTRIES)
    for (const name of POOL_NAMES) {
      expect(pools[name], name).toEqual([...pools[name]].sort())
    }
    expect(buildPools(ENTRIES)).toEqual(buildPools(ENTRIES))
  })

  it('does not depend on the order the entries arrive in', () => {
    expect(buildPools([...ENTRIES].reverse())).toEqual(buildPools(ENTRIES))
  })

  it('still fills every pool for an empty catalogue', () => {
    const pools = buildPools([])
    for (const name of POOL_NAMES) {
      expect(pools[name].length, name).toBeGreaterThanOrEqual(4)
    }
  })

  it('carries a value the catalogue does not use, so the pool is a real pool', () => {
    const pools = buildPools(ENTRIES)
    for (const name of POOL_NAMES) {
      const extra = pools[name].filter((v) => !used(ENTRIES, name).includes(v))
      expect(extra.length, name).toBeGreaterThanOrEqual(4)
    }
  })
})
