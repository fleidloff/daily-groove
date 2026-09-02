import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Attempt } from '../../types'
import type { Move } from './moves'
import { LADDER } from './moves'
import { COLOUR_MOVES, SIMPLE_COLOUR_MOVES, TONIC_MOVES } from './coachingMoves'
import { selectCoaching } from './coaching'

const attempt = (
  root: Attempt['root'],
  flavour: Attempt['flavour'],
  rootMatched: boolean,
  flavourMatched: boolean,
): Attempt => ({
  root,
  flavour,
  correct: rootMatched && flavourMatched,
  rootMatched,
  flavourMatched,
})

const ROOT_ONLY = attempt('G', 'Mixolydian', true, false)
const OTHER_ROOT_ONLY = attempt('G', 'Lydian', true, false)
const FLAVOUR_ONLY = attempt('C', 'Dorian', false, true)
const LOCKED_MISS = attempt('G', 'Dorian', false, true)
const NEITHER = attempt('C', 'Mixolydian', false, false)
const OTHER_NEITHER = attempt('D', 'Lydian', false, false)
const EXACT = attempt('G', 'Dorian', true, true)

const missesOf = (count: number): Attempt[] =>
  Array.from({ length: count }, () => NEITHER)

const LAST = LADDER.length - 1

const SOUNDS_OFF_RUNG = LADDER.findIndex((move) => move.soundsOff !== undefined)

