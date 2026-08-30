import { describe, it, expect } from 'vitest'
import { buildOptions } from './options'

const pool = [
  'C minor',
  'A dorian',
  'E phrygian',
  'G mixolydian',
  'D major',
  'B locrian',
  'F lydian',
]

describe('buildOptions', () => {
  it('returns `count` items (default 4)', () => {
    expect(buildOptions('C minor', pool, 'seed-1', 4)).toHaveLength(4)
    expect(buildOptions('C minor', pool, 'seed-1')).toHaveLength(4)
  })

  it('includes the correct answer', () => {
    expect(buildOptions('C minor', pool, 'seed-1', 4)).toContain('C minor')
  })

  it('has no duplicates', () => {
    const opts = buildOptions('C minor', pool, 'seed-1', 4)
    expect(new Set(opts).size).toBe(opts.length)
  })

  it('is deterministic — identical for the same seed', () => {
    const a = buildOptions('C minor', pool, 'seed-1', 4)
    const b = buildOptions('C minor', pool, 'seed-1', 4)
    expect(a).toEqual(b)
  })

  it('produces different orderings/sets for different seeds (generally)', () => {
    const a = buildOptions('C minor', pool, 'seed-1', 4)
    const b = buildOptions('C minor', pool, 'seed-2', 4)
    // Not a hard guarantee for all seeds, but these two must differ.
    expect(a).not.toEqual(b)
  })

  it('never contains the correct value as a distractor duplicate even if pool includes it', () => {
    const opts = buildOptions('C minor', pool, 'seed-3', 4)
    expect(opts.filter((o) => o === 'C minor')).toHaveLength(1)
  })

  it('respects a custom count', () => {
    expect(buildOptions('C minor', pool, 'seed-1', 3)).toHaveLength(3)
  })

  it('does not exceed available unique values', () => {
    const smallPool = ['C minor', 'A dorian']
    const opts = buildOptions('C minor', smallPool, 'seed-1', 4)
    expect(new Set(opts).size).toBe(opts.length)
    expect(opts).toContain('C minor')
  })
})
