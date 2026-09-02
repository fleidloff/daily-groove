import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransportPanel } from './TransportPanel'
import { renderFeature } from '../../testing/renderFeature'

describe('TransportPanel', () => {
  it('divides the loop into four bars with three markers (R11)', () => {
    render(<TransportPanel position={0.3} isPlaying passes={1} />)

    expect(screen.getAllByTestId('progress-divider')).toHaveLength(3)
  })

  it('renders no bar labels beneath the track (R6, AC6)', () => {
    render(<TransportPanel position={0.3} isPlaying passes={1} />)

    expect(screen.queryByText(/^BAR /)).toBeNull()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('keeps the track inside its inset card (R6, AC6)', () => {
    const { container } = render(<TransportPanel position={0.3} isPlaying passes={1} />)

    const card = container.firstElementChild
    expect(card).toHaveClass('bg-surface-inset')
    expect(card).toContainElement(screen.getByRole('progressbar'))
  })

  it('reflects the real playback position on the bar (R11)', () => {
    const { rerender } = render(<TransportPanel position={0.3} isPlaying passes={1} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '30',
    )

    rerender(<TransportPanel position={0.75} isPlaying passes={1} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '75',
    )
  })

  it('highlights the sounding bar and moves with the position (AC8)', () => {
    const { rerender } = render(<TransportPanel position={0.1} isPlaying passes={1} />)
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '0',
    )

    rerender(<TransportPanel position={0.3} isPlaying passes={1} />)
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '1',
    )
  })

  it('returns the highlight to the first bar when the loop wraps (AC8)', () => {
    const { rerender } = render(<TransportPanel position={0.99} isPlaying passes={1} />)
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '3',
    )

    rerender(<TransportPanel position={0.01} isPlaying passes={1} />)
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '0',
    )
  })

  it('highlights no bar while paused or stopped (R11)', () => {
    const { container } = render(
      <TransportPanel position={0.3} isPlaying={false} passes={1} />,
    )
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(0)
    expect(screen.queryByTestId('progress-active')).not.toBeInTheDocument()
  })
})

describe('TransportPanel across passes', () => {
  const fillWidth = () =>
    screen.getByTestId('progress-fill').getAttribute('width')

  it('fills across one pass of four, not across the file (R9, AC9)', () => {
    render(<TransportPanel position={0.3125} isPlaying passes={4} />)

    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '1',
    )
    expect(fillWidth()).toBe('25%')
  })

  it('does the same arithmetic for a two-pass groove (R9a, AC9)', () => {
    render(<TransportPanel position={0.625} isPlaying passes={2} />)

    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '1',
    )
    expect(fillWidth()).toBe('25%')
  })

  it('steps 1-2-3-4 and fills from empty to full within a pass (R9, AC9)', () => {
    const { rerender } = render(
      <TransportPanel position={0} isPlaying passes={4} />,
    )
    const seen: [string | null, string | null][] = []
    for (const position of [0, 0.0625, 0.125, 0.1875]) {
      rerender(<TransportPanel position={position} isPlaying passes={4} />)
      seen.push([
        screen.getByTestId('progress-active').getAttribute('data-segment'),
        fillWidth(),
      ])
    }
    expect(seen).toEqual([
      ['0', '0%'],
      ['1', '25%'],
      ['2', '50%'],
      ['3', '75%'],
    ])
  })

  it('resets the highlight and the fill together at the pass boundary (R9, AC9)', () => {
    const { rerender } = render(
      <TransportPanel position={0.2499} isPlaying passes={4} />,
    )
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '3',
    )

    rerender(<TransportPanel position={0.25} isPlaying passes={4} />)
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '0',
    )
    expect(fillWidth()).toBe('0%')
  })

  it('renders a single-pass groove exactly as before (R9a)', () => {
    render(<TransportPanel position={0.3} isPlaying passes={1} />)

    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '1',
    )
    expect(fillWidth()).toBe('30%')
  })

  it('highlights no bar while stopped, whatever the pass count (R11, AC11)', () => {
    render(<TransportPanel position={0.3125} isPlaying={false} passes={4} />)

    expect(screen.queryByTestId('progress-active')).not.toBeInTheDocument()
  })

  it('names or counts no pass anywhere in the panel (R10, AC10)', () => {
    const { container } = render(
      <TransportPanel position={0.3125} isPlaying passes={4} />,
    )

    expect(container.textContent).toBe('')
    expect(screen.queryByText(/pass/i)).toBeNull()
    expect(screen.queryByText(/of 4/)).toBeNull()
  })
})

describe('through the composed page', () => {
  it("shows today's transport", async () => {
    await renderFeature();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  })
})