describe('selectCoaching', () => {
  it('opens on the first rung before anything has been missed (R1, R2, R7, R15, AC1, AC3)', () => {
    expect(
      selectCoaching({ attempts: [], tapSounds: true, simple: false }).message,
    ).toBe(LADDER[0].message)
    expect(
      selectCoaching({ attempts: [EXACT], tapSounds: true, simple: false })
        .message,
    ).toBe(COLOUR_MOVES[0].message)
  })

  it('advances one rung per miss, never repeating the move it just showed (R3, AC2, AC4)', () => {
    for (let n = 0; n < LADDER.length; n += 1) {
      expect(
        selectCoaching({
          attempts: missesOf(n),
          tapSounds: true,
          simple: false,
        }).message,
      ).toBe(LADDER[n].message)

      if (n > 0) {
        expect(
          selectCoaching({
            attempts: missesOf(n),
            tapSounds: true,
            simple: false,
          }).message,
        ).not.toBe(
          selectCoaching({
            attempts: missesOf(n - 1),
            tapSounds: true,
            simple: false,
          }).message,
        )
      }
    }
  })

  it('holds on the last rung once the ladder runs out (R4, AC5)', () => {
    for (const count of [4, 5, 8, 20]) {
      expect(
        selectCoaching({
          attempts: missesOf(count),
          tapSounds: true,
          simple: false,
        }).message,
      ).toBe(LADDER[LAST].message)
    }

    expect(
      selectCoaching({ attempts: missesOf(8), tapSounds: true, simple: false }),
    ).toEqual(
      selectCoaching({
        attempts: missesOf(20),
        tapSounds: true,
        simple: false,
      }),
    )
  })

  it('is coaching and never a verdict, whatever the day looks like (R13)', () => {
    for (let n = 0; n <= 6; n += 1) {
      for (const tapSounds of [true, false]) {
        expect(
          selectCoaching({ attempts: missesOf(n), tapSounds, simple: false })
            .tone,
        ).toBe('neutral')
      }
    }
  })

  it('gives a silenced row the other wording, and only where one exists (R10, AC10)', () => {
    expect(SOUNDS_OFF_RUNG).toBeGreaterThanOrEqual(0)

    const move = LADDER[SOUNDS_OFF_RUNG]
    const attempts = missesOf(SOUNDS_OFF_RUNG)

    expect(
      selectCoaching({ attempts, tapSounds: true, simple: false }).message,
    ).toBe(move.message)
    expect(
      selectCoaching({ attempts, tapSounds: false, simple: false }).message,
    ).toBe(move.soundsOff)
    expect(
      selectCoaching({ attempts, tapSounds: false, simple: false }).message,
    ).not.toBe(
      selectCoaching({ attempts, tapSounds: true, simple: false }).message,
    )

    LADDER.forEach((rung, index) => {
      if (rung.soundsOff !== undefined) return

      const day = missesOf(index)
      expect(
        selectCoaching({ attempts: day, tapSounds: false, simple: false })
          .message,
      ).toBe(
        selectCoaching({ attempts: day, tapSounds: true, simple: false })
          .message,
      )
    })
  })

  it('counts only the misses, and reads nothing else about the day (R6, AC7)', () => {
    expect(
      selectCoaching({
        attempts: [NEITHER, OTHER_NEITHER],
        tapSounds: true,
        simple: false,
      }).message,
    ).toBe(LADDER[2].message)
    expect(
      selectCoaching({
        attempts: [NEITHER, EXACT],
        tapSounds: true,
        simple: false,
      }).message,
    ).toBe(COLOUR_MOVES[0].message)
    expect(
      selectCoaching({
        attempts: [ROOT_ONLY, FLAVOUR_ONLY],
        tapSounds: true,
        simple: false,
      }).message,
    ).toBe(TONIC_MOVES[0].message)

    const attempts = [NEITHER, ROOT_ONLY, EXACT]
    const before = structuredClone(attempts)

    const first = selectCoaching({ attempts, tapSounds: true, simple: false })
    const second = selectCoaching({ attempts, tapSounds: true, simple: false })

    expect(second.message).toBe(first.message)
    expect(attempts).toEqual(before)
  })

  it('cannot read the transport (R16, AC19)', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/daily-groove/lib/presentation/coaching.ts',
      ),
      'utf8',
    )

    expect(source).toMatch(/export function selectCoaching/)

    expect(source).not.toMatch(/isPlaying/)
    expect(source).not.toMatch(/\bplaying\b/)
    expect(source).not.toMatch(/useTransport/)
    expect(source).not.toMatch(/\bposition\b/)
    expect(source).not.toMatch(/\bclock\b/)
    expect(source).not.toMatch(/from\s+'[^']*\.\.\/audio\//)
  })

  it('walks Epic 1’s general ladder unchanged when nothing is confirmed (R5, AC3)', () => {
    const day: Attempt[] = []

    for (let misses = 0; misses <= 6; misses += 1) {
      const move = selectCoaching({
        attempts: day,
        tapSounds: true,
        simple: false,
      })

      expect(move.tone).toBe('neutral')
      expect(LADDER.map((rung) => rung.message)).toContain(move.message)
      expect(move.message).toBe(
        LADDER[Math.min(misses, LADDER.length - 1)].message,
      )

      day.push(NEITHER)
    }
  })

  it('gives a colour move once the root is confirmed (R2, R3, AC2)', () => {
    const move = selectCoaching({
      attempts: [ROOT_ONLY],
      tapSounds: true,
      simple: false,
    })

    expect(move.message).toBe(COLOUR_MOVES[0].message)
    expect(move.tone).toBe('neutral')
    expect(LADDER.map((rung) => rung.message)).not.toContain(move.message)
  })

  it('gives a tonic move once the mode is confirmed (R2, R4, AC1)', () => {
    expect(
      selectCoaching({
        attempts: [FLAVOUR_ONLY],
        tapSounds: true,
        simple: false,
      }).message,
    ).toBe(TONIC_MOVES[0].message)
    expect(
      selectCoaching({
        attempts: [FLAVOUR_ONLY],
        tapSounds: true,
        simple: true,
      }).message,
    ).toBe(TONIC_MOVES[0].message)
  })

  it('advances once inside a family and then holds (R7c, R7d, AC13, AC14)', () => {
    const day = [NEITHER, NEITHER, FLAVOUR_ONLY]
    const seen = [
      selectCoaching({ attempts: day, tapSounds: true, simple: false }).message,
      selectCoaching({
        attempts: [...day, LOCKED_MISS],
        tapSounds: true,
        simple: false,
      }).message,
      selectCoaching({
        attempts: [...day, LOCKED_MISS, LOCKED_MISS],
        tapSounds: true,
        simple: false,
      }).message,
      selectCoaching({
        attempts: [...day, LOCKED_MISS, LOCKED_MISS, LOCKED_MISS],
        tapSounds: true,
        simple: false,
      }).message,
      selectCoaching({
        attempts: [...day, LOCKED_MISS, LOCKED_MISS, LOCKED_MISS, LOCKED_MISS],
        tapSounds: true,
        simple: false,
      }).message,
    ]

    expect(seen).toEqual([
      TONIC_MOVES[0].message,
      TONIC_MOVES[1].message,
      TONIC_MOVES[1].message,
      TONIC_MOVES[1].message,
      TONIC_MOVES[1].message,
    ])
  })

  it('gives simple mode its own colour wording and the shared everything-else (R8, R9, AC8, AC9)', () => {
    expect(
      selectCoaching({ attempts: [ROOT_ONLY], tapSounds: true, simple: true })
        .message,
    ).toBe(SIMPLE_COLOUR_MOVES[0].message)
    expect(
      selectCoaching({ attempts: [ROOT_ONLY], tapSounds: true, simple: true })
        .message,
    ).not.toBe(COLOUR_MOVES[0].message)

    const days: Attempt[][] = [
      [FLAVOUR_ONLY],
      [FLAVOUR_ONLY, LOCKED_MISS],
      [],
      [NEITHER],
      [NEITHER, NEITHER],
    ]

    for (const day of days) {
      expect(
        selectCoaching({ attempts: day, tapSounds: true, simple: true })
          .message,
      ).toBe(
        selectCoaching({ attempts: day, tapSounds: true, simple: false })
          .message,
      )
    }
  })

  it('swaps to the sounds-off wording wherever a move names a tap (R10, AC11)', () => {
    const cases: [Attempt[], Attempt, boolean, readonly Move[]][] = [
      [[ROOT_ONLY], OTHER_ROOT_ONLY, false, COLOUR_MOVES],
      [[ROOT_ONLY], OTHER_ROOT_ONLY, true, SIMPLE_COLOUR_MOVES],
      [[FLAVOUR_ONLY], LOCKED_MISS, false, TONIC_MOVES],
    ]

    for (const [day, next, simple, table] of cases) {
      for (const index of [0, 1]) {
        const attempts = index === 0 ? day : [...day, next]
        const move = table[index]
        const off = selectCoaching({
          attempts,
          tapSounds: false,
          simple,
        }).message

        expect(off).toBe(move.soundsOff ?? move.message)
        if (move.soundsOff) expect(off).not.toBe(move.message)
      }
    }
  })

  it('returns a distinct, muted move for every reachable state (R10, AC10)', () => {
    const reachable = [
      ...LADDER,
      ...COLOUR_MOVES,
      ...TONIC_MOVES,
      ...SIMPLE_COLOUR_MOVES,
    ]
    const wordings = reachable.flatMap((move) =>
      move.soundsOff === undefined
        ? [move.message]
        : [move.message, move.soundsOff],
    )

    expect(new Set(wordings).size).toBe(wordings.length)

    const states: [Attempt[], boolean][] = [
      [[], false],
      [[NEITHER], false],
      [[ROOT_ONLY], false],
      [[ROOT_ONLY], true],
      [[FLAVOUR_ONLY], false],
      [[FLAVOUR_ONLY], true],
    ]

    for (const [day, simple] of states) {
      for (const tapSounds of [true, false]) {
        expect(
          selectCoaching({ attempts: day, tapSounds, simple }).tone,
        ).toBe('neutral')
      }
    }
  })

  it('stays in its family three misses after the confirming one (R1, R7, AC4, AC7)', () => {
    const day = [NEITHER, FLAVOUR_ONLY, LOCKED_MISS, LOCKED_MISS, LOCKED_MISS]
    const move = selectCoaching({
      attempts: day,
      tapSounds: true,
      simple: false,
    })

    expect(TONIC_MOVES.map((tonic) => tonic.message)).toContain(move.message)
    expect(LADDER.map((rung) => rung.message)).not.toContain(move.message)

    const stale = [ROOT_ONLY, NEITHER, OTHER_NEITHER]

    expect(
      selectCoaching({ attempts: stale, tapSounds: true, simple: false })
        .message,
    ).toBe(COLOUR_MOVES[1].message)
  })
})
