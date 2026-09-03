import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { coaching } from '@/lib/snippets'
import type { Answer, Attempt, Flavour, Root } from '../../types'
import { ROOTS } from '@/lib/theory/roots'
import { FAMILIES } from '@/lib/theory/families'
import { flavourOptions, simpleRootOptions } from '@/lib/theory/music'
import { GROOVES } from '../../data/grooves.generated'
import { GROOVE, miss } from '../../testing/puzzleHarness'
import { LADDER } from './moves'
import { COLOUR_MOVES, SIMPLE_COLOUR_MOVES, TONIC_MOVES } from './coachingMoves'
import { selectFeedback } from './feedback'
import { ruledOut } from './ruledOut'
import * as door from './index'
import {
  guessCardView,
  type GuessCardViewInput,
  type OptionState,
  type OptionView,
} from './index'

const SOURCE = resolve(
  process.cwd(),
  'src/features/daily-groove/lib/presentation/index.ts',
)

const DATE = new Date(2026, 7, 29, 12, 0, 0)
const ANSWER: Answer = { root: 'C', flavour: 'Aeolian' }

const FULL_FLAVOURS = flavourOptions(DATE, GROOVE, GROOVES)
const SIMPLE_ROOTS = simpleRootOptions(DATE, ANSWER)

const WRONG_FLAVOURS = FULL_FLAVOURS.filter((f) => f !== ANSWER.flavour)
const WRONG_ROOTS = ROOTS.filter((r) => r !== ANSWER.root)

const ABSENT_ROOT = ROOTS.find((r) => !SIMPLE_ROOTS.includes(r)) as Root
const SIMPLE_WRONG_ROOT = SIMPLE_ROOTS.find((r) => r !== ANSWER.root) as Root

const input = (over: Partial<GuessCardViewInput> = {}): GuessCardViewInput => ({
  groove: GROOVE,
  answer: ANSWER,
  attempts: [],
  date: DATE,
  selectedRoot: null,
  selectedFlavour: null,
  solved: false,
  revealed: false,
  canCheck: false,
  simple: false,
  tapSounds: true,
  ...over,
})

const rootHit = (
  flavour: Flavour,
  root: Root = ANSWER.root,
): Attempt => ({
  root,
  flavour,
  correct: false,
  rootMatched: true,
  flavourMatched: false,
})

const flavourHit = (
  root: Root,
  flavour: Flavour = ANSWER.flavour,
): Attempt => ({
  root,
  flavour,
  correct: false,
  rootMatched: false,
  flavourMatched: true,
})

const misses = (count: number): Attempt[] =>
  Array.from({ length: count }, (_, index) =>
    miss(WRONG_ROOTS[index], WRONG_FLAVOURS[index % WRONG_FLAVOURS.length], false),
  )

const values = (options: readonly OptionView[]): string[] =>
  options.map((option) => option.value)

const stateOf = (
  options: readonly OptionView[],
  value: string,
): OptionState | undefined =>
  options.find((option) => option.value === value)?.state

describe('the door is one function and the shell’s date residue', () => {
  it('exports the view model function and metaLine at runtime, and nothing else (R1, R11, AC10; F20 E3 R2)', () => {
    expect(Object.keys(door).sort()).toEqual(['guessCardView', 'metaLine'])
  })

  it('re-exports none of the coaching modules behind it (R11, AC10)', () => {
    const source = readFileSync(SOURCE, 'utf8')
    expect(source).not.toMatch(/export \*/)
    for (const name of [
      'coaching',
      'coachingFamily',
      'coachingMoves',
      'confirmed',
      'feedback',
      'moves',
      'nearMiss',
      'ruledOut',
      'verdict',
      'staffLabel',
    ]) {
      expect(source).not.toMatch(
        new RegExp(`export\\s+(?:type\\s+)?\\{[^}]*\\} from '\\./${name}'`),
      )
    }
  })

  it('takes exactly metaLine from date, the one residue R2 puts on it (F20 E3 R2, R4)', () => {
    const source = readFileSync(SOURCE, 'utf8')
    const clauses = [
      ...source.matchAll(/export\s+(?:type\s+)?\{([^}]*)\} from '\.\/date'/g),
    ].map((match) => match[1].trim())
    expect(clauses).toEqual(['metaLine'])
  })
})

