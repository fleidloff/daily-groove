import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Flavour, Root } from '../../types'
import { ROOTS, flavourOptions } from '../../lib/theory/music'
import { GROOVES } from '../../data/grooves.generated'
import { selectGrooveForDate } from '../../lib/puzzle/selectGroove'
import { renderFeature } from '../../testing/renderFeature'
import type { DotState, Feedback } from '../../lib/presentation/feedback'
import { GuessCard } from './GuessCard'

const FLAVOURS: Flavour[] = ['Dorian', 'Mixolydian', 'Lydian', 'Minor']

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
    canCheck: false,
    onCheck: vi.fn(),
    solved: false,
    feedback: OPENING,
    showNudge: false,
    dots: UNSPENT,
    answerRoot: 'G',
    ...overrides,
  }
}

const rootGroup = () => screen.getByRole('radiogroup', { name: 'Root' })
const flavourGroup = () => screen.getByRole('radiogroup', { name: 'Flavour' })
/** The element a chip group lays its chips out on. */
const chipList = (group: HTMLElement) =>
  group.querySelector('[data-testid="chip-list"]') as HTMLElement
const dotStates = () =>
  Array.from(document.querySelectorAll('[data-dot-state]')).map((el) =>
    el.getAttribute('data-dot-state'),
  )

describe('GuessCard', () => {
  // --- C1: twelve roots, four flavours (R1, R2, R3, AC1) --------------------

  it('offers twelve root chips and exactly four flavour chips (AC1)', () => {
    render(<GuessCard {...props()} />)

    expect(within(rootGroup()).getAllByRole('button')).toHaveLength(12)
    expect(within(flavourGroup()).getAllByRole('button')).toHaveLength(4)
  })

  it('renders the roots and flavours it is given, in order (R1, R2, R3)', () => {
    render(<GuessCard {...props()} />)

    expect(
      within(rootGroup())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(ROOTS)
    expect(
      within(flavourGroup())
        .getAllByRole('button')
        .map((b) => b.textContent),
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
    expect(pressedRoots.map((b) => b.textContent)).toEqual(['G'])

    const pressedFlavours = within(flavourGroup())
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressedFlavours.map((b) => b.textContent)).toEqual(['Dorian'])
  })

  // --- C2: the control names the pair (R7, R8, AC6) -------------------------

  it('prompts and stays disabled until both halves are chosen (R7, AC6)', () => {
    render(<GuessCard {...props()} />)

    expect(
      screen.getByRole('button', { name: 'Pick a root and a flavour' }),
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
      screen.queryByRole('button', { name: 'Pick a root and a flavour' }),
    ).not.toBeInTheDocument()
  })

  it('keeps prompting while only one half is chosen (R7)', () => {
    render(<GuessCard {...props({ selectedRoot: 'G' as Root })} />)
    expect(
      screen.getByRole('button', { name: 'Pick a root and a flavour' }),
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

    expect(screen.getByRole('img')).toHaveAccessibleName('0 of 3 attempts spent')
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

  // --- Epic 1 C1-C3: the dots sit above the check button, alone -------------

  it('puts the attempt dots directly above the check button, not beside the heading (R7, AC7)', () => {
    render(<GuessCard {...props()} />)

    const control = screen.getByRole('button', {
      name: 'Pick a root and a flavour',
    })
    const dotsRow = control.previousElementSibling as HTMLElement

    // The row immediately above the control is the dot row itself.
    expect(dotsRow.querySelectorAll('[data-dot-state]')).toHaveLength(3)
    expect(within(dotsRow).getByRole('img')).toHaveAccessibleName(
      '0 of 3 attempts spent',
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
      name: 'Pick a root and a flavour',
    }).previousElementSibling as HTMLElement

    expect(dotsRow.textContent).toBe('')
  })

  it('REGRESSION GUARD: the moved dots keep their accessible name (R8, AC8)', () => {
    render(<GuessCard {...props({ dots: ['spent', 'spent', 'unspent'] })} />)

    expect(
      screen.getByRole('img', { name: '2 of 3 attempts spent' }),
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
    const flavours = screen.getByRole("radiogroup", { name: "Flavour" });

    expect(
      within(flavours)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(expected);
  })

  it("offers all twelve roots, in the design's order", async () => {
    await renderFeature();

    const roots = screen.getByRole("radiogroup", { name: "Root" });
    expect(
      within(roots)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual(ROOTS);
  })

  it("names the chosen pair on the check control once both are picked (AC6)", async () => {
    const user = userEvent.setup();
    await renderFeature();

    const control = () =>
      screen.getByRole("button", { name: /^(Pick a root|Check |Solved$)/ });

    expect(control()).toHaveAccessibleName("Pick a root and a flavour");
    expect(control()).toBeDisabled();

    const roots = screen.getByRole("radiogroup", { name: "Root" });
    const flavours = screen.getByRole("radiogroup", { name: "Flavour" });
    await user.click(within(roots).getByRole("button", { name: "G" }));
    const firstFlavour = within(flavours).getAllByRole("button")[0];
    await user.click(firstFlavour);

    expect(control()).toHaveAccessibleName(
      `Check G ${firstFlavour.textContent}`,
    );
    expect(control()).toBeEnabled();
  })
})
