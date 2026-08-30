import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Heading } from './Heading'

describe('Heading', () => {
  it('renders level 1 as an h1', () => {
    render(
      <Heading level={1} size="xl">
        Chapter one
      </Heading>,
    )
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Chapter one/,
    )
  })

  it('renders level 2 as an h2', () => {
    render(
      <Heading level={2} size="lg">
        Sunroom Shuffle
      </Heading>,
    )
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Sunroom Shuffle',
    )
  })

  it('renders level 3 as an h3', () => {
    render(
      <Heading level={3} size="md">
        What is it?
      </Heading>,
    )
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('What is it?')
  })

  it('sets display text in the display font', () => {
    const { container } = render(
      <Heading level={2} size="md">
        x
      </Heading>,
    )
    expect((container.firstElementChild as HTMLElement).className).toContain(
      'font-display',
    )
  })

  it('resolves each size to a distinct class string', () => {
    const classes = (['sm', 'md', 'lg', 'xl'] as const).map(
      (size) =>
        (render(<Heading level={2} size={size}>x</Heading>).container
          .firstElementChild as HTMLElement).className,
    )
    expect(new Set(classes).size).toBe(4)
  })
})
