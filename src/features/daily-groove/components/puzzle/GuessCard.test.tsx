import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Flavour, Root } from '../../types'
import { ROOTS, flavourOptions } from '../../lib/theory/music'
import { GROOVES } from '../../data/grooves.generated'
import { selectGrooveForDate } from '../../lib/puzzle/selectGroove'
import { renderFeature } from '../../testing/renderFeature'
import type { DotState, Feedback } from '../../lib/presentation/feedback'
import { PlayControl } from '@/components/controls/PlayControl'
import { GuessCard } from './GuessCard'

const FLAVOURS: Flavour[] = ['Dorian', 'Mixolydian', 'Lydian', 'Aeolian']

const OPENING: Feedback = {
  message: 'Sing the note that feels like rest.',
  tone: 'neutral',
}
const ROOT_MATCHED: Feedback = {
  message: 'Right home note, wrong colour.',
  tone: 'warm',
}
const SOLVED: Feedback = {
  message: 'That is it. The groove is yours now.',
  tone: 'solved',
}

const UNSPENT: DotState[] = ['unspent', 'unspent', 'unspent']

type Props = Parameters<typeof GuessCard>[0]

function props(overrides: Partial<Props> = {}): Props {
  return {
    roots: ROOTS,
    flavours: FLAVOURS,
    selectedRoot: null,
    selectedFlavour: null,
    onSelectRoot: vi.fn(),
    onSelectFlavour: vi.fn(),
    onHearRoot: vi.fn(),
    onHearMode: vi.fn(),
    canCheck: false,
    onCheck: vi.fn(),
    solved: false,
    feedback: OPENING,
    showNudge: false,
    dots: UNSPENT,
    answerRoot: 'G',
    revealed: false,
    showReveal: false,
    onReveal: vi.fn(),
    simple: false,
    onToggleSimple: vi.fn(),
    tapSounds: true,
    onToggleTapSounds: vi.fn(),
    ...overrides,
  }
}

const rootGroup = () => screen.getByRole('radiogroup', { name: 'Root' })
const flavourGroup = () => screen.getByRole('radiogroup', { name: 'Mode' })
/** The note glyph the root row wears (F10 E2 R1). */
const NOTE_GLYPH = '♪'
/**
 * A chip's label with its decorative adornment left out. The glyph is
 * `aria-hidden`, so this is the chip's accessible name — which is what every
 * assertion about *which* chips a row offers has always been about (F10 E2 R4).
 */
const chipLabel = (chip: Element) =>
  Array.from(chip.childNodes)
    .filter(
      (node) =>
        !(
          node instanceof Element &&
          node.getAttribute('aria-hidden') === 'true'
        ),
    )
    .map((node) => node.textContent ?? '')
    .join('')
/** The adornment a chip carries, or `null` when it carries none. */
const chipAdornment = (chip: Element) =>
  chip.querySelector('[aria-hidden="true"]')?.textContent ?? null
/** The element a chip group lays its chips out on. */
const chipList = (group: HTMLElement) =>
  group.querySelector('[data-testid="chip-list"]') as HTMLElement
const modeSwitch = () => screen.getByRole('switch', { name: /simple mode/i })
const soundSwitch = () => screen.getByRole('switch', { name: /tap sounds/i })
/** True when `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
/** The six modes Epic 4 leaves standing, plus the one it retired. */
const MODE_NAME = /ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian/i
const FAMILIES: Flavour[] = ['Major', 'Minor']
const dotStates = () =>
  Array.from(document.querySelectorAll('[data-dot-state]')).map((el) =>
    el.getAttribute('data-dot-state'),
  )

