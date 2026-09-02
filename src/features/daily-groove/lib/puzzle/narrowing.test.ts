import { describe, it, expect } from 'vitest'
import type { Attempt, Root } from '../../types'
import { ROOTS, simpleRootOptions } from '../theory/music'
import { ruledOut } from '../presentation/ruledOut'
import {
  ELIMINATE_AFTER_MISSES,
  ELIMINATED_PER_MISS,
  LIVE_ROOT_FLOOR,
  eliminatedRoots,
} from './narrowing'

const SEED = '2026-09-02'
const DATE = new Date(2026, 8, 2, 12, 0, 0, 0)
const OTHER_SEED = '2026-01-01'
const OTHER_DATE = new Date(2026, 0, 1, 12, 0, 0, 0)

const MODES = ['Dorian', 'Mixolydian', 'Aeolian', 'Ionian']

type Shape = 'wrong' | 'right' | 'mixed'

function dimmedAfter(
  attempts: Attempt[],
  answer: Root,
  pool: readonly Root[],
  seed: string,
): Set<Root> {
  return new Set<Root>([
    ...eliminatedRoots(pool, answer, attempts, seed),
    ...attempts.filter((a) => a.rootMatched === false).map((a) => a.root),
  ])
}

function play(
  count: number,
  answer: Root,
  pool: readonly Root[] = ROOTS,
  seed: string = SEED,
  shape: Shape = 'wrong',
): Attempt[] {
  const attempts: Attempt[] = []
  const wrong = pool.filter((root) => root !== answer)

  for (let index = 0; index < count; index++) {
    const rootRight = shape === 'right' || (shape === 'mixed' && index % 2 === 1)
    if (rootRight) {
      attempts.push({
        root: answer,
        flavour: MODES[index % MODES.length],
        correct: false,
        rootMatched: true,
        flavourMatched: false,
      })
      continue
    }

    const dimmed = dimmedAfter(attempts, answer, pool, seed)
    const live = wrong.filter((root) => !dimmed.has(root))
    attempts.push({
      root: live[0] ?? wrong[index % wrong.length],
      flavour: MODES[index % MODES.length],
      correct: false,
      rootMatched: false,
      flavourMatched: false,
    })
  }

  return attempts
}

const SOLVING: Attempt = {
  root: 'C',
  flavour: 'Dorian',
  correct: true,
  rootMatched: true,
  flavourMatched: true,
}

function liveCount(
  pool: readonly Root[],
  answer: Root,
  attempts: Attempt[],
  seed = SEED,
): number {
  const dimmed = dimmedAfter(attempts, answer, pool, seed)
  return pool.filter((root) => !dimmed.has(root)).length
}

describe('the narrowing constants', () => {
  it('holds the three numbers the rule is stated in', () => {
    expect(ELIMINATE_AFTER_MISSES).toBe(2)
    expect(ELIMINATED_PER_MISS).toBe(2)
    expect(LIVE_ROOT_FLOOR).toBe(4)
  })
})

