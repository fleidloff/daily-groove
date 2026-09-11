import { describe, expect, it } from 'vitest'

import { GET, POST } from './route'
import type { Attempt, DailyResult, Root } from '@/features/daily-groove'

const BUCKETS = ['1', '2', '3', '4', '5', '6+', 'revealed']

function attempt(root: Root, flavour: string, answer: DailyResult['answer']): Attempt {
  const rootMatched = root === answer.root
  const flavourMatched = flavour === answer.flavour
  return { root, flavour, correct: rootMatched && flavourMatched, rootMatched, flavourMatched }
}

function result(
  date: string,
  answer: { root: Root; flavour: string },
  guesses: Array<[Root, string]>,
  extra: Partial<DailyResult> = {},
): DailyResult {
  const attempts = guesses.map(([root, flavour]) => attempt(root, flavour, answer))
  return {
    date,
    answer,
    attempts,
    solved: attempts.some((one) => one.correct),
    ...extra,
  }
}

const RESULTS: DailyResult[] = [
  result('2026-09-10', { root: 'G', flavour: 'Dorian' }, [['G', 'Dorian']]),
  result('2026-09-09', { root: 'C', flavour: 'Mixolydian' }, [
    ['C', 'Dorian'],
    ['C', 'Mixolydian'],
  ]),
  result('2026-08-20', { root: 'D', flavour: 'Aeolian' }, [['A', 'Dorian']], {
    solved: false,
    revealed: true,
  }),
]

const TODAY = '2026-09-11'

function post(results: unknown, raw?: string): Promise<Response> {
  return POST(
    new Request('http://localhost/api/stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw ?? JSON.stringify({ results, today: TODAY }),
    }),
  )
}

function postRaw(body: unknown): Promise<Response> {
  return POST(
    new Request('http://localhost/api/stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

describe('POST /api/stats', () => {
  it('answers 200 with a body matching the Stats shape', async () => {
    const response = await post(RESULTS)

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')

    const stats = await response.json()

    expect(typeof stats.puzzlesPlayed).toBe('number')
    expect(typeof stats.solved).toBe('number')
    expect(typeof stats.revealed).toBe('number')
    expect(Object.keys(stats.attempts).sort()).toEqual(['all', 'last7'])
    expect(Object.keys(stats.attempts.all).sort()).toEqual([...BUCKETS].sort())
    expect(Object.keys(stats.attempts.last7).sort()).toEqual([...BUCKETS].sort())
    expect(Object.keys(stats).sort()).toEqual([
      'attempts',
      'puzzlesPlayed',
      'revealed',
      'solved',
      'streak',
    ])
  })

  it('counts the results it was given', async () => {
    const stats = await (await post(RESULTS)).json()

    expect(stats.puzzlesPlayed).toBe(RESULTS.length)
    const total = BUCKETS.reduce((sum, bucket) => sum + stats.attempts.all[bucket], 0)
    expect(total).toBe(RESULTS.length)
  })

  it('accepts an empty array', async () => {
    const response = await post([])

    expect(response.status).toBe(200)
    expect((await response.json()).puzzlesPlayed).toBe(0)
  })

  it('keeps nothing between requests', async () => {
    await post(RESULTS)
    const second = await (await post(RESULTS.slice(0, 1))).json()

    expect(second.puzzlesPlayed).toBe(1)
  })
})

describe('the guards', () => {
  it.each([
    ['a body that is not JSON at all', undefined, 'not json'],
    ['an object instead of an array', { results: RESULTS }, undefined],
    ['a string instead of an array', 'nope', undefined],
    ['null', null, undefined],
    ['an array of numbers', [1, 2, 3], undefined],
    ['an entry missing its attempts', [{ ...RESULTS[0], attempts: undefined }], undefined],
    ['an entry whose attempts are not a list', [{ ...RESULTS[0], attempts: 3 }], undefined],
    ['an entry whose date is not a string', [{ ...RESULTS[0], date: 20260910 }], undefined],
    ['an entry with no answer', [{ ...RESULTS[0], answer: null }], undefined],
    ['an entry whose solved flag is a string', [{ ...RESULTS[0], solved: 'yes' }], undefined],
    ['an attempt that is not an object', [{ ...RESULTS[0], attempts: ['G Dorian'] }], undefined],
  ])('answers 400 for %s', async (_label, body, raw) => {
    const response = await post(body, raw)

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'invalid-body' })
  })

  it('answers 400 when the day is missing or malformed', async () => {
    expect((await postRaw({ results: RESULTS })).status).toBe(400)
    expect((await postRaw({ results: RESULTS, today: 'yesterday' })).status).toBe(400)
    expect((await postRaw(RESULTS)).status).toBe(400)
  })

  it('computes the window from the day the browser sent, not the server clock', async () => {
    const early = await (await post(RESULTS, JSON.stringify({
      results: RESULTS,
      today: '2026-09-10',
    }))).json()
    const later = await (await post(RESULTS, JSON.stringify({
      results: RESULTS,
      today: '2026-09-20',
    }))).json()

    expect(early.attempts.last7['1']).not.toBe(later.attempts.last7['1'])
    expect(early.attempts.all).toEqual(later.attempts.all)
  })

  it('answers 405 to a GET, naming POST as the method that works', async () => {
    const response = await GET()

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
    expect(await response.json()).toEqual({ error: 'method-not-allowed' })
  })
})
