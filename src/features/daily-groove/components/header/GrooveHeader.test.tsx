import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GrooveHeader } from './GrooveHeader'
import { APP_NAME, TAGLINE } from '@/lib/branding'
import { renderFeature } from '../../testing/renderFeature'

describe('GrooveHeader', () => {
  it('drops the wordmark, and the date with it (F8 E1 R11, AC9)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)
    expect(screen.queryByText('daily-groove')).toBeNull()
    expect(screen.queryByText('Saturday, 29 August')).toBeNull()
  })

  it('sets the page title to the app name (F8 E1 R1, R2, AC1, AC2)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)
    expect(
      screen.getByRole('heading', { level: 1, name: APP_NAME }),
    ).toBeInTheDocument()
  })

  it('shows no date at all (F8 E1 R11, AC9)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)
    expect(screen.queryByText('Saturday, 29 August')).toBeNull()
    expect(screen.queryByText('Saturday')).toBeNull()
  })

  it('carries the tagline under the name (F8 E1 R3, R4, AC3, AC4)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    expect(screen.getByText(TAGLINE)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      APP_NAME,
    )
    expect(screen.queryByRole('heading', { name: TAGLINE })).toBeNull()
  })

  it('renders the tagline as muted body copy (F8 E1 R5, AC8)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    const tagline = screen.getByText(TAGLINE)
    expect(tagline.tagName).toBe('P')
    expect(tagline.className).toContain('text-text-muted')
  })

  it('takes the streak, the help handler and one slot (F8 E1 R12, AC10; F12 E2 R1a)', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/daily-groove/components/header/GrooveHeader.tsx',
      ),
      'utf8',
    )

    const block = source.match(/type GrooveHeaderProps = \{([\s\S]*?)\n\}/)
    expect(block).not.toBeNull()

    const props = [
      ...(block as RegExpMatchArray)[1].matchAll(/^\s{2}(\w+)\??:/gm),
    ].map((match) => match[1])
    expect(props).toEqual(['streak', 'onShowHelp', 'share'])

    expect(source).not.toContain('dateLine')
  })

  it('ends the tagline line with a question mark that asks for the box (F8 E3 R8, R9, R10, AC10)', async () => {
    const onShowHelp = vi.fn()
    render(<GrooveHeader streak={12} onShowHelp={onShowHelp} />)

    const help = screen.getByRole('button', { name: 'How to play' })
    expect(help).toBeInTheDocument()

    await userEvent.click(help)
    expect(onShowHelp).toHaveBeenCalledTimes(1)
  })

  it('offers the question mark to every player, whatever their streak (F8 E3 R10)', () => {
    render(<GrooveHeader streak={0} onShowHelp={() => {}} />)
    expect(
      screen.getByRole('button', { name: 'How to play' }),
    ).toBeInTheDocument()
  })

  it('puts the question mark inside the tagline, after its last word (F8 E3 R8)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    const tagline = screen.getByText(TAGLINE)
    const help = screen.getByRole('button', { name: 'How to play' })

    expect(tagline.tagName).toBe('P')
    expect(tagline).toContainElement(help)
    expect(tagline.lastElementChild).toBe(help)
  })

  it('drops the question mark when there is nothing to ask for (F8 E3 R10)', () => {
    render(<GrooveHeader streak={12} onShowHelp={null} />)

    expect(screen.queryByRole('button', { name: 'How to play' })).toBeNull()
    expect(screen.getByText(TAGLINE)).toBeInTheDocument()
  })

  it('keeps the streak at the right even when the header stacks (F8 E2 R10a, AC9a)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    const anchor = screen.getByLabelText(/current streak/i)
      .parentElement as HTMLElement
    expect(anchor.className).toContain('self-end')
    expect(anchor.className).toContain('sm:self-auto')
  })

  it('anchors the title block to the left when the header stacks (F8 E2 R10a)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    const anchor = screen.getByRole('heading', { level: 1 })
      .parentElement?.parentElement as HTMLElement
    expect(anchor.className).toContain('self-start')
    expect(anchor.className).toContain('sm:self-auto')
  })

  it('carries the streak pill (R3)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)
    const badge = screen.getByLabelText(/current streak/i)
    expect(badge).toHaveTextContent('12 days streak')
  })
})

describe('through the composed page', () => {
  it("shows the streak badge alongside the puzzle (AC6)", async () => {
    await renderFeature();

    expect(screen.getByLabelText(/current streak/i)).toBeInTheDocument();
  })
})

describe('the header row (F8 E2)', () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      'src/features/daily-groove/components/header/GrooveHeader.tsx',
    ),
    'utf8',
  )

  it('aligns its two sides on their centres (F8 E2 R8, R9, AC8)', () => {
    expect(source).toMatch(/<Row[^>]*align="center"/)
    expect(source).not.toMatch(/<Row[^>]*align="start"/)
  })

  it('still stacks below the collapse breakpoint (F8 E2 R10, AC9)', () => {
    expect(source).toMatch(/<Row[^>]*collapseBelow="sm"/)
  })
})

describe('the share slot (F12 E2)', () => {
  const slot = () => (
    <button type="button" onClick={() => {}}>
      Share
    </button>
  )

  it('renders the slot inside the header, beside the streak pill (R1, R1a, AC1, AC11)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} share={slot()} />)

    const share = screen.getByRole('button', { name: 'Share' })
    const badge = screen.getByLabelText(/current streak/i)

    expect(share.closest('header')).not.toBeNull()
    const anchor = badge.closest('.self-end') as HTMLElement
    expect(anchor).not.toBeNull()
    expect(anchor).toContainElement(share)
  })

  it('keeps both at the end of their line when the header stacks (R1b, AC11)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} share={slot()} />)

    const anchor = screen
      .getByLabelText(/current streak/i)
      .closest('.self-end') as HTMLElement
    expect(anchor.className).toContain('self-end')
    expect(anchor.className).toContain('sm:self-auto')
    expect(anchor).toContainElement(screen.getByRole('button', { name: 'Share' }))
  })

  it('renders unchanged when no slot is given (R1)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
    expect(
      screen.getByRole('heading', { level: 1, name: APP_NAME }),
    ).toBeInTheDocument()
    expect(screen.getByText(TAGLINE)).toBeInTheDocument()
    const badge = screen.getByLabelText(/current streak/i)
    expect(badge).toHaveTextContent('12 days streak')
    expect((badge.parentElement as HTMLElement).className).toContain('self-end')
  })

  it('learns nothing about sharing to render it (R1a)', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/daily-groove/components/header/GrooveHeader.tsx',
      ),
      'utf8',
    )

    expect(source).not.toMatch(/from ['"][^'"]*share/)
    expect(source).not.toContain('shareUrlOf')
    expect(source).not.toContain('ShareGroove')
  })
})
