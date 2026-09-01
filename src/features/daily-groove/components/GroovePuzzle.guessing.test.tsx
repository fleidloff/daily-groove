/**
 * One of five files holding the composed puzzle's tests. **The grouping rule,
 * and where a new case goes, is documented at the top of
 * `GroovePuzzle.page.test.tsx`** — read it before adding one here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Groove, Root } from '../types'
// The shared setup — fixtures, the fake audio context, the render and the
// accessible-name queries — has one home (F14 E2 R5). Everything below the
// `vi.mock` block is imported from it rather than restated here.
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

// The audio module is NOT mocked, and neither is scoring: the flows below run
// through the real Web Audio player, the real store and the real
// `scoreAttempt`. Playback is driven by stubbing the browser instead — see
// `installPuzzleAudio` in the harness.

// Mock the persistence seam so useProgress reads/writes a controllable store —
// no real localStorage. useProgress defaults to this module-singleton store.
// `vi.hoisted` and `vi.mock` are lifted to the top of the file that calls them,
// so neither survives being wrapped in a helper: only the store factory is
// shared, and this block stays here.
const { mockStore } = await vi.hoisted(async () => {
  const { createMockStore } = await import('../testing/puzzleHarness')
  return { mockStore: createMockStore() }
})
// Only the module singleton is stood in for: `createReadOnlyStore` stays the
// real decorator, because the shared session below is the real one.
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
    // The retired subset-guessing model is gone.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('leaves the nudge’s revealed root on the serif (E4 R2, AC2)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)

    // A hand-lettered E♭ at 15px is the one place legibility outweighs
    // character, so the revealed root keeps `--font-display`.
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
        .map((b) => b.textContent)

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

    // 1 — nothing chosen: the control prompts and is disabled (AC6).
    expect(control()).toHaveAccessibleName('Pick a root and a mode')
    expect(control()).toBeDisabled()

    // 2 — a root alone is not enough (R7).
    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    expect(control()).toHaveAccessibleName('Pick a root and a mode')
    expect(control()).toBeDisabled()

    // 3 — both chosen: the control names the pair and goes live (R8, AC6).
    await user.click(within(flavourGroup()).getByRole('button', { name: wrong }))
    expect(control()).toHaveAccessibleName(`Check C ${wrong}`)
    expect(control()).toBeEnabled()

    // 4 — a wrong pair is reported, the chips stay, the control locks (AC7, AC9).
    await user.click(control())
    expect(screen.getByText(/right home note/i)).toBeInTheDocument()
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(flavourGroup()).getByRole('button', { name: wrong }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(control()).toBeDisabled()

    // 5 — changing the flavour unblocks it again (AC9).
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Aeolian' }))
    expect(control()).toHaveAccessibleName('Check C Aeolian')
    expect(control()).toBeEnabled()

    // 6 — the right pair solves the day (AC8).
    await user.click(control())
    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
    expect(control()).toHaveAccessibleName('Solved')
    expect(control()).toBeDisabled()

    // 7 — a solved day stops accepting input (R12, AC10).
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

    // Right root, wrong flavour.
    await guess(user, 'C', wrong)
    expect(dotStates()).toEqual(['spent', 'unspent', 'unspent'])
    expect(screen.getByText(/right home note/i)).toBeInTheDocument()
    // One miss is not yet a nudge (AC8).
    expect(nudge()).not.toBeInTheDocument()

    // Neither half right.
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

  // Feature-7 Epic 3 R4: the nudge names the day's root in prose, and from this
  // epic on it also *presses the chip*. Before, this test asserted the opposite
  // — that the revealed root was left for the player to go and find — which was
  // the busywork on already-surrendered information the epic set out to remove.
  // Everything else the test guarded is unchanged: no chip is filtered away,
  // locked, or marked as already tried (F7 E3 R5, AC5).
  it('hands the day\u2019s root over as a selection when the nudge arrives (F7 E3 R4, R5, AC3, AC5)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    expect(nudge()).toBeInTheDocument()

    const chips = within(rootGroup()).getAllByRole('button')
    // All twelve are still on offer — none filtered away, none locked (AC5).
    expect(chips).toHaveLength(12)
    for (const chip of chips) expect(chip).toBeEnabled()
    // The second miss selects the answer's root, replacing the player's own
    // last choice rather than sitting beside it (AC3).
    expect(
      chips
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map(chipLabel),
    ).toEqual(['C'])
    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'false')
    // No chip is marked as already tried — 'C' and 'G' have both been guessed
    // and neither carries any state beyond aria-pressed.
    expect(chips.filter((b) => b.getAttribute('aria-disabled') === 'true')).toEqual(
      [],
    )
  })

  // Step D2's second half — R5, AC4. The selection is a gift, not a lock: the
  // rule fires once, and what the player does with the chip afterwards is
  // theirs, including through a further miss.
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

    // The player disagrees, and the chips let them.
    await user.click(within(rootGroup()).getByRole('button', { name: 'D' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'D' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'false')
    // The control follows the selection, so the pair it names is the new one.
    expect(control()).toHaveAccessibleName(`Check D ${wrong}`)

    // ...and a third miss does not hand the root back: the rule fired once.
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

    // Three misses: the row is full and stays three wide (AC3).
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    // The control is disabled only because the pair has not changed...
    expect(control()).toBeDisabled()
    // ...changing a half hands it straight back (AC12).
    await user.click(within(rootGroup()).getByRole('button', { name: 'D' }))
    expect(control()).toBeEnabled()

    // A fourth guess is spent and counted like any other; the row stays full.
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

  /**
   * The way out, in whichever state it is currently in. Queried by role and
   * name like every other control on the page, so a test never has to know
   * which of the two labels is showing.
   */
  const giveUp = () =>
    screen.queryByRole('button', {
      name: /give up and show the answer|end the day and show the answer/i,
    })

  /**
   * The answer panel, found through the heading it leads with. The page carries
   * more than one live region — the transport announces itself too — so the
   * panel is located by its own content rather than by role alone.
   */
  const solutionPanel = () =>
    screen
      .getByRole('heading', { name: 'C Aeolian' })
      .closest('[role="status"]') as HTMLElement

  it('offers the way out only from the third miss, and ends the day on the second press (F7 E3 R6, R7, R8, AC6, AC8a)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    // One miss, then two: still no way out on offer (AC6).
    await guess(user, 'C', wrong)
    expect(giveUp()).toBeNull()
    await guess(user, 'G', wrong)
    expect(giveUp()).toBeNull()

    // The third miss puts it on the card (AC6).
    await guess(user, 'G', otherWrongFlavour())
    expect(giveUp()).toHaveAccessibleName('Give up and show the answer')

    // One press only arms it: the answer is still withheld and the day is
    // still in progress (AC8).
    await user.click(giveUp() as HTMLElement)
    expect(giveUp()).toHaveAccessibleName(
      'Yes \u2014 end the day and show the answer',
    )
    expect(
      screen.queryByRole('heading', { name: 'C Aeolian' }),
    ).not.toBeInTheDocument()

    // The second press ends it: the whole solution is on screen, without the
    // claim of a win (AC8a, AC10, AC10a).
    await user.click(giveUp() as HTMLElement)
    const panel = solutionPanel()
    expect(panel).toBeInTheDocument()
    expect(within(panel).getByText(/given up/i)).toBeInTheDocument()
    expect(screen.queryByText(/solved in/i)).toBeNull()
    expect(screen.queryByText(/streak now/i)).toBeNull()
    expect(
      within(panel).getByRole('img', { name: CHANGES_READ }),
    ).toBeInTheDocument()

    // ...the offer itself is gone, and so is the way back in (AC8a).
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

    // The three misses are all it cost: giving up is not a fourth attempt, and
    // the day was written down as given up (R8, R9).
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

    // The answer is on screen from the first painted frame, with no win claimed.
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

    // The puzzle is not playable: nothing to give up on, nothing to check, and
    // the chips do not move.
    expect(giveUp()).toBeNull()
    expect(control()).toBeDisabled()
    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'A' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    // Reading the day back writes nothing.
    expect(mockStore.save).not.toHaveBeenCalled()
  })

  it('never reveals the chord or the progression while unsolved (E4 R6, AC7)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    expect(container.textContent).not.toContain(GROOVE.chord)
    expect(container.textContent).not.toContain(GROOVE.progression)

    // Still hidden after guessing wrong — only a solve opens the panel.
    await guess(user, 'G', wrongFlavour())
    expect(container.textContent).not.toContain(GROOVE.chord)
    expect(container.textContent).not.toContain(GROOVE.progression)
    expect(
      screen.queryByRole('heading', { name: 'C Aeolian' }),
    ).not.toBeInTheDocument()
  })

  it('opens the solved panel with the answer, the tries and the changes (E4 R1-R5, AC1, AC3, AC4)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    await guess(user, 'C', 'Aeolian')

    expect(
      screen.getByRole('heading', { name: 'C Aeolian' }),
    ).toBeInTheDocument()
    // Two attempts were spent, and today's solve is the streak's first day.
    expect(screen.getByText(/solved in 2 tries/i)).toBeInTheDocument()
    expect(screen.getByText(/streak now 1/i)).toBeInTheDocument()
    expect(
      within(container).getByRole('img', { name: CHANGES_READ }),
    ).toBeInTheDocument()
    // The scale notes come with it.
    expect(
      screen.getByRole('group', { name: /notes to live in/i }),
    ).toBeInTheDocument()
  })

  /** A day whose mode is minor, and a day whose mode is major. */
  const DORIAN: Groove = { ...GROOVE, flavour: 'Dorian', scale: 'C Dorian' }

  const MIXOLYDIAN: Groove = {
    ...GROOVE,
    flavour: 'Mixolydian',
    scale: 'C Mixolydian',
  }

  /**
   * Turn the preference on before the page reads it, through the same
   * `PreferenceStore` the hook behind the toggle uses. No hook and no component
   * is mocked: the page loads the preference the way it will in a browser.
   */
  async function enableSimpleMode() {
    await createLocalPreferenceStore().set({ simpleMode: true })
  }

  const modeSwitch = () => screen.getByRole('switch', { name: /simple mode/i })

  /** The six roots the day offers in simple mode, resolved as the page does. */
  const simpleRoots = () => simpleRootOptions(new Date(), answerOf(DORIAN))

  const chipTexts = (group: HTMLElement) =>
    within(group).getAllByRole('button').map(chipLabel)

  const MODE_NAME = /ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian/i

  it('does not let a switch leave an unofferable pair checkable (E5 R4, R8)', async () => {
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    // Choose a full-puzzle pair whose mode simple mode does not offer, and
    // whose root the day's six need not contain.
    const staleRoot = ROOTS.find((r) => !simpleRoots().includes(r)) as Root
    await user.click(within(rootGroup()).getByRole('button', { name: staleRoot }))
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Dorian' }))
    expect(control()).toHaveAccessibleName(`Check ${staleRoot} Dorian`)
    expect(control()).toBeEnabled()

    await user.click(modeSwitch())

    // Neither half is on offer any more, so neither reads as chosen and the
    // control cannot spend an attempt on a pair that is not on screen.
    expect(chipTexts(rootGroup())).not.toContain(staleRoot)
    expect(
      within(rootGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    expect(
      within(flavourGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    expect(control()).toHaveAccessibleName('Pick a root and a mode')
    expect(control()).toBeDisabled()

    // The choice was hidden, not thrown away: toggling back restores it, so a
    // mid-day switch stays lossless (R8).
    await user.click(modeSwitch())
    expect(control()).toHaveAccessibleName(`Check ${staleRoot} Dorian`)
    expect(control()).toBeEnabled()
  })

  it('narrows both rows to six roots and two families in simple mode (E5 R2, R3, R4, AC2, AC3)', async () => {
    await enableSimpleMode()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    // Six, deterministic for the date, and the answer's root among them — the
    // same six `simpleRootOptions` resolves for today (AC2).
    expect(chipTexts(rootGroup())).toEqual(simpleRoots())
    expect(chipTexts(rootGroup())).toHaveLength(6)
    expect(chipTexts(rootGroup())).toContain('C')

    // Exactly two, reading `Major` and `Minor` (AC3).
    expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])

    // ...and no mode name is on screen in either row.
    expect(rootGroup().textContent).not.toMatch(MODE_NAME)
    expect(flavourGroup().textContent).not.toMatch(MODE_NAME)
  })

  it('offers all twelve roots and four modes with simple mode off (E5 R2, R4, AC2, AC3)', async () => {
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    expect(chipTexts(rootGroup())).toEqual(ROOTS)
    expect(chipTexts(flavourGroup())).toEqual(flavourOptions(new Date(), DORIAN))
    expect(chipTexts(flavourGroup())).toHaveLength(4)
    // The families are not on offer in the full puzzle.
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
    // The panel names the day's real mode: simple mode narrowed the question,
    // not the answer.
    expect(screen.getByRole('heading', { name: 'C Dorian' })).toBeInTheDocument()
  })

  it('misses a Mixolydian day guessed minor (E5 R5, AC5)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={MIXOLYDIAN} />)

    await guess(user, 'C', 'Minor')

    expect(screen.queryByText(/the groove is yours now/i)).toBeNull()
    expect(dotStates()).toEqual(['spent', 'unspent', 'unspent'])
    // The root half is still reported as the half that matched.
    expect(screen.getByText(/right home note/i)).toBeInTheDocument()

    // ...and the major option solves the same day.
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

    // The switch is still operable on a day two attempts in (AC8a).
    expect(modeSwitch()).toBeEnabled()
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'false')
    await user.click(modeSwitch())
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')

    // The day survived the switch: the same two dots, the same groove, and no
    // attempt invented or lost (AC8).
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
    expect(mockStore.save.mock.calls).toHaveLength(writes)
    expect(mockStore.save.mock.calls.at(-1)?.[0].attempts).toHaveLength(2)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Test Groove' }),
    ).toBeInTheDocument()
    // The nudge those two misses earned is still there.
    expect(nudge()).toBeInTheDocument()

    // Only the question narrowed.
    expect(chipTexts(rootGroup())).toHaveLength(6)
    expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])

    // The third guess is the third attempt, and it is graded the new way.
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Minor' }))
    await user.click(control())
    expect(dotStates()).toEqual(['solved', 'solved', 'solved'])
    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
    expect(mockStore.save.mock.calls.at(-1)?.[0].attempts).toHaveLength(3)

    // ...and the switch settles once the day is over: it keeps the position the
    // day was played in and stops responding (F11 E4 R1, R4, AC1). Feature-7's
    // R8a covered the whole day; feature-11 narrows it to the playable one, and
    // the live half is asserted above, two attempts in.
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

    // Two misses: the nudge names the day's root, in prose and as a selection.
    await guess(user, otherWrongRoot, 'Major')
    const box = nudge() as HTMLElement
    expect(box).toBeInTheDocument()
    expect(box.textContent).toMatch(/root is C\./)
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(giveUp()).toBeNull()

    // Three: the way out is offered, at exactly the same point as ever.
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
    // A solve is a solve: the day counts toward the streak like any other.
    expect(screen.getByText(/streak now 1/i)).toBeInTheDocument()
  })

  it('carries the preference into the page it opens with (E5 R7, AC7)', async () => {
    await enableSimpleMode()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    // No press needed: the stored preference is what the first painted card
    // shows, so a reload the next day opens in simple mode.
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
    expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])
  })

  /**
   * A shared groove is practice. It plays the whole puzzle and writes nothing —
   * the page hands the session a `ResultStore` whose write path is gone, so
   * there is no save site left to reach (F12 E1 R18, R20, R21, R22).
   *
   * Nothing about how the page *reads* changes, and nothing about how it *looks*
   * changes here: the shared framing, the way back to today and the date line
   * are all Epic 3's. This block is the persistence switch and only that.
   */

  describe('a shared groove (F12 E1)', () => {

    /** The shared page, rendered and settled exactly as the daily one is. */
    const renderShared = () =>
      renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)

    it('plays like the daily puzzle in every other respect (R22)', async () => {
      const user = userEvent.setup()
      await renderShared()
      const wrong = wrongFlavour()

      // The same two rows, the same twelve roots and four modes.
      expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
        ROOTS,
      )
      expect(
        within(flavourGroup())
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(flavours())

      // The same check control: prompting, then naming the pair, then locked.
      expect(control()).toHaveAccessibleName('Pick a root and a mode')
      expect(control()).toBeDisabled()
      await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
      await user.click(
        within(flavourGroup()).getByRole('button', { name: wrong }),
      )
      expect(control()).toHaveAccessibleName(`Check C ${wrong}`)
      expect(control()).toBeEnabled()

      // The same dots and the same feedback.
      expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
      await user.click(control())
      expect(dotStates()).toEqual(['spent', 'unspent', 'unspent'])
      expect(screen.getByText(/right home note/i)).toBeInTheDocument()

      // The same nudge on the second miss, at the same threshold.
      expect(nudge()).not.toBeInTheDocument()
      await guess(user, 'G', wrong)
      expect((nudge() as HTMLElement).textContent).toMatch(/root is C\./)

      // The same way out, offered from the third miss.
      expect(giveUp()).toBeNull()
      await guess(user, 'G', otherWrongFlavour())
      expect(giveUp()).toHaveAccessibleName('Give up and show the answer')

      // The same simple-mode toggle, narrowing both rows.
      await user.click(screen.getByRole('switch', { name: /simple mode/i }))
      expect(
        within(rootGroup()).getAllByRole('button').map(chipLabel),
      ).toEqual(simpleRootOptions(new Date(), answerOf(GROOVE)))
      expect(
        within(flavourGroup())
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(['Major', 'Minor'])
    })
  })

  /**
   * Steps A4 and A5. Epic 1 made `/groove/<uuid>` play the same puzzle with
   * `mode="shared"`; this is what that mode is allowed to change about the
   * page. Exactly two things: a notice above the card, and the words "shared
   * groove" where the date stands. Everything else — the header, the streak
   * pill, the how-to-play box, both cards and every control on them — is the
   * daily page, unchanged, and most of the assertions below are about that.
   */

  describe('the framing on a shared groove (F12 E3)', () => {

    const renderShared = (groove: Groove = GROOVE) =>
      renderPuzzle(<GroovePuzzle groove={groove} mode="shared" />)

    /** The notice above the card, found by its own opening words. */
    const notice = () => screen.queryByText(/this is a shared groove/i)

    /** The way back, which is the notice's own link. */
    const wayBack = () => screen.getByRole('link', { name: /back to today/i })

    /**
     * The groove card's meta line: the one paragraph on the page that opens
     * with a tempo. Located by what it says rather than by a test id, because
     * what it says is the whole subject of R1a.
     */
    const cardMeta = () =>
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          /^\d+ bpm/.test(element.textContent ?? ''),
      )

    /** A solved day, N days back — the streak's raw material. */
    const solvedDaysAgo = (daysAgo: number): DailyResult => ({
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
      grooveId: 'groove-02',
    })

    /** The streak pill's whole line, as the header renders it. */
    const streakLine = () =>
      screen.getByLabelText(/current streak/i).textContent

    it('says this is a shared groove rather than today’s puzzle, before any press (R1, R3, AC1)', async () => {
      await renderShared()

      const framing = notice() as HTMLElement
      expect(framing).toBeInTheDocument()
      expect(framing.textContent ?? '').toMatch(
        /not today's puzzle|not today’s puzzle/i,
      )
      // Nothing has been played: the framing is on the first painted frame, not
      // a consolation shown after a solve.
      expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
      expect(control()).toHaveAccessibleName('Pick a root and a mode')
    })

    it('says playing it leaves the streak and the day alone (R2, AC2)', async () => {
      const user = userEvent.setup()
      mockStore.getAll.mockResolvedValue([solvedDaysAgo(1), solvedDaysAgo(2)])
      await renderShared()

      expect((notice() as HTMLElement).textContent ?? '').toMatch(/streak/i)
      expect((notice() as HTMLElement).textContent ?? '').toMatch(/day/i)

      // And the page keeps that promise: a miss moves neither the pill nor the
      // record behind it.
      const before = streakLine()
      await guess(user, 'G', wrongFlavour())
      expect(streakLine()).toBe(before)
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    /**
     * The feature has no special case for today's own groove, and this is what
     * proves its absence — still, after the addendum that redirects a shared
     * link to today's groove away to `/`.
     *
     * That redirect is the *route's*: `src/app/groove/[uuid]/SharedGroove.tsx`
     * decides where to send the player, because the daily pick is the viewer's
     * calendar day and only the browser knows it. Handed today's groove and told
     * it is shared, the puzzle still frames it as shared and still records
     * nothing — which is exactly the property that lets the decision live in one
     * place instead of two. See that route's own test for the redirect.
     */
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

      // Played through to a solve...
      expect(
        screen.getByRole('heading', {
          name: `${answer.root} ${answer.flavour}`,
        }),
      ).toBeInTheDocument()
      // ...and still a shared groove in every visible respect.
      expect(notice()).toBeInTheDocument()
      expect(cardMeta().textContent).toBe(
        `${todays.bpm} bpm · ${answer.root} ${answer.flavour} · shared groove`,
      )
      expect(wayBack()).toHaveAttribute('href', '/')
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    /**
     * Feature-13 narrowed these two from "no anchors" to "no anchors that
     * navigate the app".
     *
     * The rule was always about navigation: the shared page offers exactly one
     * way onward and it is the way back to today, and the daily page offers
     * none — which is what makes that one identifiable. Counting every anchor
     * was a proxy for that, and it stopped being a safe one when the how-to-play
     * box gained the drum samples' licence credit, which points off-site.
     *
     * So the assertion now says the thing it means, and says it more strictly
     * than before: every in-app link is enumerated *and* every remaining anchor
     * must leave the site entirely. An internal link cannot hide behind the
     * carve-out, because there is no carve-out — there are two exhaustive sets.
     */
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

    /** The invitation, by the link that is its whole point. */
    const invitation = () =>
      screen.queryByRole('link', { name: /play today/i })
    /** The line it sits in, which is what "worded the same way" is about. */
    const invitationLine = () => invitation()?.closest('p')?.textContent ?? null

    it('shows no invitation while the shared groove is still in play (R5a, AC15)', async () => {
      const user = userEvent.setup()
      await renderShared()

      expect(invitation()).toBeNull()
      await play(user)
      await guess(user, 'G', wrongFlavour())
      await guess(user, 'D', wrongFlavour())

      // Two misses in: still only the way back that was always there. Counted
      // over in-app links, so the licence credit's off-site anchors do not read
      // as a second invitation.
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

      // Below the answer, not folded into it: the panel is the day's payoff and
      // knows nothing about shared grooves.
      const panel = solutionPanel()
      expect(
        panel.compareDocumentPosition(invite) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(panel).not.toContainElement(invite)

      // Two ways onward now, and both still point at `/` — there is no third
      // in-app destination anywhere on the page. Any other anchor has to leave
      // the site outright, which the credit's do.
      const onward = inAppLinks()
      expect(onward).toHaveLength(2)
      for (const link of onward) expect(link).toHaveAttribute('href', '/')
      everyOffSiteLinkReallyLeaves()
    })

    it('shows the same invitation, worded the same way, when it is given up on (R5b, AC14)', async () => {
      const user = userEvent.setup()
      const wrong = wrongFlavour()

      // Ending one: solved.
      const solvedRun = await renderShared()
      await guess(user, 'C', 'Aeolian')
      const whenSolved = invitationLine()
      expect(whenSolved).not.toBeNull()
      solvedRun.unmount()

      // Ending two: given up on.
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

      // Nothing a played-out page still offers takes it away again.
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
})
