import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  control,
  guess,
  installPuzzleAudio,
  nudgeLine,
  otherWrongFlavour,
  renderPuzzle,
  resetMockStore,
  teardownPuzzleAudio,
  thirdWrongFlavour,
  wrongFlavour,
} from '../testing/puzzleHarness'

const { mockStore } = await vi.hoisted(async () => {
  const { createMockStore } = await import('../testing/puzzleHarness')
  return { mockStore: createMockStore() }
})
vi.mock('../lib/persistence/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/persistence/storage')>()),
  createLocalStore: () => mockStore,
}))

const BANNED: readonly RegExp[] = [
  /attempts?\b/i,
  /\bpar\b/i,
  /\b\d+\s+(?:tries|guesses|goes)\b/i,
  /\b(?:one|two|three|four|five|six|seven)\s+(?:tries|guesses)\b/i,
]

const LABELLING_ATTRIBUTES = [
  'aria-label',
  'title',
  'alt',
  'aria-description',
  'aria-roledescription',
  'aria-valuetext',
  'aria-placeholder',
  'placeholder',
] as const

function readablePage(): string[] {
  const strings = [document.body.textContent ?? '']
  for (const element of Array.from(document.body.querySelectorAll('*'))) {
    for (const attribute of LABELLING_ATTRIBUTES) {
      const value = element.getAttribute(attribute)
      if (value !== null && value.trim() !== '') strings.push(value)
    }
  }
  return strings
}

function offendingCopy(strings: readonly string[]): string[] {
  const hits: string[] = []
  for (const text of strings) {
    for (const pattern of BANNED) {
      const found = text.match(pattern)
      if (found !== null && !hits.includes(found[0])) hits.push(found[0])
    }
  }
  return hits
}

describe('nothing on the page counts your tries (F19 E1)', () => {
  beforeEach(() => {
    resetMockStore(mockStore)
    installPuzzleAudio()
  })

  afterEach(() => {
    teardownPuzzleAudio()
  })

  const giveUp = () =>
    screen.queryByRole('button', {
      name: /give up and show the answer|end the day and show the answer/i,
    })

  it('catches copy that names a count, however it is worded (F19 E1 R8, AC10)', () => {
    expect(offendingCopy(['2 of 3 attempts spent · 3 is par, not a limit'])).toEqual(
      expect.arrayContaining(['attempts', 'par']),
    )
    expect(offendingCopy(['You have 2 guesses left'])).not.toEqual([])
    expect(offendingCopy(['three guesses in and still nothing'])).not.toEqual([])
    expect(offendingCopy(['4 roots ruled out', 'You said Lydian — a tone apart'])).toEqual(
      [],
    )
  })

  it('counts nothing before the first guess (F19 E1 R1, R8, AC1, AC10)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    expect(screen.getByRole('heading', { name: /how to play/i })).toBeInTheDocument()
    expect(readablePage()).toEqual(
      expect.arrayContaining(['Close how to play', 'Current streak']),
    )
    expect(offendingCopy(readablePage())).toEqual([])
    expect(document.querySelectorAll('[data-dot-state]')).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Close how to play' }))
    expect(offendingCopy(readablePage())).toEqual([])
  })

  it('counts nothing while the guessing is going on (F19 E1 R1, R8, R9, AC2, AC10, AC11)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'G', wrongFlavour())
    expect(offendingCopy(readablePage())).toEqual([])

    await guess(user, 'D', otherWrongFlavour())
    expect(nudgeLine()).toBeInTheDocument()
    expect(offendingCopy(readablePage())).toEqual([])

    await guess(user, 'A', thirdWrongFlavour())
    expect(giveUp()).toHaveAccessibleName('Give up and show the answer')
    expect(offendingCopy(readablePage())).toEqual([])
  })

  it('counts nothing once the day is solved (F19 E1 R1, R8, AC3, AC10)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    await guess(user, 'C', 'Aeolian')

    expect(control()).toHaveAccessibleName('Solved')
    expect(offendingCopy(readablePage())).toEqual([])
  })

  it('counts nothing, and says nothing about the streak, on a day given up on (F19 E1 R1, R7, R8, AC3, AC9, AC10)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    await guess(user, 'D', otherWrongFlavour())
    await guess(user, 'A', thirdWrongFlavour())
    await user.click(giveUp() as HTMLElement)
    await user.click(giveUp() as HTMLElement)

    expect(screen.getByRole('heading', { name: 'C Aeolian' })).toBeInTheDocument()
    expect(offendingCopy(readablePage())).toEqual([])
    expect(document.body.textContent).not.toMatch(
      /streak (?:lost|broken|reset|over|ended)/i,
    )
    expect(document.body.textContent).not.toMatch(/back to (?:zero|0)/i)
    expect(screen.getByLabelText(/current streak/i)).toHaveTextContent(
      /no streak yet/i,
    )
  })
})