describe('the two option lists', () => {
  it('offers the twelve roots in the design order in full mode (R3)', () => {
    expect(values(guessCardView(input()).roots)).toEqual(ROOTS)
  })

  it('offers simple mode’s six roots, including the answer (R3)', () => {
    const view = guessCardView(input({ simple: true }))
    expect(values(view.roots)).toEqual(SIMPLE_ROOTS)
    expect(values(view.roots)).toContain('C')
  })

  it('offers the day’s deterministic flavour options in full mode (R3)', () => {
    expect(values(guessCardView(input()).flavours)).toEqual(FULL_FLAVOURS)
  })

  it('offers the two families in simple mode (R3)', () => {
    expect(values(guessCardView(input({ simple: true })).flavours)).toEqual(
      FAMILIES,
    )
  })
})

describe('the per-option state merge', () => {
  it.each<[string, Attempt[], Record<string, OptionState>]>([
    ['nothing guessed', [], { C: 'open', G: 'open' }],
    [
      'a root the player ruled out',
      [miss('G', WRONG_FLAVOURS[0], false)],
      { G: 'out', C: 'open' },
    ],
    [
      'a confirmed root locks every other out',
      [rootHit(WRONG_FLAVOURS[0])],
      { C: 'confirmed', G: 'out' },
    ],
  ])('reads the root row after %s (R3a)', (_name, attempts, expected) => {
    const view = guessCardView(input({ attempts }))
    for (const [root, state] of Object.entries(expected)) {
      expect(stateOf(view.roots, root)).toBe(state)
    }
  })

  it('confirms the guessed mode and rules every other one out (R3a)', () => {
    const view = guessCardView(
      input({ attempts: [flavourHit(WRONG_ROOTS[0])] }),
    )
    expect(stateOf(view.flavours, ANSWER.flavour)).toBe('confirmed')
    for (const flavour of WRONG_FLAVOURS) {
      expect(stateOf(view.flavours, flavour)).toBe('out')
    }
  })

  it('leaves the root row unlocked when the confirmed root is not offered (R3a)', () => {
    const attempts = [
      rootHit(WRONG_FLAVOURS[0], ABSENT_ROOT),
      miss(SIMPLE_WRONG_ROOT, WRONG_FLAVOURS[1], false),
    ]
    const view = guessCardView(input({ simple: true, attempts }))

    expect(values(view.roots)).not.toContain(ABSENT_ROOT)
    expect(stateOf(view.roots, SIMPLE_WRONG_ROOT)).toBe('out')
    expect(stateOf(view.roots, ANSWER.root)).toBe('open')
  })

  it('leaves the mode row unlocked when the confirmed mode is not offered (R3a)', () => {
    const attempts = [
      flavourHit(WRONG_ROOTS[0], ANSWER.flavour),
      {
        root: WRONG_ROOTS[1],
        flavour: FAMILIES[0] as Flavour,
        correct: false,
        rootMatched: false,
        flavourMatched: false,
      },
    ]
    const view = guessCardView(input({ simple: true, attempts }))

    expect(values(view.flavours)).not.toContain(ANSWER.flavour)
    expect(stateOf(view.flavours, FAMILIES[0])).toBe('out')
    expect(stateOf(view.flavours, FAMILIES[1])).toBe('open')
  })

  it('rules out the roots the app narrowed away, unguessed (R3b)', () => {
    const attempts = misses(2)
    const narrowing = ruledOut({
      attempts,
      answer: ANSWER,
      roots: ROOTS,
      date: DATE,
    })
    const guessed = new Set(attempts.map((attempt) => attempt.root))
    const unguessed = narrowing.roots.filter((root) => !guessed.has(root))

    expect(unguessed.length).toBeGreaterThan(0)
    const view = guessCardView(input({ attempts }))
    for (const root of unguessed) expect(stateOf(view.roots, root)).toBe('out')
  })

  it('never rules a value out because it is the current selection (R3a)', () => {
    const view = guessCardView(
      input({ selectedRoot: 'G', selectedFlavour: WRONG_FLAVOURS[0] }),
    )
    expect(stateOf(view.roots, 'G')).toBe('open')
    expect(stateOf(view.flavours, WRONG_FLAVOURS[0])).toBe('open')
  })
})

