import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArchiveStrip, type ArchiveStripEntry } from './ArchiveStrip'
import { renderFeature } from '../../testing/renderFeature'

// The composed block below presses play controls, so audio is mocked exactly as
// `src/app/page.test.tsx` mocked it — rendering never touches jsdom media
// playback. The strip itself imports no audio, so the isolated tests are
// unaffected by this.
vi.mock('../../lib/audio/audio', () => ({
  createAudioPlayer: () => ({
    play: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    getPosition: vi.fn(() => 0),
    getCurrentTime: vi.fn(() => 0),
    isPlaying: vi.fn(() => false),
    subscribe: vi.fn(() => () => {}),
    dispose: vi.fn(),
  }),
}))

const firstTry: ArchiveStripEntry = {
  date: '2026-08-28',
  label: 'Yesterday',
  answer: { root: 'G', flavour: 'Dorian' },
  outcome: 'first-try',
  tries: 1,
  grooveId: 'groove-02',
}

const solvedInThree: ArchiveStripEntry = {
  date: '2026-08-26',
  label: 'Wed',
  answer: { root: 'C', flavour: 'Minor' },
  outcome: 'solved',
  tries: 3,
  grooveId: 'groove-05',
}

const missed: ArchiveStripEntry = {
  date: '2026-08-24',
  label: 'Mon',
  answer: { root: 'E♭', flavour: 'Blues' },
  outcome: 'missed',
  tries: 3,
  grooveId: 'groove-08',
}

const THREE = [firstTry, solvedInThree, missed]

/**
 * Today, shown but still winnable: the row holds the card without the answer.
 * The day's real pair is F♯ Dorian — it must not reach the DOM.
 */
const inPlayToday: ArchiveStripEntry = {
  date: '2026-08-29',
  label: 'Today',
  answer: null,
  outcome: 'in-play',
  tries: 3,
  grooveId: 'groove-11',
}

/** The rendered cards, in DOM order. */
function cards(container: HTMLElement): HTMLElement[] {
  const grid = container.querySelector('[class*="grid-cols"]')
  return grid ? (Array.from(grid.children) as HTMLElement[]) : []
}

function cardWith(container: HTMLElement, text: string): HTMLElement {
  const found = cards(container).find((card) => card.textContent?.includes(text))
  if (!found) throw new Error(`no card containing "${text}"`)
  return found
}

