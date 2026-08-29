import { describe, it, expect } from 'vitest'
import type { DailyResult } from './types'

describe('DailyResult contract', () => {
  it('carries the date, the day’s answer, the attempts made, and whether it was solved', () => {
    const r: DailyResult = {
      date: '2026-08-21',
      answer: { root: 'D', flavour: 'Dorian' },
      attempts: [
        {
          root: 'C',
          flavour: 'Dorian',
          correct: false,
          rootMatched: false,
          flavourMatched: true,
        },
        {
          root: 'D',
          flavour: 'Dorian',
          correct: true,
          rootMatched: true,
          flavourMatched: true,
        },
      ],
      solved: true,
    }

    expect(r.answer).toEqual({ root: 'D', flavour: 'Dorian' })
    expect(r.attempts).toHaveLength(2)
    expect(r.solved).toBe(true)
  })

  it('represents an unsolved day as attempts with solved false', () => {
    const r: DailyResult = {
      date: '2026-08-20',
      answer: { root: 'A', flavour: 'Minor' },
      attempts: [],
      solved: false,
    }
    expect(r.solved).toBe(false)
    expect(r.attempts).toEqual([])
  })
})
