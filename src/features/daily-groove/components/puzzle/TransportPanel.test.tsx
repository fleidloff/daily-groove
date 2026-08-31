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

/**
 * Feature-9, Epic 1, Step D2 (R9, R9a, R11, R12). The file is now several
 * passes of the same four-bar figure, but the track still draws four bars. The
 * panel is told the pass count and derives both the fill and the highlight from
 * one scaled value, so they cannot disagree at a boundary. `ProgressTrack`
 * learns nothing about any of it — it is handed a plain 0..1 fill (R12).
 */
describe('TransportPanel across passes', () => {
  /** The `progress-fill` rect's width, as ProgressTrack renders it. */
  const fillWidth = () =>
    screen.getByTestId('progress-fill').getAttribute('width')

  it('fills across one pass of four, not across the file (R9, AC9)', () => {
    // Five sixteenths through a sixteen-bar loop: bar 2 of pass 2.
    render(<TransportPanel position={0.3125} isPlaying passes={4} />)

    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '1',
    )
    expect(fillWidth()).toBe('25%')
  })

  it('does the same arithmetic for a two-pass groove (R9a, AC9)', () => {
    // Five eighths through an eight-bar loop is the same point of a pass.
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

    // The first frame of pass 2: the fill is empty again and bar 1 is lit.
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

/**
 * Relocated from `src/app/page.test.tsx` (Epic 3, Step C2). The panel's own
 * tests hand it a position; this one asserts that the page composes a transport
 * at all, which only holds with the whole feature rendered.
 */
describe('through the composed page', () => {
  it("shows today's transport", async () => {
    await renderFeature();

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  })
})
