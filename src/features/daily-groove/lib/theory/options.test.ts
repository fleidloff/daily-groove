import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { buildOptions, seededShuffle } from './options'

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

describe('seededShuffle', () => {
  it('is deterministic — the same seed returns the same order', () => {
    const a = seededShuffle([1, 2, 3, 4, 5], 'lap:0')
    const b = seededShuffle([1, 2, 3, 4, 5], 'lap:0')
    expect(a).toEqual(b)
  })

  it('returns a different order for a different seed', () => {
    const a = seededShuffle([1, 2, 3, 4, 5], 'lap:0')
    const b = seededShuffle([1, 2, 3, 4, 5], 'lap:1')
    expect(a).not.toEqual(b)
  })

  it('is a permutation — same members, source left untouched', () => {
    const source = [1, 2, 3, 4, 5]
    const shuffled = seededShuffle(source, 'lap:7')
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5])
    expect(source).toEqual([1, 2, 3, 4, 5])
  })
})

/**
 * R8/AC8: one seeded shuffle exists in the tree, and it is this one. The guard
 * has to keep itself out of its own search, so the Fisher-Yates marker is
 * assembled from fragments rather than written as one literal — otherwise this
 * file would be the second holder it is meant to forbid.
 */
const FISHER_YATES = 'for (let i = out.length - ' + '1; i > 0; i--)'

function sourceFilesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFilesUnder(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

describe('the seeded shuffle has exactly one implementation', () => {
  it('appears in options.ts and nowhere else under src/', () => {
    const holders = sourceFilesUnder(join(process.cwd(), 'src'))
      .filter((file) => readFileSync(file, 'utf8').includes(FISHER_YATES))
      .map((file) => file.replace(`${process.cwd()}/`, ''))
    expect(holders).toEqual(['src/features/daily-groove/lib/theory/options.ts'])
  })
})
