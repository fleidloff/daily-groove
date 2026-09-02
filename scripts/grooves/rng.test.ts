import { describe, expect, it } from 'vitest'
import { hashString, intBetween, pick, rngFor } from './rng.ts'

describe('the generator test project', () => {
  it('runs under node', () => {
    expect(typeof process.versions.node).toBe('string')
    expect(typeof window).toBe('undefined')
  })
})

describe('rngFor', () => {
  it('gives the same ten numbers for the same label', () => {
    const a = rngFor('groove-01:events')
    const b = rngFor('groove-01:events')
    const drawA = Array.from({ length: 10 }, () => a())
    const drawB = Array.from({ length: 10 }, () => b())
    expect(drawA).toEqual(drawB)
  })

  it('gives different numbers for a different label', () => {
    const a = rngFor('groove-01:events')
    const b = rngFor('groove-02:events')
    const drawA = Array.from({ length: 10 }, () => a())
    const drawB = Array.from({ length: 10 }, () => b())
    expect(drawA).not.toEqual(drawB)
  })

  it('draws in [0, 1)', () => {
    const rng = rngFor('range-check')
    for (let i = 0; i < 500; i++) {
      const n = rng()
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(1)
    }
  })
})

describe('hashString', () => {
  it('matches the shared pin table, so both sides agree on a seed', () => {
    const pins: ReadonlyArray<readonly [string, number]> = [
      ['', 2166136261],
      ['a', 3826002220],
      ['2026-08-30', 1258545406],
      ['groove-01', 699487093],
      ['groove-16', 884187997],
      ['E♭ dorian', 2486161818],
      ['2026-01-01', 2049302883],
      ['straight-funk:1:events', 3151190932],
      ['🥁', 2083220512],
    ]
    for (const [input, expected] of pins) {
      expect(hashString(input)).toBe(expected)
    }
  })

  it('returns a non-negative 32-bit integer', () => {
    const h = hashString('groove-01')
    expect(Number.isInteger(h)).toBe(true)
    expect(h).toBeGreaterThanOrEqual(0)
    expect(h).toBeLessThan(2 ** 32)
  })
})

describe('pick', () => {
  it('returns a member of the list and is stable for a stable generator', () => {
    const items = ['a', 'b', 'c', 'd']
    const first = Array.from({ length: 20 }, (_, i) => pick(rngFor(`p${i}`), items))
    const again = Array.from({ length: 20 }, (_, i) => pick(rngFor(`p${i}`), items))
    expect(first).toEqual(again)
    for (const value of first) expect(items).toContain(value)
  })

  it('throws on an empty list rather than returning undefined', () => {
    expect(() => pick(rngFor('x'), [])).toThrow()
  })
})

describe('intBetween', () => {
  it('stays within the inclusive bounds', () => {
    const rng = rngFor('tempo')
    for (let i = 0; i < 500; i++) {
      const n = intBetween(rng, 90, 110)
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(90)
      expect(n).toBeLessThanOrEqual(110)
    }
  })

  it('can return either bound', () => {
    const rng = rngFor('coin')
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) seen.add(intBetween(rng, 0, 1))
    expect(seen).toEqual(new Set([0, 1]))
  })
})