describe('the offered selection', () => {
  it('offers a stored root the current row still holds (R3)', () => {
    expect(guessCardView(input({ selectedRoot: 'G' })).selectedRoot).toBe('G')
  })

  it('offers no root when the stored one is absent from the row (R3)', () => {
    expect(
      guessCardView(input({ simple: true, selectedRoot: ABSENT_ROOT }))
        .selectedRoot,
    ).toBeNull()
  })

  it('offers a stored mode the current row still holds (R3)', () => {
    expect(
      guessCardView(input({ selectedFlavour: WRONG_FLAVOURS[0] }))
        .selectedFlavour,
    ).toBe(WRONG_FLAVOURS[0])
  })

  it('offers no mode when the stored one is absent from the row (R3)', () => {
    expect(
      guessCardView(input({ simple: true, selectedFlavour: WRONG_FLAVOURS[0] }))
        .selectedFlavour,
    ).toBeNull()
  })
})

describe('check enablement', () => {
  it('enables the check once both halves are offered and the store allows it (R3c)', () => {
    expect(
      guessCardView(
        input({
          selectedRoot: 'G',
          selectedFlavour: WRONG_FLAVOURS[0],
          canCheck: true,
        }),
      ).check.enabled,
    ).toBe(true)
  })

  it('keeps the check disabled while only one half is chosen (R3c)', () => {
    expect(
      guessCardView(input({ selectedRoot: 'G', canCheck: true })).check.enabled,
    ).toBe(false)
  })

  it('keeps the check disabled when the store says it cannot check (R3c)', () => {
    expect(
      guessCardView(
        input({
          selectedRoot: 'G',
          selectedFlavour: WRONG_FLAVOURS[0],
          canCheck: false,
        }),
      ).check.enabled,
    ).toBe(false)
  })

  it('keeps the check disabled on a revealed day (R3c)', () => {
    expect(
      guessCardView(
        input({
          selectedRoot: 'G',
          selectedFlavour: WRONG_FLAVOURS[0],
          canCheck: true,
          revealed: true,
        }),
      ).check.enabled,
    ).toBe(false)
  })

  it('keeps the check disabled when the stored mode is not offered (R3c)', () => {
    expect(
      guessCardView(
        input({
          simple: true,
          selectedRoot: ANSWER.root,
          selectedFlavour: WRONG_FLAVOURS[0],
          canCheck: true,
        }),
      ).check.enabled,
    ).toBe(false)
  })
})