describe('eliminatedRoots', () => {
  it('narrows nothing on a day with no misses (R10, AC20)', () => {
    expect(eliminatedRoots(ROOTS, 'C', [], SEED)).toEqual([])
    expect(eliminatedRoots(ROOTS, 'C', [SOLVING], SEED)).toEqual([])
  })

  it('narrows nothing after one miss (R10, AC11)', () => {
    expect(eliminatedRoots(ROOTS, 'C', play(1, 'C'), SEED)).toEqual([])
  })

  it('takes two roots the player never chose on the second miss (R11, R7, AC6, AC12)', () => {
    const [missA, missB] = play(2, 'C')
    const out = eliminatedRoots(ROOTS, 'C', [missA, missB], SEED)

    expect(out).toHaveLength(2)
    expect(out).not.toContain('C')
    expect(out).not.toContain(missA.root)
    expect(out).not.toContain(missB.root)
    expect(
      ROOTS.length - new Set([...out, missA.root, missB.root]).size,
    ).toBe(8)
  })

  it('accumulates — a root taken at one miss is still taken at the next (R11, R15, AC15)', () => {
    const [a, b, c] = play(3, 'C')
    const two = eliminatedRoots(ROOTS, 'C', [a, b], SEED)
    const three = eliminatedRoots(ROOTS, 'C', [a, b, c], SEED)

    expect(three).toHaveLength(4)
    expect(two.every((root) => three.includes(root))).toBe(true)
    expect(
      [1, 2, 3].map((n) => liveCount(ROOTS, 'C', play(n, 'C'))),
    ).toEqual([11, 8, 5])
  })

  it('reproduces the live and eliminated columns of the twelve-root row (R12, AC13)', () => {
    const depths = [1, 2, 3, 4, 5, 6]

    expect(
      depths.map((n) => liveCount(ROOTS, 'C', play(n, 'C'))),
    ).toEqual([11, 8, 5, 4, 3, 2])
    expect(
      depths.map(
        (n) => eliminatedRoots(ROOTS, 'C', play(n, 'C'), SEED).length,
      ),
    ).toEqual([0, 2, 4, 4, 4, 4])
  })

  it('holds the floor against its own help, not against the player (R13, AC13)', () => {
    for (const n of [4, 5, 6, 7, 8]) {
      expect(
        eliminatedRoots(ROOTS, 'C', play(n, 'C'), SEED),
      ).toHaveLength(4)
    }
    expect(liveCount(ROOTS, 'C', play(5, 'C'))).toBe(3)
    expect(liveCount(ROOTS, 'C', play(6, 'C'))).toBe(2)
  })

  it('eliminates down to exactly the floor, and no further (R12, AC13)', () => {
    const depths = [1, 2, 3, 4, 5, 6]
    const rightRoot = (n: number) => play(n, 'C', ROOTS, SEED, 'right')

    expect(
      depths.map((n) => eliminatedRoots(ROOTS, 'C', rightRoot(n), SEED).length),
    ).toEqual([0, 2, 4, 6, 8, 8])
    expect(liveCount(ROOTS, 'C', rightRoot(5))).toBe(LIVE_ROOT_FLOOR)
    expect(liveCount(ROOTS, 'C', rightRoot(6))).toBe(LIVE_ROOT_FLOOR)
  })

  it('takes roots in pairs at every depth, so the count is never odd (R17b)', () => {
    for (let n = 0; n <= 10; n++) {
      const taken = eliminatedRoots(ROOTS, 'C', play(n, 'C'), SEED)
      expect(taken.length % ELIMINATED_PER_MISS).toBe(0)
    }
  })

  it('returns the roots in pool order, deduped', () => {
    const out = eliminatedRoots(ROOTS, 'C', play(4, 'C'), SEED)
    expect(out).toEqual(ROOTS.filter((root) => out.includes(root)))
    expect(new Set(out).size).toBe(out.length)
  })

  describe('the answer is never a candidate (R7, AC8)', () => {
    const CASES: { date: Date; seed: string }[] = [
      { date: DATE, seed: SEED },
      { date: OTHER_DATE, seed: OTHER_SEED },
    ]

    it.each(ROOTS)('never eliminates %s when it is the day’s answer', (root) => {
      for (const { date, seed } of CASES) {
        const pools: readonly Root[][] = [
          ROOTS,
          simpleRootOptions(date, { root, flavour: 'Dorian' }),
        ]

        for (const pool of pools) {
          const shapes = [
            play(8, root, pool, seed, 'wrong'),
            play(8, root, pool, seed, 'right'),
            play(8, root, pool, seed, 'mixed'),
          ]

          for (const attempts of shapes) {
            expect(eliminatedRoots(pool, root, attempts, seed)).not.toContain(root)
            expect(
              ruledOut({
                attempts,
                answer: { root, flavour: 'Dorian' },
                roots: pool,
                date,
              }).roots,
            ).not.toContain(root)
          }
        }
      }
    })
  })

  it('gives the same day the same eliminations, and a different day different ones (R14, AC14)', () => {
    const attempts = play(3, 'C')

    expect(eliminatedRoots(ROOTS, 'C', attempts, SEED)).toEqual(
      eliminatedRoots(ROOTS, 'C', attempts, SEED),
    )
    expect(eliminatedRoots(ROOTS, 'C', attempts, SEED)).not.toEqual(
      eliminatedRoots(ROOTS, 'C', attempts, OTHER_SEED),
    )
    expect(eliminatedRoots(ROOTS, 'C', play(3, 'C'), SEED)).toEqual(
      eliminatedRoots(ROOTS, 'C', attempts, SEED),
    )
  })

  it('narrows a six-root row by nobody, however it is missed (R16, R19, AC16, AC18)', () => {
    const pool = simpleRootOptions(DATE, { root: 'C', flavour: 'Aeolian' })
    expect(pool).toHaveLength(LIVE_ROOT_FLOOR + ELIMINATED_PER_MISS)

    for (let n = 1; n <= 6; n++) {
      expect(eliminatedRoots(pool, 'C', play(n, 'C', pool), SEED)).toEqual(
        [],
      )
      expect(eliminatedRoots(pool, 'C', play(n, 'C', pool, SEED, 'right'), SEED)).toEqual([])
    }
  })

  it('narrows a seven-root row on the second miss, which is where the exemption stops', () => {
    const pool = ROOTS.slice(0, 7)
    expect(
      eliminatedRoots(pool, 'C', play(2, 'C', pool, SEED, 'right'), SEED),
    ).toHaveLength(2)
  })

  it('rules nothing out for an attempt it cannot read (R21)', () => {
    const unreadable = { root: 'G', flavour: 'Dorian' } as unknown as Attempt

    expect(eliminatedRoots(ROOTS, 'C', [unreadable, unreadable], SEED)).toEqual([])
    expect(
      eliminatedRoots(ROOTS, 'C', [...play(1, 'C'), unreadable], SEED),
    ).toEqual([])
  })

  it('does not mutate the pool or the attempts it is given', () => {
    const pool = [...ROOTS]
    const attempts = play(4, 'C')
    const before = JSON.stringify(attempts)

    eliminatedRoots(pool, 'C', attempts, SEED)

    expect(pool).toEqual(ROOTS)
    expect(JSON.stringify(attempts)).toBe(before)
  })
})
