import { describe, expect, it } from 'vitest'
import type { Move } from './moves'
import { LADDER } from './moves'
import { selectFeedback } from './feedback'
import { ROOTS, flavourPool } from '../theory/music'
import { FAMILIES } from '../theory/families'
import { barChords } from '../theory/changes'
import { GROOVES } from '../../data/grooves.generated'

const NOTE_CHARS = 'A-Za-z♭♯'

const CHORD_SYMBOL = /[A-G](♯|♭)?(m|maj|min|dim|aug|sus|\d)/

const TAP = /\btap\b/i

const LEADING_ROOT = /^[A-G](♯|♭)?/

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function rootPattern(root: string): RegExp {
  return new RegExp(
    `(?<![${NOTE_CHARS}])${escapeForRegExp(root)}(?![${NOTE_CHARS}])`,
  )
}

function wordingsOf(moves: readonly Move[]): string[] {
  return moves.flatMap((move) => [
    move.message,
    ...(move.soundsOff === undefined ? [] : [move.soundsOff]),
  ])
}

const WORDINGS = wordingsOf(LADDER)

describe('LADDER', () => {
  it('is four rungs, opening on the line the app already has (R2, R4, AC3)', () => {
    expect(LADDER).toHaveLength(4)
    expect(LADDER[0].message).toBe(selectFeedback([], false).message)
  })

  it('gives every rung its own trimmed, non-empty sentence (R3, AC2, AC4)', () => {
    for (const wording of WORDINGS) {
      expect(wording).not.toBe('')
      expect(wording).toBe(wording.trim())
    }

    expect(new Set(LADDER.map((move) => move.message)).size).toBe(LADDER.length)
    expect(new Set(WORDINGS).size).toBe(WORDINGS.length)
  })

  it('names no root from the game’s option set (R5, AC6)', () => {
    expect(ROOTS.length).toBe(12)

    for (const wording of WORDINGS) {
      for (const root of ROOTS) {
        expect(
          rootPattern(root).test(wording),
          `the move "${wording}" names the root ${root}`,
        ).toBe(false)
      }
    }
  })

  it('names no mode and no family from the game’s option sets (R5, AC6)', () => {
    const names = [...flavourPool(GROOVES), ...FAMILIES]
    expect(names.length).toBeGreaterThan(12)

    for (const wording of WORDINGS) {
      for (const name of names) {
        const pattern = new RegExp(`\\b${escapeForRegExp(name)}\\b`, 'i')
        expect(
          pattern.test(wording),
          `the move "${wording}" names the mode ${name}`,
        ).toBe(false)
      }
    }
  })

  it('spells no chord symbol (R5)', () => {
    for (const wording of WORDINGS) {
      expect(
        CHORD_SYMBOL.test(wording),
        `the move "${wording}" spells a chord`,
      ).toBe(false)
    }
  })

  it('gives every tap-naming move a sounds-off wording (R9, R10, AC10)', () => {
    expect(
      LADDER.filter((move) => move.soundsOff !== undefined).length,
    ).toBeGreaterThanOrEqual(1)

    for (const move of LADDER) {
      if (TAP.test(move.message)) {
        expect(
          move.soundsOff,
          `the move "${move.message}" names a tap without a sounds-off wording`,
        ).toBeDefined()
      }

      if (move.soundsOff === undefined) continue

      expect(
        TAP.test(move.soundsOff),
        `the sounds-off wording "${move.soundsOff}" names a tap`,
      ).toBe(false)
      expect(move.soundsOff).not.toBe(move.message)
    }
  })

  it('changes chord in bar three on every groove in the catalogue (R5)', () => {
    expect(GROOVES.length).toBeGreaterThan(0)

    for (const groove of GROOVES) {
      const bars = barChords(groove.progression)
      expect(bars[2], `${groove.id} repeats bar two in bar three`).not.toBe(
        bars[1],
      )
      expect(bars[2], `${groove.id} repeats bar one in bar three`).not.toBe(
        bars[0],
      )
    }
  })

  it('starts every groove in the catalogue on the answer’s root (R5)', () => {
    expect(GROOVES.length).toBeGreaterThan(0)

    for (const groove of GROOVES) {
      const first = barChords(groove.progression)[0]
      const leading = LEADING_ROOT.exec(first)
      expect(leading, `${groove.id} opens on "${first}"`).not.toBeNull()
      expect(leading?.[0], `${groove.id} opens on "${first}"`).toBe(groove.root)
    }
  })
})
