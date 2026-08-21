import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultReveal } from './ResultReveal'

describe('ResultReveal', () => {
  it('shows a correct state and reveals the answer', () => {
    render(<ResultReveal correct answer="C minor" />)
    expect(screen.getByText(/correct/i)).toBeInTheDocument()
    expect(screen.queryByText(/incorrect/i)).not.toBeInTheDocument()
    expect(screen.getByText(/C minor/)).toBeInTheDocument()
  })

  it('shows an incorrect state and still reveals the answer', () => {
    render(<ResultReveal correct={false} answer="C minor" />)
    expect(screen.getByText(/incorrect/i)).toBeInTheDocument()
    expect(screen.getByText(/C minor/)).toBeInTheDocument()
  })
})
