import { describe, expect, it } from 'vitest'
import type { Groove } from '../../src/lib/groove.ts'
import { buildPools } from './pools.ts'

const ENTRIES: Groove[] = [
  {
    id: 'groove-01',
    uuid: '9c59273c-b08e-4376-a7eb-ad96435d0d6c',
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
    uuid: '42bfbb2c-cd51-4938-b8d3-326f3bf6628a',
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
    uuid: '98b45b78-4146-403a-bae0-c0b147bbedbb',
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

  it('contains every value its entries use', () => {
    const pools = buildPools(ENTRIES)
    for (const name of POOL_NAMES) {
      for (const value of used(ENTRIES, name)) {
        expect(pools[name], `${name} is missing ${value}`).toContain(value)
      }
    }
  })

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

const NEW_MODES = [
  'melodic minor',
  'lydian dominant',
  'phrygian dominant',
  'harmonic major',
]

const SCALE_DISTRACTORS = buildPools([]).scales

describe('SCALE_DISTRACTORS', () => {
  it.each(NEW_MODES)('carries at least two entries for %s, on different roots', (mode) => {
    const entries = SCALE_DISTRACTORS.filter((s) => s.endsWith(` ${mode}`))
    expect(entries.length, `${mode}: ${entries.join(', ')}`).toBeGreaterThanOrEqual(2)
    const roots = new Set(entries.map((s) => s.slice(0, -` ${mode}`.length)))
    expect(roots.size, `${mode} roots: ${[...roots].join(', ')}`).toBe(entries.length)
  })

  it('spells every accidental with ♯ or ♭, never # or b', () => {
    for (const entry of SCALE_DISTRACTORS) {
      const [root] = entry.split(' ')
      expect(root, entry).not.toMatch(/[#b]/)
      expect(root, entry).toMatch(/^[A-G][♯♭]?$/)
    }
  })

  it('names every flavour modally, in lower case', () => {
    const MODAL = new Set([
      'ionian',
      'dorian',
      'phrygian',
      'lydian',
      'mixolydian',
      'aeolian',
      'harmonic minor',
      'blues',
      ...NEW_MODES,
    ])
    for (const entry of SCALE_DISTRACTORS) {
      const flavour = entry.slice(entry.indexOf(' ') + 1)
      expect(flavour, entry).toBe(flavour.toLowerCase())
      expect(MODAL, entry).toContain(flavour)
    }
  })

  it('still leaves every pool with at least four distinct values', () => {
    const pools = buildPools(ENTRIES)
    for (const name of POOL_NAMES) {
      expect(new Set(pools[name]).size, name).toBeGreaterThanOrEqual(4)
    }
  })
})