describe('GuessCard', () => {
  // --- C1: twelve roots, four flavours (R1, R2, R3, AC1) --------------------

  // Epic 4, Step D1 (R1, AC1): the row holds modes, so it says so. The
  // vocabulary on screen is one word, and "Flavour" is not it. `name="flavour"`
  // stays as it is — a DOM grouping key, never read by a player.
  it('labels the second chip row "Mode", not "Flavour" (R1, AC1)', () => {
    render(<GuessCard {...props()} />)

    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Flavour' })).toBeNull()
  })

  it('offers twelve root chips and exactly four flavour chips (AC1)', () => {
    render(<GuessCard {...props()} />)

    expect(within(rootGroup()).getAllByRole('button')).toHaveLength(12)
    expect(within(flavourGroup()).getAllByRole('button')).toHaveLength(4)
  })

  it('renders the roots and flavours it is given, in order (R1, R2, R3)', () => {
    render(<GuessCard {...props()} />)

    expect(
      within(rootGroup()).getAllByRole('button').map(chipLabel),
    ).toEqual(ROOTS)
    expect(
      within(flavourGroup()).getAllByRole('button').map(chipLabel),
    ).toEqual(FLAVOURS)
  })

  it('reports a chip choice to the matching handler (R5)', async () => {
    const user = userEvent.setup()
    const onSelectRoot = vi.fn()
    const onSelectFlavour = vi.fn()
    render(<GuessCard {...props({ onSelectRoot, onSelectFlavour })} />)

    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))
    expect(onSelectRoot).toHaveBeenCalledWith('G')

    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Dorian' }),
    )
    expect(onSelectFlavour).toHaveBeenCalledWith('Dorian')
  })

  it('marks only the current selection in each group (R5, AC5)', () => {
    render(
      <GuessCard
        {...props({ selectedRoot: 'G' as Root, selectedFlavour: 'Dorian' })}
      />,
    )

    const pressedRoots = within(rootGroup())
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressedRoots.map(chipLabel)).toEqual(['G'])

    const pressedFlavours = within(flavourGroup())
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressedFlavours.map(chipLabel)).toEqual(['Dorian'])
  })

  // --- C2: the control names the pair (R7, R8, AC6) -------------------------

  it('prompts and stays disabled until both halves are chosen (R7, AC6)', () => {
    render(<GuessCard {...props()} />)

    expect(
      screen.getByRole('button', { name: 'Pick a root and a mode' }),
    ).toBeDisabled()
  })

  it('names the chosen pair once both are selected (R8, AC6)', () => {
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          canCheck: true,
        })}
      />,
    )

    expect(screen.getByRole('button', { name: 'Check G Dorian' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Pick a root and a mode' }),
    ).not.toBeInTheDocument()
  })

  it('keeps prompting while only one half is chosen (R7)', () => {
    render(<GuessCard {...props({ selectedRoot: 'G' as Root })} />)
    expect(
      screen.getByRole('button', { name: 'Pick a root and a mode' }),
    ).toBeDisabled()
  })

  it('calls onCheck when the enabled control is pressed (R7)', async () => {
    const user = userEvent.setup()
    const onCheck = vi.fn()
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          canCheck: true,
          onCheck,
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Check G Dorian' }))
    expect(onCheck).toHaveBeenCalledTimes(1)
  })

  // --- Epic 3 C1: the card shows dots, feedback and the nudge ---------------

  it('renders the attempt dots it is given (R1, AC1)', () => {
    render(<GuessCard {...props()} />)

    expect(screen.getByRole('img')).toHaveAccessibleName(
      expect.stringContaining('0 of 3 attempts spent'),
    )
    expect(dotStates()).toEqual(UNSPENT)
  })

  it('renders exactly the dot states it is handed (R2, AC2, AC3)', () => {
    render(<GuessCard {...props({ dots: ['spent', 'spent', 'unspent'] })} />)
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
  })

  it('shows the feedback it is given in a live region (R3, R4, AC4, AC14)', () => {
    render(<GuessCard {...props()} />)

    const line = screen.getByRole('status')
    expect(line).toHaveTextContent(OPENING.message)
    expect(line).toHaveAttribute('aria-live', 'polite')
  })

  it('shows targeted feedback after a wrong guess instead of a bare verdict (R3, AC5)', () => {
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Mixolydian',
          dots: ['spent', 'unspent', 'unspent'],
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(ROOT_MATCHED.message)
    // Epic 2's throwaway verdict line is gone.
    expect(screen.queryByText(/^not quite\.$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^correct\.$/i)).not.toBeInTheDocument()
  })

  it('shows the solved wording once the day is solved (R9, AC13)', () => {
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          solved: true,
          dots: ['solved', 'solved', 'solved'],
          feedback: SOLVED,
          showNudge: false,
        })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(SOLVED.message)
    expect(dotStates()).toEqual(['solved', 'solved', 'solved'])
    expect(
      screen.queryByRole('complementary', { name: 'A nudge' }),
    ).not.toBeInTheDocument()
  })

  it('shows no nudge until it is asked for (R5, AC8)', () => {
    render(<GuessCard {...props({ dots: ['spent', 'unspent', 'unspent'] })} />)
    expect(
      screen.queryByRole('complementary', { name: 'A nudge' }),
    ).not.toBeInTheDocument()
  })

  it('names the day’s root in the nudge, alongside the feedback line (R5, R6, AC9)', () => {
    render(
      <GuessCard
        {...props({
          showNudge: true,
          answerRoot: 'G',
          dots: ['spent', 'spent', 'unspent'],
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    const nudge = screen.getByRole('complementary', { name: 'A nudge' })
    expect(nudge.textContent).toMatch(/root is G\./)
    // The nudge is additional context, not a replacement message.
    expect(screen.getByRole('status')).toHaveTextContent(ROOT_MATCHED.message)
  })

  // --- Epic 3 C2: the nudge does not touch the chips (R6, R7, AC10, AC11) ---

  it('leaves every root chip unpressed and enabled when the nudge appears (AC10, AC11)', () => {
    render(
      <GuessCard
        {...props({
          showNudge: true,
          answerRoot: 'G',
          dots: ['spent', 'spent', 'unspent'],
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    const chips = within(rootGroup()).getAllByRole('button')
    expect(chips).toHaveLength(12)
    // Nothing was auto-selected...
    expect(chips.filter((b) => b.getAttribute('aria-pressed') === 'true')).toEqual(
      [],
    )
    // ...nothing was filtered away or locked...
    for (const chip of chips) expect(chip).toBeEnabled()
    // ...and no chip is marked as already tried.
    expect(
      chips.filter((b) => b.getAttribute('aria-disabled') === 'true'),
    ).toEqual([])
  })

  it('offers the revealed root as an ordinary, clickable choice (R6, AC10)', async () => {
    const user = userEvent.setup()
    const onSelectRoot = vi.fn()
    render(
      <GuessCard
        {...props({
          showNudge: true,
          answerRoot: 'G',
          onSelectRoot,
          dots: ['spent', 'spent', 'unspent'],
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))
    expect(onSelectRoot).toHaveBeenCalledWith('G')
  })

  // --- C4: a wrong check keeps the chips and disables the control (R11, AC9)

  it('keeps both chips pressed and disables the control after a wrong check (AC9)', () => {
    const { rerender } = render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Mixolydian',
          canCheck: false,
          dots: ['spent', 'unspent', 'unspent'],
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(flavourGroup()).getByRole('button', { name: 'Mixolydian' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Check G Mixolydian' }),
    ).toBeDisabled()

    // Changing a half re-enables the control; the label follows the new pair.
    rerender(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          canCheck: true,
          dots: ['spent', 'unspent', 'unspent'],
          feedback: ROOT_MATCHED,
        })}
      />,
    )
    expect(screen.getByRole('button', { name: 'Check G Dorian' })).toBeEnabled()
  })

  // --- C5: solving locks the chips (R12, AC10) ------------------------------

  it('stops accepting chip input once the day is solved (AC10)', async () => {
    const user = userEvent.setup()
    const onSelectRoot = vi.fn()
    const onSelectFlavour = vi.fn()
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          solved: true,
          onSelectRoot,
          onSelectFlavour,
          dots: ['solved', 'solved', 'solved'],
          feedback: SOLVED,
        })}
      />,
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    expect(onSelectRoot).not.toHaveBeenCalled()

    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Lydian' }),
    )
    expect(onSelectFlavour).not.toHaveBeenCalled()

    // The selection that solved the day is still the one on screen.
    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('gives the control its solved treatment once the day is solved (R12)', () => {
    const { unmount } = render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          canCheck: true,
        })}
      />,
    )
    const readyClass = screen.getByRole('button', {
      name: 'Check G Dorian',
    }).className
    unmount()

    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          solved: true,
          dots: ['solved', 'solved', 'solved'],
          feedback: SOLVED,
        })}
      />,
    )

    const control = screen.getByRole('button', { name: 'Solved' })
    expect(control).toBeDisabled()
    // A distinct tone from the live "ready" control, not just a relabel.
    expect(control.className).not.toBe(readyClass)
  })

  // --- feature-16 Epic 2, Steps C1-C3: Check comes up to Play's size -------

  /**
   * The size-bearing classes of a button, and nothing else. Vertical padding
   * and type size are the two things `Button`'s `size` sets, so they are what
   * "the same size" means here — sorted, so the comparison is order-free.
   */
  const sizeOf = (el: HTMLElement) =>
    (el.className.match(/py-\[\d+px\]|text-\[\d+px\]/g) ?? []).sort()

  // Step C1 — R15, R18, AC13. This reverses feature-8 Epic 2's Step B3, which
  // pinned the check control at the default size while the play control grew.
  // F16 E2 R15 makes them equals: the button that ends the puzzle stops
  // looking like an afterthought beside the one that starts it. The literal
  // the two are compared against comes from *rendering* the play control
  // rather than from a copy of its classes, so R18 — the play control is
  // unchanged — is proven here rather than assumed.
  it('renders the check control at the play control\u2019s size (R15, R18, AC13)', () => {
    render(
      <>
        <GuessCard
          {...props({
            selectedRoot: 'G' as Root,
            selectedFlavour: 'Dorian',
            canCheck: true,
          })}
        />
        <PlayControl isPlaying={false} onToggle={vi.fn()} />
      </>,
    )

    const check = screen.getByRole('button', { name: 'Check G Dorian' })
    const play = screen.getByRole('button', { name: 'Play the loop' })

    expect(sizeOf(check)).toEqual(sizeOf(play))
    expect(sizeOf(check)).toEqual(['py-[22px]', 'text-[17px]'])
  })

  // Step C1's other half. Nothing came down to meet it: the give-up control is
  // not the call to action, so it keeps the default size (PRD *Out of scope*).
  it('leaves the give-up control at the default size (R18)', () => {
    render(<GuessCard {...props(REVEAL_READY)} />)

    expect(sizeOf(giveUp() as HTMLElement)).toEqual([
      'py-[15px]',
      'text-[15px]',
    ])
  })

  /**
   * Step C2 — R16, AC14. Every label the control could ever show, derived from
   * the data rather than written out: each distinct flavour the catalogue
   * holds, crossed with every root the row offers, keeping the ones that come
   * out longest. Five roots are two characters wide, so the longest is a set
   * rather than a single string.
   *
   * That makes this the *budget* assertion, and 26 characters is the budget
   * the tech spec's 360px sum was worked against. A future mode name longer
   * than `Phrygian dominant` trips this case rather than a phone, and whoever
   * adds it has to decide what the control says at the base breakpoint.
   */
  const LONGEST_CHECK_LABELS = (() => {
    const flavours = [...new Set(GROOVES.map((groove) => groove.flavour))]
    const labels = ROOTS.flatMap((root) =>
      flavours.map((flavour) => `Check ${root} ${flavour}`),
    )
    const longest = Math.max(...labels.map((label) => label.length))
    return labels.filter((label) => label.length === longest)
  })()

  /** The one of them the tech spec's 360px assumption is written against. */
  const LONGEST_CHECK_LABEL = 'Check E\u266D Phrygian dominant'

  it('has a longest possible label of 26 characters (R16, AC14)', () => {
    for (const label of LONGEST_CHECK_LABELS) {
      expect(label, label).toHaveLength(26)
    }
    // The string the spec measured is genuinely one of the longest, so the
    // budget below is measured against the real worst case.
    expect(LONGEST_CHECK_LABELS).toContain(LONGEST_CHECK_LABEL)
  })

  it('renders the longest label it can show in full, uncut (R16, AC14)', () => {
    const [, root, ...flavour] = LONGEST_CHECK_LABEL.split(' ')
    render(
      <GuessCard
        {...props({
          selectedRoot: root as Root,
          selectedFlavour: flavour.join(' ') as Flavour,
          flavours: [flavour.join(' ') as Flavour],
          canCheck: true,
        })}
      />,
    )

    const check = screen.getByRole('button', { name: LONGEST_CHECK_LABEL })

    // The whole label, in one text node: nothing is split off or replaced.
    expect(check.textContent).toBe(LONGEST_CHECK_LABEL)
    expect(check.childNodes).toHaveLength(1)

    // jsdom measures no text, so what is pinned here is that the control asks
    // for no clipping. Whether it wraps at a given width is the demo's job.
    for (const cut of [
      /\btruncate\b/,
      /\btext-ellipsis\b/,
      /\boverflow-hidden\b/,
      /\bwhitespace-nowrap\b/,
    ]) {
      expect(check.className).not.toMatch(cut)
    }
  })

  // Step C3 — R17, AC15. Bigger type must not flatten the three states into
  // one another: each keeps its own tone token, and all three keep the size.
  it('keeps the waiting, live and solved states apart at the larger size (R17, AC15)', () => {
    const states: { name: string; token: string; className: string }[] = []

    const capture = (name: string, token: string, override: Partial<Props>) => {
      const { unmount } = render(<GuessCard {...props(override)} />)
      states.push({
        name,
        token,
        className: screen.getByRole('button', { name }).className,
      })
      unmount()
    }

    capture('Pick a root and a mode', 'bg-surface-inset', { canCheck: false })
    capture('Check G Dorian', 'bg-accent', {
      selectedRoot: 'G' as Root,
      selectedFlavour: 'Dorian',
      canCheck: true,
    })
    capture('Solved', 'bg-accent-soft', {
      selectedRoot: 'G' as Root,
      selectedFlavour: 'Dorian',
      solved: true,
      dots: ['solved', 'solved', 'solved'],
      feedback: SOLVED,
    })

    // Three distinct treatments, not one relabelled three times...
    expect(new Set(states.map((state) => state.className)).size).toBe(3)
    for (const state of states) {
      // ...each carrying its own tone...
      expect(state.className, state.name).toContain(state.token)
      // ...and all three at the call-to-action size.
      expect(state.className, state.name).toContain('py-[22px]')
    }
  })

  // --- Epic 1 C1-C3: the dots sit above the check button, alone -------------

  it('puts the attempt dots directly above the check button, not beside the heading (R7, AC7)', () => {
    render(<GuessCard {...props()} />)

    const control = screen.getByRole('button', {
      name: 'Pick a root and a mode',
    })
    const dotsRow = control.previousElementSibling as HTMLElement

    // The row immediately above the control is the dot row itself.
    expect(dotsRow.querySelectorAll('[data-dot-state]')).toHaveLength(3)
    expect(within(dotsRow).getByRole('img')).toHaveAccessibleName(
      expect.stringContaining('0 of 3 attempts spent'),
    )

    // ...and it sits after the flavour chips, so it has left the heading row.
    expect(
      flavourGroup().compareDocumentPosition(dotsRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 3, name: 'What is it?' })
        .nextElementSibling,
    ).not.toBe(dotsRow)
  })

  it('REGRESSION GUARD: the dot row carries no counter text or label (R7a, AC7)', () => {
    render(<GuessCard {...props({ dots: ['spent', 'spent', 'unspent'] })} />)

    const dotsRow = screen.getByRole('button', {
      name: 'Pick a root and a mode',
    }).previousElementSibling as HTMLElement

    expect(dotsRow.textContent).toBe('')
  })

  it('REGRESSION GUARD: the moved dots keep their accessible name (R8, AC8)', () => {
    render(<GuessCard {...props({ dots: ['spent', 'spent', 'unspent'] })} />)

    expect(
      screen.getByRole('img', { name: /2 of 3 attempts spent/ }),
    ).toBeInTheDocument()
  })

  // --- Epic 3 C1/C2: the card supplies each row's column count -------------

  // Step C1 — R2a, R4, AC4. The counts live here because the caller is what
  // knows how many options it has; `ChipGroup` only knows numbers.
  it('lays the twelve roots out on 4 columns, rising to 6 (R2a, R4, AC4)', () => {
    render(<GuessCard {...props()} />)
    const list = chipList(rootGroup())

    expect(list.className).toMatch(/\bgrid\b/)
    expect(list.className).toContain('grid-cols-4')
    expect(list.className).toContain('md:grid-cols-6')
  })

  it('lays the four flavours out on 2 columns, rising to 4 (R2a, R4, AC4)', () => {
    render(<GuessCard {...props()} />)
    const list = chipList(flavourGroup())

    expect(list.className).toMatch(/\bgrid\b/)
    expect(list.className).toContain('grid-cols-2')
    expect(list.className).toContain('md:grid-cols-4')
  })

  it('asks for no chip width on either row (R6, AC7)', () => {
    render(<GuessCard {...props()} />)

    for (const chip of screen.getAllByRole('button')) {
      expect(chip.className).not.toMatch(/\bw-\[/)
    }
  })

  // Step C2 — R4, AC4. A guard: it passes once C1 has landed, and stands so
  // the two rows cannot drift into different layouts.
  it('lays both rows out through the same component (R4, AC4)', () => {
    render(<GuessCard {...props()} />)
    const root = chipList(rootGroup())
    const flavour = chipList(flavourGroup())

    for (const list of [root, flavour]) {
      expect(list.className).toMatch(/\bgrid\b/)
      expect(list.className).toMatch(/\bgrid-cols-\d+\b/)
      expect(list.className).toMatch(/\bmd:grid-cols-\d+\b/)
      expect(list.className).not.toContain('flex-wrap')
    }

    // Same layout shape, differing only in the counts the card supplies.
    const shape = (list: HTMLElement) =>
      list.className.replace(/grid-cols-\d+/g, 'grid-cols-N')
    expect(shape(root)).toBe(shape(flavour))
  })

  // --- feature-7 Epic 3, Steps C3-C6: the give-up control -------------------

  const GIVE_UP = 'Give up and show the answer'
  const CONFIRM = 'Yes — end the day and show the answer'

  const giveUp = () => screen.queryByRole('button', { name: GIVE_UP })
  const confirm = () => screen.queryByRole('button', { name: CONFIRM })

  const REVEAL_READY = {
    selectedRoot: 'G' as Root,
    selectedFlavour: 'Dorian' as Flavour,
    dots: ['spent', 'spent', 'spent'] as DotState[],
    feedback: ROOT_MATCHED,
    showNudge: true,
    showReveal: true,
  }

  // Step C3 — R6, R6a, AC6, AC8
  it('offers no way to give up until it is asked for (R6, AC6)', () => {
    render(<GuessCard {...props({ dots: ['spent', 'spent', 'unspent'] })} />)

    expect(giveUp()).not.toBeInTheDocument()
    expect(confirm()).not.toBeInTheDocument()
  })

  it('offers to give up once showReveal is set (R6, AC6)', () => {
    render(<GuessCard {...props(REVEAL_READY)} />)

    expect(giveUp()).toBeInTheDocument()
    expect(giveUp()).toBeEnabled()
  })

  it('asks for confirmation on the first press rather than ending the day (R6a, AC8)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<GuessCard {...props({ ...REVEAL_READY, onReveal })} />)

    await user.click(giveUp() as HTMLElement)

    expect(onReveal).not.toHaveBeenCalled()
    expect(giveUp()).not.toBeInTheDocument()
    // The armed label names the consequence rather than asking a bare "Sure?".
    expect(confirm()).toBeInTheDocument()

    // The day is still playable: the chips are live and the answer is not shown.
    for (const chip of within(rootGroup()).getAllByRole('button')) {
      expect(chip).toBeEnabled()
    }
  })

  // Step C4 — R7, AC8a
  it('ends the day on the second press, exactly once (R7, AC8a)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<GuessCard {...props({ ...REVEAL_READY, onReveal })} />)

    await user.click(giveUp() as HTMLElement)
    await user.click(confirm() as HTMLElement)

    expect(onReveal).toHaveBeenCalledTimes(1)
  })

  // Step C5 — R6b, AC8c
  it('disarms when a root chip is selected instead (R6b, AC8c)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    const onSelectRoot = vi.fn()
    render(
      <GuessCard {...props({ ...REVEAL_READY, onReveal, onSelectRoot })} />,
    )

    await user.click(giveUp() as HTMLElement)
    expect(confirm()).toBeInTheDocument()

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))

    expect(onSelectRoot).toHaveBeenCalledWith('C')
    expect(onReveal).not.toHaveBeenCalled()
    expect(confirm()).not.toBeInTheDocument()
    expect(giveUp()).toBeInTheDocument()
  })

  it('disarms when a flavour chip is selected instead (R6b, AC8c)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    const onSelectFlavour = vi.fn()
    render(
      <GuessCard {...props({ ...REVEAL_READY, onReveal, onSelectFlavour })} />,
    )

    await user.click(giveUp() as HTMLElement)
    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Lydian' }),
    )

    expect(onSelectFlavour).toHaveBeenCalledWith('Lydian')
    expect(onReveal).not.toHaveBeenCalled()
    expect(giveUp()).toBeInTheDocument()
  })

  // Step C5 — R6b, AC8b
  it('disarms when a guess is checked instead, and still scores it (R6b, AC8b)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    const onCheck = vi.fn()
    render(
      <GuessCard
        {...props({ ...REVEAL_READY, canCheck: true, onReveal, onCheck })}
      />,
    )

    await user.click(giveUp() as HTMLElement)
    expect(confirm()).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Check G Dorian' }))

    expect(onCheck).toHaveBeenCalledTimes(1)
    expect(onReveal).not.toHaveBeenCalled()
    expect(confirm()).not.toBeInTheDocument()
    expect(giveUp()).toBeInTheDocument()
  })

  // Step C6 — R7, AC8a
  it('goes inert once the day is revealed (R7, AC8a)', async () => {
    const user = userEvent.setup()
    const onSelectRoot = vi.fn()
    const onSelectFlavour = vi.fn()
    const onCheck = vi.fn()
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          dots: ['spent', 'spent', 'spent'],
          feedback: ROOT_MATCHED,
          revealed: true,
          showReveal: false,
          canCheck: false,
          onSelectRoot,
          onSelectFlavour,
          onCheck,
        })}
      />,
    )

    for (const chip of within(rootGroup()).getAllByRole('button')) {
      expect(chip).toBeDisabled()
    }
    for (const chip of within(flavourGroup()).getAllByRole('button')) {
      expect(chip).toBeDisabled()
    }

    const check = screen.getByRole('button', { name: 'Check G Dorian' })
    expect(check).toBeDisabled()

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Lydian' }),
    )
    await user.click(check)
    expect(onSelectRoot).not.toHaveBeenCalled()
    expect(onSelectFlavour).not.toHaveBeenCalled()
    expect(onCheck).not.toHaveBeenCalled()

    expect(giveUp()).not.toBeInTheDocument()
    expect(confirm()).not.toBeInTheDocument()
  })

  it('leaves the check control disabled on a revealed day even if a check would be legal (R7, AC8a)', () => {
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          canCheck: true,
          revealed: true,
        })}
      />,
    )

    expect(screen.getByRole('button', { name: 'Check G Dorian' })).toBeDisabled()
  })

  // --- feature-7 Epic 5, Steps C2/C3: the simple-mode switch ----------------

  it('carries a simple-mode switch, under the heading and above both rows (R1, AC1)', () => {
    render(<GuessCard {...props()} />)

    const toggle = modeSwitch()
    expect(precedes(screen.getByRole('heading'), toggle)).toBe(true)
    expect(precedes(toggle, rootGroup())).toBe(true)
    expect(precedes(toggle, flavourGroup())).toBe(true)
  })

  it('reports the mode the player asked for, not the one they left (R1, AC1)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(<GuessCard {...props({ simple: false, onToggleSimple })} />)

    await user.click(modeSwitch())

    expect(onToggleSimple).toHaveBeenCalledWith(true)
  })

  it('asks to leave simple mode when it is already on (R1, AC1)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(
      <GuessCard
        {...props({ simple: true, flavours: FAMILIES, onToggleSimple })}
      />,
    )

    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
    await user.click(modeSwitch())
    expect(onToggleSimple).toHaveBeenCalledWith(false)
  })

  // --- F11 E4: the switch settles once the day is over ----------------------

  // Step B1. The half of feature-7's R8a that survives the narrowing, and the
  // reason the rule was written: a player who finds the full row too hard may
  // narrow it mid-puzzle, however many attempts they have already spent.
  it('keeps the switch live on a playable day with attempts spent (F11 E4 R3, AC3)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(
      <GuessCard
        {...props({
          dots: ['spent', 'spent', 'unspent'],
          feedback: ROOT_MATCHED,
          onToggleSimple,
        })}
      />,
    )

    expect(modeSwitch()).toBeEnabled()
    await user.click(modeSwitch())

    expect(onToggleSimple).toHaveBeenCalledWith(true)
  })

  // Step B2. Feature-7's R8a said the switch is never locked by having
  // guessed, and that still holds — but the day ending is not "having
  // guessed". Once the answer is on screen the switch has nothing left to do,
  // so it settles with the chips it sits above (F11 E4 R8).
  it('settles the switch on a day that is already over (F11 E4 R1, AC1)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(
      <GuessCard
        {...props({
          solved: true,
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          feedback: SOLVED,
          onToggleSimple,
        })}
      />,
    )

    // The chips lock on a finished day, and now so does the switch above them.
    expect(within(rootGroup()).getAllByRole('button')[0]).toBeDisabled()
    expect(modeSwitch()).toBeDisabled()
    await user.click(modeSwitch())
    expect(onToggleSimple).not.toHaveBeenCalled()
  })

  // Step B3. One terminal state, both endings: the card computes
  // `over = solved || revealed` and the switch reads that, not `solved`.
  it('settles the switch on a revealed day too (F11 E4 R2, AC2)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(<GuessCard {...props({ revealed: true, onToggleSimple })} />)

    expect(modeSwitch()).toBeDisabled()
    await user.click(modeSwitch())
    expect(onToggleSimple).not.toHaveBeenCalled()
  })

  it('keeps a settled switch showing which mode the day was played in (F11 E4 R4, R5, AC4, AC5)', () => {
    render(
      <GuessCard
        {...props({
          simple: true,
          flavours: FAMILIES,
          roots: ['C', 'D', 'E', 'G', 'A', 'B'] as Root[],
          solved: true,
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Minor',
          feedback: SOLVED,
        })}
      />,
    )

    expect(modeSwitch()).toBeInTheDocument()
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
  })

  // Step B5. R1 makes this unreachable; the check exists so that it stays so.
  it('leaves the finished card untouched when its settled switch is clicked (F11 E4 R7, R7a)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(
      <GuessCard
        {...props({
          solved: true,
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          feedback: SOLVED,
          dots: ['spent', 'spent', 'unspent'],
          onToggleSimple,
        })}
      />,
    )

    const before = {
      roots: within(rootGroup()).getAllByRole('button').map(chipLabel),
      flavours: within(flavourGroup()).getAllByRole('button').map(chipLabel),
      dots: dotStates(),
    }

    await user.click(modeSwitch())

    expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
      before.roots,
    )
    expect(
      within(flavourGroup()).getAllByRole('button').map(chipLabel),
    ).toEqual(before.flavours)
    expect(dotStates()).toEqual(before.dots)
    expect(onToggleSimple).not.toHaveBeenCalled()
  })

  it('disarms an armed give-up when the mode is switched instead (R6b)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<GuessCard {...props({ showReveal: true, onReveal })} />)

    await user.click(
      screen.getByRole('button', { name: 'Give up and show the answer' }),
    )
    await user.click(modeSwitch())

    expect(
      screen.getByRole('button', { name: 'Give up and show the answer' }),
    ).toBeInTheDocument()
    expect(onReveal).not.toHaveBeenCalled()
  })

  for (const simple of [false, true]) {
    const flavours = simple ? FAMILIES : FLAVOURS
    const roots = (simple ? ['C', 'D', 'E', 'G', 'A', 'B'] : ROOTS) as Root[]

    it(`keeps both rows labelled and single-select with simple=${simple} (R11, AC11)`, () => {
      render(
        <GuessCard
          {...props({
            simple,
            roots,
            flavours,
            selectedRoot: 'G' as Root,
            selectedFlavour: flavours[1],
          })}
        />,
      )

      const pressed = (group: HTMLElement) =>
        within(group)
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map(chipLabel)

      // Both rows still answer to their labels, and each holds one selection.
      expect(pressed(rootGroup())).toEqual(['G'])
      expect(pressed(flavourGroup())).toEqual([flavours[1]])
    })

    it(`keeps the switch and both rows keyboard-reachable with simple=${simple} (R11, AC11)`, async () => {
      const user = userEvent.setup()
      render(<GuessCard {...props({ simple, roots, flavours })} />)

      const visited: Element[] = []
      for (let i = 0; i < 25; i += 1) {
        await user.tab()
        if (document.activeElement) visited.push(document.activeElement)
      }

      const toggle = modeSwitch()
      const sounds = soundSwitch()
      const firstRoot = within(rootGroup()).getAllByRole('button')[0]
      const firstFlavour = within(flavourGroup()).getAllByRole('button')[0]

      expect(visited).toContain(toggle)
      expect(visited).toContain(sounds)
      expect(visited).toContain(firstRoot)
      expect(visited).toContain(firstFlavour)
      // And in that order: the two switches are the first things in the card,
      // the sounds switch directly after the mode switch (F16 E2 R1, AC1).
      expect(visited.indexOf(toggle)).toBeLessThan(visited.indexOf(sounds))
      expect(visited.indexOf(sounds)).toBeLessThan(visited.indexOf(firstRoot))
      expect(visited.indexOf(firstRoot)).toBeLessThan(
        visited.indexOf(firstFlavour),
      )
    })
  }

  it('offers exactly the two options it is handed in simple mode (R4, AC3)', () => {
    render(<GuessCard {...props({ simple: true, flavours: FAMILIES })} />)

    expect(
      within(flavourGroup()).getAllByRole('button').map(chipLabel),
    ).toEqual(['Major', 'Minor'])
  })

  // The label names the question, not the size of the answer set: "Major" and
  // "Minor" are the mode question narrowed to its two families. A label that
  // moved with the toggle would change the card's vocabulary mid-day.
  it('keeps the second row labelled "Mode" in either mode (R4, AC3)', () => {
    render(<GuessCard {...props({ simple: true, flavours: FAMILIES })} />)

    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Family' })).toBeNull()
  })

  it('names no mode anywhere on the card in simple mode (R4, AC3)', () => {
    const { container } = render(
      <GuessCard
        {...props({
          simple: true,
          flavours: FAMILIES,
          roots: ['C', 'D', 'E', 'G', 'A', 'B'] as Root[],
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Minor',
          canCheck: true,
          showNudge: true,
        })}
      />,
    )

    expect(rootGroup().textContent).not.toMatch(MODE_NAME)
    expect(flavourGroup().textContent).not.toMatch(MODE_NAME)
    expect(container.textContent).not.toMatch(MODE_NAME)
  })

  // --- C6: chord and progression stay hidden --------------------------------

  it('never shows the chord or the progression while unsolved (Epic 4 guard)', () => {
    const { container } = render(
      <GuessCard
        {...props({
          selectedRoot: 'C' as Root,
          selectedFlavour: 'Minor',
          canCheck: true,
        })}
      />,
    )

    // The seeded groove behind this card is C minor / Cm7 / Cm-Fm-G7. Neither
    // the chord nor the progression may leak before Epic 4 reveals them.
    expect(container.textContent).not.toContain('Cm7')
    expect(container.textContent).not.toContain('Cm–Fm–G7')
  })

  // --- feature-10 Epic 1, Steps D2-D6: the root row sounds ------------------

  // Step D2 (R1, R2, AC1). One gesture, two things: the card reports the
  // choice and asks for the note, in that order. Only the first is allowed to
  // fail loudly, which is why selection goes first.
  it('reports the root and asks for its note on the same tap (R1, R2, AC1)', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const onSelectRoot = vi.fn((r: Root) => calls.push(`select:${r}`))
    const onHearRoot = vi.fn((r: Root) => calls.push(`hear:${r}`))
    render(<GuessCard {...props({ onSelectRoot, onHearRoot })} />)

    await user.click(within(rootGroup()).getByRole('button', { name: 'E♭' }))

    expect(onSelectRoot).toHaveBeenCalledWith('E♭')
    expect(onHearRoot).toHaveBeenCalledWith('E♭')
    expect(calls).toEqual(['select:E♭', 'hear:E♭'])
  })

  // Step D3 (R1, AC2). "Tap again to hear it again" is not a feature the card
  // adds; it is the guard on a feature it must not add. A handler that skipped
  // an unchanged value would break this and nothing else.
  it('asks again when the root already selected is tapped again (R1, AC2)', async () => {
    const user = userEvent.setup()
    const onHearRoot = vi.fn()
    render(
      <GuessCard
        {...props({ selectedRoot: 'E♭' as Root, onHearRoot })}
      />,
    )

    const chip = within(rootGroup()).getByRole('button', { name: 'E♭' })
    await user.click(chip)
    await user.click(chip)

    expect(onHearRoot).toHaveBeenCalledTimes(2)
    expect(onHearRoot).toHaveBeenNthCalledWith(1, 'E♭')
    expect(onHearRoot).toHaveBeenNthCalledWith(2, 'E♭')
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  // Step D5 (R12, AC10). The chips are already disabled once the day is over;
  // this is the proof that the new call did not route around that lock.
  it('stays silent once the day is solved (R12, AC10)', async () => {
    const user = userEvent.setup()
    const onHearRoot = vi.fn()
    const onSelectRoot = vi.fn()
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          solved: true,
          dots: ['solved', 'solved', 'solved'],
          feedback: SOLVED,
          onSelectRoot,
          onHearRoot,
        })}
      />,
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))

    expect(onHearRoot).not.toHaveBeenCalled()
    expect(onSelectRoot).not.toHaveBeenCalled()
  })

  it('stays silent once the day has been revealed (R12, AC10)', async () => {
    const user = userEvent.setup()
    const onHearRoot = vi.fn()
    render(
      <GuessCard
        {...props({ revealed: true, onHearRoot })}
      />,
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))

    expect(onHearRoot).not.toHaveBeenCalled()
  })

  // Step D6 (R7, AC6). Simple mode narrows the row the card is handed; the
  // card does the narrowing nowhere and special-cases the count nowhere, so
  // six chips sound exactly as twelve do.
  it('sounds every root a narrowed row offers (R7, AC6)', async () => {
    const user = userEvent.setup()
    const onHearRoot = vi.fn()
    const six: Root[] = ['C', 'E♭', 'F', 'G', 'A', 'B♭']
    render(
      <GuessCard {...props({ roots: six, simple: true, onHearRoot })} />,
    )

    for (const root of six) {
      await user.click(within(rootGroup()).getByRole('button', { name: root }))
    }

    expect(onHearRoot.mock.calls.map(([r]) => r)).toEqual(six)
  })

  // The two rows are wired to two handlers and never to each other's. The
  // mode row sounds now (F16 E1 R1), but it asks `onHearMode`; a mode tap that
  // reached `onHearRoot` would play a bare reference note instead of a lick.
  it('never asks for a note when a mode chip is tapped (R1)', async () => {
    const user = userEvent.setup()
    const onHearRoot = vi.fn()
    render(<GuessCard {...props({ onHearRoot })} />)

    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Dorian' }),
    )

    expect(onHearRoot).not.toHaveBeenCalled()
  })

  // Step D2, second half: the new call sits *inside* the disarming wrapper, so
  // a root tap still cancels an armed give-up exactly as it did before.
  it('still disarms the give-up control when a root is tapped (F7 E3 R6b)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<GuessCard {...props({ showReveal: true, onReveal })} />)

    await user.click(
      screen.getByRole('button', { name: /give up and show the answer/i }),
    )
    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))

    // Back to the first-press label, and the next press does not end the day.
    const give = screen.getByRole('button', {
      name: /give up and show the answer/i,
    })
    await user.click(give)
    expect(onReveal).not.toHaveBeenCalled()
  })

  // --- feature-16 Epic 1, Steps G1-G2: the mode row sounds ------------------

  // Step G1 (R1, R2, AC1). One gesture, two things, exactly as the root row
  // already does it: the card reports the choice and asks for the lick, in
  // that order. Selection goes first because it is the half allowed to fail
  // loudly.
  it('reports the mode and asks for its lick on the same tap (R1, R2, AC1)', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const onSelectFlavour = vi.fn((f: Flavour) => calls.push(`select:${f}`))
    const onHearMode = vi.fn((f: Flavour) => calls.push(`hear:${f}`))
    render(<GuessCard {...props({ onSelectFlavour, onHearMode })} />)

    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Lydian' }),
    )

    expect(onSelectFlavour).toHaveBeenCalledTimes(1)
    expect(onSelectFlavour).toHaveBeenCalledWith('Lydian')
    expect(onHearMode).toHaveBeenCalledTimes(1)
    expect(onHearMode).toHaveBeenCalledWith('Lydian')
    expect(calls).toEqual(['select:Lydian', 'hear:Lydian'])
  })

  // Step G1 (R1, AC2). "Tap again to hear it again" is the guard on a feature
  // the card must not add: a handler that skipped an unchanged value would
  // break this and nothing else.
  it('asks again when the mode already selected is tapped again (R1, AC2)', async () => {
    const user = userEvent.setup()
    const onSelectFlavour = vi.fn()
    const onHearMode = vi.fn()
    render(
      <GuessCard
        {...props({ selectedFlavour: 'Dorian', onSelectFlavour, onHearMode })}
      />,
    )

    const chip = within(flavourGroup()).getByRole('button', { name: 'Dorian' })
    await user.click(chip)
    await user.click(chip)

    expect(onHearMode).toHaveBeenCalledTimes(2)
    expect(onHearMode).toHaveBeenNthCalledWith(1, 'Dorian')
    expect(onHearMode).toHaveBeenNthCalledWith(2, 'Dorian')
    expect(onSelectFlavour).toHaveBeenCalledTimes(2)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  // Step G1 (R3, AC3). Hearing is not guessing. Tapping modes spends no
  // attempt, fills no dot and scores nothing: the dots, the line and the
  // control read exactly as they did before the taps.
  it('leaves the dots, the line and the control untouched by mode taps (R3, AC3)', async () => {
    const user = userEvent.setup()
    const onCheck = vi.fn()
    render(
      <GuessCard
        {...props({ selectedRoot: 'G' as Root, onCheck })}
      />,
    )

    const control = () =>
      screen.getByRole('button', { name: /^(Pick a root|Check |Solved$)/ })
    const before = {
      dots: dotStates(),
      line: screen.getByText(OPENING.message).textContent,
      label: control().textContent,
      disabled: (control() as HTMLButtonElement).disabled,
    }

    for (const flavour of ['Dorian', 'Lydian', 'Dorian'] as Flavour[]) {
      await user.click(
        within(flavourGroup()).getByRole('button', { name: flavour }),
      )
    }

    expect(dotStates()).toEqual(before.dots)
    expect(screen.getByText(OPENING.message).textContent).toBe(before.line)
    expect(control().textContent).toBe(before.label)
    expect((control() as HTMLButtonElement).disabled).toBe(before.disabled)
    expect(onCheck).not.toHaveBeenCalled()
  })

  // Step G1 (R22, AC15). The chips are already disabled once the day is over;
  // this is the proof that the new call did not route around that lock.
  it.each([
    ['solved', { solved: true, dots: ['solved', 'solved', 'solved'] as DotState[], feedback: SOLVED }],
    ['revealed', { revealed: true }],
  ])('stays silent on a %s day (R22, AC15)', async (_name, over) => {
    const user = userEvent.setup()
    const onHearMode = vi.fn()
    const onSelectFlavour = vi.fn()
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          onSelectFlavour,
          onHearMode,
          ...over,
        })}
      />,
    )

    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Lydian' }),
    )

    expect(onHearMode).not.toHaveBeenCalled()
    expect(onSelectFlavour).not.toHaveBeenCalled()
  })

  // Step G1 (R15, AC11). Simple mode narrows the row the card is handed; the
  // card narrows nothing and special-cases no count, so two chips sound
  // exactly as four do.
  it('sounds every option a narrowed mode row offers (R15, AC11)', async () => {
    const user = userEvent.setup()
    const onHearMode = vi.fn()
    render(
      <GuessCard {...props({ simple: true, flavours: FAMILIES, onHearMode })} />,
    )

    for (const family of FAMILIES) {
      await user.click(
        within(flavourGroup()).getByRole('button', { name: family }),
      )
    }

    expect(onHearMode.mock.calls.map(([f]) => f)).toEqual(FAMILIES)
  })

  // Step G1, second half: the new call sits *inside* the disarming wrapper, so
  // a mode tap still cancels an armed give-up exactly as it did before.
  it('still disarms the give-up control when a mode is tapped (F7 E3 R6b)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<GuessCard {...props({ showReveal: true, onReveal })} />)

    await user.click(
      screen.getByRole('button', { name: /give up and show the answer/i }),
    )
    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Dorian' }),
    )

    // Back to the first-press label, and the next press does not end the day.
    await user.click(
      screen.getByRole('button', { name: /give up and show the answer/i }),
    )
    expect(onReveal).not.toHaveBeenCalled()
  })

  // The root row keeps its own handler: a root tap is not a lick.
  it('never asks for a lick when a root chip is tapped (R1)', async () => {
    const user = userEvent.setup()
    const onHearMode = vi.fn()
    render(<GuessCard {...props({ onHearMode })} />)

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))

    expect(onHearMode).not.toHaveBeenCalled()
  })

  // --- feature-10 Epic 2, Steps C1-C2: the row looks audible ---------------

  /**
   * The glyph is the card's decision, not the chip's: `Chip` takes a generic
   * adornment and this card is what hands one to the root row and nothing to
   * the mode row. Asserted on rendered output, so it is indifferent to how the
   * design system spells the prop.
   */
  describe('the note glyph on the root row (F10 E2)', () => {
    // Step C1 — R1, R2, AC1, AC2.
    //
    // F10 E2 R2 also asserted here that *no* mode chip carried the glyph,
    // because the mode row was silent. F16 E1 R23 reverses that half: the mode
    // row sounds now, so it wears the same mark, and the assertion moved to
    // `the note glyph on the mode row (F16 E1)` below rather than being
    // dropped. What survives unchanged is this row's own contract — every root
    // chip marked, and marked leading.
    it('marks every root chip with the glyph (R1, R2, AC1)', () => {
      render(<GuessCard {...props()} />)

      const roots = within(rootGroup()).getAllByRole('button')
      expect(roots).toHaveLength(12)
      for (const chip of roots) {
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        // Leading, so the row's glyphs line up in a column (R1).
        expect(chip.textContent, chipLabel(chip)).toBe(
          `${NOTE_GLYPH}${chipLabel(chip)}`,
        )
      }
    })

    // Step C1's other half — R4, AC5. The glyph is decorative, so the name a
    // screen reader announces is the root alone, exactly as it was before.
    it('leaves a root chip’s accessible name its label alone (R4, AC5)', () => {
      render(<GuessCard {...props()} />)

      for (const root of ROOTS) {
        const chip = within(rootGroup()).getByRole('button', { name: root })
        expect(chip).toHaveAccessibleName(root)
      }
      expect(
        within(rootGroup()).queryByRole('button', { name: /♪/ }),
      ).toBeNull()
    })

    // Step C2 — R3, AC3. Simple mode narrows the row; it does not unmark it.
    /**
     * AC10, as directly as this stack allows. The criterion is that the marked
     * root row and the unmarked mode row are the same height, and jsdom has no
     * layout engine — `offsetHeight` is 0 for everything, so a literal
     * comparison would assert nothing at all.
     *
     * What decides the height here is the chip's classes, so that is what is
     * compared: every chip in both rows must carry the identical class string,
     * marked or not. Paired with `Chip`'s own guard that the adornment span
     * carries only horizontal margin, the two together say what AC10 says.
     */
    it('gives the marked row and the unmarked row identical chips (R8, AC10)', () => {
      render(<GuessCard {...props()} />)

      const classesOf = (group: HTMLElement) =>
        within(group)
          .getAllByRole('button')
          .map((chip) => chip.className)

      const roots = classesOf(rootGroup())
      const modes = classesOf(flavourGroup())

      // Every chip in a row is drawn the same, and both rows agree.
      expect(new Set([...roots, ...modes]).size).toBe(1)
    })

    it('marks all six root chips in simple mode (R3, AC3)', () => {
      const six: Root[] = ['C', 'D', 'E', 'G', 'A', 'B']
      render(<GuessCard {...props({ simple: true, roots: six, flavours: FAMILIES })} />)

      const chips = within(rootGroup()).getAllByRole('button')
      expect(chips).toHaveLength(6)
      expect(chips.map(chipLabel)).toEqual(six)
      for (const chip of chips) expect(chipAdornment(chip)).toBe(NOTE_GLYPH)
    })

    // Step C2's second half — R3, AC4. Both terminal states lock the row;
    // neither takes the glyph off it.
    it.each([
      ['solved', { solved: true }],
      ['revealed', { revealed: true }],
    ])('keeps the glyph on the disabled chips of a %s day (R3, AC4)', (_name, over) => {
      render(<GuessCard {...props({ ...over, selectedRoot: 'G' as Root })} />)

      const chips = within(rootGroup()).getAllByRole('button')
      for (const chip of chips) {
        expect(chip).toBeDisabled()
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
      }
      // The selected chip wears it too, on its accent treatment (R3, R9).
      const selected = within(rootGroup()).getByRole('button', { name: 'G' })
      expect(selected).toHaveAttribute('aria-pressed', 'true')
      expect(chipAdornment(selected)).toBe(NOTE_GLYPH)
    })

    // R8, AC10. The glyph is spacing and nothing else: it may not give the
    // root row a class the mode row does not have.
    it('leaves the two rows built the same way (R8, AC10)', () => {
      render(<GuessCard {...props()} />)

      const rootChip = within(rootGroup()).getAllByRole('button')[0]
      const modeChip = within(flavourGroup()).getAllByRole('button')[0]
      expect(rootChip.className).toBe(modeChip.className)
    })
  })

  /**
   * The mode row sounds now, so it says so (F16 E1 R23, R24, AC16). The glyph
   * is the card's decision and not the chip's: `Chip` takes a generic
   * adornment, and this card is what hands the same one to both rows. Asserted
   * on rendered output, so it is indifferent to how the design system spells
   * the prop.
   */
  describe('the note glyph on the mode row (F16 E1)', () => {
    // Step G2 — R23, AC16.
    it('marks every mode chip with the same glyph the roots wear (R23, AC16)', () => {
      render(<GuessCard {...props()} />)

      const modes = within(flavourGroup()).getAllByRole('button')
      expect(modes).toHaveLength(FLAVOURS.length)
      for (const chip of modes) {
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        // Leading, like the root row's, so both rows read the same way.
        expect(chip.textContent, chipLabel(chip)).toBe(
          `${NOTE_GLYPH}${chipLabel(chip)}`,
        )
      }

      // The same mark, not a second vocabulary of marks.
      const rootMarks = within(rootGroup())
        .getAllByRole('button')
        .map(chipAdornment)
      expect(new Set([...rootMarks, ...modes.map(chipAdornment)]).size).toBe(1)
    })

    // Step G2's other half — R24, AC16. The glyph is decoration, so the name a
    // screen reader announces is the mode alone, exactly as it was before.
    it('leaves a mode chip’s accessible name its label alone (R24, AC16)', () => {
      render(<GuessCard {...props()} />)

      for (const flavour of FLAVOURS) {
        const chip = within(flavourGroup()).getByRole('button', {
          name: flavour,
        })
        expect(chip).toHaveAccessibleName(flavour)
        expect(
          chip.querySelector('[aria-hidden="true"]')?.textContent,
        ).toBe(NOTE_GLYPH)
      }
      expect(
        within(flavourGroup()).queryByRole('button', { name: /♪/ }),
      ).toBeNull()
    })

    // Simple mode narrows the row; it does not unmark it (R23, AC16).
    it('marks both options in simple mode (R23, AC16)', () => {
      render(<GuessCard {...props({ simple: true, flavours: FAMILIES })} />)

      const chips = within(flavourGroup()).getAllByRole('button')
      expect(chips.map(chipLabel)).toEqual(FAMILIES)
      for (const chip of chips) {
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        expect(chip).toHaveAccessibleName(chipLabel(chip))
      }
    })

    // Both terminal states lock the row; neither takes the glyph off it, and
    // neither changes what a chip is called.
    it.each([
      ['solved', { solved: true }],
      ['revealed', { revealed: true }],
    ])('keeps the glyph on the disabled mode chips of a %s day', (_name, over) => {
      render(
        <GuessCard {...props({ ...over, selectedFlavour: 'Dorian' })} />,
      )

      for (const chip of within(flavourGroup()).getAllByRole('button')) {
        expect(chip).toBeDisabled()
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
      }
      // The selected chip wears it too, on its accent treatment.
      const selected = within(flavourGroup()).getByRole('button', {
        name: 'Dorian',
      })
      expect(selected).toHaveAttribute('aria-pressed', 'true')
      expect(chipAdornment(selected)).toBe(NOTE_GLYPH)
    })
  })

  // --- feature-16 Epic 2, Steps D4-D7: the tap-sounds switch ---------------

  /**
   * The second preference on the card. It is the same control as the
   * simple-mode toggle with different words (R14), it sits directly under it
   * (R1), and it is the one thing on this card that does *not* settle when the
   * day does (R5a).
   */
  describe('the tap-sounds switch (F16 E2)', () => {
    // Step D4 — R1, R14, AC1.
    it('sits directly below the simple-mode toggle, above both rows (R1, AC1)', () => {
      render(<GuessCard {...props()} />)

      expect(precedes(modeSwitch(), soundSwitch())).toBe(true)
      expect(precedes(soundSwitch(), rootGroup())).toBe(true)
      expect(precedes(soundSwitch(), flavourGroup())).toBe(true)
    })

    // One stack, not two things that happen to be adjacent: the pair reads as
    // the card's preferences, so a later insertion between them is a change
    // someone has to make on purpose.
    it('shares its stack with the simple-mode toggle (R1, R14, AC1)', () => {
      render(<GuessCard {...props()} />)

      expect(soundSwitch().parentElement).toBe(modeSwitch().parentElement)
    })

    it('reports the state the player asked for, not the one they left (R1)', async () => {
      const user = userEvent.setup()
      const onToggleTapSounds = vi.fn()
      render(<GuessCard {...props({ tapSounds: true, onToggleTapSounds })} />)

      expect(soundSwitch()).toHaveAttribute('aria-checked', 'true')
      await user.click(soundSwitch())

      expect(onToggleTapSounds).toHaveBeenCalledWith(false)
    })

    it('asks to turn the sounds back on when they are off (R1, R4)', async () => {
      const user = userEvent.setup()
      const onToggleTapSounds = vi.fn()
      render(<GuessCard {...props({ tapSounds: false, onToggleTapSounds })} />)

      expect(soundSwitch()).toHaveAttribute('aria-checked', 'false')
      await user.click(soundSwitch())

      expect(onToggleTapSounds).toHaveBeenCalledWith(true)
    })

    // Step D5 — R5a, AC11b. The asymmetry with the row above it is the point:
    // the mode is a record of how the day was played and settles with the
    // card; the sounds are a setting, and this card is their only home.
    it.each([
      ['solved', { solved: true, dots: ['solved', 'solved', 'solved'] as DotState[], feedback: SOLVED }],
      ['revealed', { revealed: true }],
    ])('stays live on a %s day while the mode switch settles (R5a, AC11b)', async (_name, over) => {
      const user = userEvent.setup()
      const onToggleTapSounds = vi.fn()
      render(
        <GuessCard
          {...props({
            selectedRoot: 'G' as Root,
            selectedFlavour: 'Dorian',
            onToggleTapSounds,
            ...over,
          })}
        />,
      )

      expect(modeSwitch()).toBeDisabled()
      expect(soundSwitch()).toBeEnabled()

      await user.click(soundSwitch())
      expect(onToggleTapSounds).toHaveBeenCalledWith(false)
    })

    // Step D6 — R12, AC11. The mark is the promise that a chip sounds, so it
    // follows the preference: no sounds, no promise. Both rows, one flag —
    // Epic 1 marked the mode row and left routing it through this condition
    // to this epic, which is the seam the two agreed on.
    it('marks both rows while the sounds are on (R12, AC11)', () => {
      render(<GuessCard {...props({ tapSounds: true })} />)

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of within(group).getAllByRole('button')) {
          expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        }
      }
    })

    it('takes the mark off both rows while the sounds are off (R12, AC11)', () => {
      render(<GuessCard {...props({ tapSounds: false })} />)

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of within(group).getAllByRole('button')) {
          expect(chipAdornment(chip), chipLabel(chip)).toBeNull()
        }
      }
    })

    // The mark going away must not change what either row *offers*.
    it('leaves both rows offering exactly what they offered (R12, AC11)', () => {
      const { unmount } = render(<GuessCard {...props({ tapSounds: true })} />)
      const marked = {
        roots: within(rootGroup()).getAllByRole('button').map(chipLabel),
        modes: within(flavourGroup()).getAllByRole('button').map(chipLabel),
      }
      unmount()

      render(<GuessCard {...props({ tapSounds: false })} />)

      expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
        marked.roots,
      )
      expect(
        within(flavourGroup()).getAllByRole('button').map(chipLabel),
      ).toEqual(marked.modes)
      for (const root of ROOTS) {
        expect(
          within(rootGroup()).getByRole('button', { name: root }),
        ).toHaveAccessibleName(root)
      }
    })

    // Step D7 — R5, AC5. Flipping a preference is not an attempt.
    it('changes nothing else on the card when it is flipped (R5, AC5)', async () => {
      const user = userEvent.setup()
      const onSelectRoot = vi.fn()
      const onSelectFlavour = vi.fn()
      const onCheck = vi.fn()
      render(
        <GuessCard
          {...props({
            dots: ['spent', 'unspent', 'unspent'],
            feedback: ROOT_MATCHED,
            selectedRoot: 'G' as Root,
            selectedFlavour: 'Dorian',
            canCheck: true,
            onSelectRoot,
            onSelectFlavour,
            onCheck,
          })}
        />,
      )

      const control = () =>
        screen.getByRole('button', { name: /^(Pick a root|Check |Solved$)/ })
      const before = {
        dots: dotStates(),
        line: screen.getByRole('status').textContent,
        label: control().textContent,
        pressed: screen
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map(chipLabel),
      }

      await user.click(soundSwitch())

      expect(dotStates()).toEqual(before.dots)
      expect(screen.getByRole('status').textContent).toBe(before.line)
      expect(control().textContent).toBe(before.label)
      expect(
        screen
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map(chipLabel),
      ).toEqual(before.pressed)
      expect(onSelectRoot).not.toHaveBeenCalled()
      expect(onSelectFlavour).not.toHaveBeenCalled()
      expect(onCheck).not.toHaveBeenCalled()
    })

    // Step D4's other half: every interactive handler on this card goes
    // through `disarming`, and flipping a preference is doing something else
    // with the card — the documented way back out of an armed give-up (R6b).
    it('disarms an armed give-up when the sounds are switched instead (F7 E3 R6b)', async () => {
      const user = userEvent.setup()
      const onReveal = vi.fn()
      render(<GuessCard {...props({ showReveal: true, onReveal })} />)

      await user.click(giveUp() as HTMLElement)
      expect(confirm()).toBeInTheDocument()

      await user.click(soundSwitch())

      expect(onReveal).not.toHaveBeenCalled()
      expect(confirm()).not.toBeInTheDocument()
      expect(giveUp()).toBeInTheDocument()
    })
  })
})