describe('the check button’s label and tone', () => {
  it.each<[string, Partial<GuessCardViewInput>, string]>([
    ['nothing chosen', {}, coaching.pickRootAndMode],
    ['only a root', { selectedRoot: 'G' }, coaching.pickMode],
    ['only a mode', { selectedFlavour: WRONG_FLAVOURS[0] }, coaching.pickRoot],
    [
      'both chosen',
      {
        selectedRoot: 'G',
        selectedFlavour: WRONG_FLAVOURS[0],
        canCheck: true,
      },
      coaching.checkPair({ root: 'G', flavour: WRONG_FLAVOURS[0] }),
    ],
    [
      'a solved day',
      { selectedRoot: 'C', selectedFlavour: ANSWER.flavour, solved: true },
      coaching.checkSolved,
    ],
    [
      'a revealed day, nothing chosen',
      { attempts: misses(3), revealed: true },
      coaching.checkRevealed,
    ],
    [
      'a revealed day, a root chosen',
      { attempts: misses(3), revealed: true, selectedRoot: 'G' },
      coaching.checkRevealed,
    ],
    [
      'a revealed day, both chosen',
      {
        attempts: misses(3),
        revealed: true,
        selectedRoot: 'G',
        selectedFlavour: WRONG_FLAVOURS[0],
        canCheck: true,
      },
      coaching.checkRevealed,
    ],
  ])(
    'asks for the half that is missing with %s (F20 E2 R3c; was GuessCard.test.tsx CTA_CASES)',
    (_name, over, label) => {
      expect(guessCardView(input(over)).check.label).toBe(label)
    },
  )

  it('keeps Solved above Revealed in the chain (F22 E3 R5, AC4)', () => {
    expect(
      guessCardView(input({ solved: true, revealed: true })).check.label,
    ).toBe(coaching.checkSolved)
  })

  it.each<[string, Partial<GuessCardViewInput>, string]>([
    ['idle while a half is missing', {}, 'idle'],
    [
      'ready once a check is legal',
      {
        selectedRoot: 'G',
        selectedFlavour: WRONG_FLAVOURS[0],
        canCheck: true,
      },
      'ready',
    ],
    ['solved once the day is won', { solved: true }, 'solved'],
    [
      'idle on a revealed day',
      {
        selectedRoot: 'G',
        selectedFlavour: WRONG_FLAVOURS[0],
        canCheck: true,
        revealed: true,
      },
      'idle',
    ],
    [
      'idle on a revealed day with nothing chosen',
      { attempts: misses(3), revealed: true },
      'idle',
    ],
  ])('tones the control %s (R3c)', (_name, over, tone) => {
    expect(guessCardView(input(over)).check.tone).toBe(tone)
  })
})

describe('the hint box’s contents', () => {
  it('carries the opening move and no verdict on a fresh day (R3)', () => {
    const { hint } = guessCardView(input())
    expect(hint.show).toBe(true)
    expect(hint.feedback).toBeNull()
    expect(hint.coaching).toEqual({ message: LADDER[0].message, tone: 'neutral' })
    expect(hint.eliminated).toBeNull()
  })

  it('carries the verdict on the first miss (R3)', () => {
    const attempts = misses(1)
    const { hint } = guessCardView(input({ attempts }))
    expect(hint.feedback).toEqual(selectFeedback([...attempts], false))
    expect(hint.feedback).not.toBeNull()
  })

  it('drops the verdict on a repeat miss that reveals nothing new (R3)', () => {
    expect(guessCardView(input({ attempts: misses(2) })).hint.feedback).toBeNull()
  })

  it('walks the general ladder while neither half is confirmed (R3)', () => {
    expect(
      guessCardView(input({ attempts: misses(1) })).hint.coaching?.message,
    ).toBe(LADDER[1].message)
  })

  it('switches to the colour moves once a root is confirmed (R3)', () => {
    expect(
      guessCardView(input({ attempts: [rootHit(WRONG_FLAVOURS[0])] })).hint
        .coaching?.message,
    ).toBe(COLOUR_MOVES[0].message)
  })

  it('switches to the tonic moves once a mode is confirmed (R3)', () => {
    expect(
      guessCardView(input({ attempts: [flavourHit(WRONG_ROOTS[0])] })).hint
        .coaching?.message,
    ).toBe(TONIC_MOVES[0].message)
  })

  it('uses simple mode’s colour moves when simple mode is on (R3)', () => {
    expect(
      guessCardView(
        input({ simple: true, attempts: [rootHit(FAMILIES[0] as Flavour)] }),
      ).hint.coaching?.message,
    ).toBe(SIMPLE_COLOUR_MOVES[0].message)
  })

  it('uses the sounds-off wording when tap sounds are off (R3)', () => {
    expect(
      guessCardView(
        input({ tapSounds: false, attempts: [rootHit(WRONG_FLAVOURS[0])] }),
      ).hint.coaching?.message,
    ).toBe(COLOUR_MOVES[0].soundsOff)
  })

  it('carries the narrowing count while the nudge shows (R3)', () => {
    const attempts = misses(2)
    const narrowing = ruledOut({
      attempts,
      answer: ANSWER,
      roots: ROOTS,
      date: DATE,
    })
    expect(narrowing.eliminatedCount).toBeGreaterThan(0)
    expect(guessCardView(input({ attempts })).hint.eliminated).toBe(
      narrowing.eliminatedCount,
    )
  })

  it('carries no count once a root is confirmed (R3)', () => {
    const attempts = [...misses(2), rootHit(WRONG_FLAVOURS[0])]
    expect(guessCardView(input({ attempts })).hint.eliminated).toBeNull()
  })

  it('carries no count once the day is solved (R3)', () => {
    expect(
      guessCardView(input({ attempts: misses(2), solved: true })).hint
        .eliminated,
    ).toBeNull()
  })

  it('hides the hint on a solved day and on a revealed day (R3)', () => {
    expect(guessCardView(input({ solved: true })).hint.show).toBe(false)
    expect(guessCardView(input({ revealed: true })).hint.show).toBe(false)
  })
})

