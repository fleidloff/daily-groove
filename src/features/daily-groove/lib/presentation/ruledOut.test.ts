import { describe, it, expect } from 'vitest'
import type { Attempt, Flavour, Root } from '../../types'
import { ROOTS } from '@/lib/theory/roots'
import { simpleRootOptions } from '@/lib/theory/music'
import { ELIMINATED_PER_MISS, eliminatedRoots } from '../puzzle/narrowing'
import { ruledOut } from './ruledOut'

const DATE = new Date(2026, 8, 2, 12, 0, 0, 0)
const SEED = '2026-09-02'
const OTHER_DATE = new Date(2026, 0, 1, 12, 0, 0, 0)
const OTHER_SEED = '2026-01-01'
const ANSWER = { root: 'C' as Root, flavour: 'Dorian' as Flavour }

const MODES = ['Mixolydian', 'Aeolian', 'Ionian', 'Lydian']
const SHAPED_MODES = ['Dorian', 'Mixolydian', 'Aeolian', 'Ionian']

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

function playShaped(
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
        flavour: SHAPED_MODES[index % SHAPED_MODES.length],
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
      flavour: SHAPED_MODES[index % SHAPED_MODES.length],
      correct: false,
      rootMatched: false,
      flavourMatched: false,
    })
  }

  return attempts
}

