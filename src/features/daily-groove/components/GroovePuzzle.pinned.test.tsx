import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import type { Attempt, Groove } from '../types'
import { answerOf } from '@/lib/theory/music'
import { isoDate } from '@/lib/date'
import { coaching, puzzle, solved } from '@/lib/snippets'
import { GROOVES } from '../data/grooves.generated'
import { selectGrooveForDate } from '../lib/puzzle/selectGroove'
import {
  clearStored,
  installPuzzleAudio,
  seedDay,
  seedFullSet,
  teardownPuzzleAudio,
} from '../testing/puzzleHarness'
import { settleFeature } from '../testing/renderFeature'
import { GroovePuzzle } from './GroovePuzzle'

const PHASES_TO_PLAYABLE = 1
const PHASE_CAP = 12

const NOW = () => new Date()

const MIX = selectGrooveForDate(NOW(), GROOVES)

function pinnedGroove(): Groove {
  const found = GROOVES.find((g) => g.uuid !== MIX.uuid && g.name !== MIX.name)
  if (!found) throw new Error('the catalogue holds no groove distinct from the mix')
  return found
}

const PINNED = pinnedGroove()

const solving = (groove: Groove): Attempt => ({
  root: groove.root,
  flavour: groove.flavour,
  correct: true,
  rootMatched: true,
  flavourMatched: true,
})

describe('GroovePuzzle, pinned to the groove the day was played on', () => {
  beforeEach(async () => {
    clearStored()
    await seedFullSet()
    installPuzzleAudio()
  })

  afterEach(() => {
    teardownPuzzleAudio()
    clearStored()
  })

  it('opens a played day on that groove, already solved (AC7, AC10)', async () => {
    await seedDay({
      date: isoDate(NOW()),
      answer: answerOf(PINNED),
      attempts: [solving(PINNED)],
      solved: true,
      grooveId: PINNED.id,
    })

    const { container } = render(<GroovePuzzle />)

    expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
    expect(screen.getByText(puzzle.loading)).toBeInTheDocument()

    await settleFeature()

    expect(
      screen.getByRole('heading', { level: 2, name: PINNED.name }),
    ).toBeInTheDocument()
    expect(screen.getByText(solved.changes)).toBeInTheDocument()
    expect(container.textContent).not.toContain(MIX.name)
    expect(
      screen.getByRole('button', { name: coaching.checkSolved }),
    ).toBeInTheDocument()
  })

  it('reaches a playable board in the phases it already took (AC11)', async () => {
    render(<GroovePuzzle />)

    let phases = 0
    while (
      screen.queryByRole('radiogroup', { name: puzzle.rootGroup }) === null &&
      phases < PHASE_CAP
    ) {
      await act(async () => {
        await Promise.resolve()
      })
      phases += 1
    }

    expect(screen.getByRole('radiogroup', { name: puzzle.rootGroup })).toBeInTheDocument()
    expect(phases).toBe(PHASES_TO_PLAYABLE)
  })
})