/**
 * Relocated from `src/app/page.test.tsx` (Epic 3, Step C2). Each of these
 * asserts what the card offers on the real day — the day's chips, the day's
 * ordering, the day's check control — which is only true of a card the page
 * built, so they keep the composed render they were written against rather
 * than the hand-made props above.
 */
describe('through the composed page', () => {
  it("offers today's deterministic flavour options", async () => {
    await renderFeature();

    const today = new Date();
    const groove = selectGrooveForDate(today, GROOVES);
    const expected = flavourOptions(today, groove);
    const flavours = screen.getByRole("radiogroup", { name: "Mode" });

    expect(
      within(flavours).getAllByRole("button").map(chipLabel),
    ).toEqual(expected);
  })

  it("offers all twelve roots, in the design's order", async () => {
    await renderFeature();

    const roots = screen.getByRole("radiogroup", { name: "Root" });
    expect(within(roots).getAllByRole("button").map(chipLabel)).toEqual(ROOTS);
  })

  it("names the chosen pair on the check control once both are picked (AC6)", async () => {
    const user = userEvent.setup();
    await renderFeature();

    const control = () =>
      screen.getByRole("button", { name: /^(Pick a root|Check |Solved$)/ });

    expect(control()).toHaveAccessibleName("Pick a root and a mode");
    expect(control()).toBeDisabled();

    const roots = screen.getByRole("radiogroup", { name: "Root" });
    const flavours = screen.getByRole("radiogroup", { name: "Mode" });
    await user.click(within(roots).getByRole("button", { name: "G" }));
    const firstFlavour = within(flavours).getAllByRole("button")[0];
    await user.click(firstFlavour);

    expect(control()).toHaveAccessibleName(
      `Check G ${chipLabel(firstFlavour)}`,
    );
    expect(control()).toBeEnabled();
  })
})
