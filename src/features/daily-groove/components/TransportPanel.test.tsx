import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransportPanel } from './TransportPanel'

describe('TransportPanel', () => {
  it('divides the loop into four bars with three markers (R11)', () => {
    render(<TransportPanel position={0.3} isPlaying />)

    expect(screen.getAllByTestId('progress-divider')).toHaveLength(3)
    for (const label of ['BAR 1', 'BAR 2', 'BAR 3', 'BAR 4']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
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
    expect(screen.getByText('BAR 1')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('BAR 2')).not.toHaveAttribute('aria-current')

    rerender(<TransportPanel position={0.3} isPlaying />)
    expect(screen.getByText('BAR 2')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('BAR 1')).not.toHaveAttribute('aria-current')
  })

  it('returns the highlight to the first bar when the loop wraps (AC8)', () => {
    const { rerender } = render(<TransportPanel position={0.99} isPlaying />)
    expect(screen.getByText('BAR 4')).toHaveAttribute('aria-current', 'true')

    rerender(<TransportPanel position={0.01} isPlaying />)
    expect(screen.getByText('BAR 1')).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('BAR 4')).not.toHaveAttribute('aria-current')
  })

  it('highlights no bar while paused or stopped (R11)', () => {
    const { container } = render(
      <TransportPanel position={0.3} isPlaying={false} />,
    )
    expect(container.querySelectorAll('[aria-current]')).toHaveLength(0)
    expect(screen.queryByTestId('progress-active')).not.toBeInTheDocument()
  })
})
