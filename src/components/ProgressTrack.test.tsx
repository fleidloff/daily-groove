import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressTrack } from './ProgressTrack'

describe('ProgressTrack', () => {
  it('exposes a progressbar with the value as a percentage', () => {
    render(<ProgressTrack value={0.3} segments={4} activeSegment={1} />)
    const bar = screen.getByRole('progressbar')

    expect(bar).toHaveAttribute('aria-valuenow', '30')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('renders one divider mark fewer than it has segments', () => {
    render(<ProgressTrack value={0.3} segments={4} activeSegment={1} />)
    expect(screen.getAllByTestId('progress-divider')).toHaveLength(3)
  })

  it('marks the active segment', () => {
    render(<ProgressTrack value={0.3} segments={4} activeSegment={1} />)
    const active = screen.getByTestId('progress-active')

    expect(active).toBeInTheDocument()
    expect(active).toHaveAttribute('data-segment', '1')
  })

  it('marks no segment active when activeSegment is null', () => {
    render(<ProgressTrack value={0.3} segments={4} activeSegment={null} />)
    expect(screen.queryByTestId('progress-active')).not.toBeInTheDocument()
  })

  it('clamps the value into 0..100', () => {
    const { rerender } = render(
      <ProgressTrack value={-1} segments={4} activeSegment={null} />,
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')

    rerender(<ProgressTrack value={4} segments={4} activeSegment={null} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  it('grows the fill with the value', () => {
    const { rerender } = render(
      <ProgressTrack value={0.25} segments={4} activeSegment={null} />,
    )
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('width', '25%')

    rerender(<ProgressTrack value={0.75} segments={4} activeSegment={null} />)
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('width', '75%')
  })
})