function play(
  count: number,
  roots: readonly Root[] = ROOTS,
  answer: Root = ANSWER.root,
): Attempt[] {
  const attempts: Attempt[] = []
  const wrong = roots.filter((root) => root !== answer)

  for (let index = 0; index < count; index++) {
    const dimmed = new Set(
      ruledOut({ attempts, answer: ANSWER, roots, date: DATE }).roots,
    )
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

function rootRightMisses(count: number, answer: Root = ANSWER.root): Attempt[] {
  return Array.from({ length: count }, (_, index) => ({
    root: answer,
    flavour: MODES[index % MODES.length],
    correct: false,
    rootMatched: true,
    flavourMatched: false,
  }))
}

const forRow = (attempts: Attempt[], roots: readonly Root[] = ROOTS) =>
  ruledOut({ attempts, answer: ANSWER, roots, date: DATE })

const playerRoots = (attempts: Attempt[], roots: readonly Root[]): Root[] => {
  const own = new Set(
    attempts.filter((a) => a.rootMatched === false).map((a) => a.root),
  )
  return roots.filter((root) => own.has(root))
}

describe('ruledOut', () => {
  it('rules nothing out on an untouched day (R21, AC20)', () => {
    expect(forRow([])).toEqual({ roots: [], flavours: [], eliminatedCount: 0 })
  })

  it('unions the player’s own misses with the app’s eliminations, in row order (R4, R5, AC4, AC6)', () => {
    const [missA, missB] = play(2)
    const result = forRow([missA, missB])

    expect(result.roots).toHaveLength(4)
    expect(result.roots).toContain(missA.root)
    expect(result.roots).toContain(missB.root)
    expect(result.roots).not.toContain('C')
    expect(result.roots).toEqual(ROOTS.filter((root) => result.roots.includes(root)))
    expect(new Set(result.roots).size).toBe(result.roots.length)
  })

  it('never un-dims a chip as the day goes on (R8, AC9)', () => {
    let previous: Root[] = []
    for (let n = 1; n <= 6; n++) {
      const current = forRow(play(n)).roots
      expect(previous.every((root) => current.includes(root))).toBe(true)
      previous = current
    }
  })

  it('is a derivation of the attempts, so a reload restores the same dims (R9, AC10, AC14)', () => {
    const first = forRow(play(3))
    const second = forRow(play(3))

    expect(second).toEqual(first)
    expect(forRow([...play(3)])).toEqual(first)
  })

  it('never rules out a half that matched (R7, R13, AC8)', () => {
    const result = forRow(rootRightMisses(3))

    expect(result.roots).not.toContain('C')
    expect(result.flavours).toEqual(MODES.slice(0, 3))
  })

  it('leaves a mode live when the mode was the half that matched', () => {
    const flavourRight: Attempt[] = [
      {
        root: 'G',
        flavour: ANSWER.flavour,
        correct: false,
        rootMatched: false,
        flavourMatched: true,
      },
    ]

    expect(forRow(flavourRight).flavours).toEqual([])
    expect(forRow(flavourRight).roots).toContain('G')
  })

  it('rules out modes by the player’s hand alone, in the order checked (R4, AC5)', () => {
    for (let n = 1; n <= 8; n++) {
      const attempts = play(n)
      const checked: Flavour[] = []
      for (const attempt of attempts) {
        if (!checked.includes(attempt.flavour)) checked.push(attempt.flavour)
      }
      expect(forRow(attempts).flavours).toEqual(checked)
    }
  })

  it('rules out exactly the one family a simple-mode miss checked', () => {
    const pool = simpleRootOptions(DATE, ANSWER)
    const miss: Attempt = {
      root: pool.find((root) => root !== 'C') as Root,
      flavour: 'minor',
      correct: false,
      rootMatched: false,
      flavourMatched: false,
    }

    expect(forRow([miss], pool).flavours).toEqual(['minor'])
  })

  it('reports the app’s count and nothing of the player’s own deductions (R17, R17b, AC17, AC17b)', () => {
    const counts = [0, 1, 2, 3, 4, 5, 6].map(
      (n) => forRow(play(n)).eliminatedCount,
    )
    expect(counts).toEqual([0, 0, 2, 4, 4, 4, 4])

    for (let n = 0; n <= 6; n++) {
      const attempts = play(n)
      const result = forRow(attempts)
      expect(result.eliminatedCount).toBe(
        result.roots.length - playerRoots(attempts, ROOTS).length,
      )
      expect(result.eliminatedCount % ELIMINATED_PER_MISS).toBe(0)
    }
  })

  it('claims nothing in a six-root row, at any depth (R19, AC16, AC18)', () => {
    const pool = simpleRootOptions(DATE, ANSWER)

    for (let n = 0; n <= 6; n++) {
      const attempts = play(n, pool)
      const result = ruledOut({ attempts, answer: ANSWER, roots: pool, date: DATE })

      expect(result.eliminatedCount).toBe(0)
      expect(result.roots).toEqual(playerRoots(attempts, pool))
      expect(result.roots).not.toContain('C')
    }
  })

  it('narrows the row it is given, keeping the player’s dims that are still on it', () => {
    const attempts = play(3)
    const pool = simpleRootOptions(DATE, ANSWER)
    const simple = ruledOut({ attempts, answer: ANSWER, roots: pool, date: DATE })

    expect(simple.eliminatedCount).toBe(0)
    expect(simple.roots).toEqual(playerRoots(attempts, pool))
    expect(forRow(attempts).eliminatedCount).toBe(4)
  })

  it('rules nothing out for an attempt it cannot read (R21)', () => {
    const unreadable = { root: 'G', flavour: 'Dorian' } as unknown as Attempt

    expect(forRow([unreadable])).toEqual({
      roots: [],
      flavours: [],
      eliminatedCount: 0,
    })

    const [readable] = play(1)
    const mixed = forRow([readable, unreadable])
    expect(mixed.roots).toEqual([readable.root])
    expect(mixed.flavours).toEqual([readable.flavour])
    expect(mixed.eliminatedCount).toBe(0)
  })

  it('does not mutate the row or the attempts it is given', () => {
    const roots = [...ROOTS]
    const attempts = play(4)
    const before = JSON.stringify(attempts)

    ruledOut({ attempts, answer: ANSWER, roots, date: DATE })

    expect(roots).toEqual(ROOTS)
    expect(JSON.stringify(attempts)).toBe(before)
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
            playShaped(8, root, pool, seed, 'wrong'),
            playShaped(8, root, pool, seed, 'right'),
            playShaped(8, root, pool, seed, 'mixed'),
          ]

          for (const attempts of shapes) {
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
})
