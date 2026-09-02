import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Groove, Root } from '../types'
import {
  CHANGES_READ,
  chipLabel,
  control,
  dotStates,
  flavourGroup,
  flavours,
  GROOVE,
  guess,
  installPuzzleAudio,
  miss,
  nudge,
  otherWrongFlavour,
  play,
  renderPuzzle,
  resetMockStore,
  rootGroup,
  SOLVING,
  teardownPuzzleAudio,
  TODAY,
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

import { GroovePuzzle } from './GroovePuzzle'
import {
  answerOf,
  flavourOptions,
  ROOTS,
  simpleRootOptions,
} from '../lib/theory/music'
import { createLocalPreferenceStore } from '../lib/persistence/preferences'
import { isoDate, selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { GROOVES } from '../data/grooves.generated'

describe('GroovePuzzle', () => {
  beforeEach(() => {
    resetMockStore(mockStore)
    installPuzzleAudio()
  })

  afterEach(() => {
    teardownPuzzleAudio()
  })

  it('renders a play control and the guessing card (R1, R2, AC1)', async () => {
    await renderPuzzle()

    expect(screen.getByRole('button', { name: /^play the loop$/i })).toBeInTheDocument()
    expect(within(rootGroup()).getAllByRole('button')).toHaveLength(12)
    expect(within(flavourGroup()).getAllByRole('button')).toHaveLength(4)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('leaves the nudge’s revealed root on the serif (E4 R2, AC2)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)

    const root = within(nudge() as HTMLElement).getByText('C')
    expect(root.className).toMatch(/font-display/)
    expect(root.className).not.toMatch(/font-jazz/)
  })

  it("offers the day's deterministic flavour options, including the answer (R3, R4)", async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 7, 29, 12, 0, 0))
      await renderPuzzle()

      const expected = flavourOptions(new Date(2026, 7, 29, 12, 0, 0), GROOVE)
      const rendered = within(flavourGroup())
        .getAllByRole('button')
        .map(chipLabel)

      expect(rendered).toEqual(expected)
      expect(rendered).toContain('Aeolian')
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers all twelve roots every day (R2)', async () => {
    await renderPuzzle()
    expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
      ROOTS,
    )
  })

  it('drives the whole guess flow through the real store (R5, R7, R10, R11, R12)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    const wrong = wrongFlavour()

    expect(control()).toHaveAccessibleName('Pick a root and a mode')
    expect(control()).toBeDisabled()

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    expect(control()).toHaveAccessibleName('Pick a root and a mode')
    expect(control()).toBeDisabled()

    await user.click(within(flavourGroup()).getByRole('button', { name: wrong }))
    expect(control()).toHaveAccessibleName(`Check C ${wrong}`)
    expect(control()).toBeEnabled()

    await user.click(control())
    expect(screen.getByText(/right home note/i)).toBeInTheDocument()
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(flavourGroup()).getByRole('button', { name: wrong }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(control()).toBeDisabled()

    await user.click(within(flavourGroup()).getByRole('button', { name: 'Aeolian' }))
    expect(control()).toHaveAccessibleName('Check C Aeolian')
    expect(control()).toBeEnabled()

    await user.click(control())
    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
    expect(control()).toHaveAccessibleName('Solved')
    expect(control()).toBeDisabled()

    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('replaces rather than accumulates a selection (R5, AC5)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))

    const pressed = within(rootGroup())
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.map(chipLabel)).toEqual(['G'])
  })

  it('opens with three unspent dots and the opening guidance (E3 R1, R4, AC1, AC4)', async () => {
    await renderPuzzle()

    expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
    expect(screen.getByText(/feels like rest/i)).toBeInTheDocument()
    expect(nudge()).not.toBeInTheDocument()
  })

  it('spends a dot and names the half that matched on each wrong guess (E3 R1, R3, AC2, AC5, AC7)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    expect(dotStates()).toEqual(['spent', 'unspent', 'unspent'])
    expect(screen.getByText(/right home note/i)).toBeInTheDocument()
    expect(nudge()).not.toBeInTheDocument()

    await guess(user, 'G', wrong)
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
    expect(screen.getByText(/not it\. keep playing/i)).toBeInTheDocument()
  })

  it("reveals the day's root in a nudge after the second miss (E3 R5, R6, AC8, AC9)", async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    expect(nudge()).not.toBeInTheDocument()

    await guess(user, 'G', wrong)
    const box = nudge() as HTMLElement
    expect(box).toBeInTheDocument()
    expect(box.textContent).toMatch(/root is C\./)
  })

  it('hands the day\u2019s root over as a selection when the nudge arrives (F7 E3 R4, R5, AC3, AC5)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    expect(nudge()).toBeInTheDocument()

    const chips = within(rootGroup()).getAllByRole('button')
    expect(chips).toHaveLength(12)
    for (const chip of chips) expect(chip).toBeEnabled()
    expect(
      chips
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map(chipLabel),
    ).toEqual(['C'])
    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(chips.filter((b) => b.getAttribute('aria-disabled') === 'true')).toEqual(
      [],
    )
  })

  it('lets the player overrule the auto-selected root, and keeps their choice (F7 E3 R5, AC4)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()
    const other = otherWrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(rootGroup()).getByRole('button', { name: 'D' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'D' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(control()).toHaveAccessibleName(`Check D ${wrong}`)

    await user.click(within(flavourGroup()).getByRole('button', { name: other }))
    await user.click(control())
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(
      within(rootGroup()).getByRole('button', { name: 'D' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('never locks the player out, however many guesses miss (E3 R8, AC3, AC12)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()
    const other = otherWrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    await guess(user, 'G', other)

    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(control()).toBeDisabled()
    await user.click(within(rootGroup()).getByRole('button', { name: 'D' }))
    expect(control()).toBeEnabled()

    await user.click(control())
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(nudge()).toBeInTheDocument()
  })

  it('withdraws the nudge and turns the dots on the solve (E3 R9, AC13)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    expect(nudge()).toBeInTheDocument()

    await guess(user, 'C', 'Aeolian')

    expect(nudge()).not.toBeInTheDocument()
    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
    expect(dotStates()).toEqual(['solved', 'solved', 'solved'])
  })

  const giveUp = () =>
    screen.queryByRole('button', {
      name: /give up and show the answer|end the day and show the answer/i,
    })

  const solutionPanel = () =>
    screen
      .getByRole('heading', { name: 'C Aeolian' })
      .closest('[role="status"]') as HTMLElement

  it('offers the way out only from the third miss, and ends the day on the second press (F7 E3 R6, R7, R8, AC6, AC8a)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    expect(giveUp()).toBeNull()
    await guess(user, 'G', wrong)
    expect(giveUp()).toBeNull()

    const third = otherWrongFlavour()
    await guess(user, 'G', third)
    expect(giveUp()).toHaveAccessibleName('Give up and show the answer')

    await user.click(giveUp() as HTMLElement)
    expect(giveUp()).toHaveAccessibleName(
      'Yes \u2014 end the day and show the answer',
    )
    expect(
      screen.queryByRole('heading', { name: 'C Aeolian' }),
    ).not.toBeInTheDocument()

    await user.click(giveUp() as HTMLElement)
    const panel = solutionPanel()
    expect(panel).toBeInTheDocument()
    expect(within(panel).getByText(/given up/i)).toBeInTheDocument()
    expect(screen.queryByText(/solved in/i)).toBeNull()
    expect(screen.queryByText(/streak now/i)).toBeNull()
    expect(
      within(panel).getByRole('img', { name: CHANGES_READ }),
    ).toBeInTheDocument()
    expect(
      within(panel).getByText(new RegExp(`^You said ${third} — `)),
    ).toBeInTheDocument()

    expect(giveUp()).toBeNull()
    expect(control()).toBeDisabled()
    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'A' }),
    ).toHaveAttribute('aria-pressed', 'false')
    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Aeolian' }),
    )
    expect(
      within(flavourGroup()).getByRole('button', { name: 'Aeolian' }),
    ).toHaveAttribute('aria-pressed', 'false')

    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    const saved = mockStore.save.mock.calls.at(-1)?.[0] as DailyResult
    expect(saved.attempts).toHaveLength(3)
    expect(saved.solved).toBe(false)
    expect(saved.revealed).toBe(true)
  })

  it('reopens a revealed day on the terminal state, not a fresh puzzle (F7 E3 R8, AC9)', async () => {
    const wrong = wrongFlavour()
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [
        miss('C', wrong, true),
        miss('G', wrong, false),
        miss('G', otherWrongFlavour(), false),
      ],
      solved: false,
      revealed: true,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const user = userEvent.setup()
    await renderPuzzle()

    const panel = solutionPanel()
    expect(panel).toBeInTheDocument()
    expect(within(panel).getByText(/given up/i)).toBeInTheDocument()
    expect(
      within(panel).getByRole('img', { name: CHANGES_READ }),
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole('group', { name: /notes to live in/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/solved in/i)).toBeNull()

    expect(giveUp()).toBeNull()
    expect(control()).toBeDisabled()
    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'A' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(mockStore.save).not.toHaveBeenCalled()
  })

  it('never reveals the chord or the progression while unsolved (E4 R6, AC7)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    expect(container.textContent).not.toContain(GROOVE.chord)
    expect(container.textContent).not.toContain(GROOVE.progression)

    await guess(user, 'G', wrongFlavour())
    expect(container.textContent).not.toContain(GROOVE.chord)
    expect(container.textContent).not.toContain(GROOVE.progression)
    expect(
      screen.queryByRole('heading', { name: 'C Aeolian' }),
    ).not.toBeInTheDocument()
  })

  it('opens the solved panel with the answer, its lesson, the near miss and the changes (E4 R1-R5, AC1, AC3, AC4, F15 E1 R5, F15 E4 R1, R2, AC1, AC2)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'C', 'Aeolian')

    expect(
      screen.getByRole('heading', { name: 'C Aeolian' }),
    ).toBeInTheDocument()
    const panel = solutionPanel()
    expect(panel.textContent).toMatch(/the plain minor scale/i)
    expect(panel.textContent).not.toMatch(/tr(y|ies)/i)
    expect(panel.textContent).not.toMatch(/streak/i)
    expect(screen.getByRole('img', { name: 'Solved' })).toBeInTheDocument()
    expect(
      within(panel).getByText(new RegExp(`^You said ${wrong} — `)),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Current streak')).toHaveTextContent(
      '1 day streak',
    )
    expect(
      within(container).getByRole('img', { name: CHANGES_READ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: /notes to live in/i }),
    ).toBeInTheDocument()
  })

  const DORIAN: Groove = { ...GROOVE, flavour: 'Dorian', scale: 'C Dorian' }

  const MIXOLYDIAN: Groove = {
    ...GROOVE,
    flavour: 'Mixolydian',
    scale: 'C Mixolydian',
  }

  async function enableSimpleMode() {
    await createLocalPreferenceStore().update({ simpleMode: true })
  }

  const modeSwitch = () => screen.getByRole('switch', { name: /simple mode/i })

  const simpleRoots = () => simpleRootOptions(new Date(), answerOf(DORIAN))

  const chipTexts = (group: HTMLElement) =>
    within(group).getAllByRole('button').map(chipLabel)

  const MODE_NAME = /ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian/i

  it('does not let a switch leave an unofferable pair checkable (E5 R4, R8)', async () => {
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    const staleRoot = ROOTS.find((r) => !simpleRoots().includes(r)) as Root
    await user.click(within(rootGroup()).getByRole('button', { name: staleRoot }))
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Dorian' }))
    expect(control()).toHaveAccessibleName(`Check ${staleRoot} Dorian`)
    expect(control()).toBeEnabled()

    await user.click(modeSwitch())

    expect(chipTexts(rootGroup())).not.toContain(staleRoot)
    expect(
      within(rootGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    expect(
      within(flavourGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    expect(control()).toHaveAccessibleName('Pick a root and a mode')
    expect(control()).toBeDisabled()

    await user.click(modeSwitch())
    expect(control()).toHaveAccessibleName(`Check ${staleRoot} Dorian`)
    expect(control()).toBeEnabled()
  })

  it('narrows both rows to six roots and two families in simple mode (E5 R2, R3, R4, AC2, AC3)', async () => {
    await enableSimpleMode()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    expect(chipTexts(rootGroup())).toEqual(simpleRoots())
    expect(chipTexts(rootGroup())).toHaveLength(6)
    expect(chipTexts(rootGroup())).toContain('C')

    expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])

    expect(rootGroup().textContent).not.toMatch(MODE_NAME)
    expect(flavourGroup().textContent).not.toMatch(MODE_NAME)
  })

  it('offers all twelve roots and four modes with simple mode off (E5 R2, R4, AC2, AC3)', async () => {
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    expect(chipTexts(rootGroup())).toEqual(ROOTS)
    expect(chipTexts(flavourGroup())).toEqual(flavourOptions(new Date(), DORIAN))
    expect(chipTexts(flavourGroup())).toHaveLength(4)
    expect(chipTexts(flavourGroup())).not.toContain('Minor')
    expect(chipTexts(flavourGroup())).not.toContain('Major')
  })

  it('solves a Dorian day from its root and the minor option (E5 R5, AC4)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    await guess(user, 'C', 'Minor')

    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
    expect(control()).toHaveAccessibleName('Solved')
    expect(screen.getByRole('heading', { name: 'C Dorian' })).toBeInTheDocument()
  })

  it('misses a Mixolydian day guessed minor (E5 R5, AC5)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={MIXOLYDIAN} />)

    await guess(user, 'C', 'Minor')

    expect(screen.queryByText(/the groove is yours now/i)).toBeNull()
    expect(dotStates()).toEqual(['spent', 'unspent', 'unspent'])
    expect(screen.getByText(/right home note/i)).toBeInTheDocument()

    await user.click(within(flavourGroup()).getByRole('button', { name: 'Major' }))
    await user.click(control())
    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
  })

  it('keeps the day when the toggle is flipped mid-play (E5 R8, R8a, AC8, AC8a)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
    const writes = mockStore.save.mock.calls.length

    expect(modeSwitch()).toBeEnabled()
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'false')
    await user.click(modeSwitch())
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')

    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
    expect(mockStore.save.mock.calls).toHaveLength(writes)
    expect(mockStore.save.mock.calls.at(-1)?.[0].attempts).toHaveLength(2)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Test Groove' }),
    ).toBeInTheDocument()
    expect(nudge()).toBeInTheDocument()

    expect(chipTexts(rootGroup())).toHaveLength(6)
    expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])

    await user.click(within(flavourGroup()).getByRole('button', { name: 'Minor' }))
    await user.click(control())
    expect(dotStates()).toEqual(['solved', 'solved', 'solved'])
    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
    expect(mockStore.save.mock.calls.at(-1)?.[0].attempts).toHaveLength(3)

    expect(modeSwitch()).toBeDisabled()
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
    await user.click(modeSwitch())
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps the nudge and the way out at the same thresholds in simple mode (E5 R10, AC10)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle()
    const [wrongRoot, otherWrongRoot] = simpleRoots().filter((r) => r !== 'C')

    await guess(user, wrongRoot, 'Major')
    expect(nudge()).not.toBeInTheDocument()
    expect(giveUp()).toBeNull()

    await guess(user, otherWrongRoot, 'Major')
    const box = nudge() as HTMLElement
    expect(box).toBeInTheDocument()
    expect(box.textContent).toMatch(/root is C\./)
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(giveUp()).toBeNull()

    await user.click(control())
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(giveUp()).toHaveAccessibleName('Give up and show the answer')
  })

  it('records a day solved in simple mode as solved, and counts it (E5 R9, AC9)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    await guess(user, 'C', 'Minor')

    const saved = mockStore.save.mock.calls.at(-1)?.[0] as DailyResult
    expect(saved.solved).toBe(true)
    expect(saved.revealed).toBeUndefined()
    expect(saved.answer).toEqual({ root: 'C', flavour: 'Dorian' })
    expect(screen.getByLabelText('Current streak')).toHaveTextContent(
      '1 day streak',
    )
  })

  it('carries the preference into the page it opens with (E5 R7, AC7)', async () => {
    await enableSimpleMode()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
    expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])
  })

  it('carries no near-miss line on a simple-mode day (F15 E4 R5, R5a, AC4)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle()
    const [wrongRoot, otherWrongRoot] = simpleRoots().filter((r) => r !== 'C')

    await guess(user, wrongRoot, 'Major')
    await guess(user, otherWrongRoot, 'Major')
    await user.click(control())
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])

    await user.click(giveUp() as HTMLElement)
    await user.click(giveUp() as HTMLElement)

    const panel = solutionPanel()
    expect(
      within(panel).getByRole('heading', { name: 'C Aeolian' }),
    ).toBeInTheDocument()
    expect(within(panel).getByText(/the plain minor scale/i)).toBeInTheDocument()
    expect(screen.queryByText(/you said/i)).toBeNull()
  })

  describe('a shared groove (F12 E1)', () => {
    const renderShared = () =>
      renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)

    it('plays like the daily puzzle in every other respect (R22)', async () => {
      const user = userEvent.setup()
      await renderShared()
      const wrong = wrongFlavour()

      expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
        ROOTS,
      )
      expect(
        within(flavourGroup())
          .getAllByRole('button')
          .map(chipLabel),
      ).toEqual(flavours())

      expect(control()).toHaveAccessibleName('Pick a root and a mode')
      expect(control()).toBeDisabled()
      await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
      await user.click(
        within(flavourGroup()).getByRole('button', { name: wrong }),
      )
      expect(control()).toHaveAccessibleName(`Check C ${wrong}`)
      expect(control()).toBeEnabled()

      expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
      await user.click(control())
      expect(dotStates()).toEqual(['spent', 'unspent', 'unspent'])
      expect(screen.getByText(/right home note/i)).toBeInTheDocument()

      expect(nudge()).not.toBeInTheDocument()
      await guess(user, 'G', wrong)
      expect((nudge() as HTMLElement).textContent).toMatch(/root is C\./)

      expect(giveUp()).toBeNull()
      await guess(user, 'G', otherWrongFlavour())
      expect(giveUp()).toHaveAccessibleName('Give up and show the answer')

      await user.click(screen.getByRole('switch', { name: /simple mode/i }))
      expect(
        within(rootGroup()).getAllByRole('button').map(chipLabel),
      ).toEqual(simpleRootOptions(new Date(), answerOf(GROOVE)))
      expect(
        within(flavourGroup())
          .getAllByRole('button')
          .map(chipLabel),
      ).toEqual(['Major', 'Minor'])
    })
  })

  describe('the framing on a shared groove (F12 E3)', () => {
    const renderShared = (groove: Groove = GROOVE) =>
      renderPuzzle(<GroovePuzzle groove={groove} mode="shared" />)

    const notice = () => screen.queryByText(/this is a shared groove/i)

    const wayBack = () => screen.getByRole('link', { name: /back to today/i })

    const cardMeta = () =>
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          /^\d+ bpm/.test(element.textContent ?? ''),
      )

    const solvedDaysAgo = (daysAgo: number): DailyResult => ({
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
      grooveId: 'groove-02',
    })

    const streakLine = () =>
      screen.getByLabelText(/current streak/i).textContent

    it('says this is a shared groove rather than today’s puzzle, before any press (R1, R3, AC1)', async () => {
      await renderShared()

      const framing = notice() as HTMLElement
      expect(framing).toBeInTheDocument()
      expect(framing.textContent ?? '').toMatch(
        /not today's puzzle|not today’s puzzle/i,
      )
      expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
      expect(control()).toHaveAccessibleName('Pick a root and a mode')
    })

    it('says playing it leaves the streak and the day alone (R2, AC2)', async () => {
      const user = userEvent.setup()
      mockStore.getAll.mockResolvedValue([solvedDaysAgo(1), solvedDaysAgo(2)])
      await renderShared()

      expect((notice() as HTMLElement).textContent ?? '').toMatch(/streak/i)
      expect((notice() as HTMLElement).textContent ?? '').toMatch(/day/i)

      const before = streakLine()
      await guess(user, 'G', wrongFlavour())
      expect(streakLine()).toBe(before)
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    it('frames today’s own groove as shared, and still records nothing (R13, R14)', async () => {
      const todays = selectGrooveForDate(new Date(), GROOVES)
      const answer = answerOf(todays)
      const user = userEvent.setup()

      await renderPuzzle(<GroovePuzzle groove={todays} mode="shared" />)

      await user.click(
        within(rootGroup()).getByRole('button', { name: answer.root }),
      )
      await user.click(
        within(flavourGroup()).getByRole('button', { name: answer.flavour }),
      )
      await user.click(control())

      expect(
        screen.getByRole('heading', {
          name: `${answer.root} ${answer.flavour}`,
        }),
      ).toBeInTheDocument()
      expect(notice()).toBeInTheDocument()
      expect(cardMeta().textContent).toBe(
        `${todays.bpm} bpm · ${answer.root} ${answer.flavour} · shared groove`,
      )
      expect(wayBack()).toHaveAttribute('href', '/')
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    const inAppLinks = () =>
      screen.queryAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/'))

    const offSiteLinks = () =>
      screen.queryAllByRole('link').filter((link) => !link.getAttribute('href')?.startsWith('/'))

    const everyOffSiteLinkReallyLeaves = () => {
      for (const link of offSiteLinks()) {
        expect(link.getAttribute('href')).toMatch(/^https:\/\//)
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
      }
    }

    const invitation = () =>
      screen.queryByRole('link', { name: /play today/i })
    const invitationLine = () => invitation()?.closest('p')?.textContent ?? null

    it('shows no invitation while the shared groove is still in play (R5a, AC15)', async () => {
      const user = userEvent.setup()
      await renderShared()

      expect(invitation()).toBeNull()
      await play(user)
      await guess(user, 'G', wrongFlavour())
      await guess(user, 'D', wrongFlavour())

      expect(invitation()).toBeNull()
      expect(inAppLinks()).toHaveLength(1)
      expect(wayBack()).toHaveAttribute('href', '/')
    })

    it('invites the player to today once the shared groove is solved (R5a, AC5, AC14)', async () => {
      const user = userEvent.setup()
      await renderShared()

      await guess(user, 'C', 'Aeolian')

      const invite = invitation() as HTMLElement
      expect(invite).toBeInTheDocument()
      expect(invite).toHaveAttribute('href', '/')

      const panel = solutionPanel()
      expect(
        panel.compareDocumentPosition(invite) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(panel).not.toContainElement(invite)

      const onward = inAppLinks()
      expect(onward).toHaveLength(2)
      for (const link of onward) expect(link).toHaveAttribute('href', '/')
      everyOffSiteLinkReallyLeaves()
    })

    it('shows the same invitation, worded the same way, when it is given up on (R5b, AC14)', async () => {
      const user = userEvent.setup()
      const wrong = wrongFlavour()

      const solvedRun = await renderShared()
      await guess(user, 'C', 'Aeolian')
      const whenSolved = invitationLine()
      expect(whenSolved).not.toBeNull()
      solvedRun.unmount()

      await renderShared()
      await guess(user, 'C', wrong)
      await guess(user, 'G', wrong)
      await guess(user, 'G', otherWrongFlavour())
      await user.click(giveUp() as HTMLElement)
      await user.click(giveUp() as HTMLElement)

      expect(solutionPanel()).toBeInTheDocument()
      expect(invitation()).toHaveAttribute('href', '/')
      expect(invitationLine()).toBe(whenSolved)
    })

    it('keeps the invitation for the rest of the session (R5b)', async () => {
      const user = userEvent.setup()
      await renderShared()

      await guess(user, 'C', 'Aeolian')
      expect(invitation()).toBeInTheDocument()

      await play(user)
      await user.click(screen.getByRole('switch', { name: /simple mode/i }))
      expect(invitation()).toBeInTheDocument()
    })

    it('never appears on the daily page, in either ending (R5c, AC16)', async () => {
      const user = userEvent.setup()
      const wrong = wrongFlavour()

      const solvedRun = await renderPuzzle()
      await guess(user, 'C', 'Aeolian')
      expect(solutionPanel()).toBeInTheDocument()
      expect(invitation()).toBeNull()
      expect(inAppLinks()).toEqual([])
      solvedRun.unmount()

      mockStore.get.mockResolvedValue(null)

      await renderPuzzle()
      await guess(user, 'C', wrong)
      await guess(user, 'G', wrong)
      await guess(user, 'G', otherWrongFlavour())
      await user.click(giveUp() as HTMLElement)
      await user.click(giveUp() as HTMLElement)

      expect(solutionPanel()).toBeInTheDocument()
      expect(invitation()).toBeNull()
      expect(inAppLinks()).toEqual([])
    })
  })
  it('spends nothing when the sounds are switched (F16 E2 E7, R5, AC5)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))

    const soundSwitch = () => screen.getByRole('switch', { name: /tap sounds/i })
    const feedbackReads = () =>
      document.querySelector('[data-tone]')?.textContent ?? null
    const pressed = (group: HTMLElement) =>
      within(group)
        .getAllByRole('button')
        .filter((chip) => chip.getAttribute('aria-pressed') === 'true')
        .map(chipLabel)

    const dotsWere = dotStates()
    const feedbackWas = feedbackReads()
    const labelWas = control().textContent
    const rootsWere = pressed(rootGroup())
    const flavoursWere = pressed(flavourGroup())

    expect(dotsWere.filter((state) => state === 'spent')).toHaveLength(1)
    expect(feedbackWas).not.toBe('')

    await user.click(soundSwitch())
    await user.click(soundSwitch())

    expect(dotStates()).toEqual(dotsWere)
    expect(feedbackReads()).toBe(feedbackWas)
    expect(control().textContent).toBe(labelWas)
    expect(pressed(rootGroup())).toEqual(rootsWere)
    expect(pressed(flavourGroup())).toEqual(flavoursWere)

    await user.click(control())

    expect(dotStates().filter((state) => state === 'spent')).toHaveLength(2)
  })
})
