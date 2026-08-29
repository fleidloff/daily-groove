import { describe, it, expect } from 'vitest'
import { GROOVES, SCALE_POOL, CHORD_POOL, PROGRESSION_POOL } from './seed'

describe('GROOVES seed set', () => {
  it('has at least 5 entries', () => {
    expect(GROOVES.length).toBeGreaterThanOrEqual(5)
  })

  it('every entry has a non-empty id', () => {
    for (const g of GROOVES) {
      expect(g.id).toBeTruthy()
      expect(typeof g.id).toBe('string')
    }
  })

  it('all ids are unique', () => {
    const ids = GROOVES.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every audioSrc starts with /grooves/', () => {
    for (const g of GROOVES) {
      expect(g.audioSrc.startsWith('/grooves/')).toBe(true)
    }
  })

  it('every entry has non-empty scale, chord, progression', () => {
    for (const g of GROOVES) {
      expect(g.scale).toBeTruthy()
      expect(g.chord).toBeTruthy()
      expect(g.progression).toBeTruthy()
    }
  })

  it('every groove has a non-empty name', () => {
    for (const g of GROOVES) {
      expect(typeof g.name).toBe('string')
      expect(g.name.trim()).not.toBe('')
    }
  })

  it('every groove has a tempo in a plausible range', () => {
    for (const g of GROOVES) {
      expect(typeof g.bpm).toBe('number')
      expect(Number.isFinite(g.bpm)).toBe(true)
      expect(g.bpm).toBeGreaterThanOrEqual(40)
      expect(g.bpm).toBeLessThanOrEqual(200)
    }
  })

  it('all names are distinct', () => {
    const names = GROOVES.map((g) => g.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('SCALE_POOL', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(SCALE_POOL)).toBe(true)
    expect(SCALE_POOL.length).toBeGreaterThan(0)
    for (const s of SCALE_POOL) expect(typeof s).toBe('string')
  })

  it('includes every scale used in GROOVES', () => {
    for (const g of GROOVES) {
      expect(SCALE_POOL).toContain(g.scale)
    }
  })

  it('has enough distinct values to build a 4-option picker', () => {
    expect(new Set(SCALE_POOL).size).toBeGreaterThanOrEqual(4)
  })
})

describe('CHORD_POOL', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(CHORD_POOL)).toBe(true)
    for (const c of CHORD_POOL) expect(typeof c).toBe('string')
  })

  it('has at least 6 entries', () => {
    expect(CHORD_POOL.length).toBeGreaterThanOrEqual(6)
  })

  it('includes every chord used in GROOVES', () => {
    for (const g of GROOVES) {
      expect(CHORD_POOL).toContain(g.chord)
    }
  })
})

describe('PROGRESSION_POOL', () => {
  it('is a non-empty array of strings', () => {
    expect(Array.isArray(PROGRESSION_POOL)).toBe(true)
    for (const p of PROGRESSION_POOL) expect(typeof p).toBe('string')
  })

  it('has at least 6 entries', () => {
    expect(PROGRESSION_POOL.length).toBeGreaterThanOrEqual(6)
  })

  it('includes every progression used in GROOVES', () => {
    for (const g of GROOVES) {
      expect(PROGRESSION_POOL).toContain(g.progression)
    }
  })
})