describe('the give-up offer and the day being over', () => {
  it.each([0, 1, 2])('offers no give-up after %i misses (R3)', (count) => {
    expect(guessCardView(input({ attempts: misses(count) })).giveUp).toBe(false)
  })

  it('offers the give-up path on the third miss (R3)', () => {
    expect(guessCardView(input({ attempts: misses(3) })).giveUp).toBe(true)
  })

  it('offers no give-up once the day is solved (R3)', () => {
    expect(
      guessCardView(input({ attempts: misses(3), solved: true })).giveUp,
    ).toBe(false)
  })

  it('offers no give-up once the answer is revealed (R3)', () => {
    expect(
      guessCardView(input({ attempts: misses(3), revealed: true })).giveUp,
    ).toBe(false)
  })

  it('is not over on a playable day (R3)', () => {
    expect(guessCardView(input()).over).toBe(false)
  })

  it('is over once solved and once revealed (R3)', () => {
    expect(guessCardView(input({ solved: true })).over).toBe(true)
    expect(guessCardView(input({ revealed: true })).over).toBe(true)
  })
})

describe('it is a pure function', () => {
  it('returns equal output for equal input, called twice (R2, AC1)', () => {
    const args = input({
      attempts: [miss('G', WRONG_FLAVOURS[0], false)],
      selectedRoot: 'F',
    })
    expect(guessCardView(args)).toEqual(guessCardView(args))
  })

  it('mutates none of its input (R2)', () => {
    const attempts = [miss('G', WRONG_FLAVOURS[0], false)]
    const frozen = JSON.stringify(attempts)
    guessCardView(input({ attempts }))
    expect(JSON.stringify(attempts)).toBe(frozen)
  })

  it('touches no React, no clock and no storage (R2, AC1)', () => {
    const source = readFileSync(SOURCE, 'utf8')
    expect(source).not.toMatch(/from 'react'/)
    expect(source).not.toMatch(/\bnew Date\(/)
    expect(source).not.toMatch(/\bDate\.now\(/)
    expect(source).not.toMatch(/localStorage|sessionStorage/)
  })

  it('reads the same on a day it is not (R2, AC1)', () => {
    const baseline = guessCardView(input({ attempts: misses(2) }))
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2027, 0, 1))
      expect(guessCardView(input({ attempts: misses(2) }))).toEqual(baseline)
    } finally {
      vi.useRealTimers()
    }
  })
})
