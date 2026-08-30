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

  it('renders the masthead size in the jazz face', () => {
    for (const size of ['xl'] as const) {
      const { container } = render(
        <Heading level={2} size={size}>
          x
        </Heading>,
      )
      const className = (container.firstElementChild as HTMLElement).className
      expect(className, size).toContain('font-jazz')
      expect(className, size).not.toContain('font-display')
    }
  })

  it('keeps every size below the masthead on the serif', () => {
    for (const size of ['lg', 'md', 'sm'] as const) {
      const { container } = render(
        <Heading level={2} size={size}>
          x
        </Heading>,
      )
      const className = (container.firstElementChild as HTMLElement).className
      expect(className, size).toContain('font-display')
      expect(className, size).not.toContain('font-jazz')
    }
  })

  it('keeps all four sizes in the scale at their documented sizes', () => {
    const DOCUMENTED: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
      sm: 'text-[19px]',
      md: 'text-[22px]',
      lg: 'text-[30px]',
      xl: 'text-[34px]',
    }
    for (const [size, expected] of Object.entries(DOCUMENTED)) {
      const { container } = render(
        <Heading level={2} size={size as 'sm' | 'md' | 'lg' | 'xl'}>
          x
        </Heading>,
      )
      expect(
        (container.firstElementChild as HTMLElement).className,
        size,
      ).toContain(expected)
    }
  })

  it('renders the xl size larger above the small breakpoint', () => {
    const { container } = render(
      <Heading level={1} size="xl">
        x
      </Heading>,
    )
    expect((container.firstElementChild as HTMLElement).className).toContain(
      'sm:text-[44px]',
    )
  })

  it('renders the default tone in the body ink', () => {
    const { container } = render(
      <Heading level={2} size="lg">
        x
      </Heading>,
    )
    expect((container.firstElementChild as HTMLElement).className).toContain(
      'text-text',
    )
  })

  it('renders the inverted tone in the ink that reads on an accent fill', () => {
    const { container } = render(
      <Heading level={2} size="lg" tone="inverted">
        x
      </Heading>,
    )
    const className = (container.firstElementChild as HTMLElement).className
    expect(className).toContain('text-on-accent')
    expect(className).not.toContain('text-text')
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
