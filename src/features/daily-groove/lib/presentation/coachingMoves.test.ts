import { describe, expect, it } from 'vitest'
import type { Move } from './moves'
import {
  COLOUR_MOVES,
  SIMPLE_COLOUR_MOVES,
  TONIC_MOVES,
} from './coachingMoves'
import { ROOTS } from '@/lib/theory/roots'
import { flavourPool } from '@/lib/theory/music'
import { FAMILIES } from '@/lib/theory/families'
import { GROOVES } from '../../data/grooves.generated'

const NOTE_CHARS = 'A-Za-z♭♯'

const CHORD_SYMBOL = /[A-G](♯|♭)?(m|maj|min|dim|aug|sus|\d)/

const TAP = /\btap(s|ped|ping)?\b/i

const ROOT_WORDS = /\b(root|tonic|home note)\b/i

const MODE_WORDS = /\b(mode|colou?r|flavou?r|scale)\b/i

const DEGREES = /\b(third|fourth|fifth|sixth|seventh)\b/gi

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rootPattern(root: string): RegExp {
  return new RegExp(
    `(?<![${NOTE_CHARS}])${escapeForRegExp(root)}(?![${NOTE_CHARS}])`,
  )
}

function modePattern(mode: string): RegExp {
  return new RegExp(`\\b${escapeForRegExp(mode)}\\b`, 'i')
}

function wordingsOf(moves: readonly Move[]): string[] {
  return moves.flatMap((move) => [
    move.message,
    ...(move.soundsOff === undefined ? [] : [move.soundsOff]),
  ])
}

const TABLES: [string, readonly Move[]][] = [
  ['COLOUR_MOVES', COLOUR_MOVES],
  ['TONIC_MOVES', TONIC_MOVES],
  ['SIMPLE_COLOUR_MOVES', SIMPLE_COLOUR_MOVES],
]

const ALL = [...COLOUR_MOVES, ...TONIC_MOVES, ...SIMPLE_COLOUR_MOVES]

const WORDINGS = wordingsOf(ALL)

describe('the family moves', () => {
  it.each(TABLES)('%s holds exactly two moves (R7c)', (_name, table) => {
    expect(table).toHaveLength(2)

    for (const move of table) {
      expect(move.message.trim().length).toBeGreaterThan(0)
      expect(move.message).toBe(move.message.trim())
    }
  })

  it('names no root from the game’s option set (R10, AC10)', () => {
    expect(ROOTS.length).toBe(12)

    for (const wording of WORDINGS) {
      for (const root of ROOTS) {
        expect(
          rootPattern(root).test(wording),
          `the move "${wording}" names the root ${root}`,
        ).toBe(false)
      }

      expect(/[♭♯]/.test(wording), `the move "${wording}" spells an accidental`).toBe(
        false,
      )
    }
  })

  it('names no mode and no family from the game’s option sets (R10, AC10)', () => {
    const names = [...flavourPool(GROOVES), ...FAMILIES]
    expect(names.length).toBeGreaterThan(12)

    for (const wording of WORDINGS) {
      for (const name of names) {
        expect(
          modePattern(name).test(wording),
          `the move "${wording}" names the mode ${name}`,
        ).toBe(false)
      }
    }
  })

  it('spells no chord symbol (R10, AC10)', () => {
    for (const wording of WORDINGS) {
      expect(
        CHORD_SYMBOL.test(wording),
        `the move "${wording}" spells a chord`,
      ).toBe(false)
    }
  })

  it('pairs every tap move with a sounds-off wording, and no other (R10, AC11)', () => {
    for (const move of ALL) {
      if (TAP.test(move.message)) {
        expect(
          move.soundsOff,
          `no sounds-off for "${move.message}"`,
        ).toBeTypeOf('string')
        expect(
          TAP.test(move.soundsOff ?? ''),
          `the sounds-off wording "${move.soundsOff}" names a tap`,
        ).toBe(false)
        expect(move.soundsOff?.trim().length).toBeGreaterThan(0)
        expect(move.soundsOff).not.toBe(move.message)
      } else {
        expect(
          move.soundsOff,
          `a sounds-off wording on "${move.message}", which names no tap`,
        ).toBeUndefined()
      }
    }
  })

  it.each(TABLES)(
    '%s points at a chip in at least one move (R10, AC11)',
    (_name, table) => {
      expect(table.some((move) => TAP.test(move.message))).toBe(true)
    },
  )

  it('never asks for the half the colour family already has (R6, AC5)', () => {
    for (const move of [...COLOUR_MOVES, ...SIMPLE_COLOUR_MOVES]) {
      for (const wording of [move.message, move.soundsOff ?? '']) {
        expect(
          ROOT_WORDS.test(wording),
          `the colour move "${wording}" sends the player after the root`,
        ).toBe(false)
      }
    }
  })

  it('never asks for the half the tonic family already has (R6, AC6)', () => {
    for (const move of TONIC_MOVES) {
      for (const wording of [move.message, move.soundsOff ?? '']) {
        expect(
          MODE_WORDS.test(wording),
          `the tonic move "${wording}" sends the player after the mode`,
        ).toBe(false)
      }
    }
  })

  it('asks simple mode a single-note question, in its own words (R8, AC9)', () => {
    for (const move of SIMPLE_COLOUR_MOVES) {
      const degrees = new Set(
        (move.message.match(DEGREES) ?? []).map((degree) =>
          degree.toLowerCase(),
        ),
      )
      expect(
        degrees.size,
        `"${move.message}" names ${degrees.size} degrees`,
      ).toBe(1)
    }

    const full = COLOUR_MOVES.map((move) => move.message)
    for (const move of SIMPLE_COLOUR_MOVES) {
      expect(full).not.toContain(move.message)
    }
  })

  it('says something different in every move (R7c)', () => {
    expect(new Set(WORDINGS).size).toBe(WORDINGS.length)

    for (const wording of WORDINGS) {
      expect(wording).not.toBe('')
      expect(wording).toBe(wording.trim())
    }
  })

  it('stays one job long (R10)', () => {
    for (const wording of WORDINGS) {
      expect(
        wording.length,
        `the move "${wording}" runs ${wording.length} characters`,
      ).toBeLessThanOrEqual(160)
    }
  })
})