describe('TransportPanel chord row', () => {
  const CHORDS = ['Em7', 'Bm7', 'C♯m7♭5', 'Em7']

  const cells = () =>
    Array.from(
      screen.getByTestId('chord-row').querySelectorAll<HTMLElement>('[data-bar]'),
    )

  const symbols = () => cells().map((cell) => cell.textContent)

  const dimmed = () => cells().map((cell) => /\bopacity-/.test(cell.className))

  const litSegment = () => {
    const rect = screen.queryByTestId('progress-active')
    return rect === null ? null : Number(rect.getAttribute('data-segment'))
  }

  it('draws no row at all when it is given no chords (R2, AC2)', () => {
    const { container } = render(<TransportPanel position={0.3} isPlaying passes={1} />)

    expect(screen.queryByTestId('chord-row')).toBeNull()
    const card = container.firstElementChild as HTMLElement
    expect(card.children).toHaveLength(1)
    expect(card.firstElementChild).toBe(screen.getByRole('progressbar'))
  })

  it('draws no row when the chords are explicitly null (R2, AC2)', () => {
    const { container } = render(
      <TransportPanel position={0.3} isPlaying passes={1} chords={null} />,
    )

    expect(screen.queryByTestId('chord-row')).toBeNull()
    expect((container.firstElementChild as HTMLElement).children).toHaveLength(1)
  })

  it('writes one symbol per bar, four columns wide, in the jazz face (R1, R7, R8, AC1)', () => {
    render(
      <TransportPanel position={0} isPlaying={false} passes={1} chords={CHORDS} />,
    )

    expect(symbols()).toEqual(CHORDS)
    expect(screen.getByTestId('chord-row').className).toMatch(/\bgrid-cols-4\b/)
    for (const cell of cells()) {
      const lettering = cell.firstElementChild as HTMLElement
      expect(lettering.textContent).toBe(cell.textContent)
      expect(lettering.className).toMatch(/font-jazz/)
    }
  })

  it('inks the sounding bar’s symbol and dims the other three (R4, R5, AC4)', () => {
    const { rerender } = render(
      <TransportPanel position={0.6} isPlaying passes={1} chords={CHORDS} />,
    )

    expect(dimmed()).toEqual([true, true, false, true])
    expect(litSegment()).toBe(2)

    rerender(<TransportPanel position={0.1} isPlaying passes={1} chords={CHORDS} />)
    expect(dimmed()).toEqual([false, true, true, true])
    expect(litSegment()).toBe(0)
  })

  it('draws all four alike when nothing is playing (R6, AC5)', () => {
    render(
      <TransportPanel position={0.6} isPlaying={false} passes={1} chords={CHORDS} />,
    )

    expect(symbols()).toEqual(CHORDS)
    expect(dimmed()).toEqual([false, false, false, false])
    expect(litSegment()).toBeNull()
    expect(new Set(cells().map((cell) => cell.className)).size).toBe(1)
  })

  it('moves the ink with the highlight across every boundary of a four-pass file (R5)', () => {
    const { rerender } = render(
      <TransportPanel position={0} isPlaying passes={4} chords={CHORDS} />,
    )

    for (const position of [0, 0.0624, 0.0625, 0.124, 0.1875, 0.2499, 0.25, 0.9999]) {
      rerender(
        <TransportPanel position={position} isPlaying passes={4} chords={CHORDS} />,
      )
      const lit = dimmed().indexOf(false)
      expect(lit, `position ${position}`).toBe(litSegment())
      expect(dimmed().filter((d) => !d), `position ${position}`).toHaveLength(1)
    }
  })

  it('announces nothing of its own (R10, AC6)', () => {
    render(<TransportPanel position={0.6} isPlaying passes={1} chords={CHORDS} />)

    const row = screen.getByTestId('chord-row')
    expect(row).not.toHaveAttribute('aria-live')
    expect(row).not.toHaveAttribute('role')
    expect(row.querySelectorAll('[aria-live], [role]')).toHaveLength(0)

    const track = screen.getByRole('progressbar')
    expect(track).toHaveAttribute('aria-valuenow', '60')
    expect(track).toHaveAttribute('aria-valuemin', '0')
    expect(track).toHaveAttribute('aria-valuemax', '100')
  })

  it('sits inside the track’s own inset card, directly above it (R6a, R9, R11)', () => {
    const { container } = render(
      <TransportPanel position={0.6} isPlaying passes={1} chords={CHORDS} />,
    )

    const card = container.firstElementChild as HTMLElement
    expect(card).toHaveClass('bg-surface-inset')
    const row = screen.getByTestId('chord-row')
    expect(card).toContainElement(row)
    expect(row.nextElementSibling).toBe(screen.getByRole('progressbar'))

    for (const cell of cells()) {
      expect(cell.className).not.toMatch(/\b(text|bg|fill)-/)
      expect(cell.className).not.toMatch(/\bdark:/)
    }
  })
})
