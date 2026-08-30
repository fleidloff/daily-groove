import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Pill } from './Pill'

describe('Pill', () => {
  it('renders its label', () => {
    render(<Pill>12 days</Pill>)
    expect(screen.getByText('12 days')).toBeInTheDocument()
  })

  it('renders no icon when none is given', () => {
    render(<Pill>12 days</Pill>)
    expect(screen.queryByTestId('dot')).not.toBeInTheDocument()
  })

  it('renders the icon before the label', () => {
    render(<Pill icon={<span data-testid="dot">●</span>}>12 days</Pill>)

    const icon = screen.getByTestId('dot')
    const label = screen.getByText('12 days')

    expect(icon).toBeInTheDocument()
    expect(
      icon.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('is a rounded outline treatment', () => {
    const { container } = render(<Pill>12 days</Pill>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('rounded-full')
    expect(root.className).toContain('border')
  })
})