describe('ArchiveStrip', () => {
  it("shows each groove's name alongside its answer", () => {
    const named = THREE.map((entry, i) => ({
      ...entry,
      grooveName: ['Sunroom Shuffle', 'Cold Brew', 'Late Transfer'][i],
    }))

    const { container } = render(
      <ArchiveStrip entries={named} soundingId={null} onToggle={() => {}} />,
    )

    // Name and answer sit on the same card, not merely somewhere in the row.
    const card = cardWith(container, 'Sunroom Shuffle')
    expect(card.textContent).toContain('G Dorian')
    expect(within(card).getByText('Sunroom Shuffle')).toBeInTheDocument()

    expect(screen.getByText('Cold Brew')).toBeInTheDocument()
    expect(screen.getByText('Late Transfer')).toBeInTheDocument()
  })

  it('omits the name when the day’s groove cannot be resolved', () => {
    const unresolvable: ArchiveStripEntry = {
      ...firstTry,
      grooveId: null,
      grooveName: null,
    }

    const { container } = render(
      <ArchiveStrip entries={[unresolvable]} soundingId={null} onToggle={() => {}} />,
    )

    const card = cards(container)[0]
    // The answer still stands; only the name is absent, and nothing renders in
    // its place — no empty element holding the card open.
    expect(card.textContent).toContain('G Dorian')
    expect(card.textContent?.trim()).not.toContain('null')
    expect(card.textContent?.trim()).not.toContain('undefined')
  })

  it('shows the name on an unsolved today without undoing the masking (R6a)', () => {
    // The name is not the answer: "Sunroom Shuffle" says nothing about F♯ or
    // Dorian, so it can appear while the pair is still withheld.
    const { container } = render(
      <ArchiveStrip
        entries={[{ ...inPlayToday, grooveName: 'Sunroom Shuffle' }]}
        soundingId={null}
        onToggle={() => {}}
      />,
    )

    const card = cards(container)[0]
    expect(within(card).getByText('Sunroom Shuffle')).toBeInTheDocument()
    expect(within(card).getByText('In play')).toBeInTheDocument()
    expect(card.textContent).not.toContain('F♯')
    expect(card.textContent).not.toContain('Dorian')
  })

  it('renders under the section label (R8)', () => {
    render(<ArchiveStrip entries={THREE} soundingId={null} onToggle={() => {}} />)

    expect(screen.getByText(/grooves you.ve played/i)).toBeInTheDocument()
  })

  it('puts no link in the heading row — there is no archive route (R8)', () => {
    const { container } = render(<ArchiveStrip entries={THREE} soundingId={null} onToggle={() => {}} />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
  })

  it('renders one card per entry, most recent first (R8, AC7)', () => {
    const { container } = render(<ArchiveStrip entries={THREE} soundingId={null} onToggle={() => {}} />)

    const rendered = cards(container)
    expect(rendered).toHaveLength(3)
    expect(rendered[0].textContent).toContain('Yesterday')
    expect(rendered[1].textContent).toContain('Wed')
    expect(rendered[2].textContent).toContain('Mon')
  })

  it('shows every day its label, its mark and its answer (R9, AC7)', () => {
    const { container } = render(<ArchiveStrip entries={THREE} soundingId={null} onToggle={() => {}} />)

    const yesterday = cardWith(container, 'Yesterday')
    expect(yesterday.textContent).toContain('solved')
    expect(yesterday.textContent).toContain('G Dorian')

    const wednesday = cardWith(container, 'Wed')
    expect(wednesday.textContent).toContain('3 tries')
    expect(wednesday.textContent).toContain('C Minor')
  })

  it('sets the answer in the display font (R9)', () => {
    render(<ArchiveStrip entries={THREE} soundingId={null} onToggle={() => {}} />)

    expect(screen.getByText('G Dorian').className).toContain('font-display')
  })

  it('distinguishes the three outcomes by text, not colour alone (R10, AC8)', () => {
    const { container } = render(<ArchiveStrip entries={THREE} soundingId={null} onToggle={() => {}} />)

    const marks = cards(container).map((card, i) => {
      const label = [firstTry, solvedInThree, missed][i].label
      return (card.textContent ?? '').replace(label, '').trim()
    })

    // Each mark reads differently as text — strip the colours and the three
    // cards still say three different things.
    expect(marks[0]).toContain('solved')
    expect(marks[1]).toContain('3 tries')
    expect(marks[2]).toContain('missed')
    expect(new Set(marks).size).toBe(3)
  })

  it('still shows the answer for a day left unsolved (R11, AC9)', () => {
    const { container } = render(<ArchiveStrip entries={THREE} soundingId={null} onToggle={() => {}} />)

    const card = cardWith(container, 'missed')
    expect(card.textContent).toContain('E♭ Blues')
  })

  it('draws no sparkline or decorative bar graphic (R9, AC10)', () => {
    const { container } = render(<ArchiveStrip entries={THREE} soundingId={null} onToggle={() => {}} />)

    expect(container.querySelector('svg')).toBeNull()
    expect(container.querySelector('canvas')).toBeNull()

    // A bar graphic is a run of empty leaf elements. Every leaf the strip
    // renders carries words.
    const leaves = Array.from(container.querySelectorAll('*')).filter(
      (el) => el.children.length === 0,
    )
    const decorative = leaves.filter((el) => (el.textContent ?? '').trim() === '')
    expect(decorative).toEqual([])
  })

  it('renders at most the seven most recent days — one week (R8)', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      ...firstTry,
      date: `2026-08-${20 + i}`,
      label: `Day ${9 - i}`,
    }))

    const { container } = render(<ArchiveStrip entries={many} soundingId={null} onToggle={() => {}} />)

    expect(cards(container)).toHaveLength(7)
    expect(cards(container)[0].textContent).toContain('Day 9')
    // The eighth-oldest and beyond fall off entirely — there is no count
    // standing in for them any more.
    expect(container.textContent).not.toContain('Day 2')
  })

  it('shows a designed empty state and no grid when there is no history (R12, AC11)', () => {
    const { container } = render(<ArchiveStrip entries={[]} soundingId={null} onToggle={() => {}} />)

    expect(screen.getByText(/no grooves behind you yet/i)).toBeInTheDocument()
    expect(container.querySelector('[class*="grid-cols"]')).toBeNull()
    expect(cards(container)).toEqual([])
  })

  it('renders a placeholder, never the answer, for an in-play day (R6a, AC6a)', () => {
    const { container } = render(
      <ArchiveStrip entries={[inPlayToday, solvedInThree, missed]} soundingId={null} onToggle={() => {}} />,
    )

    const today = cardWith(container, 'Today')
    expect(today.textContent).toContain('In play')
    expect(today.textContent).toContain('\u2014')

    // The day's own pair must appear nowhere in the strip, and neither half of
    // it on its own: the puzzle above is still asking for exactly this.
    const rendered = container.textContent ?? ''
    expect(rendered).not.toContain('F\u266f')
    expect(rendered).not.toContain('Dorian')
  })

  it('keeps the placeholder in the answer slot, so the card holds its height (R6a)', () => {
    const { container } = render(<ArchiveStrip entries={[inPlayToday]} soundingId={null} onToggle={() => {}} />)

    const placeholder = screen.getByText('\u2014')
    expect(placeholder.className).toContain('font-display')
    expect(placeholder.className).toContain('text-[19px]')
    expect(cardWith(container, 'Today')).toContainElement(placeholder)
  })

  it('gives the in-play mark its own tone, with the word still carrying it (R6b, AC6c)', () => {
    render(<ArchiveStrip entries={[inPlayToday, ...THREE]} soundingId={null} onToggle={() => {}} />)

    const mark = screen.getByText('In play')
    expect(mark.className).toContain('text-warm')

    // Colour is the second channel: strip it and the card still says "In play",
    // which no other outcome's mark reads as.
    expect(mark.textContent).toBe('In play')
  })

  it('suppresses the empty state when today is the only entry (R7, AC8)', () => {
    const { container } = render(<ArchiveStrip entries={[inPlayToday]} soundingId={null} onToggle={() => {}} />)

    expect(screen.queryByText(/no grooves behind you yet/i)).toBeNull()
    expect(cards(container)).toHaveLength(1)
    expect(cards(container)[0].textContent).toContain('Today')
  })

  it('renders the empty state only when there are no entries at all (R7, AC9)', () => {
    render(<ArchiveStrip entries={[]} soundingId={null} onToggle={() => {}} />)

    expect(screen.getByText(/no grooves behind you yet/i)).toBeInTheDocument()
  })

  // --- Epic 5: a play control on every card ---------------------------------

  /** The one control a card renders. */
  function controlOf(container: HTMLElement, text: string): HTMLElement {
    return within(cardWith(container, text)).getByRole('button')
  }

  const nameOf = (el: HTMLElement) => el.getAttribute('aria-label')

  it('gives every card a play control that names its own day (E5 R1, R6, AC1, AC6)', () => {
    const { container } = render(
      <ArchiveStrip entries={THREE} soundingId={null} onToggle={() => {}} />,
    )

    const controls = cards(container).map((card) =>
      within(card).getByRole('button'),
    )
    expect(controls).toHaveLength(3)
    expect(controls.map(nameOf)).toEqual([
      "Play Yesterday's groove",
      "Play Wed's groove",
      "Play Mon's groove",
    ])
    // Six in a row stay distinguishable to a screen reader (AC6).
    expect(new Set(controls.map(nameOf)).size).toBe(3)
  })

  it('names each of six cards distinctly (E5 R6, AC6)', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      ...firstTry,
      date: `2026-08-${20 + i}`,
      label: `Day ${6 - i}`,
      grooveId: `groove-0${i + 1}`,
    }))

    const { container } = render(
      <ArchiveStrip entries={six} soundingId={null} onToggle={() => {}} />,
    )

    const names = cards(container).map((card) =>
      nameOf(within(card).getByRole('button')),
    )
    expect(names).toEqual([
      "Play Day 6's groove",
      "Play Day 5's groove",
      "Play Day 4's groove",
      "Play Day 3's groove",
      "Play Day 2's groove",
      "Play Day 1's groove",
    ])
    expect(new Set(names).size).toBe(6)
  })

  it('renders the small variant of the shared control, not a second component (E5 R1)', () => {
    const { container } = render(
      <ArchiveStrip entries={[firstTry]} soundingId={null} onToggle={() => {}} />,
    )

    // The 'sm' PlayControl is the circular IconButton; 'lg' is the full-width
    // Button. Geometry is the only thing that tells them apart from outside.
    const control = controlOf(container, 'Yesterday')
    expect(control.className).toContain('rounded-full')
    expect(control.className).not.toContain('w-full')
  })

  it('hands the pressed entry straight back to its caller (E5 R2, AC1)', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    const { container } = render(
      <ArchiveStrip entries={THREE} soundingId={null} onToggle={onToggle} />,
    )

    await user.click(controlOf(container, 'Wed'))

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith(solvedInThree)
  })

  it('shows the sounding affordance on the sounding day alone (E5 R5, AC5)', () => {
    const { container } = render(
      <ArchiveStrip
        entries={THREE}
        soundingId={solvedInThree.grooveId as string}
        onToggle={() => {}}
      />,
    )

    expect(nameOf(controlOf(container, 'Wed'))).toBe("Stop Wed's groove")
    expect(nameOf(controlOf(container, 'Yesterday'))).toBe("Play Yesterday's groove")
    expect(nameOf(controlOf(container, 'Mon'))).toBe("Play Mon's groove")

    const sounding = cards(container).filter((card) =>
      /^Stop /.test(nameOf(within(card).getByRole('button')) ?? ''),
    )
    expect(sounding).toHaveLength(1)
  })

  it('leaves every control on play when nothing is sounding (E5 R5)', () => {
    const { container } = render(
      <ArchiveStrip entries={THREE} soundingId={null} onToggle={() => {}} />,
    )

    for (const card of cards(container)) {
      expect(nameOf(within(card).getByRole('button'))).toMatch(/^Play /)
    }
  })

  it("gives today's card a control like every other day (E5 R11, AC13)", () => {
    const { container } = render(
      <ArchiveStrip
        entries={[inPlayToday, ...THREE]}
        soundingId={null}
        onToggle={() => {}}
      />,
    )

    const control = controlOf(container, 'Today')
    expect(control).toBeEnabled()
    expect(nameOf(control)).toBe("Play Today's groove")
  })

  it('disables the control of a day whose groove cannot be resolved (E5 R10, AC12)', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    const gone: ArchiveStripEntry = { ...missed, grooveId: null }
    const { container } = render(
      <ArchiveStrip
        entries={[firstTry, gone]}
        soundingId={null}
        onToggle={onToggle}
      />,
    )

    // The card still renders — it still shows the day and its answer — but its
    // control states why it does nothing rather than playing the wrong audio.
    const control = controlOf(container, 'Mon')
    expect(control).toBeDisabled()
    expect(nameOf(control)).toBe("Mon's groove is unavailable")
    expect(cardWith(container, 'Mon').textContent).toContain('E\u266d Blues')

    await user.click(control)
    expect(onToggle).not.toHaveBeenCalled()
    // Its neighbour is untouched by it.
    expect(controlOf(container, 'Yesterday')).toBeEnabled()
  })

  it("gives today one of the seven slots, not an eighth (R9, AC10)", () => {
    const past = Array.from({ length: 7 }, (_, i) => ({
      ...firstTry,
      date: `2026-08-${22 + i}`,
      label: `Day ${7 - i}`,
    }))

    const { container } = render(
      <ArchiveStrip entries={[inPlayToday, ...past]} soundingId={null} onToggle={() => {}} />,
    )

    expect(cards(container)).toHaveLength(7)
    expect(cards(container)[0].textContent).toContain('Today')
  })

  it('renders no "All N" count beside the heading (R8)', () => {
    const { container } = render(
      <ArchiveStrip entries={THREE} soundingId={null} onToggle={() => {}} />,
    )

    expect(container.textContent).not.toMatch(/All\s*\d/)
  })
})

