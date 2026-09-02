import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Groove, Root } from '../types'
import {
  CHANGES_READ,
  chipAdornment,
  chipLabel,
  coachingLine,
  control,
  dotStates,
  flavourGroup,
  flavours,
  GROOVE,
  guess,
  hintRegion,
  installPuzzleAudio,
  miss,
  move,
  NOTE_GLYPH,
  nudge,
  nudgeLine,
  otherWrongFlavour,
  play,
  renderPuzzle,
  resetMockStore,
  rootGroup,
  SOLVING,
  teardownPuzzleAudio,
  thirdWrongFlavour,
  TODAY,
  verdictLine,
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
import { LADDER } from '../lib/presentation/moves'
import {
  COLOUR_MOVES,
  SIMPLE_COLOUR_MOVES,
  TONIC_MOVES,
} from '../lib/presentation/coachingMoves'
import { FAMILIES } from '../lib/theory/families'
import { createLocalPreferenceStore } from '../lib/persistence/preferences'
import { isoDate, selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { GROOVES } from '../data/grooves.generated'

const NOTE_CHARS = 'A-Za-z♭♯'

function rootPattern(root: string) {
  const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![${NOTE_CHARS}])${escaped}(?![${NOTE_CHARS}])`)
}

describe('GroovePuzzle', () => {
  beforeEach(() => {
    resetMockStore(mockStore)
    installPuzzleAudio()
  })

  afterEach(() => {
    teardownPuzzleAudio()
  })

  const liveIn = (group: HTMLElement) =>
    within(group)
      .getAllByRole('button')
      .filter((chip) => chip.getAttribute('aria-disabled') !== 'true')
      .map(chipLabel)

  const dimmedIn = (group: HTMLElement) =>
    within(group)
      .getAllByRole('button')
      .filter((chip) => chip.getAttribute('aria-disabled') === 'true')
      .map(chipLabel)

  const liveRoots = () => liveIn(rootGroup())
  const liveRoot = () => liveRoots().find((root) => root !== 'C') as string
  const liveWrongFlavour = () =>
    liveIn(flavourGroup()).find((flavour) => flavour !== 'Aeolian') as string
  const standalone = (token: string) =>
    new RegExp(`(^|[\\s(])${token}($|[\\s.,)])`)

  it('renders a play control and the guessing card (R1, R2, AC1)', async () => {
    await renderPuzzle()

    expect(screen.getByRole('button', { name: /^play the loop$/i })).toBeInTheDocument()
    expect(within(rootGroup()).getAllByRole('button')).toHaveLength(12)
    expect(within(flavourGroup()).getAllByRole('button')).toHaveLength(4)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
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
    expect(control()).toHaveAccessibleName('Pick a mode')
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
      within(flavourGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    expect(
      within(flavourGroup()).getByRole('button', { name: wrong }),
    ).toHaveAttribute('aria-disabled', 'true')
    expect(control()).toBeDisabled()

    await user.click(within(flavourGroup()).getByRole('button', { name: 'Aeolian' }))
    expect(control()).toHaveAccessibleName('Check C Aeolian')
    expect(control()).toBeEnabled()

    await user.click(control())
    expect(
      screen.getByRole('heading', { name: 'C Aeolian' }),
    ).toBeInTheDocument()
    expect(nudge()).not.toBeInTheDocument()
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
    expect(nudge()).toContainElement(screen.getByText(/feels like rest/i))
    expect(nudgeLine()).not.toBeInTheDocument()
  })

  it('spends a dot and names the half that matched on each wrong guess (E3 R1, R3, AC2, AC5, AC7)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'G', wrong)
    expect(dotStates()).toEqual(['spent', 'unspent', 'unspent'])
    expect(screen.getByText(/not it\. keep playing/i)).toBeInTheDocument()
    expect(nudgeLine()).not.toBeInTheDocument()

    await guess(user, 'C', otherWrongFlavour())
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
    expect(screen.getByText(/right home note/i)).toBeInTheDocument()
  })

  it('narrows the row instead of naming the root, from the second miss (R1, R11, R17, R18, AC1, AC6, AC12, AC17)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'G', wrongFlavour())
    expect(nudgeLine()).not.toBeInTheDocument()

    await guess(user, 'D', otherWrongFlavour())

    const box = nudge() as HTMLElement
    expect(box).toBeInTheDocument()
    expect(box).toHaveTextContent(/2 roots ruled out/)
    expect(box.textContent).toMatch(/narrowing as you go/i)
    expect(box).toContainElement(coachingLine() as HTMLElement)

    const line = box.textContent ?? ''
    for (const root of ROOTS) expect(line).not.toMatch(standalone(root))

    expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
      ROOTS,
    )

    const dimmed = dimmedIn(rootGroup())
    expect(dimmed).toHaveLength(4)
    expect(dimmed).toContain('G')
    expect(dimmed).toContain('D')
    expect(dimmed).not.toContain('C')

    expect(
      within(rootGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
  })

  it('dims only the root the player checked after one miss (R6, R10, AC7, AC11)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'G', wrongFlavour())

    expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
      ROOTS,
    )
    expect(dimmedIn(rootGroup())).toEqual(['G'])
    expect(nudgeLine()).not.toBeInTheDocument()
  })

  it('stops narrowing at four live roots, and lets the player go past it (R12, R13, AC13)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    for (let played = 0; played < 4; played += 1) {
      const root = liveRoot()
      const flavour = liveWrongFlavour() ?? 'Aeolian'
      await guess(user, root, flavour)
      expect(liveRoots()).toContain('C')
    }
    expect(liveRoots()).toHaveLength(4)

    await guess(user, liveRoot(), 'Aeolian')
    expect(liveRoots()).toHaveLength(3)
    expect(liveRoots()).toContain('C')
  })

  it('derives the dims from the attempts, so a reload shows the same row (R8, R9, AC9, AC10)', async () => {
    const user = userEvent.setup()
    const wrong = wrongFlavour()
    const other = otherWrongFlavour()
    const third = thirdWrongFlavour()

    const played = await renderPuzzle()
    await guess(user, 'G', wrong)
    await guess(user, 'D', other)
    const thirdRoot = liveRoot()
    await guess(user, thirdRoot, third)
    const dimmedLive = dimmedIn(rootGroup())
    expect(dimmedLive).toHaveLength(7)
    played.unmount()

    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [
        miss('G', wrong, false),
        miss('D', other, false),
        miss(thirdRoot as Root, third, false),
      ],
      solved: false,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    await renderPuzzle()
    expect(dimmedIn(rootGroup())).toEqual(dimmedLive)

    await guess(user, liveRoot(), 'Aeolian')
    for (const root of dimmedLive) {
      expect(dimmedIn(rootGroup())).toContain(root)
    }
  })

  it('keeps the half that survived a check and asks for the other (R19a, R19b, R19c, AC19a, AC19b)', async () => {
    const user = userEvent.setup()

    const kept = await renderPuzzle()
    await guess(user, 'C', wrongFlavour())
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(flavourGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    expect(control()).toHaveAccessibleName('Pick a mode')
    kept.unmount()

    await renderPuzzle()
    await guess(user, 'G', otherWrongFlavour())
    expect(
      within(rootGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    expect(
      within(flavourGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    expect(control()).toHaveAccessibleName('Pick a root and a mode')
  })

  it('still diagnoses a mode-right, root-wrong check (R3, AC3)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'G', 'Aeolian')

    expect(
      screen.getByText(/the mode is right\. but the tonic is somewhere else/i),
    ).toBeInTheDocument()
    expect(
      within(flavourGroup()).getByRole('button', { name: 'Aeolian' }),
    ).not.toHaveAttribute('aria-disabled')
  })

  it('hands no root over, and locks nothing, when the row narrows (R1, R4b, AC1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'G', wrongFlavour())
    await guess(user, 'D', otherWrongFlavour())
    expect(nudgeLine()).toBeInTheDocument()

    const chips = within(rootGroup()).getAllByRole('button')
    expect(chips).toHaveLength(12)
    for (const chip of chips) expect(chip).toBeEnabled()
    expect(
      chips.filter((b) => b.getAttribute('aria-pressed') === 'true'),
    ).toEqual([])
    expect(dimmedIn(rootGroup())).toHaveLength(4)
    expect(dimmedIn(rootGroup())).not.toContain('C')
  })

  it('lets the player pick a fresh pair after a miss, and keeps their choice until they check it (R19a, R19b)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'G', wrongFlavour())
    await guess(user, 'D', otherWrongFlavour())
    expect(
      within(rootGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()

    const fresh = liveRoot()
    const third = liveWrongFlavour()
    await user.click(within(rootGroup()).getByRole('button', { name: fresh }))
    expect(
      within(rootGroup()).getByRole('button', { name: fresh }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(control()).toHaveAccessibleName('Pick a mode')

    await user.click(within(flavourGroup()).getByRole('button', { name: third }))
    expect(control()).toHaveAccessibleName(`Check ${fresh} ${third}`)

    await user.click(control())
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(dimmedIn(rootGroup())).toContain(fresh)
    expect(
      within(rootGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
  })

  it('never locks the player out, however many guesses miss (E3 R8, AC3, AC12)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()
    const other = otherWrongFlavour()

    await guess(user, 'G', wrong)
    await guess(user, 'D', other)
    await guess(user, liveRoot(), thirdWrongFlavour())

    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(control()).toBeDisabled()
    await user.click(
      within(rootGroup()).getByRole('button', { name: liveRoot() }),
    )
    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Aeolian' }),
    )
    expect(control()).toBeEnabled()

    await user.click(control())
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(nudgeLine()).toBeInTheDocument()
  })

  it('drops the narrowing count once the root is confirmed, and never brings it back (F18 E3 R1, R2, AC1, AC2)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'G', wrongFlavour())
    await guess(user, 'D', otherWrongFlavour())
    expect(nudgeLine()).toBeInTheDocument()

    await guess(user, 'C', thirdWrongFlavour())
    expect(nudge()).toBeInTheDocument()
    expect(coachingLine()).toBeInTheDocument()
    expect(nudgeLine()).not.toBeInTheDocument()

    await guess(user, 'C', wrongFlavour())
    expect(nudgeLine()).not.toBeInTheDocument()
  })

  it('never shows the narrowing count when the root lands first (F18 E3 R1, AC3)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    await guess(user, 'C', otherWrongFlavour())
    expect(nudge()).toBeInTheDocument()
    expect(nudgeLine()).not.toBeInTheDocument()
  })

  it('withdraws the whole hint box and turns the dots on the solve (E3 R9, AC13)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'G', wrong)
    await guess(user, 'D', otherWrongFlavour())
    expect(nudge()).toBeInTheDocument()
    expect(nudgeLine()).toBeInTheDocument()

    await guess(user, 'C', 'Aeolian')

    expect(nudge()).not.toBeInTheDocument()
    expect(nudgeLine()).not.toBeInTheDocument()
    expect(screen.queryByText(/the groove is yours now/i)).toBeNull()
    expect(dotStates()).toEqual(['solved', 'solved', 'solved'])
    expect(
      screen.getByRole('heading', { name: 'C Aeolian' }),
    ).toBeInTheDocument()
  })

  it('takes the hint box away when the player gives up instead (F7 E3 R8, AC8a)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'G', wrongFlavour())
    await guess(user, 'D', otherWrongFlavour())
    await guess(user, liveRoot(), thirdWrongFlavour())
    expect(nudge()).toBeInTheDocument()

    await user.click(giveUp() as HTMLElement)
    await user.click(giveUp() as HTMLElement)

    expect(nudge()).not.toBeInTheDocument()
    expect(nudgeLine()).not.toBeInTheDocument()
    expect(screen.queryByText('Hint')).toBeNull()
    expect(solutionPanel()).toBeInTheDocument()
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

    await guess(user, 'G', wrong)
    expect(giveUp()).toBeNull()
    await guess(user, 'D', otherWrongFlavour())
    expect(giveUp()).toBeNull()

    const third = thirdWrongFlavour()
    await guess(user, liveRoot(), third)
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

  it('opens the solved panel with the answer, its lesson and the changes, and no near miss (E4 R1-R5, AC1, AC3, AC4, F15 E1 R5, F17 E3)', async () => {
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
      within(panel).queryByText(new RegExp(`^You said ${wrong} — `)),
    ).toBeNull()
    expect(within(panel).queryByText(/^You said /)).toBeNull()
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

  it('keeps the hint box in simple mode, carrying the feedback and no sentence (R18a, R19, AC18)', async () => {
    const user = userEvent.setup()
    await enableSimpleMode()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    await guess(user, simpleRoots()[1], 'Major')
    await guess(user, simpleRoots()[2], 'Major')

    const box = nudge() as HTMLElement
    expect(box).toBeInTheDocument()
    expect(within(box).getByRole('status')).toBeInTheDocument()
    expect(nudgeLine()).not.toBeInTheDocument()
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

    expect(nudge()).not.toBeInTheDocument()
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
    expect(control()).toHaveAccessibleName('Solved')
    expect(
      screen.getByRole('heading', { name: 'C Mixolydian' }),
    ).toBeInTheDocument()
  })

  it('keeps the day when the toggle is flipped mid-play, and withdraws the app\u2019s eliminations when the row narrows to six (E5 R8, R8a, AC8, AC8a, R8, R14, R16)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()
    const inSix = simpleRoots().find((root) => root !== 'C') as string
    const outsideSix = ROOTS.find((root) => !simpleRoots().includes(root)) as Root

    await guess(user, outsideSix, wrong)
    await guess(user, inSix, otherWrongFlavour())
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
    expect(nudgeLine()).toBeInTheDocument()
    const dimmedInTwelve = dimmedIn(rootGroup())
    expect(dimmedInTwelve).toHaveLength(4)
    expect(dimmedInTwelve).toContain(inSix)
    expect(dimmedInTwelve).toContain(outsideSix)
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
    expect(nudgeLine()).not.toBeInTheDocument()
    expect(dimmedIn(rootGroup())).toEqual([inSix])

    expect(chipTexts(rootGroup())).toHaveLength(6)
    expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])

    await user.click(modeSwitch())
    expect(nudgeLine()).toBeInTheDocument()
    expect(dimmedIn(rootGroup())).toEqual(dimmedInTwelve)
    await user.click(modeSwitch())

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Minor' }))
    await user.click(control())
    expect(dotStates()).toEqual(['solved', 'solved', 'solved'])
    expect(
      screen.getByRole('heading', { name: 'C Aeolian' }),
    ).toBeInTheDocument()
    expect(nudge()).not.toBeInTheDocument()
    expect(mockStore.save.mock.calls.at(-1)?.[0].attempts).toHaveLength(3)

    expect(modeSwitch()).toBeDisabled()
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
    await user.click(modeSwitch())
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
  })

  it('never narrows simple mode\u2019s six, and claims nothing (E5 R10, AC10, R16, R19, AC16, AC18)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle()
    const [wrongRoot, otherWrongRoot, thirdWrongRoot] = simpleRoots().filter(
      (r) => r !== 'C',
    )

    await guess(user, wrongRoot, 'Major')
    expect(nudgeLine()).not.toBeInTheDocument()
    expect(giveUp()).toBeNull()

    await guess(user, otherWrongRoot, 'Minor')
    expect(nudgeLine()).not.toBeInTheDocument()
    expect(dimmedIn(rootGroup())).toEqual(
      simpleRoots().filter((r) => r === wrongRoot || r === otherWrongRoot),
    )
    expect(
      within(rootGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    expect(giveUp()).toBeNull()

    await guess(user, thirdWrongRoot, 'Minor')
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(giveUp()).toHaveAccessibleName('Give up and show the answer')
    expect(nudgeLine()).not.toBeInTheDocument()
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
    const [wrongRoot, otherWrongRoot, thirdWrongRoot] = simpleRoots().filter(
      (r) => r !== 'C',
    )

    await guess(user, wrongRoot, 'Major')
    await guess(user, otherWrongRoot, 'Minor')
    await guess(user, thirdWrongRoot, 'Minor')
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

      expect(nudgeLine()).not.toBeInTheDocument()
      await guess(user, 'C', otherWrongFlavour())
      expect(nudge()).toBeInTheDocument()
      expect(nudgeLine()).not.toBeInTheDocument()

      expect(giveUp()).toBeNull()
      await guess(user, 'C', thirdWrongFlavour())
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
      await guess(user, 'C', otherWrongFlavour())
      await guess(user, 'C', thirdWrongFlavour())
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
      await guess(user, 'C', otherWrongFlavour())
      await guess(user, 'C', thirdWrongFlavour())
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
    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    await user.click(
      within(flavourGroup()).getByRole('button', { name: otherWrongFlavour() }),
    )

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

  describe('the row locks once a check confirms a half (F17 E2)', () => {
    const glyphsIn = (group: HTMLElement) =>
      within(group)
        .getAllByRole('button')
        .map((chip) => chipAdornment(chip))

    const extrasIn = (group: HTMLElement) =>
      within(group)
        .getAllByRole('button')
        .map((chip) => chip.children.length)

    it('locks the root row to the root a check got right (R1, R1a, R4, AC1, AC3, AC6, AC10b)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'C', wrongFlavour())

      const c = within(rootGroup()).getByRole('button', { name: 'C' })
      expect(liveRoots()).toEqual(['C'])
      expect(dimmedIn(rootGroup())).toEqual(ROOTS.filter((r) => r !== 'C'))
      expect(c).toHaveAttribute('aria-pressed', 'true')
      expect(c).not.toHaveAttribute('aria-disabled')

      expect(c.textContent).toBe(`${NOTE_GLYPH}C`)
      expect(extrasIn(rootGroup()).every((count) => count === 1)).toBe(true)
      expect(glyphsIn(rootGroup()).every((glyph) => glyph === NOTE_GLYPH)).toBe(
        true,
      )
      expect(c).toHaveAccessibleName('C')
      expect(dimmedIn(flavourGroup())).toEqual([wrongFlavour()])
    })

    it('keeps both family chips live when the switch is flipped after a confirmed mode (R6, AC8)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, liveRoot(), 'Aeolian')
      expect(liveIn(flavourGroup())).toEqual(['Aeolian'])

      await user.click(screen.getByRole('switch', { name: /simple mode/i }))

      expect(liveIn(flavourGroup())).toEqual(['Major', 'Minor'])
      expect(dimmedIn(flavourGroup())).toEqual([])
    })

    it('keeps every mode live when the switch is flipped after a confirmed family (R6, AC8)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await user.click(screen.getByRole('switch', { name: /simple mode/i }))
      await guess(user, liveRoot(), 'Minor')
      expect(liveIn(flavourGroup())).toEqual(['Minor'])

      await user.click(screen.getByRole('switch', { name: /simple mode/i }))

      expect(dimmedIn(flavourGroup())).toEqual([])
      expect(liveIn(flavourGroup())).toHaveLength(4)
    })

    it('locks the mode row to the mode a check got right (R1, R1a, AC2, AC3)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'G', 'Aeolian')

      const aeolian = within(flavourGroup()).getByRole('button', {
        name: 'Aeolian',
      })
      expect(liveIn(flavourGroup())).toEqual(['Aeolian'])
      expect(aeolian).toHaveAttribute('aria-pressed', 'true')
      expect(aeolian).toHaveAccessibleName('Aeolian')
      expect(aeolian.textContent).toBe(`${NOTE_GLYPH}Aeolian`)
      expect(extrasIn(flavourGroup()).every((count) => count === 1)).toBe(true)
      expect(dimmedIn(rootGroup())).toEqual(['G'])
    })

    it('locks nothing for a selection, or for a tap (R2, AC4)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
      await user.click(
        within(flavourGroup()).getByRole('button', { name: 'Aeolian' }),
      )
      expect(dimmedIn(rootGroup())).toEqual([])
      expect(dimmedIn(flavourGroup())).toEqual([])

      await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
      expect(dimmedIn(rootGroup())).toEqual([])
      expect(dimmedIn(flavourGroup())).toEqual([])
      expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
    })

    it('keeps the lock when the confirming check is not the last one, from a stored day alone (R3, R5, AC5, AC7)', async () => {
      const wrong = wrongFlavour()
      const stored: DailyResult = {
        date: TODAY(),
        answer: { root: 'C', flavour: 'Aeolian' },
        attempts: [
          miss('C', wrong, true),
          miss('G', otherWrongFlavour(), false),
          miss('A', thirdWrongFlavour(), false),
        ],
        solved: false,
        grooveId: GROOVE.id,
      }
      mockStore.get.mockResolvedValue(stored)
      mockStore.getAll.mockResolvedValue([stored])

      await renderPuzzle()

      expect(liveRoots()).toEqual(['C'])
      expect(dimmedIn(rootGroup())).not.toContain('C')
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    it('lets the confirmed chip be picked and checked again, which a locked-out one cannot (R4, R7, AC6, AC9)', async () => {
      const wrong = wrongFlavour()
      const stored: DailyResult = {
        date: TODAY(),
        answer: { root: 'C', flavour: 'Aeolian' },
        attempts: [miss('C', wrong, true), miss('C', otherWrongFlavour(), true)],
        solved: false,
        grooveId: GROOVE.id,
      }
      mockStore.get.mockResolvedValue(stored)
      mockStore.getAll.mockResolvedValue([stored])

      const user = userEvent.setup()
      await renderPuzzle()

      expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
      expect(liveRoots()).toEqual(['C'])

      const g = () => within(rootGroup()).getByRole('button', { name: 'G' })
      await user.click(g())
      expect(g()).toHaveAttribute('aria-pressed', 'false')

      const c = () => within(rootGroup()).getByRole('button', { name: 'C' })
      await user.click(c())
      expect(c()).toHaveAttribute('aria-pressed', 'true')
      expect(c()).not.toHaveAttribute('aria-disabled')

      await user.click(
        within(flavourGroup()).getByRole('button', { name: liveWrongFlavour() }),
      )
      await user.click(control())

      expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
      expect(liveRoots()).toEqual(['C'])
    })

    it('locks the family row in simple mode (R6, AC8)', async () => {
      await enableSimpleMode()
      const user = userEvent.setup()
      await renderPuzzle()

      const wrongRoot = simpleRoots().find((root) => root !== 'C') as string
      await guess(user, wrongRoot, 'Minor')

      expect(liveIn(flavourGroup())).toEqual(['Minor'])
      expect(dimmedIn(flavourGroup())).toEqual(['Major'])
      expect(
        within(flavourGroup()).getByRole('button', { name: 'Minor' }),
      ).toHaveAccessibleName('Minor')
      expect(dimmedIn(rootGroup())).toEqual([wrongRoot])
    })

    it.each([
      ['revealed', { solved: false, revealed: true }],
      ['solved', { solved: true }],
    ])('keeps a %s day’s lock under the card’s own lock (R8, AC10)', async (
      _name,
      ending,
    ) => {
      const attempts = [miss('C', wrongFlavour(), true)]
      const stored: DailyResult = {
        date: TODAY(),
        answer: { root: 'C', flavour: 'Aeolian' },
        attempts: 'revealed' in ending ? attempts : [...attempts, SOLVING],
        grooveId: GROOVE.id,
        ...ending,
      }
      mockStore.get.mockResolvedValue(stored)
      mockStore.getAll.mockResolvedValue([stored])

      await renderPuzzle()

      const c = within(rootGroup()).getByRole('button', { name: 'C' })
      expect(dimmedIn(rootGroup())).toEqual(ROOTS.filter((r) => r !== 'C'))
      expect(c).not.toHaveAttribute('aria-disabled')
      expect(c).toBeDisabled()
      expect(c).toHaveAccessibleName('C')
    })

    it('diagnoses the guess and leaves the instruction to the row (R13, AC13)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'C', wrongFlavour())

      expect(screen.getByText(/right home note/i)).toBeInTheDocument()
      expect(screen.queryByText(/keep the root/i)).toBeNull()
      expect(screen.queryByText(/another flavour/i)).toBeNull()
      expect(liveRoots()).toEqual(['C'])
    })
  })

  describe('the listening move (F18 E1)', () => {
    const soundsOffRung = LADDER.findIndex((rung) => rung.soundsOff !== undefined)

    const tapSwitch = () => screen.getByRole('switch', { name: /tap sounds/i })

    const missOnce = async (user: ReturnType<typeof userEvent.setup>) => {
      await guess(user, liveRoot(), liveWrongFlavour() ?? 'Aeolian')
    }

    it('shows the opening move before anything is pressed (R1, R2, R7, AC1, AC3)', async () => {
      await renderPuzzle()

      expect(nudge()).toContainElement(coachingLine() as HTMLElement)
      expect(hintRegion()).toContainElement(coachingLine() as HTMLElement)
      expect(move()).toBe(LADDER[0].message)
      expect(nudge()).toHaveTextContent(/feels like rest/i)
      expect(verdictLine()).toBeNull()
      expect(nudgeLine()).not.toBeInTheDocument()
    })

    it('answers the first miss with a verdict and a different move (R3, R12a, AC2, AC15)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      const before = move()
      await guess(user, 'G', wrongFlavour())

      expect(screen.getByText(/not it\. keep playing/i)).toBeInTheDocument()
      expect(verdictLine()).not.toBeNull()
      expect(move()).not.toBe(before)
      expect(move()).toBe(LADDER[1].message)
    })

    it('advances the ladder again on the second miss (R3, AC4)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'G', wrongFlavour())
      const afterOne = move()
      await guess(user, liveRoot(), otherWrongFlavour())

      expect(move()).toBe(LADDER[2].message)
      expect(move()).not.toBe(afterOne)
    })

    it('walks the general ladder to its last move (R4, AC5)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      for (let played = 0; played < 3; played += 1) await missOnce(user)

      expect(move()).toBe(LADDER[3].message)
      expect(giveUp()).toHaveAccessibleName(/give up/i)
    })

    it('holds the last move once the misses outrun the ladder (R4, AC5)', async () => {
      const stored: DailyResult = {
        date: TODAY(),
        answer: { root: 'C', flavour: 'Aeolian' },
        attempts: [
          miss('D', wrongFlavour(), false),
          miss('E', otherWrongFlavour(), false),
          miss('F', thirdWrongFlavour(), false),
          miss('G', wrongFlavour(), false),
          miss('A', otherWrongFlavour(), false),
        ],
        solved: false,
        grooveId: GROOVE.id,
      }
      mockStore.get.mockResolvedValue(stored)
      mockStore.getAll.mockResolvedValue([stored])

      await renderPuzzle()

      expect(move()).toBe(LADDER[3].message)
    })

    it('keeps the verdict for the first miss and for the first confirmation alone (R12a, R12b, AC16, AC17, AC18)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, liveRoot(), liveWrongFlavour())
      expect(verdictLine()).not.toBeNull()

      await guess(user, liveRoot(), liveWrongFlavour())
      expect(verdictLine()).toBeNull()
      expect(screen.queryByText(/not it\. keep playing/i)).toBeNull()
      expect(nudge()).toHaveTextContent(move() as string)

      await guess(user, liveRoot(), 'Aeolian')
      expect(
        screen.getByText(/the mode is right\. but the tonic is somewhere else/i),
      ).toBeInTheDocument()
      expect(verdictLine()).not.toBeNull()

      await guess(user, liveRoot(), 'Aeolian')
      expect(verdictLine()).toBeNull()
      expect(coachingLine()).not.toBeNull()
      expect(nudge()).toHaveTextContent(move() as string)
    })

    it('does not advance the ladder when a ruled-out chip is tapped to hear it (R6, R11, AC7)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'G', wrongFlavour())

      const before = move()
      const dotsBefore = dotStates()
      const verdictBefore = verdictLine()?.textContent ?? null
      expect(before).toBe(LADDER[1].message)
      expect(verdictBefore).not.toBeNull()

      await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))
      await user.click(
        within(flavourGroup()).getByRole('button', { name: 'Aeolian' }),
      )

      expect(move()).toBe(before)
      expect(dotStates()).toEqual(dotsBefore)
      expect(verdictLine()?.textContent ?? null).toBe(verdictBefore)
    })

    it('comes back on the same rung after a reload (R7, AC8)', async () => {
      const stored: DailyResult = {
        date: TODAY(),
        answer: { root: 'C', flavour: 'Aeolian' },
        attempts: [
          miss('D', wrongFlavour(), false),
          miss('E', otherWrongFlavour(), false),
        ],
        solved: false,
        grooveId: GROOVE.id,
      }
      mockStore.get.mockResolvedValue(stored)
      mockStore.getAll.mockResolvedValue([stored])

      await renderPuzzle()

      expect(move()).toBe(LADDER[2].message)
    })

    it('keeps the rung when simple mode is switched on and off (R8, AC9)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'G', wrongFlavour())
      await guess(user, liveRoot(), otherWrongFlavour())

      const before = move()
      expect(before).toBe(LADDER[2].message)

      await user.click(modeSwitch())
      expect(move()).toBe(before)

      await user.click(modeSwitch())
      expect(move()).toBe(before)
    })

    it('rewords the move when the tap sounds go off, with no reload (R9, R10, AC10)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      expect(soundsOffRung).toBeGreaterThanOrEqual(0)
      for (let played = 0; played < soundsOffRung; played += 1) {
        await missOnce(user)
      }

      expect(move()).toBe(LADDER[soundsOffRung].message)

      await user.click(tapSwitch())
      expect(move()).toBe(LADDER[soundsOffRung].soundsOff)

      await user.click(tapSwitch())
      expect(move()).toBe(LADDER[soundsOffRung].message)
    })

    it('leaves the move alone while the loop plays and stops (R16, AC19)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'G', wrongFlavour())
      const before = move()
      expect(before).toBe(LADDER[1].message)

      await play(user)
      expect(move()).toBe(before)

      await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
      expect(move()).toBe(before)
    })

    it('takes the move away with the box when the day is solved (R14, AC12)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'G', wrongFlavour())
      await guess(user, liveRoot(), otherWrongFlavour())
      const carried = move() as string
      expect(carried).not.toBe('')

      await guess(user, 'C', 'Aeolian')

      expect(nudge()).not.toBeInTheDocument()
      expect(screen.queryByText(carried)).toBeNull()
    })

    it('takes the move away with the box when the day is given up on (R14, AC13)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'G', wrongFlavour())
      await guess(user, liveRoot(), otherWrongFlavour())
      await guess(user, liveRoot(), thirdWrongFlavour())
      const carried = move() as string

      await user.click(giveUp() as HTMLElement)
      await user.click(giveUp() as HTMLElement)

      expect(nudge()).not.toBeInTheDocument()
      expect(screen.queryByText(carried)).toBeNull()
    })

    it('never shows a verdict or a second rung on a day solved first time (R15, AC14)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      expect(move()).toBe(LADDER[0].message)

      await guess(user, 'C', 'Aeolian')

      expect(nudge()).not.toBeInTheDocument()
      expect(screen.queryByText(LADDER[1].message)).toBeNull()
      expect(screen.queryByText(/not it\. keep playing/i)).toBeNull()
    })

    it('reads verdict, then coaching, then count (R12, R13, AC11)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, liveRoot(), liveWrongFlavour())
      await guess(user, liveRoot(), liveWrongFlavour())
      await guess(user, liveRoot(), 'Aeolian')

      const verdict = verdictLine() as HTMLElement
      const coaching = coachingLine() as HTMLElement
      const count = nudgeLine() as HTMLElement

      expect(verdict.dataset.tone).toBe('warm')
      expect(coaching.dataset.tone).toBe('neutral')
      expect(verdict.className).not.toBe(coaching.className)
      expect(
        verdict.compareDocumentPosition(coaching) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(
        coaching.compareDocumentPosition(count) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })

    it('announces the box once, not line by line (R17, AC20)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, liveRoot(), liveWrongFlavour())
      await guess(user, liveRoot(), liveWrongFlavour())
      await guess(user, liveRoot(), 'Aeolian')

      const box = nudge() as HTMLElement
      expect(within(box).getAllByRole('status')).toHaveLength(1)
      expect(box.querySelectorAll('[aria-live]')).toHaveLength(1)

      const region = within(box).getByRole('status')
      expect(region).toHaveTextContent(/the mode is right/i)
      expect(region).toHaveTextContent(move() as string)
      expect(region).toHaveTextContent(/roots ruled out/i)
      expect(box.querySelectorAll('[data-tone][role="status"]')).toHaveLength(0)
    })
  })

  describe('the move matches the miss (F18 E2)', () => {
    const generalMiss = async (
      user: ReturnType<typeof userEvent.setup>,
      step: number,
    ) => {
      const wrong = [wrongFlavour(), otherWrongFlavour(), thirdWrongFlavour()]
      await guess(user, liveRoot(), wrong[step])
    }

    it('swaps the colour move the moment simple mode is switched (R9a, AC9a)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'C', wrongFlavour())
      expect(move()).toBe(COLOUR_MOVES[0].message)

      await user.click(modeSwitch())
      expect(move()).toBe(SIMPLE_COLOUR_MOVES[0].message)
      expect(move()).not.toBe(COLOUR_MOVES[0].message)

      await user.click(modeSwitch())
      expect(move()).toBe(COLOUR_MOVES[0].message)
    })

    it('coaches the tonic when a check got the mode right (R2, R4, AC1)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, liveRoot(), 'Aeolian')

      expect(liveIn(flavourGroup())).toEqual(['Aeolian'])
      expect(move()).toBe(TONIC_MOVES[0].message)
    })

    it('coaches the colour when a check got the root right (R2, R3, AC2)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'C', wrongFlavour())

      expect(liveIn(rootGroup())).toEqual(['C'])
      expect(move()).toBe(COLOUR_MOVES[0].message)
    })

    it('keeps Epic 1’s ladder when a miss confirms neither half (R5, AC3)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      expect(move()).toBe(LADDER[0].message)

      await generalMiss(user, 0)

      expect(move()).toBe(LADDER[1].message)
      expect(move()).not.toBe(COLOUR_MOVES[0].message)
      expect(move()).not.toBe(TONIC_MOVES[0].message)
    })

    it('enters the tonic family at its first move after two general misses (R7a, AC12)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await generalMiss(user, 0)
      await generalMiss(user, 1)
      expect(move()).toBe(LADDER[2].message)

      await guess(user, liveRoot(), 'Aeolian')

      expect(move()).toBe(TONIC_MOVES[0].message)
    })

    it('advances to the family’s second move on the next miss, then holds (R7b, R7c, R7d, AC13, AC14)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await generalMiss(user, 0)
      await generalMiss(user, 1)
      await guess(user, liveRoot(), 'Aeolian')

      await guess(user, liveRoot(), 'Aeolian')
      expect(move()).toBe(TONIC_MOVES[1].message)

      for (let more = 0; more < 2; more += 1) {
        await guess(user, liveRoot(), 'Aeolian')
        expect(move()).toBe(TONIC_MOVES[1].message)
      }
    })

    it('stays in the tonic family two misses after confirming the mode (R7, AC7)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, liveRoot(), 'Aeolian')
      await guess(user, liveRoot(), 'Aeolian')
      await guess(user, liveRoot(), 'Aeolian')

      const shown = move() as string
      expect(TONIC_MOVES.map((m) => m.message)).toContain(shown)
      for (const rung of LADDER) expect(shown).not.toBe(rung.message)
    })

    it('gives simple mode the shared tonic wording when the family is confirmed (R9, AC8)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await user.click(modeSwitch())
      expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])

      await guess(user, liveRoot(), 'Minor')

      expect(move()).toBe(TONIC_MOVES[0].message)
    })

    it('gives simple mode its own colour wording when the root is confirmed (R8, AC9)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await user.click(modeSwitch())
      await guess(user, 'C', 'Major')

      expect(liveIn(rootGroup())).toEqual(['C'])
      expect(move()).toBe(SIMPLE_COLOUR_MOVES[0].message)
      expect(move()).not.toBe(COLOUR_MOVES[0].message)
    })

    it('never names a root or a mode in the Hint box, in any family (R10, AC10)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      const read = () => nudge()?.textContent ?? ''
      const seen: string[] = [read()]

      await guess(user, 'C', wrongFlavour())
      seen.push(read())

      await user.click(modeSwitch())
      seen.push(read())

      for (const text of seen) {
        expect(text).not.toBe('')
        for (const root of ROOTS) expect(text).not.toMatch(rootPattern(root))
        for (const mode of [...flavours(), ...FAMILIES]) {
          expect(text).not.toMatch(new RegExp(`\\b${mode}\\b`, 'i'))
        }
      }
    })
  })
})
