import { describe, it, expect } from 'vitest'
import type { Answer, Attempt } from '../../types'
import { FAMILIES, familyOf } from '../theory/families'
import { ROOTS } from '../theory/music'
import { exactMatch, familyMatch, scoreAttempt } from '../puzzle/scoring'
import { confirmedHalves } from './confirmed'

const attempt = (
  root: Attempt['root'],
  flavour: string,
  rootMatched: boolean,
  flavourMatched: boolean,
): Attempt => ({
  root,
  flavour,
  correct: rootMatched && flavourMatched,
  rootMatched,
  flavourMatched,
})

const ROOT_ONLY = attempt('C', 'Dorian', true, false)
const FLAVOUR_ONLY = attempt('G', 'Aeolian', false, true)
const NEITHER = attempt('G', 'Dorian', false, false)
const OTHER_NEITHER = attempt('A', 'Lydian', false, false)
const EXACT = attempt('C', 'Aeolian', true, true)

describe('confirmedHalves', () => {
  it('confirms the root when a checked guess had the right root and the wrong mode (R1, AC1)', () => {
    expect(confirmedHalves([ROOT_ONLY])).toEqual({ roots: ['C'], flavours: [] })
  })

  it('confirms the mode when a checked guess had the right mode and the wrong root (R1, AC2)', () => {
    expect(confirmedHalves([FLAVOUR_ONLY])).toEqual({
      roots: [],
      flavours: ['Aeolian'],
    })
  })

  it('confirms nothing before anything is checked, and nothing from a guess that missed both halves (R2, R5, AC4)', () => {
    expect(confirmedHalves([])).toEqual({ roots: [], flavours: [] })
    expect(confirmedHalves([NEITHER, OTHER_NEITHER, NEITHER])).toEqual({
      roots: [],
      flavours: [],
    })
  })

  it('reads the whole list, not the last attempt (R3, AC5)', () => {
    expect(confirmedHalves([ROOT_ONLY, NEITHER, OTHER_NEITHER]).roots).toEqual([
      'C',
    ])
    expect(confirmedHalves([FLAVOUR_ONLY, NEITHER]).flavours).toEqual([
      'Aeolian',
    ])
    expect(confirmedHalves([NEITHER, ROOT_ONLY]).roots).toEqual(
      confirmedHalves([ROOT_ONLY, NEITHER]).roots,
    )
  })

  it('records each confirmed half once, in the order it was first established (R3, AC5)', () => {
    const twelve = [
      NEITHER,
      ROOT_ONLY,
      OTHER_NEITHER,
      FLAVOUR_ONLY,
      ROOT_ONLY,
      NEITHER,
      FLAVOUR_ONLY,
      OTHER_NEITHER,
      ROOT_ONLY,
      NEITHER,
      FLAVOUR_ONLY,
      EXACT,
    ]
    expect(twelve).toHaveLength(12)
    expect(confirmedHalves(twelve)).toEqual({
      roots: ['C'],
      flavours: ['Aeolian'],
    })
    expect(confirmedHalves([ROOT_ONLY, ROOT_ONLY, ROOT_ONLY]).roots).toEqual([
      'C',
    ])

    const laterRoot = attempt('G', 'Lydian', true, true)
    const laterFlavour = attempt('A', 'Phrygian', false, true)
    expect(
      confirmedHalves([ROOT_ONLY, FLAVOUR_ONLY, laterRoot, laterFlavour]),
    ).toEqual({
      roots: ['C', 'G'],
      flavours: ['Aeolian', 'Lydian', 'Phrygian'],
    })
  })

  it('confirms both halves of a solve, whichever end of the list it sits at (R8, AC10)', () => {
    expect(confirmedHalves([NEITHER, EXACT])).toEqual({
      roots: ['C'],
      flavours: ['Aeolian'],
    })
    expect(confirmedHalves([EXACT, NEITHER])).toEqual({
      roots: ['C'],
      flavours: ['Aeolian'],
    })
  })

  it('can only ever confirm the day’s own half (R7, AC9)', () => {
    const answer: Answer = { root: 'C', flavour: 'Aeolian' }
    const guesses: Answer[] = ROOTS.flatMap((root) =>
      ['Dorian', 'Aeolian', 'Lydian', 'Mixolydian'].map((flavour) => ({
        root,
        flavour,
      })),
    )

    const full = confirmedHalves(
      guesses.map((guess) => scoreAttempt(answer, guess, exactMatch)),
    )
    expect(full.roots).toEqual([answer.root])
    expect(full.flavours).toEqual([answer.flavour])

    const simple = confirmedHalves(
      ROOTS.flatMap((root) =>
        FAMILIES.map((family) =>
          scoreAttempt(answer, { root, flavour: family }, familyMatch),
        ),
      ),
    )
    expect(simple.roots).toEqual([answer.root])
    expect(simple.flavours).toEqual([familyOf(answer.flavour)])
  })
})
