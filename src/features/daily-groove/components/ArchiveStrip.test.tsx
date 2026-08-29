import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ArchiveEntry } from '../lib/archive'
import { ArchiveStrip } from './ArchiveStrip'

const firstTry: ArchiveEntry = {
  date: '2026-08-28',
  label: 'Yesterday',
  answer: { root: 'G', flavour: 'Dorian' },
  outcome: 'first-try',
  tries: 1,
}

const solvedInThree: ArchiveEntry = {
  date: '2026-08-26',
  label: 'Wed',
  answer: { root: 'C', flavour: 'Minor' },
  outcome: 'solved',
  tries: 3,
}

const missed: ArchiveEntry = {
  date: '2026-08-24',
  label: 'Mon',
  answer: { root: 'E♭', flavour: 'Blues' },
  outcome: 'missed',
  tries: 3,
}

const THREE = [firstTry, solvedInThree, missed]

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
  it('renders under the section label, with the real total (R8)', () => {
    render(<ArchiveStrip entries={THREE} total={213} />)

    expect(screen.getByText(/grooves you.ve played/i)).toBeInTheDocument()
    expect(screen.getByText(/\b213\b/)).toBeInTheDocument()
  })

  it('renders the count as plain text, not a link — there is no archive route (R8)', () => {
    const { container } = render(<ArchiveStrip entries={THREE} total={213} />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
  })

  it('renders one card per entry, most recent first (R8, AC7)', () => {
    const { container } = render(<ArchiveStrip entries={THREE} total={3} />)

    const rendered = cards(container)
    expect(rendered).toHaveLength(3)
    expect(rendered[0].textContent).toContain('Yesterday')
    expect(rendered[1].textContent).toContain('Wed')
    expect(rendered[2].textContent).toContain('Mon')
  })

  it('shows every day its label, its mark and its answer (R9, AC7)', () => {
    const { container } = render(<ArchiveStrip entries={THREE} total={3} />)

    const yesterday = cardWith(container, 'Yesterday')
    expect(yesterday.textContent).toContain('solved')
    expect(yesterday.textContent).toContain('G Dorian')

    const wednesday = cardWith(container, 'Wed')
    expect(wednesday.textContent).toContain('3 tries')
    expect(wednesday.textContent).toContain('C Minor')
  })

  it('sets the answer in the display font (R9)', () => {
    render(<ArchiveStrip entries={THREE} total={3} />)

    expect(screen.getByText('G Dorian').className).toContain('font-display')
  })

  it('distinguishes the three outcomes by text, not colour alone (R10, AC8)', () => {
    const { container } = render(<ArchiveStrip entries={THREE} total={3} />)

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
    const { container } = render(<ArchiveStrip entries={THREE} total={3} />)

    const card = cardWith(container, 'missed')
    expect(card.textContent).toContain('E♭ Blues')
  })

  it('draws no sparkline or decorative bar graphic (R9, AC10)', () => {
    const { container } = render(<ArchiveStrip entries={THREE} total={3} />)

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

  it('renders at most the six most recent days (R8)', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      ...firstTry,
      date: `2026-08-${20 + i}`,
      label: `Day ${9 - i}`,
    }))

    const { container } = render(<ArchiveStrip entries={many} total={9} />)

    expect(cards(container)).toHaveLength(6)
    expect(cards(container)[0].textContent).toContain('Day 9')
  })

  it('shows a designed empty state and no grid when there is no history (R12, AC11)', () => {
    const { container } = render(<ArchiveStrip entries={[]} total={0} />)

    expect(screen.getByText(/no grooves behind you yet/i)).toBeInTheDocument()
    expect(container.querySelector('[class*="grid-cols"]')).toBeNull()
    expect(cards(container)).toEqual([])
  })
})
