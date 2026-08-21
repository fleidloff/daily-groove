import { describe, it, expect } from 'vitest'
import type { DailyResult } from './types'

describe('DailyResult contract', () => {
  it('accepts a partial per-attribute result', () => {
    const r: DailyResult = {
      date: '2026-08-21',
      guesses: { scale: 'C minor' },
      correctness: { scale: true },
    }
    expect(r.guesses.scale).toBe('C minor')
    expect(r.correctness.scale).toBe(true)
  })
})