/**
 * Relocated from `src/app/page.test.tsx` (Epic 3, Step C2). The strip is
 * presentational — its own tests hand it entries — so its empty state on a
 * first visit, and the exclusivity of the controls it draws, are only true of a
 * strip the page built from real stored days. Storage is real here (the
 * in-memory shim from vitest.setup.ts), which is what these were written
 * against.
 */
describe('through the composed page', () => {
  const STORAGE_KEY = "daily-groove:v2:results";

  /** An ISO day N days back, as `lib/selectGroove` formats one. */
  function daysAgo(n: number): string {
    const date = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
  }

  /** Two past days already in real storage, each remembering its groove. */
  function seedTwoPastDays() {
    const record = (date: string, grooveId: string) => ({
      date,
      answer: { root: "G", flavour: "Dorian" },
      attempts: [
        {
          root: "D",
          flavour: "Lydian",
          correct: false,
          rootMatched: false,
          flavourMatched: false,
        },
      ],
      solved: false,
      grooveId,
    });

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        byDate: {
          [daysAgo(1)]: record(daysAgo(1), "groove-02"),
          [daysAgo(2)]: record(daysAgo(2), "groove-03"),
        },
      }),
    );
  }

  const archiveCards = () => {
    const section = screen
      .getByText(/grooves you.{0,3}ve played/i)
      .closest("section") as HTMLElement;
    const grid = section.querySelector('[class*="grid-cols"]');
    return grid ? (Array.from(grid.children) as HTMLElement[]) : [];
  };

  /** Every control on the page currently offering to stop. */
  const soundingControls = () =>
    screen
      .getAllByRole("button")
      .filter((b) => /^Stop\b/.test(b.getAttribute("aria-label") ?? ""));

  it("shows the archive's empty state on a first visit", async () => {
    await renderFeature();

    expect(screen.getByText(/grooves you.{0,3}ve played/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no grooves behind you yet/i),
    ).toBeInTheDocument();
  })

  it("puts a play control on every card in the played row (E5 R1, R2, AC1, AC6)", async () => {
    seedTwoPastDays();
    await renderFeature();

    const cards = archiveCards();
    expect(cards).toHaveLength(2);

    const names = cards.map((card) =>
      within(card).getByRole("button").getAttribute("aria-label"),
    );
    // One control per card, each naming its own day and each live.
    expect(names.every((name) => /^Play .+'s groove$/.test(name ?? ""))).toBe(
      true,
    );
    expect(new Set(names).size).toBe(2);
    for (const card of cards) {
      expect(within(card).getByRole("button")).toBeEnabled();
    }
  })

  it("leaves exactly one groove sounding as the row is played through (E5 R3, R5, AC4, AC5)", async () => {
    seedTwoPastDays();
    const user = userEvent.setup();
    await renderFeature();

    const controlIn = (index: number) =>
      within(archiveCards()[index]).getByRole("button");

    // Nothing sounds until something is pressed.
    expect(soundingControls()).toEqual([]);

    // Press the first card: it alone shows the sounding affordance.
    await user.click(controlIn(0));
    expect(soundingControls()).toHaveLength(1);
    expect(soundingControls()[0]).toBe(controlIn(0));

    // Press the second: the first hands over rather than joining it (AC4).
    await user.click(controlIn(1));
    expect(soundingControls()).toHaveLength(1);
    expect(soundingControls()[0]).toBe(controlIn(1));
    expect(controlIn(0).getAttribute("aria-label")).toMatch(/^Play /);

    // Today's full-width control takes it back off the card (AC3).
    await user.click(screen.getByRole("button", { name: "Play the loop" }));
    expect(soundingControls().map((b) => b.getAttribute("aria-label"))).toEqual([
      "Stop the loop",
    ]);
  })
})
