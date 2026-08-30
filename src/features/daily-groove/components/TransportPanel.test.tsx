import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransportPanel } from './TransportPanel'

describe('TransportPanel', () => {
  it('divides the loop into four bars with three markers (R11)', () => {
    render(<TransportPanel position={0.3} isPlaying />)

    expect(screen.getAllByTestId('progress-divider')).toHaveLength(3)
  })

  it('renders no bar labels beneath the track (R6, AC6)', () => {
    render(<TransportPanel position={0.3} isPlaying />)

    expect(screen.queryByText(/^BAR /)).toBeNull()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('keeps the track inside its inset card (R6, AC6)', () => {
    const { container } = render(<TransportPanel position={0.3} isPlaying />)

    const card = container.firstElementChild
    expect(card).toHaveClass('bg-surface-inset')
    expect(card).toContainElement(screen.getByRole('progressbar'))
  })

  it('reflects the real playback position on the bar (R11)', () => {
    const { rerender } = render(<TransportPanel position={0.3} isPlaying />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '30',
    )

    rerender(<TransportPanel position={0.75} isPlaying />)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '75',
    )
  })

  it('highlights the sounding bar and moves with the position (AC8)', () => {
    const { rerender } = render(<TransportPanel position={0.1} isPlaying />)
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '0',
    )

    rerender(<TransportPanel position={0.3} isPlaying />)
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '1',
    )
  })

  it('returns the highlight to the first bar when the loop wraps (AC8)', () => {
    const { rerender } = render(<TransportPanel position={0.99} isPlaying />)
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '3',
    )

    rerender(<TransportPanel position={0.01} isPlaying />)
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '0',
    )
  })

  it('highlights no bar while paused or stopped (R11)', () => {
    const { container } = render(
      <TransportPanel position={0.3} isPlaying={false} />,
    )
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(0)
    expect(screen.queryByTestId('progress-active')).not.toBeInTheDocument()
  })
})
